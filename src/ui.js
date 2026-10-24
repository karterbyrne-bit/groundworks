/* ================= readout ================= */
const esc = s => String(s).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const CATS = {rules:["Rule breaks","Your chosen rule set says no."], view:["Viewing issues","Fans would struggle to see."], geo:["Geometry notes","Odd or ambitious shapes. Build them if you like."]};
const openBd = new Set();
function mergeParts(parts){
  const merged = [];
  for (const p of parts){ const ex = merged.find(q => q.label === p.label);
    if (!ex){ merged.push(Object.assign({}, p, {tiers:(p.tiers || []).map(t => Object.assign({}, t))})); continue; }
    ex.seats += p.seats;
    for (const t of p.tiers || []){ const et = ex.tiers.find(x => x.name === t.name && x.type === t.type);
      if (et){ et.seats += t.seats; et.rows = Math.max(et.rows, t.rows); et.steep = Math.max(et.steep, t.steep); et.evac = Math.max(et.evac, t.evac); if (t.c != null) et.c = et.c == null ? t.c : Math.min(et.c, t.c); }
      else ex.tiers.push(Object.assign({}, t)); } }
  return merged;
}
function tierTable(tiers, total){
  if (!tiers || !tiers.length) return "";
  const L = S.limits;
  return `<table class="tiers"><thead><tr><th>Tier</th><th>Seating</th><th>Rows</th><th>Places</th><th>Share</th><th>Steepest</th><th>Sightline</th><th>Empties</th></tr></thead><tbody>${
    tiers.map(t => `<tr${t.bad ? ' class="bad"' : ""}><td>${esc(t.name)}</td><td>${TYPES[t.type].short}</td><td>${t.rows}</td><td>${fmt(t.seats)}</td><td>${total ? Math.round(100*t.seats/total) : 0}%</td><td>${t.steep ? Math.round(t.steep) + "°" : "flat"}</td><td>${t.c == null ? "–" : `<span class="${t.c < L.minC ? "lo" : ""}">${t.c} mm</span>`}</td><td>${t.evac ? `<span class="${t.evac > L.maxEvac ? "lo" : ""}">${t.evac.toFixed(1)} min</span>` : "–"}</td></tr>`).join("")}</tbody></table>`;
}
document.getElementById("breakdown").addEventListener("toggle", e => { const d = e.target; if (d.dataset && d.dataset.bd){ if (d.open) openBd.add(d.dataset.bd); else openBd.delete(d.dataset.bd); } }, true);
/* Real grounds to compare against, so a number like 41,000 means something. Capacities are rounded. */
const LIKE = [[100000,"the Melbourne Cricket Ground"],[90000,"Wembley"],[82000,"Twickenham"],[74000,"Old Trafford"],[62000,"Tottenham Hotspur Stadium"],
  [52000,"St James' Park"],[42000,"Villa Park"],[29000,"Craven Cottage"],[11000,"the Vitality Stadium"],[3000,"a non-league ground"]];
function likeText(n){
  if (n < 500) return "";
  const best = LIKE.reduce((a, b) => Math.abs(Math.log(b[0]/n)) < Math.abs(Math.log(a[0]/n)) ? b : a);
  const r = n/best[0];
  const how = r > 1.12 ? `${Math.round((r-1)*100)}% bigger than` : r < 0.88 ? `${Math.round((1-r)*100)}% smaller than` : "about the size of";
  return `${how[0].toUpperCase() + how.slice(1)} ${best[1]} (≈${fmt(best[0])}).`;
}
/* Count the capacity up or down to its new value rather than jumping. */
function countTo(el, to){
  const from = el._v == null ? to : el._v; el._v = to;
  cancelAnimationFrame(el._raf);
  if (reduce || from === to){ el.textContent = fmt(to); return; }
  el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  const t0 = performance.now(), dur = Math.min(700, 250 + Math.abs(to - from)/60);
  const step = now => { const k = Math.min(1, (now - t0)/dur), e = 1 - Math.pow(1-k, 3); el.textContent = fmt(Math.round(from + (to - from)*e)); if (k < 1) el._raf = requestAnimationFrame(step); };
  el._raf = requestAnimationFrame(step);
}
let wasHard = null, quiet = true;
function renderStats(){
  const D = LAST, L = S.limits; if (!D) return;
  countTo(document.getElementById("cap"), D.total);
  $("like").textContent = likeText(D.total);
  const mix = Object.entries(D.byType).filter(([,v]) => v > 0).map(([k,v]) => `${fmt(v)} ${TYPES[k].short}`);
  document.getElementById("mix").textContent = mix.length > 1 ? mix.join(" · ") : "";
  const cMM = isFinite(D.minC) ? Math.round(D.minC*1000) : null;
  const pill = (ok, good, bad) => `<span class="pill ${ok ? "good" : "bad"}">${ok ? good : bad}</span>`;
  const roofPct = D.total ? Math.min(100, Math.round(100*D.covered/D.total)) : 0;
  const rPct = D.total ? D.restricted/D.total*100 : 0;
  const items = [
    ["Floor", `${+D.F.W.toFixed(1)} × ${+D.F.H.toFixed(1)} m`, ""],
    ["Tallest point", fmt(D.maxH)+" m", ""],
    ["Footprint", `${fmt(D.bounds[1]-D.bounds[0])} × ${fmt(D.bounds[3]-D.bounds[2])} m`, ""],
    ["Under cover", roofPct+"%", ""],
    ["Worst sightline", cMM===null ? "n/a" : cMM+" mm", cMM===null ? "" : pill(cMM >= L.minC, "ok", "low")],
    ["Furthest fan to " + D.farName, fmt(D.far)+" m", pill(D.far <= L.maxView, "ok", "far")],
    ["Slowest stand to empty", D.slowest ? D.slowest.toFixed(1) + " min" : "n/a", D.slowest ? pill(D.slowest <= L.maxEvac, "ok", "slow") : ""]
  ];
  if (D.restricted) items.push(["Restricted view", `${fmt(D.restricted)} seats`, `<span class="pill ${rPct > 5 ? "bad" : "warn"}">${rPct.toFixed(1)}%</span>`]);
  document.getElementById("metrics").innerHTML = items.map(([k,v,p]) => `<div class="metric"><div class="k">${k}</div><div class="v">${v}${p}</div></div>`).join("");
  const sf = document.getElementById("safety"), std = S.standard === "custom" ? "your own rules" : (S.standard === "minimum" ? "UK guidance minimums" : "UK recommended guidance");
  const fixable = D.issues.filter(i => i.fix).length;
  const counts = Object.keys(CATS).map(c => [c, D.issues.filter(i => i.cat === c).length]);
  const head = `<div class="checks-h"><h3>Checks</h3>${counts.map(([c,n]) => `<span class="pill ${n ? (c === "geo" ? "warn" : "bad") : "good"}">${n} ${CATS[c][0].toLowerCase()}</span>`).join("")}
    ${fixable ? `<button class="fixall" data-fixall="1">Fix ${fixable > 1 ? "all " + fixable : "it"} for me</button>` : ""}</div>
    ${D.issues.some(i => i.alts && i.alts.length) ? `<label class="toggle small"><input type="checkbox" id="keepClose"${S.keepClose !== false ? " checked" : ""}> When fixing views, keep seats close (steeper tiers) rather than moving them back</label>` : ""}`;
  const groups = counts.filter(([,n]) => n).map(([c]) => `<details class="cgroup" ${c !== "geo" ? "open" : ""}><summary>${CATS[c][0]} <small>${CATS[c][1]}</small></summary><ul>${
    D.issues.map((i,n) => i.cat !== c ? "" : `<li><span>${esc(i.text)}</span><span class="acts">
      ${i.fix ? `<button data-fix="${n}">${esc(i.fix.label)}</button>` : ""}${(i.alts || []).map((a,k) => `<button class="alt" data-fix="${n}" data-alt="${k}">${esc(a.label)}</button>`).join("")}
      ${i.tab ? `<button class="ghost" data-show="${n}">Show me</button>` : ""}</span></li>`).join("")}</ul></details>`).join("");
  sf.className = "safety" + (D.issues.some(i => i.cat !== "geo") ? " has" : "");
  sf.innerHTML = head + (D.issues.length ? groups : `<p class="ok">Nothing to report against ${std}.</p>`) +
    `<label class="toggle small"><input type="checkbox" id="trimToggle"${S.trim ? " checked" : ""}> Mark problem tiers in red in the 3D view</label>
     <p class="disclaimer">Groundworks is a creative sandbox. Passing these checks doesn't mean a design is safe, legal or buildable; real stadiums need professional design and approval.</p>`;
  const merged = mergeParts(D.parts);
  const max = Math.max(1, ...merged.map(p => p.seats));
  document.getElementById("breakdown").innerHTML = merged.length ? `<h3 class="bd-h">Capacity by stand and tier</h3>` + merged.map(p =>
    `<details class="bd"${openBd.has(p.label) ? " open" : ""} data-bd="${esc(p.label)}"><summary><span>${esc(p.label)}</span><span>${fmt(p.seats)}</span><small>${esc(p.kinds)}</small><i><b style="width:${(100*p.seats/max).toFixed(1)}%"></b></i></summary>${tierTable(p.tiers, p.seats)}</details>`).join("")
    : '<p class="hint">No stands yet. Give at least one stand a tier to start seating fans.</p>';
  renderSummary(); updateHud();
}
document.getElementById("safety").addEventListener("click", e => {
  const fb = e.target.closest("[data-fix]"), sb = e.target.closest("[data-show]"), fa = e.target.closest("[data-fixall]");
  if (fb){ const is = LAST.issues[+fb.dataset.fix]; runFix(fb.dataset.alt != null ? {fix:is.alts[+fb.dataset.alt]} : is); }
  else if (sb) showIssue(LAST.issues[+sb.dataset.show]);
  else if (fa) fixAll();
});
document.getElementById("safety").addEventListener("change", e => { if (e.target.id === "trimToggle"){ S.trim = e.target.checked; changed(); } if (e.target.id === "keepClose"){ S.keepClose = e.target.checked; changed(); } });
/* Pop-up messages. An optional action (usually Undo) gives a one-tap way back. */
function toast(msg, action, ms){
  const box = $("toasts"), el = document.createElement("div");
  el.className = "toast"; el.innerHTML = `<span>${msg}</span>`;
  if (action){ const b = document.createElement("button"); b.textContent = action.label; b.addEventListener("click", () => { action.run(); close(); }); el.appendChild(b); }
  function close(){ if (!el.isConnected || el.classList.contains("out")) return; el.classList.add("out"); setTimeout(() => el.remove(), reduce ? 0 : 260); }
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(el); setTimeout(close, ms || (action ? 7000 : 4500));
  return el;
}
window.gwToast = msg => toast(msg);
const UNDO = {label:"Undo", run:() => restore(hIdx - 1)};
function flash(msg, action){ toast(msg, action === undefined && /Undo/.test(msg) ? UNDO : action); }
function runFix(is){
  if (!is || !is.fix) return;
  const label = is.fix.label, ok = is.fix.run();
  renderTypeSizes(); renderEditor(); changed();
  flash(ok ? `<b>Fixed:</b> ${esc(label.charAt(0).toLowerCase() + label.slice(1))}.` : `<b>That one needs a bigger change</b> than I can make safely. Use Show me to go to its settings.`, ok ? UNDO : null);
}
function fixAll(){
  const rk0 = {seatRake:S.limits.seatRake, terraceRake:S.limits.terraceRake};
  const done = new Set(); let fixed = 0, tries = 0;
  while (tries++ < 24){
    const list = dryIssues().filter(i => i.fix && !done.has(i.key + "|" + i.fix.label));
    if (!list.length) break;
    const is = list[0]; done.add(is.key + "|" + is.fix.label);
    if ([is.fix].concat(is.alts || []).filter(f => !(f.moves && S.keepClose !== false)).some(f => f.run())) fixed++;
  }
  renderTypeSizes(); renderEditor(); changed();
  const left = dryIssues().filter(i => i.cat !== "geo").length;
  const ruled = S.standard === "custom" && (S.limits.seatRake > rk0.seatRake || S.limits.terraceRake > rk0.terraceRake);
  flash(`<b>Fixed ${fixed} ${fixed === 1 ? "thing" : "things"}.</b>` + (ruled ? ` Your rules now allow ${[S.limits.seatRake > rk0.seatRake ? S.limits.seatRake + "° seating" : "", S.limits.terraceRake > rk0.terraceRake ? S.limits.terraceRake + "° terraces" : ""].filter(Boolean).join(" and ")}.` : "") + (left ? ` ${left} still ${left === 1 ? "needs" : "need"} a decision from you.` : ""), fixed ? UNDO : null);
}
/* ================= panes: one section of controls at a time, so the 3D view stays in sight ================= */
let pane = "start";
try { pane = localStorage.getItem("groundworks-pane") || "start"; } catch(e) {}
function showPane(name, keepScroll){
  if (!document.querySelector(`#panes [data-pane="${name}"]`)) name = "start";
  pane = name;
  document.querySelectorAll("#panes [data-pane]").forEach(b => { b.setAttribute("aria-selected", String(b.dataset.pane === name)); b.tabIndex = b.dataset.pane === name ? 0 : -1; });
  document.querySelectorAll("#panebody > [data-pane]").forEach(el => el.classList.toggle("on", el.dataset.pane === name));
  if (!keepScroll) $("panebody").scrollTop = 0;
  try { localStorage.setItem("groundworks-pane", name); } catch(e) {}
}
document.getElementById("panes").addEventListener("click", e => { const b = e.target.closest("[data-pane]"); if (b) showPane(b.dataset.pane); });
document.getElementById("panes").addEventListener("keydown", e => {
  const tabs = [...document.querySelectorAll("#panes [data-pane]")], i = tabs.indexOf(document.activeElement); if (i < 0) return;
  const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
  if (j < 0) return; e.preventDefault(); tabs[j].focus(); showPane(tabs[j].dataset.pane);
});
document.getElementById("hud").addEventListener("click", () => showPane("results"));
function updateHud(){
  if (!LAST) return;
  countTo($("hudCap"), LAST.total);
  const hard = LAST.issues.filter(i => i.cat !== "geo").length, geo = LAST.issues.length - hard;
  if (wasHard && !hard && !quiet) toast("✅ <b>Every check passes.</b> Fans can see the play and get out in time.");
  wasHard = hard; quiet = false;
  $("hudChecks").innerHTML = hard ? `places · <span class="pill bad">${hard} to fix</span>` : `places · <span class="pill good">checks ok</span>`;
  const bd = $("paneBadge"); bd.hidden = !(hard || geo); bd.textContent = hard || geo; bd.classList.toggle("geo", !hard);
}
function showIssue(is){
  if (!is || !is.tab) return;
  selectTab(is.tab, true);
  requestAnimationFrame(() => {
    const el = is.k !== undefined ? document.querySelector(`#editor .tier[data-k="${is.k}"]`) : document.getElementById("editor");
    if (!el) return;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    el.scrollIntoView({block:"nearest", behavior: reduce ? "auto" : "smooth"});
  });
}

