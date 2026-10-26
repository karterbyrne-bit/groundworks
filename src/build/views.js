/* ================= obstructed views =================
   Which seats can't see the whole game, what's in the way, and how badly. Seats are checked a block at a time (a few rows
   by a few metres of a stand, seen from its middle), against points spread over the whole playing area: both goalmouths,
   the four corner flags, the centre, the touchlines, and a ball 15 m up over each touchline. Each sightline is checked in
   3D against what can get in the way: pillars (anyone's), the underside of the tier above and the roof front over the
   fans' heads, floodlight and signature masts, screens, the arch's feet, the dugouts and the tunnel's canopy, and the
   advertising boards. (Seeing over the heads in front, and over the tier's own front wall, is the sightline check's job.)
   A block is slightly restricted when it loses a noticeable part of the pitch (a corner flag, say) and badly restricted when it loses a big slice of it or a goalmouth.
   It adds nothing to the seat count and takes nothing away. */
const VIEW_CAUSES = {pillar:"behind pillars", overhang:"under the overhang", roof:"under the roof front", mast:"behind a mast", screen:"behind a screen",
  arch:"behind the arch's feet", dugout:"behind the dugouts or tunnel", boards:"behind the advertising boards"};
function viewTargets(F){
  const P = pitchOf(F), W = P.W/2, H = P.H/2, round = P.r > 0 && P.r >= Math.min(W, H) - 1, k = round ? .7 : 1, t = [];
  const add = (x, y, z, w, goal, high) => t.push({x, y, z, w, goal: !!goal, high: !!high});
  add(0, .3, 0, 1); for (const s of [-1, 1]){ add(s*W*k, .6, 0, 3, true); add(0, .3, s*H*k, 1); add(0, 15, s*H*k, 1, false, true); for (const u of [-1, 1]){ add(s*W*k, .3, u*H*k, 1); add(s*W*.5, .3, u*H*k, 1); } }
  return t;
}
/* obstacles: posts {x, z, r, y0, y1, cause} and walls {a:[x,z], b:[x,z], y0, y1, cause}; boards {hx, hz, h} or null.
   Fills in r.obs (0 clear, 1 slightly, 2 badly), r.obsCause and r.blocker on each row of seats, and returns the totals. */
