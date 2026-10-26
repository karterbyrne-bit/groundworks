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
  look = on; if (!on && crowdClear) clearCrowdNear(null);
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
      let out = top*1.6 + 40;
      if (S.scenery !== "model"){ // stand in the street outside the ground, not among the houses round it
        const ex = D.ext[0] + 10, ez = D.ext[1] + 10, P = S.plot.on && S.plot.pts ? S.plot.pts : [[-ex,-ez],[ex,-ez],[ex,ez],[-ex,ez]], e = exitDist(P, b, u, 0);
        if (e > 0 && e < 1e3) out = Math.min(out, e + 7); }
      return {p:new THREE.Vector3(b[0] + u[0]*out, 3 + top*0.15, b[1] + u[1]*out), t:new THREE.Vector3(b[0], top*0.55, b[1])};
    }
    const p0 = live[live.length-1], n = nRows(p0), d = p0.front + (n - 1.5)*p0.T, q = [r.o[i][0] + r.v[i][0]*d, r.o[i][1] + r.v[i][1]*d];
    const p = new THREE.Vector3(q[0], p0.hs[n-2 >= 0 ? n-2 : 0] + 1.2, q[1]);
    const dir = new THREE.Vector3(-u[0], 0.55, -u[1]).normalize().multiplyScalar(0.5);
    return {p, t:p.clone().add(dir), look:true};
  }
  const R1 = Math.max(R0, D.maxH*0.9); // a small, tall ground needs the camera further out and higher, above the roof
  return {p:new THREE.Vector3(R1*1.3, Math.max(R1*0.95, D.maxH*1.5), R1*1.5), t:new THREE.Vector3(0, Math.min(6, R0*0.05), 0)};
}
function moveCam(p, t, instant){
  controls.minDistance = 0; controls.maxDistance = Infinity;
  if (instant || reduce){ camera.position.copy(p); controls.target.copy(t); applyLimits(); controls.update(); return; }
  anim = {p0:camera.position.clone(), t0:controls.target.clone(), p, t, start:performance.now()}; wake();
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
spinBtn.addEventListener("click", () => { controls.autoRotate = !controls.autoRotate; wake(); spinBtn.setAttribute("aria-pressed", String(controls.autoRotate)); });
/* orthographic / perspective */
function setOrtho(on){
  const from = camera, to = on ? ortho : persp; if (from === to) return;
  to.position.copy(from.position); to.up.copy(from.up);
  if (on){ const dist = from.position.distanceTo(controls.target), h = dist*Math.tan(persp.fov*Math.PI/360), a = view.clientWidth/Math.max(1, view.clientHeight);
    ortho.left = -h*a; ortho.right = h*a; ortho.top = h; ortho.bottom = -h; ortho.zoom = 1; ortho.updateProjectionMatrix(); }
  camera = to; controls.object = to; controls.update(); fogReach(); invalidate();
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
/* ================= kick-off flyover =================
   A 15-second swoop: from high outside the ground, round and in over the roof, then down to the touchline for kick-off,
   where it hands over to the Pitchside view. A tap or a key stops it where it is. Where the browser can record the view
   it can be saved as a short video to share. With reduced motion asked for, it's a slow fade between four views. */
let fly = null, touring = null;
const ease = f => f < .5 ? 2*f*f : 1 - Math.pow(-2*f + 2, 2)/2;
function flyPose(k){
  const D = LAST, R = Math.max(D.ext[0], D.ext[1]), H = Math.max(D.maxH, 12);
  if (k < .78){ const f = ease(k/.78), th = Math.PI/2 + .15 - (1 - f)*Math.PI*1.3, r = lerp(R*2.6, R*.7, f), y = lerp(R*1.2, H + 16, Math.pow(f, .8));
    return {p:new THREE.Vector3(Math.cos(th)*r, y, Math.sin(th)*r), t:new THREE.Vector3(0, lerp(12, 4, f), 0)}; }
  const a = flyPose(.7799), end = camTarget("pitch"), f = ease((k - .78)/.22); // the last stretch: over the roof and down to the touchline
  return {p:a.p.lerp(end.p, f), t:a.t.lerp(end.t.clone().add(end.t.clone().sub(end.p).multiplyScalar(60)), f)};
}
const canRecord = !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
function recordView(){
  const types = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"], type = types.find(t => MediaRecorder.isTypeSupported(t));
  const stream = renderer.domElement.captureStream(30), rec = new MediaRecorder(stream, type ? {mimeType:type, videoBitsPerSecond:8e6} : undefined), chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); if (!chunks.length) return;
    const blob = new Blob(chunks, {type: rec.mimeType || "video/webm"}), fname = "kick-off-flyover." + (/mp4/.test(blob.type) ? "mp4" : "webm"), file = new File([blob], fname, {type:blob.type});
    if (navigator.canShare && matchMedia("(pointer:coarse)").matches && navigator.canShare({files:[file]})){ try { await navigator.share({files:[file], title:"Kick-off at " + (sponsorsOf().title || "my stadium")}); return; } catch(e) { if (e && e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast("<b>Flyover saved as a video.</b> Look for it in your downloads."); };
  rec.start(500); return rec;
}
function kickoff(record){
  if (!LAST || fly || touring) return; closeMore(); if (camera !== persp) setOrtho(false);
  picking = false; view.classList.remove("picking"); setLook(false); controls.autoRotate = false; anim = null;
  const rec = record && canRecord ? recordView() : null;
  if (reduce) return fadeTour(rec);
  fly = {start: performance.now(), dur: 15000, rec}; wake();
}
/* With reduced motion: four views, faded through black, about four seconds each. */
function fadeTour(rec){
  const veil = document.getElementById("veil"), views = ["aerial", "side", "exterior", "pitch"]; let i = 0; touring = {rec};
  const next = () => { if (!touring) return; veil.classList.add("on");
    setTimeout(() => { if (!touring) return; goCam(views[i], true); veil.classList.remove("on"); i++;
      if (i < views.length) touring.t = setTimeout(next, 3200); else { touring.t = setTimeout(() => { if (touring && touring.rec) touring.rec.stop(); touring = null; }, 2400); } }, 900); };
  next();
}
function stopFlying(){
  if (fly){ const f = fly; fly = null; controls.update(); if (f.rec) f.rec.stop(); invalidate(); }
  if (touring){ clearTimeout(touring.t); if (touring.rec) touring.rec.stop(); touring = null; document.getElementById("veil").classList.remove("on"); }
}
addEventListener("pointerdown", e => { if ((fly || touring) && !e.target.closest("[data-fly]")) stopFlying(); }, true);
addEventListener("keydown", () => { if (fly || touring) stopFlying(); }, true);
document.querySelectorAll("[data-fly]").forEach(b => b.addEventListener("click", () => kickoff(b.dataset.fly === "record")));
document.querySelectorAll("[data-fly='record']").forEach(b => { b.hidden = !canRecord; });
renderer.domElement.addEventListener("pointerdown", e => {
  downAt = [e.clientX, e.clientY]; if (e.button !== 0) return;
  const h = handleHit(e);
  if (h){ const vl = Math.hypot(h.v[0], h.v[1]) || 1, n = new THREE.Vector3(-h.v[1]/vl, 0, h.v[0]/vl);
    drag = {type:"h", h, plane:new THREE.Plane().setFromNormalAndCoplanarPoint(n, new THREE.Vector3(h.x, h.y, h.z))};
    controls.enabled = false; try { renderer.domElement.setPointerCapture(e.pointerId); } catch(err) {} return; }
  const p = groundAt(e), ph = plotHandleNear(p) || siteHandleNear(p);
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
    if (h.kind === "dist") h.cfg.dist = clamp(r05(d), Math.max(1, hardStop()), 80);
    changed(false, true); return;
  }
  if (drag){
    const p = groundAt(e); if (!p) return;
    if (drag.type === "site"){ const f = S.site[drag.i]; if (!f) return;
      if (drag.end){ f.angle = Math.round(((Math.atan2(p.z - f.z, p.x - f.x)*180/Math.PI) + 360) % 180); f.length = Math.max(5, Math.round(2*Math.hypot(p.x - f.x, p.z - f.z))); }
      else { f.x = Math.round(p.x); f.z = Math.round(p.z); snapRoad(f); } // a road brought near the plot's edge runs along it
      changed(false, true); return; }
    const dx = p.x - drag.start[0], dz = p.z - drag.start[1], pts = clone(drag.pts);
    if (drag.type === "v"){ pts[drag.i] = [Math.round(drag.pts[drag.i][0] + dx), Math.round(drag.pts[drag.i][1] + dz)]; }
    else { const a = pts[drag.i], b = pts[(drag.i+1)%pts.length], l = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, n = [-(b[1]-a[1])/l, (b[0]-a[0])/l], s = dx*n[0] + dz*n[1];
      for (const q of [a, b]){ q[0] = Math.round(q[0] + n[0]*s); q[1] = Math.round(q[1] + n[1]*s); } }
    S.plot.pts = pts; changed(); return;
  }
  if (e.buttons) return;
  view.style.cursor = handleHit(e) || plotHandleNear(groundAt(e)) || siteHandleNear(groundAt(e)) ? "grab" : "";
});
renderer.domElement.addEventListener("pointerup", e => {
  if (drag){ const wasH = drag.type === "h"; drag = null; controls.enabled = true; if (wasH){ renderEditor(); } return; }
  if (!downAt || Math.hypot(e.clientX-downAt[0], e.clientY-downAt[1]) > 6) return;
  setNdc(e);
  if (picking){
    const hits = ray.intersectObjects(group.children.filter(m => m.userData.seat), false);
    if (!hits.length){ tipEl.innerHTML = "<b>That's not a seat.</b> Click on the coloured seating."; return; }
    const he = homeEndOf().at; seatView(hits[0].point, ["terrace","rail"].includes(hits[0].object.userData.kind) || (!!he && standAt(hits[0].point) === he));
    return;
  }
  if (look) return;
  const hits = ray.intersectObjects(group.children.filter(m => m.userData.stadium), false); if (!hits.length) return;
  const key = standAt(hits[0].point); if (key) selectTab(key, true);
});
/* The view from a spot in the stands, looking at the middle of the play. Fans stand on terraces and rail seats (and all
   through the home end), so their eyes are higher; the fans right round them are cleared so the view isn't a wall of heads. */
function seatView(h, standing, instant){
  const f = LAST.F.home || [0,0], p = new THREE.Vector3(h.x, h.y + (standing ? 1.65 : 1.2), h.z);
  const aim = new THREE.Vector3(f[0], focusY + 1, f[1]).sub(p).normalize().multiplyScalar(0.5);
  picking = false; view.classList.remove("picking"); setLook(true); clearCrowdNear([h.x, h.y + 1, h.z]); moveCam(p, p.clone().add(aim), instant); setTip();
}
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
    const name = key === "B" ? (isHybrid() ? "the lower bowl" : "the bowl") : key === "C" ? "the corners" : /^R/.test(key) ? tabName(key) : "the " + SIDE_NAMES[key].toLowerCase();
    tipOverride = `<b>Editing ${name}.</b> Drag the blue handles, or use the panel.`; setTip();
    showPane("stands");
    clearTimeout(selectTab.t); selectTab.t = setTimeout(() => { tipOverride = null; setTip(); }, 4500);
  }
}
/* Keep the orbiting camera out of solid structure but let it go anywhere above the seats, including under roofs. */
function constrain(){
  const D = LAST; if (!D || look || anim || fly) return;
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
  if (AO){ const pr = LIGHT ? 1 : renderer.getPixelRatio(); AO.gtao.setSize(Math.round(w*pr), Math.round(h*pr)); }
  if (camera === ortho){ const hh = (ortho.top - ortho.bottom)/2; ortho.left = -hh*w/h; ortho.right = hh*w/h; ortho.updateProjectionMatrix(); } }
