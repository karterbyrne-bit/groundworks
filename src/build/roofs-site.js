/* Floodlights fixed to the leading edge of each roof (or on short poles along the top of open stands). */
function roofLights(anchors, bf, F){
  const lamps = [];
  /* Lights belong on the roofs. Only a ground with no roof anywhere gets them on short poles along the back of the stands;
     otherwise a stretch without its own roof (a lower bowl under stands, an open end) simply has none. */
  const anyRoof = anchors.some(g => g.RR && g.RR.some(Boolean));
  for (const g of anchors){
    let acc = 0, prev = null, last = null;
    for (let i=0;i<g.m;i++){ const x = g.info[i], R = x && g.RR ? g.RR[i] : null; if (!x || (anyRoof && !R)) { last = null; continue; }
      const d = R ? R.inner + 0.5 : x.back - 0.4, y = R ? R.y(0) - 0.8 : x.top + 3, p = [g.o[i][0] + d*g.v[i][0], y, g.o[i][1] + d*g.v[i][1]];
      if (last) quad(bf("steel"), [last[0], last[1] + .5, last[2]], [p[0], p[1] + .5, p[2]], [p[0], p[1] + .9, p[2]], [last[0], last[1] + .9, last[2]]);
      if (prev) acc += Math.hypot(p[0]-prev[0], p[2]-prev[2]); prev = p; last = p;
      if (acc >= 6 || lamps.length === 0){ acc = 0; post(bf("lamp"), p[0], p[2], p[1] - .2, p[1] + .5, 1.3); lamps.push(p); if (!R) post(bf("steel"), p[0], p[2], x.top + .2, p[1] - .2, .15); } } }
  if (S.night && lamps.length){ const used = new Set();
    for (const d of [[0,-1],[0,1],[1,0],[-1,0]]){ let best = null, bd = -Infinity;
      for (const p of lamps){ const l = Math.hypot(p[0], p[2]) || 1, sc = (p[0]*d[0] + p[2]*d[1])/l; if (sc > bd){ bd = sc; best = p; } }
      if (!best || used.has(best) || bd < 0.5) continue; used.add(best);
      const sp = new THREE.SpotLight(0xfff4dc, 1.1, 0, 1.0, 0.6, 1); sp.position.set(best[0], best[1], best[2]); sp.target.position.set(-best[0]*0.2, 0, -best[2]*0.2); group.add(sp); group.add(sp.target); } }
}
/* The surroundings: roads, rivers, canals, railways, terraced houses and buildings, at real sizes, each with a yellow post
   in the middle (drag to move it) and one at its end (drag to turn and stretch it). */
