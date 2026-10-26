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
  const ge = g.gangEnd != null ? g.gangEnd : Math.min(14, Math.floor(g.gangEvery/2)), oe = L.maxOneEnd == null ? 14 : L.maxOneEnd;
  so("gangEnd", ge + " seats" + (ge > oe ? " · breaks rule" : ""), ge > oe); $("gangEnd").value = ge;
  so("gangWidth", g.gangWidth.toFixed(2) + " m" + (g.gangWidth < L.minGang - 1e-9 ? " · breaks rule" : ""), g.gangWidth < L.minGang - 1e-9);
  so("exitEvery", g.exitEvery + " m");
  { const AC = accessOf(), VH = vehicleOf(), opts = tdSides(), need = LAST ? wheelchairNeed(LAST.total) : 0, have = LAST ? LAST.wheelchair || 0 : 0;
    $("acOn").checked = AC.on; $("acRows").hidden = !AC.on; $("acAt").value = AC.at; $("acArrange").value = AC.arrange || "spread";
    $("acPer").value = AC.per; $("o-acPer").textContent = AC.per; $("acLength").value = AC.length; $("o-acLength").textContent = `${AC.length} m (${Math.floor(AC.length/1.6)} spaces)`;
    $("acSum").innerHTML = `<b>${have} wheelchair spaces</b>. Guidance asks for about ${need} at a ground this size.`; $("acSum").classList.toggle("over", have < need);
    $("vhOn").checked = VH.on; $("vhRows").hidden = !VH.on;
    $("vhAt").innerHTML = opts.map(([k, n]) => `<option value="${k}"${k === VH.at ? " selected" : ""}>${esc(n)}</option>`).join("");
    $("vhPos").value = VH.pos; $("o-vhPos").textContent = VH.pos ? `${Math.abs(VH.pos)} m ${VH.pos < 0 ? "left" : "right"}` : "middle";
    $("vhWidth").value = VH.width; $("o-vhWidth").textContent = VH.width + " m"; }
  $("pitchGates").checked = g.pitchGates !== false; $("emergEvery").value = g.emergEvery || 0; $("o-emergEvery").textContent = g.emergEvery > 0 ? g.emergEvery + " m" : "none";
  so("exitWidth", g.exitWidth.toFixed(1) + " m");
  const gap = g.barrierEvery * S.types.terrace.row, gOver = gap > L.barrierGap + 1e-9;
  so("barrierEvery", `${g.barrierEvery} steps (${gap.toFixed(1)} m)` + (gOver ? " · breaks rule" : ""), gOver);
}
for (const id of ["gangEvery","gangEnd","gangWidth","barrierEvery","exitEvery","exitWidth"]) $(id).addEventListener("input", e => { S.design[id] = +e.target.value; changed(false, true); });
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
/* Convertible grounds: a second sport, how room is made, and which set-up is shown. */
const convOf = () => (S.convert = Object.assign({}, CONVERT, S.convert || {}));
const sportName = sp => CONVERT_TO[sp] || (sp === "custom" ? (KINDS[S.custom.kind] || KINDS.plain).label : cap1(sp));
$("cvOn").addEventListener("change", e => { const C = convOf(); C.on = e.target.checked; if (C.to === S.sport) C.to = Object.keys(CONVERT_TO).find(k => k !== S.sport); if (!C.on) C.show = "base"; changed(true); });
$("cvTo").addEventListener("change", e => { convOf().to = e.target.value; changed(true); });
$("cvHow").addEventListener("change", e => { convOf().how = e.target.value; changed(); });
$("cvPull").addEventListener("change", e => { convOf().pull = e.target.checked; changed(); });
bindRadio("cvShow", v => { convOf().show = v; changed(); });
let capsFor = null;
function syncConvert(){
  const C = Object.assign({}, CONVERT, S.convert || {});
  $("cvOn").checked = !!C.on; $("cvMore").hidden = !C.on;
  $("cvTo").innerHTML = Object.entries(CONVERT_TO).filter(([k]) => k !== S.sport).map(([k, v]) => `<option value="${k}"${k === C.to ? " selected" : ""}>${v}</option>`).join("");
  $("cvHow").value = C.how; $("cvPull").checked = C.pull !== false;
  $("cvBaseLabel").textContent = sportName(S.sport); $("cvSecondLabel").textContent = sportName(C.to);
  document.querySelector(`input[name=cvShow][value=${C.show === "second" ? "second" : "base"}]`).checked = true;
  if (!C.on){ $("cvCaps").textContent = ""; return; }
  // the capacity both ways round, worked out once per design
  const key = JSON.stringify(S); if (capsFor === key) return; capsFor = key;
  clearTimeout(syncConvert.t); syncConvert.t = setTimeout(() => {
    const both = ["base", "second"].map(show => statsOf(Object.assign(clone(S), {convert:Object.assign({}, C, {show})})).total);
    $("cvCaps").textContent = `${sportName(S.sport)}: ${fmt(both[0])} places · ${sportName(C.to)}: ${fmt(both[1])} places.`; }, 50);
}
/* Surroundings: add, edit and remove roads, water, railways and buildings. */
$("siteAdd").innerHTML = Object.entries(SITE_KINDS).map(([k, v]) => `<button class="btn" data-site="${k}">${v.label}<small>${v.note}</small></button>`).join("");
const siteOf = () => (S.site = Array.isArray(S.site) ? S.site : []);
let siteDrawn = null;
function renderSite(){
  const list = Array.isArray(S.site) ? S.site : []; siteDrawn = JSON.stringify(list); // just drawing it mustn't change the design
  if ($("siteList").contains(document.activeElement)) return;
  const num = (i, k, label, v, min, max, step, unit) => `<div class="row pair"><label>${label}</label><span class="num"><input type="number" data-sf2="${k}" data-i="${i}" value="${Math.round(v*10)/10}" min="${min}" max="${max}" step="${step}" aria-label="${label}"> ${unit}</span>
    <input type="range" data-sf2="${k}" data-i="${i}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label}"></div>`;
  $("siteList").innerHTML = list.map((f, i) => { const K = SITE_KINDS[f.kind] || {label:f.kind};
    return `<div class="screen"><div class="tier-h"><span>${K.label}</span><span class="acts-row"><button class="mini" data-sdel="${i}">Remove</button></span></div>
      ${num(i, "x", "East–west position", f.x, -600, 600, 1, "m")}${num(i, "z", "North–south position", f.z, -600, 600, 1, "m")}
      ${num(i, "angle", "Angle", f.angle || 0, 0, 180, 1, "°")}${num(i, "length", "Length", f.length, 5, 1000, 1, "m")}${num(i, "width", "Width", f.width, 3, 200, 0.5, "m")}
      ${f.height != null ? num(i, "height", "Height", f.height, 3, 150, 0.5, "m") : ""}</div>`; }).join("") || `<p class="hint">Nothing round the ground yet.</p>`;
}
$("siteAdd").addEventListener("click", e => { const b = e.target.closest("[data-site]"); if (!b) return;
  const K = SITE_KINDS[b.dataset.site], list = siteOf(), bd = LAST ? LAST.bounds : [-80, 80, -60, 60];
  // put it just outside the ground, on the first side that's free
  const spots = [{x:0, z:bd[2] - K.width/2 - 8, angle:0}, {x:0, z:bd[3] + K.width/2 + 8, angle:0}, {x:bd[1] + K.width/2 + 8, z:0, angle:90}, {x:bd[0] - K.width/2 - 8, z:0, angle:90}];
  const spot = spots[list.length % 4], f = Object.assign({kind:b.dataset.site, length:K.length, width:K.width}, spot);
  if (K.height != null) f.height = K.height;
  if (f.kind === "houses" || f.kind === "building"){ f.length = K.length; f.x = spot.angle ? spot.x : bd[0] + K.length/2; f.z = spot.angle ? bd[2] + K.length/2 : spot.z; }
  f.x = Math.round(f.x); f.z = Math.round(f.z); list.push(f); siteDrawn = null; changed(true);
  toast(`<b>${K.label} added</b> beside the ground. Drag its yellow posts in the 3D view, or type where it goes.`, UNDO); });
