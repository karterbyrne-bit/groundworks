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
  if (!M[k]){ M[k] = M[base].clone(); M[k].color.set(hex); if (base === "seatBack") M[k].color.multiplyScalar(0.8); if (M[k].userData.weather) weather(M[k], M[k].userData.weather); }
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
    : {key:CORNER_AFTER[g], corner:false, f: loc - nc}; // f: how far along the side, corner to corner
}
const sideRowsOf = (tr, s) => S.bowl.varyRows && tr.sideRows && tr.sideRows[s] != null ? Math.max(0, tr.sideRows[s]) : tr.rows;
const sideTypeOf = (tr, s) => S.bowl.varyRows && tr.sideType && TYPES[tr.sideType[s]] ? tr.sideType[s] : tr.type;
const withRows = (tiers, f) => tiers.map((tr,k) => Object.assign({}, tr, {rows:f(tr,k)}));
const onSide = (tr, s) => Object.assign({}, tr, {type:sideTypeOf(tr, s), rows:sideRowsOf(tr, s)}); // a bowl tier as built on one side
/* The bowl's tiers at one point round the ring: that side's seating and rows, a blend in a corner, or nothing where it's
   left out. A corner between two kinds of seating blends the depth and keeps the roomier kind (seats over terracing) all the way round. */
function bowlTiersAt(tag, nc){
  const T = bowlTiersFlat(tag, nc); if (!T.some(t => t.taper)) return T;
  /* A tier can slope down towards the corners, like the Emirates' upper tier: deepest at the middle of each side, then
     falling away smoothly so the corners have the fewest rows. */
  const pc = bowlPiece(tag, nc), d = pc.corner ? 1 : Math.abs(2*pc.f - 1);
  const k = (1 - Math.cos(Math.PI*d))/2; // eases in at the middle and out into the corner, so there's no kink at either
  return T.map(t => t.taper ? Object.assign({}, t, {rows: t.rows*(1 - t.taper*k)}) : t);
}
function bowlTiersFlat(tag, nc){
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
/* Stands on a lower bowl: how many of the bowl's seats lie on each side (N, S, E, W), so each side's stand can count the
   bowl in front of it in the results. The corners split along the line from the bowl's front corner to its back corner,
   which is where the stands above meet, whatever the shape of the play (a long, thin pitch included). */
function bowlSeatsBySide(recs, F, set){
  const out = {N:0, S:0, E:0, W:0}, mine = recs.filter(r => r.stand === "B" && r.seats > 0);
  const fx = F.W/2 + set, fz = F.H/2 + set; let bx = fx, bz = fz;
  for (const r of mine){ bx = Math.max(bx, Math.abs(r.x)); bz = Math.max(bz, Math.abs(r.z)); }
  const dx = bx - fx, dz = bz - fz;
  for (const r of mine){ const end = dx*(Math.abs(r.z) - fz) - dz*(Math.abs(r.x) - fx) < 0;
    out[end ? (r.x > 0 ? "E" : "W") : (r.z < 0 ? "N" : "S")] += r.seats; }
  return out;
}
/* The big truss along the top of a roof can arch up over the stand, like Stadium Australia's: rising to its highest at
   the middle of the stand, with its legs carrying on down past each end to land on the ground outside the ground. */
const trussEndsOf = rf => rf.trussEnds || (rf.trussArch ? "arch" : "posts"); // designs saved before the choice had just the arch switch
const trussRise = (rf, closed, u, len) => trussEndsOf(rf) === "arch" && !closed ? len*.14*Math.sin(Math.PI*Math.min(1, Math.max(0, u/len))) : 0;
/* Or it can run on dead straight past each end of the stand, over the corners and out beyond the back of the ground,
   to stand on a pair of upright legs there. Each stand notes its truss's ends as it's built; they're drawn once the
   whole ground is up, so the legs land clear of every stand and corner, not just this one. */
const TRUSS_RUNS = [];
function drawTrussRuns(outline, buf, bounds, outerTop){
  const runs = TRUSS_RUNS.splice(0); if (!runs.length) return; const hull = hull2(outline), sb = buf("steel"), A = S.arch || {};
  const skin = A.skin && A.skin !== "none", H = Math.max(8, outerTop), clear = skin ? (A.skinShape === "round" ? 5 : 1.5) + H*.06 + 2 : 4; // past the outer skin, if there is one
  const grow = g => { bounds[0] = Math.min(bounds[0], g[0]); bounds[1] = Math.max(bounds[1], g[0]); bounds[2] = Math.min(bounds[2], g[2]); bounds[3] = Math.max(bounds[3], g[2]); };
  for (const {b0, dir, P, arch} of runs){ const out = Math.max(0, exitDist(hull, b0, dir, 0)) + clear, at = (p, t) => [p[0] + dir[0]*t, p[1], p[2] + dir[1]*t];
    const straight = run => { const n = Math.max(1, Math.round(run/6));
      for (let k=0;k<n;k++){ const t0 = run*k/n, t1 = run*(k+1)/n;
        for (const c of P) bar(sb, at(c, t0), at(c, t1), .5); // the four chords
        for (const s of [0, 2]){ bar(sb, at(P[s + k%2], t0), at(P[s + 1 - k%2], t1), .3); bar(sb, at(P[s], t1), at(P[s + 1], t1), .25); } // diagonals and verticals down each face
        bar(sb, at(P[0], t1), at(P[2], t1), .22); bar(sb, at(P[1], t1), at(P[3], t1), .22); } }; // and across
    if (arch){ // the arch's legs: on down from the truss to the ground, far enough out to pass over the skin rather than through it
      const h = arch[0][1], r = Math.min(120, Math.max(arch.run, skin && h > H + 2 ? out*h/(h - H - 1) : out));
      if (skin && h*(1 - out/r) < H + .5){ // too little room above the skin: carry the truss straight on past it first, then down
        straight(out); const g = [b0[0] + dir[0]*(out + h*.6), 0, b0[1] + dir[1]*(out + h*.6)]; for (const p of arch) bar(sb, at(p, out), g, 1.1); grow(g); continue; }
      const g = [b0[0] + dir[0]*r, 0, b0[1] + dir[1]*r]; for (const p of arch) bar(sb, p, g, 1.1); grow(g); continue; }
    const run = Math.min(80, Math.max(4, out)); straight(run);
    for (const s of [0, 2]){ const g = at(P[s], run); post(sb, g[0], g[2], 0, P[s + 1][1] + .3, 1.6); grow(g); } // the upright legs
  }
}
/* How much of a stand's length its roof covers: all of it by default, or from one point along it to another (as a
   share of the length, from its left-hand end looking at it from the pitch), so a roof can cover just the middle, or stop short. */
const roofCovers = (rf, u, len, closed) => closed || ((rf.coverFrom || 0) <= u/len + .001 && u/len <= (rf.coverTo == null ? 1 : rf.coverTo) + .001);
/* Where a stand's roof pillars stand, as a distance out from the front of the stand: at the front of the seats (the old
   way, right in the view), partway back, along the back row, or outside behind the stand, holding the roof up from
   beyond it so no seat looks past one. */
function roofPillarAt(rf, x, a){ const w = rf.colAt || "front";
  return w === "outside" ? a.outer + 3 : w === "back" ? Math.max(x.front + .6, x.back - .4) : w === "mid" ? lerp(x.front, x.back, .5) : Math.max(a.inner + .6, x.front + .6); }