/* ================= camera ================= */
let camMode = "aerial", anim = null, look = false, picking = false, wire = false, screenFocus = 0;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tipEl = document.getElementById("tip");
let tipOverride = null;
function setTip(){
  tipEl.innerHTML = tipOverride || (picking ? "<b>Click any seat</b> to see the view from it"
    : look ? "Drag to look around · Aerial to fly back out"
    : "Tap a stand to edit it · drag the blue handles to reshape it · drag to orbit, scroll or pinch to zoom" + (S.plot.on ? " · drag the red posts to reshape the plot" : ""));
  tipEl.classList.toggle("msg", !!(tipOverride || picking || look));
}
function setLook(on){
  look = on;
  controls.enableZoom = !on; controls.enablePan = !on;
  controls.rotateSpeed = on ? -0.35 : 1;
  controls.maxPolarAngle = on ? Math.PI*0.8 : Math.PI*0.49;
}
function applyLimits(){
  if (look){ controls.minDistance = 0.5; controls.maxDistance = 0.5; }
  else { const R0 = Math.max(LAST.ext[0], LAST.ext[1]); controls.minDistance = 1; controls.maxDistance = R0*7; }
}
function regionFor(key){ return LAST_REGIONS.find(r => r.key === key && r.profs.some(p => p.length)) || LAST_REGIONS.find(r => r.profs.some(p => p.length)); }
function camTarget(mode){
  const D = LAST, R0 = Math.max(D.ext[0], D.ext[1]);
  if (mode === "plan") return {p:new THREE.Vector3(0, R0*2.7, 0.1), t:new THREE.Vector3(0,0,0)};
  if (mode === "side") return {p:new THREE.Vector3(R0*2.6, Math.max(12, D.maxH*0.45), 0), t:new THREE.Vector3(0, Math.max(10, D.maxH*0.4), 0)};
  if (mode === "pitch"){
    const p = new THREE.Vector3(-D.F.W*0.12, 1.7 + focusY, D.F.H/2 + Math.min(D.set*0.5, 4));
    const aim = new THREE.Vector3(D.F.W*0.08, 2 + focusY + R0*0.05, -D.F.H/2);
    return {p, t:p.clone().add(aim.sub(p).normalize().multiplyScalar(0.5))};
  }
  if (mode === "screen"){
    const sp = D.screenSpots && D.screenSpots[screenFocus]; if (!sp) return camTarget("aerial");
    // orbit round the screen from out over the play, so dragging and zooming still work normally
    const t = new THREE.Vector3(...sp), flat = Math.hypot(sp[0], sp[2]);
    const p = flat < 5 ? new THREE.Vector3(D.F.W*0.3, Math.max(4, sp[1]*0.45), D.F.H*0.3) // hanging over the centre: look up at it from the play
      : new THREE.Vector3(-sp[0]*0.3, Math.max(5, sp[1]*0.55), -sp[2]*0.3);
    return {p, t};
  }
  if (mode === "exterior" || mode === "under"){
    const r = regionFor(tab === "B" || tab === "C" || tab === "F" ? "N" : tab); if (!r) return camTarget("aerial");
    const i = Math.floor(r.o.length/2), live = r.profs[i].length ? r.profs[i] : r.profs.find(p => p.length) || [];
    if (!live.length) return camTarget("aerial");
    const back = Math.max(...live.map(p => p.front + nRows(p)*p.T)), top = Math.max(...live.map(p => p.hs[nRows(p)-1]));
    const vl = Math.hypot(r.v[i][0], r.v[i][1]) || 1, u = [r.v[i][0]/vl, r.v[i][1]/vl];
    if (mode === "exterior"){
      const b = [r.o[i][0] + r.v[i][0]*back, r.o[i][1] + r.v[i][1]*back];
      return {p:new THREE.Vector3(b[0] + u[0]*(top*1.6 + 40), 3 + top*0.15, b[1] + u[1]*(top*1.6 + 40)), t:new THREE.Vector3(b[0], top*0.55, b[1])};
    }
    const p0 = live[live.length-1], n = nRows(p0), d = p0.front + (n - 1.5)*p0.T, q = [r.o[i][0] + r.v[i][0]*d, r.o[i][1] + r.v[i][1]*d];
    const p = new THREE.Vector3(q[0], p0.hs[n-2 >= 0 ? n-2 : 0] + 1.2, q[1]);
    const dir = new THREE.Vector3(-u[0], 0.55, -u[1]).normalize().multiplyScalar(0.5);
    return {p, t:p.clone().add(dir), look:true};
  }
  return {p:new THREE.Vector3(R0*1.3, R0*0.95, R0*1.5), t:new THREE.Vector3(0, Math.min(6, R0*0.05), 0)};
}
function moveCam(p, t, instant){
  controls.minDistance = 0; controls.maxDistance = Infinity;
  if (instant || reduce){ camera.position.copy(p); controls.target.copy(t); applyLimits(); controls.update(); return; }
  anim = {p0:camera.position.clone(), t0:controls.target.clone(), p, t, start:performance.now()};
}
function goCam(mode, instant){
  picking = mode === "seat"; tipOverride = null;
  view.classList.toggle("picking", picking);
  camMode = mode;
  document.querySelectorAll("[data-cam]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cam===mode)));
  if (mode === "seat"){ setLook(false); const {p,t:tt} = camTarget("aerial"); moveCam(p, tt, instant); setTip(); return; }
  const tg = camTarget(mode);
  setLook(mode === "pitch" || !!tg.look);
  moveCam(tg.p, tg.t, instant); setTip();
}
document.querySelectorAll("[data-cam]").forEach(b => b.addEventListener("click", () => { goCam(b.dataset.cam); closeMore(); }));
const spinBtn = document.getElementById("spin");
spinBtn.addEventListener("click", () => { controls.autoRotate = !controls.autoRotate; spinBtn.setAttribute("aria-pressed", String(controls.autoRotate)); });
/* orthographic / perspective */
function setOrtho(on){
  const from = camera, to = on ? ortho : persp; if (from === to) return;
  to.position.copy(from.position); to.up.copy(from.up);
  if (on){ const dist = from.position.distanceTo(controls.target), h = dist*Math.tan(persp.fov*Math.PI/360), a = view.clientWidth/Math.max(1, view.clientHeight);
    ortho.left = -h*a; ortho.right = h*a; ortho.top = h; ortho.bottom = -h; ortho.zoom = 1; ortho.updateProjectionMatrix(); }
  camera = to; controls.object = to; controls.update(); invalidate();
  document.getElementById("orthoBtn").setAttribute("aria-pressed", String(on));
}
document.getElementById("orthoBtn").addEventListener("click", () => setOrtho(camera !== ortho));
function applyWire(){ const seen = new Set(); group.traverse(o => { if (o.material && !seen.has(o.material)){ seen.add(o.material); o.material.wireframe = wire; } }); invalidate(); }
document.getElementById("wireBtn").addEventListener("click", () => { wire = !wire; applyWire(); document.getElementById("wireBtn").setAttribute("aria-pressed", String(wire)); });
document.getElementById("presentBtn").addEventListener("click", () => { document.body.classList.add("present"); closeMore(); setTimeout(resize, 30); });
document.getElementById("exitPresent").addEventListener("click", () => { document.body.classList.remove("present"); setTimeout(resize, 30); });
const moreBtn = document.getElementById("moreBtn"), moreBox = document.getElementById("moreViews");
function closeMore(){ moreBox.hidden = true; moreBtn.setAttribute("aria-expanded", "false"); }
moreBtn.addEventListener("click", () => { moreBox.hidden = !moreBox.hidden; moreBtn.setAttribute("aria-expanded", String(!moreBox.hidden)); });
/* camera bookmarks */
function renderViews(){
  const el = document.getElementById("bookmarks");
  el.innerHTML = (S.views || []).map((v,i) => `<span class="chip"><button data-view="${i}">${esc(v.name)}</button><button class="x" data-delview="${i}" aria-label="Delete ${esc(v.name)}">×</button></span>`).join("");
  el.hidden = !(S.views || []).length;
}
document.getElementById("saveView").addEventListener("click", () => {
  S.views = S.views || []; const n = S.views.length + 1;
  S.views.push({name:"View " + n, p:camera.position.toArray(), t:controls.target.toArray(), look}); save(); renderViews(); closeMore(); flash(`<b>Saved as View ${n}.</b> Find it under the camera buttons.`);
});
document.getElementById("bookmarks").addEventListener("click", e => {
  const b = e.target.closest("[data-view]"), d = e.target.closest("[data-delview]");
  if (b){ const v = S.views[+b.dataset.view]; setLook(!!v.look); picking = false; moveCam(new THREE.Vector3(...v.p), new THREE.Vector3(...v.t)); }
  if (d){ S.views.splice(+d.dataset.delview, 1); save(); renderViews(); }
});

/* pointer: seat picking, tapping a stand, dragging handles and the plot */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0), hitPt = new THREE.Vector3();
let downAt = null, drag = null;
function setNdc(e){ const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1); ray.setFromCamera(ndc, camera); }
function groundAt(e){ setNdc(e); return ray.ray.intersectPlane(groundPlane, hitPt) ? hitPt.clone() : null; }
function plotHandleNear(p){
  const D = LAST; if (!S.plot.on || !D || !D.poly || look || picking || !p) return null;
  const tol = Math.max(3, Math.max(D.ext[0], D.ext[1]) * 0.05), pts = S.plot.pts;
  for (let i=0;i<pts.length;i++) if (Math.hypot(p.x-pts[i][0], p.z-pts[i][1]) < tol) return {type:"v", i};
  for (let i=0;i<pts.length;i++){ const a = pts[i], b = pts[(i+1)%pts.length];
    if (Math.hypot(p.x-(a[0]+b[0])/2, p.z-(a[1]+b[1])/2) < tol) return {type:"e", i}; }
  return null;
}
function handleHit(e){ if (look || picking) return null; setNdc(e); const hs = group.children.filter(m => m.userData.handle); const h = ray.intersectObjects(hs, false); return h.length ? h[0].object.userData.handle : null; }
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
const r05 = x => Math.round(x*2)/2;
renderer.domElement.addEventListener("pointerdown", e => {
  downAt = [e.clientX, e.clientY]; if (e.button !== 0) return;
  const h = handleHit(e);
  if (h){ const vl = Math.hypot(h.v[0], h.v[1]) || 1, n = new THREE.Vector3(-h.v[1]/vl, 0, h.v[0]/vl);
    drag = {type:"h", h, plane:new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(h.x, h.y, h.z))};
    controls.enabled = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch(err) {} return; }
  const p = groundAt(e), ph = plotHandleNear(p);
  if (ph){ drag = Object.assign(ph, {start:[p.x, p.z], pts:clone(S.plot.pts)}); controls.enabled = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch(err) {} }
});
renderer.domElement.addEventListener("pointermove", e => {
  if (drag && drag.type === "h"){
    setNdc(e); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(drag.plane, p)) return;
    const h = drag.h, vv = h.v[0]*h.v[0] + h.v[1]*h.v[1] || 1, d = ((p.x - h.o[0])*h.v[0] + (p.z - h.o[1])*h.v[1])/vv;
    if (h.kind === "depth"){ const rows = clamp(Math.round((d - h.front)/h.T), h.side ? 1 : 2, 90);
      if (h.side) h.ref.sideRows = Object.assign({}, h.ref.sideRows, {[h.side]:rows}); else h.ref.rows = rows; }
    if (h.kind === "over"){ h.ref.over = clamp(r05(h.lowerBack - d), -15, 40); h.ref.gap = clamp(r05(p.y - h.lowerBackH), 1.5, 40); }
    if (h.kind === "roof"){ h.cfg.roof.reach = clamp(r05(h.front - d), -40, 40); h.cfg.roof.lift = clamp(r05(p.y - h.top), 1.5, 40); }
    if (h.kind === "dist") h.cfg.dist = clamp(r05(d), 1, 80);
    changed(false, true); return;
  }
  if (drag){
    const p = groundAt(e); if (!p) return;
    const dx = p.x - drag.start[0], dz = p.z - drag.start[1], pts = clone(drag.pts);
    if (drag.type === "v"){ pts[drag.i] = [Math.round(drag.pts[drag.i][0] + dx), Math.round(drag.pts[drag.i][1] + dz)]; }
    else { const a = pts[drag.i], b = pts[(drag.i+1)%pts.length], l = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, n = [-(b[1]-a[1])/l, (b[0]-a[0])/l], s = dx*n[0] + dz*n[1];
      for (const q of [a, b]){ q[0] = Math.round(q[0] + n[0]*s); q[1] = Math.round(q[1] + n[1]*s); } }
    S.plot.pts = pts; changed(); return;
  }
  if (e.buttons) return;
  view.style.cursor = handleHit(e) || plotHandleNear(groundAt(e)) ? "grab" : "";
});
renderer.domElement.addEventListener("pointerup", e => {
  if (drag){ const wasH = drag.type === "h"; drag = null; controls.enabled = true; if (wasH){ renderEditor(); } return; }
  if (!downAt || Math.hypot(e.clientX-downAt[0], e.clientY-downAt[1]) > 6) return;
  setNdc(e);
  if (picking){
    const hits = ray.intersectObjects(group.children.filter(m => m.userData.seat), false);
    if (!hits.length){ tipEl.innerHTML = "<b>That's not a seat.</b> Click on the coloured seating."; return; }
    const h = hits[0].point, f = LAST.F.home || [0,0];
    const p = new THREE.Vector3(h.x, h.y + 1.2, h.z);
    const aim = new THREE.Vector3(f[0], focusY + 1, f[1]).sub(p).normalize().multiplyScalar(0.5);
    picking = false; view.classList.remove("picking"); setLook(true); moveCam(p, p.clone().add(aim)); setTip();
    return;
  }
  if (look) return;
  const hits = ray.intersectObjects(group.children.filter(m => m.userData.stadium), false); if (!hits.length) return;
  const key = standAt(hits[0].point); if (key) selectTab(key, true);
});
/* Which stand is under a point: the region whose seating slice lies nearest. */
function standAt(p){
  const D = LAST; if (!D) return null;
  if (D.lay === "bowl") return "B";
  const F = D.F; if (Math.abs(p.x) < F.W/2 && Math.abs(p.z) < F.H/2) return null;
  let best = null, bestD = Infinity;
  for (const r of LAST_REGIONS){
    for (let i=0;i<r.o.length;i++){
      const live = r.profs[i].filter(x => nRows(x) >= 1); if (!live.length) continue;
      for (const pr of live) for (const d of [pr.front, (pr.front + pr.front + nRows(pr)*pr.T)/2, pr.front + nRows(pr)*pr.T]){
        const q = [r.o[i][0] + d*r.v[i][0], r.o[i][1] + d*r.v[i][1]], h = heightAt([pr], Math.min(d, pr.front + nRows(pr)*pr.T - .01));
        const dd = Math.hypot(q[0]-p.x, q[1]-p.z) + Math.abs(h - p.y)*0.5;
        if (dd < bestD){ bestD = dd; best = r.key; }
      }
    }
  }
  return bestD < 40 ? best : null;
}
function selectTab(key, fromView){
  if (key === "F") return;
  tab = key; renderEditor(); changed(false, true);
  if (fromView){
    const name = key === "B" ? (isHybrid() ? "the lower bowl" : "the bowl") : key === "C" ? "the corners" : "the " + SIDE_NAMES[key].toLowerCase();
    tipOverride = `<b>Editing ${name}.</b> Drag the blue handles, or use the panel.`; setTip();
    showPane("stands");
    clearTimeout(selectTab.t); selectTab.t = setTimeout(() => { tipOverride = null; setTip(); }, 4500);
  }
}
/* Keep the orbiting camera out of solid structure but let it go anywhere above the seats, including under roofs. */
function constrain(){
  const D = LAST; if (!D || look || anim) return;
  const fx = D.F.W/2 + D.set, fz = D.F.H/2 + D.set, tg = controls.target, c = camera.position;
  tg.x = clamp(tg.x, -fx*1.5, fx*1.5); tg.z = clamp(tg.z, -fz*1.5, fz*1.5); tg.y = clamp(tg.y, 0, Math.max(30, D.maxH));
  let minY = 1.2 + focusY;
  for (const r of LAST_REGIONS){
    let bi = -1, bl = Infinity, bd = 0;
    for (let i=0;i<r.o.length;i+=1){ const vv = r.v[i][0]*r.v[i][0] + r.v[i][1]*r.v[i][1] || 1, d = ((c.x - r.o[i][0])*r.v[i][0] + (c.z - r.o[i][1])*r.v[i][1])/vv;
      const lat = Math.hypot(c.x - (r.o[i][0] + d*r.v[i][0]), c.z - (r.o[i][1] + d*r.v[i][1])); if (lat < bl){ bl = lat; bi = i; bd = d; } }
    if (bi < 0 || bl > 5) continue;
    const live = r.profs[bi]; for (const p of live){ const n = nRows(p); if (n < 1) continue;
      if (bd >= p.front - .5 && bd <= p.front + n*p.T + 1){ const h = p.hs[clamp(Math.floor((bd - p.front)/p.T), 0, n-1)] + 1.4; if (c.y < h + 1.5 && c.y > h - 6) minY = Math.max(minY, h); } }
  }
  if (c.y < minY) c.y = minY;
}
function resize(){ const w = view.clientWidth, h = view.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); persp.aspect = w/h; persp.updateProjectionMatrix(); invalidate();
  if (camera === ortho){ const hh = (ortho.top - ortho.bottom)/2; ortho.left = -hh*w/h; ortho.right = hh*w/h; ortho.updateProjectionMatrix(); } }
