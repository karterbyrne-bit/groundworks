/* ================= the neighbourhood =================
   With "real sky and fields" on, the ground sits in a believable bit of town rather than on an empty green: a street
   runs along each edge of the site (or round the ground, when no plot is set), terraced houses face onto it from the far
   side with a second row and street behind them, side streets cut through, a car park takes the place of one stretch of
   houses, and bigger buildings stand further out among the trees. It is decoration only: it stays outside the boundary,
   clear of the stands and of anything added under Surroundings, and plays no part in capacity or the checks. Each design
   gets its own layout (seeded from the design itself), always the same one for the same design. Everything is plain,
   low-detail boxes merged into the shared buffers, and the trees are one instanced set, so phones stay fast. */
function hashSeed(str){ let h = 2166136261; for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 2147483646 + 1; }
const ringArea = P => { let a = 0; for (let i=0;i<P.length;i++){ const p = P[i], q = P[(i+1)%P.length]; a += p[0]*q[1] - q[0]*p[1]; } return a/2; };
const ccwRing = P => ringArea(P) > 0 ? P.slice() : P.slice().reverse();
const edgeOut = (a, b) => { const dx = b[0]-a[0], dz = b[1]-a[1], l = Math.hypot(dx, dz) || 1; return [dz/l, -dx/l]; }; // outward, for a ring going anticlockwise
/* Where the lines d metres outside the two edges meeting at corner i cross: a sharp corner (a wedge-shaped site) is cut
   short rather than shooting out. */
function miterAt(P, i, d){ const n = P.length, a = P[(i-1+n)%n], p = P[i], b = P[(i+1)%n], n1 = edgeOut(a, p), n2 = edgeOut(p, b);
  const mx = n1[0] + n2[0], mz = n1[1] + n2[1], ml = Math.hypot(mx, mz) || 1, cos = Math.max(.35, ml/2), k = d/cos;
  return [p[0] + mx/ml*k, p[1] + mz/ml*k]; }
/* A road just outside a plot edge: roads under Surroundings snap to the nearest edge when dragged near it, run along it,
   and follow it when the plot is reshaped. Dragging one well away sets it free. */
function snapRoad(f){
  if (f.kind !== "road" || !S.plot.on || !S.plot.pts){ delete f.snap; return; }
  const P = S.plot.pts, sg = ringArea(P) > 0 ? 1 : -1; let best = null;
  for (let i=0;i<P.length;i++){ const a = P[i], b = P[(i+1)%P.length], ex = b[0]-a[0], ez = b[1]-a[1], L2 = ex*ex + ez*ez || 1;
    const t = Math.max(0, Math.min(1, ((f.x - a[0])*ex + (f.z - a[1])*ez)/L2)), n = edgeOut(a, b), off = f.width/2 + 1.5;
    const tx = a[0] + ex*t + n[0]*sg*off, tz = a[1] + ez*t + n[1]*sg*off, d = Math.hypot(f.x - tx, f.z - tz);
    if (!best || d < best.d) best = {d, i, t}; }
  if (best && best.d < 10){ f.snap = {i: best.i, t: +best.t.toFixed(3)}; followEdge(f); } else delete f.snap;
}
function followEdge(f){
  const P = S.plot.pts; if (!S.plot.on || !P || !f.snap || f.snap.i >= P.length){ delete f.snap; return; }
  const sg = ringArea(P) > 0 ? 1 : -1, a = P[f.snap.i], b = P[(f.snap.i+1)%P.length], n = edgeOut(a, b), off = f.width/2 + 1.5;
  f.x = Math.round((a[0] + (b[0]-a[0])*f.snap.t + n[0]*sg*off)*10)/10; f.z = Math.round((a[1] + (b[1]-a[1])*f.snap.t + n[1]*sg*off)*10)/10;
  f.angle = Math.round(((Math.atan2(b[1]-a[1], b[0]-a[0])*180/Math.PI) + 360) % 180);
}
const followSnappedRoads = () => { for (const f of (Array.isArray(S.site) ? S.site : [])) if (f.snap) followEdge(f); };

