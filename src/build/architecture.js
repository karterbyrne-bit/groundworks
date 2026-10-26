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
/* Where the arch (or arches) goes: each span with its line across the ground, its lean and rise, the centre line C(u) from
   one foot (u = 0) to the other (u = 1), and its thickness. Shared by the drawing and the check on obstructed views. */
function archSpans(A, F, set, sext, H, standInfo){
  if (!A || !A.arch) return [];
  const at = A.archAt || "main", dN = standInfo.N ? standInfo.N.depth : 20, spans = [];
  if (at === "main"){ const span = Math.max(60, 2*sext[0] + 20); spans.push({a:[-span/2, -(F.H/2 + set + dN*0.55)], span, lean:18*Math.PI/180, out:[0, -1], rise:Math.max(H*2.2, span*0.36)}); }
  else { const ex = sext[0] + 12, ez = sext[1] + 12, span = 2*Math.hypot(ex, ez), rise = Math.max(H*2, span*0.3);
    spans.push({a:[-ex, -ez], b:[ex, ez], span, lean:0, rise});
    if (at === "cross") spans.push({a:[-ex, ez], b:[ex, -ez], span, lean:0, rise:rise*1.07}); } // the second a little higher, so they pass
  for (const sp of spans){ const b = sp.b || [sp.a[0] + sp.span, sp.a[1]], out = sp.out || [0, 0]; sp.dx = (b[0] - sp.a[0])/sp.span; sp.dz = (b[1] - sp.a[1])/sp.span; sp.r0 = Math.max(2.4, sp.span*0.011);
    sp.C = u => { const y = sp.rise*Math.pow(Math.max(0, 1 - Math.pow(2*u - 1, 2)), 0.85);
      return new THREE.Vector3(sp.a[0] + sp.dx*sp.span*u + out[0]*y*Math.sin(sp.lean), y*Math.cos(sp.lean), sp.a[1] + sp.dz*sp.span*u + out[1]*y*Math.sin(sp.lean)); }; }
  return spans;
}
/* Statues outside the main entrance: up to four generic bronze figures on stone plinths, each in its own pose (arms raised
   in triumph, pointing, striding onto a ball, hands on hips). Nobody in particular. All of them one merged mesh. */