new ResizeObserver(resize).observe(view);
function loop(now){
  if (anim){ const k = Math.min(1, (now - anim.start)/850), e = 1 - Math.pow(1-k, 3);
    camera.position.lerpVectors(anim.p0, anim.p, e); controls.target.lerpVectors(anim.t0, anim.t, e);
    if (k===1){ anim = null; applyLimits(); } }
  const moved = controls.update(); constrain();
  if (moved || anim || dirty > 0){ renderer.render(scene, camera); if (dirty > 0) dirty--; }
  requestAnimationFrame(loop);
}
function applyTheme(fromMood){
  if (S && S.night && fromMood !== true){ applyMood(); return; }
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color(cs.getPropertyValue("--scene").trim() || "#dde5de");
  groundMat.color.set(cs.getPropertyValue("--ground").trim() || "#c3cbc0");
  plazaMat.color.set(cs.getPropertyValue("--plaza").trim() || "#d4d8d1");
  invalidate();
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, {attributes:true, attributeFilter:["data-theme"]});

/* ================= undo / redo ================= */
const hist = [], HMAX = 120; let hIdx = -1, hLast = 0, restoring = false;
function record(coalesce){
  if (restoring) return;
  const s = JSON.stringify(S); if (hist[hIdx] === s) return;
  const now = performance.now();
  if (coalesce && hIdx === hist.length - 1 && hIdx > 0 && now - hLast < 700) hist[hIdx] = s;
  else { hist.splice(hIdx + 1); hist.push(s); if (hist.length > HMAX) hist.shift(); hIdx = hist.length - 1; }
  hLast = now; syncHistBtns();
}
function restore(i){
  if (i < 0 || i >= hist.length) return;
  hIdx = i; restoring = true; quiet = true; S = JSON.parse(hist[i]); setSeatColours(); renderTypeSizes(); renderEditor(); renderViews(); changed(false, true); restoring = false; syncHistBtns();
}
function syncHistBtns(){ document.getElementById("undoBtn").disabled = hIdx <= 0; document.getElementById("redoBtn").disabled = hIdx >= hist.length - 1; }
document.getElementById("undoBtn").addEventListener("click", () => restore(hIdx - 1));
document.getElementById("redoBtn").addEventListener("click", () => restore(hIdx + 1));
document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.target.matches("input[type=text], input[type=number], textarea")) return;
  if (e.key.toLowerCase() === "z"){ e.preventDefault(); restore(e.shiftKey ? hIdx + 1 : hIdx - 1); }
  if (e.key.toLowerCase() === "y"){ e.preventDefault(); restore(hIdx + 1); }
});
function save(coalesce){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) {} record(coalesce); }

/* ================= stand editor ================= */
const $ = id => document.getElementById(id);
const cfgForTab = () => isBowl() || (isHybrid() && tab === "B") ? S.bowl : (tab === "C" ? null : S.stands[tab]);
const tiersEditable = () => (!isBowl() && tab === "C") ? S.cornerCustom : cfgForTab().tiers;
const cornerModes = () => isHybrid()
  ? [["open","Open (lower bowl only)"],["split","Stands meet halfway"],["blend","Filled, blending the stands"],["custom","Filled, its own tiers"]]
  : [["open","Open"],["blend","Filled, blending the stands"],["custom","Filled, its own tiers"]];
let clipboard = null;
function fixTab(){
  if (isBowl()) tab = "B";
  else if (tab === "B" && !isHybrid()) tab = "N";
  if (!isHybrid()) for (const c of CORNERS) if (S.corners[c.key].mode === "split") S.corners[c.key].mode = "blend";
}
function renderTabs(){
  const el = $("tabs");
  if (isBowl()){ el.hidden = true; return; }
  el.hidden = false;
  const items = [];
  if (isHybrid()) items.push(["B","Lower bowl", S.bowl.tiers.length + "T"]);
  SIDES.forEach(s => items.push([s, SIDE_NAMES[s], S.stands[s].tiers.length ? S.stands[s].tiers.length + "T" : "none"]));
  items.push(["C","Corners", CORNERS.filter(c => S.corners[c.key].mode !== "open").length + "/4"]);
  el.innerHTML = items.map(([k,label,n]) => `<button role="tab" aria-selected="${tab===k}" data-tab="${k}">${label}<span class="n">${n}</span></button>`).join("");
}
/* A slider paired with an exact number box, both bound to the same setting path. */
const pair = (label, p, val, min, max, step, unit, note) => `<div class="row pair"><label for="pp-${p.replace(/\./g,"-")}">${label}</label>
  <span class="num"><input type="number" data-p="${p}" value="${+(+val).toFixed(2)}" min="${min}" max="${max}" step="${step}" aria-label="${label}"> ${unit}</span>
  <input type="range" id="pp-${p.replace(/\./g,"-")}" data-p="${p}" min="${min}" max="${max}" step="${step}" value="${val}">${note ? `<small class="note">${note}</small>` : ""}</div>`;
const check = (label, p, val) => `<label class="toggle"><input type="checkbox" data-p="${p}"${val ? " checked" : ""}> ${label}</label>`;
const pick = (label, p, val, opts) => `<div class="row"><label>${label}</label><select data-p="${p}" aria-label="${label}">${Object.entries(opts).map(([k,v]) => `<option value="${k}"${k===val?" selected":""}>${v}</option>`).join("")}</select></div>`;
const SIDE_SHORT = {N:"Main", S:"Opposite", E:"East", W:"West"};
/* Rows for each side of a bowl, side by side, instead of one number for the whole way round. */
const TYPE_SHORT = {seated:"Seats", exec:"Boxes", rail:"Rail seats", bench:"Benches", terrace:"Terrace"};
const sideRowsBox = (tr, pre) => `<div class="row"><label>Seating and rows on each side</label></div><div class="siderows">${SIDES.map(s => { const gone = bowlGone(s), ty = sideTypeOf(tr, s);
  return `<label><span>${SIDE_SHORT[s]}</span><select data-p="${pre}sideType.${s}"${gone ? " disabled" : ""} aria-label="Seating on the ${SIDE_NAMES[s].toLowerCase()}">${Object.entries(TYPE_SHORT).map(([k,v]) => `<option value="${k}"${k === ty ? " selected" : ""}>${v}</option>`).join("")}</select>
    <input type="number" data-p="${pre}sideRows.${s}" value="${gone ? 0 : Math.round(sideRowsOf(tr, s))}" min="0" max="120" step="1"${gone ? " disabled" : ""} aria-label="${ty === "terrace" ? "Steps" : "Rows"} on the ${SIDE_NAMES[s].toLowerCase()}"></label>`; }).join("")}</div>`;
const TIER_FRONTS = {auto:"Stand's own style", plain:"Plain fascia", lattice:"Criss-cross lattice (Leitch)", glass:"Glass balustrade", concrete:"Concrete parapet", brick:"Brick parapet"};
const TIER_HOLDS = {none:"Nothing visible (cantilever)", pillars:"Pillars under its front edge", towers:"Towers at each end with a truss"};
const colourPick = (label, p, val, def) => `<div class="row colour"><label>${label}</label><span class="num"><input type="color" data-p="${p}" value="${val || def || "#888888"}" aria-label="${label}">
  ${val ? `<button class="mini" data-act="clearColour" data-cp="${p}">Default</button>` : `<small>default</small>`}</span></div>`;
