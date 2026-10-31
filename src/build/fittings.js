/* ================= floodlights and screens ================= */
const FLOODS = {none:"No floodlights", masts:"Corner masts", pylons:"Lattice pylons in the corners", roof:"Along the roof edges"};
/* Where the four floodlight masts (or pylons) stand: just behind the stands at each corner (the point of the stands'
   outline furthest out that way, then 8 m further out), or round a round ground, a third of the way round from each end.
   As [x, z, sx, sz], sx and sz saying which corner. */
function floodMastSpots(F, sext, outline){
  const roundish = F.r >= Math.min(F.W, F.H)/2 - 1, a = Math.PI/6, out = [];
  for (const sx of [-1,1]) for (const sz of [-1,1]){
    const d = roundish ? [sx*Math.cos(a), sz*Math.sin(a)] : [sx/(sext[0] || 1), sz/(sext[1] || 1)];
    let best = null, bv = -Infinity; for (const p of outline){ const v = p[0]*d[0] + p[1]*d[1]; if (v > bv){ bv = v; best = p; } }
    if (!best){ out.push([roundish ? sx*(sext[0] + 8)*Math.cos(a) : sx*(sext[0] + 8), roundish ? sz*(sext[1] + 8)*Math.sin(a) : sz*(sext[1] + 8), sx, sz]); continue; }
    const r = Math.hypot(best[0], best[1]) || 1, off = S.arch && S.arch.ramps ? 30 : 8; // beyond the spiral ramp at that corner, when there is one
    out.push([best[0] + best[0]/r*off, best[1] + best[1]/r*off, sx, sz]); }
  return out;
}
function floodMode(){ if (S.floodlights) return S.floodlights; if (!S.lights) return "none"; return S.arch && S.arch.pylons ? "pylons" : "masts"; }
const SCREEN_AT = {N:"Main stand", S:"Opposite stand", E:"East end", W:"West end", NE:"Main / East corner", SE:"East / Opposite corner", SW:"Opposite / West corner", NW:"West / Main corner", centre:"Hanging over the centre"};
const SCREEN_MOUNTS = {gap:"Between the back row and the roof", roof:"Hung from the roof's front edge", top:"On top of the roof or stand", back:"On legs behind the stand", ribbon:"LED ribbon along the tier fronts"};
/* The screens in use: the saved list, or (for older designs) the old east-end screen and the arena's centre-hung one. */
function screenList(closedAt){
  if (Array.isArray(S.screens)) return S.screens;
  const out = []; if (closedAt) out.push({at:"centre", mount:"gap", size:10, pos:0}); if (S.scoreboard) out.push({at:"E", mount:"back", size:20, pos:0}); return out;
}
const dirOf = at => { if (SIDE_DIR[at]) return SIDE_DIR[at]; const a = SIDE_DIR[at[0]], b = SIDE_DIR[at[1]], x = a[0]+b[0], z = a[1]+b[1], l = Math.hypot(x,z) || 1; return [x/l, z/l]; };
function planScreens(F, anchors, closedAt, outerTop, set, issue){
  const plans = [];
  screenList(closedAt).forEach((sc, idx) => {
    const w = Math.max(3, Math.min(60, sc.size || 16)), label = `Screen ${idx+1} (${(SCREEN_AT[sc.at] || "").toLowerCase()})`, key = "screen:" + idx;
    if (sc.at === "centre"){
      const sz = Math.min(w, Math.max(3, Math.min(F.W, F.H)*0.6)), y = closedAt ? Math.max(focusY + 8, closedAt - sz*0.6 - 2) : Math.max(focusY + 12, outerTop*0.75);
      plans.push({kind:"cube", x:0, y, z:0, w:sz, h:sz*0.56, cable: closedAt ? closedAt + 2 : null, idx});
      if (!closedAt) issue(`${label} hangs over the play with no closed roof to hang it from. It's drawn on cables, but a real one would need a roof or a gantry.`, key, "geo", {fix:null});
      return;
    }
    const dir = dirOf(sc.at), perp = [-dir[1], dir[0]], corner = sc.at.length === 2;
    let cands = [];
    for (const g of anchors) for (let i=0;i<g.m;i++){ if (!g.info[i]) continue;
      const vl = Math.hypot(g.v[i][0], g.v[i][1]) || 1, dot = (g.v[i][0]*dir[0] + g.v[i][1]*dir[1])/vl; if (dot < (corner ? 0.95 : 0.9)) continue;
      const fp = [g.o[i][0] + g.info[i].front*g.v[i][0], g.o[i][1] + g.info[i].front*g.v[i][1]];
      cands.push({g, i, lat: fp[0]*perp[0] + fp[1]*perp[1], own: g.key === sc.at}); }
    if (cands.some(c => c.own)) cands = cands.filter(c => c.own);
    if (!cands.length && sc.mount === "ribbon"){ issue(`${label}: there's no stand there to run an LED ribbon along, so it isn't drawn. Pick a stand, or another way to mount it.`, key, "geo", {fix:null}); return; }
    if (!cands.length){ // nothing built there: stand it on legs in the open
      const r = corner ? Math.hypot(F.W/2, F.H/2) + set + 8 : (dir[0] ? F.W/2 : F.H/2) + set + 6;
      const x = dir[0]*r + perp[0]*(sc.pos||0)/100*(dir[0] ? F.H/2 : F.W/2), z = dir[1]*r + perp[1]*(sc.pos||0)/100*(dir[0] ? F.H/2 : F.W/2);
      plans.push({kind:"board", x, y:6 + w*0.21, z, w, h:w*0.42, n:[-dir[0], -dir[1]], legs:6, idx});
      issue(`${label}: there's no stand there, so it stands on legs in the open.`, key, "geo", {fix:null}); return;
    }
    const lo = Math.min(...cands.map(c => c.lat)), hi = Math.max(...cands.map(c => c.lat)), target = (lo + hi)/2 + (sc.pos || 0)/100*(hi - lo)/2;
    const c = cands.reduce((a,b) => Math.abs(b.lat - target) < Math.abs(a.lat - target) ? b : a), g = c.g, i = c.i, x = g.info[i], R = g.RR ? g.RR[i] : null;
    const vl = Math.hypot(g.v[i][0], g.v[i][1]) || 1, n = [-g.v[i][0]/vl, -g.v[i][1]/vl];
    const P = d => [g.o[i][0] + d*g.v[i][0], g.o[i][1] + d*g.v[i][1]];
    const lay2 = layoutOf(), cfgRef = g.key[0] === "R" ? ringOf().stands[+g.key.slice(1)] : sc.at in S.stands && (lay2 === "stands" || lay2 === "hybrid") ? S.stands[sc.at] : (g.key === "B" ? S.bowl : null);
    const gRoof = S.groundRoof && S.groundRoof.on, roofRef = gRoof ? S.groundRoof : cfgRef && cfgRef.roof;
    let h = w*0.42, mount = sc.mount || "gap";
    if (mount === "ribbon"){ // aim the camera at the front of the tiers, halfway along
      const pr = (g.profs[i] || []).slice(g.drawFrom).filter(q => q && !q.ghost && nRows(q) >= 1), top = pr[pr.length - 1], f = pr.length ? pr[0].front : x.front;
      const q = P(f); plans.push({kind:"ribbon", g, idx, x:q[0], y: top && top.stacked ? top.hF : 3, z:q[1]}); return; }
    if ((mount === "gap" || mount === "roof") && !R){
      issue(`${label}: there's no roof over that part of the stand to hang it from, so it sits on top of the back row instead.`, key, "geo", {fix: cfgRef && !gRoof ? {label:"Give that stand a roof", run:() => { cfgRef.roof.shape = "slope"; return true; }} : null}); mount = "top"; }
    if (mount === "gap"){
      const d = x.back - 0.6, f = Math.max(0, Math.min(1, (d - R.inner)/Math.max(.1, R.outer - R.inner))), ceil = R.y(f) - 0.5, floorY = x.top + 0.2, avail = ceil - floorY;
      if (avail < h){
        const need = h - avail;
        if (avail < 2.5 || need > 0.5) issue(`${label} needs ${h.toFixed(1)} m between the back row and the roof but there's only ${Math.max(0, avail).toFixed(1)} m, so it's squashed. Raise that roof to fit it properly.`, key, "geo",
          {fix: roofRef ? {label:`Raise the roof ${need.toFixed(1)} m`, run:() => { roofRef.lift = (roofRef.lift || 0) + need + 0.2; return true; }} : null});
        h = Math.max(1.2, avail); }
      const p = P(d); plans.push({kind:"board", x:p[0], y:floorY + h/2, z:p[1], w, h, n, hang: ceil, idx});
    } else if (mount === "roof"){
      const d = R.inner + 1.2, top = R.y(0) - 0.6, bottom = top - h, below = heightAt(x.prof, d) + 2.6;
      if (bottom < below) issue(`${label} hangs down into the fans below the roof edge. Raise the roof or use a smaller screen.`, key, "geo",
        {fix: roofRef ? {label:`Raise the roof ${(below - bottom).toFixed(1)} m`, run:() => { roofRef.lift = (roofRef.lift || 0) + (below - bottom) + 0.2; return true; }} : null});
      const p = P(d); plans.push({kind:"board", x:p[0], y:top - h/2, z:p[1], w, h, n, hang: top + 0.6, idx});
    } else if (mount === "top"){
      const d = R ? (R.inner + R.outer)/2 : x.back - 1, base = (R ? Math.max(R.y(0), R.y(1)) : x.top) + 1, p = P(d);
      plans.push({kind:"board", x:p[0], y:base + 1.5 + h/2, z:p[1], w, h, n, legs: base, idx});
    } else {
      const d = (R ? R.outer : x.back) + 3, base = (R ? Math.max(R.y(0), R.y(1)) : x.top) + 2, p = P(d);
      plans.push({kind:"board", x:p[0], y:base + h/2, z:p[1], w, h, n, legs:0, legTop: base, idx});
    }
  });
  return plans;
}
const boardTex = {};
function scoreboardTexture(){
  const k = S.seat + S.sport; if (boardTex[k]) return boardTex[k];
  const c = document.createElement("canvas"); c.width = 512; c.height = 216; const g = c.getContext("2d");
  g.fillStyle = "#06090d"; g.fillRect(0,0,512,216); g.fillStyle = S.seat; g.fillRect(0,0,512,26); g.fillRect(0,190,512,26);
  g.fillStyle = "#ffffff"; g.font = "bold 18px sans-serif"; g.textAlign = "center"; g.fillText("GROUNDWORKS", 256, 20);
  g.font = "bold 74px sans-serif"; g.fillText("2 – 1", 256, 128);
  g.font = "bold 30px sans-serif"; g.fillText("HOME", 96, 120); g.fillText("AWAY", 416, 120);
  g.fillStyle = "#ffd65a"; g.font = "bold 26px monospace"; g.fillText("63:12", 256, 172);
  const t = canvasTex(c); t.keep = true; return (boardTex[k] = t);
}
/* ================= sponsors =================
   Advertising boards round the pitch and LED ribbons along the tier fronts show the sponsors' names, each on a panel in
   its own colours, glowing a little (more at night). The stadium can carry a sponsor's name too (naming rights). */