function drawSite(features, bf, ext){
  const brick = textured("clad_historic", "brick"), conc = textured("concrete", "concrete");
  for (const f of features){
    const a = (f.angle || 0)*Math.PI/180, u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]], L = f.length/2, W = f.width/2;
    const P = (s, t, y) => [f.x + u[0]*s + n[0]*t, y, f.z + u[1]*s + n[1]*t];
    const slab = (key, s0, s1, t0, t1, y) => quad(bf(key), P(s0,t0,y), P(s1,t0,y), P(s1,t1,y), P(s0,t1,y));
    const side = (key, s0, s1, t, y0, y1) => quad(bf(key), P(s0,t,y0), P(s1,t,y0), P(s1,t,y1), P(s0,t,y1));
    const end = (key, s, t0, t1, y0, y1) => quad(bf(key), P(s,t0,y0), P(s,t1,y0), P(s,t1,y1), P(s,t0,y1));
    if (f.kind === "road"){ const pv = Math.min(3, W*0.25);
      slab("pavement", -L, L, -W, W, .03); slab("road", -L, L, -W + pv, W - pv, .05);
      for (const t of [-W + pv, W - pv]) side("concrete", -L, L, t, .03, .17);
      for (let s0=-L; s0<L-4; s0+=9) slab("white", s0, s0 + 4.5, -.08, .08, .06); }
    else if (f.kind === "river" || f.kind === "canal"){ // water at ground level between walls: stone copings on a canal, embankment walls on a river
      const tow = f.kind === "canal" ? Math.min(3.5, W*0.3) : 0, ww = W - tow, wallH = f.kind === "canal" ? .35 : .9;
      slab("water", -L, L, -ww, ww, .02);
      for (const t of [-ww, ww]){ side(f.kind === "canal" ? "trim" : "concrete", -L, L, t, 0, wallH); side(f.kind === "canal" ? "trim" : "concrete", -L, L, t + Math.sign(t)*.5, 0, wallH);
        quad(bf(f.kind === "canal" ? "trim" : "concrete"), P(-L,t,wallH), P(L,t,wallH), P(L,t + Math.sign(t)*.5,wallH), P(-L,t + Math.sign(t)*.5,wallH)); }
      if (tow) for (const sg of [-1, 1]) slab("pavement", -L, L, sg*(ww + .5), sg*W, .05); }
    else if (f.kind === "rail"){
      slab("ballast", -L, L, -W, W, .08);
      for (const tc of [-W*0.3, W*0.3]){
        for (let s0=-L; s0<L; s0+=.8) slab("dark", s0, s0 + .26, tc - 1.3, tc + 1.3, .14);
        for (const r of [-.72, .72]) bar(bf("steel"), P(-L, tc + r, .24), P(L, tc + r, .24), .1); }
      for (const t of [-W, W]) side("cable", -L, L, t, .08, 1.8); }
    else if (f.kind === "houses"){ const eave = Math.max(4, (f.height || 9) - 3), ridge = f.height || 9, nU = Math.max(1, Math.round(f.length/5)), uw = f.length/nU;
      for (const t of [-W, W]) side(brick, -L, L, t, 0, eave);
      for (const s2 of [-L, L]){ end(brick, s2, -W, W, 0, eave); tri(bf(brick), P(s2,-W,eave), P(s2,W,eave), P(s2,0,ridge)); }
      for (const sg of [-1, 1]) quad(bf("slate"), P(-L,sg*(W+.3),eave-.2), P(L,sg*(W+.3),eave-.2), P(L,0,ridge), P(-L,0,ridge));
      for (let k=0;k<nU;k++){ const s0 = -L + k*uw, c = s0 + uw/2;
        for (const sg of [-1, 1]){ const t = sg*(W + .05);
          side("window", c - 1.8, c - .6, t, 3.6, 4.9); side("window", c + .2, c + 1.6, t, 3.6, 4.9); side("window", c + .2, c + 1.6, t, 1, 2.3);
          side(sg < 0 ? "gate" : "window", c - 1.8, c - .8, t, 0, 2.2); }
        if (k % 2 === 0){ const q = P(s0 + uw, 0, 0); post(bf(brick), q[0], q[2], ridge - .5, ridge + 1.3, .9); } } } // a chimney stack every other house
    else if (f.kind === "building"){ const H = f.height || 20, floors = Math.max(1, Math.floor(H/3.5));
      for (const t of [-W, W]) side(conc, -L, L, t, 0, H);
      for (const s2 of [-L, L]) end(conc, s2, -W, W, 0, H);
      slab("roofSolid", -L, L, -W, W, H); for (const t of [-W, W]) side("concrete", -L, L, t, H, H + 1);
      for (let fl=0;fl<floors;fl++){ const y0 = 1 + fl*3.5;
        for (const t of [-W - .05, W + .05]) side("window", -L + .8, L - .8, t, y0, y0 + 1.8);
        for (const s2 of [-L - .05, L + .05]) end("window", s2, -W + .8, W - .8, y0, y0 + 1.8); } }
    // posts for dragging it about
    const c = P(0, 0, 0), e = P(L, 0, 0); post(bf("barrier"), c[0], c[2], 0, 3, 1.4); post(bf("barrier"), e[0], e[2], 0, 2.2, 1);
    for (const q of featurePoly(f, 0)){ ext[0] = Math.max(ext[0], Math.abs(q[0])); ext[1] = Math.max(ext[1], Math.abs(q[1])); }
  }
}
/* One bay of an open box truss resting on a roof's front edge, from slice i to slice j: top and bottom chords on two faces
   (at the edge and 2 m back), a diagonal and an upright in each face, and ties across the top. at(k, off) gives the point
   on the roof surface off metres back from the edge at slice k. */
