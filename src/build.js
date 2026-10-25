/* ================= build ================= */
let LAST = null, LAST_REGIONS = [], tab = "N";
/* Who gets a corner. Each stand says how far it wraps round into the corner at each end (0 to 1) and, with separate
   stands, how far its straight runs past the pitch there. Only one stand can push straight into a corner, and a stand can't
   run into another's wrap; two wraps that overlap meet in proportion. Whatever is left between them is the corner's gap:
   left open, or given a corner stand of its own. */
function cornerPlan(c){
  const lay = layoutOf(), A = S.stands[c.a], B = S.stands[c.b], on = st => !!(st && st.tiers.length);
  const w = v => Math.max(0, Math.min(1, +v || 0));
  let wa = on(A) ? w(A.wrap1) : 0, wb = on(B) ? w(B.wrap0) : 0, ra = 0, rb = 0;
  if (lay === "stands"){
    ra = on(A) && !wa ? +A.run1 || 0 : 0; rb = on(B) && !wb ? +B.run0 || 0 : 0;
    if (ra > 0){ wb = 0; rb = Math.min(rb, 0); }          // the first stand runs straight into the corner: the other stops at the pitch
    else if (wa > 0) rb = Math.min(rb, 0);                // it wraps in: the other can wrap to meet it, but not push straight in
    else if (rb > 0) ra = Math.min(ra, 0);
  }
  let meet = false;
  if (wa + wb > 1){ const t = wa + wb; wa /= t; wb /= t; meet = true; }
  else if (wa + wb > 0.97 && wa > 0 && wb > 0) meet = true;
  const cc = S.corners[c.key] || {}, lo = wa, hi = 1 - wb;
  const gap = !meet && hi - lo > 0.04 && ra <= 0 && rb <= 0 ? [lo, hi] : null;
  return {wa, wb, ra, rb, meet, gap, stand: !!(gap && cc.mode === "stand" && S.cornerCustom.length)};
}
/* A tier's row count for fixes: on a bowl with its own rows per side, its deepest side. Setting it trims every side to it. */
const variesBySide = tr => !!(tr && tr.sideRows && S.bowl.varyRows && S.bowl.tiers.includes(tr));
const rowsOf = tr => variesBySide(tr) ? Math.max(tr.rows, ...Object.values(tr.sideRows)) : tr.rows;
function setRows(tr, v){ if (variesBySide(tr)){ for (const k in tr.sideRows) tr.sideRows[k] = Math.min(tr.sideRows[k], v); tr.rows = Math.min(tr.rows, v); } else tr.rows = v; }
/* A material in a colour picked in the editor: a copy of a shared one, kept for as long as a build uses it.
   Copies the last build didn't use are freed (see sweepMats), so dragging a colour picker doesn't fill up memory. */
const M_BASE = new Set(Object.keys(M)), M_USED = new Set();
function tint(base, hex){
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return base;
  const k = base + "_" + hex.slice(1).toLowerCase();
  if (!M[k]){ M[k] = M[base].clone(); M[k].color.set(hex); if (base === "seatBack") M[k].color.multiplyScalar(0.8); }
  M_USED.add(k); return k;
}
function sweepMats(){
  for (const k in M) if (!M_BASE.has(k) && !M_USED.has(k)){ M[k].dispose(); delete M[k]; }
  M_USED.clear();
  for (const k in signTex) if (!SIGN_USED.has(k)){ const m = signTex[k]; m.map.dispose(); m.edge.dispose(); m.dispose(); delete signTex[k]; }
  SIGN_USED.clear();
  for (const k in faceMats) if (k !== S.seat + S.sport){ faceMats[k].dispose(); delete faceMats[k]; }
  for (const k in boardTex) if (k !== S.seat + S.sport){ boardTex[k].dispose(); delete boardTex[k]; }
  for (const k in adMats) if (!ADS_USED.has(k)){ adMats[k].map.dispose(); adMats[k].dispose(); delete adMats[k]; }
  ADS_USED.clear();
}
const fmt = n => Math.round(n).toLocaleString("en-GB");
/* Seats from the end of a row to its first gangway, where the row ends at the end of a stand (a gangway at one end only). */
const gangEndOf = () => S.design.gangEnd != null ? S.design.gangEnd : Math.min(14, Math.floor(S.design.gangEvery/2));
const lerp = (a,b,f) => a + (b-a)*f;

/* ---------- bowl pieces ----------
   Going round the ring, a bowl is eight pieces: the SE corner, the opposite side, the SW corner, the west end and so on.
   Any of them can be left out (a horseshoe, say), and each side can have its own number of rows, with the corners
   blending smoothly from one side's depth to the next. */
const BOWL_PIECES = ["SE","S","SW","W","NW","N","NE","E"];
const CORNER_AFTER = ["S","W","N","E"], CORNER_BEFORE = ["E","S","W","N"];
const bowlGone = k => !!(S.bowl.removed && S.bowl.removed[k]);
function bowlPiece(tag, nc){
  const tot = 4*(nc+1), tg = ((tag % tot) + tot) % tot, g = Math.min(3, Math.floor(tg/(nc+1))), loc = tg - g*(nc+1);
  return loc <= nc + 1e-6 ? {key:GROUP_KEY[g], corner:true, f: nc ? Math.min(1, loc/nc) : 0.5, before:CORNER_BEFORE[g], after:CORNER_AFTER[g]}
    : {key:CORNER_AFTER[g], corner:false};
}
const sideRowsOf = (tr, s) => S.bowl.varyRows && tr.sideRows && tr.sideRows[s] != null ? Math.max(0, tr.sideRows[s]) : tr.rows;
const sideTypeOf = (tr, s) => S.bowl.varyRows && tr.sideType && TYPES[tr.sideType[s]] ? tr.sideType[s] : tr.type;
const withRows = (tiers, f) => tiers.map((tr,k) => Object.assign({}, tr, {rows:f(tr,k)}));
const onSide = (tr, s) => Object.assign({}, tr, {type:sideTypeOf(tr, s), rows:sideRowsOf(tr, s)}); // a bowl tier as built on one side
/* The bowl's tiers at one point round the ring: that side's seating and rows, a blend in a corner, or nothing where it's
   left out. A corner between two kinds of seating blends the depth and keeps the roomier kind (seats over terracing) all the way round. */
function bowlTiersAt(tag, nc){
  const pc = bowlPiece(tag, nc), T = S.bowl.tiers;
  if (bowlGone(pc.key)) return withRows(T, () => 0);
  if (!S.bowl.varyRows) return T;
  if (!pc.corner) return T.map(tr => onSide(tr, pc.key));
  const a = !bowlGone(pc.before), b = !bowlGone(pc.after), f = (1 - Math.cos(Math.PI*pc.f))/2;
  return T.map(tr => { if (!(a && b)) return a ? onSide(tr, pc.before) : b ? onSide(tr, pc.after) : tr;
    // the corner keeps one kind of seating all the way round (the roomier kind, so seats rather than terracing), and the
    // two kinds meet at a stairway where the corner joins the straight side, not in the middle of the curve
    const ta = onSide(tr, pc.before), tb = onSide(tr, pc.after), type = !(ta.rows > 0) ? tb.type : !(tb.rows > 0) ? ta.type : S.types[ta.type].row >= S.types[tb.type].row ? ta.type : tb.type;
    const depth = lerp(ta.rows*S.types[ta.type].row, tb.rows*S.types[tb.type].row, f);
    return Object.assign({}, tr, {type, rows: depth/S.types[type].row}); });
}
const bowlSideTiers = s => bowlGone(s) ? withRows(S.bowl.tiers, () => 0) : S.bowl.tiers.map(tr => onSide(tr, s));
/* The unbroken stretches of a bowl with parts left out, as ranges round the ring; null when nothing is left out. */
function bowlRuns(nc){
  const on = BOWL_PIECES.map(k => !bowlGone(k));
  if (on.every(Boolean)) return null;
  const runs = [], start = on.indexOf(false); let cur = null;
  for (let s=1;s<=8;s++){ const p = (start + s) % 8;
    if (on[p]){ if (!cur) cur = {from:p}; cur.to = p; }
    else if (cur){ runs.push(cur); cur = null; } }
  const tot = 4*(nc+1), range = p => { const g = Math.floor(p/2); return p % 2 ? [g*(nc+1)+nc, (g+1)*(nc+1)] : [g*(nc+1), g*(nc+1)+nc]; };
  return runs.map(r => ({lo:range(r.from)[0], hi:range(r.to)[1] % tot}));
}
/* Distance along a line from o (in steps of v) to where it meets an ellipse round the centre, on the far side. */
function ellipseHit(o, v, A, B){
  const a = (v[0]/A)**2 + (v[1]/B)**2, b = 2*(o[0]*v[0]/(A*A) + o[1]*v[1]/(B*B)), c = (o[0]/A)**2 + (o[1]/B)**2 - 1, disc = b*b - 4*a*c;
  return a > 0 && disc >= 0 ? (-b + Math.sqrt(disc))/(2*a) : null;
}

/* Two-tone seat patterns: bands of rows, or a scattered mosaic like many modern grounds. */
function altRow(i, j, k){
  const p = S.seatPattern || "solid"; if (p === "solid") return false;
  if (p === "bands") return Math.floor(j/5) % 2 === 1;
  if (p === "tiers") return k % 2 === 1;
  const h = Math.sin(i*12.9898 + j*78.233 + k*37.719)*43758.5453; return (h - Math.floor(h)) < 0.28;
}
/* Lettering spelt out in the seats (a club's name or initials in a second colour, as many grounds do). The text is
   drawn small onto a grid of one cell per seat and row, and each seat looks up whether it's part of a letter. */
const letterGrids = {};
function letterGrid(text, cols, rows){
  const k = text + "|" + cols + "|" + rows; if (letterGrids[k]) return letterGrids[k];
  const c = document.createElement("canvas"); c.width = cols; c.height = rows; const g = c.getContext("2d");
  const size = Math.max(4, Math.floor(rows*0.82)); g.font = `900 ${size}px 'Arial Black', 'Arial', sans-serif`;
  const w = g.measureText(text).width || 1, sx = Math.min(1, cols*0.92/w);
  g.setTransform(sx, 0, 0, 1, cols/2, rows/2); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(text, 0, rows*0.04);
  const a = g.getImageData(0, 0, cols, rows).data, on = (col, row) => col >= 0 && row >= 0 && col < cols && row < rows && a[(row*cols + col)*4 + 3] > 110;
  if (Object.keys(letterGrids).length > 12) for (const x in letterGrids) delete letterGrids[x];
  return (letterGrids[k] = on);
}
/* A crowd: one small figure per seat (sampled on very big grounds), in club colours with a few gaps. */
/* The crowd: one person per seat or standing place (thinned out for very big grounds), each a body and a head. Home fans
   mostly wear the club's colours, with a sprinkling of jackets, coats and away shirts; the away end is a block in its own
   colours. Stewards in hi-vis stand along the front facing the crowd. Heads take a mix of skin tones, and some wear hats.
   CROWD keeps where everyone is, so a Mexican wave can stand them up and sit them down again. */
let CROWD = null;
/* The away end: an allocation of seats in one stand (or one side of a bowl), starting from the middle or either end of it
   and growing out from there, block by block, the full height of the stand, with a gap of empty seats round it to keep
   the two sets of fans apart. The home end is a whole stand where the club's most vocal fans stand. */
const AWAY = {on:false, colour:"#f2f2f2", at:"W", anchor:"middle", count:null, gap:3};
const awayOf = () => Object.assign({}, AWAY, S.away || {});
const homeEndOf = () => Object.assign({at:"", name:""}, S.homeEnd || {});
/* Which rows of seats belong to a stand, or a side of a bowl, and where each sits along it as the fans there see it
   (u grows to their right). */
function standRecs(recs, at){
  const dir = SIDE_DIR[at];
  let list = recs.filter(r => !r.floor && r.seats > 0 && (r.stand === at || (dir && r.stand === "B" && (r.x*dir[0] + r.z*dir[1]) > 0.55*Math.hypot(r.x, r.z))));
  if (!list.length) return [];
  let n = dir; if (!n){ const cx = list.reduce((a, r) => a + r.x, 0)/list.length, cz = list.reduce((a, r) => a + r.z, 0)/list.length, l = Math.hypot(cx, cz) || 1; n = [cx/l, cz/l]; }
  for (const r of list) r.u = -r.x*n[1] + r.z*n[0];
  return list;
}
function allocateAway(recs){
  for (const r of recs){ r.away = false; r.empty = false; }
  const A = awayOf(), out = {seats:0, gap:0}; if (!A.on) return out;
  const list = standRecs(recs, A.at); if (!list.length) return out;
  const us = list.map(r => r.u), lo = Math.min(...us), hi = Math.max(...us), u0 = A.anchor === "left" ? lo : A.anchor === "right" ? hi : (lo + hi)/2;
  const total = recs.reduce((a, r) => a + (r.seats || 0), 0), want = A.count != null ? A.count : Math.min(3000, Math.round(total*0.1));
  list.sort((a, b) => Math.abs(a.u - u0) - Math.abs(b.u - u0));
  let edge = 0;
  for (const r of list){ if (out.seats >= want) break; r.away = true; out.seats += r.seats; edge = Math.max(edge, Math.abs(r.u - u0)); }
  for (const r of list) if (!r.away && Math.abs(r.u - u0) <= edge + A.gap){ r.empty = true; out.gap += r.seats; }
  return out;
}
const SKIN = [0xf1c7a6, 0xe0ac86, 0xc68a62, 0x9d6a46, 0x6f4a32, 0x4a3022, 0xf5d3b8, 0xd29b74].map(c => new THREE.Color(c));
const CLOTHES = [0x22262b, 0x2d3a4f, 0x45494d, 0x6b6e70, 0xf4f4f0, 0x3a5a7a, 0x5b4636, 0xd8c9a8, 0x1f2a3a, 0x8a1f1f].map(c => new THREE.Color(c));
const crowdGeo = {body: new THREE.BoxGeometry(0.44, 1, 0.28), head: new THREE.BoxGeometry(0.2, 0.23, 0.21)}; // a box head is 12 triangles, a ball would be eight times that
crowdGeo.body.keep = crowdGeo.head.keep = true;
function addCrowd(recs, F){
  CROWD = null;
  const totalP = recs.reduce((a,r) => a + (r.seats || 0), 0); if (totalP < 1) return;
  const cap = LIGHT ? 26000 : 45000, step = Math.max(1, totalP/cap), widen = Math.min(1.8, Math.sqrt(step));
  const n0 = Math.min(cap + 2000, Math.ceil(totalP/step) + recs.length) + 400;
  const mk = geo => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({roughness:.85}), n0); m.receiveShadow = true; m.castShadow = false; m.userData.crowd = true; return m; };
  const bodies = mk(crowdGeo.body), heads = mk(crowdGeo.head);
  const club = new THREE.Color(S.seat), club2 = new THREE.Color(S.seat2 || "#f2f2f2"), dark = club.clone().multiplyScalar(0.7);
  const A = awayOf(), away = new THREE.Color(A.colour), HE = homeEndOf();
  const full = S.crowdFill == null ? 0.93 : Math.max(0, Math.min(1, S.crowdFill));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0,1,0), hsc = new THREE.Vector3(1,1,1);
  const phase = [], baseY = [];
  let c = 0, carry = 0, seed = 1;
  const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  const place = (x, y, z, hgt, w, shirt, head, ph) => {
    pos.set(x, y, z); sc.set(w, hgt, 1); m4.compose(pos, q, sc); bodies.setMatrixAt(c, m4); bodies.setColorAt(c, shirt);
    pos.y = y + hgt/2 + 0.1; m4.compose(pos, q, hsc); heads.setMatrixAt(c, m4); heads.setColorAt(c, head);
    phase.push(ph); baseY.push(y); c++; };
  const angle = (x, z) => Math.atan2(z, x);
  for (const r of recs){
    const want = (r.seats || 0)/step + carry, n = Math.floor(want); carry = want - n; if (n < 1) continue;
    const dx = r.m1[0]-r.m0[0], dz = r.m1[1]-r.m0[1]; q.setFromAxisAngle(up, Math.atan2(-dz, dx));
    const standing = r.type === "terrace" || r.type === "rail", fill = (r.type === "exec" ? 0.75 : 1)*full, hgt = standing ? 1.35 : 0.62;
    if (r.empty) continue; // the segregation gap round the away end
    const a = angle(r.x, r.z), inAway = !!r.away, kop = !inAway && HE.at && r.stand === HE.at; // the home end: all in the club's colours, and full
    for (let k=0;k<n && c<n0 - 400;k++){
      if (rnd() > (kop ? Math.max(fill, .99) : fill)) continue;
      const f = (k + 0.5 + (rnd()-0.5)*0.3)/n, x = r.m0[0] + dx*f, z = r.m0[1] + dz*f;
      const v = rnd(), shirt = inAway ? (v < .7 ? away : CLOTHES[Math.floor(rnd()*CLOTHES.length)])
        : r.type === "exec" ? CLOTHES[Math.floor(rnd()*4)] // suits and smart coats in the boxes
        : kop ? (v < .7 ? club : v < .85 ? dark : club2)
        : v < .45 ? club : v < .55 ? dark : v < .62 ? club2 : CLOTHES[Math.floor(rnd()*CLOTHES.length)];
      const head = rnd() < .14 ? (inAway ? away : rnd() < .7 ? club : CLOTHES[0]) : SKIN[Math.floor(rnd()*SKIN.length)]; // a bobble hat or a cap now and then
      const h = hgt*(0.9 + rnd()*0.2), y = lerp(r.h0, r.h1, f) + (standing ? 0.05 + h/2 + 0.35 : 0.42 + h/2) + (rnd()-0.5)*0.05;
      place(x, y, z, h, widen*(0.9 + rnd()*0.2), shirt, head, a);
    }
  }
  // stewards in hi-vis along the front of the lowest tiers, every 20 m or so, facing the crowd
  if (F && S.stewards !== false){ const vis = new THREE.Color(0xd8ff1e), front = recs.filter(r => r.j === 0 && !r.floor && r.h0 < 3);
    let run = 0; for (const r of front){ run += r.len || 0; if (run < 20 || c >= n0) continue; run = 0;
      const dx = r.m1[0]-r.m0[0], dz = r.m1[1]-r.m0[1], L = Math.hypot(dx, dz) || 1, nx = dz/L, nz = -dx/L, out = Math.sign(nx*r.x + nz*r.z) || 1; // towards the play
      q.setFromAxisAngle(up, Math.atan2(-dz, dx) + Math.PI);
      place(r.x - nx*out*2.2, 0.9, r.z - nz*out*2.2, 1.2, 1, vis, SKIN[Math.floor(rnd()*SKIN.length)], NaN); } }
  // put everyone in order round the ground, so a wave only has to touch one run of fans at a time
  const order = [...Array(c).keys()].sort((i, j) => (phase[i] !== phase[i] ? 9 : phase[i]) - (phase[j] !== phase[j] ? 9 : phase[j]));
  for (const m of [bodies, heads]){
    const mo = m.instanceMatrix.array, co = m.instanceColor.array, mn = new Float32Array(mo.length), cn = new Float32Array(co.length);
    order.forEach((from, to) => { mn.set(mo.subarray(from*16, from*16 + 16), to*16); cn.set(co.subarray(from*3, from*3 + 3), to*3); });
    mo.set(mn); co.set(cn); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = c; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; group.add(m); }
  const ph = Float32Array.from(order, i => phase[i]), live = ph.findIndex(x => x !== x);
  CROWD = {bodies, heads, phase:ph, n: live < 0 ? c : live, base:[bodies.instanceMatrix.array.slice(0, c*16), heads.instanceMatrix.array.slice(0, c*16)], lo:0, hi:0};
}
/* Players lined up for kick-off: the home side in the club's colours, the away side in the away colours (or white or
   black, whichever stands out more), keepers in their own kits, and a referee with the ball on the centre spot. */
