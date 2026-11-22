/* ================= simple and advanced =================
   Two ways to see the controls, switched at the top right. Simple shows what a first-time fan needs (about twenty
   controls: a starting design, the sport, the layout and corners, each stand's style, tiers, rows and roof, the seat
   colours, letters, name, crowd, home end and floodlights, night and the kick-off flyover, and sharing the design or a
   picture of it) and keeps the safety count in view; Advanced shows the lot,
   just as before. New visitors start in Simple, and the choice is remembered. Anything left out of Simple is marked
   "adv" and hidden by the stylesheet, so nothing about how it works changes. */
let simpleMode = true; try { simpleMode = localStorage.getItem("groundworks-mode") !== "advanced"; } catch(e) {}
const ADV_HERE = ["#designs .saverow", "#designs details", "#fieldShapeBox", "#floorRowsRow", "#cornerRow", "#groundMore", "#groundRoofBox",
  "#seatPattern", "#seat2Row", "#spTitleRow", "#spOnStandRow", "#awayOn", "#awayRows", "#stewards", "#waveBtn", "#playersRow",
  '[data-keep="look-architecture"]', '#panes [data-pane="details"]', '#panebody > [data-pane="details"]'];
function markStatic(){
  for (const sel of ADV_HERE) document.querySelectorAll(sel).forEach(el => (el.matches("input, select, button:not(.btn)") && !el.matches("#panes button") ? el.closest(".row, label.toggle") || el : el).classList.add("adv"));
  document.querySelectorAll('details.look[data-pane="look"]').forEach(d => { if (!["look-colours", "look-crowd", "look-night", "look-pitchside"].includes(d.dataset.keep)) d.classList.add("adv"); });
  const pitch = document.querySelector('[data-keep="look-pitchside"] .inner'); if (pitch) [...pitch.children].forEach(el => { if (!el.querySelector("#flood")) el.classList.add("adv"); });
}
/* The stand editor is drawn afresh every time, so it's sorted each time too: a stand's style, its tiers and rows, and its roof's shape, colour and the famous roofs stay. */
function markEditor(){
  const ed = $("editor"); if (!ed) return; const keepAct = ["addTier", "toggleRoof", "mirror", "removeTier", "famousRoof"];
  for (const el of ed.children){ const keep = el.id === "standSummary" || el.matches(".acts-row, .tier, .cornerbox, details.roof") || !!el.querySelector("#sty")
      || (el.matches("p.hint") && el.previousElementSibling && !!el.previousElementSibling.querySelector("#sty")) || el.matches('[data-act="addTier"]');
    el.classList.toggle("adv", !keep); }
  ed.querySelectorAll(".acts-row > button").forEach(b => b.classList.toggle("adv", !keepAct.includes(b.dataset.act)));
  ed.querySelectorAll(".tier > *").forEach(el => el.classList.toggle("adv", !(el.matches(".tier-h") || el.querySelector('input[data-p$=".rows"]'))));
  ed.querySelectorAll("details.roof .inner > *").forEach(el => el.classList.toggle("adv", !(el.matches(".famous") || el.querySelector('[data-p="roof.shape"], [data-p="roof.colour"], [data-p="gr.sheet"]'))));
}
function setMode(simple){
  simpleMode = simple; document.body.classList.toggle("simple", simple);
  $("modeSimple").setAttribute("aria-pressed", String(simple)); $("modeAdvanced").setAttribute("aria-pressed", String(!simple));
  try { localStorage.setItem("groundworks-mode", simple ? "simple" : "advanced"); } catch(e) {}
  if (simple && pane === "details") showPane("results");
  if (typeof sideHints === "function" && LAST) sideHints();
}
$("modeSimple").addEventListener("click", () => setMode(true));
$("modeAdvanced").addEventListener("click", () => setMode(false));
/* Share & save: the link, the picture and saving a copy, behind one button in Simple. */
$("shareSaveBtn").addEventListener("click", () => { const m = $("shareSaveMenu"), open = m.hidden; m.hidden = !open; $("shareSaveBtn").setAttribute("aria-expanded", String(open)); });
$("shareSaveMenu").addEventListener("click", e => { const b = e.target.closest("[data-ss]"); if (!b) return; $("shareSaveMenu").hidden = true; $("shareSaveBtn").setAttribute("aria-expanded", "false");
  if (b.dataset.ss === "link") $("shareBtn").click();
  else if (b.dataset.ss === "image") $("imageBtn").click();
  else { const name = (prompt("Name this design") || "").trim(); if (name){ $("saveName").value = name; $("saveBtn").click(); } } });
/* On a bare side in Simple, an "Add a stand" button floats over it in the 3D view. It picks that side and presses + Tier,
   the stand editor's own button, so the first stand is one tap away. */
const HINT_AT = {N:[0,-1], S:[0,1], E:[1,0], W:[-1,0]}, hintV = new THREE.Vector3();
function sideHints(){
  const box = $("sideHints"), on = simpleMode && S.layout === "stands" && LAST && !look && !fly && camera === persp;
  const empty = on ? SIDES.filter(k => S.stands[k] && !S.stands[k].tiers.length) : [];
  if (box.dataset.k !== empty.join()){ box.dataset.k = empty.join(); box.innerHTML = empty.map(k => `<button class="btn small primary" data-hint="${k}">+ Add a stand</button>`).join(""); }
  if (!empty.length) return; const r = renderer.domElement.getBoundingClientRect(), F = LAST.F, d = LAST.set + 5;
  for (const b of box.children){ const [x, z] = HINT_AT[b.dataset.hint]; hintV.set(x*(F.W/2 + d), 1, z*(F.H/2 + d)).project(camera);
    b.hidden = hintV.z > 1 || Math.abs(hintV.x) > 1 || Math.abs(hintV.y) > 1; b.style.left = (hintV.x + 1)/2*r.width + "px"; b.style.top = (1 - hintV.y)/2*r.height + "px"; }
}
$("sideHints").addEventListener("click", e => { const b = e.target.closest("[data-hint]"); if (!b) return;
  selectTab(b.dataset.hint, true); const add = $("editor").querySelector('[data-act="addTier"]'); if (add) add.click(); });
markStatic(); setMode(simpleMode);
