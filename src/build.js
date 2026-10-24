/* ================= build ================= */
let LAST = null, LAST_REGIONS = [], tab = "N";
/* Tiers for a corner at fraction f between its two stands (or its own custom tiers), then filtered to the tiers the corner connects. */
function cornerTiers(c, f){
  const cc = S.corners[c.key];
  let out;
  if (cc.mode === "custom") out = S.cornerCustom.map(x => Object.assign({}, x));
  else {
    const A = S.stands[c.a].tiers, B = S.stands[c.b].tiers; out = [];
    for (let k=0;k<4;k++){
      const a = A[k], b = B[k]; if (!a && !b) break;
      const type = a && b && a.type !== b.type ? (a.type === "terrace" ? b.type : a.type) : (a || b).type, T = S.types[type].row; // mixed corners take the seated type
      const dA = a ? a.rows*S.types[a.type].row : 0, dB = b ? b.rows*S.types[b.type].row : 0;
      const L = (x, def) => { const va = a && a[x] != null ? a[x] : (b && b[x] != null ? b[x] : def), vb = b && b[x] != null ? b[x] : va; return va*(1-f) + vb*f; };
      out.push({type, rows:(dA*(1-f) + dB*f)/T, rake:L("rake",22), over:L("over",0), gap:L("gap",3), auto: !!((a && a.auto) || (b && b.auto)), pillars:false});
    }
  }
  if (cc.tiers === "lower") out = out.slice(0, 1);
  else if (cc.tiers === "upper" && out.length > 1) out[0] = Object.assign({}, out[0], {ghost:true});
  return out;
}
const fmt = n => Math.round(n).toLocaleString("en-GB");
const lerp = (a,b,f) => a + (b-a)*f;

/* Two-tone seat patterns: bands of rows, or a scattered mosaic like many modern grounds. */
function altRow(i, j, k){
  const p = S.seatPattern || "solid"; if (p === "solid") return false;
  if (p === "bands") return Math.floor(j/5) % 2 === 1;
  if (p === "tiers") return k % 2 === 1;
  const h = Math.sin(i*12.9898 + j*78.233 + k*37.719)*43758.5453; return (h - Math.floor(h)) < 0.28;
}
/* A crowd: one small figure per seat (sampled on very big grounds), in club colours with a few gaps. */
function addCrowd(recs){
  const totalP = recs.reduce((a,r) => a + (r.seats || 0), 0); if (totalP < 1) return;
  const cap = 45000, step = Math.max(1, totalP/cap), widen = Math.min(1.8, Math.sqrt(step));
  const n0 = Math.min(cap + 2000, Math.ceil(totalP/step) + recs.length);
  const geo = new THREE.BoxGeometry(0.42, 1, 0.3);
  const mat = new THREE.MeshStandardMaterial({roughness:.85});
  const mesh = new THREE.InstancedMesh(geo, mat, n0);
  const club = new THREE.Color(S.seat), pal = [club, club, club, club, club.clone().multiplyScalar(0.7), new THREE.Color(0xf4f4f0), new THREE.Color(0xf4f4f0), new THREE.Color(0x22262b), new THREE.Color(0x2d3a4f), new THREE.Color(0x8a6a4a), new THREE.Color(0xd8c9a8)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0,1,0);
  let c = 0, carry = 0, seed = 1;
  const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  for (const r of recs){
    const want = (r.seats || 0)/step + carry, n = Math.floor(want); carry = want - n; if (n < 1) continue;
    const dx = r.m1[0]-r.m0[0], dz = r.m1[1]-r.m0[1]; q.setFromAxisAngle(up, Math.atan2(-dz, dx));
    const stand = r.type === "terrace" || r.type === "rail", fill = r.type === "exec" ? 0.7 : 0.93, hgt = stand ? 1.6 : 0.85;
    for (let k=0;k<n && c<n0;k++){
      if (rnd() > fill) continue;
      const f = (k + 0.5 + (rnd()-0.5)*0.3)/n;
      pos.set(r.m0[0] + dx*f, lerp(r.h0, r.h1, f) + (stand ? 0.8 : 0.42 + hgt/2) + (rnd()-0.5)*0.08, r.m0[1] + dz*f);
      sc.set(widen, hgt*(0.92 + rnd()*0.16), 1); m4.compose(pos, q, sc); mesh.setMatrixAt(c, m4);
      mesh.setColorAt(c, pal[Math.floor(rnd()*pal.length)]); c++;
    }
  }
  mesh.count = c; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData.crowd = true; group.add(mesh);
}
/* Day or night, and whether roofs can be seen through. */
function applyMood(){
  const night = !!S.night;
  hemi.intensity = night ? 0.16 : 0.75; sun.intensity = night ? 0.06 : 0.9; fill.intensity = night ? 0.04 : 0.25;
  M.lamp.emissiveIntensity = night ? 2.2 : 0.9; M.band.emissive.set(night ? 0xffc46b : 0x000000); M.band.emissiveIntensity = night ? 0.55 : 0;
  M.board.emissiveIntensity = night ? 1.6 : 0.8; M.screen.emissiveIntensity = night ? 1.4 : 0.7;
  M.window.emissive.set(night ? 0xffc77a : 0x000000); M.window.emissiveIntensity = night ? 0.6 : 0;
  if (night){ scene.background = new THREE.Color(0x0a1220); groundMat.color.set(0x1d2420); plazaMat.color.set(0x262c28); }
  else if (typeof applyTheme === "function") applyTheme(true);
  const see = !!S.seeThrough;
  for (const [k, o] of [["roof",.86],["roofSolid",1],["roofGreen",1],["roofConcrete",1],["roofClosed",.45],["roofGlass",.45],["roofEdge",1]]){
    const m = M[k]; if (!m) continue; m.transparent = see || o < 1; m.opacity = see ? Math.min(o, 0.18) : o; m.depthWrite = !see && o >= 1; m.needsUpdate = true; }
}
/* ================= signature architecture =================
   Big gestures drawn round the finished ground: an outer skin that wraps every stand into one building, an arch,
   spiral ramp towers, a raised plaza, twin entrance towers and lattice floodlight pylons. They don't change capacity. */