function latticeAlong(sb, i, j, at){
  const H = 3.2, up = (p, y) => [p[0], p[1] + y, p[2]];
  for (const off of [-.2, 1.8]){ const p = at(i, off)[0], q = at(j, off)[0];
    bar(sb, p, q, .28); bar(sb, up(p, H), up(q, H), .28);
    bar(sb, (i + j) % 2 ? up(p, H) : p, (i + j) % 2 ? q : up(q, H), .16); bar(sb, p, up(p, H), .14); }
  bar(sb, up(at(i, -.2)[0], H), up(at(i, 1.8)[0], H), .14); bar(sb, at(i, -.2)[0], up(at(i, 1.8)[0], H), .12);
}
/* A floodlight head: a frame of separate lamps angled down at the play, with a service platform behind. */
const lampGeo = new THREE.BoxGeometry(1.25, 1.05, .5), lampRim = new THREE.BoxGeometry(1.45, 1.25, .35); lampGeo.keep = lampRim.keep = true;
function lampHead(x, y, z){
  const g = new THREE.Group(); g.position.set(x, y, z);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(12, 7.6, .35), M.column); g.add(frame);
  for (let r=0;r<4;r++) for (let c=0;c<6;c++){ const px = -4.6 + c*1.84, py = -2.6 + r*1.75;
    const rim = new THREE.Mesh(lampRim, M.dark); rim.position.set(px, py, .3); g.add(rim);
    const l = new THREE.Mesh(lampGeo, M.lamp); l.position.set(px, py, .42); g.add(l); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12.4, .2, 2), M.steel); deck.position.set(0, -4.2, -.9); g.add(deck);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(12.4, .08, .08), M.steel); rail.position.set(0, -3.2, -1.85); g.add(rail);
  g.lookAt(0, 0, 0); g.traverse(o => { o.castShadow = true; o.userData.stadium = true; });
  return g;
}
function maxFocusIn(F){ return Math.min(10, Math.max(Math.min(F.W, F.H)/2, Math.max(F.W, F.H)/4)); }
function defaultFocusIn(F){ return F.custom ? Math.min(4, Math.min(F.W, F.H)*0.3) : 0; }
/* Shown set up for its second sport? Then the second sport's field, and the outline the lower tier has to clear. */
function convertView(){
  const C = Object.assign({}, CONVERT, S.convert || {}); if (!C.on || C.show !== "second" || C.to === S.sport || !CONVERT_TO[C.to]) return null;
  const F2 = field(C.to), clear = F2.custom ? (KINDS[C.to].set || 2) : C.to === "football" ? Math.max(1.5, S.runoff == null ? 3 : S.runoff) : 1.5;
  return {F2, sp:C.to, how:C.how, pull:C.pull !== false, poly2:closedPathS(F2, F2.r || 0, clear, "curved")};
}
/* Roof sheeting: drawn with its own texture coordinates (metres along the stand, and across the roof from front to back)
   so the ribs of the sheets run the right way on every stand. */
let SHEETS = {};
const ROOF_TEX = {roof:"roofPoly", roofSolid:"roofMetal", roofGreen:"roofTin", roofGlass:"roofGlass", roofConcrete:"concrete"};
function sheet(key, A, B, C, D, uA, uB, vA, vB){
  const sh = SHEETS[key] || (SHEETS[key] = {pos:[], uv:[]});
  sh.pos.push(...A, ...B, ...C, ...A, ...C, ...D); sh.uv.push(uA,vA, uB,vA, uB,vB, uA,vA, uB,vB, uA,vB);
}
function drawSheets(){
  for (const key in SHEETS){ const sh = SHEETS[key]; if (!sh.pos.length) continue;
    const k2 = textured(key, ROOF_TEX[key]), base = M[key], mat = M[k2];
    if (mat.opacity !== base.opacity || mat.transparent !== base.transparent || mat.depthWrite !== base.depthWrite){ // keep see-through roofs in step
      mat.opacity = base.opacity; mat.transparent = base.transparent; mat.depthWrite = base.depthWrite; mat.needsUpdate = true; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(sh.pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(sh.uv, 2)); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = !["roof", "roofGlass"].includes(key); mesh.receiveShadow = true; mesh.userData.stadium = true; group.add(mesh); }
  SHEETS = {};
}