function obstructedViews(recs, F, posts, walls, boards){
  const targets = viewTargets(F), wTot = targets.reduce((a, t) => a + t.w, 0), out = {seats:0, slight:0, bad:0, stands:{}, blocks:[]};
  const groups = new Map(); // a block: the same stand and tier, a few slices along and a few rows deep
  for (const r of recs){ r.obs = 0; r.obsCause = null; if (r.floor || !(r.seats > 0) || !r.an) continue;
    const key = r.an.name + "|" + r.k + "|" + Math.floor(r.i/3) + "|" + Math.floor(r.j/3); let g = groups.get(key); if (!g) groups.set(key, g = []); g.push(r); }
  const cross2 = (ax, az, bx, bz) => ax*bz - az*bx;
  for (const g of groups.values()){
    const r = g[Math.floor(g.length/2)], an = r.an, i = r.i, prof = an.profs[i] || []; if (!prof[r.k]) continue;
    const standing = r.type === "terrace" || r.type === "rail" || r.home, eye = [r.x, (r.h0 + r.h1)/2 + (standing ? 1.6 : 1.15), r.z];
    const o = an.o[i], v = an.v[i], vv = v[0]*v[0] + v[1]*v[1] || 1, q = (x, z) => ((x - o[0])*v[0] + (z - o[1])*v[1])/vv, qe = q(eye[0], eye[2]);
    const above = prof.filter((p, k) => k > r.k && p && p.stacked && !p.ghost && nRows(p) >= 1 && p.front < qe && p.hF - 1.5 > eye[1]), R = an.RR && an.RR[i];
    const lost = {}; let wLost = 0, goal = 0, blocker = null;
    for (const t of targets){
      const qt = q(t.x, t.z), at = qx => { const f = (qe - qx)/(qe - qt || 1e-6); return eye[1] + (t.y - eye[1])*f; }; // height of the sightline over the line qx of this stand
      let why = null, what = null;
      for (const p of above){ if (qt < p.front && at(p.front) > p.hF - 1.5){ why = "overhang"; what = {edge: an, i, q: p.front, y: p.hF - 1.5}; break; } }
      if (!why && R && !t.high && qt < R.inner && R.inner < qe && R.y(0) - .2 > eye[1] && at(R.inner) > R.y(0) - .2){ why = "roof"; what = {edge: an, i, q: R.inner, y: R.y(0) - .2}; }
      const dx = t.x - eye[0], dz = t.z - eye[2], L2 = dx*dx + dz*dz || 1;
      if (!why && boards){ // the boards round the pitch: where the sightline crosses their line, is it above them?
        for (const [ax, hx, along] of [[0, boards.hx, 2], [2, boards.hz, 0]]){ const e = eye[ax], tt = ax ? t.z : t.x;
          if (Math.abs(e) > hx && Math.abs(tt) < hx){ const f = (Math.sign(e)*hx - e)/(tt - e), y = eye[1] + (t.y - eye[1])*f, c = ax ? eye[0] + dx*f : eye[2] + dz*f;
            if (Math.abs(c) <= (ax ? boards.hx : boards.hz) && y < boards.h + .05){ why = "boards"; what = {a:[ax ? c - 3 : Math.sign(e)*hx, boards.h, ax ? Math.sign(e)*hx : c - 3], b:[ax ? c + 3 : Math.sign(e)*hx, boards.h, ax ? Math.sign(e)*hx : c + 3]}; } } } }
      if (!why) for (const p of posts){ // pillars, masts, the arch's feet: the closest the sightline passes, and its height there
        const f = Math.max(0, Math.min(1, ((p.x - eye[0])*dx + (p.z - eye[2])*dz)/L2)); if (f <= 0 || f >= 1) continue;
        if (Math.hypot(eye[0] + dx*f - p.x, eye[2] + dz*f - p.z) > p.r) continue; const y = eye[1] + (t.y - eye[1])*f;
        if (y >= p.y0 && y <= p.y1){ why = p.cause; what = {post: p}; break; } }
      if (!why) for (const w of walls){ // dugouts, the tunnel's canopy, screens
        const ex = w.b[0] - w.a[0], ez = w.b[1] - w.a[1], den = cross2(dx, dz, ex, ez); if (Math.abs(den) < 1e-9) continue;
        const wx = w.a[0] - eye[0], wz = w.a[1] - eye[2], f = cross2(wx, wz, ex, ez)/den, s = cross2(wx, wz, dx, dz)/den;
        if (f <= 0 || f >= 1 || s < 0 || s > 1) continue; const y = eye[1] + (t.y - eye[1])*f;
        if (y >= w.y0 && y <= w.y1){ why = w.cause; what = {a:[w.a[0], (w.y0 + w.y1)/2, w.a[1]], b:[w.b[0], (w.y0 + w.y1)/2, w.b[1]], wall: w}; break; } }
      if (why){ wLost += t.w; lost[why] = (lost[why] || 0) + t.w; if (t.goal) goal++; if (!blocker) blocker = what; }
    }
    const frac = wLost/wTot, sev = frac >= .25 || goal >= 1 && frac >= .15 ? 2 : frac >= .05 ? 1 : 0; if (!sev) continue;
    const cause = Object.keys(lost).sort((a, b) => lost[b] - lost[a])[0], seats = g.reduce((a, x) => a + x.seats, 0);
    for (const x of g){ x.obs = sev; x.obsCause = cause; }
    const st = out.stands[an.name] = out.stands[an.name] || {key: r.stand, seats: 0, slight: 0, bad: 0, causes: {}, spots: {}};
    st.seats += seats; st[sev === 2 ? "bad" : "slight"] += seats; st.causes[cause] = (st.causes[cause] || 0) + seats;
    const sp = st.spots[cause] = st.spots[cause] || [0, 0, 0, 0]; sp[0] += r.x*seats; sp[1] += (r.h0 + 1)*seats; sp[2] += r.z*seats; sp[3] += seats;
    out.seats += seats; out[sev === 2 ? "bad" : "slight"] += seats;
    out.blocks.push({x: eye[0], y: eye[1], z: eye[2], sev, cause, blocker});
  }
  for (const st of Object.values(out.stands)) for (const k in st.spots){ const s = st.spots[k]; st.spots[k] = [s[0]/s[3], s[1]/s[3], s[2]/s[3]]; }
  out.seats = Math.round(out.seats); out.slight = Math.round(out.slight); out.bad = Math.round(out.bad);
  return out;
}
/* "Show obstructed views": an amber or red panel over each restricted row, above the fans' heads. */
function drawObstructed(recs, bf){
  for (const r of recs){ if (!r.obs) continue; const dx = r.m1[0] - r.m0[0], dz = r.m1[1] - r.m0[1], l = Math.hypot(dx, dz) || 1, nx = -dz/l*.42, nz = dx/l*.42, y0 = r.h0 + 1.9, y1 = r.h1 + 1.9;
    quad(bf(r.obs === 2 ? "obsBad" : "obsSlight"), [r.m0[0] - nx, y0, r.m0[1] - nz], [r.m1[0] - nx, y1, r.m1[1] - nz], [r.m1[0] + nx, y1, r.m1[1] + nz], [r.m0[0] + nx, y0, r.m0[1] + nz]); }
}
/* A one-tap fix for a stand losing too many views, where there is one for what's mostly in the way. */
function viewFix(key, cause){
  const cfg = key === "B" ? S.bowl : key === "C" ? null : /^R\d+$/.test(key) ? (S.ring && S.ring.stands[+key.slice(1)]) : S.stands[key];
  if (cause === "pillar" && cfg){
    if (cfg.roof && cfg.roof.support === "columns") return {label:"Cantilever the roof", run:() => { cfg.roof.support = "none"; return true; }};
    if (cfg.tiers.some(t => t.pillars)) return {label:"Take the pillars out from under the tier above", run:() => { cfg.tiers.forEach(t => { t.pillars = false; }); return true; }}; }
  if (cause === "overhang" && cfg && cfg.tiers.some((t, k) => k && (t.over || 0) > 0)) return {label:"Cut the overhang back", run:() => { cfg.tiers.forEach((t, k) => { if (k) t.over = Math.min(t.over || 0, 0); }); return true; }};
  if (cause === "roof" && cfg && cfg.roof) return {label:"Raise the roof", run:() => { cfg.roof.lift = (cfg.roof.lift || 0) + 3; return true; }};
  if (cause === "mast" && (S.floodlights === "masts" || S.floodlights === "pylons" || (!S.floodlights && S.lights))) return {label:"Move the floodlights onto the roof", run:() => { S.floodlights = "roof"; return true; }};
  if (cause === "boards") return {label:"Lower the boards", run:() => { S.boardSet = Object.assign(boardSetOf(), {height: .7}); return true; }};
  return null;
}
