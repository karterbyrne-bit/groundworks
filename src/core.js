function field(){
  if (S.sport === "custom"){
    const c = S.custom, k = KINDS[c.kind] || KINDS.plain, r = Math.min(c.r, c.W/2, c.H/2);
    return {W:c.W, H:c.H, r, custom:true, kind:c.kind, surface:c.surface, focusY:k.focusY || 0, zones:k.zones, note:k.note};
  }
  return SPORTS[S.sport];
}
function layoutOf(){
  const F = field();
  if (F.standsOnly) return "stands";
  if (F.noStands && S.layout === "stands") return "bowl";
  return S.layout;
}
const isBowl = () => layoutOf() === "bowl";
const isHybrid = () => layoutOf() === "hybrid";

/* ================= geometry helpers =================
   Every stand is a strip of slices. Slice i sits at o[i] + d·v[i], where d is the distance out from the edge of play,
   so a row at depth d is the polyline through all slices at that d. Each slice gets its own tier stack, which lets
   stands blend, follow a bowl's curve, or be chopped by a site boundary independently along their length. */
const NC = shape => shape === "curved" ? 14 : 2;
function closedPathS(F, rr, d, shape){
  const nc = NC(shape), a = F.W/2 + d, b = F.H/2 + d;
  const r = shape === "square" ? 0 : Math.min(shape === "angled" ? rr + d*(2-Math.SQRT2) : rr + d, a, b);
  const cx = a - r, cz = b - r, pts = [];
  for (const [x0,z0,s] of [[cx,cz,0],[-cx,cz,90],[-cx,-cz,180],[cx,-cz,270]])
    for (let i=0;i<=nc;i++){
      if (shape === "curved"){ const q = (s + 90*i/nc)*Math.PI/180; pts.push([x0 + r*Math.cos(q), z0 + r*Math.sin(q)]); }
      else { const q0 = s*Math.PI/180, q1 = (s+90)*Math.PI/180, f = i/nc;
        const p0 = [x0 + r*Math.cos(q0), z0 + r*Math.sin(q0)], p1 = [x0 + r*Math.cos(q1), z0 + r*Math.sin(q1)];
        pts.push([p0[0] + (p1[0]-p0[0])*f, p0[1] + (p1[1]-p0[1])*f]); }
    }
  return pts;
}
function linearize(fn, closed){
  const p0 = fn(0), p1 = fn(1);
  return {o:p0, v:p1.map((p,i) => [p[0]-p0[i][0], p[1]-p0[i][1]]), closed, tag:p0.map((_,i) => i)};
}
const lerp2 = (a,b,f) => [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f];
function densify(geo, step, dRef){
  const {o, v, closed} = geo, n = o.length, segs = closed ? n : n-1, O = [], V = [], tag = [];
  for (let i=0;i<segs;i++){
    const j = (i+1)%n, a = [o[i][0]+dRef*v[i][0], o[i][1]+dRef*v[i][1]], b = [o[j][0]+dRef*v[j][0], o[j][1]+dRef*v[j][1]];
    const k = Math.max(1, Math.round(Math.hypot(b[0]-a[0], b[1]-a[1]) / step));
    for (let s=0;s<k;s++){ const f = s/k; O.push(lerp2(o[i],o[j],f)); V.push(lerp2(v[i],v[j],f)); tag.push(geo.tag[i] + f*((closed && j === 0 ? n : geo.tag[j]) - geo.tag[i])); }
  }
  if (!closed){ O.push(o[n-1]); V.push(v[n-1]); tag.push(geo.tag[n-1]); }
  return {o:O, v:V, closed, tag};
}
/* An open strip of a closed ring between two original indices (wrapping round if needed). */
function subGeo(ring, lo, hi, total){
  const idx = [];
  if (hi >= lo){ ring.tag.forEach((tg,i) => { if (tg >= lo - 1e-6 && tg <= hi + 1e-6) idx.push(i); }); }
  else {
    ring.tag.forEach((tg,i) => { if (tg >= lo - 1e-6) idx.push(i); });
    ring.tag.forEach((tg,i) => { if (tg <= hi + 1e-6) idx.push(i); });
  }
  if (hi < lo || idx.length === 0) {}
  return {o:idx.map(i => ring.o[i]), v:idx.map(i => ring.v[i]), closed:false, tag:idx.map(i => ring.tag[i]), frac:idx.map(i => { const tg = ring.tag[i]; return hi >= lo ? (tg - lo)/Math.max(1e-9, hi - lo) : ((tg >= lo ? tg - lo : tg + total - lo) / (hi + total - lo)); })};
}
/* Corner fan between two separate stands. The shape scales each ray so rows form an arc, a chamfer or a right angle. */
function fanGeo(C, uA, uB, shape, set){
  const n = 14, o = [], v = [], frac = [];
  for (let i=0;i<=n;i++){
    const q = i/n*Math.PI/2, c = Math.cos(q), s = Math.sin(q);
    const k = shape === "angled" ? 1/(c + s) : shape === "square" ? 1/Math.max(c, s) : 1;
    const dir = [(c*uA[0] + s*uB[0])*k, (c*uA[1] + s*uB[1])*k];
    v.push(dir); o.push([C[0] - set*dir[0], C[1] - set*dir[1]]); frac.push(i/n);
  }
  return {o, v, closed:false, frac};
}
/* A separate stand's front edge at depth d. eStart/eEnd are how far it runs either side of the centre line. */
function sidePath(F, side, d, eStart, eEnd){
  const hx = F.W/2, hz = F.H/2;
  if (side==="N") return [[-eStart,-hz-d],[eEnd,-hz-d]];
  if (side==="S") return [[eStart,hz+d],[-eEnd,hz+d]];
  if (side==="E") return [[hx+d,-eStart],[hx+d,eEnd]];
  return [[-hx-d,eStart],[-hx-d,-eEnd]];
}
const SIDE_DIR = {N:[0,-1],S:[0,1],E:[1,0],W:[-1,0]};
function polyLen(Pts, closed){
  let L = 0; const n = Pts.length, segs = closed ? n : n-1;
  for (let i=0;i<segs;i++){ const a=Pts[i], b=Pts[(i+1)%n]; L += Math.hypot(b[0]-a[0], b[1]-a[1]); }
  return L;
}
function capRow(L, type){
  const sz = S.types[type];
  if (type === "terrace") return Math.floor(L * sz.row * sz.density * 0.9);
  const g = S.design, unit = g.gangEvery*sz.width + g.gangWidth, full = Math.floor(L/unit);
  const rem = L - full*unit - g.gangWidth;
  return Math.floor((full*g.gangEvery + Math.max(0, Math.floor(rem/sz.width))) * 0.95);
}
function quad(buf,a,b,c,d){ buf.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2], a[0],a[1],a[2],c[0],c[1],c[2],d[0],d[1],d[2]); }
function tri(buf,a,b,c){ buf.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]); }
function ribbon(buf,A,B,yA,yB,closed){
  const n = A.length, segs = closed ? n : n-1;
  for (let i=0;i<segs;i++){ const j=(i+1)%n;
    quad(buf,[A[i][0],yA,A[i][1]],[A[j][0],yA,A[j][1]],[B[j][0],yB,B[j][1]],[B[i][0],yB,B[i][1]]); }
}
function post(buf, x, z, y0, y1, w){
  const h = w/2, c = [[x-h,z-h],[x+h,z-h],[x+h,z+h],[x-h,z+h]];
  for (let i=0;i<4;i++){ const a=c[i], b=c[(i+1)%4]; quad(buf,[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]]); }
  quad(buf,[c[0][0],y1,c[0][1]],[c[1][0],y1,c[1][1]],[c[2][0],y1,c[2][1]],[c[3][0],y1,c[3][1]]);
}
/* Stack tiers. Each tier above the first starts at the back of the tier below, minus its overhang (so it projects forward over the lower seats),
   and sits its gap above the lower tier's back row. Auto tiers rise row by row just enough to keep the sightline at the rule, capped at the steepness limit.
   Ghost tiers are laid out but not built: they hold an upper tier up in the air over an open space (a corner, say). */
