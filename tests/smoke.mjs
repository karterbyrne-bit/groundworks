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
  await page.click('[data-act="toggleRoof"]'); await page.waitForTimeout(300);
  const bare = (await last()).covered;
  await page.check("#grOn"); await page.waitForTimeout(300);
  for (const shape of ["oval", "circle", "follow"]) { await page.selectOption('select[data-p="gr.shape"]', shape); await page.waitForTimeout(300); }
  const roofed = await last();
  check(bare === 0 && roofed.covered > roofed.total * 0.9, "one roof over the whole ground covers the seats");
  await page.click('#panes [data-pane="start"]');
  await page.click('[data-p="ringroof"]');
  await page.waitForFunction(() => window.__gw.last().parts.some(p => p.label === "West end"));
  const rr = await last();
  check(rr.total > 15000 && rr.covered / rr.total > 0.9 && !rr.issues, 'preset "ringroof" builds under one roof with no warnings');
  await page.click('#panes [data-pane="start"]');

  // Ibrox: a deck on towers over an old stand; per-tier looks and lettering; typed plot sizes
  await page.click('[data-p="ibrox"]');
  await page.waitForFunction(() => window.__gw.last().parts.some(p => p.label === "Main stand") && window.__gw.state().stands.N.tiers.length === 3);
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
  // corners: each tier's reach from each stand
  await page.click('[data-tab="C"]'); await page.selectOption('select[data-corner="NE"][data-cf="mode"]', "blend"); await page.waitForTimeout(300);
  await page.locator('[data-reach^="NE:"]').first().evaluate(el => { el.value = "40"; el.dispatchEvent(new Event("input", {bubbles:true})); }); await page.waitForTimeout(300);
  check((await page.evaluate(() => (window.__gw.state().corners.NE.reach || []).some(r => r && (r.a === 0.4 || r.b === 0.4)))) && (await cap()) > 0, "a corner tier can be set to come part way round");
  await page.click('#panes [data-pane="ground"]'); await page.check("#plotOn"); await page.waitForTimeout(300);
  await page.locator("#plotExact summary").click(); await page.fill("#plotW", "260"); await page.press("#plotW", "Enter"); await page.waitForTimeout(300);
  check((await page.evaluate(() => { const xs = window.__gw.state().plot.pts.map(p => p[0]); return Math.max(...xs) - Math.min(...xs); })) === 260, "the plot can be set to an exact width");
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
  await page.click('label[for="cvs-base"]'); await page.waitForTimeout(400);
  check((await cap()) === footy, "switching back to football restores the ground");
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

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