/* The tier's own look, its length and what holds it up. */
const openMore = new Set();
const tierMore = (tr, pre, stacked, ends) => `<details class="sub" data-more="${tab}:${pre}"${openMore.has(tab + ":" + pre) ? " open" : ""}><summary>Look${ends ? ", length" : ""}${stacked ? " and support" : ""}</summary><div class="inner">
  ${pick("Front", pre + "front", tr.front || "auto", TIER_FRONTS)}
  ${colourPick("Front colour", pre + "frontColour", tr.frontColour)}
  ${tr.type === "seated" || tr.type === "rail" ? colourPick("Seat colour", pre + "seatColour", tr.seatColour) : ""}
  ${ends ? pair("Stops short of the left end", pre + "trim0", tr.trim0 || 0, 0, 80, 1, "m", "Left and right as seen from the play.") + pair("Stops short of the right end", pre + "trim1", tr.trim1 || 0, 0, 80, 1, "m") : ""}
  ${stacked ? pick("Held up by", pre + "support", tr.hold === "towers" ? "towers" : tr.pillars ? "pillars" : "none", TIER_HOLDS) : ""}
</div></details>`;
function tierBlocks(arr, above, base, bySide, ends){
  return arr.map((tr,k) => {
    const isT = tr.type === "terrace", nm = tierName(k, arr.length, above), stacked = k > 0 || above;
    const pre = (base ? base + "." : "") + "tiers." + k + ".";
    const depth = tr.rows * S.types[tr.type].row;
    return `<div class="tier" data-k="${k}"><div class="tier-h"><span>${nm ? nm + " tier" : "Tier"}</span><button class="mini" data-act="removeTier" data-k="${k}" aria-label="Remove this tier">Remove</button></div>
      ${bySide ? "" : `<div class="row"><label>Type</label><select data-p="${pre}type" aria-label="Seating type">${Object.entries(TYPES).map(([v,o]) => `<option value="${v}"${v===tr.type?" selected":""}>${o.label}</option>`).join("")}</select></div>`}
      ${bySide ? sideRowsBox(tr, pre) : pair(isT ? "Steps" : "Rows", pre + "rows", tr.rows, 1, 90, 1, "", `${depth.toFixed(1)} m deep`)}
      <div class="row"><label class="toggle"><input type="checkbox" data-p="${pre}auto"${tr.auto ? " checked" : ""}> Auto steepness</label><output id="o-rk-${k}"></output>
        ${tr.auto ? "" : `<input type="range" data-p="${pre}rake" min="8" max="45" step="1" value="${tr.rake}" aria-label="Steepness in degrees">`}</div>
      ${stacked ? `${pair("Projects forward over the tier below", pre + "over", tr.over || 0, -15, 40, 0.5, "m", "Negative sets it back instead.")}
      ${pair("Height above the tier below", pre + "gap", tr.gap == null ? 3 : tr.gap, 1.5, 40, 0.5, "m")}
` : ""}
      ${tierMore(tr, pre, stacked, ends)}
    </div>`;
  }).join("");
}
const groundRoofOn = () => !!(S.groundRoof && S.groundRoof.on);
function roofBlock(cfg, bowl){
  if (groundRoofOn()) return `<details class="sub" open><summary>Roof</summary><div class="inner"><p class="hint">One roof covers the whole ground, so this stand's own roof is set aside.
    Change it under <b>One roof over the whole ground</b> below, or switch that off to give each stand its own roof again.</p></div></details>`;
  const rf = cfg.roof, shapes = Object.assign({}, ROOF_SHAPES); if (!bowl) delete shapes.closed;
  const on = rf.shape !== "none";
  return `<details class="sub" open><summary>Roof</summary><div class="inner">
    ${pick("Shape", "roof.shape", rf.shape, shapes)}
    ${on ? `${pick("Material", "roof.mat", rf.mat, ROOF_MATS)}${pick("Structure", "roof.support", rf.support, ROOF_SUPPORTS)}
    ${pair("Reaches past the front row", "roof.reach", rf.reach, -40, 40, 0.5, "m", "Negative leaves the front rows open.")}
    ${check("Level roofline (one straight height along the stand)", "roof.level", rf.level !== false)}
    ${check("Line up every roof in the ground at the same height", "roofAlign", !!S.roofAlign)}
    ${pair(rf.level !== false ? "Height above the tallest row" : "Height above the top row", "roof.lift", rf.lift, 1.5, 40, 0.5, "m")}
    ${rf.shape !== "gable" ? pair("Tilt up towards the play", "roof.tilt", rf.tilt, -15, 25, 1, "°") + pair("Curve", "roof.curve", Math.round((rf.curve||0)*100), 0, 100, 5, "%") : ""}
    ${rf.shape === "closed" ? pair("Opening in the middle", "roof.opening", Math.round((rf.opening||0)*100), 0, 90, 5, "%") : ""}` : ""}
  </div></details>`;
}
/* A little plan of the bowl: tap a side or corner to leave it out. The main stand is at the top, as in Plan view. */
const BOWL_SHAPES = {full:["Full bowl", []], horseshoe:["Horseshoe", ["W","NW","SW"]], sides:["Two sides", ["E","W","NE","SE","SW","NW"]], ell:["L-shape", ["S","W","SE","SW","NW"]]};
function bowlShapeBlock(){
  const cn = {}; for (const c of CORNERS) cn[c.key] = c.name;
  const cell = k => { const on = !bowlGone(k), name = SIDE_NAMES[k] || cn[k];
    return `<button class="bp${k.length === 2 ? " corner" : ""}" data-piece="${k}" aria-pressed="${on}" aria-label="${name}: ${on ? "built" : "left out"}" title="${name}: ${on ? "tap to leave it out" : "tap to build it"}">${SIDE_SHORT[k] || ""}</button>`; };
  return `<details class="sub" open><summary>Shape of the bowl</summary><div class="inner">
    <p class="hint">Tap a side or a corner to leave it out, for a horseshoe or a bowl that stops short. The main stand is at the top, as in Plan view.</p>
    <div class="bowlplan">${cell("NW")}${cell("N")}${cell("NE")}${cell("W")}<span class="bp-floor">${field().custom ? "Floor" : "Pitch"}</span>${cell("E")}${cell("SW")}${cell("S")}${cell("SE")}</div>
    <div class="scales"><span>Quick shape:</span>${Object.entries(BOWL_SHAPES).map(([k,[label]]) => `<button class="btn small" data-act="bowlShape" data-shape="${k}">${label}</button>`).join("")}</div>
    ${check("Give each side its own seating and rows", "bowlVary", !!S.bowl.varyRows)}
    ${S.bowl.varyRows ? `<p class="hint">Each side can have its own seating (a seated main stand with terraces round the rest, say) and depth; the corners blend from one side to the next. Set a tier to 0 rows on a side to leave it off there.</p>` : ""}
  </div></details>`;
}
/* Corner controls: how far round each tier comes from each stand, and where stands that meet halfway meet. */
const pct = v => Math.round(v*100) + "%";
const meetText = c => { const v = S.corners[c.key].meet == null ? .5 : S.corners[c.key].meet; return v <= 0.02 ? "at the " + SIDE_NAMES[c.a].toLowerCase() : v >= 0.98 ? "at the " + SIDE_NAMES[c.b].toLowerCase() : pct(v) + " across"; };
function reachRows(c){
  const A = S.stands[c.a].tiers, B = S.stands[c.b].tiers, n = Math.min(4, Math.max(A.length, B.length)), hyb = isHybrid(), out = [];
  const slider = (k, side, v, stand) => `<div class="row"><label>From the ${SIDE_NAMES[stand].toLowerCase()}</label><output>${pct(v)}</output>
    <input type="range" data-reach="${c.key}:${k}:${side}" min="0" max="100" step="5" value="${Math.round(v*100)}" aria-label="How far the ${SIDE_NAMES[stand].toLowerCase()}'s tier ${k+1} comes round ${c.name}"></div>`;
  for (let k=0;k<n;k++){ const R = cornerReach(c, k, A[k], B[k]), nm = tierName(k, n, hyb);
    out.push(`<div class="reach"><div class="tier-h"><span>${nm ? nm + " tier" : "Tier"}</span></div>${A[k] ? slider(k, "a", R.a, c.a) : ""}${B[k] ? slider(k, "b", R.b, c.b) : ""}</div>`); }
  return out.length ? `<p class="hint">How far round the corner each tier comes from each stand. Where both reach they join up; where one stops it ends with a clean edge, and anything above stays up.</p>${out.join("")}` : "";
}
function renderEditor(){
  fixTab(); renderTabs();
  const ed = $("editor"), hyb = isHybrid();
  if (!isBowl() && tab === "C"){
    const anyCustom = CORNERS.some(c => S.corners[c.key].mode === "custom");
    ed.innerHTML = `<p class="hint">Each corner can be open, filled, or connect only some tiers: <b>Lower only</b> gives a partial-height corner, <b>Upper only</b> leaves the lower corner open and carries the upper tiers across on pillars. Then fine-tune how far round each tier comes from each stand. The shape (curved, angled or right angle) is under Layout.</p>
      ${CORNERS.map(c => { const cc = S.corners[c.key]; return `<div class="cornerbox"><div class="tier-h"><span>${c.name}</span></div>
        <div class="row"><label>Corner</label><select data-corner="${c.key}" data-cf="mode" aria-label="${c.name}">${cornerModes().map(([v,l]) => `<option value="${v}"${cc.mode===v?" selected":""}>${l}</option>`).join("")}</select></div>
        ${cc.mode === "blend" || cc.mode === "custom" ? `<div class="row"><label>Tiers it connects</label><select data-corner="${c.key}" data-cf="tiers" aria-label="Tiers ${c.name} connects">
          ${[["all","All tiers"],["lower","Lower only"],["upper","Upper only"]].map(([v,l]) => `<option value="${v}"${cc.tiers===v?" selected":""}>${l}</option>`).join("")}</select></div>
          ${cc.mode === "blend" ? reachRows(c) : ""}
          <label class="toggle"><input type="checkbox" data-corner="${c.key}" data-cf="roof"${cc.roof ? " checked" : ""}> Roof over this corner</label>` : ""}
        ${cc.mode === "split" ? `<div class="row"><label>Where they meet</label><output>${meetText(c)}</output>
          <input type="range" data-meet="${c.key}" min="0" max="100" step="5" value="${Math.round((cc.meet == null ? .5 : cc.meet)*100)}" aria-label="Where the stands meet in ${c.name}"></div>` : ""}</div>`; }).join("")}
      <button class="btn link" id="allCorners">Make all four corners match the first</button>
      ${anyCustom ? `<div class="tier-h" style="margin-top:4px"><span>Custom corner tiers</span></div>${tierBlocks(S.cornerCustom, hyb, "cc")}<button class="btn small" data-act="addTier">Add a tier</button>` : ""}`;
  } else {
    const cfg = cfgForTab(), bowl = isBowl(), ring = hyb && tab === "B", above = hyb && !ring, side = !bowl && !ring;
    const sty = STYLES[cfg.style] || STYLES.modern, fac = cfg.facade || {};
    const eras = {}; for (const [k,v] of Object.entries(STYLES)) (eras[v.era] = eras[v.era] || []).push([k,v]);
    ed.innerHTML = `<div class="summary" id="standSummary"></div>
      <div class="acts-row">
        <button class="btn small" data-act="addTier">+ Tier</button>
        <button class="btn small" data-act="addBoxes">+ Executive boxes</button>
        ${ring || groundRoofOn() ? "" : `<button class="btn small" data-act="toggleRoof">${cfg.roof.shape === "none" ? "+ Roof" : "Remove roof"}</button>`}
        ${side ? `<button class="btn small" data-act="mirror">Copy to the ${SIDE_NAMES[OPPOSITE[tab]].toLowerCase()}</button>` : ""}
        <button class="btn small" data-act="copy">Copy settings</button>
        <button class="btn small" data-act="paste"${clipboard ? "" : " disabled"}>Paste settings</button>
        ${ring || groundRoofOn() ? "" : `<button class="btn small" data-act="altRoof">Try another roof</button>`}
        <button class="btn small" data-act="surprise">Surprise me</button>
        <button class="btn small" data-act="reset">Reset</button>
      </div>
      <div class="row"><label for="sty">Architecture</label><select id="sty" data-act-change="style">${Object.entries(eras).map(([era, list]) => `<optgroup label="${era}">${list.map(([v,o]) => `<option value="${v}"${v===cfg.style?" selected":""}>${o.label}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <p class="hint">${sty.note} Picking a style brings in its own tiers, overhangs, roof and façade; everything stays editable.</p>
      ${ring ? "" : `<div class="scales"><span>Quick size:</span>${Object.entries(SCALES).map(([k,v]) => `<button class="btn small" data-act="scale" data-scale="${k}">${v.label}</button>`).join("")}</div>`}
      ${side && layoutOf() === "stands" ? `<details class="sub" open><summary>Position and length</summary><div class="inner">
        ${check("Same distance from the play as the other stands", "distSame", cfg.dist == null)}
        ${cfg.dist == null ? "" : pair("Distance from the play", "dist", cfg.dist, 1, 80, 0.5, "m")}
        ${pair("Extra length at each end", "extend", cfg.extend || 0, -40, 60, 1, "m", "Only where the corner next to it is open.")}</div></details>` : ""}
      ${above ? `<p class="hint">These tiers sit on top of the lower bowl and follow its shape. Remove them all to leave just the bowl here, with or without a roof.${bowlGone(tab) ? " The lower bowl is left out on this side, so they start at ground level." : ""}</p>` : ""}
      ${bowl || ring ? bowlShapeBlock() : ""}
      ${tierBlocks(cfg.tiers, above, "", (bowl || ring) && S.bowl.varyRows, !bowl && !ring)}
      ${cfg.tiers.length < 4 ? `<button class="btn small" data-act="addTier">Add a tier</button>` : ""}
      ${ring ? "" : roofBlock(cfg, bowl)}
      ${ring ? "" : `<details class="sub" open><summary>Outside walls</summary><div class="inner">
        ${pick("Look", "facade.look", FACADE_LOOKS[fac.look] ? fac.look : sty.look || "plain", FACADE_LOOKS)}
        ${colourPick("Wall colour", "facade.colour", fac.colour, "#" + (sty.clad || 0x888888).toString(16).padStart(6, "0"))}
        ${colourPick("Accent colour", "facade.accent", fac.accent, "#d9d2c2")}
        <p class="hint">The accent colours the trims, bands, ribs and fins.</p>
        ${pair("Windows", "facade.windows", fac.windows == null ? 1 : fac.windows, 0, 2, 0.25, "×", "0 leaves the wall blank, 2 doubles them.")}
        ${pair("Window size", "facade.winSize", fac.winSize || 1, 0.5, 1.6, 0.1, "×")}
        ${check("Glazed concourse along the ground floor", "facade.concourse", fac.concourse)}
        <div class="row"><label for="facSign">Lettering</label><input type="text" id="facSign" data-p="facade.sign" maxlength="30" value="${esc(fac.sign || "")}" placeholder="e.g. YOUR CLUB" aria-label="Lettering"></div>
        ${fac.sign ? pick("Lettering goes", "facade.signAt", fac.signAt || "wall", {wall:"On the outside wall", roof:"Along the roof front"}) + colourPick("Lettering colour", "facade.signColour", fac.signColour, "#ffffff") : ""}
        ${check("Stair towers", "facade.towers", fac.towers)}${check("Entrance gates", "facade.gates", fac.gates)}
        <button class="btn link" data-act="seeOutside">See it from the street</button></div></details>`}`;
  }
  refreshOutputs(); renderSummary(); renderGroundRoof();
}
function renderSummary(){
  const el = $("standSummary"); if (!el || !LAST) return;
  const si = LAST.standInfo[tab]; const name = tab === "B" ? (isHybrid() ? "Lower bowl" : "Bowl") : SIDE_NAMES[tab] || "Corners";
  const mine = mergeParts(LAST.parts.filter(p => p.key === tab)), tiers = [].concat(...mine.map(p => p.tiers || []));
  el.innerHTML = si ? `<b>${name}</b>${tab === "C" ? "" : `<span>${fmt(si.width)} m long</span>`}<span>${fmt(si.depth)} m deep</span><span>${fmt(si.height)} m high</span><span>${fmt(si.seats)} places</span>` +
    (tiers.length ? `<div class="tierlist">${tiers.map(t => `<span><em>${esc(t.name)}</em> ${fmt(t.seats)} · ${t.rows} rows ${TYPES[t.type].short}</span>`).join("")}</div>` : "")
    : `<b>${name}</b><span>Nothing built here yet.</span>`;
}
function refreshOutputs(){
  const arr = (!isBowl() && tab === "C") ? S.cornerCustom : (cfgForTab() || {}).tiers || [];
  arr.forEach((tr,k) => {
    const rk = $("o-rk-"+k); if (!rk) return;
    const lim = tr.type === "terrace" ? S.limits.terraceRake : S.limits.seatRake;
    const info = LAST && LAST.steepInfo[tab];
    const v = tr.auto ? (info && info[k] ? info[k] : 0) : tr.rake, over = v > lim + 0.05;
    rk.textContent = (tr.auto ? (v ? "up to " + Math.round(v) + "°" : "auto") : tr.rake + "°") + (over ? " · over " + lim + "°" : "");
    rk.classList.toggle("over", over);
  });
}
function applyStyle(cfg, key, ring){
  const st = STYLES[key], tiers = st.tiers();
  cfg.style = key; cfg.facade = Object.assign({}, st.facade);
  cfg.tiers = ring ? tiers.slice(0, 1) : isHybrid() ? (tiers.length > 1 ? tiers.slice(1) : tiers) : tiers;
  const roof = st.roof(); if (isBowl() && roof.shape === "gable") roof.shape = "slope"; cfg.roof = roof;
}
function targetObj(){ return (!isBowl() && tab === "C") ? {tiers:S.cornerCustom} : cfgForTab(); }
const getPath = (obj, path) => path.split(".").reduce((o, k) => o == null ? o : o[k], obj);
/* Redraw the editor without losing the typing cursor (for when lettering appears or goes and its options change). */
function renderEditorKeepFocus(el){ const id = el.id, pos = el.selectionStart; renderEditor(); const n = id && document.getElementById(id); if (n){ n.focus(); try { n.setSelectionRange(pos, pos); } catch(e) {} } }
function setPath(obj, path, val){
  const parts = path.split("."); if (parts[0] === "cc"){ obj = {tiers:S.cornerCustom}; parts.shift(); }
  let o = obj; for (let i=0;i<parts.length-1;i++) o = o[parts[i]] = o[parts[i]] || {};
  const last = parts[parts.length-1];
  if (last === "curve" || last === "opening") val = val/100;
  o[last] = val;
}
$("editor").addEventListener("toggle", e => { const d = e.target; if (d.dataset && d.dataset.more){ if (d.open) openMore.add(d.dataset.more); else openMore.delete(d.dataset.more); } }, true);
$("tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (!b) return; selectTab(b.dataset.tab, false); });
$("editor").addEventListener("input", e => {
  const el = e.target, p = el.dataset.p;
  if (el.dataset.reach){ const [key, k, side] = el.dataset.reach.split(":"), cc = S.corners[key]; cc.reach = (cc.reach || []).slice();
    cc.reach[+k] = Object.assign({}, cc.reach[+k], {[side]: +el.value/100}); el.parentElement.querySelector("output").textContent = el.value + "%"; changed(false, true); return; }
  if (el.dataset.meet){ const c = CORNERS.find(x => x.key === el.dataset.meet); S.corners[c.key].meet = +el.value/100; el.parentElement.querySelector("output").textContent = meetText(c); changed(false, true); return; }
  if (!p || el.tagName === "SELECT") return;
  if (el.type === "checkbox"){
    if (p === "roofAlign"){ S.roofAlign = el.checked; changed(); return; }
    if (p === "roof.level"){ setPath(targetObj(), p, el.checked); renderEditor(); changed(); return; }
    if (p === "bowlVary"){ S.bowl.varyRows = el.checked;
      if (el.checked) S.bowl.tiers.forEach(tr => { tr.sideRows = {N:tr.rows, S:tr.rows, E:tr.rows, W:tr.rows}; tr.sideType = {N:tr.type, S:tr.type, E:tr.type, W:tr.type}; });
      else S.bowl.tiers.forEach(tr => { if (tr.sideRows) tr.rows = Math.max(1, ...SIDES.filter(s2 => !bowlGone(s2)).map(s2 => tr.sideRows[s2] != null ? tr.sideRows[s2] : tr.rows)); }); // keep the deepest side
      renderEditor(); changed(); return; }
    if (p === "distSame"){ cfgForTab().dist = el.checked ? null : (LAST ? LAST.set : S.setback); renderEditor(); changed(); return; }
    setPath(targetObj(), p, el.checked);
    if (p.endsWith(".auto")) renderEditor();
    changed(); return;
  }
  if (el.type === "color"){ setPath(targetObj(), p, el.value); changed(false, true); return; }
  if (el.type === "text"){ const had = !!getPath(targetObj(), p); setPath(targetObj(), p, el.value.replace(/[<>"'`\\]/g, "").slice(0, 30)); if (had !== !!el.value) renderEditorKeepFocus(el); changed(false, true); return; }
  const v = +el.value; if (!isFinite(v)) return;
  setPath(targetObj(), p, p.includes(".sideRows.") ? clamp(Math.round(v), 0, 120) : el.type === "number" && p.endsWith("rows") ? Math.max(1, Math.round(v)) : v);
  $("editor").querySelectorAll(`[data-p="${p}"]`).forEach(o => { if (o !== el) o.value = el.value; });
  if (p.endsWith(".rows")){ const tr = p.split(".").slice(-2)[0], tier = targetObj().tiers[+tr]; const note = el.closest(".pair").querySelector(".note"); if (note) note.textContent = (tier.rows*S.types[tier.type].row).toFixed(1) + " m deep"; }
  refreshOutputs(); changed(false, el.type === "range");
});
$("editor").addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.corner){ const cc = S.corners[el.dataset.corner], f = el.dataset.cf; cc[f] = el.type === "checkbox" ? el.checked : el.value; if (f !== "roof") delete cc.reach; renderEditor(); changed(); return; }
  if (el.dataset.actChange === "style"){ applyStyle(cfgForTab(), el.value, isHybrid() && tab === "B"); renderEditor(); changed(); return; }
  if (el.tagName === "SELECT" && el.dataset.p && el.dataset.p.endsWith(".support")){ // pillars, towers or nothing
    const tr = el.dataset.p.split(".").slice(0, -1).reduce((o, k) => o[k], el.dataset.p.startsWith("cc.") ? {cc:{tiers:S.cornerCustom}} : targetObj());
    tr.pillars = el.value === "pillars"; if (el.value === "towers") tr.hold = "towers"; else delete tr.hold; renderEditor(); changed(); return; }
  if (el.type === "color") return;
  if (el.tagName === "SELECT" && el.dataset.p && el.dataset.p.includes(".sideType.")){ // keep the side as deep as it was
    const parts = el.dataset.p.split("."), side = parts.pop(), tr = parts.slice(0, -1).reduce((o, k) => o[k], targetObj());
    const from = sideTypeOf(tr, side), rows = sideRowsOf(tr, side);
    tr.sideType = Object.assign({}, tr.sideType, {[side]: el.value});
    tr.sideRows = Object.assign({}, tr.sideRows, {[side]: Math.max(1, Math.round(rows*S.types[from].row/S.types[el.value].row))});
    renderEditor(); changed(); return; }
  if (el.tagName === "SELECT" && el.dataset.p){ setPath(targetObj(), el.dataset.p, el.value); renderEditor(); changed(); }
});
$("editor").addEventListener("click", e => {
  const pc = e.target.closest("[data-piece]");
  if (pc){ const k = pc.dataset.piece, gone = Object.assign({}, S.bowl.removed), was = !!gone[k];
    gone[k] = !was;
    if (SIDE_ENDS[k]) for (const ck of SIDE_ENDS[k]){ // a side takes the corners at its ends with it, and brings them back where the other side is built
      const c = CORNERS.find(x => x.key === ck), other = c.a === k ? c.b : c.a;
      if (!was) gone[ck] = true; else if (!gone[other]) gone[ck] = false; }
    if (BOWL_PIECES.every(x => gone[x])) return flash("<b>A bowl needs at least one part.</b> Build another side first.");
    for (const x in gone) if (!gone[x]) delete gone[x];
    S.bowl.removed = gone; renderEditor(); changed(); return; }
  const b = e.target.closest("[data-act]"); if (!b) { if (e.target.id === "allCorners"){ const v = clone(S.corners.NE); for (const c of CORNERS) S.corners[c.key] = clone(v); renderEditor(); changed(); } return; }
  const act = b.dataset.act, cfg = cfgForTab(), arr = tiersEditable();
  const say = m => flash(m);
  if (act === "addTier"){ if (arr.length >= 4) return say("<b>Four tiers is the most a stand can have.</b>");
    const k = arr.length; arr.push(t("seated", [18,14,12,10][k], 22 + 4*k, true, k ? {over:3, gap:3.6} : {})); }
  if (act === "removeTier"){ arr.splice(+b.dataset.k, 1); if (!arr.length && (isBowl() || (isHybrid() && tab === "B"))) arr.push(t("seated",16,22)); }
  if (act === "addBoxes"){ if (arr.length >= 4) return say("<b>Four tiers is the most a stand can have.</b> Remove one first.");
    const at = Math.min(1, arr.length); arr.splice(at, 0, t("exec", 4, 22, true, at || isHybrid() ? {over:2, gap:3.6} : {})); }
  if (act === "toggleRoof"){ cfg.roof = cfg.roof.shape === "none" ? STYLES[cfg.style].roof() : Object.assign({}, cfg.roof, {shape:"none"}); if (cfg.roof.shape === "none" && STYLES[cfg.style].roof().shape === "none" && b.textContent.includes("+")) cfg.roof = R("slope"); }
  if (act === "clearColour"){ const parts = b.dataset.cp.split("."), tr = parts.slice(0, -1).reduce((o, k) => o[k], b.dataset.cp.startsWith("cc.") ? {cc:{tiers:S.cornerCustom}} : targetObj()); delete tr[parts[parts.length-1]]; }
  if (act === "bowlShape"){ const [label, gone] = BOWL_SHAPES[b.dataset.shape]; S.bowl.removed = {}; for (const k of gone) S.bowl.removed[k] = true;
    flash(`<b>${label}.</b> Tap the plan to fine-tune it.`, UNDO); }
  if (act === "mirror"){ S.stands[OPPOSITE[tab]] = clone(cfg); flash(`<b>Copied</b> to the ${SIDE_NAMES[OPPOSITE[tab]].toLowerCase()}.`, UNDO); }
  if (act === "seeOutside"){ goCam("exterior"); return; }
  if (act === "copy"){ clipboard = clone(cfg); say("<b>Copied.</b> Pick another stand and paste."); renderEditor(); return; }
  if (act === "paste" && clipboard){ const c2 = clone(clipboard); if (isHybrid() && tab === "B") c2.tiers = c2.tiers.slice(0,1); Object.assign(cfg, c2); }
  if (act === "reset"){ const fresh = mk(cfg.style); if (isHybrid()) fresh.tiers = tab === "B" ? fresh.tiers.slice(0,1) : fresh.tiers.slice(1); Object.assign(cfg, fresh); }
  if (act === "scale"){ const sc = SCALES[b.dataset.scale]; cfg.tiers = sc.tiers(); if (isHybrid()) cfg.tiers = cfg.tiers.slice(1); if (cfg.roof.shape !== "none") Object.assign(cfg.roof, sc.roof); }
  if (act === "altRoof"){ const rnd = a => a[Math.floor(Math.random()*a.length)];
    cfg.roof = R(rnd(["slope","slope","gable"]), {mat:rnd(Object.keys(ROOF_MATS)), support:rnd(Object.keys(ROOF_SUPPORTS)), reach:r05(-6 + Math.random()*12), lift:r05(3 + Math.random()*7), tilt:Math.round(-4 + Math.random()*14), curve:Math.random() < .4 ? +(Math.random()*.8).toFixed(2) : 0});
    if (isBowl() && cfg.roof.shape === "gable") cfg.roof.shape = "slope"; }
  if (act === "surprise"){ const keys = Object.keys(STYLES).filter(k => k !== cfg.style), k = keys[Math.floor(Math.random()*keys.length)], st = STYLES[k];
    cfg.style = k; cfg.facade = Object.assign({}, st.facade); const ro = st.roof(); if (ro.shape !== "none" || cfg.roof.shape === "none") cfg.roof = Object.assign(ro, {shape: isBowl() && ro.shape === "gable" ? "slope" : ro.shape});
    flash(`<b>Restyled as ${st.label}.</b> Tiers kept as they were.`, UNDO); }
  renderEditor(); changed();
});

/* ================= one roof over the whole ground ================= */
const groundRoofOf = () => (S.groundRoof = Object.assign({}, GROUND_ROOF, S.groundRoof || {}));
function renderGroundRoof(){
  const box = $("groundRoof"), on = groundRoofOn(); box.hidden = !on; if (!on){ box.innerHTML = ""; return; }
  const gr = groundRoofOf(), p = k => "gr." + k;
  box.innerHTML = `${pick("Outline", p("shape"), gr.shape, GROUND_ROOF_SHAPES)}${pick("Cover", p("cover"), gr.cover, GROUND_ROOF_COVER)}
    ${gr.cover === "closed" ? pair("Opening in the middle", p("opening"), Math.round((gr.opening||0)*100), 0, 90, 5, "%") : ""}
    ${pick("Material", p("mat"), gr.mat, ROOF_MATS)}${pick("Structure", p("support"), gr.support, GROUND_ROOF_SUPPORTS)}
    ${pair("Reaches past the front row", p("reach"), gr.reach, -20, 40, 0.5, "m", gr.shape === "follow" ? "Negative leaves the front rows open." : "Measured halfway along the long sides. Negative leaves the front rows open.")}
    ${pair("Overhang behind the back row", p("back"), gr.back, 0, 30, 0.5, "m")}
    ${pair("Height above the tallest stand", p("lift"), gr.lift, 1.5, 40, 0.5, "m")}
    ${pair("Tilt up towards the play", p("tilt"), gr.tilt, -15, 25, 1, "°")}${pair("Curve", p("curve"), Math.round((gr.curve||0)*100), 0, 100, 5, "%")}
    ${check("Close in the outside, down to the ground", p("wall"), gr.wall)}`;
}
$("grOn").addEventListener("change", e => { groundRoofOf().on = e.target.checked; renderGroundRoof(); renderEditor(); changed(); });
$("groundRoof").addEventListener("input", e => { const el = e.target, p = el.dataset.p; if (!p || el.tagName === "SELECT") return;
  const key = p.slice(3), gr = groundRoofOf();
  if (el.type === "checkbox"){ gr[key] = el.checked; changed(); return; }
  const v = +el.value; if (!isFinite(v)) return;
  gr[key] = key === "curve" || key === "opening" ? v/100 : v;
  $("groundRoof").querySelectorAll(`[data-p="${p}"]`).forEach(o => { if (o !== el) o.value = el.value; });
  changed(false, el.type === "range"); });
$("groundRoof").addEventListener("change", e => { const el = e.target; if (el.tagName !== "SELECT" || !el.dataset.p) return; groundRoofOf()[el.dataset.p.slice(3)] = el.value; renderGroundRoof(); changed(); });

/* ================= seating sizes and rules ================= */
function renderTypeSizes(){
  $("typeSizes").innerHTML = Object.entries(TYPE_FIELDS).map(([ty, fields]) => `<details><summary>${TYPES[ty].label}<small id="ts-${ty}"></small></summary><div class="inner">
    ${fields.map(([f,label,unit,min,max,step]) => `<div class="row"><label for="sz-${ty}-${f}">${label}</label><output id="o-sz-${ty}-${f}"></output>
      <input type="range" id="sz-${ty}-${f}" data-ty="${ty}" data-f="${f}" min="${min}" max="${max}" step="${step}" value="${S.types[ty][f]}"></div>`).join("")}
  </div></details>`).join("");
}
$("typeSizes").addEventListener("input", e => { const el = e.target; if (!el.dataset.ty) return; S.types[el.dataset.ty][el.dataset.f] = +el.value; changed(false, true); });
function syncSizes(){
  const L = S.limits;
  for (const [ty, fields] of Object.entries(TYPE_FIELDS)){
    const z = S.types[ty];
    for (const [f,,unit] of fields){
      const o = $(`o-sz-${ty}-${f}`), inp = $(`sz-${ty}-${f}`); if (!o) continue; if (document.activeElement !== inp) inp.value = z[f];
      let over = false;
      if (TYPES[ty].seat && f === "row") over = z.row < L.minRow - 1e-9;
      if (TYPES[ty].seat && f === "width") over = z.width < L.minWidth - 1e-9;
      if (ty === "terrace" && f === "density") over = z.density > L.maxDensity + 1e-9;
      o.textContent = (f === "density" ? z[f].toFixed(1) : z[f].toFixed(2)) + (unit ? " " + unit : "") + (over ? " · breaks rule" : "");
      o.classList.toggle("over", over);
    }
    $("ts-"+ty).textContent = ty === "terrace" ? `${z.row.toFixed(2)} m · ${z.density.toFixed(1)}/m²` : `${z.row.toFixed(2)} × ${z.width.toFixed(2)} m`;
  }
  const g = S.design;
  const so = (id, txt, over) => { $(id).value = g[id]; $("o-"+id).textContent = txt; $("o-"+id).classList.toggle("over", !!over); };
  so("gangEvery", g.gangEvery + " seats" + (g.gangEvery > L.maxBetween ? " · breaks rule" : ""), g.gangEvery > L.maxBetween);
  so("gangWidth", g.gangWidth.toFixed(2) + " m" + (g.gangWidth < L.minGang - 1e-9 ? " · breaks rule" : ""), g.gangWidth < L.minGang - 1e-9);
  so("exitEvery", g.exitEvery + " m");
  so("exitWidth", g.exitWidth.toFixed(1) + " m");
  const gap = g.barrierEvery * S.types.terrace.row, gOver = gap > L.barrierGap + 1e-9;
  so("barrierEvery", `${g.barrierEvery} steps (${gap.toFixed(1)} m)` + (gOver ? " · breaks rule" : ""), gOver);
}
for (const id of ["gangEvery","gangWidth","barrierEvery","exitEvery","exitWidth"]) $(id).addEventListener("input", e => { S.design[id] = +e.target.value; changed(false, true); });
$("limits").innerHTML = LIMIT_FIELDS.map(([k,label,unit,step]) => `<label for="lim-${k}"><span>${label}</span><input type="number" id="lim-${k}" data-lim="${k}" step="${step}"><span>${unit}</span></label>`).join("");
$("limits").addEventListener("input", e => { const el = e.target; if (!el.dataset.lim || el.value === "" || isNaN(+el.value) || (+el.value <= 0 && el.dataset.lim !== "minC")) return;
  S.limits[el.dataset.lim] = +el.value; S.standard = "custom"; changed(false, true); });
$("standard").addEventListener("change", e => { S.standard = e.target.value; if (STANDARDS[S.standard]) S.limits = Object.assign({}, STANDARDS[S.standard]); changed(); });
function syncLimits(){
  $("standard").value = S.standard;
  for (const [k] of LIMIT_FIELDS){ const el = $("lim-"+k); if (document.activeElement !== el) el.value = S.limits[k]; }
  $("limitsSummary").textContent = (S.standard === "custom" ? "custom" : S.standard === "minimum" ? "UK minimum" : "UK recommended");
}

/* ================= floors, site plot, layout ================= */
$("kinds").innerHTML = Object.entries(KINDS).map(([k,o]) => `<button data-kind="${k}" aria-pressed="false">${o.label}</button>`).join("");
$("kinds").addEventListener("click", e => {
  const b = e.target.closest("[data-kind]"); if (!b) return;
  const k = KINDS[b.dataset.kind];
  S.custom = {kind:b.dataset.kind, W:k.W, H:k.H, r:k.r, surface:k.surface, floor:k.floor};
  S.setback = k.set; if (b.dataset.kind === "bullring") S.layout = "bowl"; changed(true);
});
function plotShape(kind, silent){
  const had = S.plot.on; S.plot.on = false; const r = dryRun(); S.plot.on = had;
  const b = r.bounds, F = field(), set = Math.max(S.setback, 1);
  const x0 = b[0]-4, x1 = b[1]+4, z0 = b[2]-4, z1 = b[3]+4, fx = F.W/2 + set + 3, fz = F.H/2 + set + 3;
  const mid = (a, c, f) => Math.round(a + (c - a)*f), Rn = Math.round;
  let pts;
  if (kind === "squeeze") pts = [[mid(-fx, x0, .35), mid(-fz, z0, .55)], [Rn(x1), mid(-fz, z0, .55)], [Rn(x1), mid(fz, z1, .3)], [mid(-fx, x0, .35), mid(fz, z1, .3)]];
  else if (kind === "wedge") pts = [[Rn(x0), Rn(z0)], [Rn(x1 + 12), Rn(z0)], [mid(fx, x1, .2), Rn(z1)], [Rn(x0), Rn(z1)]];
  else if (kind === "corner") pts = [[Rn(x0), Rn(z0)], [mid(fx, x1, .05), Rn(z0)], [Rn(x1), mid(-fz, z0, .05)], [Rn(x1), Rn(z1)], [Rn(x0), Rn(z1)]];
  else if (kind === "triangle"){ // two streets meeting at a point beyond the east end; the pitch still fits
    const s0 = (z0 + fz)/z0, s1 = (z1 - fz)/z1, ax = Math.max(x0 + (fx + 6 - x0)/Math.max(.05, Math.min(s0, s1)), x1 * 0.9);
    pts = [[Rn(x0), Rn(z0)], [Rn(ax), 0], [Rn(x0), Rn(z1)]]; }
  else pts = [[Rn(x0), Rn(z0)], [Rn(x1), Rn(z0)], [Rn(x1), Rn(z1)], [Rn(x0), Rn(z1)]];
  S.plot.pts = pts; S.plot.on = true; if (!silent) changed(true);
}
document.querySelectorAll("[data-plot]").forEach(b => b.addEventListener("click", () => plotShape(b.dataset.plot)));
$("plotOn").addEventListener("change", e => { if (e.target.checked && !S.plot.pts) plotShape("snug"); else { S.plot.on = e.target.checked; changed(true); } setTip(); });
$("plotClip").addEventListener("change", e => { S.plot.clip = e.target.checked; changed(); });
/* Typed plot sizes and corners, for when dragging posts isn't precise enough. */
const plotBox2 = pts => { const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]); return {x0:Math.min(...xs), x1:Math.max(...xs), z0:Math.min(...zs), z1:Math.max(...zs)}; };
const polyArea = pts => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i+1)%pts.length]; return a + p[0]*q[1] - q[0]*p[1]; }, 0))/2;
let plotDrawn = null;
function renderPlot(){
  const pts = S.plot.pts; if (!pts) return;
  const b = plotBox2(pts), area = polyArea(pts);
  $("plotSummary").textContent = `${b.x1-b.x0} × ${b.z1-b.z0} m · ${area >= 10000 ? (area/10000).toFixed(2) + " ha" : fmt(area) + " m²"}`;
  for (const [id, v] of [["plotW", b.x1-b.x0], ["plotD", b.z1-b.z0]]) if (document.activeElement !== $(id)) $(id).value = v;
  if ($("plotPts").contains(document.activeElement)) return;
  plotDrawn = JSON.stringify(pts);
  $("plotPts").innerHTML = pts.map((p, i) => `<div class="plotpt"><span>Corner ${i+1}</span>
    <label>E–W <input type="number" data-pi="${i}" data-pa="0" value="${p[0]}" step="1" aria-label="Corner ${i+1}, east to west"></label>
    <label>N–S <input type="number" data-pi="${i}" data-pa="1" value="${p[1]}" step="1" aria-label="Corner ${i+1}, main to opposite"></label>
    <button class="mini" data-pdel="${i}"${pts.length <= 3 ? " disabled" : ""} aria-label="Remove corner ${i+1}">Remove</button></div>`).join("");
}
for (const [id, axis] of [["plotW", 0], ["plotD", 1]]) $(id).addEventListener("change", e => { // stretch the plot about its middle
  const v = +e.target.value, pts = S.plot.pts; if (!pts || !(v >= 20)) return;
  const b = plotBox2(pts), lo = axis ? b.z0 : b.x0, hi = axis ? b.z1 : b.x1, mid = (lo + hi)/2, k = v/Math.max(1, hi - lo);
  S.plot.pts = pts.map(p => { const q = p.slice(); q[axis] = Math.round(mid + (p[axis] - mid)*k); return q; }); changed(true); });
