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
  const d = [q[0]-p[0], q[1]-p[1], q[2]-p[2]], L = Math.hypot(...d); if (!(L > 1e-6)) return; d[0]/=L; d[1]/=L; d[2]/=L; // nothing to draw between two points that coincide
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
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.keep = true; return (skinTex[kind] = t);
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
