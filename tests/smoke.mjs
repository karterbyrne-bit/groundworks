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

  for (const p of ["bowl", "leitch", "fight"]) {
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