$("plotPts").addEventListener("change", e => { const el = e.target; if (el.dataset.pi == null) return; const v = +el.value; if (!isFinite(v)) return;
  const pts = clone(S.plot.pts); pts[+el.dataset.pi][+el.dataset.pa] = Math.round(v); S.plot.pts = pts; changed(); });
$("plotPts").addEventListener("click", e => { const b = e.target.closest("[data-pdel]"); if (!b || S.plot.pts.length <= 3) return;
  const pts = clone(S.plot.pts); pts.splice(+b.dataset.pdel, 1); S.plot.pts = pts; plotDrawn = null; changed(); });
$("plotAdd").addEventListener("click", () => { // a new corner halfway along the longest edge, ready to drag or type
  const pts = clone(S.plot.pts); let bi = 0, bl = -1;
  pts.forEach((p, i) => { const q = pts[(i+1)%pts.length], l = Math.hypot(q[0]-p[0], q[1]-p[1]); if (l > bl){ bl = l; bi = i; } });
  const p = pts[bi], q = pts[(bi+1)%pts.length]; pts.splice(bi+1, 0, [Math.round((p[0]+q[0])/2), Math.round((p[1]+q[1])/2)]);
  S.plot.pts = pts; plotDrawn = null; changed(); toast(`<b>Corner ${bi+2} added</b> halfway along the longest edge. Drag its post or type where it goes.`); });
