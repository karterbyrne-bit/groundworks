/* ================= counting visits and feature use =================
   GoatCounter (no cookies, nothing personal) counts each visit, and each feature the first time it's used in a visit, so
   the owner can see how much play each one gets. Only a feature's name is sent, never what's in a design or anything
   typed. It only runs on the live site (not previews, tests or a copy opened from disk), and if GoatCounter can't be
   reached the app carries on exactly as before. */
const USED = new Set(), unsent = [];
function featureOf(el){
  const c = el && el.closest && el.closest("button, input, select, textarea, summary"); if (!c) return null;
  const d = c.dataset, word = v => /^[a-z][A-Za-z.-]{0,30}$/.test(v) ? v : "", path = v => String(v).replace(/(^|\.)\d+(?=\.|$)/g, "").replace(/^\./, "");
  if (d.p && c.closest("#presets")) return "preset/" + word(d.p);
  if (d.pane && c.closest("#panes")) return "tab/" + word(d.pane);
  if (d.fly) return "flyover/" + word(d.fly);
  if (d.cam) return "view/" + word(d.cam);
  if (d.act) return "stand/" + word(d.act) + (word(d.shape || "") ? "-" + d.shape : "");
  if (d.p && c.closest("#editor, #groundRoof")) return "stand/" + word(path(d.p));
  if (c.id) return "use/" + c.id.replace(/[-_]?\d+$/, "");
  const k = Object.keys(d)[0]; if (k) return (c.closest("#editor") ? "stand/" : "") + k + (word(d[k]) ? "/" + d[k] : "");
  return c.tagName === "SUMMARY" && c.parentElement.dataset.keep ? "section/" + word(c.parentElement.dataset.keep) : null;
}
function sendUses(){ if (!(window.goatcounter && window.goatcounter.count)) return; for (const name of unsent.splice(0)) try { window.goatcounter.count({path:name, title:name, event:true}); } catch(e) {} }
function countUse(name){ if (!name || /\/$/.test(name) || USED.has(name)) return; USED.add(name); unsent.push(name); sendUses(); }
for (const ev of ["click", "change"]) document.addEventListener(ev, e => countUse(featureOf(e.target)), true);
/* Help says whether the counting is running on this device, so a missing count can be told apart from a blocked one. */
const gcSay = t => { const el = document.getElementById("gcStatus"); if (el) el.textContent = "Counting on this device: " + t + "."; };
if (location.protocol === "https:" && !/localhost|-git-|-projects\.vercel\.app$/.test(location.hostname)){
  const s = document.createElement("script"); s.async = true; s.src = "https://gc.zgo.at/count.js"; s.dataset.goatcounter = "https://groundworks.goatcounter.com/count";
  s.onload = () => { sendUses(); gcSay(window.goatcounter && window.goatcounter.count ? "on" : "loaded, but not working"); };
  s.onerror = () => gcSay("blocked (an ad or tracker blocker, or no connection, stopped it loading)");
  gcSay("starting"); document.head.appendChild(s);
} else gcSay("off at this address (it only runs on the live site)");
window.__gw.counted = () => [...USED]; // for the automated checks