let focusY = 0, focusIn = 0;
function profile(tiers, set){
  const out = []; let started = false, prevBack = 0, prevBackH = 0, prevFront = 0, prevGhost = false, firstFront = set;
  const targetC = (S.limits.minC + 5)/1000;
  tiers.forEach((tr,k) => {
    const T = S.types[tr.type].row, eye = TYPES[tr.type].eye, fixedN = T*Math.tan(tr.rake*Math.PI/180);
    let front, hF, stacked;
    if (!started){ front = set; hF = (tr.type === "terrace" ? 0.4 : 1.1) + focusY*0.6; stacked = false; }
    else { front = Math.max(firstFront + 1, prevBack - (tr.over == null ? 0 : tr.over)); hF = prevBackH + Math.max(1.2, tr.gap == null ? 3 : tr.gap); stacked = true; }
    const rows = Math.max(0, tr.rows), back = front + rows*T, n = Math.ceil(rows - 1e-6);
    const hs = []; let maxN = 0;
    for (let j=0;j<n;j++){
      if (j === 0){ hs.push(hF); continue; }
      let N = fixedN;
      if (tr.auto){ const D = front + focusIn + (j-1)*T + 0.3, R0 = hs[j-1] + eye - focusY;
        const capN = T*Math.tan((tr.type === "terrace" ? S.limits.terraceRake : S.limits.seatRake)*Math.PI/180);
        N = Math.min(capN, Math.max(0.1, (targetC + R0)*(D + T)/D - R0)); }
      hs.push(hs[j-1] + N); maxN = Math.max(maxN, N);
    }
    const steep = n > 1 ? Math.atan(maxN/T)*180/Math.PI : (tr.auto ? 0 : tr.rake);
    out.push({k, type:tr.type, T, rake:tr.rake, auto:!!tr.auto, steep, hs, rows, front, back, hF, hB: hs.length ? hs[hs.length-1] : hF, stacked,
      over: stacked ? prevBack - front : 0, gap: stacked ? hF - prevBackH : 0, ghost:!!tr.ghost, pillars:!!tr.pillars,
      lowerBack:prevBack, lowerBackH:prevBackH, lowerFront:prevFront, lowerGhost: stacked && prevGhost});
    if (rows > 0.5){ if (!started) firstFront = front; started = true; prevBack = back; prevBackH = hs.length ? hs[hs.length-1] : hF; prevFront = front; prevGhost = !!tr.ghost; }
  });
  return out;
}
function trimTiers(tiers, dmax, set){
  const out = [];
  for (const tr of tiers){
    const cand = out.concat([Object.assign({}, tr)]), p = profile(cand, set), last = p[p.length-1];
    cand[cand.length-1].rows = Math.min(tr.rows, Math.max(0, Math.floor((dmax - last.front)/last.T + 1e-6)));
    out.push(cand[cand.length-1]);
  }
  return out;
}
const nRows = p => p ? Math.floor(p.rows + 1e-6) : 0;
function heightAt(prof, d){
  for (const p of prof){ const n = nRows(p); if (n < 1 || p.ghost) continue;
    if (d >= p.front && d <= p.front + n*p.T) return p.hs[Math.min(n-1, Math.floor((d - p.front)/p.T))]; }
  return 0;
}
function tierName(k, n, above){
  if (above) return n === 1 ? "upper" : (n === 2 ? ["middle","upper"] : ["second","third","top"])[k];
  return n === 1 ? "" : (n === 2 ? ["lower","upper"] : ["lower","middle","upper"])[k];
}
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
/* site polygon helpers */
const cross = (a,b) => a[0]*b[1] - a[1]*b[0];
function inPoly(p, poly){
  let ins = false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
/* How far out a slice can go before it hits the boundary. */
function exitDist(poly, o, v, d0){
  const p0 = [o[0]+d0*v[0], o[1]+d0*v[1]];
  if (!inPoly(p0, poly)) return d0 - 0.01;
  let best = 1e4;
  for (let i=0;i<poly.length;i++){
    const A = poly[i], B = poly[(i+1)%poly.length], E = [B[0]-A[0], B[1]-A[1]], den = cross(v, E);
    if (Math.abs(den) < 1e-12) continue;
    const w = [A[0]-o[0], A[1]-o[1]], d = cross(w, E)/den, s = cross(w, v)/den;
    if (s >= -1e-9 && s <= 1+1e-9 && d > d0 + 1e-9) best = Math.min(best, d);
  }
  return best;
}

/* ================= three.js scene ================= */
const view = document.getElementById("view");
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.insertBefore(renderer.domElement, view.firstChild);
/* Draw only when something has changed, so an idle stadium doesn't drain a phone or laptop battery. */
let dirty = 2;
function invalidate(){ dirty = 2; }
const scene = new THREE.Scene();
const persp = new THREE.PerspectiveCamera(42, 1, 0.2, 8000), ortho = new THREE.OrthographicCamera(-50, 50, 50, -50, -4000, 8000);
let camera = persp;
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI*0.48; controls.autoRotateSpeed = 0.6;
controls.addEventListener("change", invalidate);
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a554c, 0.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.25); fill.position.set(-120, 80, -140); scene.add(fill);
sun.position.set(140, 260, 90); sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias = -0.0004;
scene.add(sun);
const groundMat = new THREE.MeshStandardMaterial({color:0xc3cbc0, roughness:1});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000,6000), groundMat);
ground.rotation.x = -Math.PI/2; ground.position.y = -0.06; ground.receiveShadow = true; scene.add(ground);
const plazaMat = new THREE.MeshStandardMaterial({color:0xd4d8d1, roughness:1});