for (const s of SWATCHES){
  const b = document.createElement("button"); b.style.background = s[1]; b.title = s[0]; b.setAttribute("aria-label", s[0]); b.dataset.hex = s[1];
  b.addEventListener("click", () => { S.seat = s[1]; setSeatColours(); changed(); });
  $("swatches").appendChild(b);
}
function bindRadio(name, fn){ document.querySelectorAll(`input[name=${name}]`).forEach(r => r.addEventListener("change", () => fn(r.value))); }
bindRadio("sport", v => { S.sport = v; S.setback = v === "custom" ? (KINDS[S.custom.kind] || KINDS.plain).set : SPORTS[v].set; S.plot.pts = null; S.plot.on = false; renderEditor(); changed(true); });
bindRadio("layout", v => { S.layout = v; if (v === "hybrid") tab = "B"; renderEditor(); changed(true); });
bindRadio("cshape", v => { S.cornerShape = v; changed(); });
const bindRange = (id, fn, cam) => $(id).addEventListener("input", e => { fn(+e.target.value); changed(cam, true); });
bindRange("setback", v => S.setback = v);
bindRange("corner", v => S.corner = v);
bindRange("floorRows", v => S.custom.floor = v, true);
for (const [id, key, max] of [["nW","W",400],["nH","H",300],["nR","r",150]]) $(id).addEventListener("change", e => {
  const v = +e.target.value; if (!isFinite(v)) return; S.custom[key] = Math.max(key === "r" ? 0 : 4, Math.min(max, Math.round(v*10)/10)); changed(true); });