const HOUSE_WALLS = ["clad_historic", "white", "clad_regular", "clad_historic", "trim"], CAR_COLS = ["white", "dark", "site", "canvas", "steel", "white", "dark"];
let TREE_GEO = null;
function drawNeighbourhood(poly, ext, site, bf){
  if (S.scenery === "model") return;
  let seed = hashSeed(JSON.stringify([S.plot.on && S.plot.pts, S.sport, S.layout, S.seat, (S.sponsors || {}).title || ""]));
  const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  const B = ccwRing(poly ? poly : (() => { const ex = ext[0] + 10, ez = ext[1] + 10; return [[-ex,-ez],[ex,-ez],[ex,ez],[-ex,ez]]; })());
  const n = B.length, blocked = site.map(f => featurePoly(f, 3));
  const clear = (x, z) => !inPoly([x, z], B) && !blocked.some(p => inPoly([x, z], p)); // outside the site, clear of Surroundings
  const at = (p, y) => [p[0], y, p[1]];
  // the point d metres out from the boundary, a fraction s of the way along edge i (between the corner mitres)
  const along = (i, s, d) => { const a = miterAt(B, i, d), b = miterAt(B, (i+1)%n, d); return [a[0] + (b[0]-a[0])*s, a[1] + (b[1]-a[1])*s]; };
  const band = (key, i, d0, d1, y, s0 = 0, s1 = 1) => quad(bf(key), at(along(i,s0,d0),y), at(along(i,s1,d0),y), at(along(i,s1,d1),y), at(along(i,s0,d1),y));
  const trees = [];
  // the street round the site: pavement, carriageway with a dashed centre line, pavement; and a second street further out
  for (const [d0, w] of [[1, 12], [37, 12]]) for (let i=0;i<n;i++){
    band("pavement", i, d0, d0 + 2.5, .03); band("road", i, d0 + 2.5, d0 + w - 2.5, .04); band("pavement", i, d0 + w - 2.5, d0 + w, .03);
    const a = along(i, 0, d0 + w/2), b = along(i, 1, d0 + w/2), L = Math.hypot(b[0]-a[0], b[1]-a[1]);
    for (let s = 2; s < L - 2; s += 6) band("white", i, d0 + w/2 - .07, d0 + w/2 + .07, .05, s/L, Math.min(1, (s + 3)/L));
    if (d0 === 1) for (let s = 6; s < L - 6; s += 11){ const p = along(i, s/L, d0 + w - 1.2); if (clear(p[0], p[1])) trees.push([p[0], p[1], .8 + rnd()*.4]); } }
  // which stretch of which edge becomes the car park
  let longest = 0; for (let i=1;i<n;i++) if (Math.hypot(B[(i+1)%n][0]-B[i][0], B[(i+1)%n][1]-B[i][1]) > Math.hypot(B[(longest+1)%n][0]-B[longest][0], B[(longest+1)%n][1]-B[longest][1])) longest = i;
  const parkEdge = rnd() < .7 ? longest : Math.floor(rnd()*n), park = [.3 + rnd()*.15, 0]; park[1] = park[0] + .3;
  // terraces facing the street (front at 15 m out, 8 m deep), and a second row behind facing the outer street, in blocks
  // with side streets between them
  for (let i=0;i<n;i++){
    const L = Math.hypot(along(i,1,15)[0] - along(i,0,15)[0], along(i,1,15)[1] - along(i,0,15)[1]); if (L < 20) continue;
    let s = 9;
    while (s < L - 14){
      const houses = 4 + Math.floor(rnd()*8), hw = 4.6 + rnd()*1.2, run = houses*hw; if (s + run > L - 9) break;
      const s0 = s/L, s1 = (s + run)/L; s += run + 8 + rnd()*6;
      band("road", i, 13, 37, .035, s1 + 1/L, Math.min(1, s1 + 7/L)); // a side street after the block
      if (i === parkEdge && s1 > park[0] && s0 < park[1]){ // the car park: tarmac, white bays and some parked cars
        band("road", i, 13, 37, .035, s0, s1);
        for (let k = s0*L + 1.25; k < s1*L - 1; k += 2.5) for (const d of [17, 28]){ band("white", i, d, d + 5, .05, k/L, (k + .1)/L);
          if (rnd() < .6){ const p = along(i, (k + 1.25)/L, d + 2.5), q = along(i, (k + 1.25)/L + .001, d + 2.5), ang = Math.atan2(q[1]-p[1], q[0]-p[0]);
            if (clear(p[0], p[1])){ const c = Math.cos(ang), sn = Math.sin(ang), car = (lx, lz) => [p[0] + c*lx - sn*lz, p[1] + sn*lx + c*lz], key = CAR_COLS[Math.floor(rnd()*CAR_COLS.length)];
              const box = (y0, y1, w, l) => { const A = car(-w,-l), B2 = car(w,-l), C = car(w,l), D = car(-w,l);
                quad(bf(key), at(A,y1), at(B2,y1), at(C,y1), at(D,y1)); for (const [u, v] of [[A,B2],[B2,C],[C,D],[D,A]]) quad(bf(key), at(u,y0), at(v,y0), at(v,y1), at(u,y1)); };
              box(.3, 1.0, .85, 2.1); box(1.0, 1.45, .75, 1.2); } } }
        continue; }
      const wall = HOUSE_WALLS[Math.floor(rnd()*HOUSE_WALLS.length)], eaves = 5.6 + rnd()*1.4, ridge = eaves + 2.4 + rnd()*.6;
      for (const [f0, f1, faceOut] of [[15, 23, false], [29, 37, true]]){
        const mid = along(i, (s0 + s1)/2, (f0 + f1)/2); if (!clear(mid[0], mid[1])) continue;
        const a0 = along(i, s0, f0), b0 = along(i, s1, f0), a1 = along(i, s0, f1), b1 = along(i, s1, f1), r0 = along(i, s0, (f0+f1)/2), r1 = along(i, s1, (f0+f1)/2);
        quad(bf(wall), at(a0,0), at(b0,0), at(b0,eaves), at(a0,eaves)); quad(bf(wall), at(b1,0), at(a1,0), at(a1,eaves), at(b1,eaves));
        quad(bf(wall), at(a1,0), at(a0,0), at(a0,eaves), at(a1,eaves)); quad(bf(wall), at(b0,0), at(b1,0), at(b1,eaves), at(b0,eaves));
        quad(bf("slate"), at(a0,eaves), at(b0,eaves), at(r1,ridge), at(r0,ridge)); quad(bf("slate"), at(b1,eaves), at(a1,eaves), at(r0,ridge), at(r1,ridge));
        quad(bf(wall), at(a0,eaves), at(r0,ridge), at(a1,eaves), at(a1,eaves)); quad(bf(wall), at(b1,eaves), at(r1,ridge), at(b0,eaves), at(b0,eaves));
        const front = faceOut ? f1 + .05 : f0 - .05;
        for (let h=0;h<houses;h++){ const u = (s0*L + (h + .5)*hw)/L, du = 1/L;
          const door = along(i, u - hw*.3*du, front), door2 = along(i, u - hw*.12*du, front);
          quad(bf("gate"), at(door,0), at(door2,0), at(door2,2.1), at(door,2.1));
          for (const [y0, y1, wa, wb] of [[.9, 2.2, .02, .28], [3.4, 4.7, -.3, .3]]){ const w0 = along(i, u + hw*wa*du, front), w1 = along(i, u + hw*wb*du, front);
            quad(bf("window"), at(w0,y0), at(w1,y0), at(w1,y1), at(w0,y1)); }
          if (h % 2 === 0){ const c = along(i, u, (f0+f1)/2); post(bf("clad_historic"), c[0], c[1], ridge - .6, ridge + 1, .9); } // chimney stacks
          if (!faceOut && rnd() < .35){ const g = along(i, u, 26 + rnd()*1.5); if (clear(g[0], g[1])) trees.push([g[0], g[1], .7 + rnd()*.4]); } } } // back gardens
    } }
  // bigger buildings further out: flats, offices and sheds, scattered among the trees
  for (const d of [62, 105]){ const R = B.map((_, i) => miterAt(B, i, d)), per = R.reduce((a, p, i) => a + Math.hypot(R[(i+1)%n][0]-p[0], R[(i+1)%n][1]-p[1]), 0);
    for (let s = rnd()*30; s < per; s += 32 + rnd()*40){
      let k = s, i = 0; while (i < n && k > Math.hypot(R[(i+1)%n][0]-R[i][0], R[(i+1)%n][1]-R[i][1])){ k -= Math.hypot(R[(i+1)%n][0]-R[i][0], R[(i+1)%n][1]-R[i][1]); i++; }
      if (i >= n) break; const a = R[i], b = R[(i+1)%n], el = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1, ux = (b[0]-a[0])/el, uz = (b[1]-a[1])/el, nn = edgeOut(a, b);
      const cx = a[0] + ux*k + nn[0]*rnd()*14, cz = a[1] + uz*k + nn[1]*rnd()*14; if (!clear(cx, cz)) continue;
      if (rnd() < .3){ trees.push([cx, cz, 1 + rnd()*.5]); trees.push([cx + 6*ux, cz + 6*uz, 1 + rnd()*.4]); continue; }
      const w = 9 + rnd()*14, l = 12 + rnd()*22, h = d > 80 ? 14 + rnd()*36 : 9 + rnd()*16, key = ["concrete", "glassClad", "clad_brutalist", "clad_regular", "white"][Math.floor(rnd()*5)];
      const c = [[-l,-w],[l,-w],[l,w],[-l,w]].map(([p, q]) => [cx + ux*p + nn[0]*q, cz + uz*p + nn[1]*q]);
      quad(bf("roofSolid"), at(c[0],h), at(c[1],h), at(c[2],h), at(c[3],h));
      for (let e=0;e<4;e++){ const p = c[e], q = c[(e+1)%4]; quad(bf(key), at(p,0), at(q,0), at(q,h), at(p,h));
        if (key !== "glassClad") for (let y = 3; y < h - 1.5; y += 3.4){ const m = [(p[0]+q[0])/2, (p[1]+q[1])/2], o = edgeOut(q, p), sx = (q[0]-p[0])*.42, sz = (q[1]-p[1])*.42; // bands of windows
          quad(bf("window"), [m[0]-sx+o[0]*.06, y, m[1]-sz+o[1]*.06], [m[0]+sx+o[0]*.06, y, m[1]+sz+o[1]*.06], [m[0]+sx+o[0]*.06, y+1.3, m[1]+sz+o[1]*.06], [m[0]-sx+o[0]*.06, y+1.3, m[1]-sz+o[1]*.06]); } } } }
  // the trees, as one instanced set: a trunk and a rounded crown in a few shades of green
  const cap = LIGHT ? 220 : 480; if (trees.length > cap) trees.length = cap;
  if (trees.length){
    TREE_GEO = TREE_GEO || {trunk: new THREE.CylinderGeometry(.18, .26, 3, 5), crown: new THREE.IcosahedronGeometry(2.6, 0)}; TREE_GEO.trunk.keep = TREE_GEO.crown.keep = true;
    const tm = new THREE.InstancedMesh(TREE_GEO.trunk, M.dark, trees.length), cm = new THREE.InstancedMesh(TREE_GEO.crown, new THREE.MeshStandardMaterial({roughness:.95}), trees.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), greens = [0x3f6b34, 0x4d7a3a, 0x355f2e, 0x5a7f3e, 0x2f5530];
    trees.forEach(([x, z, k], j) => { s.set(k, k, k); m4.compose(v.set(x, 1.5*k, z), q, s); tm.setMatrixAt(j, m4);
      q.setFromAxisAngle(v.set(0, 1, 0), rnd()*6.3); s.set(k*(.9 + rnd()*.3), k*(.9 + rnd()*.5), k*(.9 + rnd()*.3)); m4.compose(v.set(x, 3*k + 1.8*k, z), q, s); cm.setMatrixAt(j, m4);
      cm.setColorAt(j, col.setHex(greens[Math.floor(rnd()*greens.length)])); q.identity(); });
    for (const m of [tm, cm]){ m.castShadow = true; m.receiveShadow = true; m.userData.stadium = true; group.add(m); } }
}
