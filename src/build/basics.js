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
/* How far round a rounded corner of the bowl (as a share of the corner) a stand on top must carry on for its front, d
   out from the play, to reach the end of the pitch: the corner's curve starts r short of the pitch's end, so without
   this the stands above stop short of the corner flags. */
const cornerReach = (r, d, shape) => shape === "square" || !(r > 0) ? 0 : Math.asin(Math.min(1, r/(r + Math.max(0, d))))/(Math.PI/2);
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
/* A stand's tier can have a different number of rows at its right-hand end (seen from the play) from its left, getting
   deeper or shallower steadily along the stand; and it can curve down towards both ends, like the upper
   tiers at the Emirates or Benfica: deepest in the middle, easing away to fewer rows (none at all, at 100%) at each end. u: how far along the stand
   this slice is, 0 to 1 (null on a closed ring). */
const rowsAlong = (tiers, from, u) => u == null || !tiers.some((tr,k) => k >= from && ((tr.rowsEnd != null && tr.rowsEnd !== tr.rows) || tr.taper > 0)) ? tiers
  : tiers.map((tr,k) => { if (k < from || !((tr.rowsEnd != null && tr.rowsEnd !== tr.rows) || tr.taper > 0)) return tr;
      const f = Math.min(1, Math.max(0, u)), e = (1 - Math.cos(Math.PI*Math.abs(2*f - 1)))/2, r = lerp(tr.rows, tr.rowsEnd == null ? tr.rows : tr.rowsEnd, f)*(1 - (tr.taper || 0)*e);
      return r < .5 ? Object.assign({}, tr, {rows: 1, ghost: true}) : Object.assign({}, tr, {rows: Math.max(1, r)}); }); // (where it runs out, laid out but not built, so anything above stays up)
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
/* The same for a rectangle with softly rounded corners, half-sizes A by B (a squarish superellipse), for a roof like San
   Siro's: how far along v from o (inside it) to its edge. */