const KICKOFF = {
  football:[[-.93,0,1],[-.62,-.6],[-.66,-.2],[-.66,.2],[-.62,.6],[-.32,-.62],[-.34,-.2],[-.34,.2],[-.32,.62],[-.06,-.14],[-.02,.12]],
  rugby:[[-.08,-.5],[-.08,0],[-.08,.5],[-.12,-.25],[-.12,.25],[-.16,-.6],[-.16,.6],[-.2,0],[-.3,-.1],[-.38,-.25],[-.5,-.62],[-.46,-.4],[-.46,.4],[-.5,.62],[-.8,0]]
};
function addPlayers(F, sp){
  const lineup = KICKOFF[sp]; if (!lineup) return;
  const home = new THREE.Color(S.seat), A = S.away || {}, lum = c => 0.3*c.r + 0.59*c.g + 0.11*c.b;
  const away = A.on && A.colour ? new THREE.Color(A.colour) : new THREE.Color(lum(home) > 0.5 ? 0x15181c : 0xf4f4f0);
  const mats = {}, mat = c => { const k = c.getHexString(); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({color:c.clone(), roughness:.7})); };
  const shorts = c => lum(c) > 0.5 ? new THREE.Color(0x1d2228) : new THREE.Color(0xf4f4f0);
  const body = new THREE.BoxGeometry(0.5, 0.75, 0.3), legs = new THREE.BoxGeometry(0.42, 0.85, 0.26), head = new THREE.BoxGeometry(0.24, 0.27, 0.25);
  const skins = [0xf1c7a6, 0xc68a62, 0x6f4a32, 0xe0ac86, 0x9d6a46];
  let seed = 3; const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  const person = (x, z, shirt, short, face) => {
    for (const [geo, c, y] of [[legs, short, 0.43], [body, shirt, 1.23], [head, new THREE.Color(skins[face % skins.length]), 1.75]]){
      const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.rotation.y = Math.atan2(-x, -z) + (rnd() - .5)*.6; m.castShadow = true; m.userData.stadium = true; group.add(m); } };
  const hx = F.W/2, hz = F.H/2;
  lineup.forEach(([fx, fz, gk], i) => {
    person(fx*hx + (rnd() - .5), fz*hz + (rnd() - .5), gk ? new THREE.Color(0x3fbf5a) : home, shorts(home), i);
    const [gx, gz] = [-fx*hx + (rnd() - .5), -fz*hz + (rnd() - .5)]; person(gx, gz, gk ? new THREE.Color(0xf2c230) : away, shorts(away), i + 2); });
  person(3, hz*0.28, new THREE.Color(0x111111), new THREE.Color(0x111111), 1); // the referee
  const ball = new THREE.Mesh(new THREE.SphereGeometry(sp === "rugby" ? 0.15 : 0.11, 12, 8), mat(new THREE.Color(0xffffff)));
  if (sp === "rugby") ball.scale.set(1, 0.68, 0.68); ball.position.set(0, 0.13, 0); ball.castShadow = true; ball.userData.stadium = true; group.add(ball);
}
/* A Mexican wave: a band of fans stands up as it sweeps round the ground, twice and a bit. Only the fans the band has
   reached or just left are moved and sent to the graphics card each frame. Returns false once everyone's sat down. */
function waveTick(t){
  const W = CROWD; if (!W || !W.n) return false;
  const dur = 9000, k = Math.min(1, t/dur), TAU = Math.PI*2, width = 0.35, P = W.phase, n = W.n;
  const front = k < 1 ? -Math.PI + k*TAU*1.4 : NaN;
  const find = x => { let a = 0, b = n; while (a < b){ const m = (a + b) >> 1; if (P[m] < x) a = m + 1; else b = m; } return a; };
  let lo = 0, hi = n; // everyone, when the band wraps past the back of the ground or the wave is over
  if (k < 1){ const f = Math.atan2(Math.sin(front), Math.cos(front)); if (f - width > -Math.PI && f + width < Math.PI){ lo = find(f - width); hi = find(f + width); } }
  const a = Math.min(lo, W.lo), b = Math.max(hi, W.hi); W.lo = lo; W.hi = hi;
  [W.bodies, W.heads].forEach((m, which) => { const arr = m.instanceMatrix.array, base = W.base[which];
    for (let i=a;i<b;i++){ let d = front - P[i]; d -= Math.round(d/TAU)*TAU; const lift = d === d ? Math.max(0, 1 - Math.abs(d)/width) : 0;
      arr[i*16 + 13] = base[i*16 + 13] + 0.5*Math.sin(lift*Math.PI/2)*(which ? 1.15 : 1); }
    m.instanceMatrix.updateRange.offset = a*16; m.instanceMatrix.updateRange.count = Math.max(0, b - a)*16; m.instanceMatrix.needsUpdate = true; });
  return k < 1;
}
/* Scenery round the ground. Realistic: a sky that fades to a hazy horizon, grass fields that melt into it, and a
   light-polluted glow at night. Model: the plain backdrop that matches the app. The haze is always there but pushed out
   of sight for the model look and the plan view, since switching it on and off would rebuild every material. */