function hull2(pts){
  const P = pts.slice().sort((a,b) => a[0]-b[0] || a[1]-b[1]); if (P.length < 3) return P;
  const cr = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]), lo = [], up = [];
  for (const p of P){ while (lo.length >= 2 && cr(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i=P.length-1;i>=0;i--){ const p = P[i]; while (up.length >= 2 && cr(up[up.length-2], up[up.length-1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function offsetPoly(P, d){ const n = P.length;
  return P.map((p,i) => { const a = P[(i-1+n)%n], b = P[(i+1)%n]; let nx = b[1]-a[1], nz = -(b[0]-a[0]); const l = Math.hypot(nx,nz) || 1; return [p[0] + nx/l*d, p[1] + nz/l*d]; }); }
function chaikin(P, it){ for (let k=0;k<it;k++){ const Q = []; for (let i=0;i<P.length;i++){ const a = P[i], b = P[(i+1)%P.length]; Q.push(lerp2(a,b,.25), lerp2(a,b,.75)); } P = Q; } return P; }
function resample(P, step){ const out = [], n = P.length; for (let i=0;i<n;i++){ const a = P[i], b = P[(i+1)%n], k = Math.max(1, Math.round(Math.hypot(b[0]-a[0], b[1]-a[1])/step)); for (let s=0;s<k;s++) out.push(lerp2(a,b,s/k)); } return out; }
function normals(P){ const n = P.length; return P.map((p,i) => { const a = P[(i-1+n)%n], b = P[(i+1)%n]; const nx = b[1]-a[1], nz = -(b[0]-a[0]), l = Math.hypot(nx,nz) || 1; return [nx/l, nz/l]; }); }
/* A thin square bar between two points (for lattice work). */
function bar(buf, p, q, w){
  const d = [q[0]-p[0], q[1]-p[1], q[2]-p[2]], L = Math.hypot(...d) || 1; d[0]/=L; d[1]/=L; d[2]/=L;
  let u = Math.abs(d[1]) < .9 ? [d[2], 0, -d[0]] : [1, 0, 0]; const ul = Math.hypot(...u); u = u.map(x => x/ul*w/2);
  const v = [d[1]*u[2]-d[2]*u[1], d[2]*u[0]-d[0]*u[2], d[0]*u[1]-d[1]*u[0]];
  const c = [[1,1],[-1,1],[-1,-1],[1,-1]].map(([a,b]) => [u[0]*a+v[0]*b, u[1]*a+v[1]*b, u[2]*a+v[2]*b]);
  for (let i=0;i<4;i++){ const a = c[i], b = c[(i+1)%4];
    quad(buf, [p[0]+a[0],p[1]+a[1],p[2]+a[2]], [p[0]+b[0],p[1]+b[1],p[2]+b[2]], [q[0]+b[0],q[1]+b[1],q[2]+b[2]], [q[0]+a[0],q[1]+a[1],q[2]+a[2]]); }
}
function pylon(bf, x, z, h){ // classic tapering lattice floodlight tower
  const b = bf("steel"), w0 = 3.2, w1 = 0.9, corners = [[1,1],[-1,1],[-1,-1],[1,-1]];
  const at = (k, y) => { const w = lerp(w0, w1, y/h); return [x + corners[k][0]*w, y, z + corners[k][1]*w]; };
  for (let k=0;k<4;k++) bar(b, at(k,0), at(k,h), .35);
  const step = 5; for (let y=0;y<h-0.1;y+=step){ const y2 = Math.min(h, y+step);
    for (let k=0;k<4;k++){ const k2 = (k+1)%4; bar(b, at(k,y2), at(k2,y2), .18); bar(b, at(k,y), at(k2,y2), .14); bar(b, at(k2,y), at(k,y2), .14); } }
}
const SKINS = {none:"No outer skin", cushion:"Glowing cushions", fins:"Vertical fins", mesh:"Perforated metal", brick:"Brick with arches", glass:"Glass curtain wall"};
const skinTex = {};
function skinTexture(kind){
  if (skinTex[kind]) return skinTex[kind];
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  if (kind === "cushion"){ g.fillStyle = "#cfd6da"; g.fillRect(0,0,256,256);
    const gr = g.createRadialGradient(128,128,10,128,128,150); gr.addColorStop(0,"#ffffff"); gr.addColorStop(1,"#c8d0d4");
    g.fillStyle = gr; g.beginPath(); g.moveTo(128,6); g.lineTo(250,128); g.lineTo(128,250); g.lineTo(6,128); g.closePath(); g.fill();
    g.strokeStyle = "#8d979c"; g.lineWidth = 5; g.stroke(); }
  else if (kind === "fins"){ g.fillStyle = "#3a4247"; g.fillRect(0,0,256,256); g.fillStyle = "#e3e6e7"; for (let i=0;i<4;i++) g.fillRect(i*64+8, 0, 30, 256); }
  else if (kind === "mesh"){ g.fillStyle = "#8f979b"; g.fillRect(0,0,256,256); g.fillStyle = "#3a4045"; for (let y=8;y<256;y+=16) for (let x=(y/16%2)*8+8;x<256;x+=16){ g.beginPath(); g.arc(x,y,4.2,0,7); g.fill(); } }
  else if (kind === "brick"){ g.fillStyle = "#8b4636"; g.fillRect(0,0,256,256); g.strokeStyle = "#6e3226"; g.lineWidth = 2;
    for (let y=0;y<256;y+=16){ g.beginPath(); g.moveTo(0,y); g.lineTo(256,y); g.stroke(); for (let x=((y/16)%2)*16;x<256;x+=32){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+16); g.stroke(); } }
    g.fillStyle = "#2a2522"; g.beginPath(); g.moveTo(88,240); g.lineTo(88,120); g.arc(128,120,40,Math.PI,0); g.lineTo(168,240); g.closePath(); g.fill();
    g.fillStyle = "#d9cfc0"; g.fillRect(0,0,256,10); }
  else { g.fillStyle = "#7fa9bf"; g.fillRect(0,0,256,256); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(0,0,256,40); g.fillStyle = "#2f3a40"; g.fillRect(0,0,6,256); g.fillRect(0,0,256,6); g.fillRect(0,128,256,4); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (skinTex[kind] = t);
}
function addArchitecture(F, A, outline, outerTop, poly, standInfo, set, sext, bf, ext){
  if (outline.length < 3) return 0;
  let top = 0;
  const H = Math.max(8, outerTop), inPlot = (p) => !poly || inPoly(p, poly);
  let P = hull2(outline);
  P = A.skinShape === "round" ? chaikin(offsetPoly(P, poly ? 1 : 5), 4) : offsetPoly(P, poly ? 0.6 : 1.5);
  if (poly) P = P.map(p => inPlot(p) ? p : lerp2(p, [0,0], 0.04));
  P = resample(P, 3); const N = normals(P), n = P.length;
  const cum = [0]; for (let i=1;i<=n;i++) cum.push(cum[i-1] + Math.hypot(P[i%n][0]-P[i-1][0], P[i%n][1]-P[i-1][1]));
  const perim = cum[n];
  // outer skin
  if (A.skin && A.skin !== "none"){
    const kind = A.skin, bulge = kind === "cushion" ? H*0.06 : kind === "glass" ? H*0.03 : 0, panel = kind === "cushion" ? 8 : kind === "brick" ? 9 : 6;
    const rowsV = kind === "cushion" ? Math.max(2, Math.round(H/7)) : kind === "brick" ? Math.max(1, Math.round(H/9)) : Math.max(1, Math.round(H/6));
    const levels = [0, 0.15, 0.5, 0.85, 1], off = f => bulge*Math.sin(Math.PI*Math.min(1, f*1.05));
    const pos = [], uv = [];
    for (let i=0;i<n;i++){ const j = (i+1)%n, u0 = cum[i]/panel, u1 = cum[i+1]/panel;
      for (let k=0;k<levels.length-1;k++){ const f0 = levels[k], f1 = levels[k+1];
        const A0 = [P[i][0] + N[i][0]*off(f0), H*f0, P[i][1] + N[i][1]*off(f0)], B0 = [P[j][0] + N[j][0]*off(f0), H*f0, P[j][1] + N[j][1]*off(f0)];
        const A1 = [P[i][0] + N[i][0]*off(f1), H*f1, P[i][1] + N[i][1]*off(f1)], B1 = [P[j][0] + N[j][0]*off(f1), H*f1, P[j][1] + N[j][1]*off(f1)];
        pos.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1);
        uv.push(u0, f0*rowsV, u1, f0*rowsV, u1, f1*rowsV, u0, f0*rowsV, u1, f1*rowsV, u0, f1*rowsV); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    const tex = skinTexture(kind), glow = S.night && (kind === "cushion" || kind === "glass" || kind === "mesh");
    const mat = new THREE.MeshStandardMaterial({map:tex, side:THREE.DoubleSide, roughness: kind === "glass" ? .15 : .7, metalness: kind === "glass" || kind === "mesh" ? .3 : .05,
      emissive: glow ? new THREE.Color(kind === "cushion" ? S.seat : 0xffd9a0) : new THREE.Color(0), emissiveMap: glow ? tex : null, emissiveIntensity: glow ? (kind === "cushion" ? 1.1 : .5) : 0,
      transparent: kind === "glass", opacity: kind === "glass" ? .82 : 1});
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.stadium = true; group.add(mesh);
    // coping ring on top and entrances at the foot
    const inner = offsetPoly(P, -3); for (let i=0;i<n;i++){ const j = (i+1)%n; quad(bf("roofEdge"), [P[i][0],H,P[i][1]], [P[j][0],H,P[j][1]], [inner[j][0],H+.3,inner[j][1]], [inner[i][0],H+.3,inner[i][1]]); }
    if (kind === "fins") for (let i=0;i<n;i+=1){ const p = P[i], q = [p[0]+N[i][0]*1.2, p[1]+N[i][1]*1.2]; quad(bf("steel"), [p[0],0,p[1]], [q[0],0,q[1]], [q[0],H,q[1]], [p[0],H,p[1]]); }
    if (kind === "glass") for (let i=0;i<n;i+=2){ const p = P[i]; post(bf("column"), p[0]+N[i][0]*(bulge+.2), p[1]+N[i][1]*(bulge+.2), 0, H, .3); }
    const gates = Math.max(4, Math.round(perim/45));
    for (let g2=0; g2<gates; g2++){ const i = Math.floor(g2*n/gates), j = (i+1)%n, a = P[i], b = P[(i+2)%n], o = .15;
      quad(bf("gate"), [a[0]+N[i][0]*o,0,a[1]+N[i][1]*o], [b[0]+N[i][0]*o,0,b[1]+N[i][1]*o], [b[0]+N[i][0]*o,4.2,b[1]+N[i][1]*o], [a[0]+N[i][0]*o,4.2,a[1]+N[i][1]*o]); }
    top = Math.max(top, H + .3);
  }
  // raised plaza with steps
  if (A.plaza){
    const outerD = P.map((p,i) => { let d = 14; if (poly){ const e = exitDist(poly, p, N[i], 0); d = Math.max(0, Math.min(d, e - 0.5)); } return d; });
    const ring = (d0f, y) => P.map((p,i) => [p[0] + N[i][0]*d0f(i), y, p[1] + N[i][1]*d0f(i)]);
    const steps = 3, hP = 1.5;
    const topIn = ring(() => 0, hP), topOut = ring(i => Math.max(0, outerD[i] - steps*0.9), hP);
    for (let i=0;i<n;i++){ const j = (i+1)%n; quad(bf("concrete"), topIn[i], topIn[j], topOut[j], topOut[i]); }
    for (let s=0;s<steps;s++){ const y0 = hP*(1 - s/steps), y1 = hP*(1 - (s+1)/steps);
      const a = ring(i => Math.max(0, outerD[i] - (steps - s)*0.9), y0), b = ring(i => Math.max(0, outerD[i] - (steps - s - 1)*0.9), y1), a2 = ring(i => Math.max(0, outerD[i] - (steps - s)*0.9), y1);
      for (let i=0;i<n;i++){ const j = (i+1)%n; quad(bf("riser"), a[i], a[j], a2[j], a2[i]); quad(bf("concrete"), a2[i], a2[j], b[j], b[i]); } }
    for (let i=0;i<n;i+=Math.max(1, Math.round(n/40))){ const p = topOut[i]; if (outerD[i] > 5) post(bf("column"), p[0] - N[i][0]*1.2, p[2] - N[i][1]*1.2, hP, hP + 4.5, .2); }
    P.forEach((p,i) => { const q = [p[0] + N[i][0]*outerD[i], p[1] + N[i][1]*outerD[i]]; ext[0] = Math.max(ext[0], Math.abs(q[0])); ext[1] = Math.max(ext[1], Math.abs(q[1])); });
  }
  // spiral ramp towers, San Siro style
  if (A.ramps){
    const count = Math.max(4, Math.min(12, Math.round(perim/80))), R0 = 2.2, R1 = 6, h = H*0.92, turns = Math.max(1.5, h/7.5);
    for (let t=0;t<count;t++){
      const i = Math.floor((t + 0.5)*n/count), c = [P[i][0] + N[i][0]*(R1 + 0.8), P[i][1] + N[i][1]*(R1 + 0.8)];
      const core = new THREE.Mesh(new THREE.CylinderGeometry(R0, R0, h + 2, 16), M.concrete); core.position.set(c[0], (h+2)/2, c[1]); core.castShadow = true; core.userData.stadium = true; group.add(core);
      const segs = Math.round(turns*28), ph = Math.atan2(-N[i][1], -N[i][0]);
      for (let s=0;s<segs;s++){ const q0 = ph + s/28*Math.PI*2, q1 = ph + (s+1)/28*Math.PI*2, y0 = h*s/segs, y1 = h*(s+1)/segs;
        const P0 = r => [c[0] + Math.cos(q0)*r, y0, c[1] + Math.sin(q0)*r], P1 = r => [c[0] + Math.cos(q1)*r, y1, c[1] + Math.sin(q1)*r];
        quad(bf("concrete"), P0(R0), P1(R0), P1(R1), P0(R1));
        quad(bf("concrete"), P0(R1), P1(R1), [P1(R1)[0], y1+1.1, P1(R1)[2]], [P0(R1)[0], y0+1.1, P0(R1)[2]]);
        quad(bf("soffit"), P0(R0), P1(R0), [P1(R0)[0], y1-.4, P1(R0)[2]], [P0(R0)[0], y0-.4, P0(R0)[2]]); }
      ext[0] = Math.max(ext[0], Math.abs(c[0]) + R1); ext[1] = Math.max(ext[1], Math.abs(c[1]) + R1); }
    top = Math.max(top, H + 2);
  }
  // twin entrance towers on the main (north) side
  if (A.towers){
    let bi = 0; for (let i=0;i<n;i++) if (P[i][1] < P[bi][1] - 1e-6 || (Math.abs(P[i][1] - P[bi][1]) < 1e-6 && Math.abs(P[i][0]) < Math.abs(P[bi][0]))) bi = i;
    const zc = P[bi][1] - 9, hT = H + 14;
    for (const sx of [-1, 1]){ const x = sx*Math.max(14, (F.W/2)*0.35);
      if (poly && !inPoly([x, zc], poly)) continue;
      post(bf("white"), x, zc, 0, hT, 9);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.2, 5, 20), M.white); drum.position.set(x, hT + 2.5, zc);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(3.8, 20, 12, 0, Math.PI*2, 0, Math.PI/2), M.concrete); dome.position.set(x, hT + 5, zc);
      for (const o of [drum, dome]){ o.castShadow = true; o.userData.stadium = true; group.add(o); }
      post(bf("steel"), x, zc, hT + 8, hT + 14, .2); ext[1] = Math.max(ext[1], Math.abs(zc) + 6); }
    top = Math.max(top, H + 28);
  }
  // an arch over the main stand
  if (A.arch){
    const span = Math.max(60, 2*sext[0] + 20), Ah = Math.max(H*2.2, span*0.36), lean = 18*Math.PI/180;
    const dN = standInfo.N ? standInfo.N.depth : 20, z0 = -(F.H/2 + set + dN*0.55), pts = [];
    for (let k=0;k<=40;k++){ const x = -span/2 + span*k/40, f = 1 - Math.pow(2*x/span, 2), y = Ah*Math.pow(Math.max(0, f), 0.85);
      pts.push(new THREE.Vector3(x, y*Math.cos(lean), z0 - y*Math.sin(lean))); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, Math.max(1.6, span*0.007), 12, false), M.steel);
    tube.castShadow = true; tube.userData.stadium = true; group.add(tube);
    for (const sx of [-1,1]) post(bf("concrete"), sx*span/2, z0, 0, 3, 7);
    for (let k=4;k<=36;k+=4){ const p = pts[k]; const tz = z0 + dN*0.7, ty = Math.max(4, H);
      quad(bf("cable"), [p.x-.08,p.y,p.z], [p.x+.08,p.y,p.z], [p.x+.08,ty,tz], [p.x-.08,ty,tz]); }
    top = Math.max(top, Ah*Math.cos(lean));
  }
  return top;
}
/* ================= floodlights and screens ================= */
const FLOODS = {none:"No floodlights", masts:"Corner masts", pylons:"Lattice pylons in the corners", roof:"Along the roof edges"};
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
    const cfgRef = sc.at in S.stands && (layoutOf() !== "bowl") ? S.stands[sc.at] : (g.key === "B" ? S.bowl : null);
    let h = w*0.42, mount = sc.mount || "gap";
    if (mount === "ribbon"){ // aim the camera at the front of the tiers, halfway along
      const pr = (g.profs[i] || []).slice(g.drawFrom).filter(q => q && !q.ghost && nRows(q) >= 1), top = pr[pr.length - 1], f = pr.length ? pr[0].front : x.front;
      const q = P(f); plans.push({kind:"ribbon", g, idx, x:q[0], y: top && top.stacked ? top.hF : 3, z:q[1]}); return; }
    if ((mount === "gap" || mount === "roof") && !R){
      issue(`${label}: there's no roof over that part of the stand to hang it from, so it sits on top of the back row instead.`, key, "geo", {fix: cfgRef ? {label:"Give that stand a roof", run:() => { cfgRef.roof.shape = "slope"; return true; }} : null}); mount = "top"; }
    if (mount === "gap"){
      const d = x.back - 0.6, f = Math.max(0, Math.min(1, (d - R.inner)/Math.max(.1, R.outer - R.inner))), ceil = R.y(f) - 0.5, floorY = x.top + 0.2, avail = ceil - floorY;
      if (avail < h){
        const need = h - avail;
        if (avail < 2.5 || need > 0.5) issue(`${label} needs ${h.toFixed(1)} m between the back row and the roof but there's only ${Math.max(0, avail).toFixed(1)} m, so it's squashed. Raise that roof to fit it properly.`, key, "geo",
          {fix: cfgRef ? {label:`Raise the roof ${need.toFixed(1)} m`, run:() => { cfgRef.roof.lift = (cfgRef.roof.lift || 0) + need + 0.2; return true; }} : null});
        h = Math.max(1.2, avail); }
      const p = P(d); plans.push({kind:"board", x:p[0], y:floorY + h/2, z:p[1], w, h, n, hang: ceil, idx});
    } else if (mount === "roof"){
      const d = R.inner + 1.2, top = R.y(0) - 0.6, bottom = top - h, below = heightAt(x.prof, d) + 2.6;
      if (bottom < below) issue(`${label} hangs down into the fans below the roof edge. Raise the roof or use a smaller screen.`, key, "geo",
        {fix: cfgRef ? {label:`Raise the roof ${(below - bottom).toFixed(1)} m`, run:() => { cfgRef.roof.lift = (cfgRef.roof.lift || 0) + (below - bottom) + 0.2; return true; }} : null});
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
  const k = S.seat; if (boardTex[k]) return boardTex[k];
  const c = document.createElement("canvas"); c.width = 512; c.height = 216; const g = c.getContext("2d");
  g.fillStyle = "#06090d"; g.fillRect(0,0,512,216); g.fillStyle = S.seat; g.fillRect(0,0,512,26); g.fillRect(0,190,512,26);
  g.fillStyle = "#ffffff"; g.font = "bold 18px sans-serif"; g.textAlign = "center"; g.fillText("GROUNDWORKS", 256, 20);
  g.font = "bold 74px sans-serif"; g.fillText("2 – 1", 256, 128);
  g.font = "bold 30px sans-serif"; g.fillText("HOME", 96, 120); g.fillText("AWAY", 416, 120);
  g.fillStyle = "#ffd65a"; g.font = "bold 26px monospace"; g.fillText("63:12", 256, 172);
  const t = new THREE.CanvasTexture(c); return (boardTex[k] = t);
}
function drawScreens(plans, bf, anchors){
  const face = new THREE.MeshStandardMaterial({map:scoreboardTexture(), emissive:0xffffff, emissiveMap:scoreboardTexture(), emissiveIntensity: S.night ? 1 : .55, roughness:.4});
  for (const p of plans){
    if (p.kind === "ribbon"){ // LED boards along every tier front of that stand
      const g = p.g, b = bf("board");
      for (let i=0;i<g.m - (g.closed ? 0 : 1);i++){ const j = (i+1)%g.m, A0 = g.profs[i], B0 = g.profs[j];
        for (let k=g.drawFrom;k<Math.min(A0.length, B0.length);k++){ const a = A0[k], c = B0[k]; if (!a || !c || a.ghost || c.ghost || nRows(a) < 1 || nRows(c) < 1) continue;
          const ya = a.stacked ? a.hF - 1.4 : 0.15, yc = c.stacked ? c.hF - 1.4 : 0.15, hh = a.stacked ? 1.1 : 0.85;
          const pa = [g.o[i][0] + (a.front - .06)*g.v[i][0], g.o[i][1] + (a.front - .06)*g.v[i][1]], pc = [g.o[j][0] + (c.front - .06)*g.v[j][0], g.o[j][1] + (c.front - .06)*g.v[j][1]];
          quad(b, [pa[0],ya,pa[1]], [pc[0],yc,pc[1]], [pc[0],yc+hh,pc[1]], [pa[0],ya+hh,pa[1]]); } } continue; }
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
/* Façade looks. Each draws onto one stretch of outside wall from a to b (points on the ground), whose top runs from ya to
   yb, facing out along n. Everything stands slightly proud of the wall so it reads from the street and from the air. */
const FACADE_LOOKS = {brick:"Brick, with rows of windows", timber:"Painted timber", deco:"Art deco ribs", concrete:"Concrete bands",
  sheet:"Metal cladding with a club-colour stripe", fins:"Metal fins over a glazed concourse", glass:"Glass curtain wall", grid:"Windows all over", plain:"Plain wall"};
function dressWall(buf, look, wallKey, a, b, ya, yb, n){
  const len = Math.hypot(b[0]-a[0], b[1]-a[1]); if (len < 0.5) return;
  const tg = [(b[0]-a[0])/len, (b[1]-a[1])/len], lo = Math.min(ya, yb);
  const P = (f, out) => [a[0] + (b[0]-a[0])*f + n[0]*out, a[1] + (b[1]-a[1])*f + n[1]*out];
  const Q = (p, y) => [p[0], y, p[1]];
  const top = f => ya + (yb - ya)*f;
  // a flat panel across part of the wall, standing out from it
  const panel = (key, f0, f1, y0, y1, out) => { const p0 = P(f0,out), p1 = P(f1,out); quad(buf(key), Q(p0,y0), Q(p1,y0), Q(p1,y1), Q(p0,y1)); };
  // a horizontal band with a top and underside, so it casts a shadow line
  const ledge = (key, y0, y1, depth, slope) => { const s0 = slope ? 0 : 0, f = g => slope ? top(g) - lo : s0;
    const a0 = P(0,0), b0 = P(1,0), a1 = P(0,depth), b1 = P(1,depth);
    quad(buf(key), Q(a1,y0+f(0)), Q(b1,y0+f(1)), Q(b1,y1+f(1)), Q(a1,y1+f(0)));
    quad(buf(key), Q(a0,y0+f(0)), Q(b0,y0+f(1)), Q(b1,y0+f(1)), Q(a1,y0+f(0)));
    quad(buf(key), Q(a0,y1+f(0)), Q(b0,y1+f(1)), Q(b1,y1+f(1)), Q(a1,y1+f(0))); };
  // a vertical strip standing out from the wall (pilaster, rib or mullion)
  const rib = (key, f, w, y0, y1, depth) => { const fw = w/2/len, q0 = P(f-fw,0), q1 = P(f+fw,0), r0 = P(f-fw,depth), r1 = P(f+fw,depth);
    quad(buf(key), Q(r0,y0), Q(r1,y0), Q(r1,y1), Q(r0,y1)); quad(buf(key), Q(q0,y0), Q(r0,y0), Q(r0,y1), Q(q0,y1));
    quad(buf(key), Q(r1,y0), Q(q1,y0), Q(q1,y1), Q(r1,y1)); quad(buf(key), Q(r0,y1), Q(r1,y1), Q(q1,y1), Q(q0,y1)); };
  const cells = step => Math.max(1, Math.round(len/step));
  const windows = (key, step, storey, first, w, h, sill) => { const nC = cells(step);
    for (let c=0;c<nC;c++){ const fc = (c + .5)/nC, fw = w/2/len;
      for (let y = first; y + h < Math.min(top(fc), lo + 2) - 1.2; y += storey){ panel(key, fc - fw, fc + fw, y, y + h, .06); if (sill) panel(sill, fc - fw*1.25, fc + fw*1.25, y - .22, y, .14); } } };
  if (look === "brick"){
    panel("trim", 0, 1, 0, 0.9, .1);
    windows("window", 4.5, 4.2, 4.4, 1.5, 2.3, "trim");
    for (let c=0;c<=cells(4.5);c+=2) rib("trim", c/cells(4.5), .55, .9, Math.max(1.5, top(c/cells(4.5)) - 1.1), .3);
    ledge("trim", lo - 1.1, lo - .4, .45, true);
  } else if (look === "timber"){
    windows("window", 3, 3.6, 2.4, 1.2, 1.6, "white");
    for (let c=0;c<=cells(1.6);c++) rib("white", c/cells(1.6), .12, .3, Math.max(.8, top(c/cells(1.6)) - .3), .06);
    ledge("roofGreen", lo - .9, lo - .2, .3, true);
  } else if (look === "deco"){
    const nC = cells(3.2);
    for (let c=0;c<nC;c++){ const fc = (c + .5)/nC, fw = .7/len; panel("window", fc - fw, fc + fw, 2.2, Math.max(2.4, top(fc) - 3), .05); }
    for (let c=0;c<=nC;c++) rib("trim", c/nC, .6, .4, Math.max(1, top(c/nC) - .6), .9);
    ledge("trim", lo - 1.3, lo - .3, .7, true); panel("trim", 0, 1, 0, .6, .12);
  } else if (look === "concrete"){
    for (let y = 3; y + 3.2 < lo - .5; y += 5.2){ panel("window", 0, 1, y, y + 1.6, .05); ledge("concrete", y + 1.6, y + 3.1, .8); }
    ledge("concrete", lo - 1.2, lo - .2, .9, true);
  } else if (look === "sheet"){
    for (let y = 2.4; y < lo - .5; y += 2.4) panel("band", 0, 1, y, y + .07, .04);
    for (let c=0;c<=cells(6);c++) rib("band", c/cells(6), .08, 0, Math.max(.5, top(c/cells(6))), .05);
    if (lo > 6) ledge("lattice", lo - 3.4, lo - 2.2, .12, true);
    panel("window", 0, 1, .3, Math.min(3, lo - 1), .06);
  } else if (look === "fins"){
    panel("window", 0, 1, .3, Math.min(4.6, lo - 1), .05); panel("glass", 0, 1, .3, Math.min(4.6, lo - 1), .5);
    const nC = cells(2.4);
    for (let c=0;c<=nC;c++){ const f = c/nC, p0 = P(f, .1), p1 = [p0[0] + n[0]*1.3 + tg[0]*.7, p0[1] + n[1]*1.3 + tg[1]*.7];
      quad(buf("steel"), Q(p0, 5.2), Q(p1, 5.2), Q(p1, Math.max(5.4, top(f) - .2)), Q(p0, Math.max(5.4, top(f) - .2))); }
    ledge("steel", 4.6, 5.2, 1.4);
  } else if (look === "glass"){
    panel("glass", 0, 1, .2, Math.max(.4, lo - .2), .35);
    const nC = cells(2.2);
    for (let c=0;c<=nC;c++) rib("steel", c/nC, .14, .2, Math.max(.4, top(c/nC) - .2), .4);
    for (let y = 3.6; y < lo - .5; y += 3.6) ledge("steel", y, y + .14, .4);
  } else if (look === "grid"){
    windows("window", 2.6, 3.3, 1.6, 1.3, 1.8, null);
    ledge("trim", lo - .8, lo - .2, .3, true);
  }
}
/* Floodlights fixed to the leading edge of each roof (or on short poles along the top of open stands). */
function roofLights(anchors, bf, F){
  const lamps = [];
  for (const g of anchors){
    let acc = 0, prev = null, last = null;
    for (let i=0;i<g.m;i++){ const x = g.info[i]; if (!x) { last = null; continue; } const R = g.RR ? g.RR[i] : null;
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
function maxFocusIn(F){ return Math.min(10, Math.max(Math.min(F.W, F.H)/2, Math.max(F.W, F.H)/4)); }
function defaultFocusIn(F){ return F.custom ? Math.min(4, Math.min(F.W, F.H)*0.3) : 0; }
let PRE = false;
function build(){
  let alignTop = null, roofNeedMax = 0;
  if (S.roofAlign && !PRE){ PRE = true; const d0 = DRY; DRY = true; try { alignTop = build().roofNeedMax; } finally { DRY = d0; PRE = false; } }
  const F = field(), L = S.limits, lay = layoutOf(), shape = S.cornerShape || "curved";
  focusY = F.focusY || 0;
  focusIn = S.focusIn != null ? Math.max(0, Math.min(S.focusIn, maxFocusIn(F))) : defaultFocusIn(F);
  const floorRows = F.custom ? Math.max(0, Math.round(S.custom.floor || 0)) : 0;
  const floorStart = F.kind === "boxing" || F.kind === "cage" ? 1.8 : 1.2, floorT = 0.85;
  const floorNeed = floorRows ? floorStart + floorRows*floorT + 0.9 : 1;
  const set = Math.max(S.setback, floorNeed);
  const standSet = cfg => Math.max(floorNeed, cfg && cfg.dist != null ? cfg.dist : S.setback);
  const radius = (F.custom || F.noStands) ? (F.r > 0 ? F.r : S.corner) : S.corner;
  const poly = S.plot.on && S.plot.pts ? S.plot.pts : null;
  if (!DRY){
    scene.remove(group);
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); for (const m of [].concat(o.material || [])) if (m.map && m.map.dispose) m.map.dispose(); });
    group = new THREE.Group(); scene.add(group);
  }
  const Bf = {}; const buf = k => (Bf[k] = Bf[k] || []);
  const issues = [], byType = {seated:0,exec:0,rail:0,bench:0,terrace:0}, parts = [], standInfo = {}, handles = [];
  /* Every check result has a category (geometry note, viewing issue, rule break), a key so a fix can test it worked, and an optional fix. */
  const issue = (text, key, cat, extra) => issues.push(Object.assign({text, key, cat}, extra || {}));
  const outline = []; let outerTop = 0;
  let total=0, minC=Infinity, maxH=0, far=0, farRef=null, restricted=0, slowest=0, curRef = null;
  const bounds = [-(F.W/2+set), F.W/2+set, -(F.H/2+set), F.H/2+set];
  const focus = F.home || [0,0];
  const farFrom = (x,z,y) => {
    let tx = focus[0], tz = focus[1];
    if (F.flag){ tx = -Math.sign(x||1)*F.flag[0]; tz = -Math.sign(z||1)*F.flag[1]; }
    const dd = Math.hypot(x-tx, z-tz, y - focusY);
    if (dd > far){ far = dd; farRef = curRef; }
  };
  const grow = (x,z) => { outline.push([x,z]); bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.max(bounds[1], x); bounds[2] = Math.min(bounds[2], z); bounds[3] = Math.max(bounds[3], z); };
  const regions = [], roofQuads = [], allRecs = [], anchors = [];

  if (poly){
    const hx = F.W/2+set, hz = F.H/2+set;
    if (![[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].every(p => inPoly(p, poly)))
      issue("The playing area doesn't fit inside the plot.", "site:floor", "geo", {fix:{label:"Fit the plot round it", run:() => { plotShape("snug", true); return true; }}});
  }

  // seating types in use, then type-wide checks
  const used = new Set();
  const addUsed = arr => arr.forEach(x => used.add(x.type));
  if (lay !== "stands") addUsed(S.bowl.tiers);
  if (lay !== "bowl"){ SIDES.forEach(s => addUsed(S.stands[s].tiers)); if (CORNERS.some(c => S.corners[c.key].mode === "custom")) addUsed(S.cornerCustom); }
  if (floorRows) used.add("seated");
  const typeBad = {};
  for (const ty of used){
    const z = S.types[ty], nm = TYPES[ty].label;
    if (TYPES[ty].seat){
      if (z.row < L.minRow - 1e-9){ typeBad[ty]=1; issue(`${nm}: rows are ${z.row.toFixed(2)} m deep, under the ${L.minRow.toFixed(2)} m minimum.`, `type:${ty}:row`, "rules",
        {fix:{label:`Make rows ${L.minRow.toFixed(2)} m deep`, run:() => { S.types[ty].row = L.minRow; return true; }}}); }
      if (z.width < L.minWidth - 1e-9){ typeBad[ty]=1; issue(`${nm}: ${z.width.toFixed(2)} m per person is narrower than the ${L.minWidth.toFixed(2)} m minimum.`, `type:${ty}:width`, "rules",
        {fix:{label:`Widen to ${L.minWidth.toFixed(2)} m`, run:() => { S.types[ty].width = L.minWidth; return true; }}}); }
    } else {
      if (z.density > L.maxDensity + 1e-9){ typeBad[ty]=1; issue(`Terraces: ${z.density.toFixed(1)} people per m² is above the ${L.maxDensity.toFixed(1)} limit.`, "type:terrace:density", "rules",
        {fix:{label:`Cap at ${L.maxDensity.toFixed(1)} per m²`, run:() => { S.types.terrace.density = L.maxDensity; return true; }}}); }
      const gap = S.design.barrierEvery * z.row;
      if (gap > L.barrierGap + 1e-9){ typeBad[ty]=1; const every = Math.max(2, Math.floor(L.barrierGap / z.row + 1e-9));
        issue(`Terraces: crush barriers are ${gap.toFixed(1)} m apart, more than the ${L.barrierGap.toFixed(1)} m allowed.`, "type:terrace:barrier", "rules",
        {fix:{label:`Put a barrier every ${every} steps`, run:() => { S.design.barrierEvery = every; return true; }}}); }
    }
  }
  if ([...used].some(ty => TYPES[ty].seat)){
    if (S.design.gangEvery > L.maxBetween) issue(`Gangways: ${S.design.gangEvery} seats between gangways is more than the ${L.maxBetween} allowed.`, "gang:every", "rules",
      {fix:{label:`Add gangways every ${L.maxBetween} seats`, run:() => { S.design.gangEvery = L.maxBetween; return true; }}});
    if (S.design.gangWidth < L.minGang - 1e-9) issue(`Gangways: ${S.design.gangWidth.toFixed(2)} m wide is under the ${L.minGang.toFixed(2)} m minimum.`, "gang:width", "rules",
      {fix:{label:`Widen gangways to ${L.minGang.toFixed(2)} m`, run:() => { S.design.gangWidth = L.minGang; return true; }}});
  }
  const rakeLimit = ty => ty === "terrace" ? L.terraceRake : L.seatRake;
  const steepInfo = {};
  const noteSteep = (key, k, v) => { steepInfo[key] = steepInfo[key] || []; steepInfo[key][k] = Math.max(steepInfo[key][k] || 0, v); };

  /* ---------- the slice builder: draws one stand, bowl or corner ---------- */
  function buildSliced(st){
    const {o, v, closed} = st.geo, m = o.length;
    if (m < 2) return null;
    const cfg = st.cfg, sty = STYLES[cfg.style] || STYLES.modern, rf = Object.assign(R("none"), cfg.roof || {});
    const fac = cfg.facade || sty.facade || {}, look = FACADE_LOOKS[fac.look] ? fac.look : sty.look || "plain";
    const setAt = i => st.setFor ? st.setFor(i) : st.set;
    const pt = (i,d) => [o[i][0] + d*v[i][0], o[i][1] + d*v[i][1]];
    const V = (i,d,y) => { const p = pt(i,d); return [p[0], y, p[1]]; };
    const segs = closed ? m : m-1, nx = i => (i+1)%m;
    const roofOn = rf.shape !== "none" && st.roofOn !== false;
    const margin = roofOn ? 1.6 : 0.3;
    let overflow = 0;
    const profs = [];
    for (let i=0;i<m;i++){
      let tiers = st.tiersFor(i); const s0 = setAt(i);
      if (poly){
        const dm = exitDist(poly, o[i], v[i], s0);
        if (S.plot.clip) tiers = trimTiers(tiers, dm - margin, s0);
        else { const pr = profile(tiers, s0).filter(p => nRows(p) >= 1); if (pr.length) overflow = Math.max(overflow, Math.max(...pr.map(p => p.front + nRows(p)*p.T)) + margin - dm); }
      }
      profs.push(profile(tiers, s0));
    }
    if (overflow > 0.05) issue(`The ${st.name.toLowerCase()} runs ${Math.round(overflow)} m past the plot boundary.`, "site:" + st.name, "geo",
      {tab:st.key, fix:{label:"Cut it back to fit the plot", run:() => { S.plot.clip = true; return true; }}});
    const s0 = setAt(Math.floor(m/2));
    const cum = [0]; for (let i=1;i<m;i++){ const a = pt(i-1,s0), b = pt(i,s0); cum.push(cum[i-1] + Math.hypot(b[0]-a[0], b[1]-a[1])); }
    const lenTotal = cum[m-1] + (closed ? Math.hypot(pt(0,s0)[0]-pt(m-1,s0)[0], pt(0,s0)[1]-pt(m-1,s0)[1]) : 0);
    const marks = step => { const out = new Set(); if (lenTotal < step*0.6) return out; let next = step/2;
      for (let i=0;i<m;i++){ if (cum[i] >= next){ out.add(i); next += step; } } return out; };
    const tangent = i => { let a, b;
      if (closed){ a = pt((i-1+m)%m,s0); b = pt((i+1)%m,s0); } else { a = pt(Math.max(0,i-1),s0); b = pt(Math.min(m-1,i+1),s0); }
      const tx = b[0]-a[0], tz = b[1]-a[1], l = Math.hypot(tx,tz) || 1; return [tx/l, tz/l]; };
    const above = st.drawFrom > 0, K = Math.max(0, ...profs.map(p => p.length));
    const realCount = Math.max(0, ...profs.map(p => p.filter((x,k) => k >= st.drawFrom && !x.ghost).length));
    let standSeats = 0, standEvac = 0, standTop = 0, standBack = 0; const kinds = new Set(), segRecs = [], cols = [], tierRecs = [];
    const wallKey = sty.wall === "concrete" ? "concrete" : sty.wall === "glassClad" ? "glassClad" : "clad_" + cfg.style;
    const pillarAt = marks(12), midI = (() => { let best = Math.floor(m/2), bd = Infinity; for (let i=0;i<m;i++){ const d = Math.abs(cum[i] - lenTotal/2); if (d < bd && profs[i].some(p => nRows(p) >= 1 && !p.ghost)){ bd = d; best = i; } } return best; })();
    const cap = (s, p, from, to) => {
      const T = p.T, d1 = p.front + from*T, d2 = p.front + to*T;
      const y1 = p.stacked ? (from === 0 ? p.hF - 1.5 : p.hs[from] - 1.5) : 0, y2 = p.stacked ? p.hs[to-1] - 1.5 : 0;
      quad(buf(wallKey), V(s,d1,y1), V(s,d2,y2), V(s,d2,p.hs[to-1]+1.2), V(s,d1,from === 0 ? p.hF : p.hs[from]));
    };
    let kDrawn = 0;
    for (let k=st.drawFrom;k<K;k++){
      let best = null, tierType = null;
      for (let i=0;i<m;i++){ const p = profs[i][k]; if (p && !p.ghost && nRows(p) >= 1){ tierType = tierType || p.type; if (!best || nRows(p) > nRows(best)) best = p; } }
      if (!tierType) continue;
      const T = S.types[tierType].row, eye = TYPES[tierType].eye;
      const kk = k - st.drawFrom, ref = st.tierRef ? st.tierRef(kk) : null, where = {tab:st.key, k:kk};
      const name = cap1((st.name + " " + tierName(kDrawn, realCount, above)).trim() + ((realCount > 1 || above) ? " tier" : ""));
      kDrawn++;
      curRef = {ref, name};
      let tierC = Infinity, firstC = Infinity, steep = 0;
      for (let j=1;j<nRows(best);j++){ const N = best.hs[j]-best.hs[j-1], D = best.front + focusIn + (j-1)*T + 0.3, R0 = best.hs[j-1] + eye - focusY;
        const cv = D*(N+R0)/(D+T) - R0; if (j === 1) firstC = cv; tierC = Math.min(tierC, cv); }
      for (let i=0;i<m;i++){ const p = profs[i][k]; if (p && !p.ghost && nRows(p) >= 2) steep = Math.max(steep, p.steep); }
      noteSteep(st.key, kk, steep);
      let bad = !!typeBad[tierType];
      const lim = rakeLimit(tierType);
      if (steep > lim + 0.05){ bad = true;
        issue(`${name} is ${Math.round(steep)}° steep. The limit for ${tierType === "terrace" ? "terraces" : "seating"} is ${lim}°.`, `steep:${st.name}:${kk}`, "rules",
          Object.assign({fix: ref ? {label:`Flatten it to ${lim}°`, run:() => { ref.rake = lim; return true; }} : null}, where)); }
      if (isFinite(tierC)){ minC = Math.min(minC, tierC);
        if (tierC*1000 < L.minC - 0.5){ bad = true;
          const key = `C:${st.name}:${kk}`, mm = Math.round(tierC*1000), front = firstC*1000 < L.minC + 3;
          const rowsDown = r => { const out = []; for (let x = r.rows - 1; x >= 2; x--) out.push(x); return out; };
          const setbacks = () => { const out = []; const base = st.key in S.stands && S.stands[st.key].dist != null ? S.stands[st.key].dist : S.setback;
            for (let x = base + 0.5; x <= base + 20; x += 0.5) out.push(x); return out; };
          const setDist = v2 => { if (lay === "stands" && S.stands[st.key] && S.stands[st.key].dist != null) S.stands[st.key].dist = v2; else S.setback = v2; };
          let text, fix = null; const close = [], away = [];
          const maxIn = maxFocusIn(F), aims = []; for (let x = Math.ceil(focusIn*2)/2 + 0.5; x <= maxIn + 1e-6; x += 0.5) aims.push(x);
          const aim = () => aims.length ? searchFix(v2 => { S.focusIn = v2; }, aims, key) : false;
          const fld = tierType === "terrace" ? "terraceRake" : "seatRake", top = tierType === "terrace" ? 32 : 45, rakes = [];
          for (let x = Math.floor(L[fld]) + 1; x <= top; x++) rakes.push(x);
          const steeper = () => rakes.length ? searchFix(v2 => { S.standard = "custom"; S.limits[fld] = v2; }, rakes, key) : false;
          /* Fixes that keep the seats where they are come first; fixes that move seats away are offered as the alternative. */
          if (best.auto && rakes.length) close.push({label:`Allow steeper ${tierType === "terrace" ? "terraces" : "seating"} (changes your rules)`, run:steeper, keeps:true});
          if (best.auto && F.custom && aims.length) close.push({label:"Aim sightlines into the floor", run:aim, keeps:true});
          if (!best.auto){
            text = `${name}: fans can't see over the heads in front properly (${mm} mm; needs ${L.minC} mm). The tier is too shallow.`;
            if (ref) fix = {label:"Switch its steepness to Auto", run:() => { ref.auto = true; return !dryIssues().some(i => i.key === key); }};
          } else if (front){
            text = `${name}: the front rows sit so high and close that fans look down past the heads in front (${mm} mm; needs ${L.minC} mm). To keep it this close it has to be steeper than your ${L[fld]}° limit${F.custom ? ", or aim the view further into the floor" : ""}; otherwise it moves back.`;
            if (best.stacked && ref){
              const g0 = ref.gap == null ? 3 : ref.gap, gMin = (ref.over || 0) > 0.5 ? 3.7 : 2.6, gaps = []; for (let x = g0 - 0.25; x >= gMin - 1e-6; x -= 0.25) gaps.push(+x.toFixed(2));
              if (gaps.length) close.push({label:"Tuck it lower", run:() => searchFix(v2 => { ref.gap = v2; }, gaps, key), keeps:true});
              away.push({moves:true, label:"Pull it back", run:() => { const o0 = ref.over || 0; return searchFix(v2 => { ref.over = Math.max(-15, o0 - v2); }, [1,2,3,4,6,8,10,12,15], key) || searchFix(setDist, setbacks(), key); }});
            } else away.push({moves:true, label:"Move it back from the play", run:() => searchFix(setDist, setbacks(), key)});
          } else {
            text = `${name}: the back rows are too far up for the tier's maximum steepness to keep the view clear (${mm} mm; needs ${L.minC} mm). Make it steeper, or use fewer rows.`;
            if (ref) away.push({moves:true, label:"Use fewer rows", run:() => searchFix(v2 => { ref.rows = v2; }, rowsDown(ref), key)});
          }
          if (best.auto){
            const pri = l => l.startsWith("Tuck") ? 0 : l.startsWith("Aim") ? 1 : 2; close.sort((a,b) => pri(a.label) - pri(b.label));
            const order = S.keepClose === false ? away.concat(close) : close.concat(away);
            fix = order[0] || null; var alts = order.slice(1);
          }
          issue(text, key, "view", Object.assign({fix, alts: best.auto ? alts : []}, where)); } }
      // creative geometry notes for stacked tiers
      if (best.stacked && !best.lowerGhost && best.over > 0.5){
        const head = best.hF - 1.5 - best.lowerBackH;
        if (head < 2.2) issue(`${name} overhangs the tier below with only ${head.toFixed(1)} m of headroom over its back row.`, `head:${st.name}:${kk}`, "geo",
          Object.assign({fix: ref ? {label:"Raise it to give 2.4 m", run:() => { ref.gap = (ref.gap == null ? 3 : ref.gap) + (2.4 - head); return true; }} : null}, where));
        if (best.over > 12) issue(`${name} projects ${best.over.toFixed(0)} m over the tier below: a very long cantilever. Fine for a sandbox, ambitious in real life.`, `cant:${st.name}:${kk}`, "geo", Object.assign({fix:null}, where));
      }
      if (best.stacked && best.gap > 14 && !best.pillars && !best.lowerGhost) issue(`${name} floats ${best.gap.toFixed(0)} m above the tier below with nothing visibly holding it up.`, `float:${st.name}:${kk}`, "geo",
        Object.assign({fix: ref ? {label:"Add pillars under it", run:() => { ref.pillars = true; return true; }} : null}, where));
      const fasc = buf(bad && S.trim ? "fasciaBad" : st.sel ? "fasciaSel" : "fascia");
      const aisleAt = marks(tierType === "terrace" ? 24 : S.design.gangEvery*S.types[tierType].width + S.design.gangWidth);
      const vomAt = !best.stacked && nRows(best) >= 10 ? marks(S.design.exitEvery) : new Set();
      const rowLen = [], recs = []; let frontLen = 0;
      for (let i=0;i<segs;i++){
        const j1 = nx(i), p0 = profs[i][k], p1 = profs[j1][k];
        const n0 = p0 && !p0.ghost ? nRows(p0) : 0, n1 = p1 && !p1.ghost ? nRows(p1) : 0, mr = Math.min(n0, n1);
        if (mr >= 1){
          for (let j=0;j<mr;j++){
            const a0 = p0.front + j*T, a1 = p1.front + j*T, h0 = p0.hs[j], h1 = p1.hs[j];
            const alt = (tierType === "seated" || tierType === "rail") && altRow(i, j, kk);
            quad(buf(alt ? "seatAlt" : tierType), V(i,a0,h0), V(j1,a1,h1), V(j1,a1+T,h1), V(i,a0+T,h0));
            if (j>0) quad(buf("riser"), V(i,a0,p0.hs[j-1]), V(j1,a1,p1.hs[j-1]), V(j1,a1,h1), V(i,a0,h0));
            const b0 = a0+T-.1, b1 = a1+T-.1;
            if (tierType === "rail") quad(buf("barrier"), V(i,b0,h0+.95), V(j1,b1,h1+.95), V(j1,b1,h1+1.05), V(i,b0,h0+1.05));
            else if (tierType === "terrace"){ if (j>0 && j % S.design.barrierEvery === 0) quad(buf("barrier"), V(i,a0+.08,h0+.95), V(j1,a1+.08,h1+.95), V(j1,a1+.08,h1+1.12), V(i,a0+.08,h0+1.12)); }
            else if (tierType !== "bench"){ const bh = tierType === "exec" ? .55 : .42; quad(buf(tierType === "exec" ? "exec" : alt ? "seatAltBack" : "seatBack"), V(i,b0,h0), V(j1,b1,h1), V(j1,b1,h1+bh), V(i,b0,h0+bh)); }
            const m0 = pt(i, a0+T/2), m1 = pt(j1, a1+T/2), len = Math.hypot(m1[0]-m0[0], m1[1]-m0[1]);
            rowLen[j] = (rowLen[j]||0) + len; if (j === 0) frontLen += len;
            recs.push({j, len, d:(a0+a1)/2, x:(m0[0]+m1[0])/2, z:(m0[1]+m1[1])/2, i, m0, m1, h0, h1, type:tierType});
          }
          const y00 = p0.stacked ? p0.hF-1.5 : 0, y10 = p1.stacked ? p1.hF-1.5 : 0;
          quad(fasc, V(i,p0.front,y00), V(j1,p1.front,y10), V(j1,p1.front,p1.hF), V(i,p0.front,p0.hF));
          if (tierType === "exec") quad(buf("glass"), V(i,p0.front,p0.hF), V(j1,p1.front,p1.hF), V(j1,p1.front,p1.hF+1.1), V(i,p0.front,p0.hF+1.1));
          if (p0.stacked && sty.lattice){ // criss-cross balcony truss
            const lb = buf("lattice"), yA = p0.hF-1.45, yB = p0.hF-0.05, f0 = p0.front-.06, f1 = p1.front-.06;
            quad(lb, V(i,f0,yA), V(i,f0,yA+.14), V(j1,f1,yB), V(j1,f1,yB-.14));
            quad(lb, V(i,f0,yB), V(i,f0,yB-.14), V(j1,f1,yA), V(j1,f1,yA+.14));
          }
          const bk0 = p0.front + mr*T, bk1 = p1.front + mr*T, t0 = p0.hs[mr-1], t1 = p1.hs[mr-1];
          if (p0.stacked){
            quad(buf("soffit"), V(i,p0.front,y00), V(j1,p1.front,y10), V(j1,bk1,t1-1.5), V(i,bk0,t0-1.5));
            // a tier set back behind the one below (as on an oval outline) gets a concourse deck across the gap
            if (!p0.lowerGhost && !p1.lowerGhost && p0.front > p0.lowerBack + 0.5 && p1.front > p1.lowerBack + 0.5){
              const yd0 = p0.lowerBackH + 1.2, yd1 = p1.lowerBackH + 1.2;
              quad(buf("concrete"), V(i,p0.lowerBack,yd0), V(j1,p1.lowerBack,yd1), V(j1,p1.front,yd1), V(i,p0.front,yd0));
              if (y00 > yd0 + .05 || y10 > yd1 + .05) quad(buf(wallKey), V(i,p0.front,yd0), V(j1,p1.front,yd1), V(j1,p1.front,Math.max(yd1, y10)), V(i,p0.front,Math.max(yd0, y00)));
            }
            if (p0.over > 0.3 && !p0.lowerGhost) roofQuads.push([pt(i,p0.front), pt(j1,p1.front), pt(j1,Math.min(p1.lowerBack, bk1)), pt(i,Math.min(p0.lowerBack, bk0))]);
          }
          quad(buf(wallKey), V(i,bk0,0), V(j1,bk1,0), V(j1,bk1,t1+1.2), V(i,bk0,t0+1.2));
          // where the depth changes from one slice to the next (an oval or blended outline), a smooth outer wall hides the steps
          if (n0 !== n1 && !profs[i].slice(k+1).some(q => q && !q.ghost && nRows(q) >= 1)){
            const e0 = p0.front + n0*T, e1 = p1.front + n1*T; quad(buf(wallKey), V(i,e0,0), V(j1,e1,0), V(j1,e1,p1.hs[n1-1]+1.2), V(i,e0,p0.hs[n0-1]+1.2)); }
          if (look === "plain" && !roofOn && t0 > 12 && t1 > 12 && sty.wall !== "glassClad"){ const y0 = t0*0.46, y1 = t1*0.46; quad(buf("band"), V(i,bk0+.08,y0), V(j1,bk1+.08,y1), V(j1,bk1+.08,y1+2.4), V(i,bk0+.08,y0+2.4)); }
        }
        if (n0 > mr) cap(i, p0, mr, n0);
        if (n1 > mr) cap(j1, p1, mr, n1);
      }
      for (let s=0;s<m;s++){
        const p = profs[s][k], n = p && !p.ghost ? nRows(p) : 0; if (n < 1) continue;
        // open stand ends: close the tier, and wall in the space under a stacked tier
        if (!closed && (s === 0 || s === m-1)){
          cap(s, p, 0, n);
          if (p.stacked){ const bk = p.front + n*T, top = p.hs[n-1], lb = Math.min(p.lowerBack, bk);
            const soff = d => lerp(p.hF - 1.5, top - 1.5, (d - p.front)/Math.max(.1, bk - p.front));
            if (bk > lb + .1) quad(buf(wallKey), V(s,lb,0), V(s,bk,0), V(s,bk,top-1.5), V(s,lb,soff(lb)));
            if (!p.lowerGhost && lb > p.front + .1){ const low = heightAt(profs[s].slice(0,k), p.front);
              quad(buf(wallKey), V(s,p.front,low + 1), V(s,lb,p.lowerBackH + 1.2), V(s,lb,soff(lb)), V(s,p.front,p.hF - 1.5)); }
          }
        }
        const tg = tangent(s);
        if (aisleAt.has(s)){ const gw = S.design.gangWidth/2;
          for (let j=0;j<n;j++){ const a = pt(s, p.front + j*T), b = pt(s, p.front + (j+1)*T), h = p.hs[j] + .03;
            quad(buf("aisle"), [a[0]-tg[0]*gw,h,a[1]-tg[1]*gw], [a[0]+tg[0]*gw,h,a[1]+tg[1]*gw], [b[0]+tg[0]*gw,h,b[1]+tg[1]*gw], [b[0]-tg[0]*gw,h,b[1]-tg[1]*gw]);
            if (tierType !== "terrace" && tierType !== "bench") quad(buf("aisle"), [b[0]-tg[0]*gw,h,b[1]-tg[1]*gw], [b[0]+tg[0]*gw,h,b[1]+tg[1]*gw], [b[0]+tg[0]*gw,h+.5,b[1]+tg[1]*gw], [b[0]-tg[0]*gw,h+.5,b[1]-tg[1]*gw]); }
        }
        if (vomAt.has(s) && n >= 10){ const ew = S.design.exitWidth/2, j0 = Math.floor(n*0.42);
          for (let j=j0;j<Math.min(n, j0+4);j++){ const a = pt(s, p.front + j*T), b = pt(s, p.front + (j+1)*T), h = p.hs[j] + .06;
            quad(buf("void"), [a[0]-tg[0]*ew,h,a[1]-tg[1]*ew], [a[0]+tg[0]*ew,h,a[1]+tg[1]*ew], [b[0]+tg[0]*ew,h,b[1]+tg[1]*ew], [b[0]-tg[0]*ew,h,b[1]-tg[1]*ew]); }
        }
        // pillars under a stacked tier's front (always when the tier below is left open)
        if (p.stacked && (p.pillars || p.lowerGhost) && pillarAt.has(s)){
          const cd = p.front + 0.4, q = pt(s, cd), base = p.lowerGhost ? 0 : heightAt(profs[s].slice(0,k), cd);
          post(buf("column"), q[0], q[1], base, p.hF - 1.5, 0.45); if (!p.lowerGhost) cols.push({x:q[0], z:q[1], d:cd});
        }
        const bp = pt(s, p.front + n*T - T/2); farFrom(bp[0], bp[1], p.hs[n-1] + eye);
        standTop = Math.max(standTop, p.hs[n-1] + 1.2); standBack = Math.max(standBack, p.front + n*T);
      }
      if (st.sel && ref){ const p = profs[midI][k]; if (p && !p.ghost && nRows(p) >= 1){
        const n = nRows(p), bk = p.front + n*T;
        handles.push({kind:"depth", x:pt(midI,bk)[0], y:p.hs[n-1] + 1.2, z:pt(midI,bk)[1], o:o[midI], v:v[midI], ref, front:p.front, T});
        if (p.stacked) handles.push({kind:"over", x:pt(midI,p.front)[0], y:p.hF, z:pt(midI,p.front)[1], o:o[midI], v:v[midI], ref, lowerBack:p.lowerBack, lowerBackH:p.lowerBackH}); } }
      let seats = 0; rowLen.forEach(l => { if (l) seats += capRow(l, tierType); });
      for (const r of recs){ r.seats = rowLen[r.j] ? capRow(rowLen[r.j], tierType) * r.len / rowLen[r.j] : 0; segRecs.push(r); }
      byType[tierType] += seats; standSeats += seats; total += seats; kinds.add(TYPES[tierType].short);
      const tr0 = {name: cap1(tierName(kDrawn-1, realCount, above) || "single") + " tier", type:tierType, rows:nRows(best), seats:Math.round(seats), steep, c: isFinite(tierC) ? Math.round(tierC*1000) : null, evac:0, front:best.front, height:best.hB, bad};
      tierRecs.push(tr0);
      if (seats){ const exits = Math.max(1, Math.round(frontLen / S.design.exitEvery)), mins = seats / (exits * S.design.exitWidth * L.flow);
        if (mins > L.maxEvac + 1e-9){ const key = `evac:${st.name}:${kk}`;
          const spacing = []; for (let x = S.design.exitEvery - 1; x >= 8; x--) spacing.push(x);
          const widths = []; for (let x = S.design.exitWidth + 0.2; x <= 5.001; x += 0.2) widths.push(+x.toFixed(1));
          issue(`${name}: takes ${mins.toFixed(1)} minutes to empty through ${exits} exit${exits>1?"s":""}. The limit is ${L.maxEvac} minutes.`, key, "rules",
            Object.assign({fix:{label:"Add more exits", run:() => searchFix(v2 => { S.design.exitEvery = v2; }, spacing, key) || searchFix(v2 => { S.design.exitWidth = v2; }, widths, key)}}, where)); }
        slowest = Math.max(slowest, mins); standEvac = Math.max(standEvac, mins); tr0.evac = mins; }
    }

    /* ---------- roof: shape, reach, height, tilt, curve, material and visible structure ---------- */
    const info = profs.map(pr => { const live = pr.filter(p => !p.ghost && nRows(p) >= 1); if (!live.length) return null;
      return {back: Math.max(...live.map(p => p.front + nRows(p)*p.T)), top: Math.max(...live.map(p => p.hs[nRows(p)-1])) + 1.2, front: Math.min(...live.map(p => p.front)), prof: pr}; });
    let topAll = standTop, RRout = null;
    if (roofOn && info.some(Boolean)){
      const rm = buf(ROOF_MAT_KEY[rf.mat] || "roof"), clad = buf(wallKey), gable = rf.shape === "gable";
      const tilt = Math.tan((rf.tilt || 0)*Math.PI/180);
      /* Level roofline (the default): every slice of the roof sits at the height the tallest part of the stand needs, so the edge runs dead straight. */
      const level = rf.level !== false, lift = Math.max(1.5, rf.lift);
      const spanOf = x => { const outer = x.back + 1.5; return outer - Math.min(outer - 2, x.front - rf.reach); };
      const live = info.filter(Boolean), needTop = Math.max(...live.map(x => x.top)) + lift, spanRef = Math.max(...live.map(spanOf));
      roofNeedMax = Math.max(roofNeedMax, needTop);
      const levelBase = alignTop != null ? Math.max(alignTop, needTop) : needTop;
      const RR = info.map(x => { if (!x) return null; const outer = x.back + 1.5, inner = Math.min(outer - 2, x.front - rf.reach);
        const span = level ? spanRef : outer - inner, base = level ? levelBase : x.top + lift;
        if (gable){ const ridge = base + Math.tan(24*Math.PI/180)*span/2; return {inner, outer, y:f => f < .5 ? lerp(base, ridge, f*2) : lerp(ridge, base, (f-.5)*2), yIn:base, yOut:base}; }
        const yIn = base + tilt*span, amp = (rf.curve || 0)*span*0.2;
        return {inner, outer, y:f => lerp(yIn, base, f) + amp*Math.sin(Math.PI*f), yIn, yOut:base}; });
      RRout = RR;
      const nS = gable ? 2 : (rf.curve > 0.01 ? 6 : 1);
      const at = (a, f) => lerp(a.inner, a.outer, f);
      for (let i=0;i<segs;i++){
        const j1 = nx(i), a = RR[i], b = RR[j1]; if (!a || !b) continue;
        for (let s=0;s<nS;s++){ const f0 = s/nS, f1 = (s+1)/nS;
          quad(rm, V(i,at(a,f0),a.y(f0)), V(j1,at(b,f0),b.y(f0)), V(j1,at(b,f1),b.y(f1)), V(i,at(a,f1),a.y(f1))); }
        quad(buf("roofEdge"), V(i,a.inner,a.y(0)-1.2), V(j1,b.inner,b.y(0)-1.2), V(j1,b.inner,b.y(0)), V(i,a.inner,a.y(0)));
        quad(clad, V(i,a.outer,0), V(j1,b.outer,0), V(j1,b.outer,b.y(1)), V(i,a.outer,a.y(1)));
        if (look === "plain" && a.y(1) > 14 && b.y(1) > 14 && sty.wall !== "glassClad"){ const y0 = a.y(1)*0.42, y1 = b.y(1)*0.42; quad(buf("band"), V(i,a.outer+.08,y0), V(j1,b.outer+.08,y1), V(j1,b.outer+.08,y1+2.4), V(i,a.outer+.08,y0+2.4)); }
        if (rf.support === "truss" && !closed){ for (const off of [-.2, 1.8]) quad(buf("steel"), V(i,a.inner+off,a.y(0)), V(j1,b.inner+off,b.y(0)), V(j1,b.inner+off,b.y(0)+3.2), V(i,a.inner+off,a.y(0)+3.2));
          quad(buf("steel"), V(i,a.inner-.2,a.y(0)+3.2), V(j1,b.inner-.2,b.y(0)+3.2), V(j1,b.inner+1.8,b.y(0)+3.2), V(i,a.inner+1.8,a.y(0)+3.2)); }
        roofQuads.push([pt(i,a.inner), pt(j1,b.inner), pt(j1,b.outer), pt(i,a.outer)]);
      }
      const ribAt = marks(12), colAt = marks(14), mastAt = marks(32);
      for (let i=0;i<m;i++){ const a = RR[i]; if (!a) continue;
        const peak = gable ? a.y(.5) : Math.max(a.y(0), a.y(1), a.y(.5));
        outerTop = Math.max(outerTop, a.y(0), a.y(1));
        topAll = Math.max(topAll, peak + (rf.support === "truss" ? 3.2 : rf.support === "ribs" ? 4 : .5));
        if (rf.support === "ribs" && ribAt.has(i)) for (let s=0;s<nS;s++){ const f0 = s/nS, f1 = (s+1)/nS;
          quad(buf("steel"), V(i,at(a,f0),a.y(f0)), V(i,at(a,f1),a.y(f1)), V(i,at(a,f1),a.y(f1) + .4 + 3.6*f1), V(i,at(a,f0),a.y(f0) + .4 + 3.6*f0)); }
        if (rf.support === "columns" && colAt.has(i)){ const x = info[i], cd = Math.max(a.inner + .6, x.front + .6), f = (cd - a.inner)/(a.outer - a.inner), q = pt(i, cd);
          post(buf("column"), q[0], q[1], heightAt(x.prof, cd), a.y(f), 0.35); cols.push({x:q[0], z:q[1], d:cd}); }
        if (rf.support === "masts" && mastAt.has(i)){ const q = pt(i, a.outer + 4), top = a.y(1) + 22, tip = pt(i, a.inner + 1), mid = pt(i, at(a, .45)), tg = tangent(i);
          post(buf("steel"), q[0], q[1], 0, top, .9);
          for (const [p2, y2] of [[tip, a.y(0)], [mid, a.y(.45)]]) quad(buf("cable"), [q[0]-tg[0]*.08, top, q[1]-tg[1]*.08], [q[0]+tg[0]*.08, top, q[1]+tg[1]*.08], [p2[0]+tg[0]*.08, y2, p2[1]+tg[1]*.08], [p2[0]-tg[0]*.08, y2, p2[1]-tg[1]*.08]);
          topAll = Math.max(topAll, top); }
        const g = pt(i, a.outer); grow(g[0], g[1]);
      }
      if (!closed){
        for (const i of [0, m-1]){ const a = RR[i]; if (!a) continue;
          if (gable) tri(clad, V(i,a.inner,a.y(0)), V(i,at(a,.5),a.y(.5)), V(i,a.outer,a.y(1)));
          if (rf.support === "truss"){ const tg = tangent(i), s = i ? 1.6 : -1.6, q = pt(i, a.inner + .8); post(buf("steel"), q[0] + tg[0]*s, q[1] + tg[1]*s, 0, a.y(0) + 3.2, 1.6); } }
        if (gable && RR[midI]){ // central pediment facing the play
          const a = RR[midI], tg = tangent(midI), c = pt(midI, a.inner), hw = Math.min(14, lenTotal*0.18), apex = a.yIn + hw*0.55, cm = pt(midI, at(a,.5));
          const L1 = [c[0]-tg[0]*hw, a.yIn, c[1]-tg[1]*hw], R1 = [c[0]+tg[0]*hw, a.yIn, c[1]+tg[1]*hw], A1 = [c[0], apex, c[1]];
          tri(buf(cfg.style === "pavilion" ? "white" : "lattice"), L1, R1, A1);
          quad(rm, L1, A1, [cm[0], Math.max(apex, a.y(.5)), cm[1]], [cm[0]-tg[0]*hw, a.y(.5), cm[1]-tg[1]*hw]);
          quad(rm, R1, A1, [cm[0], Math.max(apex, a.y(.5)), cm[1]], [cm[0]+tg[0]*hw, a.y(.5), cm[1]+tg[1]*hw]);
          topAll = Math.max(topAll, apex); }
      }
      if (rf.shape === "closed" && closed){ // roof over the whole floor, optionally with an opening in the middle
        const cy = Math.max(...RR.filter(Boolean).map(x => x.y(0))) + 9, op = Math.max(0, Math.min(0.9, rf.opening || 0)), b = buf("roofClosed");
        for (let i=0;i<m;i++){ const a = RR[i], c = RR[nx(i)]; if (!a || !c) continue;
          const pa = pt(i,a.inner), pc = pt(nx(i),c.inner);
          if (op < 0.02) tri(b, [0,cy,0], [pa[0],a.y(0),pa[1]], [pc[0],c.y(0),pc[1]]);
          else quad(b, [pa[0],a.y(0),pa[1]], [pc[0],c.y(0),pc[1]], [pc[0]*op, lerp(c.y(0),cy,1-op), pc[1]*op], [pa[0]*op, lerp(a.y(0),cy,1-op), pa[1]*op]); }
        topAll = Math.max(topAll, cy); if (op < 0.02) roofQuads.push("all"); st.closedAt = cy - 9;
      }
      if (st.sel){ const a = RR[midI]; if (a) handles.push({kind:"roof", x:pt(midI,a.inner)[0], y:a.y(0), z:pt(midI,a.inner)[1], o:o[midI], v:v[midI], cfg, front:info[midI].front, top:info[midI].top}); }
    } else {
      for (let i=0;i<m;i++){ const x = info[i]; if (x){ const g = pt(i, x.back); grow(g[0], g[1]); } }
    }
    // façade extras: stair towers, entrance gates and window mullions on the back wall
    const backAt = i => info[i] ? info[i].back + (roofOn ? 1.5 : 0) : null;
    if (fac.towers){ const ts = closed ? [...marks(60)] : [0, m-1];
      for (const i of ts){ const b = backAt(i); if (b == null) continue; const tg = tangent(i), side = closed ? 0 : (i ? 4 : -4), q = pt(i, b + 3.5);
        post(buf("tower"), q[0] + tg[0]*side, q[1] + tg[1]*side, 0, info[i].top + 3, 6); grow(q[0], q[1]); } }
    if (fac.gates) for (const i of marks(14)){ const b = backAt(i); if (b == null) continue; const tg = tangent(i), q = pt(i, b + .08);
      quad(buf("gate"), [q[0]-tg[0]*1.6, 0, q[1]-tg[1]*1.6], [q[0]+tg[0]*1.6, 0, q[1]+tg[1]*1.6], [q[0]+tg[0]*1.6, 3.4, q[1]+tg[1]*1.6], [q[0]-tg[0]*1.6, 3.4, q[1]-tg[1]*1.6]); }
    /* The outside wall, dressed in the stand's look: windows, pilasters, bands, fins or glass. It runs along the roof's back
       edge where there is a roof, otherwise along the back of the top tier. */
    if (look !== "plain") for (let i=0;i<segs;i++){
      const j1 = nx(i), x0 = info[i], x1 = info[j1]; if (!x0 || !x1) continue;
      const ra = RRout && RRout[i], rb = RRout && RRout[j1], roofed = roofOn && ra && rb;
      const d0 = roofed ? ra.outer : x0.back, d1 = roofed ? rb.outer : x1.back, y0 = roofed ? ra.y(1) : x0.top, y1 = roofed ? rb.y(1) : x1.top;
      const nv = [v[i][0] + v[j1][0], v[i][1] + v[j1][1]], nl = Math.hypot(nv[0], nv[1]) || 1;
      dressWall(buf, look, wallKey, pt(i, d0), pt(j1, d1), y0, y1, [nv[0]/nl, nv[1]/nl]);
    }
    if (st.sel && st.key in S.stands && lay === "stands" && info[midI]){ const q = pt(midI, info[midI].front);
      handles.push({kind:"dist", x:q[0], y:0.6, z:q[1], o:o[midI], v:v[midI], cfg}); }
    for (const r of segRecs) allRecs.push(r);
    let rv = 0;
    if (cols.length){ const cosLim = Math.cos(12*Math.PI/180);
      for (const r of segRecs){
        const ox = focus[0]-r.x, oz = focus[1]-r.z, ol = Math.hypot(ox,oz);
        for (const c of cols){ if (r.d <= c.d + 0.5) continue;
          const vx = c.x-r.x, vz = c.z-r.z, vl = Math.hypot(vx,vz);
          if (vl > 60 || vl >= ol) continue;
          if ((vx*ox + vz*oz)/(vl*ol) > cosLim){ rv += r.seats; break; } } }
      rv = Math.round(rv); restricted += rv; }
    maxH = Math.max(maxH, topAll); outerTop = Math.max(outerTop, standTop);
    const si = standInfo[st.key] = standInfo[st.key] || {width:0, depth:0, height:0, seats:0};
    si.width += lenTotal; si.depth = Math.max(si.depth, standBack - s0); si.height = Math.max(si.height, topAll); si.seats += standSeats;
    if (standSeats) parts.push({label:st.name, key:st.key, seats:Math.round(standSeats), kinds:(st.styleLabel === false ? "" : sty.label + " · ") + [...kinds].join(" + ") + (rv ? ` · ${fmt(rv)} restricted` : "") + ` · empties in ${standEvac.toFixed(1)} min`, tiers:tierRecs});
    regions.push({key:st.key, o, v, closed, profs: profs.map(p => p.slice(st.drawFrom).filter(x => !x.ghost))});
    anchors.push({key: st.ck || st.key, name: st.name, o, v, info, RR: RRout, m, closed, profs, drawFrom: st.drawFrom});
    return st;
  }

  /* ---------- floor seats round a ring, cage or court ---------- */
  if (floorRows){
    let fs = 0;
    for (let j=0;j<floorRows;j++){
      const d1 = floorStart + j*floorT, A = closedPathS(F, F.r, d1, "curved"), Bp = closedPathS(F, F.r, d1+floorT, "curved"), Q = closedPathS(F, F.r, d1+floorT-.1, "curved");
      ribbon(buf("floorSeat"), A, Bp, 0.05, 0.05, true); ribbon(buf("seatBack"), Q, Q, 0.05, 0.5, true);
      const mid = closedPathS(F, F.r, d1+floorT/2, "curved"), rowSeats = capRow(polyLen(mid, true), "seated"), rl = polyLen(mid, true);
      fs += rowSeats;
      for (let q=0;q<mid.length;q++){ const a = mid[q], b = mid[(q+1)%mid.length], len = Math.hypot(b[0]-a[0], b[1]-a[1]); if (len < .01) continue;
        allRecs.push({j, len, d:d1, x:(a[0]+b[0])/2, z:(a[1]+b[1])/2, m0:a, m1:b, h0:0.05, h1:0.05, type:"seated", seats:rowSeats*len/rl, floor:true}); }
    }
    total += fs; byType.seated += fs;
    parts.push({label:"Floor seats", key:"F", seats:fs, kinds:`${floorRows} rows on the arena floor · flat, so no sightline check`, tiers:[{name:"Ringside floor", type:"seated", rows:floorRows, seats:fs, steep:0, c:null, evac:0, front:floorStart, height:0}]});
  }

  /* ---------- assemble the layout ---------- */
  let closedAt = null;
  const nc = NC(shape);
  const ringGeo = () => densify(linearize(d => closedPathS(F, radius, d, shape), true), 4, set + 6);
  const cornerCfg = (sa, sb, cc) => { const src = [sa, sb].find(x => x.tiers.length && x.roof.shape !== "none");
    return {style:(sa.tiers.length ? sa : sb).style, roof: cc.roof && src ? Object.assign({}, src.roof, {shape: src.roof.shape === "closed" ? "slope" : src.roof.shape, support: src.roof.support === "truss" ? "none" : src.roof.support}) : R("none"), facade:{}}; };
  /* Upper tiers on their own outline, like La Cartuja or the Monumental: the lower tier keeps hugging the play while every
     tier above it is bent, slice by slice, onto an oval or a circle. "ring" puts the front of the upper tiers on the outline;
     "fill" grows the top tier back to it, so the outer wall and roof trace the shape. */
  const OUT = Object.assign({shape:"follow", fit:"ring", size:0}, S.outer || {});
  const nLow = lay === "bowl" ? 1 : S.bowl.tiers.length;
  let shapeT = tiers => tiers;
  const lastBack = pr => { let b = null; for (const p of pr) if (p.rows > 0.5) b = p.back; return b; };
  if (OUT.shape !== "follow" && lay !== "stands"){
    const ring0 = ringGeo(), lowB = lastBack(profile(S.bowl.tiers.slice(0, nLow), set)) || set;
    let A, B;
    if (OUT.fit === "fill"){ // the smallest outline that takes in the back of every stand as built
      const backOf = list => lastBack(profile(list, set)) || lowB;
      const full = s2 => lay === "bowl" ? S.bowl.tiers : S.bowl.tiers.concat(S.stands[s2].tiers);
      const bk = {}; for (const s2 of SIDES) bk[s2] = backOf(full(s2));
      const sideOf = v2 => Math.abs(v2[0]) > Math.abs(v2[1]) ? (v2[0] > 0 ? "E" : "W") : (v2[1] > 0 ? "S" : "N");
      const pts = ring0.o.map((o2, i) => { const d = bk[sideOf(ring0.v[i])]; return [o2[0] + d*ring0.v[i][0], o2[1] + d*ring0.v[i][1]]; });
      const a0 = F.W/2 + Math.max(bk.E, bk.W), b0 = F.H/2 + Math.max(bk.N, bk.S);
      if (OUT.shape === "circle") A = B = Math.max(...pts.map(q => Math.hypot(q[0], q[1])));
      else { const k = Math.max(1, ...pts.map(q => Math.hypot(q[0]/a0, q[1]/b0))); A = a0*k; B = b0*k; }
    } else { // the smallest outline that clears the back of the lower tier all the way round
      const pts = ring0.o.map((o2, i) => [o2[0] + lowB*ring0.v[i][0], o2[1] + lowB*ring0.v[i][1]]);
      if (OUT.shape === "circle") A = B = Math.max(...pts.map(q => Math.hypot(q[0], q[1])));
      else { const a0 = F.W/2 + lowB, b0 = F.H/2 + lowB, k = Math.max(1, ...pts.map(q => Math.hypot(q[0]/a0, q[1]/b0))); A = a0*k; B = b0*k; }
    }
    A += OUT.size || 0; B += OUT.size || 0;
    const hit = (o2, v2) => { // distance along a slice to the outline
      const a = (v2[0]/A)**2 + (v2[1]/B)**2, b = 2*(o2[0]*v2[0]/(A*A) + o2[1]*v2[1]/(B*B)), c = (o2[0]/A)**2 + (o2[1]/B)**2 - 1, disc = b*b - 4*a*c;
      return a > 0 && disc >= 0 ? (-b + Math.sqrt(disc))/(2*a) : null; };
    shapeT = (tiers, o2, v2) => {
      if (tiers.length <= nLow) return tiers;
      const d = hit(o2, v2); if (!(d > 0)) return tiers;
      const tt = tiers.map(x => Object.assign({}, x));
      if (OUT.fit === "fill"){
        const pr = profile(tt, set); let k = pr.length - 1; while (k >= nLow && !(pr[k].rows > 0.5)) k--; if (k < nLow) return tiers;
        tt[k].rows = Math.max(1, Math.min(120, Math.round(tt[k].rows + (d - pr[k].back)/pr[k].T)));
      } else {
        const lb = lastBack(profile(tt.slice(0, nLow), set)); if (lb == null) return tiers;
        tt[nLow].over = Math.max(-60, Math.min(30, lb - d));
      }
      return tt;
    };
  }
  if (lay === "bowl"){
    const ring0 = ringGeo();
    const st = buildSliced({name:"Bowl", key:"B", geo:ring0, cfg:S.bowl, set, tiersFor:i => shapeT(S.bowl.tiers, ring0.o[i], ring0.v[i]), tierRef:k => S.bowl.tiers[k], drawFrom:0, sel: tab === "B"});
    if (st && st.closedAt) closedAt = st.closedAt;
  } else if (lay === "stands"){
    for (const s of SIDES){
      const cfg = S.stands[s]; if (!cfg.tiers.length) continue;
      const [c0, c1] = SIDE_ENDS[s], base = (s === "N" || s === "S") ? F.W/2 + set : F.H/2 + set;
      const e0 = base + (S.corners[c0].mode === "open" ? cfg.extend || 0 : 0), e1 = base + (S.corners[c1].mode === "open" ? cfg.extend || 0 : 0);
      buildSliced({name:SIDE_NAMES[s], key:s, cfg, set: standSet(cfg), tiersFor:() => cfg.tiers, tierRef:k => cfg.tiers[k], drawFrom:0, sel: tab === s,
        geo: densify(linearize(d => sidePath(F, s, d, Math.max(2, e0), Math.max(2, e1)), false), 4, standSet(cfg) + 6)});
    }
    for (const c of CORNERS){
      const cc = S.corners[c.key], mode = cc.mode; if (mode !== "blend" && mode !== "custom") continue;
      const sa = S.stands[c.a], sb = S.stands[c.b]; if (mode === "blend" && !sa.tiers.length && !sb.tiers.length) continue;
      const uA = SIDE_DIR[c.a], uB = SIDE_DIR[c.b], sx = uA[0]||uB[0], sz = uA[1]||uB[1];
      const geo = fanGeo([sx*(F.W/2+set), sz*(F.H/2+set)], uA, uB, shape, set);
      const sA = standSet(sa), sB = standSet(sb);
      buildSliced({name:c.name, key:"C", ck:c.key, geo, cfg:cornerCfg(sa, sb, cc), setFor:i => mode === "custom" ? set : lerp(sA, sB, geo.frac[i]), set,
        tiersFor:i => cornerTiers(c, geo.frac[i]), tierRef: mode === "custom" ? k => S.cornerCustom[k] : null, drawFrom:0, sel: tab === "C", styleLabel:false});
    }
  } else {
    const ring = ringGeo(), total4 = 4*(nc+1);
    const ringT = S.bowl.tiers, rc = ringT.length;
    buildSliced({name:"Lower bowl", key:"B", geo:ring, cfg:Object.assign({}, S.bowl, {roof:R("none")}), set, tiersFor:() => ringT, tierRef:k => S.bowl.tiers[k], drawFrom:0, sel: tab === "B"});
    const split = key => S.corners[key].mode === "split";
    for (const s of SIDES){
      const cfg = S.stands[s]; if (!cfg.tiers.length && cfg.roof.shape === "none") continue;
      const [gb, ga] = SIDE_GROUPS[s], kb = GROUP_KEY[gb], ka = GROUP_KEY[ga];
      const lo = gb*(nc+1) + (split(kb) ? nc/2 : nc), hi = ga*(nc+1) + (split(ka) ? nc/2 : 0);
      const geo = subGeo(ring, lo, hi, total4);
      buildSliced({name:SIDE_NAMES[s], key:s, geo, cfg, set, tiersFor:i => shapeT(ringT.concat(cfg.tiers), geo.o[i], geo.v[i]), tierRef:k => cfg.tiers[k], drawFrom:rc, sel: tab === s});
    }
    for (const c of CORNERS){
      const cc = S.corners[c.key], mode = cc.mode; if (mode !== "blend" && mode !== "custom") continue;
      const sa = S.stands[c.a], sb = S.stands[c.b]; if (mode === "blend" && !sa.tiers.length && !sb.tiers.length) continue;
      if (shape === "square") continue;
      const geo = subGeo(ring, c.g*(nc+1), c.g*(nc+1) + nc, total4);
      buildSliced({name:c.name, key:"C", ck:c.key, geo, cfg:cornerCfg(sa, sb, cc), set, tiersFor:i => shapeT(ringT.concat(cornerTiers(c, geo.frac[i])), geo.o[i], geo.v[i]),
        tierRef: mode === "custom" ? k => S.cornerCustom[k] : null, drawFrom:rc, sel: tab === "C", styleLabel:false});
    }
  }
  let covered = 0;
  if (roofQuads.includes("all")) covered = allRecs.reduce((a,r) => a + r.seats, 0);
  else for (const r of allRecs){ if (roofQuads.some(q => q !== "all" && inPoly([r.x, r.z], q))) covered += r.seats; }
  const farName = F.flag ? "far corner" : (F.home ? "home plate" : "centre");
  if (far > L.maxView){
    const fr = farRef && farRef.ref, rowsDown = []; if (fr) for (let x = fr.rows - 1; x >= 2; x--) rowsDown.push(x);
    issue(`The furthest fan${farRef ? " (back of the " + farRef.name.toLowerCase() + ")" : ""} is ${Math.round(far)} m from the ${farName}. The limit is ${L.maxView} m.`, "far", "view",
      {fix: fr ? {label:"Trim its back rows", run:() => searchFix(v2 => { fr.rows = v2; }, rowsDown, "far")} : null});
  }
  const sext = [Math.max(-bounds[0], bounds[1]), Math.max(-bounds[2], bounds[3])];
  const result = {issues, total, maxH, bounds, covered, minC, slowest, far, restricted, byType, roofNeedMax};
  const screenPlans = planScreens(F, anchors, closedAt, outerTop, set, issue);
  if (DRY) return result;

  // pitchside advertising boards
  if (S.boards && (S.sport === "football" || S.sport === "rugby") && set >= 3){
    const off = Math.min(3, set - 1.2), hx = F.W/2 + off, hz = F.H/2 + off + (S.sport === "football" ? 1 : 0);
    const Pb = [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]];
    ribbon(buf("board"), Pb, Pb, 0, 0.9, true);
  }
  addProps(group, F, buf);
  for (const key in Bf) if (Bf[key].length){
    const mesh = meshFrom(Bf[key], M[key], !["roof","roofGlass","glass","roofClosed","aisle","void","glassClad"].includes(key));
    if (TYPES[key] || key === "floorSeat") mesh.userData.seat = true;
    mesh.userData.stadium = true;
    group.add(mesh);
  }
  if (window.__gwCheck){ let bad = 0, verts = 0; for (const k in Bf){ const arr = Bf[k]; verts += arr.length/3; for (let i=0;i<arr.length;i++) if (!isFinite(arr[i])) bad++; } result.nan = bad; result.verts = verts; }
  const {tex, Wt, Ht} = floorTexture(F, set);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(Wt, Ht), new THREE.MeshStandardMaterial({map:tex, roughness:1}));
  floor.rotation.x = -Math.PI/2; floor.position.y = 0.02; floor.receiveShadow = true; group.add(floor);
  if (S.crowd !== false) addCrowd(allRecs);
  let ext = sext.slice();
  if (poly){
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
    const pl = []; for (let i=1;i<poly.length-1;i++) tri(pl, [poly[0][0],-0.03,poly[0][1]], [poly[i][0],-0.03,poly[i][1]], [poly[i+1][0],-0.03,poly[i+1][1]]);
    group.add(meshFrom(pl, plazaMat, false));
    const edge = [], hb = [], hs = Math.max(1.2, Math.max(...sext)*0.018);
    for (let i=0;i<poly.length;i++){
      const a = poly[i], b = poly[(i+1)%poly.length], dx = b[0]-a[0], dz = b[1]-a[1], l = Math.hypot(dx,dz) || 1, nx2 = -dz/l*0.7, nz2 = dx/l*0.7;
      quad(edge, [a[0]-nx2,0.06,a[1]-nz2], [b[0]-nx2,0.06,b[1]-nz2], [b[0]+nx2,0.06,b[1]+nz2], [a[0]+nx2,0.06,a[1]+nz2]);
      for (let s=0;s<=l;s+=6) post(edge, a[0]+dx/l*s, a[1]+dz/l*s, 0, 1.4, 0.18);
      post(hb, a[0], a[1], 0, hs*2.2, hs*1.6);
      post(hb, (a[0]+b[0])/2, (a[1]+b[1])/2, 0, hs*1.4, hs*1.1);
    }
    group.add(meshFrom(edge, M.site, false)); group.add(meshFrom(hb, M.handle, false));
    ext = [Math.max(ext[0], ...xs.map(Math.abs)), Math.max(ext[1], ...zs.map(Math.abs))];
  }
  const A = S.arch || {}, B2 = {}, buf2 = k => (B2[k] = B2[k] || []);
  const archTop = addArchitecture(F, A, outline, outerTop, poly, standInfo, set, sext, buf2, ext);
  result.maxH = Math.max(result.maxH, archTop);
  if (window.__gwCheck){ let bad = 0; for (const k in B2) for (const v of B2[k]) if (!isFinite(v)) bad++; group.traverse(o => { const a = o.geometry && o.geometry.attributes && o.geometry.attributes.position; if (a && a.array) for (const v of a.array) if (!isFinite(v)) bad++; }); result.archNan = bad; }
  const fm = floodMode();
  drawScreens(screenPlans, buf2, anchors);
  if (fm === "roof") roofLights(anchors, buf2, F);
  if (fm === "masts" || fm === "pylons"){
    const mh = Math.max(maxH + 16, 30);
    for (const sx of [-1,1]) for (const sz of [-1,1]){
      const x = sx*(sext[0]+8), z = sz*(sext[1]+8);
      if (fm === "pylons") pylon(buf2, x, z, mh);
      else { const mm = new THREE.Mesh(new THREE.CylinderGeometry(.6,1.1,mh,10), M.mast); mm.position.set(x,mh/2,z); mm.castShadow = true; group.add(mm); }
      const head = new THREE.Mesh(new THREE.BoxGeometry(10,6,1), M.lamp); head.position.set(x, mh+2, z); head.lookAt(0,0,0); group.add(head);
      if (S.night){ const sp = new THREE.SpotLight(0xfff4dc, 1.25, 0, 0.75, 0.6, 1); sp.position.set(x, mh+2, z); sp.target.position.set(-sx*F.W*0.15, 0, -sz*F.H*0.15); group.add(sp); group.add(sp.target); }
    }
  }
  for (const key in B2) if (B2[key].length){ const mesh = meshFrom(B2[key], M[key], !["glass","roofGlass"].includes(key)); mesh.userData.stadium = true; group.add(mesh); }
  // drag handles for the selected stand
  if (handles.length){ const r = Math.max(0.9, Math.max(...sext)*0.012);
    for (const h of handles){ const s2 = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M.hball); s2.position.set(h.x, h.y, h.z); s2.userData.handle = h; s2.renderOrder = 5; group.add(s2); } }
  if (S.night && (fm === "none" || closedAt)){ // arena rig or roof-mounted lights over the play
    const pl = new THREE.PointLight(0xfff4dc, 1.3, 0, 1); pl.position.set(0, Math.max(18, (closedAt || maxH) - 2), 0); group.add(pl);
    const pl2 = new THREE.PointLight(0xfff0d8, 0.5, 0, 1); pl2.position.set(0, Math.max(30, maxH + 10), 0); group.add(pl2); }
  applyMood();
  const sc = sun.shadow.camera, half = Math.max(ext[0],ext[1]) + 30;
  sc.left=-half; sc.right=half; sc.top=half; sc.bottom=-half; sc.near=10; sc.far=1400; sc.updateProjectionMatrix();
  const screenSpots = []; for (const p of screenPlans) screenSpots[p.idx] = [p.x, p.y, p.z];
  LAST = Object.assign(result, {closedAt, focusIn, F, farName, ext, sext, parts, set, steepInfo, poly, lay, standInfo, handles, screenSpots});
  LAST_REGIONS = regions;
  renderStats(); refreshOutputs(); invalidate();
  return result;
}
/* Fixing a flag: try candidate values with a quick behind-the-scenes rebuild until that flag clears. */
let DRY = false;
function dryRun(){ DRY = true; let r; try { r = build(); } finally { DRY = false; } return r; }
function dryIssues(){ return dryRun().issues; }
function searchFix(apply, values, key){
  const snap = JSON.stringify(S);
  for (const v of values){ apply(v); if (!dryIssues().some(i => i.key === key)) return true; }
  S = JSON.parse(snap); return false;
}