function rectHit(o, v, A, B){
  const f = t => Math.abs((o[0] + v[0]*t)/A)**8 + Math.abs((o[1] + v[1]*t)/B)**8; if (f(0) >= 1) return null;
  let lo = 0, hi = 2*Math.max(A, B) + Math.hypot(o[0], o[1]); for (let k=0;k<40;k++){ const m = (lo + hi)/2; if (f(m) < 1) lo = m; else hi = m; }
  return lo;
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
/* The big truss along the top of a roof can arch up over the stand, like Stadium Australia's: it runs along the roof's
   front edge, lifting it into a curve that's highest at the middle of the stand, with its legs carrying on down past
   each end to land on the ground outside the ground. */
const trussEndsOf = rf => rf.trussEnds || (rf.trussArch ? "arch" : "posts"); // designs saved before the choice had just the arch switch
const trussRise = (rf, closed, u, len) => trussEndsOf(rf) === "arch" && !closed ? len*.14*Math.sin(Math.PI*Math.min(1, Math.max(0, u/len))) : 0;
/* Which way a truss carries on out past the end of a stand: from further along the roof towards its end. (Where a
   stand's end fans round a corner, its last few slices meet at one spot on the roof, which gave no direction, or the
   wrong one, and dropped that end's legs straight down onto the stand.) rp(k) is slice k's roof under the truss. */
const trussOut = (rp, live, end, tg) => { const a = rp(end), first = end === live[0];
  for (let n = first ? 1 : live.length - 2; n >= 0 && n < live.length; n += first ? 1 : -1){ const b = rp(live[n]), x = a[0] - b[0], z = a[1] - b[1], l = Math.hypot(x, z); if (l > 2) return [x/l, z/l]; }
  return tg; };
/* Or it can run on dead straight past each end of the stand, over the corners and out beyond the back of the ground,
   to stand on a pair of upright legs there. Each stand notes its truss's ends as it's built; they're drawn once the
   whole ground is up, so the legs land clear of every stand and corner, not just this one. */
/* An arched truss runs dead straight in plan from one end of the stand to the other, as at Stadium Australia, even
   where the stand curves round the play: A and B are its ends, c0 and c1 how far along the stand they are. at(c, off) is
   its point c along the stand, off to one side; out(first) the way on out past either end. */
function trussChord(A, B, c0, c1){
  const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1, t = [dx/l, dz/l], nm = [-t[1], t[0]];
  return {at:(c, off) => { const u = Math.min(1, Math.max(0, (c - c0)/((c1 - c0) || 1))); return [A[0] + dx*u + nm[0]*off, A[1] + dz*u + nm[1]*off]; }, out: first => first ? [-t[0], -t[1]] : t};
}
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
/* Stadium Australia's roof: a criss-cross of white steel over the sheets, from front to back, every 12 m along. RR holds
   each slice's roof (its inner and outer edge, and its height y(f) a share f of the way back). */
function roofDiagrid(sb, V, RR, cum){
  const live = []; for (let i=0;i<RR.length;i++) if (RR[i]) live.push(i);
  const at = (i, f) => V(i, lerp(RR[i].inner, RR[i].outer, f), RR[i].y(f) + .35), pick = []; let next = cum[live[0]];
  for (const i of live) if (cum[i] >= next){ pick.push(i); next = cum[i] + 12; }
  for (let k=0;k+1<pick.length;k++){ const i = pick[k], j = pick[k+1]; if (j - i !== live.indexOf(j) - live.indexOf(i)) continue; // not across a gap in the roof
    bar(sb, at(i, 0), at(j, 1), .45); bar(sb, at(i, 1), at(j, 0), .45); bar(sb, at(i, .5), at(j, .5), .3); }
}
/* A stand on top of the bowl, squared off: where its slices fan round into a corner, they're replaced by slices that carry
   straight on in the stand's own direction, out to about as far as the fan reached, so its ends are square to it. Each new
   slice stands on the bowl's seats as they are at the end of the straight part. front: how far out the stand's front row is;
   where the stand round the corner reaches into the same corner, it carries on no further than that past the corner, so its
   front corner stops on the corner's diagonal and it never runs into that stand, squared off or not. */
function squareEnds(geo, front, side){ // side: which side of the ground it's on, so it's squared to that, however little straight it has
  const {o, v, tag} = geo, n = o.length; if (n < 3) return geo;
  const unit = q => { const l = Math.hypot(q[0], q[1]) || 1; return [q[0]/l, q[1]/l]; }, vm = {N:[0,-1], S:[0,1], E:[1,0], W:[-1,0]}[side] || unit(v[Math.floor(n/2)]), tg = [-vm[1], vm[0]];
  const dot = i => { const u = unit(v[i]); return u[0]*vm[0] + u[1]*vm[1]; }, straight = i => dot(i) > .999;
  let m = 0; for (let i=1;i<n;i++) if (dot(i) > dot(m) + 1e-9 || (Math.abs(dot(i) - dot(m)) < 1e-9 && Math.abs(i - n/2) < Math.abs(m - n/2))) m = i; // the slice that faces most nearly straight out (the middle one, if several do)
  let a = m, b = m; while (a > 0 && straight(a - 1)) a--; while (b < n - 1 && straight(b + 1)) b++;
  const along = (i, k, D = 20) => { const p = [o[i][0] + v[i][0]*D, o[i][1] + v[i][1]*D], q = [o[k][0] + v[k][0]*D, o[k][1] + v[k][1]*D]; return (p[0] - q[0])*tg[0] + (p[1] - q[1])*tg[1]; }; // how far along the stand, 20 m back (or D m back)
  const step = n > 1 ? Math.max(1, Math.abs(along(m + 1 < n ? m + 1 : m - 1, m))) : 3, O = [], V = [], T = [];
  const run = (k, sgn, far) => { const out = []; for (let d = step; d <= far + 1e-6; d += step) out.push([o[k][0] + tg[0]*d*sgn, o[k][1] + tg[1]*d*sgn]); return out; };
  const farA = a > 0 ? Math.max(...Array.from({length:a}, (_, i) => -along(i, a))) : 0, farB = b < n - 1 ? Math.max(...Array.from({length:n - 1 - b}, (_, i) => along(b + 1 + i, b))) : 0;
  const sA = Math.sign(along(m, a)) || 1, lim = Math.max(0, front || 0); // (no further than the front row is from the pitch)
  /* ...unless the corner is all its own: the stand round the corner has no wrap into it, isn't squared off itself and there's
     no corner stand. Then it carries straight on as far as its wrap reaches at its back row, so it is as wide as it would be
     fanned round, like a main stand running the full width of the ground. */
  const own = c => { if (!c) return false; const P = cornerPlan(c), nb = S.stands[c.a === side ? c.b : c.a], nw = c.a === side ? P.wb : P.wa; return !P.stand && !nw && !(nb && nb.tiers.length && nb.squareEnds); };
  const deep = Math.max(20, profile(S.stands[side] ? S.stands[side].tiers : [], lim).reduce((d, p) => p.rows > 0.5 ? Math.max(d, p.back - lim) : d, 0)); // how deep the stand is, front row to back
  const endA = own(CORNERS.find(c => c.b === side)) && a > 0 ? Math.max(...Array.from({length:a}, (_, i) => -along(i, a, deep))) : Math.min(farA, lim);
  const endB = own(CORNERS.find(c => c.a === side)) && b < n - 1 ? Math.max(...Array.from({length:n - 1 - b}, (_, i) => along(b + 1 + i, b, deep))) : Math.min(farB, lim);
  for (const p of run(a, -sA, endA).reverse()){ O.push(p); V.push(vm); T.push(tag[a]); }
  for (let i=a;i<=b;i++){ O.push(o[i]); V.push(straight(i) ? v[i] : vm); T.push(tag[i]); }
  for (const p of run(b, sA, endB)){ O.push(p); V.push(vm); T.push(tag[b]); }
  return {o:O, v:V, closed:false, tag:T, frac:O.map((_, i) => i/Math.max(1, O.length - 1))};
}
/* Roofs of stands that wrap round and meet in a corner meet flush: each such run of joined stands (on the sides, each with
   a roof of its own and the corner between them closed by the meeting) takes the height the tallest of them needs.
   joinedRoofGroups(): those runs, as lists of sides, or null if there are none; joinedRoofTops(need): each side's shared height. */
var ROOF_NEED = {};
/* A quick draft: while a slider or a handle is being dragged, each rebuild leaves the crowd out (about a quarter of the
   work), and the full stadium is built the moment the finger lifts. Capacity and the checks are the same either way. */
let DRAFT = false;
function joinedRoofGroups(){
  const lay = layoutOf(); if ((lay !== "stands" && lay !== "hybrid") || (S.groundRoof && S.groundRoof.on)) return null;
  const roofed = s => S.stands[s] && S.stands[s].tiers.length && S.stands[s].roof && S.stands[s].roof.shape !== "none" && S.stands[s].roof.level !== false;
  const up = {}, find = s => up[s] === s ? s : (up[s] = find(up[s])); for (const s of SIDES) up[s] = s; let any = false;
  for (const c of CORNERS) if (roofed(c.a) && roofed(c.b) && cornerPlan(c).meet){ up[find(c.a)] = find(c.b); any = true; }
  if (!any) return null; const g = {}; for (const s of SIDES) if (roofed(s)) (g[find(s)] = g[find(s)] || []).push(s);
  return Object.values(g).filter(x => x.length > 1);
}
function joinedRoofTops(need){
  const out = {}, groups = joinedRoofGroups() || [];
  for (const g of groups){ const top = Math.max(...g.map(s => need[s] || 0)); for (const s of g) out[s] = top; }
  return out;
}