const FOG = new THREE.Fog(0xdfe8ec, 1e5, 2e5); scene.fog = FOG;
const sceneryTex = {};
function skyTexture(night){
  const dusk = !night && S.hour != null && 62*Math.sin(Math.PI*(S.hour - 5.5)/15) < 14;
  const k = night ? "night" : dusk ? "dusk" : "day"; if (sceneryTex[k]) return sceneryTex[k];
  const c = document.createElement("canvas"); c.width = 4; c.height = 512; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
  if (night){ gr.addColorStop(0, "#03060d"); gr.addColorStop(0.55, "#0b1528"); gr.addColorStop(0.85, "#1e2a44"); gr.addColorStop(1, "#33405a"); }
  else if (dusk){ gr.addColorStop(0, "#2f4f86"); gr.addColorStop(0.5, "#8a8fb8"); gr.addColorStop(0.82, "#f0a878"); gr.addColorStop(1, "#ffd59a"); }
  else { gr.addColorStop(0, "#4f86c6"); gr.addColorStop(0.5, "#8fb6dd"); gr.addColorStop(0.85, "#cddff0"); gr.addColorStop(1, "#e4ecf0"); }
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.keep = true; return (sceneryTex[k] = t);
}
function grassTexture(){
  if (sceneryTex.grass) return sceneryTex.grass;
  const c = document.createElement("canvas"), N = 256; c.width = c.height = N; const g = c.getContext("2d");
  let seed = 11; const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  g.fillStyle = "#cfd8c4"; g.fillRect(0, 0, N, N);
  for (let i=0;i<9000;i++){ const v = 180 + Math.floor(rnd()*60); g.fillStyle = `rgb(${v-14},${v},${v-24})`; g.fillRect(rnd()*N, rnd()*N, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(600, 600); t.keep = true; return (sceneryTex.grass = t);
}
function setGroundMap(map){ if (groundMat.map !== map){ groundMat.map = map; groundMat.needsUpdate = true; } }
function fogReach(){ const real = S && S.scenery !== "model" && camera !== ortho; FOG.near = real ? 650 : 1e5; FOG.far = real ? 3200 : 2e5; }
function realScenery(night){
  const sky = skyTexture(night); scene.background = sky; FOG.color.set(night ? 0x2a3650 : sky === sceneryTex.dusk ? 0xf0c8a0 : 0xe1eaef); fogReach();
  setGroundMap(grassTexture()); groundMat.color.set(night ? 0x223024 : 0x5a6e4c); plazaMat.color.set(night ? 0x34373a : 0xc4c2ba);
}
function plainScenery(){ setGroundMap(null); fogReach(); }
/* Day or night, and whether roofs can be seen through. */
function applyMood(){
  const night = !!S.night;
  hemi.intensity = night ? 0.16 : 0.75; sun.intensity = night ? 0.06 : 0.9; fill.intensity = night ? 0.04 : 0.25;
  /* The sun's place in the sky from the time of day: up in the east in the morning, high at lunchtime, low and golden in
     the evening, with long shadows. Without a time set it stays where it always was. */
  sun.color.set(0xffffff); hemi.color.set(0xffffff);
  if (S.hour == null || night) sun.position.set(140, 260, 90);
  else { const hr = S.hour, elD = Math.max(3, 62*Math.sin(Math.PI*(hr - 5.5)/15)), el = elD*Math.PI/180, az = Math.PI*(hr - 6)/14, R = 320;
    sun.position.set(R*Math.cos(el)*Math.cos(az), R*Math.sin(el), R*Math.cos(el)*Math.sin(az));
    const warm = Math.max(0, Math.min(1, (22 - elD)/18)); sun.color.lerp(new THREE.Color(0xffa860), warm); hemi.color.lerp(new THREE.Color(0xffd2a8), warm*0.5);
    sun.intensity = 0.9 - 0.3*warm; hemi.intensity = 0.75 - 0.2*warm; }
  M.lamp.emissiveIntensity = night ? 2.2 : 0.9; M.band.emissive.set(night ? 0xffc46b : 0x000000); M.band.emissiveIntensity = night ? 0.55 : 0;
  M.board.emissiveIntensity = night ? 1.6 : 0.8; M.screen.emissiveIntensity = night ? 1.4 : 0.7;
  M.window.emissive.set(night ? 0xffc77a : 0x000000); M.window.emissiveIntensity = night ? 0.6 : 0;
  if (night && S.scenery !== "model") realScenery(true);
  else if (night){ plainScenery(); scene.background = new THREE.Color(0x0a1220); groundMat.color.set(0x1d2420); plazaMat.color.set(0x262c28); }
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
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.keep = true; return (skinTex[kind] = t);
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
  if (S.sport === "cricket" || S.sport === "baseball"){ // a scoreboard in the sport's own language
    g.textAlign = "left"; g.font = "bold 26px monospace"; g.fillStyle = "#ffd65a";
    const lines = S.sport === "cricket" ? [["TOTAL", "245-3"], ["OVERS", "48.2"], ["BATTER 1", "112*"], ["BATTER 2", " 37*"], ["LAST WKT", "88"]]
      : [["AWAY", "0 1 0 2 0 0 1 · 4"], ["HOME", "1 0 0 0 3 1 0 · 5"], ["INNING", "8   OUTS 2"], ["BALLS", "2   STRIKES 1"], ["", ""]];
    lines.forEach(([a, b2], i) => { g.fillStyle = "#cfd8e3"; g.fillText(a, 22, 58 + i*30); g.fillStyle = "#ffd65a"; g.fillText(b2, S.sport === "cricket" ? 300 : 150, 58 + i*30); });
    const t = new THREE.CanvasTexture(c); t.keep = true; return (boardTex[k] = t); }
  g.font = "bold 74px sans-serif"; g.fillText("2 – 1", 256, 128);
  g.font = "bold 30px sans-serif"; g.fillText("HOME", 96, 120); g.fillText("AWAY", 416, 120);
  g.fillStyle = "#ffd65a"; g.font = "bold 26px monospace"; g.fillText("63:12", 256, 172);
  const t = new THREE.CanvasTexture(c); t.keep = true; return (boardTex[k] = t);
}
/* ================= sponsors =================
   Advertising boards round the pitch and LED ribbons along the tier fronts show the sponsors' names, each on a panel in
   its own colours, glowing a little (more at night). The stadium can carry a sponsor's name too (naming rights). */
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
  const cache = !document.fonts || document.fonts.check(font), t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(1/(AD_PANEL*list.length), 1); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.keep = cache;
  const m = new THREE.MeshStandardMaterial({map:t, emissive:0xffffff, emissiveMap:t, roughness:.45, side:THREE.DoubleSide}); m.keep = cache;
  if (cache) adMats[key] = m;
  return m;
}
/* One run of adverts: quads {a, b, h, view} in order along the run, where view is a point the readers are looking from,
   so the names read the right way round from there. */
function adStrip(quads){
  const pos = [], uv = []; let acc = 0;
  for (const q of quads){
    const dx = q.b[0] - q.a[0], dz = q.b[2] - q.a[2], len = Math.hypot(dx, dz); if (len < 1e-3) continue;
    const vx = q.view[0] - (q.a[0] + q.b[0])/2, vz = q.view[1] - (q.a[2] + q.b[2])/2, sg = dx*vz - dz*vx >= 0 ? 1 : -1; // left to right for the reader
    const u0 = acc*sg, u1 = (acc + len)*sg; acc += len;
    const A = q.a, B = q.b, C = [B[0], B[1] + q.h, B[2]], D = [A[0], A[1] + q.h, A[2]];
    pos.push(...A, ...B, ...C, ...A, ...C, ...D); uv.push(u0,0, u1,0, u1,1, u0,0, u1,1, u0,1);
  }
  if (!pos.length) return;
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  const mat = adMaterial(); mat.emissiveIntensity = S.night ? 1.1 : .4;
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
const ACCESS = {on:false, at:"back", per:2, length:9};
const ACCESS_AT = {front:"Front of the lower tier", middle:"Middle of the lower tier, by an entrance", back:"Back of the lower tier", upper:"Front of the top tier",
  spread:"Spread over several levels (lower tier front and back, top tier front)"};
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
/* Façade looks. Each draws onto one stretch of outside wall from a to b (points on the ground), whose top runs from ya to
   yb, facing out along n. Everything stands slightly proud of the wall so it reads from the street and from the air. */
const FACADE_LOOKS = {brick:"Brick, with rows of windows", timber:"Painted timber", deco:"Art deco ribs", concrete:"Concrete bands",
  sheet:"Metal cladding with a club-colour stripe", fins:"Metal fins over a glazed concourse", glass:"Glass curtain wall", grid:"Windows all over", plain:"Plain wall"};
/* Real-looking wall materials: brick courses, board-marked concrete, profiled metal sheet and timber boarding, drawn as
   light patterns that the wall's own colour tints. They repeat every few metres along the wall. */
const wallTex = {};
function wallTexture(kind){
  if (wallTex[kind]) return wallTex[kind];
  const c = document.createElement("canvas"), N = 512; c.width = c.height = N; const g = c.getContext("2d");
  let seed = 7; const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  const shade = v => { const x = Math.round(255*Math.max(0, Math.min(1, v))); return `rgb(${x},${x},${x})`; };
  let metres = 4;
  if (kind === "brick"){ // 4 m square: 0.075 m courses of 0.225 m bricks in stretcher bond, lighter mortar
    g.fillStyle = shade(1); g.fillRect(0,0,N,N); const ch = N/53.3, bw = N/17.8;
    for (let r=0, y=0; y<N; r++, y+=ch) for (let x = (r%2) ? -bw/2 : 0; x<N; x+=bw){ g.fillStyle = shade(0.74 + rnd()*0.16); g.fillRect(x + 1, y + 1, bw - 2, ch - 2); } }
  else if (kind === "concrete"){ // 4.8 m: board-marked panels with tie holes and a little staining
    metres = 4.8; g.fillStyle = shade(0.92); g.fillRect(0,0,N,N);
    for (let i=0;i<5000;i++){ g.fillStyle = shade(0.84 + rnd()*0.14); g.fillRect(rnd()*N, rnd()*N, 2, 2); }
    g.fillStyle = shade(0.78); for (const y of [0, N/2]) g.fillRect(0, y, N, 3); for (const x of [0, N/2]) g.fillRect(x, 0, 3, N);
    g.fillStyle = shade(0.7); for (const x of [N/8, 3*N/8, 5*N/8, 7*N/8]) for (const y of [N/8, 3*N/8, 5*N/8, 7*N/8]){ g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
  else if (kind === "cladding"){ // 2 m: profiled metal sheet with a rib every 0.25 m
    metres = 2; for (let x=0;x<N;x++){ const f = (x % (N/8))/(N/8), v = f < .15 ? 0.7 + f*1.5 : f < .3 ? 1 : 0.88 + 0.04*Math.sin(f*6); g.fillStyle = shade(v); g.fillRect(x, 0, 1, N); }
    g.fillStyle = shade(0.8); g.fillRect(0, N - 3, N, 3); }
  else { // timber boarding, 0.16 m boards
    metres = 3; for (let y=0, i=0; y<N; y+=N/18.75, i++){ g.fillStyle = shade(0.82 + rnd()*0.14); g.fillRect(0, y, N, N/18.75); g.fillStyle = shade(0.6); g.fillRect(0, y, N, 2); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1/metres, 1/metres);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.keep = true; return (wallTex[kind] = t);
}
const LOOK_TEX = {brick:"brick", timber:"timber", sheet:"cladding", fins:"cladding", deco:"concrete", concrete:"concrete", grid:"concrete", plain:"concrete"};
function textured(key, kind){
  if (!kind) return key; const k = key + "~" + kind;
  if (!M[k]){ M[k] = M[key].clone(); M[k].map = wallTexture(kind); }
  M_USED.add(k); return k;
}
/* Lettering for an outside wall or a roof front, in the club's own words. */
const signTex = {}, SIGN_USED = new Set();
function signMaterial(text, colour){
  const k = text + "|" + colour; SIGN_USED.add(k); if (signTex[k]) return signTex[k];
  const font = "800 110px 'Big Shoulders Display', 'Arial Narrow', sans-serif", c = document.createElement("canvas"), g = c.getContext("2d");
  g.font = font; c.width = Math.min(4096, Math.ceil(g.measureText(text).width) + 40); c.height = 140;
  g.font = font; g.fillStyle = colour; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width/2, 76);
  // kept between builds once the lettering font has loaded; until then made afresh and freed with the build
  const cache = !document.fonts || document.fonts.check(font), t = new THREE.CanvasTexture(c); t.keep = cache;
  const m = new THREE.MeshStandardMaterial({map:t, transparent:true, alphaTest:.25, roughness:.5, emissive:new THREE.Color(colour), emissiveMap:t, emissiveIntensity:0});
  m.keep = cache; m.aspect = c.width/c.height;
  m.edge = new THREE.MeshStandardMaterial({map:t, transparent:true, alphaTest:.25, roughness:.6, color:new THREE.Color(0.45, 0.45, 0.45)}); m.edge.keep = cache; // the letters' thickness
  if (cache) signTex[k] = m;
  return m;
}
const ACCENTS = new Set(["trim", "band", "lattice"]); // the club colour goes on dressings and stripes, never on glazing frames or steel
function dressWall(buf, look, wallKey, a, b, ya, yb, n, opt){
  const len = Math.hypot(b[0]-a[0], b[1]-a[1]); if (len < 0.5) return;
  opt = opt || {}; const dens = opt.windows == null ? 1 : opt.windows, wsz = opt.winSize || 1, buf0 = buf;
  buf = k => buf0(opt.accent && ACCENTS.has(k) ? tint(k, opt.accent) : k); // trims, bands and fins in the accent colour
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
  const windows = (key, step, storey, first, w, h, sill) => { if (dens <= 0) return; const nC = cells(step/dens); w *= wsz; h = Math.min(h*wsz, storey - 0.6);
    for (let c=0;c<nC;c++){ const fc = (c + .5)/nC, fw = w/2/len;
      for (let y = first; y + h < Math.min(top(fc), lo + 2) - 1.2; y += storey){
        const fr = .09/len; panel("frame", fc - fw - fr, fc + fw + fr, y - .09, y + h + .09, .04); panel(key, fc - fw, fc + fw, y, y + h, .07); // glass in a frame
        if (w > 1.1) panel("frame", fc - .035/len, fc + .035/len, y, y + h, .09); // and a mullion down the middle of a wide one
        if (sill) panel(sill, fc - fw*1.25, fc + fw*1.25, y - .22, y, .14); } } };
  if (look === "brick"){
    panel("trim", 0, 1, 0, 0.9, .1);
    windows("window", 4.5, 4.2, 4.4, 1.5, 2.3, "trim");
    for (let c=0;c<=cells(4.5);c+=2) rib("trim", c/cells(4.5), .55, .9, Math.max(1.5, top(c/cells(4.5)) - 1.1), .3);
    ledge("trim", lo - 1.1, lo - .4, .45, true);
  } else if (look === "timber"){
    windows("window", 3, 3.6, 2.4, 1.2, 1.6, "white");
    for (let c=0;c<=cells(1.6);c++) rib(wallKey, c/cells(1.6), .12, .3, Math.max(.8, top(c/cells(1.6)) - .3), .06); // cover battens
    ledge("roofGreen", lo - .9, lo - .2, .3, true);
  } else if (look === "deco"){
    const nC = cells(3.2);
    if (dens > 0) for (let c=0;c<nC;c++){ if (dens < 1 && (c % Math.round(1/dens))) continue; const fc = (c + .5)/nC, fw = .7*wsz/len; panel("window", fc - fw, fc + fw, 2.2, Math.max(2.4, top(fc) - 3), .05); }
    for (let c=0;c<=nC;c++) rib("trim", c/nC, .6, .4, Math.max(1, top(c/nC) - .6), .9);
    ledge("trim", lo - 1.3, lo - .3, .7, true); panel("trim", 0, 1, 0, .6, .12);
  } else if (look === "concrete"){
    for (let y = 3; y + 3.2 < lo - .5; y += 5.2){ if (dens > 0) panel("window", 0, 1, y, y + 1.6*wsz, .05); ledge("concrete", y + 1.6, y + 3.1, .8); }
    ledge("concrete", lo - 1.2, lo - .2, .9, true);
  } else if (look === "sheet"){ // profiled metal panels between the stand's frame, a glazed ground floor and one bold club stripe
    const base = Math.min(4.4, lo - 1.5);
    if (base > 2.5){ panel("window", 0, 1, .3, base, .07); for (let c=0;c<=cells(1.8);c++) rib("frame", c/cells(1.8), .1, .3, base, .14); ledge("steel", base, base + .4, 1.4); }
    const stripe = lo > 10;
    for (let c=0;c<=cells(8);c++) rib(wallKey, c/cells(8), .4, Math.max(0, base) + .4, Math.max(base + .8, stripe ? lo - 3.6 : top(c/cells(8)) - .1), .22);
    if (stripe) ledge("band", lo - 3.6, lo - 1.8, .3, true);
    ledge("steel", lo - .45, lo - .05, .4, true);
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
    for (let y = 3.75; y < lo - 1.5; y += 3.3) ledge(wallKey, y, y + .3, .25); // a floor edge between each storey
    ledge("trim", lo - .8, lo - .2, .3, true);
  }
  if (opt.concourse && lo > 6 && look !== "fins" && look !== "glass"){ // a glazed concourse along the ground floor, under a canopy
    panel("window", 0, 1, .3, 4.4, .08); panel("glass", 0, 1, .3, 4.4, .5);
    for (let c=0;c<=cells(2.4);c++) rib("steel", c/cells(2.4), .12, .3, 4.4, .55);
    ledge("steel", 4.4, 4.75, 1.6);
  }
}
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
let PRE = false;
function build(){
  let alignTop = null, roofNeedMax = 0;
  if (S.roofAlign && !PRE){ PRE = true; const d0 = DRY; DRY = true; try { alignTop = build().roofNeedMax; } finally { DRY = d0; PRE = false; } }
  const F = field(), L = S.limits, lay = layoutOf(), shape = F.pitch ? "curved" : S.cornerShape || "curved", groundRoof = !!(S.groundRoof && S.groundRoof.on);
  focusY = F.focusY || 0;
  focusIn = S.focusIn != null ? Math.max(0, Math.min(S.focusIn, maxFocusIn(F))) : defaultFocusIn(F);
  const floorRows = F.custom ? Math.max(0, Math.round(S.custom.floor || 0)) : 0;
  const floorStart = 1.2, floorT = 0.85;
  const floorNeed = floorRows ? floorStart + floorRows*floorT + 0.9 : 1;
  const hard = hardStop(), set = Math.max(S.setback, floorNeed, hard);
  const standSet = cfg => Math.max(floorNeed, hard, cfg && cfg.dist != null ? cfg.dist : S.setback);
  const CV = convertView();
  const radius = F.pitch ? F.r : (F.custom || F.noStands) ? (F.r > 0 ? F.r : S.corner) : S.corner; // a shaped field sets its own curve
  const poly = S.plot.on && S.plot.pts ? S.plot.pts : null;
  const site = (Array.isArray(S.site) ? S.site : []).filter(f => SITE_KINDS[f.kind] && f.length > 0 && f.width > 0);
  const obstacles = site.map(f => ({f, poly:featurePoly(f, 1)})); // stands keep a metre clear of roads, water and buildings
  const roomAt = (o2, v2, d0) => { let dm = poly ? exitDist(poly, o2, v2, d0) : Infinity; for (const ob of obstacles) dm = Math.min(dm, enterDist(ob.poly, o2, v2, d0)); return dm; };
  if (!DRY){
    scene.remove(group);
    const shared = new Set(Object.values(M)); // free what this build made, but keep the shared materials and cached textures
    group.traverse(o => { if (o.geometry && !o.geometry.keep) o.geometry.dispose(); for (const m of [].concat(o.material || [])){ if (m.map && m.map.dispose && !m.map.keep) m.map.dispose(); if (!m.keep && !shared.has(m)) m.dispose(); } });
    sweepMats();
    group = new THREE.Group(); scene.add(group);
  }
  const Bf = {}; const buf = k => (Bf[k] = Bf[k] || []);
  const issues = [], byType = {seated:0,exec:0,rail:0,bench:0,terrace:0}, parts = [], standInfo = {}, handles = [];
  /* Every check result has a category (geometry note, viewing issue, rule break), a key so a fix can test it worked, and an optional fix. */
  const issue = (text, key, cat, extra) => issues.push(Object.assign({text, key, cat}, extra || {}));
  const outline = []; let outerTop = 0;
  let wheelchair = 0, total=0, minC=Infinity, maxH=0, far=0, farRef=null, restricted=0, slowest=0, slowestEm=0, curRef = null;
  const bounds = [-(F.W/2+set), F.W/2+set, -(F.H/2+set), F.H/2+set];
  const focus = F.home || [0,0];
  const farFrom = (x,z,y) => {
    let tx = focus[0], tz = focus[1];
    if (F.flag){ tx = -Math.sign(x||1)*F.flag[0]; tz = -Math.sign(z||1)*F.flag[1]; }
    const dd = Math.hypot(x-tx, z-tz, y - focusY);
    if (dd > far){ far = dd; farRef = curRef; }
  };
  const grow = (x,z) => { outline.push([x,z]); bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.max(bounds[1], x); bounds[2] = Math.min(bounds[2], z); bounds[3] = Math.max(bounds[3], z); };
  const regions = [], roofQuads = [], allRecs = [], anchors = [], boardGaps = [];

  if (poly){
    const hx = F.W/2+set, hz = F.H/2+set;
    if (![[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].every(p => inPoly(p, poly)))
      issue("The playing area doesn't fit inside the plot.", "site:floor", "geo", {fix:{label:"Fit the plot round it", run:() => { plotShape("snug", true); return true; }}});
  }

  // seating types in use, then type-wide checks
  const used = new Set();
  const addUsed = arr => arr.forEach(x => used.add(x.type));
  if (lay !== "stands"){ addUsed(S.bowl.tiers); if (S.bowl.varyRows) for (const s2 of SIDES) if (!bowlGone(s2)) addUsed(bowlSideTiers(s2)); }
  if (lay === "ring") ringOf().stands.forEach(r => addUsed(r.tiers));
  else if (lay !== "bowl"){ SIDES.forEach(s => addUsed(S.stands[s].tiers)); if (CORNERS.some(c => cornerPlan(c).stand)) addUsed(S.cornerCustom); }
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
    const oneEnd = L.maxOneEnd == null ? 14 : L.maxOneEnd;
    if (gangEndOf() > oneEnd) issue(`Gangways: rows with a gangway at one end only run to ${gangEndOf()} seats. With a gangway at only one end, a row should stop at ${oneEnd}.`, "gang:end", "rules",
      {fix:{label:`Keep end blocks to ${oneEnd} seats`, run:() => { S.design.gangEnd = oneEnd; return true; }}});
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
    const roofOn = !groundRoof && rf.shape !== "none" && st.roofOn !== false;
    const margin = roofOn ? 1.6 : 0.3;
    let overflow = 0;
    const s0 = setAt(Math.floor(m/2));
    // distances along the stand are measured a few rows back, where a stand wrapping round a corner still has some length
    const sc = closed ? s0 : s0 + 8;
    const cum = [0]; for (let i=1;i<m;i++){ const a = pt(i-1,sc), b = pt(i,sc); cum.push(cum[i-1] + Math.hypot(b[0]-a[0], b[1]-a[1])); }
    const lenTotal = cum[m-1] + (closed ? Math.hypot(pt(0,sc)[0]-pt(m-1,sc)[0], pt(0,sc)[1]-pt(m-1,sc)[1]) : 0);
    const endOpen = s => !closed && ((s === 0 && !(st.joined && st.joined[0])) || (s === m-1 && !(st.joined && st.joined[1]))); // an end that isn't joined to the next stand
    /* A tier can stop short of either end of an open stand (start is the left end, seen from the play). */
    const cut = (tiers, i) => closed || !tiers.some((tr,k) => k >= st.drawFrom && (tr.trim0 > 0 || tr.trim1 > 0)) ? tiers
      : tiers.map((tr,k) => k >= st.drawFrom && (cum[i] < (tr.trim0 || 0) - 1e-6 || cum[i] > lenTotal - (tr.trim1 || 0) + 1e-6) ? Object.assign({}, tr, {ghost:true}) : tr); // laid out but not built, so anything above it stays up
    const profs = [], tierList = [];
    for (let i=0;i<m;i++){
      let tiers = cut(st.tiersFor(i), i); const s0 = setAt(i);
      if (poly || obstacles.length){
        const dm = roomAt(o[i], v[i], s0); if (!isFinite(dm)){ tierList.push(tiers); profs.push(profile(tiers, s0)); continue; }
        if (S.plot.clip) tiers = trimTiers(tiers, dm - margin, s0);
        else { const pr = profile(tiers, s0).filter(p => nRows(p) >= 1); if (pr.length) overflow = Math.max(overflow, Math.max(...pr.map(p => p.front + nRows(p)*p.T)) + margin - dm); }
      }
      tierList.push(tiers); profs.push(profile(tiers, s0));
    }
    /* Keep each tier above the first at one height along the stand. Where the tier below is cut short (by the plot, or a bowl
       side with fewer rows) the tier above would otherwise dip and arch with it; instead it is held level at the height its
       tallest point needs, and its rows are raked from there. Corners are left to blend between their stands. */
    /* A bowl's sides can legitimately differ in depth, so each side is levelled on its own and the corners blend between
       them; a separate stand is levelled along its whole length. */
    const gapped = new Set(); // stair gaps in a bowl's corners: the seating parts there, the building doesn't
    if (st.key !== "C" && st.levelPiece){
      /* Per-side bowl: each side sits level at its own height. Where two sides meet at different heights, each side's tier
         carries on level into the corner and they part at a stair gap halfway round, as two stands would; where they're
         (nearly) the same height the corner just eases from one to the other. */
      const pcs = profs.map((_, i) => st.levelPiece(i)), K0 = Math.max(0, ...profs.map(p => p.length));
      const live = p => p && p.stacked && !p.ghost && nRows(p) >= 1, ease = f => (1 - Math.cos(Math.PI*f))/2;
      const lifts = profs.map(() => []), mid = {};
      pcs.forEach((pc, i) => { if (pc && pc.corner && (mid[pc.key] == null || Math.abs(pc.f - 0.5) < Math.abs(pcs[mid[pc.key]].f - 0.5))) mid[pc.key] = i; });
      const gapFrom = (i, k) => { gapped.add(i); tierList[i] = tierList[i].map((tr, j) => j >= k ? Object.assign({}, tr, {ghost:true}) : tr); profs[i] = profile(tierList[i], setAt(i), lifts[i]); };
      const STEP = 0.3;
      for (let k=1;k<K0;k++){
        const L = {}, R = {};
        profs.forEach((pr, i) => { const pc = pcs[i], p = pr[k]; if (!pc || pc.corner || !live(p)) return; L[pc.key] = Math.max(L[pc.key] == null ? -Infinity : L[pc.key], p.hF); R[pc.key] = Math.max(R[pc.key] || 0, p.rows); });
        const split = pc => L[pc.before] != null && L[pc.after] != null && Math.abs(L[pc.before] - L[pc.after]) > STEP;
        const owner = pc => split(pc) ? [pc.f < 0.5 ? pc.before : pc.after] : [pc.before, pc.after];
        const target = pc => { const a = L[pc.before], b = L[pc.after]; return a == null ? b : b == null ? a : split(pc) ? (pc.f < 0.5 ? a : b) : lerp(a, b, ease(pc.f)); };
        for (let pass=0;pass<4;pass++){
          const up = {};
          profs.forEach((pr, i) => { const pc = pcs[i], p = pr[k]; if (!pc || !pc.corner || !live(p)) return;
            const t = target(pc);
            if (t == null) return; // a tier only in the corner: nothing to line up with
            const e = p.hF - t; if (e <= 0.01) return;
            /* where the tier is tailing away to nothing round the corner, it simply ends rather than pushing the sides up */
            if (p.rows < 0.5*Math.max(R[pc.before] || 0, R[pc.after] || 0)){ tierList[i] = tierList[i].map((tr, j) => j === k ? Object.assign({}, tr, {rows:0}) : tr); profs[i] = profile(tierList[i], setAt(i), lifts[i]); return; }
            for (const s of owner(pc)) if (L[s] != null) up[s] = Math.max(up[s] || 0, e); });
          if (!Object.keys(up).some(s => up[s] > 0.01)) break;
          for (const s in up) if (L[s] != null) L[s] += up[s];
        }
        for (const key in mid){ const i = mid[key]; if (split(pcs[i]) && live(profs[i][k])) gapFrom(i, k); }
        let any = false;
        profs.forEach((pr, i) => { const pc = pcs[i]; if (!pc || !live(pr[k])) return; const t = pc.corner ? target(pc) : L[pc.key];
          if (t != null && t > pr[k].hF + 0.01){ lifts[i][k] = t; any = true; } });
        if (any) for (let i=0;i<m;i++) if (lifts[i].length) profs[i] = profile(tierList[i], setAt(i), lifts[i]);
      }
    } else if (st.key !== "C"){
      const group = st.levelAt || (() => 0), lifts = {}, K0 = Math.max(0, ...profs.map(p => p.length));
      for (let k=1;k<K0;k++){
        const top = {}, uneven = {};
        profs.forEach((pr, i) => { const g = group(i), p = pr[k]; if (g == null || !p || !p.stacked || p.ghost || nRows(p) < 1) return;
          if (top[g] != null && Math.abs(p.hF - top[g]) > 0.01) uneven[g] = true; top[g] = Math.max(top[g] == null ? -Infinity : top[g], p.hF); });
        let any = false; for (const g in uneven){ (lifts[g] = lifts[g] || [])[k] = top[g]; any = true; }
        if (any) for (let i=0;i<m;i++){ const g = group(i); if (g != null && lifts[g]) profs[i] = profile(tierList[i], setAt(i), lifts[g]); }
      }
    }
    /* A convertible ground set up for its second sport: the lower tier slides back or has its front rows decked over so a
       bigger field fits, or pull-out seats come forward towards a smaller one. Tiers above stay where they are. */
    /* The stand's outline as built for its own sport: the roof, outside walls and anything hung from them are sized from
       this, so converting for a second sport moves seats but never the building. */
    const info = profs.map(pr => { const live = pr.filter(p => !p.ghost && nRows(p) >= 1); if (!live.length) return null;
      return {back: Math.max(...live.map(p => p.front + nRows(p)*p.T)), top: Math.max(...live.map(p => p.hs[nRows(p)-1])) + 1.2, front: Math.min(...live.map(p => p.front)), prof: pr}; });
    for (const i of gapped){ const a = info[(i - 1 + m) % m], b = info[(i + 1) % m]; if (!a || !b) continue;
      const own = info[i]; info[i] = {back: Math.max(a.back, b.back), top: Math.max(a.top, b.top), front: own ? own.front : Math.min(a.front, b.front), prof: own ? own.prof : a.prof}; }
    const decks = [];
    if (CV && st.drawFrom === 0) for (let i=0;i<m;i++){
      const p = profs[i][0]; if (!p || p.stacked || p.ghost || nRows(p) < 1) continue;
      const need = lineHit(CV.poly2, o[i], v[i]); if (need == null) continue;
      const delta = need - p.front, from = p.front;
      if (delta > 0.2){
        if (CV.how === "cover"){ const kc = Math.min(nRows(p), Math.ceil(delta/p.T - 1e-6)); p.front += kc*p.T; p.rows -= kc; p.hs = p.hs.slice(kc); if (p.hs.length) p.hF = p.hs[0]; }
        else { p.front += delta; p.back += delta; p.slid = delta; }
        decks[i] = {from, to:p.front, h: nRows(p) >= 1 ? p.hF : 0};
      } else if (delta < -0.5 && CV.pull){
        const k = Math.min(12, Math.floor(-delta/p.T)); if (k < 1) continue; // telescopic seating runs to about a dozen rows
        const N0 = p.hs.length > 1 ? Math.max(.15, p.hs[1] - p.hs[0]) : .3, add = [];
        for (let j=0;j<k;j++) add.push(Math.max(.35, p.hF - (k - j)*N0));
        p.hs = add.concat(p.hs); p.front -= k*p.T; p.rows += k; p.hF = p.hs[0];
      }
    }
    if (overflow > 0.05) issue(`The ${st.name.toLowerCase()} runs ${Math.round(overflow)} m past the plot boundary${obstacles.length ? " or into its surroundings" : ""}.`, "site:" + st.name, "geo",
      {tab:st.key, fix:{label:"Cut it back to fit", run:() => { S.plot.clip = true; return true; }}});
    const marks = step => { const out = new Set(); if (lenTotal < step*0.6) return out; let next = step/2;
      for (let i=0;i<m;i++){ if (cum[i] >= next){ out.add(i); next += step; } } return out; };
    /* Gangways along a tier. Where a row ends at the end of the stand there's a gangway on one side of the end block only,
       so that block is kept to the end-block size; the gangways between are spaced evenly, no further apart than asked. */
    const gangMarks = (pk, step, endLen) => {
      if (closed) return marks(step);
      let iL = -1, iR = -1; for (let i=0;i<m;i++){ const p = pk(i); if (p && !p.ghost && nRows(p) >= 1){ if (iL < 0) iL = i; iR = i; } }
      const out = new Set(); if (iL < 0) return out;
      const a = cum[iL], len = cum[iR] - a, inner = len - 2*endLen, pos = []; if (len < step*0.6) return out;
      if (inner <= 0) pos.push(a + len/2);
      else { const n = Math.max(1, Math.ceil(inner/step)); for (let q=0;q<=n;q++) pos.push(a + endLen + inner*q/n); }
      pos.forEach((x, q) => { let at = -1;
        if (q === 0){ for (let i=iL;i<=iR;i++) if (cum[i] <= x + 1e-6) at = i; } // the end blocks round down, never over
        else if (q === pos.length - 1){ for (let i=iR;i>=iL;i--) if (cum[i] >= x - 1e-6) at = i; }
        else { let bd = Infinity; for (let i=iL;i<=iR;i++){ const d = Math.abs(cum[i] - x); if (d < bd){ bd = d; at = i; } } }
        if (at >= 0) out.add(at); });
      return out; };
    const tangent = i => { let a, b;
      if (closed){ a = pt((i-1+m)%m,s0); b = pt((i+1)%m,s0); } else { a = pt(Math.max(0,i-1),s0); b = pt(Math.min(m-1,i+1),s0); }
      const tx = b[0]-a[0], tz = b[1]-a[1], l = Math.hypot(tx,tz) || 1; return [tx/l, tz/l]; };
    const above = st.drawFrom > 0, K = Math.max(0, ...profs.map(p => p.length));
    const realCount = Math.max(0, ...profs.map(p => p.filter((x,k) => k >= st.drawFrom && !x.ghost).length));
    let standSeats = 0, standEvac = 0, standTop = 0, standBack = 0; const kinds = new Set(), segRecs = [], cols = [], tierRecs = [], towerReqs = [];
    const wallBase = sty.wall === "concrete" ? "concrete" : sty.wall === "glassClad" ? "glassClad" : "clad_" + cfg.style;
    const wallKey = textured(tint(wallBase, fac.colour), wallBase === "glassClad" ? null : LOOK_TEX[look]); // the wall's colour and real material
    const pillarAt = marks(12), midI = (() => { let best = Math.floor(m/2), bd = Infinity; for (let i=0;i<m;i++){ const d = Math.abs(cum[i] - lenTotal/2); if (d < bd && profs[i].some(p => nRows(p) >= 1 && !p.ghost)){ bd = d; best = i; } } return best; })();
    /* Seat lettering on this stand: where the text is centred along the stand, and which way the reader's right is. */
    const ST = S.seatText || {}, lettered = !!(ST.text && ST.at === st.key);
    let letterAt = null;
    if (lettered){ let si = midI;
      if (closed){ let bd = Infinity; for (let i=0;i<m;i++){ const d = -v[i][1]/(Math.hypot(v[i][0], v[i][1]) || 1), x = Math.abs(pt(i, 0)[0]); if (d > 0.9 && x < bd){ bd = x; si = i; } } } // the middle of the main side
      const a = pt(si, 0), b = pt(nx(si) === 0 && !closed ? si : nx(si), 0), tx = b[0] - a[0], tz = b[1] - a[1], dx = -a[0], dz = -a[1];
      letterAt = {s0: cum[si], dir: tx*dz - tz*dx >= 0 ? 1 : -1, cols: Math.ceil(Math.min(lenTotal, 150)/0.5)}; }
    /* The tunnel and dugouts on this stand, as blocks along it (in metres, as cum measures) whose front rows are cut out
       (or given padded seats). sideHere finds this stand's middle on the asked-for side: its own middle, or for a bowl
       the slice facing that way. */
    const sideHere = at => { if (at === st.key && !st.drawFrom) return midI;
      const dir = {N:[0,-1], S:[0,1], E:[1,0], W:[-1,0]}[at]; if (st.key !== "B" || !dir) return -1;
      let bi = -1, bd = Infinity; for (let i=0;i<m;i++){ const vl = Math.hypot(v[i][0], v[i][1]) || 1, q = pt(i, 0), lat = Math.abs(dir[0] ? q[1] : q[0]);
        if ((v[i][0]*dir[0] + v[i][1]*dir[1])/vl > 0.9 && lat < bd){ bd = lat; bi = i; } } return bi; };
    const rightAt = si => { const last = !closed && si >= m - 1, a = pt(last ? si - 1 : si, 0), b = pt(last ? si : nx(si), 0);
      return (b[0] - a[0])*(-a[1]) - (b[1] - a[1])*(-a[0]) >= 0 ? 1 : -1; }; // +1 when going along the stand is to the right, seen from the play
    const wrapS = d => closed ? d - Math.round(d/lenTotal)*lenTotal : d;
    const blocks = [], TN = tunnelOf(), DG = dugoutsOf(), pitchy = hasDugouts() && !CV;
    if (pitchy && TN.on){ const si = sideHere(TN.at); if (si >= 0) blocks.push({kind:"tunnel", si, c: cum[si] + rightAt(si)*TN.pos, hw: TN.width/2}); }
    if (pitchy && DG.on){ const si = sideHere(DG.at); if (si >= 0)
      for (const e2 of [-1, 1]) blocks.push({kind: DG.style === "seats" ? "padded" : DG.style === "sunk" ? "dugout" : "bubble", si, c: cum[si] + e2*(DG.gap + DG.length/2), hw: DG.length/2}); }
    const VH = vehicleOf(); if (VH.on && !CV){ const si = sideHere(VH.at); if (si >= 0) blocks.push({kind:"vehicle", si, c: cum[si] + rightAt(si)*VH.pos, hw: VH.width/2 + .3}); }
    const AC = accessOf(), acPer = cfg.accessCount != null ? Math.max(0, Math.round(cfg.accessCount)) : AC.per;
    if (AC.on && acPer > 0){ // spread evenly along the stand's seated length
      let iL = -1, iR = -1; for (let i=0;i<m;i++) if (profs[i].some((p, k) => k >= st.drawFrom && p && !p.ghost && nRows(p) >= 1)){ if (iL < 0) iL = i; iR = i; }
      if (iL >= 0){ const a = closed ? 0 : cum[iL], L = closed ? lenTotal : cum[iR] - cum[iL];
        const nP = closed ? acPer*4 : acPer; // a closed bowl has four sides, each getting its share
        for (const lv of AC.at === "spread" ? ["back", "front", "upper"] : [AC.at])
          for (let q=0;q<nP;q++) if (L > AC.length + 4) blocks.push({kind:"access", at:lv, si:midI, c: a + L*(q + .5)/nP, hw: Math.min(AC.length, L/nP - 1)/2, tierTop: lv === "upper"}); } }
    const cutAt = (s2, j, list) => { for (const b of list) if (b.R && j >= (b.r0 || 0) && j < b.R && Math.abs(wrapS(s2 - b.c)) < b.hw) return b.kind === "padded" ? "padded" : "cut"; return null; };
    const inCut = (s2, list) => list.some(b => b.R && b.kind !== "padded" && Math.abs(wrapS(s2 - b.c)) < b.hw + 0.6);
    const ptS = (s2, d) => { let x = closed ? ((s2 % lenTotal) + lenTotal) % lenTotal : Math.max(0, Math.min(cum[m-1], s2)), i = 0;
      while (i < m - 1 && cum[i+1] <= x) i++; if (!closed && i >= m - 1) i = m - 2;
      const j = nx(i), segL = (j === 0 ? lenTotal : cum[j]) - cum[i], f = segL > 0 ? (x - cum[i])/segL : 0, a = pt(i, d), b = pt(j, d);
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; };
    const sideMids = (() => { if (!st.sideAt) return []; const by = {}; for (let i=0;i<m;i++){ const s = st.sideAt(i); if (s) (by[s] = by[s] || []).push(i); }
      return Object.entries(by).map(([s, l]) => [l[Math.floor(l.length/2)], s]); })();
    const cap = (s, p, from, to, rail) => {
      const T = p.T, d1 = p.front + from*T, d2 = p.front + to*T;
      const y1 = p.stacked ? (from === 0 ? p.hF - 1.5 : p.hs[from] - 1.5) : 0, y2 = p.stacked ? p.hs[to-1] - 1.5 : 0;
      /* the end of a tier: a concrete side wall stepping up with the rows, just proud of them, with a handrail along the top */
      const yb = d => lerp(y1, y2, (d - d1)/Math.max(1e-6, d2 - d1)), cb = buf("concrete");
      for (let j=from;j<to;j++){ const a = p.front + j*T, b = a + T, h = p.hs[j] + .15; quad(cb, V(s,a,yb(a)), V(s,b,yb(b)), V(s,b,h), V(s,a,h)); }
      if (rail === false) return; // where it meets the next stand, the wall only closes any step between them
      const hb = buf("steel"), r0 = [d1 + .2, p.hs[from] + 1.1], r1 = [d2 - .2, p.hs[to-1] + 1.1];
      bar(hb, V(s,r0[0],r0[1]), V(s,r1[0],r1[1]), .06);
      const posts = Math.max(1, Math.round((to - from)*T/2.5));
      for (let q=0;q<=posts;q++){ const d = lerp(r0[0], r1[0], q/posts), j = Math.min(to-1, from + Math.floor((d - p.front)/T)); bar(hb, V(s,d,p.hs[j]+.15), V(s,d,lerp(r0[1], r1[1], q/posts)), .05); }
    };
    let kDrawn = 0;
    /* Each tier position is drawn once per kind of seating found there: a corner can have boxes coming in from one stand
       and seats from the other at the same level, and each needs its own row depth, sightline and capacity. */
    const kindsAt = k => { const t = new Set(); for (let i=0;i<m;i++){ const p = profs[i][k]; if (p && !p.ghost && nRows(p) >= 1) t.add(p.type); } return t.size > 1 ? [...t] : [null]; };
    for (let k=st.drawFrom;k<K;k++) for (const only of kindsAt(k)){
      const pk = i => { const p = profs[i][k]; return p && (!only || p.type === only) ? p : undefined; };
      let best = null, tierType = null;
      for (let i=0;i<m;i++){ const p = pk(i); if (p && !p.ghost && nRows(p) >= 1){ tierType = tierType || p.type; if (!best || nRows(p) > nRows(best)) best = p; } }
      if (!tierType) continue;
      const T = S.types[tierType].row, eye = TYPES[tierType].eye;
      const kk = k - st.drawFrom, ref = st.tierRef ? st.tierRef(kk) : null, tc = ref || {}, where = {tab:st.key, k:kk};
      const first = !only || only === kindsAt(k)[0], idx = first ? kDrawn : kDrawn - 1;
      const name = cap1((st.name + " " + tierName(idx, realCount, above)).trim() + ((realCount > 1 || above) ? " tier" : ""));
      if (first) kDrawn++;
      curRef = {ref, name, ck: !ref && st.ck ? st.ck : null, kk};
      let tierC = Infinity, firstC = Infinity, steep = 0;
      for (let j=1;j<nRows(best);j++){ const N = best.hs[j]-best.hs[j-1], D = best.front + focusIn + (j-1)*T + 0.3, R0 = best.hs[j-1] + eye - focusY;
        const cv = D*(N+R0)/(D+T) - R0; if (j === 1) firstC = cv; tierC = Math.min(tierC, cv); }
      for (let i=0;i<m;i++){ const p = pk(i); if (p && !p.ghost && nRows(p) >= 2) steep = Math.max(steep, p.steep); }
      noteSteep(st.key, kk, steep);
      let bad = !!typeBad[tierType];
      const lim = rakeLimit(tierType);
      if (steep > lim + 0.05){ bad = true;
        issue(`${name} is ${Math.round(steep)}° steep. The limit for ${tierType === "terrace" ? "terraces" : "seating"} is ${lim}°.`, `steep:${st.name}:${kk}`, "rules",
          Object.assign({fix: ref ? {label:`Flatten it to ${lim}°`, run:() => { ref.rake = lim; return true; }} : null}, where)); }
      if (isFinite(tierC)){ minC = Math.min(minC, tierC);
        if (tierC*1000 < L.minC - 0.5){ bad = true;
          const key = `C:${st.name}:${kk}`, mm = Math.round(tierC*1000), front = firstC*1000 < L.minC + 3;
          const rowsDown = r => { const out = []; for (let x = Math.round(rowsOf(r)) - 1; x >= 2; x--) out.push(x); return out; };
          const setbacks = () => { const out = []; const base = st.key in S.stands && S.stands[st.key].dist != null ? S.stands[st.key].dist : S.setback;
            for (let x = base + 0.5; x <= base + 20; x += 0.5) out.push(x); for (let x = base + 21; x <= base + 40; x += 1) out.push(x); return out; };
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
            if (ref) away.push({moves:true, label:"Use fewer rows", run:() => searchFix(v2 => setRows(ref, v2), rowsDown(ref), key)});
          }
          let alts = [];
          if (best.auto){
            const pri = l => l.startsWith("Tuck") ? 0 : l.startsWith("Aim") ? 1 : 2; close.sort((a,b) => pri(a.label) - pri(b.label));
            const order = S.keepClose === false ? away.concat(close) : close.concat(away);
            fix = order[0] || null; alts = order.slice(1);
          }
          // a corner stand can always be taken away, leaving the gap open
          const cornerFixes = st.ck ? [{moves:true, label:"Leave this corner open", run:() => { S.corners[st.ck].mode = "open"; return !dryIssues().some(i => i.key === key); }}] : [];
          /* Every way of fixing it, tried in turn when the chosen fix alone isn't enough: closer-keeping fixes first unless
             the designer prefers moving seats back. A fix only gives up (and undoes itself) when none of them work. */
          const keeps = [], moves = [];
          if (rakes.length) keeps.push(steeper);
          if (best.stacked && ref) moves.push(() => { const o0 = ref.over || 0; return searchFix(v2 => { ref.over = Math.max(-40, o0 - v2); }, [1,2,3,4,6,8,10,12,15,20,25,30,40], key); });
          const below = kk > 0 && st.tierRef ? st.tierRef(kk - 1) : null; // a tier perched on a very deep one: make the one below shallower
          if (best.stacked && below) moves.push(() => { const top = Math.round(rowsOf(below)), steps = []; for (let x = top - 2; x >= Math.max(4, Math.round(top*0.4)); x -= 2) steps.push(x); return searchFix(v2 => setRows(below, v2), steps, key); });
          if (!st.ck) moves.push(() => searchFix(setDist, setbacks(), key));
          if (ref) moves.push(() => searchFix(v2 => setRows(ref, v2), rowsDown(ref), key));
          for (const f of cornerFixes) moves.push(f.run);
          const rest = S.keepClose === false ? moves.concat(keeps) : keeps.concat(moves);
          const thorough = run => () => { const snap = JSON.stringify(S); if (run()) return true; for (const f of rest){ if (f()) return true; } S = JSON.parse(snap); return false; };
          const all = (fix ? [fix] : []).concat(alts, cornerFixes).map(f => Object.assign({}, f, {run:thorough(f.run)}));
          issue(text, key, "view", Object.assign({fix:all[0] || null, alts:all.slice(1)}, where)); } }
      // creative geometry notes for stacked tiers
      if (best.stacked && !best.lowerGhost && best.over > 0.5){
        const head = best.hF - 1.5 - best.lowerBackH;
        if (head < 2.2) issue(`${name} overhangs the tier below with only ${head.toFixed(1)} m of headroom over its back row.`, `head:${st.name}:${kk}`, "geo",
          Object.assign({fix: ref ? {label:"Raise it to give 2.4 m", run:() => { ref.gap = (ref.gap == null ? 3 : ref.gap) + (2.4 - head); return true; }} : null}, where));
        if (best.over > 12) issue(`${name} projects ${best.over.toFixed(0)} m over the tier below: a very long cantilever. Fine for a sandbox, ambitious in real life.`, `cant:${st.name}:${kk}`, "geo", Object.assign({fix:null}, where));
      }
      if (best.stacked && best.gap > 14 && !best.pillars && !best.lowerGhost && tc.hold !== "towers") issue(`${name} floats ${best.gap.toFixed(0)} m above the tier below with nothing visibly holding it up.`, `float:${st.name}:${kk}`, "geo",
        Object.assign({fix: ref ? {label:"Add pillars under it", run:() => { ref.pillars = true; return true; }} : null}, where));
      /* the tier's own look: the style and colour of its front, and its own seat colour */
      const front = tc.front && tc.front !== "auto" ? tc.front : (sty.lattice ? "lattice" : "plain");
      const frontKey = front === "concrete" ? tint("concrete", tc.frontColour) : front === "brick" ? tint("clad_historic", tc.frontColour) : tint("fascia", tc.frontColour);
      const fasc = buf(bad && S.trim ? "fasciaBad" : st.sel ? "fasciaSel" : frontKey);
      const seatKey = (tierType === "seated" || tierType === "rail") && tc.seatColour ? tint(tierType, tc.seatColour) : tierType;
      const backKey = seatKey !== tierType ? tint("seatBack", tc.seatColour) : "seatBack";
      // the tunnel, dugouts and vehicle access cut into the lowest tier at ground level; wheelchair platforms go where asked
      const topK = Math.max(...profs.map(p => p.length)) - 1, lowest = k === st.drawFrom && !best.stacked;
      const CTl = blocks.filter(b => b.kind === "access" ? (b.tierTop ? k === topK && k > st.drawFrom : lowest) : lowest).map(b => Object.assign({}, b));
      const CT = CTl.length ? CTl : null;
      if (CT) for (const b of CT){ const P = pk(b.si) || best, n = nRows(P), low = h => P.hs.filter(y => y < h).length;
        b.R = b.kind === "tunnel" ? Math.max(3, Math.min(n - 2, low(2.6))) : b.kind === "vehicle" ? Math.max(4, Math.min(n - 1, low(4.7))) : b.kind === "dugout" ? Math.max(2, Math.min(3, low(1.6), n - 2)) : b.kind === "padded" ? Math.min(2, n) : 0;
        if (b.kind === "access" && n >= 4){ b.r0 = b.at === "front" || b.at === "upper" ? 0 : b.at === "back" ? n - 2 : Math.max(1, Math.floor(n*(tc.entryAt || .42)) - 2); b.R = b.r0 + 2; }
        b.P = P; b.T = S.types[tierType].row; }
      // splits a run [fa, fb] of segment i into pieces outside, or inside, a block, about 25 cm at a time
      const piecesOf = (i, j1, j, fa0, fb0, len) => { if (!CT) return null;
        const segL = (closed && j1 === 0 ? lenTotal : cum[j1]) - cum[i], n = Math.max(1, Math.ceil((fb0 - fa0)*len/0.25)), out = [];
        for (let q=0;q<n;q++){ const fa = fa0 + (fb0 - fa0)*q/n, fb = fa0 + (fb0 - fa0)*(q+1)/n, md = cutAt(cum[i] + (fa + fb)/2*segL, j, CT), last = out[out.length-1];
          if (last && last[2] === md) last[1] = fb; else out.push([fa, fb, md]); }
        return out.length === 1 && out[0][2] == null ? null : out; };
      const padKey = tint(tierType === "seated" || tierType === "rail" ? "seated" : "concrete", DG.colour || "#1d2a3a");
      const LG = letterAt && k === st.drawFrom && (tierType === "seated" || tierType === "rail") ? letterGrid(String(ST.text).toUpperCase().slice(0, 24), letterAt.cols, nRows(best)) : null;
      const aisleAt = tierType === "terrace" ? marks(24) : gangMarks(pk, S.design.gangEvery*S.types[tierType].width + S.design.gangWidth, gangEndOf()*S.types[tierType].width + S.design.gangWidth/2);
      const entry = ENTRY[tc.entry] && tc.entry !== "auto" ? tc.entry : !best.stacked && nRows(best) >= 10 ? "middle" : "back";
      const entryEvery = tc.entryEvery > 0 ? tc.entryEvery : S.design.exitEvery;
      const vomAt = entry === "middle" && nRows(best) >= 6 ? marks(entryEvery) : new Set();
      const backAt = entry === "back" && tc.entry === "back" ? marks(entryEvery) : new Set(), frontAt = entry === "front" ? marks(entryEvery) : new Set();
      const emergAt = S.design.emergEvery > 0 ? marks(S.design.emergEvery) : new Set();
      const rowLen = [], recs = []; let frontLen = 0;
      const gangCut = sl => aisleAt.has(sl) ? S.design.gangWidth/2 + .05 : 0;
      const vomRows = n => { const j0 = Math.max(1, Math.min(n - 5, Math.floor(n*(tc.entryAt || 0.42)))); return [j0, Math.min(n, j0 + 4)]; };
      const vomCut = (sl, n, j) => { if (!vomAt.has(sl) || n < 6) return 0; const [ja, jb] = vomRows(n); return j >= ja && j < jb ? S.design.exitWidth/2 + .3 : 0; };
      for (let i=0;i<segs;i++){
        const j1 = nx(i), p0 = pk(i), p1 = pk(j1);
        const n0 = p0 && !p0.ghost ? nRows(p0) : 0, n1 = p1 && !p1.ghost ? nRows(p1) : 0, mr = Math.min(n0, n1);
        if (mr >= 1){
          for (let j=0;j<mr;j++){
            const a0 = p0.front + j*T, a1 = p1.front + j*T, h0 = p0.hs[j], h1 = p1.hs[j];
            const alt = (tierType === "seated" || tierType === "rail") && altRow(i, j, kk);
            const m0 = pt(i, a0+T/2), m1 = pt(j1, a1+T/2), len = Math.hypot(m1[0]-m0[0], m1[1]-m0[1]) || 1e-6;
            // seats stop at the edge of a gangway or an exit tunnel rather than running through it
            const v0 = vomCut(i, n0, j), v1 = vomCut(j1, n1, j), f0 = Math.min(.49, Math.max(gangCut(i), v0)/len), f1 = 1 - Math.min(.49, Math.max(gangCut(j1), v1)/len);
            const E = (d0, y0, d1, y1, f) => { const p = V(i, d0, y0), q = V(j1, d1, y1); return [lerp(p[0],q[0],f), lerp(p[1],q[1],f), lerp(p[2],q[2],f)]; };
            const strip = (key, d0, y0, d1, y1, e0, z0, e1, z1) => quad(buf(key), E(d0,y0,d1,y1,f0), E(d0,y0,d1,y1,f1), E(e0,z0,e1,z1,f1), E(e0,z0,e1,z1,f0));
            const b0 = a0+T-.1, b1 = a1+T-.1;
            let use = Math.max(0, len - Math.min(len*.49, v0) - Math.min(len*.49, v1)); // exit tunnels take seats out; gangways are already allowed for
            if (p0.slid || p1.slid){ const q0 = pt(i, a0 + T/2 - (p0.slid || 0)), q1 = pt(j1, a1 + T/2 - (p1.slid || 0)); use = Math.min(use, Math.hypot(q1[0]-q0[0], q1[1]-q0[1])); } // a tier slid back keeps its own seats
            const PC = piecesOf(i, j1, j, f0, f1, len);
            if (PC || LG){ // piece by piece: around the tunnel and dugouts, and seat by seat where letters are spelt out
              const segL = (closed && j1 === 0 ? lenTotal : cum[j1]) - cum[i], row = nRows(best) - 1 - j; let used = 0;
              for (const [fa, fb, md] of PC || [[f0, f1, null]]){
                if (md === "cut") continue;
                const bits = LG && md == null ? Math.max(1, Math.round((fb - fa)*len/0.5)) : 1;
                for (let q=0;q<bits;q++){ const ga = fa + (fb - fa)*q/bits, gb = fa + (fb - fa)*(q + 1)/bits;
                  let on = false; if (LG && md == null){ let ds = cum[i] + (ga + gb)/2*segL - letterAt.s0; if (closed) ds -= Math.round(ds/lenTotal)*lenTotal; on = LG(Math.floor(letterAt.cols/2 + letterAt.dir*ds/0.5), row); }
                  const sq = (key, d0, y0, d1, y1, e0, z0, e1, z1) => quad(buf(key), E(d0,y0,d1,y1,ga), E(d0,y0,d1,y1,gb), E(e0,z0,e1,z1,gb), E(e0,z0,e1,z1,ga));
                  sq(md === "padded" ? padKey : on || (alt && !LG) ? "seatAlt" : seatKey, a0,h0,a1,h1, a0+T,h0,a1+T,h1);
                  if (j>0) sq("riser", a0,p0.hs[j-1],a1,p1.hs[j-1], a0,h0,a1,h1);
                  if (tierType === "rail") sq("barrier", b0,h0+.95,b1,h1+.95, b0,h0+1.05,b1,h1+1.05);
                  else if (tierType === "terrace"){ if (j>0 && j % S.design.barrierEvery === 0) sq("barrier", a0+.08,h0+.95,a1+.08,h1+.95, a0+.08,h0+1.12,a1+.08,h1+1.12); }
                  else if (tierType !== "bench"){ const bh = md === "padded" ? .62 : tierType === "exec" ? .55 : .42;
                    sq(md === "padded" ? padKey : tierType === "exec" ? "exec" : on || (alt && !LG) ? "seatAltBack" : backKey, b0,h0,b1,h1, b0,h0+bh,b1,h1+bh); } }
                const share = (fb - fa)/Math.max(1e-6, f1 - f0), c0 = lerp2(m0, m1, fa), c1 = lerp2(m0, m1, fb); used += use*share;
                recs.push({j, len:use*share, d:(a0+a1)/2, x:(c0[0]+c1[0])/2, z:(c0[1]+c1[1])/2, i, m0:c0, m1:c1, h0:lerp(h0,h1,fa), h1:lerp(h0,h1,fb), type:tierType}); }
              rowLen[j] = (rowLen[j]||0) + used; if (j === 0) frontLen += len;
              continue; }
            strip(alt ? "seatAlt" : seatKey, a0,h0,a1,h1, a0+T,h0,a1+T,h1);
            if (j>0) strip("riser", a0,p0.hs[j-1],a1,p1.hs[j-1], a0,h0,a1,h1);
            if (tierType === "rail") strip("barrier", b0,h0+.95,b1,h1+.95, b0,h0+1.05,b1,h1+1.05);
            else if (tierType === "terrace"){ if (j>0 && j % S.design.barrierEvery === 0) strip("barrier", a0+.08,h0+.95,a1+.08,h1+.95, a0+.08,h0+1.12,a1+.08,h1+1.12); }
            else if (tierType !== "bench"){ const bh = tierType === "exec" ? .55 : .42; strip(tierType === "exec" ? "exec" : alt ? "seatAltBack" : backKey, b0,h0,b1,h1, b0,h0+bh,b1,h1+bh); }
            rowLen[j] = (rowLen[j]||0) + use; if (j === 0) frontLen += len;
            const c0 = lerp2(m0, m1, f0), c1 = lerp2(m0, m1, f1);
            recs.push({j, len:use, d:(a0+a1)/2, x:(m0[0]+m1[0])/2, z:(m0[1]+m1[1])/2, i, m0:c0, m1:c1, h0:lerp(h0,h1,f0), h1:lerp(h0,h1,f1), type:tierType});
          }
          const y00 = p0.stacked ? p0.hF-1.5 : 0, y10 = p1.stacked ? p1.hF-1.5 : 0;
          const FP = piecesOf(i, j1, 0, 0, 1, Math.hypot(pt(j1,p1.front)[0]-pt(i,p0.front)[0], pt(j1,p1.front)[1]-pt(i,p0.front)[1]) || 1);
          if (FP){ const Ef = (d0, y0, d1, y1, f) => { const p = V(i, d0, y0), q = V(j1, d1, y1); return [lerp(p[0],q[0],f), lerp(p[1],q[1],f), lerp(p[2],q[2],f)]; };
            for (const [fa, fb, md] of FP) if (md !== "cut") quad(fasc, Ef(p0.front,y00,p1.front,y10,fa), Ef(p0.front,y00,p1.front,y10,fb), Ef(p0.front,p0.hF,p1.front,p1.hF,fb), Ef(p0.front,p0.hF,p1.front,p1.hF,fa)); }
          else quad(fasc, V(i,p0.front,y00), V(j1,p1.front,y10), V(j1,p1.front,p1.hF), V(i,p0.front,p0.hF));
          if (tierType === "exec" || front === "glass") quad(buf("glass"), V(i,p0.front,p0.hF), V(j1,p1.front,p1.hF), V(j1,p1.front,p1.hF+1.1), V(i,p0.front,p0.hF+1.1));
          if (front === "concrete" || front === "brick") quad(fasc, V(i,p0.front,p0.hF), V(j1,p1.front,p1.hF), V(j1,p1.front,p1.hF+1), V(i,p0.front,p0.hF+1)); // a solid parapet
          if (p0.stacked && front === "lattice"){ // criss-cross balcony truss
            const lb = buf(tint("lattice", tc.frontColour)), yA = p0.hF-1.45, yB = p0.hF-0.05, f0 = p0.front-.06, f1 = p1.front-.06;
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
        const p = pk(s), n = p && !p.ghost ? nRows(p) : 0; if (n < 1) continue;
        // open stand ends: close the tier, and wall in the space under a stacked tier
        if (!closed && (s === 0 || s === m-1)){
          cap(s, p, 0, n, endOpen(s));
          if (p.stacked){ const bk = p.front + n*T, top = p.hs[n-1], lb = Math.min(p.lowerBack, bk);
            const soff = d => lerp(p.hF - 1.5, top - 1.5, (d - p.front)/Math.max(.1, bk - p.front));
            if (bk > lb + .1){ quad(buf(wallKey), V(s,lb,0), V(s,bk,0), V(s,bk,top-1.5), V(s,lb,soff(lb)));
              // the end of the stand under the tier is part of the building, so it wears the same façade as the back
              const tg0 = tangent(s), out = s === 0 ? [-tg0[0], -tg0[1]] : tg0;
              if (look !== "plain" && !DRY && endOpen(s)) dressWall(buf, look, wallKey, pt(s,lb), pt(s,bk), soff(lb), top - 1.5, out, {windows:fac.windows, winSize:fac.winSize, accent:fac.accent}); }
            if (!p.lowerGhost && lb > p.front + .1){ const low = heightAt(profs[s].slice(0,k), p.front);
              quad(buf(wallKey), V(s,p.front,low + 1), V(s,lb,p.lowerBackH + 1.2), V(s,lb,soff(lb)), V(s,p.front,p.hF - 1.5)); }
          }
        }
        const tg = tangent(s);
        const across = (w, d, y, side) => { const q = pt(s, d); return [q[0] + tg[0]*w*side, y, q[1] + tg[1]*w*side]; };
        if (aisleAt.has(s) && !(CT && inCut(cum[s], CT))){ // a stepped gangway: two steps to each row where the rake is steep, yellow nosings, a handrail
          const gw = S.design.gangWidth/2, at = (d, y, side) => across(gw, d, y, side), seats = tierType !== "terrace";
          const tread = (d0, d1, y) => { quad(buf("aisle"), at(d0,y,-1), at(d0,y,1), at(d1,y,1), at(d1,y,-1)); quad(buf("barrier"), at(d0,y+.01,-1), at(d0,y+.01,1), at(d0+.07,y+.01,1), at(d0+.07,y+.01,-1)); };
          const riser = (d, y0, y1) => { if (y1 > y0 + .01) quad(buf("riser"), at(d,y0,-1), at(d,y0,1), at(d,y1,1), at(d,y1,-1)); };
          for (let j=0;j<n;j++){ const a = p.front + j*T, h = p.hs[j] + .02, prev = j ? p.hs[j-1] + .02 : h, rise = h - prev;
            if (seats && rise > .3){ const mid = h - rise/2; riser(a, prev, mid); tread(a, a + T/2, mid); riser(a + T/2, mid, h); tread(a + T/2, a + T, h); }
            else { riser(a, prev, h); tread(a, a + T, h); } }
          if (seats && n >= 4 && p.steep > 25) for (let j=0;j<n-1;j++){ const q0 = pt(s, p.front + (j+.5)*T), q1 = pt(s, p.front + (j+1.5)*T);
            bar(buf("steel"), [q0[0], p.hs[j]+.95, q0[1]], [q1[0], p.hs[j+1]+.95, q1[1]], .06);
            if (j % 3 === 0) bar(buf("steel"), [q0[0], p.hs[j], q0[1]], [q0[0], p.hs[j]+.95, q0[1]], .05); }
        }
        if (aisleAt.has(s) && !p.stacked && S.design.pitchGates !== false && !(CT && inCut(cum[s], CT)) && p.hF > .5){ // an emergency gate in the front wall below the gangway
          const gw = S.design.gangWidth/2 + .1, at = (d, y, side) => across(gw, d, y, side), gh = Math.min(p.hF, 1.25), df = p.front - .03;
          quad(buf("dark"), at(df, 0, -1), at(df, 0, 1), at(df, gh, 1), at(df, gh, -1));
          for (const side of [-1, 1]) bar(buf("emerg"), at(df - .02, 0, side), at(df - .02, gh, side), .07);
          bar(buf("emerg"), at(df - .02, gh, -1), at(df - .02, gh, 1), .07); }
        if (emergAt.has(s) && n >= 3){ // an emergency-only exit at the back of the tier: a door through the back wall, a lit sign over it
          const ew = S.design.exitWidth/2, at = (d, y, side) => across(ew, d, y, side), bk = p.front + n*T - .02, y0 = p.hs[n-1] + .02;
          quad(buf("void"), at(bk, y0, -1), at(bk, y0, 1), at(bk, y0 + 1.15, 1), at(bk, y0 + 1.15, -1));
          const c = pt(s, bk - .08); post(buf("emerg"), c[0], c[1], y0 + 1.25, y0 + 1.55, .55); }
        if (backAt.has(s) && n >= 2){ // an entrance at the back: a doorway through the back wall from the concourse behind
          const ew = S.design.exitWidth/2, at = (d, y, side) => across(ew, d, y, side), bk = p.front + n*T - .02, y0 = p.hs[n-1] + .02;
          quad(buf("void"), at(bk, y0, -1), at(bk, y0, 1), at(bk, y0 + 1.15, 1), at(bk, y0 + 1.15, -1)); }
        if (frontAt.has(s) && !p.stacked){ // an entrance at the front: a gap in the front wall from a walkway along the play
          const ew = S.design.exitWidth/2 + .1, at = (d, y, side) => across(ew, d, y, side), df = p.front - .03, gh = Math.min(p.hF, 2.1);
          quad(buf("void"), at(df, 0, -1), at(df, 0, 1), at(df, gh, 1), at(df, gh, -1)); }
        if (vomAt.has(s) && n >= 6){ // an exit tunnel: a pit in the tier with walls, a railing, and the dark tunnel mouth at its back
          const ew = S.design.exitWidth/2, [ja, jb] = vomRows(n), at = (d, y, side) => across(ew, d, y, side);
          const fl = p.hs[ja], dF = p.front + ja*T, dB = p.front + jb*T, topB = p.hs[Math.min(n-1, jb)];
          { const c = pt(s, dB - .05); post(buf("emerg"), c[0], c[1], topB - .5, topB - .2, .5); } // the green exit sign over the way out
          quad(buf("riser"), at(dF,fl,-1), at(dF,fl,1), at(dB,fl,1), at(dB,fl,-1));
          quad(buf("void"), at(dB,fl,-1), at(dB,fl,1), at(dB,topB,1), at(dB,topB,-1));
          for (const side of [-1, 1]){
            for (let j=ja;j<jb;j++){ const d0 = p.front + j*T; quad(buf("concrete"), at(d0,fl,side), at(d0+T,fl,side), at(d0+T,p.hs[j]+.45,side), at(d0,p.hs[j]+.45,side)); }
            bar(buf("steel"), at(dF, fl + 1, side), at(dB, p.hs[jb-1] + 1.4, side), .06); }
          bar(buf("steel"), at(dF, fl + 1, -1), at(dF, fl + 1, 1), .06);
        }
        // pillars under a stacked tier's front (always when the tier below is left open)
        if (p.stacked && (p.pillars || p.lowerGhost) && tc.hold !== "towers" && pillarAt.has(s)){
          const cd = p.front + 0.4, q = pt(s, cd), base = p.lowerGhost ? 0 : heightAt(profs[s].slice(0,k), cd);
          post(buf("column"), q[0], q[1], base, p.hF - 1.5, 0.45); if (!p.lowerGhost) cols.push({x:q[0], z:q[1], d:cd});
        }
        const bp = pt(s, p.front + n*T - T/2); farFrom(bp[0], bp[1], p.hs[n-1] + eye);
        standTop = Math.max(standTop, p.hs[n-1] + 1.2); standBack = Math.max(standBack, p.front + n*T);
      }
      if (CT) for (const b of CT){ // the tunnel and dugouts themselves
        const P = b.P, T2 = b.T, n = nRows(P), s0 = b.c - b.hw, s1 = b.c + b.hw, dF = P.front, Q = (s2, d, y) => { const q = ptS(s2, d); return [q[0], y, q[1]]; };
        const colour = b.kind === "tunnel" ? TN.colour || S.seat : DG.colour || "#1d2a3a";
        if (b.kind === "tunnel" || b.kind === "vehicle"){ const q = ptS(b.c, 0); boardGaps.push({x:q[0], z:q[1], hw:b.hw + .8}); } // the boards stop either side of it
        if (b.kind === "vehicle"){ // a tall opening for an ambulance or fire engine, with hazard-striped edges and a painted route out to the pitch
          const R = b.R, dB = dF + R*T2, top = Math.max(4.6, P.hs[Math.min(n - 1, R)]);
          quad(buf("road"), Q(s0,0,.03), Q(s1,0,.03), Q(s1,dB,.03), Q(s0,dB,.03));
          quad(buf("void"), Q(s0,dB,.03), Q(s1,dB,.03), Q(s1,dB,top), Q(s0,dB,top));
          for (const e2 of [s0, s1]){ for (let j=0;j<R;j++){ const d0 = dF + j*T2; quad(buf("concrete"), Q(e2,d0,0), Q(e2,d0+T2,0), Q(e2,d0+T2,Math.max(P.hs[j]+.45, 0)), Q(e2,d0,Math.max(P.hs[j]+.45, 0))); }
            for (let y=0;y<4.4;y+=.8) quad(buf("barrier"), Q(e2,dF-.02,y), Q(e2,dF+.25,y), Q(e2,dF+.25,y+.4), Q(e2,dF-.02,y+.4)); }
          const c = Q(b.c, dB - .05, 4.75); post(buf("emerg"), c[0], c[2], 4.6, 4.95, .7); continue; }
        if (b.kind === "access" && b.R){ // a level platform with a low rail in front and the blue sign at each end
          const r0 = b.r0, y = P.hs[Math.min(n - 1, r0)] + .02, d0 = dF + r0*T2, d1 = dF + b.R*T2, yb = P.hs[Math.min(n - 1, b.R)];
          quad(buf("concrete"), Q(s0,d0,y), Q(s1,d0,y), Q(s1,d1,y), Q(s0,d1,y));
          if (r0 > 0) quad(buf("riser"), Q(s0,d0,P.hs[r0-1]), Q(s1,d0,P.hs[r0-1]), Q(s1,d0,y), Q(s0,d0,y));
          if (b.R < n) quad(buf("riser"), Q(s0,d1,y), Q(s1,d1,y), Q(s1,d1,yb), Q(s0,d1,yb));
          for (const e2 of [s0, s1]) quad(buf("concrete"), Q(e2,d0,y), Q(e2,d1,y), Q(e2,d1,Math.max(y, yb) + .3), Q(e2,d0,y + .3));
          bar(buf("steel"), Q(s0,d0+.1,y+.85), Q(s1,d0+.1,y+.85), .05);
          for (const e2 of [s0 + .4, s1 - .4]){ const c = Q(e2, d0 + .1, y + 1.05); post(buf("access"), c[0], c[2], y + .95, y + 1.3, .35); }
          continue; }
        if (b.kind === "tunnel" || b.kind === "dugout"){ // a walled pit where the front rows were, with the dark way in at the back
          const R = b.R, dB = dF + R*T2, yF = .03, top = P.hs[Math.min(n - 1, R)];
          quad(buf("concrete"), Q(s0,dF,yF), Q(s1,dF,yF), Q(s1,dB,yF), Q(s0,dB,yF));
          quad(buf("void"), Q(s0,dB,yF), Q(s1,dB,yF), Q(s1,dB,top), Q(s0,dB,top));
          for (const e2 of [s0, s1]) for (let j=0;j<R;j++){ const d0 = dF + j*T2; quad(buf("concrete"), Q(e2,d0,yF), Q(e2,d0+T2,yF), Q(e2,d0+T2,P.hs[j]+.45), Q(e2,d0,P.hs[j]+.45)); }
          if (b.kind === "dugout"){ // a bench along the back for the staff and substitutes, and a low perspex screen at the front
            const db = dB - .55, seat = tint("seated", colour); quad(buf(seat), Q(s0+.2,db,.48), Q(s1-.2,db,.48), Q(s1-.2,db+.5,.48), Q(s0+.2,db+.5,.48));
            quad(buf(seat), Q(s0+.2,db+.5,.48), Q(s1-.2,db+.5,.48), Q(s1-.2,db+.5,1.1), Q(s0+.2,db+.5,1.1));
            quad(buf("glass"), Q(s0,dF,yF), Q(s1,dF,yF), Q(s1,dF,1.05), Q(s0,dF,1.05)); }
          else { // a green exit sign over the tunnel mouth, and the extending tunnel out towards the pitch
            const c = Q(b.c, dB - .05, top - .35); post(buf("emerg"), c[0], c[2], top - .55, top - .2, .5);
            if (TN.extend){ const reach = Math.min(8, dF - .6), d1 = dF - reach, w = b.hw + .15, key = tint("fascia", colour);
              if (reach > 1){ const r0 = b.c - w, r1 = b.c + w, h = 2.5, arc = [[0, h - .5], [.25, h - .15], [.5, h], [.75, h - .15], [1, h - .5]];
                for (const e2 of [r0, r1]) quad(buf(key), Q(e2,d1,0), Q(e2,dF,0), Q(e2,dF,h - .5), Q(e2,d1,h - .5));
                for (let q=0;q<arc.length-1;q++){ const [fa, ya] = arc[q], [fb, yb] = arc[q+1], sa = lerp(r0, r1, fa), sb = lerp(r0, r1, fb);
                  quad(buf(key), Q(sa,d1,ya), Q(sb,d1,yb), Q(sb,dF,yb), Q(sa,dF,ya)); }
                quad(buf("void"), Q(r0+.15,d1+.02,0), Q(r1-.15,d1+.02,0), Q(r1-.15,d1+.02,h - .6), Q(r0+.15,d1+.02,h - .6)); } } } }
        else if (b.kind === "bubble"){ // a perspex shelter on the apron, set back from the touchline
          const D = 2.3, dBk = dF - .4, dFr = dBk - D;
          if (dFr < 1){ if (!issues.some(x => x.key === "dugouts:fit")){ issue(`The dugouts don't fit between the touchline and the ${st.name.toLowerCase()} (they need about ${(D + 1.4).toFixed(1)} m).`, "dugouts:fit", "geo",
            {tab:st.key, fix:{label:"Sink them into the stand", run:() => { S.dugouts = Object.assign(dugoutsOf(), {style:"sunk"}); return true; }}}); } continue; }
          const seat = tint("seated", colour), H = 2.2;
          quad(buf("dark"), Q(s0,dBk,0), Q(s1,dBk,0), Q(s1,dBk,H), Q(s0,dBk,H));
          const arc = [[0, H], [.35, H - .15], [.7, H - .55], [1, 1.1]];
          for (let q=0;q<arc.length-1;q++){ const da = lerp(dBk, dFr, arc[q][0]), db = lerp(dBk, dFr, arc[q+1][0]);
            quad(buf("roofGlass"), Q(s0,da,arc[q][1]), Q(s1,da,arc[q][1]), Q(s1,db,arc[q+1][1]), Q(s0,db,arc[q+1][1])); }
          for (const e2 of [s0, s1]) quad(buf("glass"), Q(e2,dBk,0), Q(e2,dFr,0), Q(e2,dFr,1.1), Q(e2,dBk,H));
          quad(buf("dark"), Q(s0,dBk,.02), Q(s1,dBk,.02), Q(s1,dFr,.02), Q(s0,dFr,.02));
          quad(buf(seat), Q(s0+.2,dBk-.6,.48), Q(s1-.2,dBk-.6,.48), Q(s1-.2,dBk-.1,.48), Q(s0+.2,dBk-.1,.48));
          quad(buf(seat), Q(s0+.2,dBk-.12,.48), Q(s1-.2,dBk-.12,.48), Q(s1-.2,dBk-.12,1.15), Q(s0+.2,dBk-.12,1.15));
          if (S.sport === "football"){ // the technical area: dashed white lines a metre round the dugout, out to a metre from the touchline
            const line = (sa, da, sb, db) => { const A = Q(sa, da, .045), B = Q(sb, db, .045), L = Math.hypot(B[0]-A[0], B[2]-A[2]) || 1, nx2 = -(B[2]-A[2])/L*.06, nz2 = (B[0]-A[0])/L*.06;
              for (let t = 0; t < L; t += 1.2){ const u0 = t/L, u1 = Math.min(1, (t + .7)/L), p0 = [lerp(A[0],B[0],u0), lerp(A[2],B[2],u0)], p1 = [lerp(A[0],B[0],u1), lerp(A[2],B[2],u1)];
                quad(buf("white"), [p0[0]-nx2,.045,p0[1]-nz2], [p1[0]-nx2,.045,p1[1]-nz2], [p1[0]+nx2,.045,p1[1]+nz2], [p0[0]+nx2,.045,p0[1]+nz2]); } };
            line(s0 - 1, dFr, s0 - 1, 1); line(s1 + 1, dFr, s1 + 1, 1); line(s0 - 1, 1, s1 + 1, 1); } } }
      if (tc.hold === "towers" && !closed && best.stacked){ const live = []; for (let s=0;s<m;s++){ const p = pk(s); if (p && !p.ghost && nRows(p) >= 1) live.push(s); }
        if (live.length >= 2) towerReqs.push({k, live}); }
      if (st.sel && ref){ // one depth handle in the middle, or one per side when a bowl's sides have their own rows
        const spots = st.sideAt && S.bowl.varyRows ? sideMids : [[midI, null]];
        spots.forEach(([hi, side], si) => { const p = pk(hi); if (!p || p.ghost || nRows(p) < 1) return;
          const n = nRows(p), bk = p.front + n*T;
          handles.push({kind:"depth", x:pt(hi,bk)[0], y:p.hs[n-1] + 1.2, z:pt(hi,bk)[1], o:o[hi], v:v[hi], ref, front:p.front, T, side});
          if (p.stacked && si === 0) handles.push({kind:"over", x:pt(hi,p.front)[0], y:p.hF, z:pt(hi,p.front)[1], o:o[hi], v:v[hi], ref, lowerBack:p.lowerBack, lowerBackH:p.lowerBackH}); }); }
      let seats = 0; rowLen.forEach(l => { if (l) seats += capRow(l, tierType); });
      for (const r of recs){ r.seats = rowLen[r.j] ? capRow(rowLen[r.j], tierType) * r.len / rowLen[r.j] : 0; segRecs.push(r); }
      if (CT) for (const b of CT) if (b.kind === "access" && b.R){ // each space 0.9 m for the wheelchair, 0.7 m for a companion seat
        const sp = Math.floor(2*b.hw/1.6), P = b.P, y = P.hs[Math.min(nRows(P)-1, b.r0)], m0 = ptS(b.c - b.hw, P.front + (b.r0 + 1)*b.T), m1 = ptS(b.c + b.hw, P.front + (b.r0 + 1)*b.T);
        wheelchair += sp; seats += sp*2; segRecs.push({j:b.r0, len:2*b.hw, d:P.front + (b.r0 + 1)*b.T, x:(m0[0]+m1[0])/2, z:(m0[1]+m1[1])/2, m0, m1, h0:y, h1:y, type:"seated", seats:sp*2}); }
      byType[tierType] += seats; standSeats += seats; total += seats; kinds.add(TYPES[tierType].short);
      const tr0 = {name: cap1(tierName(kDrawn-1, realCount, above) || "single") + " tier", type:tierType, rows:nRows(best), seats:Math.round(seats), steep, c: isFinite(tierC) ? Math.round(tierC*1000) : null, evac:0, front:best.front, height:best.hB, bad};
      tierRecs.push(tr0);
      // how far the furthest fan walks along the rows and up or down the gangway to the way in
      const nT = nRows(best), rise = nT > 1 ? best.hs[nT-1] - best.hs[0] : 0, along = nT*T, maxWalk = L.maxTravel == null ? 30 : L.maxTravel;
      const walk = entry === "middle" ? Math.max(vomRows(nT)[0], nT - vomRows(nT)[1])/nT*Math.hypot(along, rise) + 8 : Math.hypot(along, rise) + 8;
      if (seats && tc.entry && tc.entry !== "auto" && walk > maxWalk) issue(`${name}: the furthest fans walk about ${Math.round(walk)} m to get in or out, more than the ${maxWalk} m guidance allows. Bring them in from the middle, or add entrances.`, `walk:${st.name}:${kk}`, "rules",
        Object.assign({fix:{label:"Bring them in from the middle", run:() => { if (ref){ ref.entry = "middle"; ref.entryAt = .45; } return true; }}}, where));
      if (seats){ const exits = Math.max(1, Math.round(frontLen / entryEvery)), mins = seats / (exits * S.design.exitWidth * L.flow);
        if (mins > L.maxEvac + 1e-9){ const key = `evac:${st.name}:${kk}`;
          const spacing = []; for (let x = S.design.exitEvery - 1; x >= 8; x--) spacing.push(x);
          const widths = []; for (let x = S.design.exitWidth + 0.2; x <= 5.001; x += 0.2) widths.push(+x.toFixed(1));
          issue(`${name}: takes ${mins.toFixed(1)} minutes to empty through ${exits} exit${exits>1?"s":""}. The limit is ${L.maxEvac} minutes.`, key, "rules",
            Object.assign({fix:{label:"Add more exits", run:() => searchFix(v2 => { S.design.exitEvery = v2; }, spacing, key) || searchFix(v2 => { S.design.exitWidth = v2; }, widths, key)}}, where)); }
        slowest = Math.max(slowest, mins); standEvac = Math.max(standEvac, mins); tr0.evac = mins;
        /* Emergency evacuation, judged separately: the time allowed depends on the stand's fire risk. A tier at the
           front can also go forward, down its gangways and out onto the play. */
        const risk = fireRiskOf(cfg), lim = L["evac" + cap1(risk)] != null ? L["evac" + cap1(risk)] : {low:8, medium:6, high:2.5}[risk];
        /* Emergency-only exits add to the normal ones: gates in the pitch-side wall (the front tier goes down its gangways and
           out onto the play) and, if asked for, extra doors along the back of every tier. */
        const gates = S.design.pitchGates !== false && !best.stacked, forward = gates ? (aisleAt.size || 1)*S.design.gangWidth : 0;
        const extra = S.design.emergEvery > 0 ? Math.max(1, Math.round(frontLen / S.design.emergEvery))*S.design.exitWidth : 0;
        const em = seats / ((exits*S.design.exitWidth + forward + extra) * L.flow);
        tr0.emerg = em; tr0.risk = risk; slowestEm = Math.max(slowestEm, em);
        if (em > lim + 1e-9 && mins <= L.maxEvac + 1e-9){ const key = `emerg:${st.name}:${kk}`;
          const spacing = []; for (let x = S.design.exitEvery - 1; x >= 8; x--) spacing.push(x);
          const fixes = [{label:"Add emergency exits at the back of the tiers", run:() => searchFix(v2 => { S.design.emergEvery = v2; }, [40, 32, 26, 20, 16, 12, 10, 8], key)},
            {label:"Add more exits", run:() => searchFix(v2 => { S.design.exitEvery = v2; }, spacing, key)}];
          if (!gates && !best.stacked) fixes.unshift({label:"Put emergency gates in the pitch-side wall", run:() => { S.design.pitchGates = true; return true; }});
          if (risk !== "low") fixes.push({label:"Build it from concrete and steel (low fire risk)", run:() => { cfg.fire = "low"; return true; }});
          issue(`${name}: in an emergency it takes ${em.toFixed(1)} minutes to get everyone out. With a ${risk} fire risk it should clear in ${lim} minute${lim === 1 ? "" : "s"}.`, key, "rules",
            Object.assign({fix:fixes[0], alts:fixes.slice(1)}, where)); } }
    }

    /* Where seats meet terracing in the same tier (a corner between a seated side and a terrace end), the two kinds can't
       share a row, so the join between them is a concrete stairway from the front of the tier to the back. */
    const along = (p, t) => { const n = nRows(p), x = t*(n - 1), j = Math.min(n - 2, Math.floor(x)); return [p.front + t*n*p.T, n < 2 ? p.hF : lerp(p.hs[j], p.hs[j+1], x - j)]; };
    for (let k=st.drawFrom;k<K;k++) for (let i=0;i<segs;i++){
      const j1 = nx(i), a = profs[i][k], b = profs[j1][k];
      if (!a || !b || a.ghost || b.ghost || nRows(a) < 2 || nRows(b) < 2 || a.type === b.type) continue;
      const N = Math.min(60, Math.max(nRows(a), nRows(b))), both = (key, A, B, C, D) => { quad(buf(key), A, B, C, D); quad(buf(key), A, D, C, B); };
      both("riser", V(i,a.front,0), V(j1,b.front,0), V(j1,b.front,b.hF), V(i,a.front,a.hF)); // its front, down to the ground
      for (let q=0;q<N;q++){ const [da0, ha0] = along(a, q/N), [da1, ha1] = along(a, (q+1)/N), [db0, hb0] = along(b, q/N), [db1, hb1] = along(b, (q+1)/N);
        both("aisle", V(i,da0,ha0), V(j1,db0,hb0), V(j1,db1,hb0), V(i,da1,ha0)); // tread
        both("riser", V(i,da1,ha0), V(j1,db1,hb0), V(j1,db1,hb1), V(i,da1,ha1)); }
    }

    // the deck over the vacated (or covered) front of the lower tier, at the second sport's level, and the wall behind it
    for (let i=0;i<segs;i++){ const j1 = nx(i), a = decks[i], b = decks[j1]; if (!a || !b) continue;
      quad(buf(CV.sp === "athletics" ? "track" : "aisle"), V(i,a.from,.06), V(j1,b.from,.06), V(j1,b.to,.06), V(i,a.to,.06));
      if (a.h > .3 || b.h > .3) quad(buf("concrete"), V(i,a.to,0), V(j1,b.to,0), V(j1,b.to,b.h), V(i,a.to,a.h)); }
    /* ---------- roof: shape, reach, height, tilt, curve, material and visible structure ---------- */

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
        if (rf.support === "truss" && !closed) latticeAlong(buf("steel"), i, j1, (k, off) => { const r = k === i ? a : b; return [V(k, r.inner + off, r.y(Math.max(0, off)/(r.outer - r.inner)))]; });
        roofQuads.push([pt(i,a.inner), pt(j1,b.inner), pt(j1,b.outer), pt(i,a.outer)]);
      }
      const ribAt = marks(12), colAt = marks(14), mastAt = marks(32);
      if (rf.support === "toptruss"){ // a deep lattice truss along the top of the roof, the full length of the stand
        const sb = buf("steel"), fT = .38, D = 5.5, live = []; for (let i=0;i<m;i++) if (RR[i]) live.push(i);
        const P3 = (i, up) => { const a = RR[i], q = pt(i, at(a, fT)); return [q[0], a.y(fT) + .3 + up, q[1]]; };
        for (let n=0;n<live.length;n++){ const i = live[n], j = live[n+1] != null ? live[n+1] : (closed ? live[0] : null); if (j == null || (!closed && j !== i + 1)) continue;
          bar(sb, P3(i, 0), P3(j, 0), .5); bar(sb, P3(i, D), P3(j, D), .5); bar(sb, n % 2 ? P3(i, 0) : P3(i, D), n % 2 ? P3(j, D) : P3(j, 0), .3); bar(sb, P3(i, 0), P3(i, D), .25); }
        if (!closed) for (const i of [live[0], live[live.length-1]]) if (i != null){ const tg = tangent(i), s2 = i === live[0] ? -1 : 1, q = P3(i, D), b0 = pt(i, at(RR[i], fT));
          post(sb, b0[0] + tg[0]*s2*2.5, b0[1] + tg[1]*s2*2.5, 0, q[1] + .5, 1.8); } // end posts carry it to the ground
        topAll = Math.max(topAll, ...live.map(i => P3(i, D)[1] + .5));
      }
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
    /* A deck held up by a tower at each end carrying a truss over the stand, as with Ibrox's Club Deck: no pillars in front of fans. */
    for (const tw of towerReqs){
      const at = s => profs[s][tw.k], mid = s => { const p = at(s); return p.front + nRows(p)*p.T*0.5; };
      let yT = Math.max(...tw.live.map(s => at(s).hs[nRows(at(s))-1])) + 5.5;
      if (RRout) for (const s of tw.live) if (RRout[s]) yT = Math.max(yT, RRout[s].y(0) + 1.5, RRout[s].y(1) + 1.5);
      const yB = yT - 4.5, a = tw.live[0], b = tw.live[tw.live.length-1], sb = buf("steel");
      const tower = (s, dir) => { const tg = tangent(s), q = pt(s, mid(s)); return [q[0] + tg[0]*dir*5, q[1] + tg[1]*dir*5]; };
      const ta = tower(a, -1), tb = tower(b, 1);
      for (const q of [ta, tb]){ post(buf("concrete"), q[0], q[1], 0, yT + 1.5, 3.4); grow(q[0], q[1]); }
      const line = [ta].concat(tw.live.map(s => pt(s, mid(s))), [tb]);
      for (let i=0;i<line.length-1;i++){ const p = line[i], q = line[i+1];
        bar(sb, [p[0],yT,p[1]], [q[0],yT,q[1]], .5); bar(sb, [p[0],yB,p[1]], [q[0],yB,q[1]], .5);
        bar(sb, i % 2 ? [p[0],yT,p[1]] : [p[0],yB,p[1]], i % 2 ? [q[0],yB,q[1]] : [q[0],yT,q[1]], .3); }
      const hang = marks(10); for (const s of tw.live) if (hang.has(s)){ const p = at(s), f = pt(s, p.front + .3), c = pt(s, mid(s)); bar(sb, [c[0],yB,c[1]], [f[0],p.hF,f[1]], .18); }
      topAll = Math.max(topAll, yT + 1.5);
    }
    // façade extras: stair towers, entrance gates and window mullions on the back wall
    const backAt = i => info[i] ? info[i].back + (roofOn ? 1.5 : 0) : null;
    if (fac.towers){ const ts = closed ? [...marks(60)] : [0, m-1].filter(endOpen);
      for (const i of ts){ const b = backAt(i); if (b == null) continue; const tg = tangent(i), side = closed ? 0 : (i ? 4 : -4), q = pt(i, b + 3.5);
        post(buf("tower"), q[0] + tg[0]*side, q[1] + tg[1]*side, 0, info[i].top, 6); grow(q[0], q[1]); } } // level with the back of the stand, so it doesn't poke up behind the fans
    /* Entrances: turnstile blocks standing out from the back wall, each with a row of turnstile doors, an exit gate,
       a canopy and a band in the accent colour; plain gates in between. */
    if (fac.gates){ const blocks = marks(36), band = fac.accent ? tint("trim", fac.accent) : "trim";
      for (const i of marks(12)){ const b = backAt(i); if (b == null) continue; const tg = tangent(i);
        const at = (d, w, y) => { const q = pt(i, b + d); return [q[0] + tg[0]*w, y, q[1] + tg[1]*w]; };
        const face = (key, d, w0, w1, y0, y1) => quad(buf(key), at(d,w0,y0), at(d,w1,y0), at(d,w1,y1), at(d,w0,y1));
        if (!blocks.has(i)){ face("gate", .08, -1.6, 1.6, 0, 3.4); continue; }
        const W = 5.5, D = 3.2, H = 3.6; // the block itself
        face(wallKey, D, -W, W, 0, H);
        for (const sd of [-1, 1]) quad(buf(wallKey), at(0,sd*W,0), at(D,sd*W,0), at(D,sd*W,H), at(0,sd*W,H));
        quad(buf("roofSolid"), at(0,-W,H), at(0,W,H), at(D,W,H), at(D,-W,H));
        face(band, D + .03, -W, W, H - .6, H - .1);
        for (const w of [-3.6, -1.8, 0, 1.8]) face("gate", D + .04, w - .55, w + .55, 0, 2.3);   // turnstiles
        face("gate", D + .04, 3.1, 4.9, 0, 2.8);                                                 // exit gate
        quad(buf("steel"), at(D,-W-.4,2.7), at(D,W+.4,2.7), at(D+1.4,W+.4,2.9), at(D+1.4,-W-.4,2.9));  // canopy
        const g = pt(i, b + D + 1.4); grow(g[0], g[1]); } }
    /* The outside wall, dressed in the stand's look: windows, pilasters, bands, fins or glass. It runs along the roof's back
       edge where there is a roof, otherwise along the back of the top tier. */
    const wallOpt = {windows:fac.windows, winSize:fac.winSize, concourse:fac.concourse, accent:fac.accent};
    if (look !== "plain" || fac.concourse) for (let i=0;i<segs;i++){
      const j1 = nx(i), x0 = info[i], x1 = info[j1]; if (!x0 || !x1) continue;
      const ra = RRout && RRout[i], rb = RRout && RRout[j1], roofed = roofOn && ra && rb;
      const d0 = roofed ? ra.outer : x0.back, d1 = roofed ? rb.outer : x1.back, y0 = roofed ? ra.y(1) : x0.top, y1 = roofed ? rb.y(1) : x1.top;
      const nv = [v[i][0] + v[j1][0], v[i][1] + v[j1][1]], nl = Math.hypot(nv[0], nv[1]) || 1;
      dressWall(buf, look, wallKey, pt(i, d0), pt(j1, d1), y0, y1, [nv[0]/nl, nv[1]/nl], wallOpt);
    }
    // the stadium's name (naming rights) goes along the main stand's roof front, unless that stand has lettering of its own
    const SP = sponsorsOf(), named = !fac.sign && SP.title && SP.onStand !== false && st.key === (lay === "bowl" ? "B" : lay === "ring" ? "R0" : "N");
    const HEn = homeEndOf(), homeNamed = !fac.sign && !named && HEn.name && HEn.at === st.key; // the home end's name, like the Kop's
    const signText = fac.sign || (named ? SP.title : homeNamed ? HEn.name : ""), signAt = named || homeNamed ? "roof" : fac.signAt;
    if (signText && !DRY){ // lettering on the outside wall, or along the roof front facing the play
      let si = midI;
      if (closed){ let bd = -2; for (let i=0;i<m;i++){ if (!info[i]) continue; const d = -v[i][1]/(Math.hypot(v[i][0], v[i][1]) || 1); if (d > bd){ bd = d; si = i; } } if (bd < 0.95) si = -1; }
      const x = si >= 0 ? info[si] : null, R2 = x && RRout ? RRout[si] : null;
      if (x){
        const mat = signMaterial(String(signText).slice(0, 30), (named ? SP.titleColour : homeNamed ? S.seat : fac.signColour) || "#ffffff"), onRoof = signAt === "roof" && roofOn && R2;
        mat.emissiveIntensity = S.night ? .9 : .35; // a little light keeps it legible in shadow
        const vl = Math.hypot(v[si][0], v[si][1]) || 1, nOut = [v[si][0]/vl, v[si][1]/vl], tg = tangent(si);
        const top = onRoof ? R2.y(0) : roofOn && R2 ? R2.y(1) : x.top;
        // big raised letters, as clubs mount their names: about a sixth of the wall's height, never wider than most of the stand
        let h = onRoof ? Math.max(1.4, Math.min(5, top*0.11)) : Math.max(2, Math.min(7, top*0.17)); if (h*mat.aspect > lenTotal*0.7) h = lenTotal*0.7/mat.aspect;
        const w = h*mat.aspect, mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        if (onRoof){ const p = pt(si, R2.inner - .3), yc = R2.y(0) - .3 - h/2, hw = w/2 + 1.5, q = pt(si, R2.inner - .1);
          quad(buf("roofEdge"), [q[0]-tg[0]*hw, yc - h/2 - .4, q[1]-tg[1]*hw], [q[0]+tg[0]*hw, yc - h/2 - .4, q[1]+tg[1]*hw], [q[0]+tg[0]*hw, R2.y(0), q[1]+tg[1]*hw], [q[0]-tg[0]*hw, R2.y(0), q[1]-tg[1]*hw]);
          mesh.position.set(p[0], yc, p[1]); mesh.lookAt(p[0] - nOut[0], yc, p[1] - nOut[1]); }
        else { const p = pt(si, (roofOn && R2 ? R2.outer : x.back) + (look === "fins" ? 1.9 : look === "concrete" ? 1.3 : look === "glass" ? .9 : .7)), yc = look === "sheet" && top > 10 ? top - 4.1 - h*.55 : top - h*1.05; // under the club stripe on metal cladding
          mesh.position.set(p[0], yc, p[1]); mesh.lookAt(p[0] + nOut[0], yc, p[1] + nOut[1]);
          for (let l=1;l<=6;l++){ const e = new THREE.Mesh(mesh.geometry, mat.edge), d = l*0.06; // stacked behind the face, so the letters stand off the wall
            e.position.set(p[0] - nOut[0]*d, yc, p[1] - nOut[1]*d); e.quaternion.copy(mesh.quaternion); e.userData.stadium = true; group.add(e); } }
        mesh.userData.stadium = true; group.add(mesh);
      }
    }
    if (st.sel && st.key in S.stands && lay === "stands" && info[midI]){ const q = pt(midI, info[midI].front);
      handles.push({kind:"dist", x:q[0], y:0.6, z:q[1], o:o[midI], v:v[midI], cfg}); }
    for (const r of segRecs){ r.stand = st.key; allRecs.push(r); }
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

  /* ---------- courtside seats on the floor ---------- */
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
    return {style:(sa.tiers.length ? sa : sb).style, roof: cc.roof && src ? Object.assign({}, src.roof, {shape: src.roof.shape === "closed" ? "slope" : src.roof.shape, support: src.roof.support === "truss" || src.roof.support === "toptruss" ? "none" : src.roof.support}) : R("none"),
      facade:Object.assign({}, (sa.tiers.length ? sa : sb).facade, {towers:false, gates:false, sign:""})}; }; // corners wear their stand's walls
  /* Upper tiers on their own outline, like La Cartuja or the Monumental: the lower tier keeps hugging the play while every
     tier above it is bent, slice by slice, onto an oval or a circle. "ring" puts the front of the upper tiers on the outline;
     "fill" grows the top tier back to it, so the outer wall and roof trace the shape. */
  const OUT = Object.assign({shape:"follow", fit:"ring", size:0}, S.outer || {});
  const nLow = lay === "bowl" ? 1 : S.bowl.tiers.length;
  let shapeT = tiers => tiers;
  const lastBack = pr => { let b = null; for (const p of pr) if (p.rows > 0.5) b = p.back; return b; };
  if (OUT.shape !== "follow" && lay !== "stands"){
    const ring0 = ringGeo(), lows = ring0.o.map((_, i) => lastBack(profile(bowlTiersAt(ring0.tag[i], nc).slice(0, nLow), set)) || set), lowB = Math.max(...lows);
    let A, B;
    if (OUT.fit === "fill"){ // the smallest outline that takes in the back of every stand as built
      const backOf = list => lastBack(profile(list, set)) || lowB;
      const full = s2 => lay === "bowl" ? bowlSideTiers(s2) : bowlSideTiers(s2).concat(S.stands[s2].tiers);
      const bk = {}; for (const s2 of SIDES) bk[s2] = backOf(full(s2));
      const sideOf = v2 => Math.abs(v2[0]) > Math.abs(v2[1]) ? (v2[0] > 0 ? "E" : "W") : (v2[1] > 0 ? "S" : "N");
      const pts = ring0.o.map((o2, i) => { const d = bk[sideOf(ring0.v[i])]; return [o2[0] + d*ring0.v[i][0], o2[1] + d*ring0.v[i][1]]; });
      const a0 = F.W/2 + Math.max(bk.E, bk.W), b0 = F.H/2 + Math.max(bk.N, bk.S);
      if (OUT.shape === "circle") A = B = Math.max(...pts.map(q => Math.hypot(q[0], q[1])));
      else { const k = Math.max(1, ...pts.map(q => Math.hypot(q[0]/a0, q[1]/b0))); A = a0*k; B = b0*k; }
    } else { // the smallest outline that clears the back of the lower tier all the way round
      const pts = ring0.o.map((o2, i) => [o2[0] + lows[i]*ring0.v[i][0], o2[1] + lows[i]*ring0.v[i][1]]);
      if (OUT.shape === "circle") A = B = Math.max(...pts.map(q => Math.hypot(q[0], q[1])));
      else { const a0 = F.W/2 + lowB, b0 = F.H/2 + lowB, k = Math.max(1, ...pts.map(q => Math.hypot(q[0]/a0, q[1]/b0))); A = a0*k; B = b0*k; }
    }
    A += OUT.size || 0; B += OUT.size || 0;
    const hit = (o2, v2) => ellipseHit(o2, v2, A, B); // distance along a slice to the outline
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
  const total4 = 4*(nc+1), runs = lay === "stands" ? null : bowlRuns(nc);
  /* The bowl as one closed ring, or one open strip per unbroken stretch when parts of it are left out. */
  const bowlGeos = ring => runs ? runs.map(r => subGeo(ring, r.lo, r.hi, total4)) : [ring];
  const sideAt = geo => i => { const pc = bowlPiece(geo.tag[i], nc); return pc.corner ? null : pc.key; };
  const levelBySide = geo => S.bowl.varyRows ? i => bowlPiece(geo.tag[i], nc) : null; // only matters when the bowl's sides differ
  if (lay === "bowl"){
    const ring0 = ringGeo();
    for (const geo of bowlGeos(ring0)){
      const st = buildSliced({name:"Bowl", key:"B", geo, cfg:S.bowl, set, tiersFor:i => shapeT(bowlTiersAt(geo.tag[i], nc), geo.o[i], geo.v[i]), tierRef:k => S.bowl.tiers[k], drawFrom:0, sel: tab === "B", sideAt:sideAt(geo), levelPiece:levelBySide(geo)});
      if (st && st.closedAt) closedAt = st.closedAt;
    }
    if (runs && S.bowl.roof.shape === "closed" && !groundRoof) issue("A roof closed over the floor needs the whole bowl, so with parts left out it's built open. One roof over the whole ground can still close over it.", "bowl:closed", "geo",
      {tab:"B", fix:{label:"Use one roof over the whole ground", run:() => { S.groundRoof = Object.assign({}, GROUND_ROOF, S.groundRoof, {on:true, cover:"closed", opening:0}); return true; }}});
  } else if (lay === "ring"){
    /* A ring of separate stands: each takes its share of the way round, with a gap either side of it. */
    const ring = ringGeo(), n = ring.o.length, RG = ringOf(), list = RG.stands, gap = Math.max(0, RG.gap || 0);
    const at = i => [ring.o[i][0] + set*ring.v[i][0], ring.o[i][1] + set*ring.v[i][1]], cum = [0];
    for (let i=1;i<=n;i++){ const a = at(i-1), b = at(i % n); cum.push(cum[i-1] + Math.hypot(b[0]-a[0], b[1]-a[1])); }
    const Lt = cum[n], tagAt = sArc => { const x = ((sArc % Lt) + Lt) % Lt; let i = 0; while (i < n - 1 && cum[i+1] <= x) i++;
      const f = (x - cum[i])/Math.max(1e-9, cum[i+1] - cum[i]), t0 = ring.tag[i], t1 = i + 1 < n ? ring.tag[i+1] : total4; return t0 + (t1 - t0)*f; };
    // the turn is measured from the middle of the main stand side, so 0 puts the first stand there
    const mainMid = (() => { const minZ = Math.min(...ring.o.map((_, i) => at(i)[1])); let bi = 0, bx = Infinity;
      for (let i=0;i<n;i++){ const p = at(i); if (p[1] <= minZ + 0.5 && Math.abs(p[0]) < bx){ bx = Math.abs(p[0]); bi = i; } } return cum[bi]; })();
    const shares = list.map(r => Math.max(0.05, r.share || 1)), total = shares.reduce((a, b) => a + b, 0) || 1;
    let s0 = mainMid + ((RG.turn || 0)/360)*Lt - shares[0]/total*Lt/2;
    list.forEach((cfg, i) => {
      const len = shares[i]/total*Lt, a = s0 + gap/2, b = s0 + len - gap/2; s0 += len;
      if (!cfg.tiers.length || b - a < 2) return;
      const geo = subGeo(ring, tagAt(a), tagAt(b), total4);
      buildSliced({name:cfg.name || `Stand ${i+1}`, key:"R" + i, cfg, set: standSet(cfg), tiersFor:() => cfg.tiers, tierRef:k => cfg.tiers[k], drawFrom:0, sel: tab === "R" + i, geo});
    });
  } else if (lay === "stands"){
    /* Each stand is one building: it can wrap round into the corner at its start, run straight along its side (past the
       pitch if it likes), and wrap round into the corner at its end. Corners are what's left between stands. */
    const plans = {}; for (const c of CORNERS) plans[c.key] = cornerPlan(c);
    const fanOf = (c, f0, f1) => { const uA = SIDE_DIR[c.a], uB = SIDE_DIR[c.b];
      return fanGeo([(uA[0]||uB[0])*(F.W/2+set), (uA[1]||uB[1])*(F.H/2+set)], uA, uB, shape, set, f0, f1); };
    const CK = k => CORNERS.find(c => c.key === k);
    for (const s of SIDES){
      const cfg = S.stands[s]; if (!cfg.tiers.length) continue;
      const [k0, k1] = SIDE_ENDS[s], P0 = plans[k0], P1 = plans[k1], base = (s === "N" || s === "S") ? F.W/2 + set : F.H/2 + set;
      const straight = densify(linearize(d => sidePath(F, s, d, Math.max(2, base + P0.rb), Math.max(2, base + P1.ra)), false), 4, standSet(cfg) + 6);
      const O = [], Vs = [];
      if (P0.wb > 0.005){ const g = fanOf(CK(k0), 1 - P0.wb, 1); O.push(...g.o.slice(0, -1)); Vs.push(...g.v.slice(0, -1)); } // this stand is the second at its start corner
      O.push(...straight.o); Vs.push(...straight.v);
      if (P1.wa > 0.005){ const g = fanOf(CK(k1), 0, P1.wa); O.push(...g.o.slice(1)); Vs.push(...g.v.slice(1)); }            // and the first at its end corner
      buildSliced({name:SIDE_NAMES[s], key:s, cfg, set: standSet(cfg), tiersFor:() => cfg.tiers, tierRef:k => cfg.tiers[k], drawFrom:0, sel: tab === s,
        geo:{o:O, v:Vs, closed:false, tag:O.map((_, i) => i)}, joined:[P0.meet, P1.meet]});
    }
    for (const c of CORNERS){
      const P = plans[c.key]; if (!P.stand) continue;
      const sa = S.stands[c.a], sb = S.stands[c.b], geo = fanOf(c, P.gap[0], P.gap[1]), sA = standSet(sa), sB = standSet(sb);
      buildSliced({name:c.name, key:"C", ck:c.key, geo, cfg:cornerCfg(sa, sb, S.corners[c.key]), setFor:i => lerp(sA, sB, geo.frac[i]), set,
        tiersFor:() => S.cornerCustom, tierRef:k => S.cornerCustom[k], drawFrom:0, sel: tab === "C", styleLabel:false});
    }
  } else {
    const ring = ringGeo(), rc = S.bowl.tiers.length, lowCfg = Object.assign({}, S.bowl, {roof:R("none")});
    for (const geo of bowlGeos(ring))
      buildSliced({name:"Lower bowl", key:"B", geo, cfg:lowCfg, set, tiersFor:i => bowlTiersAt(geo.tag[i], nc), tierRef:k => S.bowl.tiers[k], drawFrom:0, sel: tab === "B", sideAt:sideAt(geo), levelPiece:levelBySide(geo)});
    /* The stands on top of the bowl follow its shape, each wrapping as far round into its corners as it says. */
    const plans = {}; for (const c of CORNERS) plans[c.key] = cornerPlan(c);
    for (const s of SIDES){
      const cfg = S.stands[s]; if (!cfg.tiers.length && cfg.roof.shape === "none") continue;
      const [gb, ga] = SIDE_GROUPS[s], P0 = plans[GROUP_KEY[gb]], P1 = plans[GROUP_KEY[ga]];
      const lo = gb*(nc+1) + nc*(1 - P0.wb), hi = ga*(nc+1) + nc*P1.wa;
      const geo = subGeo(ring, lo, hi, total4);
      buildSliced({name:SIDE_NAMES[s], key:s, geo, cfg, set, tiersFor:i => shapeT(bowlTiersAt(geo.tag[i], nc).concat(cfg.tiers), geo.o[i], geo.v[i]), tierRef:k => cfg.tiers[k], drawFrom:rc, sel: tab === s, levelPiece:levelBySide(geo), joined:[P0.meet, P1.meet]});
    }
    for (const c of CORNERS){
      const P = plans[c.key]; if (!P.stand || shape === "square") continue;
      const sa = S.stands[c.a], sb = S.stands[c.b], geo = subGeo(ring, c.g*(nc+1) + nc*P.gap[0], c.g*(nc+1) + nc*P.gap[1], total4);
      buildSliced({name:c.name, key:"C", ck:c.key, geo, cfg:cornerCfg(sa, sb, S.corners[c.key]), set, tiersFor:i => shapeT(bowlTiersAt(geo.tag[i], nc).concat(S.cornerCustom), geo.o[i], geo.v[i]),
        tierRef:k => S.cornerCustom[k], drawFrom:rc, sel: tab === "C", styleLabel:false});
    }
  }
  /* ---------- one roof over the whole ground ----------
     Designed on its own rather than stand by stand: a ring between an inner and an outer outline, level all the way round,
     spanning whatever lies underneath, gaps and open corners included. Its outer edge clears the back of every stand. */
  if (groundRoof){
    const gr = Object.assign({}, GROUND_ROOF, S.groundRoof);
    const ring = ringGeo(), n = ring.o.length, P = (i, d) => [ring.o[i][0] + d*ring.v[i][0], ring.o[i][1] + d*ring.v[i][1]];
    const hx = F.W/2 + set, hz = F.H/2 + set, backs = [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]];
    for (const g of anchors) for (let i=0;i<g.m;i++){ const x = g.info[i]; if (x) backs.push([g.o[i][0] + x.back*g.v[i][0], g.o[i][1] + x.back*g.v[i][1]]); }
    const hull = hull2(backs), back = Math.max(0, gr.back || 0), reach = gr.reach || 0;
    // how far into the play the inner edge may come before the ring's own slices cross over each other
    const inMin = shape === "square" ? -0.45*Math.min(F.W, F.H) : -0.9*Math.min(radius, F.W/2, F.H/2);
    let dIn, dOut;
    if (gr.shape === "follow"){
      dOut = ring.o.map((o2, i) => exitDist(hull, o2, ring.v[i], 0) + back);
      dIn = ring.o.map(() => set - reach);
    } else { // the smallest oval or circle round every stand, and a ring of even depth inside it
      const a0 = hx, b0 = hz; let A, B;
      if (gr.shape === "circle") A = B = Math.max(...hull.map(q => Math.hypot(q[0], q[1]))) + back;
      else { const k = Math.max(1, ...hull.map(q => Math.hypot(q[0]/a0, q[1]/b0))); A = a0*k + back; B = b0*k + back; }
      const depth = Math.min(A, B) - (Math.min(F.W, F.H)/2 + set - reach); // so the inner edge is `reach` past the front row halfway along the long sides
      dOut = ring.o.map((o2, i) => ellipseHit(o2, ring.v[i], A, B));
      dIn = ring.o.map((o2, i) => ellipseHit(o2, ring.v[i], Math.max(1, A - depth), Math.max(1, B - depth)));
    }
    for (let i=0;i<n;i++){
      dIn[i] = Math.max(inMin, dIn[i] == null ? inMin : dIn[i]);
      if (dOut[i] == null) dOut[i] = exitDist(hull, ring.o[i], ring.v[i], 0) + back;
      if (S.plot.clip && (!poly || inPoly(ring.o[i], poly))){ const room = roomAt(ring.o[i], ring.v[i], 0); if (isFinite(room)) dOut[i] = Math.min(dOut[i], room - 0.3); }
      dOut[i] = Math.max(dOut[i], dIn[i] + 2);
    }
    if (poly && !S.plot.clip && ring.o.some((_, i) => !inPoly(P(i, dOut[i]), poly))) issue("The roof over the ground runs past the plot boundary.", "site:roof", "geo",
      {fix:{label:"Cut it back to fit the plot", run:() => { S.plot.clip = true; return true; }}});
    const base = Math.max(outerTop, 4) + Math.max(1.5, gr.lift), tilt = Math.tan((gr.tilt || 0)*Math.PI/180);
    const yIn = base + tilt*Math.max(...dOut.map((d, i) => d - dIn[i])), curve = gr.curve || 0;
    const yAt = (span, f) => lerp(yIn, base, f) + curve*span*0.2*Math.sin(Math.PI*f);
    const Y = i => f => yAt(dOut[i] - dIn[i], f), at = (i, f) => lerp(dIn[i], dOut[i], f), V3 = (i, d, y) => { const p = P(i, d); return [p[0], y, p[1]]; };
    const rm = buf(ROOF_MAT_KEY[gr.mat] || "roof"), nS = curve > 0.01 ? 6 : 1, edgeH = gr.support === "none" ? 2.4 : 1.2;
    const wallKey = {translucent:"glassClad", glass:"glassClad", concrete:"concrete", green:"roofGreen"}[gr.mat] || "roofSolid";
    let top = Math.max(yIn, base);
    for (let i=0;i<n;i++){ const j = (i+1)%n, a = Y(i), b = Y(j);
      for (let s=0;s<nS;s++){ const f0 = s/nS, f1 = (s+1)/nS; quad(rm, V3(i,at(i,f0),a(f0)), V3(j,at(j,f0),b(f0)), V3(j,at(j,f1),b(f1)), V3(i,at(i,f1),a(f1))); }
      quad(buf("roofEdge"), V3(i,dIn[i],a(0)-edgeH), V3(j,dIn[j],b(0)-edgeH), V3(j,dIn[j],b(0)), V3(i,dIn[i],a(0)));
      const low = gr.wall ? [0, 0] : [a(1) - .8, b(1) - .8];
      quad(buf(gr.wall ? wallKey : "roofEdge"), V3(i,dOut[i],low[0]), V3(j,dOut[j],low[1]), V3(j,dOut[j],b(1)), V3(i,dOut[i],a(1)));
      if (gr.support === "truss") latticeAlong(buf("steel"), i, j, (k, off) => { const ys = k === i ? a : b, sp = dOut[k] - dIn[k]; return [V3(k, dIn[k] + off, ys(Math.max(0, off)/sp))]; });
      roofQuads.push([P(i,dIn[i]), P(j,dIn[j]), P(j,dOut[j]), P(i,dOut[i])]);
    }
    const cum = [0]; for (let i=1;i<n;i++){ const p = P(i-1,dOut[i-1]), q = P(i,dOut[i]); cum.push(cum[i-1] + Math.hypot(q[0]-p[0], q[1]-p[1])); }
    const every = step => { const out = new Set(); let next = step/2; for (let i=0;i<n;i++) if (cum[i] >= next){ out.add(i); next += step; } return out; };
    const ribAt = every(12), colAt = every(16), mastAt = every(36);
    for (let i=0;i<n;i++){ const a = Y(i);
      top = Math.max(top, a(0), a(1), a(.5) + (gr.support === "ribs" ? 4 : gr.support === "truss" ? 3.2 : .5));
      if (gr.support === "ribs" && ribAt.has(i)) for (let s=0;s<nS;s++){ const f0 = s/nS, f1 = (s+1)/nS;
        quad(buf("steel"), V3(i,at(i,f0),a(f0)), V3(i,at(i,f1),a(f1)), V3(i,at(i,f1),a(f1) + .4 + 3.6*f1), V3(i,at(i,f0),a(f0) + .4 + 3.6*f0)); }
      if (gr.support === "columns" && colAt.has(i)){ const d = dOut[i] - .5, q = P(i, d); post(buf("column"), q[0], q[1], 0, a((d - dIn[i])/(dOut[i] - dIn[i])), .6); }
      if (gr.support === "masts" && mastAt.has(i)){ const q = P(i, dOut[i] + 4), mt = a(1) + 22, p0 = P((i-1+n)%n, dOut[i]), p1 = P((i+1)%n, dOut[i]);
        const tl = Math.hypot(p1[0]-p0[0], p1[1]-p0[1]) || 1, tg = [(p1[0]-p0[0])/tl, (p1[1]-p0[1])/tl];
        post(buf("steel"), q[0], q[1], 0, mt, .9);
        for (const [p2, y2] of [[P(i, dIn[i] + 1), a(0)], [P(i, at(i, .45)), a(.45)]]) quad(buf("cable"), [q[0]-tg[0]*.08, mt, q[1]-tg[1]*.08], [q[0]+tg[0]*.08, mt, q[1]+tg[1]*.08], [p2[0]+tg[0]*.08, y2, p2[1]+tg[1]*.08], [p2[0]-tg[0]*.08, y2, p2[1]-tg[1]*.08]);
        top = Math.max(top, mt); grow(q[0], q[1]); }
      const g = P(i, dOut[i]); grow(g[0], g[1]);
    }
    if (gr.cover === "closed"){ // closed over the floor, optionally with an opening in the middle
      const cy = yIn + 9, op = Math.max(0, Math.min(0.9, gr.opening || 0)), b = buf("roofClosed");
      for (let i=0;i<n;i++){ const j = (i+1)%n, pa = P(i,dIn[i]), pc = P(j,dIn[j]);
        if (op < 0.02) tri(b, [0,cy,0], [pa[0],yIn,pa[1]], [pc[0],yIn,pc[1]]);
        else quad(b, [pa[0],yIn,pa[1]], [pc[0],yIn,pc[1]], [pc[0]*op, lerp(yIn,cy,1-op), pc[1]*op], [pa[0]*op, lerp(yIn,cy,1-op), pa[1]*op]); }
      top = Math.max(top, cy); if (op < 0.02) roofQuads.push("all"); closedAt = yIn;
    }
    maxH = Math.max(maxH, top); outerTop = Math.max(outerTop, base);
    // let each stand know where the roof is above it, for screens and roof-edge floodlights
    const inner = ring.o.map((_, i) => P(i, dIn[i])), outer = ring.o.map((_, i) => P(i, dOut[i]));
    const lastHit = (pl, o2, v2) => { let best = null;
      for (let k=0;k<pl.length;k++){ const A2 = pl[k], B2 = pl[(k+1)%pl.length], E = [B2[0]-A2[0], B2[1]-A2[1]], den = cross(v2, E); if (Math.abs(den) < 1e-12) continue;
        const w = [A2[0]-o2[0], A2[1]-o2[1]], d = cross(w, E)/den, s = cross(w, v2)/den; if (s >= -1e-9 && s <= 1+1e-9 && (best == null || d > best)) best = d; }
      return best; };
    for (const g of anchors) g.RR = g.info.map((x, i) => { if (!x) return null;
      const a = lastHit(inner, g.o[i], g.v[i]), b = lastHit(outer, g.o[i], g.v[i]); if (a == null || b == null || b < a + 0.5) return null;
      return {inner:a, outer:b, y:f => yAt(b - a, f), yIn, yOut:base}; });
  }
  { const seen = new Set(), uniq = issues.filter(x => !seen.has(x.key) && seen.add(x.key)); issues.length = 0; issues.push(...uniq); } // a bowl in several pieces raises each of its checks once
  let covered = 0;
  if (roofQuads.includes("all")) covered = allRecs.reduce((a,r) => a + r.seats, 0);
  else for (const r of allRecs){ if (roofQuads.some(q => q !== "all" && inPoly([r.x, r.z], q))) covered += r.seats; }
  const farName = F.flag ? "far corner" : (F.home ? "home plate" : "centre");
  if (far > L.maxView){
    const fr = farRef && farRef.ref, ck = farRef && farRef.ck, rowsDown = []; if (fr) for (let x = Math.round(rowsOf(fr)) - 1; x >= 2; x--) rowsDown.push(x);
    const fixes = [];
    if (fr) fixes.push({label:"Trim its back rows", run:() => searchFix(v2 => setRows(fr, v2), rowsDown, "far")});
    if (ck) fixes.push({label:"Leave that corner open", run:() => { S.corners[ck].mode = "open"; return !dryIssues().some(i => i.key === "far"); }});
    /* Taking one stand back can leave another as the furthest, so keep trimming whichever seats are now furthest until it clears. */
    const fixFar = () => { const snap = JSON.stringify(S);
      for (let n=0;n<30;n++){ const r = dryRun(); if (!r.issues.some(i => i.key === "far")) return true; const f2 = r.farRef; if (!f2) break;
        if (f2.ref){ const now = Math.round(rowsOf(f2.ref)); if (now <= 2) break; setRows(f2.ref, Math.max(2, now - Math.max(1, Math.round(now*0.12)))); }
        else if (f2.ck) S.corners[f2.ck].mode = "open";
        else break; }
      if (!dryIssues().some(i => i.key === "far")) return true; S = JSON.parse(snap); return false; };
    const farFixes = (fixes.length ? fixes : [{label:"Trim the furthest seats", run:() => false}]).map(f => Object.assign({}, f, {run:() => { const snap = JSON.stringify(S); if (f.run() || fixFar()) return true; S = JSON.parse(snap); return false; }}));
    issue(`The furthest fan${farRef ? " (back of the " + farRef.name.toLowerCase() + ")" : ""} is ${Math.round(far)} m from the ${farName}. The limit is ${L.maxView} m.`, "far", "view",
      {fix: farFixes[0], alts: farFixes.slice(1)});
  }
  const sext = [Math.max(-bounds[0], bounds[1]), Math.max(-bounds[2], bounds[3])];
  { const AC = accessOf(), need = wheelchairNeed(total); // enough wheelchair spaces for a ground this size
    if (AC.on && total > 500 && wheelchair < need) issue(`Wheelchair spaces: ${wheelchair}, but guidance asks for about ${need} at a ground holding ${fmt(total)}.`, "access:spaces", "rules",
      {fix:{label:"Add more wheelchair platforms", run:() => { const at0 = accessOf().at, sizes = [[2,9],[3,9],[4,9],[4,12],[6,12],[6,15],[8,12],[6,18],[8,15],[6,24],[10,15],[8,20],[8,24],[12,18],[12,24]];
        return searchFix(([per, length, at]) => { S.access = Object.assign(accessOf(), {per, length, at}); }, sizes.map(x => x.concat(at0)).concat(at0 === "spread" ? [] : sizes.map(x => x.concat("spread"))), "access:spaces"); }}}); }
  const awayAlloc = allocateAway(allRecs);
  { const A = awayOf(), HE = homeEndOf();
    if (A.on && !awayAlloc.seats && total) issue("The away end is set on a stand with no seats.", "away:none", "geo", {fix:{label:"Put the away fans in the west end", run:() => { S.away = Object.assign(awayOf(), {at:"W"}); return true; }}});
    if (A.on && HE.at && HE.at === A.at) issue("The away fans are in the home end. Move one of them.", "away:home", "geo"); }
  const result = {issues, total, wheelchair, awayAlloc, maxH, bounds, covered, minC, slowest, slowestEm, far, farRef, restricted, byType, roofNeedMax};
  const screenPlans = planScreens(F, anchors, closedAt, outerTop, set, issue);
  if (DRY) return result;

  // pitchside advertising boards
  /* Any rectangular playing area gets them (football, rugby, wrestleball, tennis, a plain floor), about 3 m out from the
     play, or closer on a tight ground. With seats on the floor they go just inside the front row. */
  const FP = pitchOf(F), boardsFit = S.sport === "football" || S.sport === "rugby" || (F.custom && !(FP.r > 0) && ["wrestleball","tennis","plain"].includes(S.custom.kind));
  const bOff = floorRows ? 0.6 : F.pitch ? Math.min(3, set - 1.2 + Math.min(F.W - FP.W, F.H - FP.H)/2) : Math.min(3, set - 1.2);
  if (S.boards && !CV && boardsFit && bOff >= 0.6){
    const off = bOff, hx = FP.W/2 + off, hz = FP.H/2 + off + (S.sport === "football" ? 1 : 0);
    const Pb = [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]], Po = [[-hx-.04,-hz-.04],[hx+.04,-hz-.04],[hx+.04,hz+.04],[-hx-.04,hz+.04]];
    // each side runs corner to corner, with a gap where the players' tunnel comes out
    const runs = (P) => P.flatMap((a, i) => { const b = P[(i+1)%4], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz), cut = [];
      for (const g of boardGaps){ const t = ((g.x - a[0])*dx + (g.z - a[1])*dz)/(L*L), off = Math.abs((g.x - a[0])*dz - (g.z - a[1])*dx)/L;
        if (t > 0 && t < 1 && off < 6) cut.push([t - g.hw/L, t + g.hw/L]); }
      cut.sort((u, w) => u[0] - w[0]); const out = []; let t0 = 0;
      for (const [u, w] of cut){ if (u > t0) out.push([t0, u]); t0 = Math.max(t0, w); } if (t0 < 1) out.push([t0, 1]);
      return out.map(([u, w]) => [[a[0] + dx*u, a[1] + dz*u], [a[0] + dx*w, a[1] + dz*w]]); });
    for (const [a, b] of runs(Po)) quad(buf("dark"), [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], .9, b[1]], [a[0], .9, a[1]]); // plain backs; the adverts face the play and the TV cameras across it
    adStrip(runs(Pb).map(([a, b]) => ({a:[a[0], 0.02, a[1]], b:[b[0], 0.02, b[1]], h:0.86, view:[0, 0]})));
  }
  addProps(group, CV ? CV.F2 : pitchOf(F), buf, CV ? CV.sp : undefined);
  for (const key in Bf) if (Bf[key].length){
    const mesh = meshFrom(Bf[key], M[key], !["roof","roofGlass","glass","roofClosed","aisle","void","glassClad"].includes(key));
    if (TYPES[key.split("_")[0]] || key === "floorSeat") mesh.userData.seat = true;
    mesh.userData.stadium = true;
    group.add(mesh);
  }
  if (window.__gwCheck){ let bad = 0, verts = 0; for (const k in Bf){ const arr = Bf[k]; verts += arr.length/3; for (let i=0;i<arr.length;i++) if (!isFinite(arr[i])) bad++; } result.nan = bad; result.verts = verts; result.nanKeys = Object.keys(Bf).filter(k => Bf[k].some(x => !isFinite(x))); }
  // set up for a second sport, the floor shows its markings, big enough to reach the stands either way
  const {tex, Wt, Ht} = CV ? floorTexture(CV.F2, Math.max(1, (F.W + 2*set - CV.F2.W)/2, (F.H + 2*set - CV.F2.H)/2), CV.sp) : floorTexture(F, set);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(Wt, Ht), new THREE.MeshStandardMaterial({map:tex, roughness:1}));
  floor.rotation.x = -Math.PI/2; floor.position.y = 0.02; floor.receiveShadow = true; group.add(floor);
  if (S.crowd !== false) addCrowd(allRecs, F); else CROWD = null;
  if (S.players) addPlayers(CV ? CV.F2 : pitchOf(F), CV ? CV.sp : S.sport);
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
  drawSite(site, buf2, ext);
  const archTop = addArchitecture(F, A, outline, outerTop, poly, standInfo, set, sext, buf2, ext);
  result.maxH = Math.max(result.maxH, archTop);
  if (window.__gwCheck){ let bad = 0; for (const k in B2) for (const v of B2[k]) if (!isFinite(v)) bad++; group.traverse(o => { const a = o.geometry && o.geometry.attributes && o.geometry.attributes.position; if (a && a.array) for (const v of a.array) if (!isFinite(v)) bad++; }); result.archNan = bad; }
  const fm = floodMode();
  drawScreens(screenPlans, buf2, anchors);
  if (fm === "roof") roofLights(anchors, buf2, F);
  if (fm === "masts" || fm === "pylons"){
    const mh = Math.max(maxH + 16, 30);
    for (const sx of [-1,1]) for (const sz of [-1,1]){
      // round grounds keep their masts close in, a third of the way round from each end, rather than out at a square's corners
      const roundish = F.r >= Math.min(F.W, F.H)/2 - 1, a = Math.PI/6;
      const x = roundish ? sx*(sext[0] + 8)*Math.cos(a) : sx*(sext[0] + 8), z = roundish ? sz*(sext[1] + 8)*Math.sin(a) : sz*(sext[1] + 8);
      if (fm === "pylons") pylon(buf2, x, z, mh);
      else { const mm = new THREE.Mesh(new THREE.CylinderGeometry(.6,1.1,mh,10), M.mast); mm.position.set(x,mh/2,z); mm.castShadow = true; group.add(mm); }
      group.add(lampHead(x, mh + 3, z));
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
  LAST = Object.assign(result, {closedAt, focusIn, F, farName, ext, sext, parts, set, steepInfo, poly, lay, standInfo, handles, screenSpots,
    screenCtx:{F, anchors, closedAt, outerTop, set}}); // lets a new screen try its mountings without rebuilding the stadium
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