$("boards").addEventListener("change", e => { S.boards = e.target.checked; changed(); });
$("flood").innerHTML = Object.entries(FLOODS).map(([k,v]) => `<option value="${k}">${v}</option>`).join("");
$("flood").addEventListener("change", e => { S.floodlights = e.target.value; S.lights = e.target.value !== "none"; changed(); });
const screensOf = () => { if (!Array.isArray(S.screens)) S.screens = screenList(LAST && LAST.closedAt).map(x => Object.assign({}, x)); return S.screens; };
let screensDrawn = null;
function renderScreens(){
  const list = Array.isArray(S.screens) ? S.screens : screenList(LAST && LAST.closedAt);
  screensDrawn = JSON.stringify(list);
  $("screens").innerHTML = list.length ? list.map((sc, i) => `<div class="screen" data-i="${i}">
    <div class="tier-h"><span>Screen ${i+1}</span><span class="acts-row"><button class="mini" data-sact="view" data-i="${i}">Look at it</button><button class="mini" data-sact="remove" data-i="${i}">Remove</button></span></div>
    <div class="row"><label>Where</label><select data-sf="at" data-i="${i}" aria-label="Screen ${i+1} position">${Object.entries(SCREEN_AT).map(([k,v]) => `<option value="${k}"${k===sc.at?" selected":""}>${v}</option>`).join("")}</select></div>
    ${sc.at === "centre" ? "" : `<div class="row"><label>Mounted</label><select data-sf="mount" data-i="${i}" aria-label="Screen ${i+1} mounting">${Object.entries(SCREEN_MOUNTS).map(([k,v]) => `<option value="${k}"${k===(sc.mount||"gap")?" selected":""}>${v}</option>`).join("")}</select></div>`}
    ${sc.mount === "ribbon" && sc.at !== "centre" ? "" : `<div class="row"><label>Width</label><output>${sc.size || 16} m</output><input type="range" data-sf="size" data-i="${i}" min="4" max="40" step="1" value="${sc.size || 16}" aria-label="Screen ${i+1} width"></div>
    ${sc.at === "centre" ? "" : `<div class="row"><label>Along the stand</label><output>${(sc.pos||0) === 0 ? "centre" : Math.abs(sc.pos) + "% " + (sc.pos < 0 ? "left" : "right")}</output><input type="range" data-sf="pos" data-i="${i}" min="-100" max="100" step="5" value="${sc.pos || 0}" aria-label="Screen ${i+1} position along the stand"></div>`}`}
  </div>`).join("") : `<p class="hint">No screens yet.</p>`;
}
/* Fly round to face a screen: from above, most of them are hidden under a roof or too small to spot. */
function viewScreen(i){ screenFocus = i; requestAnimationFrame(() => requestAnimationFrame(() => { if (LAST.screenSpots && LAST.screenSpots[i]) goCam("screen"); })); }
$("addScreen").addEventListener("click", () => { const L2 = screensOf(); const used = new Set(L2.map(x => x.at)); const at = ["E","W","N","S"].find(k => !used.has(k)) || "E";
  const sc = {at, mount:"gap", size:12, pos:0}, i = L2.length; L2.push(sc);
  // start with the first way of mounting it that fits this ground without a warning (checked against the stadium as built)
  const key = "screen:" + i, C = LAST.screenCtx, fits = ["gap","roof","top","back"].find(m => { sc.mount = m; const found = [];
    planScreens(C.F, C.anchors, C.closedAt, C.outerTop, C.set, (text, k) => found.push(k)); return !found.includes(key); });
  sc.mount = fits || "back";
  renderScreens(); changed(); viewScreen(i);
  toast(`<b>Screen added</b> ${SCREEN_MOUNTS[sc.mount].charAt(0).toLowerCase() + SCREEN_MOUNTS[sc.mount].slice(1)}, at the ${SCREEN_AT[at].toLowerCase()}. Aerial takes you back up.`, UNDO);
});
$("screens").addEventListener("click", e => { const b = e.target.closest("[data-sact]"); if (!b) return;
  if (b.dataset.sact === "view") return viewScreen(+b.dataset.i);
  screensOf().splice(+b.dataset.i, 1); if (camMode === "screen") goCam("aerial"); renderScreens(); changed(); });
$("screens").addEventListener("input", e => { const el = e.target; if (!el.dataset.sf || el.tagName === "SELECT") return; const sc = screensOf()[+el.dataset.i]; sc[el.dataset.sf] = +el.value;
  const out = el.parentElement.querySelector("output"); if (out) out.textContent = el.dataset.sf === "size" ? el.value + " m" : (+el.value === 0 ? "centre" : Math.abs(+el.value) + "% " + (+el.value < 0 ? "left" : "right")); changed(false, true); });
$("screens").addEventListener("change", e => { const el = e.target; if (!el.dataset.sf || el.tagName !== "SELECT") return; screensOf()[+el.dataset.i][el.dataset.sf] = el.value; renderScreens(); changed(); viewScreen(+el.dataset.i); });
for (const id of ["crowd","night","seeThrough"]) $(id).addEventListener("change", e => { S[id] = e.target.checked; changed(); });
$("seeBtn").addEventListener("click", () => { S.seeThrough = !S.seeThrough; changed(); });
$("nightBtn").addEventListener("click", () => { S.night = !S.night; changed(); });
$("seatPattern").addEventListener("change", e => { S.seatPattern = e.target.value; changed(); });
$("seat2").addEventListener("input", e => { S.seat2 = e.target.value; setSeatColours(); save(true); });
bindRange("focusIn", v => S.focusIn = v);
const archOf = () => (S.arch = Object.assign({skin:"none", skinShape:"round"}, S.arch || {}));
const outerOf = () => (S.outer = Object.assign({shape:"follow", fit:"ring", size:0}, S.outer || {}));
bindRadio("outerShape", v => { outerOf().shape = v; changed(); });
bindRadio("outerFit", v => { outerOf().fit = v; changed(); });
bindRange("outerSize", v => outerOf().size = v);
$("skin").innerHTML = Object.entries(SKINS).map(([k,v]) => `<option value="${k}">${v}</option>`).join("");
$("skin").addEventListener("change", e => { archOf().skin = e.target.value; changed(); });
bindRadio("skinShape", v => { archOf().skinShape = v; changed(); });
for (const k of ["arch","ramps","towers","plaza"]) $("a-"+k).addEventListener("change", e => { archOf()[k] = e.target.checked; changed(); });
function openState(st, sideTab, tweak){
  S = st; quiet = true; if (tweak) tweak(); tab = isHybrid() ? "B" : (sideTab || "N");
  setSeatColours(); renderTypeSizes(); renderEditor(); renderViews(); changed(true);
}
document.querySelectorAll("#presets button").forEach(b => b.addEventListener("click", () => {
  const P = clone(PRESETS[b.dataset.p]); openState(P, b.dataset.p === "monument" ? "E" : "N");
  toast(`<b>${esc(b.firstChild.textContent.trim())}</b> loaded. Tap any stand to make it yours.`, UNDO);
}));