$("siteList").addEventListener("input", e => { const el = e.target; if (!el.dataset.sf2) return; const v = +el.value; if (!isFinite(v)) return;
  const f = siteOf()[+el.dataset.i]; f[el.dataset.sf2] = v; if (["x", "z", "angle"].includes(el.dataset.sf2)) delete f.snap; // typed where it goes: free of the plot's edge
  el.closest(".row").querySelectorAll("input").forEach(o => { if (o !== el) o.value = el.value; }); changed(false, true); });
$("siteList").addEventListener("click", e => { const b = e.target.closest("[data-sdel]"); if (!b) return; siteOf().splice(+b.dataset.sdel, 1); siteDrawn = null; renderSite(); changed(); });
function siteHandleNear(p){
  if (!p || look || picking || !Array.isArray(S.site)) return null;
  const tol = Math.max(3, LAST ? Math.max(LAST.ext[0], LAST.ext[1])*0.03 : 3);
  for (let i=0;i<S.site.length;i++){ const f = S.site[i], a = (f.angle || 0)*Math.PI/180, ex = f.x + Math.cos(a)*f.length/2, ez = f.z + Math.sin(a)*f.length/2;
    if (Math.hypot(p.x - ex, p.z - ez) < tol) return {type:"site", i, end:true};
    if (Math.hypot(p.x - f.x, p.z - f.z) < tol) return {type:"site", i, end:false}; }
  return null;
}
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
bindRadio("layout", v => { S.layout = v; if (v === "hybrid") tab = "B"; if (v === "ring") tab = "R0"; renderEditor(); changed(true); });
bindRadio("cshape", v => { S.cornerShape = v; changed(); });
const bindRange = (id, fn, cam) => $(id).addEventListener("input", e => { fn(+e.target.value); changed(cam, true); });
bindRange("setback", v => S.setback = v);
bindRange("runoff", v => S.runoff = v);
for (const [id, key] of [["ckL","L"],["ckW","W"]]) bindRange(id, v => { S.cricket = Object.assign({}, CRICKET, S.cricket, {[key]: v}); }, true);
for (const [id, key] of [["bpLF","lf"],["bpCF","cf"],["bpRF","rf"],["bpWall","wall"],["bpLFW","lfWall"]]) bindRange(id, v => { S.ballpark = Object.assign({}, BALLPARK, S.ballpark, {[key]: v}); }, true);
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
for (const id of ["crowd","night","seeThrough","players"]) $(id).addEventListener("change", e => { S[id] = e.target.checked; changed(); });
$("scenery").addEventListener("change", e => { S.scenery = e.target.checked ? "real" : "model"; changed(); });
bindRange("crowdFill", v => S.crowdFill = v/100);
for (const [id, k] of [["bdEnd","end"],["bdSide","side"],["bdHeight","height"]]) bindRange(id, v => { S.boardSet = Object.assign(boardSetOf(), {[k]: v}); });
$("fieldShape").innerHTML = Object.entries(FIELD_SHAPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("fieldShape").addEventListener("change", e => { S.fieldShape = Object.assign(fieldShapeOf(), {shape:e.target.value}); changed(true); });
bindRange("fieldMargin", v => { S.fieldShape = Object.assign(fieldShapeOf(), {margin:v}); }, true);
/* Tunnel and dugouts: which stands they can go in, and their settings. */
const tdSides = () => isRing() ? ringOf().stands.map((r, i) => ["R" + i, r.name || "Stand " + (i+1)]).filter((x, i) => ringOf().stands[i].tiers.length)
  : SIDES.filter(k => isBowl() || isHybrid() || S.stands[k].tiers.length).map(k => [k, SIDE_NAMES[k].toLowerCase()]);
const tnSet = (k, v) => { S.tunnel = Object.assign(tunnelOf(), {[k]: v}); }, dgSet = (k, v) => { S.dugouts = Object.assign(dugoutsOf(), {[k]: v}); };
$("dgStyle").innerHTML = Object.entries(DUGOUT_STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("tnOn").addEventListener("change", e => { tnSet("on", e.target.checked); changed(); });
$("tnAt").addEventListener("change", e => { tnSet("at", e.target.value); changed(); });
$("tnExtend").addEventListener("change", e => { tnSet("extend", e.target.checked); changed(); });
$("tnColour").addEventListener("input", e => { tnSet("colour", e.target.value); changed(false, true); });
bindRange("tnPos", v => tnSet("pos", v)); bindRange("tnWidth", v => tnSet("width", v));
$("dgOn").addEventListener("change", e => { dgSet("on", e.target.checked); changed(); });
$("dgStyle").addEventListener("change", e => { dgSet("style", e.target.value); changed(); });
$("dgAt").addEventListener("change", e => { dgSet("at", e.target.value); changed(); });
$("dgColour").addEventListener("input", e => { dgSet("colour", e.target.value); changed(false, true); });
bindRange("dgLength", v => dgSet("length", v)); bindRange("dgGap", v => dgSet("gap", v));
$("acAt").innerHTML = Object.entries(ACCESS_AT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
const acSet = (k, v) => { S.access = Object.assign(accessOf(), {[k]: v}); }, vhSet = (k, v) => { S.vehicle = Object.assign(vehicleOf(), {[k]: v}); };
$("acOn").addEventListener("change", e => { acSet("on", e.target.checked);
  if (e.target.checked){ const is = dryIssues().find(i => i.key === "access:spaces"); if (is && is.fix) is.fix.run(); } // start with enough to meet the guidance
  renderEditor(); changed(); }); // each stand's own platform settings appear or go
$("acAt").addEventListener("change", e => { acSet("at", e.target.value); changed(); });
$("acArrange").innerHTML = Object.entries(ACCESS_ARRANGE).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
$("acArrange").addEventListener("change", e => { acSet("arrange", e.target.value); changed(); });
bindRange("acPer", v => acSet("per", v)); bindRange("acLength", v => acSet("length", v));
$("vhOn").addEventListener("change", e => { vhSet("on", e.target.checked); changed(); });
$("vhAt").addEventListener("change", e => { vhSet("at", e.target.value); changed(); });
bindRange("vhPos", v => vhSet("pos", v)); bindRange("vhWidth", v => vhSet("width", v));
$("pitchGates").addEventListener("change", e => { S.design.pitchGates = e.target.checked; changed(); });
bindRange("emergEvery", v => S.design.emergEvery = v);
const clock = h => { const hh = Math.floor(h), mm = Math.round((h - hh)*60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`; };
$("hour").addEventListener("input", e => { S.hour = +e.target.value; $("o-hour").textContent = clock(S.hour); applyMood(); invalidate(); save(true); });
/* Names typed by people end up in the page and in share links, so anything that looks like markup is stripped. */
const cleanName = v => String(v).replace(/[<>"'`\\]/g, "").slice(0, 30);
const spOf = () => (S.sponsors = Object.assign(sponsorsOf(), S.sponsors || {}));
$("spTitle").addEventListener("input", e => { spOf().title = cleanName(e.target.value); changed(false, true); });
$("spTitleColour").addEventListener("input", e => { spOf().titleColour = e.target.value; changed(false, true); });
$("spOnStand").addEventListener("change", e => { spOf().onStand = e.target.checked; changed(); });
$("spNames").addEventListener("input", e => { spOf().names = e.target.value.split("\n").map(cleanName).slice(0, 8); S.boards = true; changed(false, true); }); // sponsors want to be seen
const awaySet = (k, v) => { S.away = Object.assign(awayOf(), {[k]: v}); };
$("awayOn").addEventListener("change", e => { awaySet("on", e.target.checked); changed(); });
$("awayAt").addEventListener("change", e => { awaySet("at", e.target.value); changed(); });
$("awayAnchor").addEventListener("change", e => { awaySet("anchor", e.target.value); changed(); });
$("awayCount").addEventListener("input", e => { if (e.target.value === "" || isNaN(+e.target.value)) return; awaySet("count", Math.max(0, Math.round(+e.target.value))); changed(false, true); });
$("awayColour").addEventListener("input", e => { awaySet("colour", e.target.value); changed(false, true); });
bindRange("awayGap", v => awaySet("gap", v));
$("homeAt").addEventListener("change", e => { S.homeEnd = Object.assign(homeEndOf(), {at:e.target.value}); changed(); });
const heSet = (k, v) => { S.homeEnd = Object.assign(homeEndOf(), {[k]: v}); };
for (const [id, k] of [["homeFlags","flags"],["homeBanners","banners"],["homeTifo","tifo"]]) $(id).addEventListener("change", e => { heSet(k, e.target.checked); changed(); });
$("homeTexts").addEventListener("input", e => { heSet("texts", e.target.value.replace(/[<>"'`\\]/g, "").toUpperCase().slice(0, 120)); changed(false, true); });
$("homeName").addEventListener("input", e => { S.homeEnd = Object.assign(homeEndOf(), {name:cleanName(e.target.value).toUpperCase()}); changed(false, true); });
$("stewards").addEventListener("change", e => { S.stewards = e.target.checked; changed(); });
$("waveBtn").addEventListener("click", () => {
  if (S.crowd === false){ S.crowd = true; changed(); }
  requestAnimationFrame(() => { const t0 = performance.now(); TICKERS.add(now => waveTick(now - t0)); wake(); });
  if (camMode === "plan") goCam("aerial");
});
$("seeBtn").addEventListener("click", () => { S.seeThrough = !S.seeThrough; changed(); });
$("nightBtn").addEventListener("click", () => { S.night = !S.night; changed(); });
$("seatPattern").addEventListener("change", e => { S.seatPattern = e.target.value; changed(); });
$("seat2").addEventListener("input", e => { S.seat2 = e.target.value; setSeatColours(); save(true); });
/* Lettering in the seats: on the stand facing the main camera by default, in the second seat colour. */
const seatTextStands = () => isRing() ? ringOf().stands.map((r, i) => ["R" + i, r.name || "Stand " + (i+1)]).filter((x, i) => ringOf().stands[i].tiers.length)
  : isBowl() ? [["B", "Bowl (main side)"]] : (isHybrid() ? [["B", "Lower bowl (main side)"]] : []).concat(SIDES.filter(k => S.stands[k].tiers.length).map(k => [k, SIDE_NAMES[k]]));
const seatTextOf = () => (S.seatText = Object.assign({text:"", at:""}, S.seatText || {}));
$("seatText").addEventListener("input", e => { const T = seatTextOf(); T.text = cleanName(e.target.value).toUpperCase();
  const opts = seatTextStands(); if (!opts.some(o => o[0] === T.at) && opts.length) T.at = opts[0][0]; changed(false, true); });
$("seatTextAt").addEventListener("change", e => { seatTextOf().at = e.target.value; changed(); });
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
$("archAt").addEventListener("change", e => { archOf().archAt = e.target.value; changed(); });
function openState(st, sideTab, tweak){
  S = upgradeCorners(st); quiet = true; if (tweak) tweak(); tab = isHybrid() ? "B" : (sideTab || "N");
  setSeatColours(); renderTypeSizes(); renderEditor(); renderViews(); changed(true);
}
document.querySelectorAll("#presets button").forEach(b => b.addEventListener("click", () => {
  const P = clone(PRESETS[b.dataset.p]); openState(P, b.dataset.p === "monument" ? "E" : "N");
  toast(b.dataset.p === "blank" ? "<b>Blank pitch.</b> Open Stands, pick a side and press + Tier to start building." : `<b>${esc(b.firstChild.textContent.trim())}</b> loaded. Tap any stand to make it yours.`, UNDO);
}));