new ResizeObserver(resize).observe(view);
/* The frame loop stops altogether once nothing has moved for half a second, so a stadium left on screen uses no power.
   Anything that changes the view (a touch, a key, a camera move or a rebuild) wakes it again. */
var awake = false, idle = 0, aoTimer = 0;
/* Where the camera was last drawn from: the controls can report a "change" every frame while held at a distance limit
   (as in the pitchside view) without the view moving at all, so only a real shift counts as a move. */
const lastCamP = new THREE.Vector3(), lastCamT = new THREE.Vector3();
/* A moment after the last ordinary frame, if nothing has moved since, draw it once more with ambient occlusion
   (perspective views only). A timer rather than counting frames, since some browsers stop sending frames once the
   picture stops changing. */
/* Finish any camera glide at once (for automated checks and screenshots, where frames come slowly). */
function settleNow(){
  if (anim){ camera.position.copy(anim.p); controls.target.copy(anim.t); anim = null; applyLimits(); }
  const d = controls.enableDamping; controls.enableDamping = false; controls.update(); controls.enableDamping = d; redraw();
}
function settleAO(){ clearTimeout(aoTimer); aoTimer = setTimeout(() => { if (AO && !AO.off && camera === persp && !anim && !controls.autoRotate) requestAnimationFrame(() => { if (!anim && !dirty){ drawAO(); idle = 31; } }); }, 300); } // the still frame is the last: sleep straight after it
/* Things that move on their own for a while (a Mexican wave). Each is called every frame until it returns false. */
var TICKERS = new Set(); // var: invalidate() can call wake() before this line has run
function wake(){ idle = 0; if (!awake){ awake = true; requestAnimationFrame(loop); } if (SPECTACLE && !SPECTACLE.ticking) spectacleWake(); }
function loop(now){
  if (fly){ const k = Math.min(1, (now - fly.start)/fly.dur), q = flyPose(k); // the kick-off flyover: the camera is flown, not orbited
    camera.position.copy(q.p); controls.target.copy(q.t); camera.lookAt(q.t); renderer.render(scene, camera); idle = 0;
    if (k >= 1){ const f = fly; fly = null; goCam("pitch", true); if (f.rec) f.rec.stop(); }
    requestAnimationFrame(loop); return; }
  if (anim){ const k = Math.min(1, (now - anim.start)/850), e = 1 - Math.pow(1-k, 3);
    camera.position.lerpVectors(anim.p0, anim.p, e); controls.target.lerpVectors(anim.t0, anim.t, e);
    if (k===1){ anim = null; applyLimits(); } }
  const moved = controls.update() && (camera.position.distanceToSquared(lastCamP) > 1e-6 || controls.target.distanceToSquared(lastCamT) > 1e-6); constrain();
  lastCamP.copy(camera.position); lastCamT.copy(controls.target);
  let ticked = false; for (const f of TICKERS){ ticked = true; if (!f(now)) TICKERS.delete(f); }
  if (moved || anim || ticked || dirty > 0){ renderer.render(scene, camera); if (dirty > 0) dirty--; idle = 0; settleAO(); }
  else idle++;
  if (idle > 30 && !controls.autoRotate && !document.hidden){ awake = false; return; }
  requestAnimationFrame(loop);
}
for (const ev of ["pointerdown", "pointermove", "wheel", "keydown", "touchstart"]) addEventListener(ev, wake, {passive:true, capture:true});
function applyTheme(fromMood){
  if (S && S.night && fromMood !== true){ applyMood(); return; }
  if (S && S.scenery !== "model"){ realScenery(false); invalidate(); return; }
  plainScenery();
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