/* ================= saved designs ================= */
function readSaves(){ try { return JSON.parse(localStorage.getItem(SAVES_KEY)) || []; } catch(e) { return []; } }
function writeSaves(list){ try { localStorage.setItem(SAVES_KEY, JSON.stringify(list)); } catch(e) { flash("<b>Couldn't save:</b> this browser isn't allowing storage here."); } }
function renderSaves(){
  const list = readSaves(), el = $("saveList");
  el.innerHTML = list.length ? list.map((d,i) => `<li><span><b>${esc(d.name)}</b><small>${fmt(d.cap || 0)} capacity · ${new Date(d.at).toLocaleDateString("en-GB")}</small></span>
    <span class="acts"><button data-load="${i}">Open</button><button data-dup="${i}">Duplicate</button><button class="ghost" data-del="${i}">Delete</button></span></li>`).join("")
    : '<li class="hint">No saved designs yet. Name this one and save it.</li>';
  const opts = list.map((d,i) => `<option value="${i}">${esc(d.name)}</option>`).join("");
  $("cmpA").innerHTML = `<option value="cur">This design</option>` + opts; $("cmpB").innerHTML = `<option value="cur">This design</option>` + opts;
  if (list.length) $("cmpB").value = "0";
}
$("saveBtn").addEventListener("click", () => {
  const name = ($("saveName").value || "").trim() || `Design ${readSaves().length + 1}`;
  const list = readSaves(); list.unshift({name, at:Date.now(), cap:LAST ? LAST.total : 0, state:S}); writeSaves(list); $("saveName").value = ""; renderSaves(); flash(`<b>Saved “${esc(name)}”.</b>`);
});
$("saveList").addEventListener("click", e => {
  const list = readSaves(), l = e.target.closest("[data-load]"), d = e.target.closest("[data-dup]"), x = e.target.closest("[data-del]");
  if (l){ openState(clone(list[+l.dataset.load].state)); flash(`<b>Opened “${esc(list[+l.dataset.load].name)}”.</b>`, UNDO); }
  if (d){ const c = clone(list[+d.dataset.dup]); c.name += " (copy)"; c.at = Date.now(); list.unshift(c); writeSaves(list); renderSaves(); }
  if (x){ const i = +x.dataset.del, [gone] = list.splice(i, 1); writeSaves(list); renderSaves();
    toast(`<b>Deleted “${esc(gone.name)}”.</b>`, {label:"Undo", run:() => { const l2 = readSaves(); l2.splice(Math.min(i, l2.length), 0, gone); writeSaves(l2); renderSaves(); }}); }
});
function statsOf(state){ const keep = S; S = clone(state); let r; try { r = dryRun(); } finally { S = keep; } return r; }
$("cmpBtn").addEventListener("click", () => {
  const list = readSaves(), get = v => v === "cur" ? {name:"This design", state:S} : list[+v];
  const A = get($("cmpA").value), B = get($("cmpB").value); if (!A || !B) return;
  const a = statsOf(A.state), b = statsOf(B.state);
  const rows = [["Capacity", x => fmt(x.total)], ["Tallest point", x => fmt(x.maxH) + " m"], ["Footprint", x => `${fmt(x.bounds[1]-x.bounds[0])} × ${fmt(x.bounds[3]-x.bounds[2])} m`],
    ["Under cover", x => (x.total ? Math.round(100*x.covered/x.total) : 0) + "%"], ["Worst sightline", x => isFinite(x.minC) ? Math.round(x.minC*1000) + " mm" : "n/a"],
    ["Slowest to empty", x => x.slowest ? x.slowest.toFixed(1) + " min" : "n/a"], ["Restricted-view seats", x => fmt(x.restricted)], ["Checks raised", x => x.issues.length]];
  $("cmpOut").innerHTML = `<table><thead><tr><th></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>${rows.map(([k,f]) => `<tr><th>${k}</th><td>${f(a)}</td><td>${f(b)}</td></tr>`).join("")}</tbody></table>`;
});
$("exportBtn").addEventListener("click", () => {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); $("codeBox").value = code; $("codeBox").select();
  try { navigator.clipboard.writeText(code).then(() => flash("<b>Design code copied.</b> Paste it anywhere to keep it."), () => flash("<b>Design code is in the box.</b> Copy it from there.")); } catch(e) { flash("<b>Design code is in the box.</b> Copy it from there."); }
});
$("importBtn").addEventListener("click", () => {
  try { const st = JSON.parse(decodeURIComponent(escape(atob(($("codeBox").value || "").trim())))); if (!safeState(st)) throw 0;
    openState(st); flash("<b>Design loaded.</b>", UNDO); }
  catch(e) { flash("<b>That code didn't work.</b> Paste the whole design code, exactly as copied."); }
});

/* ================= share links, random stadiums ================= */
/* A shared design must look like one of ours. Text containing markup characters is refused outright, since parts of
   a design end up in the page. */
function safeState(st){
  if (!st || typeof st !== "object" || st.version !== 6 || !SPORTS[st.sport] || !st.stands || !st.bowl || !st.limits || !st.types) return false;
  let ok = true;
  (function walk(v, depth){ if (!ok) return; if (depth > 12) { ok = false; return; }
    if (typeof v === "string"){ if (/[<>"'`\\]/.test(v) || v.length > 200) ok = false; }
    else if (v && typeof v === "object") for (const k in v){ if (/[<>"'`]/.test(k)) { ok = false; return; } walk(v[k], depth + 1); } })(st, 0);
  return ok;
}
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function pipe(bytes, stream){ return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function shareCode(){
  const raw = new TextEncoder().encode(JSON.stringify(S));
  if (window.CompressionStream){ try { return "z" + b64u(await pipe(raw, new CompressionStream("deflate-raw"))); } catch(e) {} }
  return "j" + b64u(raw);
}
async function readShareCode(code){
  let bytes = unb64u(code.slice(1));
  if (code[0] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  return JSON.parse(new TextDecoder().decode(bytes));
}
$("shareBtn").addEventListener("click", async () => {
  const url = location.href.split("#")[0] + "#d=" + await shareCode();
  if (navigator.share && matchMedia("(pointer:coarse)").matches){ try { await navigator.share({title:"My Groundworks stadium", text:`My stadium holds ${fmt(LAST.total)}. Have a look:`, url}); return; } catch(e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(url); toast(`<b>Link copied.</b> Anyone who opens it gets this exact stadium.`); }
  catch(e) { $("codeBox").value = url; showPane("start"); $("codeBox").closest("details").open = true; toast("<b>Copy the link from the box</b> under Share as a design code."); }
});
async function openFromLink(){
  const m = location.hash.match(/^#d=([zj][A-Za-z0-9_-]+)$/); if (!m) return false;
  history.replaceState(null, "", location.pathname + location.search);
  try { const st = await readShareCode(m[1]); if (!safeState(st)) throw 0; openState(st); toast("<b>Opened a shared stadium.</b> Your own design is one Undo away.", UNDO); return true; }
  catch(e) { toast("<b>That link didn't contain a design we could open.</b> It may have been cut short when it was copied."); return false; }
}
function randomStadium(){
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const keys = Object.keys(PRESETS), styleKeys = Object.keys(STYLES);
  openState(clone(PRESETS[pick(keys)]), null, () => {
    if (isBowl()) applyStyle(S.bowl, pick(styleKeys), false);
    else { const one = Math.random() < .5 ? pick(styleKeys) : null;
      for (const k of SIDES) if (S.stands[k].tiers.length || !isHybrid()) applyStyle(S.stands[k], one || pick(styleKeys), false); }
    S.seat = pick(SWATCHES)[1];
    if (Math.random() < .35){ S.seatPattern = pick(["bands","mosaic","tiers"]); S.seat2 = pick(SWATCHES.filter(s => s[1] !== S.seat))[1]; }
    S.night = Math.random() < .3;
    const A = archOf(); A.arch = Math.random() < .15; A.towers = Math.random() < .2; A.ramps = Math.random() < .1;
  });
  requestAnimationFrame(() => requestAnimationFrame(() => toast(`🎲 <b>${fmt(LAST.total)} places.</b> ${likeText(LAST.total)} Tap a stand to tweak it.`, UNDO)));
}
$("randomBtn").addEventListener("click", randomStadium);

/* ================= welcome, help and keyboard shortcuts ================= */
const welcome = $("welcome"), help = $("help");
const openSheet = d => { if (d.open) return; if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); };
$("helpBtn").addEventListener("click", () => openSheet(help));
help.addEventListener("close", () => { if (help.returnValue === "tour") openSheet(welcome); });
welcome.addEventListener("close", () => { try { localStorage.setItem("groundworks-welcomed", "1"); } catch(e) {} });
for (const d of [welcome, help]) d.addEventListener("click", e => { // tap outside the card to close
  const r = d.getBoundingClientRect(); if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close(); });
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, select, textarea, [contenteditable]") || welcome.open || help.open) return;
  const k = e.key, panes = [...document.querySelectorAll("#panes [data-pane]")];
  if (k === "?"){ openSheet(help); }
  else if (/^[1-6]$/.test(k)) showPane(panes[+k - 1].dataset.pane);
  else if (k === "a") goCam("aerial");
  else if (k === "p") goCam("plan");
  else if (k === "f") goCam("seat");
  else if (k === "n"){ S.night = !S.night; changed(); }
  else if (k === "r") randomStadium();
  else return;
  e.preventDefault();
});

function syncUI(){
  const F = field(), lay = layoutOf();
  document.querySelector(`input[name=sport][value=${S.sport}]`).checked = true;
  $("ly-stands").disabled = !!F.noStands; $("ly-bowl").disabled = !!F.standsOnly; $("ly-hybrid").disabled = !!F.standsOnly;
  document.querySelector(`input[name=layout][value=${lay}]`).checked = true;
  document.querySelector(`input[name=cshape][value=${S.cornerShape || "curved"}]`).checked = true;
  $("layoutNote").textContent = lay === "hybrid" ? "A continuous lower bowl, with each side free to have its own tiers and roof above it."
    : lay === "bowl" ? "One continuous bowl. Under Stands you can leave out a side, for a horseshoe, or give each side its own depth." : "Four separate stands, joined by corners if you want them.";
  $("sportNote").textContent = F.note;
  $("customFloor").hidden = !F.custom;
  $("kinds").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === S.custom.kind)));
  $("cornerRow").hidden = lay === "stands" || S.cornerShape === "square" || (F.r > 0 && (F.custom || F.noStands));
  for (const [id, key] of [["nW","W"],["nH","H"],["nR","r"]]) if (document.activeElement !== $(id)) $(id).value = S.custom[key];
  $("floorSummary").textContent = `${S.custom.W} × ${S.custom.H} m`;
  const so = (id, v, txt) => { $(id).value = v; if ($("o-"+id) && txt !== undefined) $("o-"+id).textContent = txt; };
  so("floorRows", S.custom.floor || 0, (S.custom.floor || 0) ? S.custom.floor + " rows" : "none");
  const effSet = LAST ? LAST.set : S.setback;
  so("setback", S.setback, S.setback + " m" + (effSet > S.setback + 0.01 ? ` (${+effSet.toFixed(1)} m to fit floor seats)` : ""));
  so("corner", S.corner, S.corner + " m");
  const fIn = LAST && LAST.focusIn != null ? LAST.focusIn : (S.focusIn || 0);
  $("focusIn").max = Math.max(0.5, Math.floor(maxFocusIn(F)*2)/2);
  so("focusIn", fIn, fIn < 0.05 ? "edge of play" : `${+fIn.toFixed(1)} m into the floor` + (S.focusIn == null ? " (auto)" : ""));
  const OU = Object.assign({shape:"follow", fit:"ring", size:0}, S.outer || {}), upper = lay === "bowl" ? S.bowl.tiers.length > 1 : SIDES.some(s => S.stands[s].tiers.length);
  $("outerBox").hidden = lay === "stands";
  document.querySelector(`input[name=outerShape][value=${OU.shape}]`).checked = true;
  document.querySelector(`input[name=outerFit][value=${OU.fit}]`).checked = true;
  $("outerMore").hidden = OU.shape === "follow" || !upper;
  so("outerSize", OU.size, (OU.size > 0 ? "+" : "") + OU.size + " m");
  $("outerFitNote").textContent = OU.fit === "fill" ? "The upper tiers grow back until their back row, outer wall and roof trace the outline, so the corners get deeper." : "The front of the upper tiers sits on the outline, floating back from the lower tier along the sides.";
  $("outerNone").textContent = upper ? "" : (lay === "bowl" ? "Add a second tier to the bowl (under Stands) to use this." : "Give a stand some tiers above the lower bowl (under Stands) to use this.");
  $("outerNone").hidden = upper;
  $("grOn").checked = groundRoofOn();
  $("plotOn").checked = S.plot.on; $("plotBox").hidden = !S.plot.on; $("plotClip").checked = S.plot.clip;
  if (S.plot.pts && plotDrawn !== JSON.stringify(S.plot.pts)) renderPlot();
  $("boards").checked = !!S.boards;
  const AR = Object.assign({skin:"none", skinShape:"round"}, S.arch || {});
  $("skin").value = AR.skin; document.querySelector(`input[name=skinShape][value=${AR.skinShape}]`).checked = true; $("skinShapeRow").hidden = AR.skin === "none";
  for (const k of ["arch","ramps","towers","plaza"]) $("a-"+k).checked = !!AR[k];
  $("flood").value = floodMode(); if (!$("screens").contains(document.activeElement) && screensDrawn !== JSON.stringify(Array.isArray(S.screens) ? S.screens : screenList(LAST && LAST.closedAt))) renderScreens();
  $("crowd").checked = S.crowd !== false; $("night").checked = !!S.night; $("seeThrough").checked = !!S.seeThrough;
  $("seeBtn").setAttribute("aria-pressed", String(!!S.seeThrough)); $("nightBtn").setAttribute("aria-pressed", String(!!S.night));
  $("seatPattern").value = S.seatPattern || "solid"; $("seat2Row").hidden = (S.seatPattern || "solid") === "solid";
  if (document.activeElement !== $("seat2")) $("seat2").value = S.seat2 || "#f2f2f2";
  $("swatches").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.hex === S.seat)));
  syncSizes(); syncLimits();
}
let pending = false, recam = false;
function changed(moveCam, coalesce){
  if (moveCam) recam = true;
  syncUI(); renderTabs(); save(coalesce);
  if (pending) return; pending = true;
  requestAnimationFrame(() => { pending = false; build(); if (wire) applyWire(); syncUI(); renderSummary(); if (recam){ recam = false; if (camMode !== "seat") goCam(camMode); } });
}

showPane(pane, true); applyTheme(); renderTypeSizes(); fixTab(); if (isHybrid()) tab = "B"; renderEditor(); renderViews(); renderSaves(); syncUI(); build(); record(); resize(); setLook(false); goCam("aerial", true); setTip();
requestAnimationFrame(loop);
/* Hand over from the loading screen once the first frame is drawn, then greet first-time visitors. */
requestAnimationFrame(() => requestAnimationFrame(async () => {
  if (window.gwStarted) window.gwStarted();
  const shared = await openFromLink();
  let seen = false; try { seen = !!localStorage.getItem("groundworks-welcomed"); } catch(e) { seen = true; }
  if (!seen && !shared) setTimeout(() => openSheet(welcome), reduce ? 0 : 450);
}));
window.addEventListener("hashchange", openFromLink);
/* read-only hook for automated checks */
window.__gw = {state:() => JSON.parse(JSON.stringify(S)), last:() => LAST, regions:() => LAST_REGIONS};