const boardSetOf = () => Object.assign({end:5, side:4, height:0.9}, S.boardSet || {}); // how far the pitch-side boards sit from the play, and how tall
const DEFAULT_SPONSORS = ["GROUNDWORKS", "KESTREL BANK", "NORTHLINE RAIL", "BLUEPEAK", "ORBIT FM", "HARBOUR ALES"];
const sponsorsOf = () => Object.assign({names:DEFAULT_SPONSORS.slice(), title:"", titleColour:"#ffffff", onStand:true}, S.sponsors || {});
const AD_PANEL = 7, AD_COLOURS = [["#0b2a5b","#ffffff"],["#ffd23f","#111111"],["#c8102e","#ffffff"],["#111111","#7cf0c8"],["#f4f4f0","#0b2a5b"],["#1f7a3a","#ffffff"],["#5a2ca0","#ffd23f"],["#ff6a13","#ffffff"]];
const adMats = {}, ADS_USED = new Set();
function adMaterial(){
  const names = sponsorsOf().names.map(n => String(n).trim().toUpperCase().slice(0, 24)).filter(Boolean).slice(0, 8), list = names.length ? names : ["YOUR AD HERE"];
  const key = list.join("|"); ADS_USED.add(key); if (adMats[key]) return adMats[key];
  const font = "800 54px 'Big Shoulders Display', 'Arial Narrow', sans-serif", W = 512, H = 72, c = document.createElement("canvas"), g = c.getContext("2d");
  c.width = W*list.length; c.height = H;
  list.forEach((name, i) => { let h = 0; for (const ch of name) h = (h*31 + ch.charCodeAt(0)) >>> 0; const [bg, fg] = AD_COLOURS[(h + i) % AD_COLOURS.length];
    g.fillStyle = bg; g.fillRect(i*W, 0, W, H); g.fillStyle = fg; g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
    const tw = g.measureText(name).width, s2 = Math.min(1, (W - 40)/tw); g.save(); g.translate(i*W + W/2, H/2 + 2); g.scale(s2, 1); g.fillText(name, 0, 0); g.restore(); });
  const cache = !document.fonts || document.fonts.check(font), t = canvasTex(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(1/(AD_PANEL*list.length), 1); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.keep = cache;
  const m = new THREE.MeshStandardMaterial({map:t, emissive:0xffffff, emissiveMap:t, roughness:.45, side:THREE.FrontSide}); m.keep = cache;
  if (cache) adMats[key] = m;
  return m;
}
/* One run of adverts: quads {a, b, h, view} in order along the run, where view is a point the readers are looking from,
   so the names read the right way round from there. */
/* Banners hung over the tier fronts in the home end: long cloth panels in the club's two colours, carrying the fans' own
   words (or the home end's name), read from across the ground. */
function bannerMaterial(){
  const HE = homeEndOf(), texts = String(HE.texts || "").split(",").map(t => t.trim().toUpperCase().slice(0, 24)).filter(Boolean);
  const list = texts.length ? texts : [HE.name || "HOME END", (sponsorsOf().title || "OUR GROUND").toUpperCase(), "TOGETHER", "SINCE 1888"];
  const key = "B|" + list.join("|") + S.seat + S.seat2; ADS_USED.add(key); if (adMats[key]) return adMats[key];
  const font = "800 54px 'Big Shoulders Display', 'Arial Narrow', sans-serif", W = 640, H = 120, c = document.createElement("canvas"), g = c.getContext("2d");
  c.width = W*list.length; c.height = H;
  const a = S.seat, b = S.seat2 || "#f2f2f2";
  list.forEach((t, i) => { const bg = i % 2 ? b : a, fg = i % 2 ? a : b; g.fillStyle = bg; g.fillRect(i*W, 0, W, H); g.fillStyle = fg; g.fillRect(i*W, 8, W, 6); g.fillRect(i*W, H - 14, W, 6);
    g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; const tw = g.measureText(t).width, sx = Math.min(1, (W - 50)/tw);
    g.save(); g.translate(i*W + W/2, H/2 + 2); g.scale(sx, 1); g.fillText(t, 0, 0); g.restore(); });
  const cache = !document.fonts || document.fonts.check(font), t = canvasTex(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(1/(9*list.length), 1); t.keep = cache;
  const m = new THREE.MeshStandardMaterial({map:t, roughness:.9, side:THREE.FrontSide}); m.keep = cache; if (cache) adMats[key] = m; return m;
}
function adStrip(quads, matIn){
  const pos = [], uv = []; let acc = 0;
  for (const q of quads){
    const dx = q.b[0] - q.a[0], dz = q.b[2] - q.a[2], len = Math.hypot(dx, dz); if (len < 1e-3) continue;
    const vx = q.view[0] - (q.a[0] + q.b[0])/2, vz = q.view[1] - (q.a[2] + q.b[2])/2, sg = dx*vz - dz*vx >= 0 ? 1 : -1; // left to right for the reader
    const u0 = acc*sg, u1 = (acc + len)*sg; acc += len;
    const A = q.a, B = q.b, C = [B[0], B[1] + q.h, B[2]], D = [A[0], A[1] + q.h, A[2]];
    // wind each face towards its readers, so it can be drawn one-sided and never shows mirrored or fights the board's back
    const nx = -(dz), nz = dx, toward = nx*vx + nz*vz > 0;
    if (toward){ pos.push(...A, ...B, ...C, ...A, ...C, ...D); uv.push(u0,0, u1,0, u1,1, u0,0, u1,1, u0,1); }
    else { pos.push(...A, ...C, ...B, ...A, ...D, ...C); uv.push(u0,0, u1,1, u1,0, u0,0, u0,1, u1,1); }
  }
  if (!pos.length) return;
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  const mat = matIn || adMaterial(); if (!matIn) mat.emissiveIntensity = S.night ? 1.1 : .4;
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.userData.stadium = true; mesh.userData.ads = true; group.add(mesh);
}
/* ================= players' tunnel and dugouts =================
   The tunnel comes out of the front of a stand: its front rows are taken out, leaving a walled pit with the dark tunnel
   mouth at the back, and an optional extending tunnel reaching onto the pitch. Dugouts sit either side of halfway:
   perspex shelters by the touchline, sunk into the front rows, or simply padded seats in the front rows. */
const TUNNEL = {on:false, at:"N", pos:0, width:4, extend:true, colour:""};
const DUGOUTS = {on:false, at:"N", style:"bubble", length:10, gap:5, colour:""};
const DUGOUT_STYLES = {bubble:"Perspex shelters by the touchline", sunk:"Sunk into the front of the stand", seats:"Padded seats in the front rows"};
const tunnelOf = () => Object.assign({}, TUNNEL, S.tunnel || {});
const dugoutsOf = () => Object.assign({}, DUGOUTS, S.dugouts || {});
/* Emergency vehicle access: a way onto the pitch for an ambulance or fire engine, through a stand (its lower rows taken
   out for a 4.5 m high opening) at any point along it. */
const VEHICLE = {on:false, at:"W", pos:22, width:4.5}; // towards a corner, clear of the goal
const vehicleOf = () => Object.assign({}, VEHICLE, S.vehicle || {});
/* Wheelchair spaces: level platforms, each space with a companion seat beside it, spread round every stand. */
const ACCESS = {on:false, at:"back", per:2, length:9, arrange:"spread"};
const ACCESS_AT = {front:"Front of the lower tier", middle:"Middle of the lower tier, by an entrance", back:"Back of the lower tier", upper:"Front of the top tier",
  upperBack:"Back of the top tier", spread:"Spread over several levels (lower tier front and back, top tier front)"};
const ACCESS_ARRANGE = {spread:"Spread evenly along the stand", middle:"Grouped together in the middle", ends:"Towards each end", left:"Grouped at the left-hand end", right:"Grouped at the right-hand end"};
/* A stand's own wheelchair platforms: anything it doesn't set comes from the ground-wide settings. */
const standAccessOf = cfg => { const A = accessOf(), own = (cfg && cfg.access) || {}, n = own.count != null ? own.count : cfg && cfg.accessCount != null ? cfg.accessCount : A.per;
  return Object.assign({}, A, {per: Math.max(0, Math.round(n))}, own.at ? {at:own.at} : {}, own.length ? {length:own.length} : {}, own.arrange ? {arrange:own.arrange} : {}); };
const accessOf = () => Object.assign({}, ACCESS, S.access || {});
/* How many wheelchair spaces guidance asks for, by capacity (after the UK Accessible Stadia guide's table for new grounds). */
const wheelchairNeed = cap => cap <= 0 ? 0 : cap < 10000 ? Math.max(6, Math.ceil(cap/100)) : cap < 20000 ? 100 + Math.ceil((cap - 10000)*5/1000)
  : cap < 40000 ? 150 + Math.ceil((cap - 20000)*3/1000) : 210 + Math.ceil((cap - 40000)*2/1000);
/* How good a stand's facilities are: toilets, food and drink, concourse space and hospitality. */
const FACILITIES = {basic:"Basic: toilets and a tea bar", good:"Good: wide concourses, plenty of food, drink and toilets", premium:"Premium: lounges, restaurants and padded seats"};
const facilitiesOf = cfg => FACILITIES[cfg && cfg.facilities] ? cfg.facilities : "good";
/* How fans get into a tier's seats: from the middle (exit tunnels, or vomitories, partway up), from the back, or from the
   front. Auto keeps the old behaviour: a deep tier at ground level from the middle, everything else from the back. */
const ENTRY = {auto:"Automatic", middle:"From the middle (exit tunnels partway up)", back:"From the back", front:"From the front"};
const hasDugouts = () => S.sport === "football" || S.sport === "rugby" || (S.sport === "custom" && ["wrestleball", "plain"].includes(S.custom.kind));
/* One screen-face material per seat colour, kept between rebuilds rather than made afresh every change. */
const faceMats = {};
function screenFace(){
  const k = S.seat + S.sport, m = faceMats[k] || (faceMats[k] = new THREE.MeshStandardMaterial({map:scoreboardTexture(), emissive:0xffffff, emissiveMap:scoreboardTexture(), roughness:.4}));
  m.keep = true; m.emissiveIntensity = S.night ? 1 : .55; return m;
}
function drawScreens(plans, bf, anchors){
  if (!plans.length) return;
  const face = screenFace();
  for (const p of plans){
    if (p.kind === "ribbon"){ // LED boards along every tier front of that stand
      const g = p.g, rows = {}; // the sponsors' adverts run along each tier front, read from across the ground
      for (let i=0;i<g.m - (g.closed ? 0 : 1);i++){ const j = (i+1)%g.m, A0 = g.profs[i], B0 = g.profs[j];
        for (let k=g.drawFrom;k<Math.min(A0.length, B0.length);k++){ const a = A0[k], c = B0[k]; if (!a || !c || a.ghost || c.ghost || nRows(a) < 1 || nRows(c) < 1) continue;
          const ya = a.stacked ? a.hF - 1.4 : 0.15, yc = c.stacked ? c.hF - 1.4 : 0.15, hh = a.stacked ? 1.1 : 0.85;
          const pa = [g.o[i][0] + (a.front - .06)*g.v[i][0], g.o[i][1] + (a.front - .06)*g.v[i][1]], pc = [g.o[j][0] + (c.front - .06)*g.v[j][0], g.o[j][1] + (c.front - .06)*g.v[j][1]];
          (rows[k] = rows[k] || []).push({a:[pa[0],ya,pa[1]], b:[pc[0],yc,pc[1]], h:hh, view:[0, 0]}); } }
      for (const k in rows) adStrip(rows[k]);
      continue; }
    if (p.kind === "cube"){
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.w*0.8), [face, face, M.screen, M.screen, face, face]); m.position.set(p.x, p.y, p.z); m.userData.stadium = true; group.add(m);
      const top = p.cable || p.y + 30; for (const [sx,sz] of [[1,1],[-1,1],[1,-1],[-1,-1]]){ const x = sx*p.w*0.35, z = sz*p.w*0.3;
        quad(bf("cable"), [x-.05, p.y + p.h/2, z], [x+.05, p.y + p.h/2, z], [x+.05, top, z], [x-.05, top, z]); }
      continue; }
    const m = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, 0.6), [M.screen, M.screen, M.screen, M.screen, face, M.screen]);
    m.position.set(p.x, p.y, p.z); m.lookAt(p.x + p.n[0], p.y, p.z + p.n[1]); m.castShadow = true; m.userData.stadium = true; group.add(m);
    const tg = [-p.n[1], p.n[0]], ends = [-p.w*0.35, p.w*0.35].map(s2 => [p.x + tg[0]*s2 - p.n[0]*.5, p.z + tg[1]*s2 - p.n[1]*.5]);
    if (p.hang != null && p.hang > p.y + p.h/2) for (const e of ends) post(bf("steel"), e[0], e[1], p.y + p.h/2, p.hang, .15);
    if (p.legs != null) for (const e of ends) post(bf("steel"), e[0], e[1], p.legs, p.legTop != null ? p.legTop : p.y - p.h/2, .6);
  }
}
/* What's behind and under a stand that has no building: a banked terrace's grassy earth bank sloping away from the
   back row to the ground, or a temporary stand's bare scaffold of steel tubes (an upright under every other row every
   2.5 m along, with rails and cross-braces along the back). */
