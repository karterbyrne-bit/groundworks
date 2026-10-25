// End-to-end smoke test: opens the built index.html in a real browser at desktop and phone sizes and clicks through
// the main features, failing on any error. Run: npm test   (after npm run build)
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const types = { html: "text/html", svg: "image/svg+xml", png: "image/png", webmanifest: "application/manifest+json", js: "text/javascript" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(req.url.split(/[?#]/)[0]).replace(/^\/+/, "") || "index.html";
  try { const body = readFileSync(new URL(path, root)); res.writeHead(200, { "content-type": types[path.split(".").pop()] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? "  ok  " : "  FAIL"} ${what}`); if (!ok) failures++; };
const browser = await chromium.launch();

for (const [name, viewport] of [["desktop", { width: 1400, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  console.log(`\n${name} (${viewport.width}×${viewport.height})`);
  const ctx = await browser.newContext({ viewport, hasTouch: name === "phone" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.addInitScript(() => { window.__frames = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = f => raf(t => { window.__frames++; f(t); }); });
  const errors = [], external = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("request", r => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) external.push(r.url()); });

  const t0 = Date.now();
  await page.goto(base, { timeout: 120000 });
  await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
  console.log(`        first frame after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  check(external.length === 0, "loads nothing from other websites" + (external.length ? `: ${external.join(", ")}` : ""));
  check(await page.locator("#welcome").evaluate(d => d.open), "welcome card greets a first-time visitor");
  await page.click("#welcome .btn.primary");
  const cap = () => page.evaluate(() => window.__gw.last().total);
  check((await cap()) > 1000, "default stadium has a capacity");

  await page.click('[data-p="wrestle"]'); await page.waitForTimeout(300);
  await page.evaluate(() => { const b = document.getElementById("boards"); if (!b.checked){ b.checked = true; b.dispatchEvent(new Event("change")); } });
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.__gw.boards()), "sponsor boards go round a wrestleball pitch");
  for (const p of ["bowl", "leitch", "bullring"]) {
    await page.click(`[data-p="${p}"]`); await page.waitForTimeout(300);
    check((await cap()) > 0, `preset "${p}" builds`);
  }
  // upper tiers on their own outline, and façade looks
  for (const p of ["oval", "cartuja"]) {
    await page.click(`[data-p="${p}"]`); await page.waitForTimeout(300);
    check((await cap()) > 20000 && !(await page.evaluate(() => window.__gw.last().issues.length)), `preset "${p}" builds with no warnings`);
  }
  await page.click('#panes [data-pane="ground"]');
  const capBefore = await cap();
  for (const [shape, fit] of [["circle", "fill"], ["follow", "ring"], ["oval", "ring"]]) { await page.click(`label[for="os-${shape}"]`); if (shape !== "follow") await page.click(`label[for="of-${fit}"]`); await page.waitForTimeout(300); }
  check((await cap()) === capBefore, "switching the upper-tier outline round and back restores the stadium");
  await page.click('#panes [data-pane="stands"]');
  await page.locator('select[data-p="facade.look"]').selectOption("glass"); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.state().bowl.facade.look)) === "glass", "the outside-wall look can be changed");
  await page.click('#panes [data-pane="start"]');

  // bowls with parts left out and their own rows on each side, and one roof over the whole ground
  const last = () => page.evaluate(() => { const L = window.__gw.last(); return {total:L.total, covered:L.covered, issues:L.issues.length}; });
  await page.click('[data-p="horseshoe"]'); await page.waitForTimeout(300);
  check((await cap()) > 20000 && !(await last()).issues, 'preset "horseshoe" builds with no warnings');
  await page.click('[data-p="bowl"]'); await page.waitForTimeout(300);
  const fullBowl = await cap();
  await page.click('#panes [data-pane="stands"]');
  await page.click('[data-act="bowlShape"][data-shape="horseshoe"]'); await page.waitForTimeout(300);
  const shoe = await cap();
  check(shoe > 0 && shoe < fullBowl * 0.9, "leaving the end out of a bowl makes a horseshoe");
  await page.click('[data-piece="W"]'); await page.waitForTimeout(300);
  check((await cap()) === fullBowl, "building the end again closes the bowl");
  await page.check('input[data-p="bowlVary"]'); await page.waitForTimeout(300);
  check((await cap()) === fullBowl, "giving each side its own rows starts from the same bowl");
  await page.fill('input[data-p="tiers.0.sideRows.E"]', "10"); await page.waitForTimeout(300);
  check((await cap()) < fullBowl, "one side of a bowl can be made shallower");
  const zigs = await page.evaluate(() => { const r = window.__gw.regions()[0], P = r.profs, n = P.length; let worst = 0;
    for (let k=1;k<3;k++){ let flips = 0, dir = 0;
      for (let i=0;i<n;i++){ const p = P[i][k], q = P[(i+1)%n][k]; if (!p || !q || p.rows < 1 || q.rows < 1 || p.ghost || q.ghost) continue;
        const d = q.hF - p.hF; if (Math.abs(d) < 0.01) continue; const sg = Math.sign(d); if (dir && sg !== dir) flips++; dir = sg; }
      worst = Math.max(worst, flips); }
    return worst; });
  check(zigs <= 4, `upper tiers of a bowl sweep smoothly round its corners, no kinks (${zigs} turns)`);
  await page.click('[data-act="toggleRoof"]'); await page.waitForTimeout(300);
  const bare = (await last()).covered;
  await page.check("#grOn"); await page.waitForTimeout(300);
  for (const shape of ["oval", "circle", "follow"]) { await page.selectOption('select[data-p="gr.shape"]', shape); await page.waitForTimeout(300); }
  const roofed = await last();
  check(bare === 0 && roofed.covered > roofed.total * 0.9, "one roof over the whole ground covers the seats");
  await page.click('#panes [data-pane="start"]');
  await page.click('[data-p="ringroof"]');
  await page.waitForFunction(() => !window.__gw.busy() && window.__gw.last().parts.some(p => p.label === "West end"));
  const rr = await last();
  check(rr.total > 15000 && rr.covered / rr.total > 0.9 && !rr.issues, 'preset "ringroof" builds under one roof with no warnings');
  await page.click('#panes [data-pane="start"]');

  // Ibrox: a deck on towers over an old stand; per-tier looks and lettering; typed plot sizes
  await page.click('[data-p="ibrox"]');
  await page.waitForFunction(() => !window.__gw.busy() && window.__gw.last().parts.some(p => p.label === "Main stand") && window.__gw.state().stands.N.tiers.length === 3);
  const ib = await last();
  check(ib.total > 20000 && !ib.issues, 'preset "ibrox" builds with no warnings');
  await page.click('[data-p="ot"]'); await page.waitForTimeout(300);
  check(!(await last()).issues, 'preset "ot" builds with no warnings');
  await page.click('#panes [data-pane="stands"]'); await page.click('[data-tab="N"]'); await page.waitForTimeout(300);
  await page.locator('.tier[data-k="2"] details[data-more] summary').click();
  await page.selectOption('.tier[data-k="2"] select[data-p="tiers.2.support"]', "towers"); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.state().stands.N.tiers[2].hold)) === "towers", "a tier can be held up by towers at each end");
  await page.fill('input[type=number][data-p="tiers.2.trim0"]', "12"); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.state().stands.N.tiers[2].trim0)) === 12 && (await cap()) > 0, "a tier can stop short of the end of its stand");
  await page.fill("#facSign", "GROUNDWORKS"); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.state().stands.N.facade.sign)) === "GROUNDWORKS", "lettering can go on the outside wall");
  // stands own their length: wrapping round into a corner, and corners just fill what's left
  const beforeWrap = await cap();
  await page.locator('[data-wrap="1"]').evaluate(el => { el.value = "60"; el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true})); }); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.state().stands.N.wrap1)) === 0.6 && (await cap()) > beforeWrap, "a stand on a bowl can wrap part way round a corner");
  await page.click('[data-tab="C"]'); await page.waitForTimeout(200);
  const beforeFill = await cap(); await page.click('[data-cfill="SE"]'); await page.waitForTimeout(300);
  const afterFill = await cap(); await page.click('[data-copen="SE"]'); await page.selectOption('select[data-corner="SE"][data-cf="mode"]', "stand"); await page.waitForTimeout(300);
  check(afterFill >= beforeFill && (await cap()) > 0 && (await page.evaluate(() => window.__gw.state().corners.SE.mode)) === "stand", "a corner can be filled by the stands or given its own corner stand");
  await page.click('#panes [data-pane="start"]'); await page.click('[data-p="mixed"]'); await page.waitForTimeout(300);
  await page.click('#panes [data-pane="stands"]'); await page.waitForTimeout(200); await page.click('[data-tab="S"]');
  await page.waitForSelector('input[type=number][data-p="run0"]', {state:"visible"}); const shortS = await cap(); await page.fill('input[type=number][data-p="run0"]', "20"); await page.press('input[type=number][data-p="run0"]', "Tab"); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.state().stands.S.run0)) === 20 && (await cap()) > shortS, "a stand can run on past the end of the pitch");
  await page.click('#panes [data-pane="ground"]'); await page.check("#plotOn"); await page.waitForTimeout(300);
  await page.locator("#plotExact summary").click(); await page.fill("#plotW", "260"); await page.press("#plotW", "Enter"); await page.waitForTimeout(300);
  check((await page.evaluate(() => { const xs = window.__gw.state().plot.pts.map(p => p[0]); return Math.max(...xs) - Math.min(...xs); })) === 260, "the plot can be set to an exact width");
  // as many tiers as you like: no stopping at four
  await page.click('#panes [data-pane="stands"]'); await page.click('[data-tab="N"]'); await page.waitForTimeout(200);
  const tiersCap = await cap(), tiers0 = await page.evaluate(() => window.__gw.state().stands.N.tiers.length);
  for (let i = 0; i < 4; i++){ await page.click('[data-act="addTier"]'); await page.waitForTimeout(250); }
  const nTiers = await page.evaluate(() => window.__gw.state().stands.N.tiers.length);
  check(nTiers === tiers0 + 4 && nTiers > 4 && (await cap()) > tiersCap, `a stand can have more than four tiers (${nTiers})`);
  check(errors.length === 0, "tall stands build without errors");
  await page.click('#panes [data-pane="start"]');
  // cricket and baseball: rings of stands
  await page.click('#panes [data-pane="start"]');
  for (const p of ["lords", "classicpark", "ballpark"]){ await page.click(`[data-p="${p}"]`);
    await page.waitForFunction(() => window.__gw.state().layout === "ring" && window.__gw.last().parts.length > 2); await page.waitForTimeout(200);
    const r = await last(); check(r.total > 10000 && !r.issues, `preset "${p}" builds with no warnings`); }
  await page.click('#panes [data-pane="stands"]'); const nStands = await page.locator("#tabs button").count();
  await page.click('[data-ring="+"]'); await page.waitForTimeout(300);
  check((await page.locator("#tabs button").count()) === nStands + 1, "a ring can have another stand added");
  // a convertible ground: football and athletics
  await page.click('#panes [data-pane="start"]'); await page.click('[data-p="bowl"]'); await page.waitForTimeout(300);
  const footy = await cap();
  await page.click('#panes [data-pane="ground"]'); await page.check("#cvOn"); await page.waitForTimeout(300);
  await page.click('label[for="cvs-second"]'); await page.waitForTimeout(400);
  const athletics = await cap();
  check(athletics > footy*0.9 && athletics < footy*1.05 && !(await last()).issues, "the lower tier slides back to fit an athletics track");
  await page.selectOption("#cvHow", "cover"); await page.waitForTimeout(400);
  check((await cap()) < athletics, "decking over the front rows costs seats");
  const roofsNow = () => page.evaluate(() => window.__gw.last().screenCtx.anchors.map(g => (g.RR || []).filter(Boolean).map(r => r.inner.toFixed(2) + "@" + r.y(0).toFixed(2)).join(",")).join("|"));
  const roofsAth = await roofsNow();
  await page.click('label[for="cvs-base"]'); await page.waitForTimeout(400);
  check((await cap()) === footy, "switching back to football restores the ground");
  check((await roofsNow()) === roofsAth, "converting moves seats, not the roof");
  await page.uncheck("#cvOn"); await page.waitForTimeout(300);
  // a blank pitch, and football's hard stop at the pitch and its run-off
  await page.click('#panes [data-pane="start"]'); await page.click('[data-p="blank"]'); await page.waitForTimeout(300);
  check((await cap()) === 0 && !(await last()).issues, "the blank pitch has nothing built");
  await page.click('#panes [data-pane="ground"]');
  await page.evaluate(() => { const el = document.getElementById("setback"); el.min = 0; el.value = "1"; el.dispatchEvent(new Event("input", {bubbles:true})); }); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.state().setback)) >= 3, "stands can't come onto the run-off round a football pitch");
  // surroundings: a road beside the ground, and a building that the east end is cut back to clear
  await page.click('#panes [data-pane="start"]'); await page.click('[data-p="mixed"]'); await page.waitForTimeout(300);
  const unboxed = await cap();
  await page.click('#panes [data-pane="ground"]'); await page.click('[data-site="road"]'); await page.waitForTimeout(300);
  check((await cap()) === unboxed && (await page.evaluate(() => window.__gw.state().site.length)) === 1, "a road can be added beside the ground");
  await page.click('[data-site="building"]'); await page.waitForTimeout(300);
  await page.evaluate(() => { for (const [k, v] of [["x", "75"], ["z", "0"]]){ const el = document.querySelector(`input[type=number][data-sf2="${k}"][data-i="1"]`); el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); } });
  await page.waitForTimeout(400);
  check((await cap()) < unboxed, "a stand is cut back to clear a building");
  await page.click('#panes [data-pane="start"]');

  const beforeRandom = await page.evaluate(() => JSON.stringify(window.__gw.state()));
  await page.click("#randomBtn"); await page.waitForTimeout(300);
  check((await cap()) > 0, "Surprise me builds a stadium");
  await page.click("#undoBtn"); await page.waitForTimeout(300);
  check((await page.evaluate(() => JSON.stringify(window.__gw.state()))) === beforeRandom, "Undo goes back to the previous design");

  for (const pane of ["ground", "stands", "look", "results", "rules", "start"]) await page.click(`#panes [data-pane="${pane}"]`);
  check(await page.locator('#panebody > [data-pane="start"].on').first().isVisible(), "section tabs switch");

  await page.click('#panes [data-pane="results"]');
  const fix = page.locator("[data-fixall]");
  if (await fix.count()) { await fix.click(); await page.waitForTimeout(300); check(await page.locator(".toast").count() > 0, "Fix all reports what it did"); }

  // screens: adding one then switching it to an LED ribbon used to wipe the whole stadium from the 3D view
  await page.click('#panes [data-pane="look"]');
  await page.click("#addScreen"); await page.waitForTimeout(300);
  check(!(await page.evaluate(() => window.__gw.last().issues.some(i => /^Screen/.test(i.text)))), "a new screen is mounted somewhere it fits");
  for (const mount of ["ribbon", "roof", "ribbon"]) { await page.locator("#screens .screen").last().locator('[data-sf="mount"]').selectOption(mount); await page.waitForTimeout(300); }
  check(errors.length === 0 && (await cap()) > 0, "screens and LED ribbons can be added and changed");

  // naming rights and sponsors
  await page.fill("#spTitle", "Kestrel Bank Arena"); await page.fill("#spNames", "ACME\nNORTHLINE"); await page.waitForTimeout(400);
  const sp = await page.evaluate(() => window.__gw.state().sponsors);
  check(sp.title === "Kestrel Bank Arena" && sp.names.join() === "ACME,NORTHLINE" && (await page.locator("#stadiumTitle").textContent()) === "Kestrel Bank Arena", "the ground can be named and given sponsors");
  await page.fill("#spTitle", "<b>Bad</b>"); await page.waitForTimeout(200);
  check(!(await page.evaluate(() => window.__gw.state().sponsors.title)).includes("<"), "markup is stripped from names");
  await page.fill("#spTitle", ""); await page.evaluate(() => document.activeElement.blur());

  // letters in the seats, players on the pitch, the time of day
  const plain = await page.evaluate(() => window.__gw.last().total);
  await page.fill("#seatText", "UNITED"); await page.waitForTimeout(400); await page.waitForFunction(() => !window.__gw.busy());
  const st0 = await page.evaluate(() => window.__gw.state().seatText);
  check(st0.text === "UNITED" && !!st0.at && (await page.evaluate(() => window.__gw.last().total)) === plain && errors.length === 0, "letters can be spelt out in the seats without changing the capacity");
  await page.fill("#seatText", ""); await page.evaluate(() => document.activeElement.blur());
  if (await page.locator("#players").isVisible()){ await page.check("#players"); await page.waitForTimeout(300); check(errors.length === 0 && (await page.evaluate(() => window.__gw.state().players)), "players can line up for kick-off"); await page.uncheck("#players"); }
  await page.evaluate(() => { const el = document.getElementById("hour"); el.value = "19.5"; el.dispatchEvent(new Event("input", {bubbles:true})); });
  check((await page.evaluate(() => window.__gw.state().hour)) === 19.5 && /7:30 pm/.test(await page.locator("#o-hour").textContent()), "the time of day can be set");
  // players' tunnel, dugouts in each style, and emergency exits
  await page.click('#panes [data-pane="start"]'); await page.click('[data-p="bowl"]'); await page.waitForTimeout(300); await page.click('#panes [data-pane="look"]');
  const noTunnel = await cap(); await page.check("#tnOn"); await page.waitForTimeout(300);
  check((await cap()) < noTunnel && errors.length === 0, "a players' tunnel takes out the front rows where it comes through");
  await page.check("#dgOn"); await page.waitForTimeout(300);
  for (const style of ["sunk", "seats", "bubble"]){ await page.selectOption("#dgStyle", style); await page.waitForTimeout(300); }
  check(errors.length === 0 && (await page.evaluate(() => window.__gw.state().dugouts.style)) === "bubble", "dugouts can be perspex, sunk into the stand or padded seats");
  await page.click('#panes [data-pane="rules"]'); const em0 = await page.evaluate(() => window.__gw.last().slowestEm);
  await page.evaluate(() => { const el = document.getElementById("emergEvery"); el.value = "20"; el.dispatchEvent(new Event("input", {bubbles:true})); }); await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__gw.last().slowestEm)) < em0, "emergency exits at the back of the tiers speed up an evacuation");
  // wheelchair spaces meet the guidance when switched on; emergency vehicles get a way onto the pitch
  const beforeAccess = await cap(); await page.check("#acOn"); await page.waitForTimeout(400);
  const acc = await page.evaluate(() => { const D = window.__gw.last(); return {wc:D.wheelchair, short:D.issues.some(i => i.key === "access:spaces")}; });
  check(acc.wc > 100 && !acc.short && (await cap()) < beforeAccess, `wheelchair spaces are added to meet the guidance (${acc.wc})`);
  await page.check("#vhOn"); await page.waitForTimeout(400);
  check(errors.length === 0 && (await page.evaluate(() => window.__gw.state().vehicle.on)), "an emergency vehicle entrance can go through a stand");
  await page.uncheck("#acOn"); await page.uncheck("#vhOn");
  // how fans get into a tier, and each stand's facilities
  await page.click('#panes [data-pane="stands"]'); await page.waitForTimeout(200);
  const tierMore = page.locator('.tier[data-k="0"] details[data-more]').first(); if (!(await tierMore.evaluate(d => d.open))) await tierMore.locator("summary").click();
  const entrySel = page.locator('.tier[data-k="0"] select[data-p$=".entry"]').first();
  await entrySel.selectOption("back"); await page.waitForTimeout(300); const fromBack = await cap();
  await page.locator('.tier[data-k="0"] select[data-p$=".entry"]').first().selectOption("middle"); await page.waitForTimeout(300);
  check((await cap()) < fromBack && await page.locator('.tier[data-k="0"] input[type=range][data-p$=".entryAt"]').count() > 0, "fans can come in from the back, or from the middle at a height you choose");
  await page.locator('.tier[data-k="0"] select[data-p$=".entry"]').first().selectOption("auto"); await page.waitForTimeout(300);
  await page.locator('details.sub', {hasText:"Facilities, access and fire risk"}).locator("summary").first().click();
  await page.locator('select[data-p="facilities"]').selectOption("premium"); await page.waitForTimeout(300);
  check(errors.length === 0 && /premium/.test(await page.evaluate(() => JSON.stringify(window.__gw.state()))), "a stand's facilities can be chosen");
  await page.click('#panes [data-pane="look"]'); await page.uncheck("#tnOn"); await page.uncheck("#dgOn");

  // architect's notes
  await page.click('#panes [data-pane="results"]');
  check(/Architect's notes/.test(await page.locator("#architect").textContent()) && await page.locator("#architect .score").count() === 5, "the architect's notes score the design");
  await page.click('#panes [data-pane="look"]');

  // memory stays flat: picking colour after colour mustn't leave old materials behind
  const memBefore = await page.evaluate(() => window.__gw.memory());
  for (let i = 0; i < 25; i++){ await page.evaluate(i => { const el = document.querySelector('input[type=color][data-p]'); el.value = "#" + (0x204060 + i*0x050301).toString(16); el.dispatchEvent(new Event("input", {bubbles:true})); }, i); await page.waitForTimeout(40); }
  await page.waitForFunction(() => !window.__gw.busy());
  const memAfter = await page.evaluate(() => window.__gw.memory());
  check(memAfter.materials <= memBefore.materials + 3 && memAfter.textures <= memBefore.textures + 3, `memory stays flat after many colour changes (${memBefore.materials}→${memAfter.materials} materials)`);
  // the 3D view goes to sleep when nothing moves
  await page.waitForTimeout(1500);
  const framesIdle = await page.evaluate(async () => { const n0 = window.__frames; await new Promise(res => setTimeout(res, 1000)); return window.__frames - n0; });
  check(framesIdle === 0, `nothing is redrawn while the stadium sits still (${framesIdle} frames in a second)`);

  // share link round trip: copy a link, open it in a fresh page, get the same stadium
  const before = await page.evaluate(() => JSON.stringify(window.__gw.state()));
  const link = await page.evaluate(async () => { let url = ""; navigator.clipboard.writeText = async t => { url = t; }; navigator.share = undefined; document.getElementById("shareBtn").click(); for (let i = 0; i < 100 && !url; i++) await new Promise(r => setTimeout(r, 100)); return url; });
  check(/#d=z/.test(link), "Share makes a compressed link");
  const page2 = await ctx.newPage();
  page2.on("pageerror", e => errors.push(e.message));
  await page2.goto(link.replace(/^https?:\/\/[^/]+\//, base));
  await page2.waitForFunction(() => document.documentElement.classList.contains("ready"));
  await page2.waitForTimeout(800);
  check((await page2.evaluate(() => JSON.stringify(window.__gw.state()))) === before, "the shared link opens the same stadium");
  check(!page2.url().includes("#d="), "the link is tidied out of the address bar");
  await page2.close();

  // a tampered link is refused instead of being run
  const bad = await ctx.newPage();
  await bad.goto(base + "#d=j" + Buffer.from(JSON.stringify({ version: 6, sport: "football", stands: {}, bowl: {}, limits: {}, types: {}, seat: "<img src=x onerror=alert(1)>" })).toString("base64url"));
  await bad.waitForFunction(() => document.documentElement.classList.contains("ready"));
  await bad.waitForTimeout(500);
  check(!(await bad.evaluate(() => window.__gw.state().seat.includes("<"))), "a tampered link is refused");
  await bad.close();

  // a damaged design code is refused with a message, and the current design is left alone
  const keep = await page.evaluate(() => JSON.stringify(window.__gw.state()));
  await page.click('#panes [data-pane="start"]');
  await page.evaluate(() => { const d = document.getElementById("codeBox").closest("details"); if (d) d.open = true; });
  const halfDesign = await page.evaluate(() => { const st = window.__gw.state(); delete st.stands.N.tiers; st.bowl.tiers = [{type:"seated"}]; return btoa(JSON.stringify(st)); });
  for (const [code, what] of [[halfDesign, "half a design"], [halfDesign.slice(0, halfDesign.length >> 1), "a code cut off part way"]]){
    await page.fill("#codeBox", code); await page.click("#importBtn"); await page.waitForTimeout(300);
    check((await page.evaluate(() => JSON.stringify(window.__gw.state()))) === keep && /look right/.test(await page.locator(".toast").last().textContent()), `${what} is refused with a message`);
  }
  await page.fill("#codeBox", ""); await page.evaluate(() => document.activeElement.blur());

  await page.keyboard.press("?");
  check(await page.locator("#help").evaluate(d => d.open), "? opens help");
  await page.keyboard.press("Escape");

  await page.screenshot({ path: new URL(`../tests/screenshot-${name}.png`, import.meta.url).pathname });
  check(errors.length === 0, "no errors" + (errors.length ? `:\n        ${errors.join("\n        ")}` : ""));
  await ctx.close();
}

// a broken saved design shows the recovery card, not a blank page
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.goto(base);
  await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
  await page.evaluate(() => { const st = window.__gw.state(); st.stands.N.tiers = 5; localStorage.setItem("groundworks-v6", JSON.stringify(st)); });
  await page.reload();
  await page.waitForSelector("#fatal:not([hidden])");
  check(true, "\n  a damaged saved design shows the recovery card");
  await page.click("[data-fresh]");
  await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
  check((await page.evaluate(() => window.__gw.last().total)) > 0, "Start with a fresh design recovers");
  await ctx.close();
}

// if the 3D engine doesn't arrive (a page cut off on a patchy connection), say so instead of showing a blank screen
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.route(base, async route => { const parts = readFileSync(new URL("index.html", root), "utf8").split("<script>");
    parts[2] = parts[2].slice(parts[2].indexOf("</script>")); await route.fulfill({contentType:"text/html", body:parts.join("<script>")}); });
  await page.goto(base);
  await page.waitForSelector("#fatal:not([hidden])");
  check(/3D view/.test(await page.locator("#fatal h2").textContent()), "a missing 3D engine shows a 'couldn't load the 3D view' card");
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