const DS = THREE.DoubleSide;
const std = (o) => new THREE.MeshStandardMaterial(Object.assign({side:DS, roughness:.8}, o));
const M = {
  seated: std({color:0xc3322b, roughness:.6}), seatAlt: std({color:0xf2f2f2, roughness:.6}), seatAltBack: std({color:0xdedede, roughness:.55}), band: std({color:0x1b1f22, roughness:.9}), seatBack: std({color:0xc3322b, roughness:.55}),
  exec: std({color:0x333333, roughness:.45}), rail: std({color:0xc3322b, roughness:.6}),
  bench: std({color:0xb9c1c7, roughness:.35, metalness:.55}),
  terrace: std({color:0xa7aba3, roughness:.95}), floorSeat: std({color:0x2c3135, roughness:.6}),
  aisle: std({color:0x9da29c, roughness:.9}), void: std({color:0x15181a, roughness:1}),
  riser: std({color:0x8c928d, roughness:.9}), concrete: std({color:0xb7bbb4, roughness:.95}),
  fascia: std({color:0x2a3033, roughness:.6}),
  fasciaSel: std({color:0x2b6fb3, roughness:.5, emissive:0x0d2a48}),
  fasciaBad: std({color:0xd23b2e, roughness:.5, emissive:0x4a0d08}),
  barrier: std({color:0xe0b43a, roughness:.4, metalness:.4}),
  glass: std({color:0xbfe3f2, roughness:.1, transparent:true, opacity:.35}),
  roof: std({color:0xeef2f4, roughness:.4, metalness:.1, transparent:true, opacity:.86}),
  roofSolid: std({color:0x5d6468, roughness:.7, metalness:.2}),
  roofGreen: std({color:0x3f5f48, roughness:.7}),
  roofConcrete: std({color:0xa9a69e, roughness:.95}),
  roofClosed: std({color:0xdfe8ec, roughness:.3, transparent:true, opacity:.55}),
  roofGlass: std({color:0xbfe0ee, roughness:.08, metalness:.2, transparent:true, opacity:.45}),
  glassClad: std({color:0x9cc3d6, roughness:.1, metalness:.3, transparent:true, opacity:.7}),
  tower: std({color:0x8e938f, roughness:.85}), gate: std({color:0x23282b, roughness:.8}), cable: std({color:0x2b2f33, roughness:.5, metalness:.6}),
  soffit: std({color:0x9ea39f, roughness:.95}), hball: new THREE.MeshStandardMaterial({color:0xffffff, emissive:0x2b6fb3, emissiveIntensity:.9}),
  roofEdge: std({color:0xd6dbdd, roughness:.5, metalness:.3}),
  steel: std({color:0xe9ecee, roughness:.4, metalness:.5}),
  barrierWood: std({color:0x8a2e24, roughness:.8}),
  column: std({color:0x3c4246, roughness:.5, metalness:.4}),
  lattice: std({color:0x1f3f8f, roughness:.5}),
  board: std({color:0x10233f, roughness:.4, emissive:0x163a6e, emissiveIntensity:.8}),
  site: std({color:0xc0392b, roughness:.6}), handle: std({color:0xffffff, roughness:.5, emissive:0x5a1a14}),
  white: std({color:0xffffff, roughness:.4}),
  window: std({color:0x1d262c, roughness:.25, metalness:.3}), trim: std({color:0xd9d2c2, roughness:.85}),
  canvas: new THREE.MeshStandardMaterial({color:0x2e5fa8, roughness:.8}),
  rope: new THREE.MeshStandardMaterial({color:0xf2f2f2, roughness:.5}),
  cageNet: new THREE.MeshStandardMaterial({color:0x111111, roughness:.6, transparent:true, opacity:.35, side:DS}),
  dark: new THREE.MeshStandardMaterial({color:0x1d2124, roughness:.6}),
  mast: new THREE.MeshStandardMaterial({color:0x9aa1a5, roughness:.5, metalness:.5}),
  lamp: new THREE.MeshStandardMaterial({color:0xfffbe8, emissive:0xfff3c4, emissiveIntensity:.9}),
  screen: new THREE.MeshStandardMaterial({color:0x0b1a2b, emissive:0x2a5fa8, emissiveIntensity:.7})
};
for (const st in STYLES) M["clad_"+st] = std({color:STYLES[st].clad, roughness: [0x8b4636,0x9a4a3a,0x7d3b2c].includes(STYLES[st].clad) ? .95 : .6, metalness: st === "showpiece" ? .3 : .15});
function setSeatColours(){
  M.seated.color.set(S.seat); M.seatBack.color.set(S.seat).multiplyScalar(0.8); M.rail.color.set(S.seat);
  M.exec.color.set(S.seat).multiplyScalar(0.5); M.lattice.color.set(S.seat);
  const alt = S.seat2 || "#f2f2f2"; M.seatAlt.color.set(alt); M.seatAltBack.color.set(alt).multiplyScalar(0.85);
  invalidate();
}
setSeatColours();
let group = new THREE.Group(); scene.add(group);
function meshFrom(arr, mat, shadow){
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(arr,3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = shadow !== false; m.receiveShadow = true; return m;
}

/* ================= floor texture ================= */
function rr(ctx,w,h,r){
  const x=-w/2,y=-h/2; r=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arc(x+w-r,y+r,r,-Math.PI/2,0);
  ctx.lineTo(x+w,y+h-r); ctx.arc(x+w-r,y+h-r,r,0,Math.PI/2); ctx.lineTo(x+r,y+h); ctx.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);
  ctx.lineTo(x,y+r); ctx.arc(x+r,y+r,r,Math.PI,Math.PI*1.5); ctx.closePath();
}
function drawFootball(ctx){
  ctx.strokeRect(-52.5,-34,105,68);
  ctx.beginPath(); ctx.moveTo(0,-34); ctx.lineTo(0,34); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,9.15,0,Math.PI*2); ctx.stroke();
  for (const s of [-1,1]){
    const gx = 52.5*s;
    ctx.strokeRect(s>0?gx-16.5:gx,-20.16,16.5,40.32); ctx.strokeRect(s>0?gx-5.5:gx,-9.16,5.5,18.32);
    ctx.beginPath(); ctx.arc(gx-11*s,0,0.25,0,Math.PI*2); ctx.fill();
    const a = Math.acos(5.5/9.15);
    ctx.beginPath(); ctx.arc(gx-11*s,0,9.15, s>0?Math.PI-a:-a, s>0?Math.PI+a:a); ctx.stroke();
  }
}
const fenceR = phi => 100 + 22*Math.sin(2*phi);
function drawBaseball(ctx, F, Wt, Ht){
  const H = F.home, dirt = "#b9875a";
  ctx.fillStyle = "#2f6430"; ctx.fillRect(-Wt/2,-Ht/2,Wt,Ht);
  const fence = []; for (let i=0;i<=40;i++){ const ph = i/40*Math.PI/2, r = fenceR(ph); fence.push([H[0]+r*Math.cos(ph), H[1]+r*Math.sin(ph)]); }
  const fair = () => { ctx.beginPath(); ctx.moveTo(H[0],H[1]); fence.forEach(p => ctx.lineTo(p[0],p[1])); ctx.closePath(); };
  fair(); ctx.fillStyle = "#468a40"; ctx.fill();
  ctx.save(); fair(); ctx.clip(); ctx.fillStyle = "#4f9447";
  for (let r=0;r<200;r+=8){ ctx.beginPath(); ctx.arc(H[0],H[1],r+4,0,Math.PI/2); ctx.arc(H[0],H[1],r,Math.PI/2,0,true); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = dirt; ctx.lineWidth = 4.5; ctx.beginPath();
  for (let i=0;i<=40;i++){ const ph = i/40*Math.PI/2, r2 = fenceR(ph)-2.3, q = [H[0]+r2*Math.cos(ph), H[1]+r2*Math.sin(ph)]; i ? ctx.lineTo(q[0],q[1]) : ctx.moveTo(q[0],q[1]); }
  ctx.stroke();
  ctx.strokeStyle = "#1c3a24"; ctx.lineWidth = .9; ctx.beginPath(); fence.forEach((p,i) => i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1])); ctx.stroke();
  const mound = [H[0]+18.44*Math.SQRT1_2, H[1]+18.44*Math.SQRT1_2];
  ctx.fillStyle = dirt; ctx.beginPath(); ctx.moveTo(H[0],H[1]); ctx.arc(mound[0],mound[1],29,-Math.PI*0.06,Math.PI*0.56); ctx.closePath(); ctx.fill();
  const b = 27.43, inset = 1.6;
  ctx.fillStyle = "#468a40"; ctx.beginPath(); ctx.moveTo(H[0]+inset*1.6,H[1]+inset*1.6); ctx.lineTo(H[0]+b-inset,H[1]+inset); ctx.lineTo(H[0]+b-inset,H[1]+b-inset); ctx.lineTo(H[0]+inset,H[1]+b-inset); ctx.closePath(); ctx.fill();
  ctx.fillStyle = dirt; ctx.beginPath(); ctx.arc(mound[0],mound[1],2.75,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(H[0],H[1],4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = "#ffffff"; for (const q of [[b,0],[b,b],[0,b]]) ctx.fillRect(H[0]+q[0]-0.2,H[1]+q[1]-0.2,0.4,0.4);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .12;
  ctx.beginPath(); ctx.moveTo(H[0],H[1]); ctx.lineTo(H[0]+100,H[1]); ctx.moveTo(H[0],H[1]); ctx.lineTo(H[0],H[1]+100); ctx.stroke();
}
function drawKind(ctx, F, Wt, Ht, lw){
  const W = F.W, H = F.H, k = F.kind, line = (x1,z1,x2,z2) => { ctx.beginPath(); ctx.moveTo(x1,z1); ctx.lineTo(x2,z2); ctx.stroke(); };
  const surround = {arena:"#2f3337", court:"#2d4a6b", ice:"#3a3f44", tennis:"#2f6b52", grass:"#3a7335", mat:"#2f3337", sand:"#b89a62"}[F.surface] || "#2f3337";
  ctx.fillStyle = surround; ctx.fillRect(-Wt/2,-Ht/2,Wt,Ht);
  if (k === "wrestleball"){
    const z = F.zones, tot = z.reduce((a,b) => a+b, 0), sc = W/tot;
    let x = -W/2;
    for (let s = -Wt/2, n = 0; s < Wt/2; s += 1.5, n++){ ctx.fillStyle = n % 2 ? "#41853b" : "#3b7a36"; ctx.fillRect(s, -Ht/2, 1.5, Ht); }
    z.forEach((len, i) => { if (i !== 1){ ctx.fillStyle = "rgba(255,255,255,.13)"; ctx.fillRect(x, -H/2, len*sc, H); } x += len*sc; });
    x = -W/2;
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(lw, 0.05);
    ctx.strokeRect(-W/2,-H/2,W,H);
    x = -W/2; z.forEach(len => { x += len*sc; if (x < W/2 - 0.01) line(x,-H/2,x,H/2); });
    line(0,-H/2,0,H/2); ctx.beginPath(); ctx.arc(0,0,Math.min(H*0.3,1.2),0,Math.PI*2); ctx.stroke();
    return;
  }
  if (k === "bullring"){ ctx.fillStyle = "#c9a86c"; ctx.fillRect(-Wt/2,-Ht/2,Wt,Ht); ctx.beginPath(); ctx.arc(0,0,W/2,0,Math.PI*2); ctx.fillStyle = "#dcc08a"; ctx.fill(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .2; ctx.beginPath(); ctx.arc(0,0,W/2*0.6,0,Math.PI*2); ctx.stroke(); return; }
  if (k === "boxing" || k === "cage" || k === "concert"){ ctx.fillStyle = "#26292c"; rr(ctx, W+1.2, H+1.2, F.r); ctx.fill(); return; }
  if (k === "basketball"){
    ctx.fillStyle = "#c99a5e"; ctx.fillRect(-W/2,-H/2,W,H);
    ctx.strokeStyle = "rgba(0,0,0,.07)"; ctx.lineWidth = .04; for (let z=-H/2;z<H/2;z+=0.2) line(-W/2,z,W/2,z);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .05; ctx.strokeRect(-W/2,-H/2,W,H); line(0,-H/2,0,H/2);
    ctx.beginPath(); ctx.arc(0,0,1.8,0,Math.PI*2); ctx.stroke();
    for (const s of [-1,1]){
      const bx = s*W/2, hx = bx - s*1.575;
      ctx.fillStyle = "rgba(160,40,40,.55)"; ctx.fillRect(s>0?bx-5.8:bx,-2.45,5.8,4.9); ctx.strokeRect(s>0?bx-5.8:bx,-2.45,5.8,4.9);
      ctx.beginPath(); ctx.arc(bx-s*5.8,0,1.8,0,Math.PI*2); ctx.stroke();
      const a = Math.asin(Math.min(1,(H/2-0.9)/6.75));
      ctx.beginPath(); ctx.arc(hx,0,6.75, s>0?Math.PI-a:-a, s>0?Math.PI+a:a); ctx.stroke();
      line(bx,-(H/2-0.9),hx-s*Math.cos(a)*6.75,-(H/2-0.9)); line(bx,(H/2-0.9),hx-s*Math.cos(a)*6.75,(H/2-0.9));
    }
    return;
  }
  if (k === "tennis"){
    ctx.fillStyle = "#3d6fb0"; ctx.fillRect(-11.885,-5.485,23.77,10.97);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .05;
    ctx.strokeRect(-11.885,-5.485,23.77,10.97); line(-11.885,-4.115,11.885,-4.115); line(-11.885,4.115,11.885,4.115);
    line(-6.4,-4.115,-6.4,4.115); line(6.4,-4.115,6.4,4.115); line(-6.4,0,6.4,0);
    return;
  }
  if (k === "hockey"){
    rr(ctx,W,H,F.r); ctx.fillStyle = "#eef5f8"; ctx.fill();
    ctx.lineWidth = .3; ctx.strokeStyle = "#c2272d"; line(0,-H/2,0,H/2);
    for (const s of [-1,1]) line(s*(W/2-3.4),-H/2+2,s*(W/2-3.4),H/2-2);
    ctx.strokeStyle = "#2453a6"; for (const s of [-1,1]) line(s*W/8,-H/2,s*W/8,H/2);
    ctx.strokeStyle = "#c2272d"; ctx.lineWidth = .05;
    for (const s of [-1,1]) for (const z of [-6.7,6.7]){ ctx.beginPath(); ctx.arc(s*(W/2-9.4),z,4.57,0,Math.PI*2); ctx.stroke(); }
    ctx.strokeStyle = "#2453a6"; ctx.beginPath(); ctx.arc(0,0,4.57,0,Math.PI*2); ctx.stroke();
    return;
  }
  const SURF = {grass:["#3d7a38","#468a40"],court:["#c4945a","#b98a52"],ice:["#e9f2f6","#e3edf2"],sand:["#dcc48f","#d6bd87"],arena:["#3a3e42","#3a3e42"],tennis:["#3d6fb0","#3d6fb0"],mat:["#2d6cb5","#2d6cb5"]};
  const [base, alt] = SURF[F.surface] || SURF.grass;
  ctx.save(); rr(ctx,W,H,F.r); ctx.fillStyle = base; ctx.fill(); ctx.clip();
  if (F.surface === "grass"){ ctx.fillStyle = alt; for (let x=-W/2,i=0;x<W/2;x+=5,i++) if (i%2) ctx.fillRect(x,-H/2,5,H); }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = Math.max(lw, Math.min(W,H)*0.005);
  rr(ctx,W,H,F.r); ctx.stroke(); line(0,-H/2,0,H/2);
  ctx.beginPath(); ctx.arc(0,0,Math.min(W,H)*0.15,0,Math.PI*2); ctx.stroke();
}
function floorTexture(F, set){
  const Wt = F.W + 2*set, Ht = F.H + 2*set;
  const k = Math.min(48, 2048/Math.max(Wt,Ht));
  const c = document.createElement("canvas"); c.width = Math.max(2,Math.round(Wt*k)); c.height = Math.max(2,Math.round(Ht*k));
  const ctx = c.getContext("2d"); ctx.translate(c.width/2, c.height/2); ctx.scale(k,k);
  const lw = Math.max(0.05, 1.6/k);
  ctx.lineWidth = lw; ctx.strokeStyle = "rgba(255,255,255,.92)"; ctx.fillStyle = "rgba(255,255,255,.92)";
  const sport = S.sport;
  if (F.custom) drawKind(ctx, F, Wt, Ht, lw);
  else if (sport === "baseball") drawBaseball(ctx, F, Wt, Ht);
  else if (sport === "cricket"){
    ctx.fillStyle = "#386f33"; ctx.fillRect(-Wt/2,-Ht/2,Wt,Ht);
    for (let r=80;r>0;r-=6){ ctx.fillStyle = (r/6)%2<1 ? "#43873d" : "#3e7e38"; ctx.beginPath(); ctx.ellipse(0,0,r*F.W/F.H,r,0,0,Math.PI*2); ctx.fill(); }
    rr(ctx,F.W,F.H,F.r); ctx.lineWidth=.35; ctx.strokeStyle="#f4f4f0"; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0,0,30,27.4,0,0,Math.PI*2); ctx.setLineDash([1.2,1.2]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#cdb98a"; ctx.fillRect(-10.06,-1.6,20.12,3.2);
    ctx.fillStyle = "#ffffff"; for (const s of [-1,1]) ctx.fillRect(s*8.84-0.05,-1.32,0.1,2.64);
  } else {
    ctx.fillStyle = "#3d7a38"; ctx.fillRect(-Wt/2,-Ht/2,Wt,Ht);
    ctx.fillStyle = "#468a40"; for (let x=-Wt/2,i=0;x<Wt/2;x+=5.25,i++) if (i%2) ctx.fillRect(x,-Ht/2,5.25,Ht);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    if (sport === "football") drawFootball(ctx);
    if (sport === "rugby"){
      ctx.fillStyle = "#3a7335"; for (const s of [-1,1]) ctx.fillRect(s>0?50:-60,-35,10,70);
      ctx.strokeRect(-60,-35,120,70);
      for (const x of [-50,-22,0,22,50]){ ctx.beginPath(); ctx.moveTo(x,-35); ctx.lineTo(x,35); ctx.stroke(); }
      ctx.setLineDash([2,2]);
      for (const x of [-40,-10,10,40]){ ctx.beginPath(); ctx.moveTo(x,-35); ctx.lineTo(x,35); ctx.stroke(); }
      for (const z of [-30,-20,20,30]){ ctx.beginPath(); ctx.moveTo(-50,z); ctx.lineTo(50,z); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    if (sport === "athletics"){
      ctx.fillStyle = "#3a7034"; ctx.fillRect(-Wt/2,-Ht/2,Wt,Ht);
      rr(ctx,F.W,F.H,F.r); ctx.fillStyle = "#b4513a"; ctx.fill();
      const lanes = 8, lane = 1.22;
      rr(ctx,F.W-2*lanes*lane,F.H-2*lanes*lane,F.r-lanes*lane); ctx.fillStyle = "#43873d"; ctx.fill();
      ctx.lineWidth = Math.max(0.06, 1/k); ctx.strokeStyle = "rgba(255,255,255,.85)";
      for (let i=0;i<=lanes;i++){ rr(ctx,F.W-2*i*lane,F.H-2*i*lane,F.r-i*lane); ctx.stroke(); }
      ctx.lineWidth = lw; ctx.strokeStyle = "rgba(255,255,255,.92)"; ctx.fillStyle = "rgba(255,255,255,.92)";
      drawFootball(ctx);
    }
  }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return {tex, Wt, Ht};
}
function addProps(g, F, buf){
  const cyl = (r,h,s) => new THREE.CylinderGeometry(r,r,h,s||8);
  const add = (geo, mat, x, y, z, ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x,y,z); if (ry) m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  if (S.sport === "football" || S.sport === "athletics") for (const s of [-1,1]){
    for (const z of [-3.66,3.66]) add(cyl(.07,2.44), M.white, 52.5*s,1.22,z);
    const bar = add(cyl(.07,7.32), M.white, 52.5*s,2.44,0); bar.rotation.x = Math.PI/2;
  }
  if (S.sport === "rugby") for (const s of [-1,1]){
    for (const z of [-2.8,2.8]) add(cyl(.1,14), M.white, 50*s,7,z);
    const bar = add(cyl(.08,5.6), M.white, 50*s,3,0); bar.rotation.x = Math.PI/2;
  }
  if (S.sport === "baseball"){
    const H = SPORTS.baseball.home;
    for (const ph of [0, Math.PI/2]){ const r = fenceR(ph); add(cyl(.25,20), M.barrier, H[0]+r*Math.cos(ph), 10, H[1]+r*Math.sin(ph)); }
  }
  if (!F.custom) return;
  const W = F.W, H = F.H;
  if (F.kind === "boxing"){
    add(new THREE.BoxGeometry(W+1.2,1.2,H+1.2), M.canvas, 0,0.6,0);
    const colours = [0xc3322b,0xf2f2f2,0x1f3f8f,0xf2f2f2];
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sz],i) => add(cyl(.09,1.5), new THREE.MeshStandardMaterial({color:colours[i]}), sx*W/2*0.84, 1.95, sz*H/2*0.84));
    for (const y of [1.65,2.0,2.35,2.65]){
      add(new THREE.BoxGeometry(W*0.84,.05,.05), M.rope, 0,y,-H/2*0.84); add(new THREE.BoxGeometry(W*0.84,.05,.05), M.rope, 0,y,H/2*0.84);
      add(new THREE.BoxGeometry(.05,.05,H*0.84), M.rope, -W/2*0.84,y,0); add(new THREE.BoxGeometry(.05,.05,H*0.84), M.rope, W/2*0.84,y,0);
    }
  }
  if (F.kind === "cage"){
    const R = W/2/Math.cos(Math.PI/8);
    add(cyl(R+0.6,0.9,8), M.dark, 0,0.45,0, Math.PI/8);
    add(cyl(R-0.05,0.02,8), M.canvas, 0,0.91,0, Math.PI/8);
    const net = add(new THREE.CylinderGeometry(R,R,1.8,8,1,true), M.cageNet, 0,1.8,0, Math.PI/8); net.castShadow = false;
    for (let i=0;i<8;i++){ const a = i*Math.PI/4; add(cyl(.07,1.9), M.dark, Math.cos(a)*R, 1.85, Math.sin(a)*R); }
  }
  if (F.kind === "bullring"){ const P0 = closedPathS(F, F.r, 0, "curved"); ribbon(buf("barrierWood"), P0, P0, 0, 1.6, true); }
  if (F.kind === "wrestleball") for (const s of [-1,1]) add(new THREE.BoxGeometry(.3,.5,H), M.white, s*(W/2+0.4),.25,0);
  if (F.kind === "basketball") for (const s of [-1,1]){
    add(new THREE.BoxGeometry(.4,3.4,.4), M.dark, s*(W/2+1.3),1.7,0);
    add(new THREE.BoxGeometry(.05,1.07,1.83), new THREE.MeshStandardMaterial({color:0xffffff,transparent:true,opacity:.6}), s*(W/2-1.2),3.4,0);
    const rim = add(new THREE.TorusGeometry(.23,.02,6,16), M.barrier, s*(W/2-1.575),3.05,0); rim.rotation.x = Math.PI/2;
  }
  if (F.kind === "tennis"){
    add(new THREE.BoxGeometry(.03,.95,12.8), new THREE.MeshStandardMaterial({color:0x222222,transparent:true,opacity:.7}), 0,.475,0);
    for (const z of [-6.4,6.4]) add(cyl(.05,1.07), M.dark, 0,.535,z);
  }
  if (F.kind === "hockey"){
    const P0 = closedPathS(F, F.r, 0, "curved");
    ribbon(buf("white"), P0, P0, 0, 1.07, true); ribbon(buf("glass"), P0, P0, 1.07, 2.9, true);
  }
  if (F.kind === "concert"){
    add(new THREE.BoxGeometry(14,2,Math.min(H*0.7,30)), M.dark, -W/2+7,1,0);
    add(new THREE.BoxGeometry(1,14,Math.min(H*0.7,30)+2), M.column, -W/2-0.5,7,0);
    add(new THREE.BoxGeometry(14,0.8,Math.min(H*0.7,30)+2), M.column, -W/2+7,14,0);
  }
}