function addStatues(n, bounds, poly, bf){
  const s = 1.25, ph = 2.2;
  for (let k=0;k<n;k++){
    let x = (k - (n - 1)/2)*9, z = bounds[2] - 7;
    if (poly && !inPoly([x, z], poly)){ z = bounds[2] - 3; if (!inPoly([x, z], poly)) continue; } // kept on the plot
    post(bf("stone"), x, z, 0, ph, 2.2); post(bf("stone"), x, z, ph, ph + .25, 2.6); // the plinth and its cap
    const y0 = ph + .25, P = (dx, dy, dz) => [x + dx*s, y0 + dy*s, z - dz*s], b = bf("bronze"); // facing out, away from the ground
    const sh = P(0, 1.47, 0), shL = P(-.25, 1.44, 0), shR = P(.25, 1.44, 0), hipL = P(-.12, .95, 0), hipR = P(.12, .95, 0), pose = k % 4;
    const [fL, fR, hL, hR] = pose === 0 ? [P(-.24, 0, 0), P(.24, 0, 0), P(-.6, 2.05, .1), P(.6, 2.05, .1)]   // arms up
      : pose === 1 ? [P(-.15, 0, -.05), P(.17, 0, .1), P(-.3, .85, 0), P(.35, 1.55, .75)]                     // pointing
      : pose === 2 ? [P(-.12, 0, -.35), P(.16, .1, .45), P(-.45, 1.05, .25), P(.45, 1.05, -.3)]               // striding onto a ball
      : [P(-.2, 0, 0), P(.2, 0, 0), P(-.38, 1.0, -.05), P(.38, 1.0, -.05)];                                    // hands on hips
    bar(b, P(0, .9, 0), sh, .46); bar(b, P(0, 1.56, 0), P(0, 1.9, 0), .27); // body and head
    bar(b, hipL, fL, .19); bar(b, hipR, fR, .19); bar(b, shL, hL, .14); bar(b, shR, hR, .14);
    if (pose === 3){ bar(b, hL, P(-.12, .95, 0), .13); bar(b, hR, P(.12, .95, 0), .13); } // elbows out, hands on hips
    if (pose === 2){ const f = P(.2, .1, .62); post(b, f[0], f[2], y0, y0 + .28*s, .28*s); } // the ball
  }
}
/* Many round members (lattice steel, cables) as one smooth-shaded mesh: each [from, to, radius] becomes a short tube. */
function tubesMesh(list, sides, mat){
  const pos = [], nor = [], idx = [], up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), nrm = new THREE.Vector3(), d = new THREE.Vector3(), q = new THREE.Vector3();
  for (const [a, b, r] of list){
    d.subVectors(b, a); if (d.lengthSq() < 1e-8) continue; d.normalize();
    side.crossVectors(d, Math.abs(d.y) > .95 ? new THREE.Vector3(1, 0, 0) : up).normalize(); nrm.crossVectors(side, d);
    const base = pos.length/3;
    for (let k=0;k<sides;k++){ const t = k/sides*Math.PI*2; q.copy(side).multiplyScalar(Math.cos(t)).addScaledVector(nrm, Math.sin(t));
      pos.push(a.x + q.x*r, a.y + q.y*r, a.z + q.z*r, b.x + q.x*r, b.y + q.y*r, b.z + q.z*r); nor.push(q.x, q.y, q.z, q.x, q.y, q.z); }
    for (let k=0;k<sides;k++){ const i0 = base + 2*k, j0 = base + 2*((k + 1)%sides); idx.push(i0, j0, i0 + 1, i0 + 1, j0, j0 + 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
/* The nearest point on any stand's roof front edge to [x, z] (within reach metres), as [x, y, z]: where an arch's cables land. */
function roofFrontNear(anchors, x, z, reach){
  let best = null, bd = reach*reach;
  for (const g of anchors || []) for (let i=0;i<g.m;i++){ const R = g.RR && g.RR[i]; if (!R) continue;
    const px = g.o[i][0] + g.v[i][0]*R.inner, pz = g.o[i][1] + g.v[i][1]*R.inner, d = (px - x)*(px - x) + (pz - z)*(pz - z);
    if (d < bd){ bd = d; best = [px, R.y(0), pz]; } }
  return best;
}
function addArchitecture(F, A, outline, outerTop, poly, standInfo, set, sext, bf, ext, anchors){
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
  /* Spiral ramps, San Siro style: an open helix of concrete deck round an empty middle, held up on slim columns, with a
     parapet and a steel rail on each edge, and a short bridge across to the stand at every level. */
  if (A.ramps){
    const count = Math.max(4, Math.min(10, Math.round(perim/90))), R0 = 4.5, R1 = 10.5, h = H*0.92, turns = Math.max(1.5, h/8), gap = 3.5, per = 32;
    for (let t=0;t<count;t++){
      const i = Math.floor((t + 0.5)*n/count), c = [P[i][0] + N[i][0]*(R1 + gap), P[i][1] + N[i][1]*(R1 + gap)];
      const segs = Math.round(turns*per), ph = Math.atan2(-N[i][1], -N[i][0]);
      const at = (q, r, y) => [c[0] + Math.cos(q)*r, y, c[1] + Math.sin(q)*r];
      for (let s=0;s<segs;s++){ const q0 = ph + s/per*Math.PI*2, q1 = ph + (s+1)/per*Math.PI*2, y0 = h*s/segs, y1 = h*(s+1)/segs;
        quad(bf("concrete"), at(q0,R0,y0), at(q1,R0,y1), at(q1,R1,y1), at(q0,R1,y0)); // the deck
        quad(bf("soffit"), at(q0,R0,y0-.45), at(q0,R1,y0-.45), at(q1,R1,y1-.45), at(q1,R0,y1-.45));
        for (const [r, hp, wall] of [[R1, 1.1, true], [R0, .95, true]]){ // parapets, outside and in, with a rail along the top
          quad(bf("concrete"), at(q0,r,y0-.45), at(q1,r,y1-.45), at(q1,r,y1+hp), at(q0,r,y0+hp));
          quad(bf("concrete"), at(q0,r,y0+hp), at(q1,r,y1+hp), at(q1,r - Math.sign(r - (R0+R1)/2)*.22,y1+hp), at(q0,r - Math.sign(r - (R0+R1)/2)*.22,y0+hp));
          if (wall) quad(bf("steel"), at(q0,r,y0+hp+.25), at(q1,r,y1+hp+.25), at(q1,r,y1+hp+.31), at(q0,r,y0+hp+.31));
          if (s % 4 === 0){ const p = at(q0, r, y0); post(bf("steel"), p[0], p[2], y0+hp, y0+hp+.31, .05); } } }
      for (let k=0;k<12;k++){ const q = ph + k/12*Math.PI*2; // slim columns round both edges instead of a solid drum
        for (const r of [R0 + .4, R1 - .4]){ const p = at(q, r, 0); post(bf("column"), p[0], p[2], 0, h, .45); } }
      // a bridge to the stand each time the ramp comes round to face it
      for (let k=1;k<=Math.floor(turns);k++){ const y = h*k/turns, a = at(ph, R1, y), b = [P[i][0] + N[i][0]*.2, y, P[i][1] + N[i][1]*.2];
        const sd = [-N[i][1]*1.6, N[i][0]*1.6];
        quad(bf("concrete"), [a[0]-sd[0],y,a[2]-sd[1]], [a[0]+sd[0],y,a[2]+sd[1]], [b[0]+sd[0],y,b[2]+sd[1]], [b[0]-sd[0],y,b[2]-sd[1]]);
        quad(bf("soffit"), [a[0]-sd[0],y-.45,a[2]-sd[1]], [b[0]-sd[0],y-.45,b[2]-sd[1]], [b[0]+sd[0],y-.45,b[2]+sd[1]], [a[0]+sd[0],y-.45,a[2]+sd[1]]);
        for (const sg of [-1, 1]){ const e = [sd[0]*sg, sd[1]*sg];
          quad(bf("concrete"), [a[0]+e[0],y-.45,a[2]+e[1]], [b[0]+e[0],y-.45,b[2]+e[1]], [b[0]+e[0],y+1.05,b[2]+e[1]], [a[0]+e[0],y+1.05,a[2]+e[1]]); } }
      ext[0] = Math.max(ext[0], Math.abs(c[0]) + R1); ext[1] = Math.max(ext[1], Math.abs(c[1]) + R1); }
    top = Math.max(top, H + 2);
  }
  /* Twin entrance towers on the main (north) side: tapered shafts with bands of windows and ribs up the corners, a
     stepped top with a glass lantern and a mast, and a block joining each to the stand behind. */
  if (A.towers){
    let bi = 0; for (let i=0;i<n;i++) if (P[i][1] < P[bi][1] - 1e-6 || (Math.abs(P[i][1] - P[bi][1]) < 1e-6 && Math.abs(P[i][0]) < Math.abs(P[bi][0]))) bi = i;
    const zc = P[bi][1] - 11, hT = H + 14, w0 = 10, w1 = 7;
    // a square shaft from half-width a at y0 to half-width b at y1, round (x, z)
    const shaft = (key, x, z, a, b, y0, y1, out) => { for (const [dx, dz] of [[1,0],[0,1],[-1,0],[0,-1]]){ const tx = -dz, tz = dx, o = out || 0;
      const A0 = [x + dx*(a+o) - tx*a, y0, z + dz*(a+o) - tz*a], B0 = [x + dx*(a+o) + tx*a, y0, z + dz*(a+o) + tz*a];
      const A1 = [x + dx*(b+o) - tx*b, y1, z + dz*(b+o) - tz*b], B1 = [x + dx*(b+o) + tx*b, y1, z + dz*(b+o) + tz*b];
      quad(bf(key), A0, B0, B1, A1); }
      quad(bf(key), [x-b,y1,z-b], [x+b,y1,z-b], [x+b,y1,z+b], [x-b,y1,z+b]); };
    const wAt = y => w0/2 + (w1/2 - w0/2)*y/hT;
    for (const sx of [-1, 1]){ const x = sx*Math.max(14, (F.W/2)*0.35);
      if (poly && !inPoly([x, zc], poly)) continue;
      shaft("white", x, zc, w0/2, w1/2, 0, hT);
      for (let y = 4; y < hT - 2; y += 4.2) shaft("window", x, zc, wAt(y)*.86, wAt(y + 1.4)*.86, y, y + 1.4, wAt(y)*.15 + .04); // window bands
      for (const [cx, cz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){ const r0 = w0/2 + .15, r1 = w1/2 + .15; // ribs up the corners
        quad(bf("concrete"), [x + cx*r0 - cx*.5, 0, zc + cz*r0], [x + cx*r0, 0, zc + cz*r0 - cz*.5], [x + cx*r1, hT, zc + cz*r1 - cz*.5], [x + cx*r1 - cx*.5, hT, zc + cz*r1]); }
      shaft("concrete", x, zc, w1/2 + .5, w1/2 + .5, hT, hT + 1.2); shaft("white", x, zc, w1/2 - .4, w1/2 - .7, hT + 1.2, hT + 3.4);
      shaft("glassClad", x, zc, w1/2 - 1.3, w1/2 - 1.3, hT + 3.4, hT + 6); shaft("roofEdge", x, zc, w1/2 - .9, w1/2 - .9, hT + 6, hT + 6.5);
      post(bf("steel"), x, zc, hT + 6.5, hT + 13, .25);
      const zb = P[bi][1] + 1, zf = zc + wAt(0)*.9; // the link back to the stand
      if (zb > zf){ const lw = 2.4, lh = Math.min(hT*0.55, H - 1);
        quad(bf("concrete"), [x-lw,0,zf], [x-lw,0,zb], [x-lw,lh,zb], [x-lw,lh,zf]); quad(bf("concrete"), [x+lw,0,zb], [x+lw,0,zf], [x+lw,lh,zf], [x+lw,lh,zb]);
        quad(bf("roofEdge"), [x-lw,lh,zf], [x-lw,lh,zb], [x+lw,lh,zb], [x+lw,lh,zf]);
        for (let y = 3; y < lh - 1; y += 4.2){ quad(bf("window"), [x-lw-.05,y,zf], [x-lw-.05,y,zb], [x-lw-.05,y+1.4,zb], [x-lw-.05,y+1.4,zf]); quad(bf("window"), [x+lw+.05,y,zb], [x+lw+.05,y,zf], [x+lw+.05,y+1.4,zf], [x+lw+.05,y+1.4,zb]); } }
      ext[1] = Math.max(ext[1], Math.abs(zc) + 7); }
    top = Math.max(top, H + 27);
  }
  /* The arch: a steel lattice tube like Wembley's, tapering a little towards the crown, standing on sculpted concrete feet
     that flare into the ground, with round cables fanning down to the roofs' front edges. Over the main stand (leaning
     back, as Wembley's does), diagonally across the whole ground, or two arches crossing. A soft glow runs along it at
     night. Every member of every arch goes into one merged mesh, so it's a single draw for a phone however much steel. */
  if (A.arch){
    const at = A.archAt || "main", spans = archSpans(A, F, set, sext, H, standInfo);
    const steel = [], cables = [], glow = [], fx = F.W/2 + set, fz = F.H/2 + set;
    for (const sp of spans){
      const {dx, dz, C} = sp, r0 = sp.r0; radius = u => r0*(1 - 0.32*C(u).y/sp.rise), K = 6, Mseg = 64, rings = [];
      for (let m=0;m<=Mseg;m++){ const u = .02 + .96*m/Mseg, p = C(u), tng = C(Math.min(1, u + .004)).sub(C(Math.max(0, u - .004))).normalize();
        const side = new THREE.Vector3().crossVectors(tng, new THREE.Vector3(0, 1, 0)).normalize(), nrm = new THREE.Vector3().crossVectors(side, tng).normalize(), r = radius(u);
        rings.push({p, tng, pts: Array.from({length: K}, (_, k) => p.clone().addScaledVector(side, Math.cos(k/K*Math.PI*2)*r).addScaledVector(nrm, Math.sin(k/K*Math.PI*2)*r))}); }
      const mw = Math.max(.16, r0*.07);
      rings.forEach((R, m) => { for (let k=0;k<K;k++){ const q = R.pts[k], q2 = R.pts[(k+1)%K];
        steel.push([q, q2, mw*.6]); // the ring
        if (m < Mseg){ const nx = rings[m+1].pts; steel.push([q, nx[k], mw]); steel.push([q, nx[(k + (m%2 ? 1 : K-1))%K], mw*.55]); } } }); // chords and zigzag bracing
      if (S.night) for (let m=0;m<Mseg;m++) glow.push([rings[m].p, rings[m+1].p, r0*.18]);
      // feet: a flared concrete pedestal where each end meets the ground
      for (const u of [.02, .98]){ const p = C(u), foot = new THREE.Mesh(new THREE.LatheGeometry(Array.from({length: 9}, (_, k) => { const f = k/8;
          return new THREE.Vector2(r0*1.15 + r0*2.4*Math.pow(1 - f, 2.2), f*Math.max(4, p.y + 4)); }), 24), M.concrete);
        foot.position.set(p.x, 0, p.z); foot.castShadow = foot.receiveShadow = true; foot.userData.stadium = true; group.add(foot); }
      // cables from the arch down to the roof fronts: straight down the line for the main stand, out to both sides across the ground
      for (let m=6;m<=Mseg-6;m+=3){ const p = rings[m].p;
        const land = (x, z) => { const q = roofFrontNear(anchors, x, z, 30); return q ? new THREE.Vector3(q[0], q[1], q[2]) : new THREE.Vector3(x, Math.max(4, H*0.92), z); }; // onto the roof's front edge
        if (at === "main"){ cables.push([p, land(p.x*0.96, -fz - 1.5), .11]); continue; }
        if (Math.abs(p.x) >= fx || Math.abs(p.z) >= fz) continue; // over the stands themselves
        const pr = [-dz, dx]; for (const sg of [-1, 1]){ const tx = pr[0]*sg, tz = pr[1]*sg;
          const t = Math.min(tx ? (Math.sign(tx)*fx - p.x)/tx : Infinity, tz ? (Math.sign(tz)*fz - p.z)/tz : Infinity);
          cables.push([p, land(p.x + tx*t, p.z + tz*t), .11]); } }
      top = Math.max(top, sp.rise*Math.cos(sp.lean) + r0); }
    for (const [list, mat, sides] of [[steel, M.steel, 6], [cables, M.cable, 8], [glow, M.archGlow, 8]]) if (list.length){
      const mesh = tubesMesh(list, sides, mat); mesh.castShadow = mat !== M.archGlow; mesh.userData.stadium = true; group.add(mesh); }
  }
  return top;
}