function standUnder(buf, V, i, j1, p0, p1, bk0, bk1, t0, t1, base, kind, u0, u1, grow){
  if (kind === "bank"){ const r0 = bk0 + 1 + t0*1.7, r1 = bk1 + 1 + t1*1.7, g0 = V(i, r0, 0), g1 = V(j1, r1, 0);
    quad(buf("bank"), V(i, bk0, t0 + .2), V(j1, bk1, t1 + .2), V(j1, r1, base(j1, r1)), V(i, r0, base(i, r0)));
    grow(g0[0], g0[2]); grow(g1[0], g1[2]); return; }
  const sb = buf("steel");
  if (Math.floor(u0/2.5) !== Math.floor(u1/2.5)) for (let j=0;j<p0.hs.length;j+=2){ const d = p0.front + (j + .5)*p0.T; bar(sb, V(i, d, base(i, d)), V(i, d, p0.hs[j]), .1); }
  for (const f of [.33, .66]) bar(sb, V(i, bk0, t0*f), V(j1, bk1, t1*f), .08); // rails along the back
  bar(sb, V(i, bk0, base(i, bk0)), V(j1, bk1, Math.min(t0, t1)*.9), .07); bar(sb, V(i, bk0, t0 + 1.1), V(j1, bk1, t1 + 1.1), .07); // a brace, and the guard rail along the top
}
