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
  /* Stands keep a metre clear of roads, water and buildings, except a road a stand is built over (like Villa Park's
     Trinity Road): that one runs under the stand through an opening at least 5 m high. */
  const overRoad = f => f.kind === "road" && f.over, CLEAR = 5;
  const obstacles = site.filter(f => !overRoad(f)).map(f => ({f, poly:featurePoly(f, 1)})), overRoads = site.filter(overRoad).map(f => featurePoly(f, .5));
  const roadCut = {}; // seats each stand gives up to keep the opening clear
  const roomAt = (o2, v2, d0) => { let dm = poly ? exitDist(poly, o2, v2, d0) : Infinity; for (const ob of obstacles) dm = Math.min(dm, enterDist(ob.poly, o2, v2, d0)); return dm; };
  SHEETS = {};
  if (!DRY){
    scene.remove(group);
    const shared = new Set(Object.values(M)); // free what this build made, but keep the shared materials and cached textures
    group.traverse(o => { if (o.geometry && !o.geometry.keep) o.geometry.dispose(); for (const m of [].concat(o.material || [])){ if (m.map && m.map.dispose && !m.map.keep) m.map.dispose(); if (!m.keep && !shared.has(m)) m.dispose(); } });
    sweepMats(); CLOCK_FACES.length = 0;
    group = new THREE.Group(); scene.add(group);
  }
  const Bf = {}; const buf = k => (Bf[k] = Bf[k] || []);
  const issues = [], byType = {seated:0,exec:0,rail:0,bench:0,terrace:0}, parts = [], standInfo = {}, handles = [];
  /* Every check result has a category (geometry note, viewing issue, rule break), a key so a fix can test it worked, and an optional fix. */
  const issue = (text, key, cat, extra) => issues.push(Object.assign({text, key, cat}, extra || {}));
  const outline = []; let outerTop = 0;
  let wheelchair = 0, total=0, minC=Infinity, maxH=0, far=0, farRef=null, slowest=0, slowestEm=0, curRef = null;
  const bounds = [-(F.W/2+set), F.W/2+set, -(F.H/2+set), F.H/2+set];
  const focus = [0,0];
  const farFrom = (x,z,y) => {
    let tx = focus[0], tz = focus[1];
    if (F.flag){ tx = -Math.sign(x||1)*F.flag[0]; tz = -Math.sign(z||1)*F.flag[1]; }
    const dd = Math.hypot(x-tx, z-tz, y - focusY);
    if (dd > far){ far = dd; farRef = curRef; }
  };
  const grow = (x,z) => { outline.push([x,z]); bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.max(bounds[1], x); bounds[2] = Math.min(bounds[2], z); bounds[3] = Math.max(bounds[3], z); };
  const regions = [], roofQuads = [], allRecs = [], anchors = [], boardGaps = [], viewPosts = [], viewWalls = []; // viewPosts and viewWalls: what can get in a fan's way

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
  /* Rows a hard plot boundary (or the surroundings) leaves off, by stand and tier: the most rows that fit anywhere along it
     against the most asked for, so the editor can say why adding rows isn't adding seats. */
  const cutInfo = {};
  const noteCut = (key, from, want, got) => { for (let k = from; k < want.length; k++){ if (want[k].ghost) continue;
    const list = cutInfo[key] = cutInfo[key] || [], c = list[k - from] = list[k - from] || {fit:0, want:0};
    c.fit = Math.max(c.fit, Math.floor(got[k].rows + 1e-6)); c.want = Math.max(c.want, Math.floor(want[k].rows + 1e-6)); } };
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
    // where each slice's line passes over a road the stand is built over, as [enter, leave] distances out from the play
    const overBands = overRoads.length ? o.map((_, i) => overRoads.map(R => { const ts = [];
      for (let e=0;e<R.length;e++){ const A = R[e], B = R[(e+1)%R.length], E = [B[0]-A[0], B[1]-A[1]], den = cross(v[i], E); if (Math.abs(den) < 1e-12) continue;
        const w = [A[0]-o[i][0], A[1]-o[i][1]], t = cross(w, E)/den, s = cross(w, v[i])/den; if (s >= -1e-9 && s <= 1 + 1e-9) ts.push(t); }
      return ts.length >= 2 ? [Math.min(...ts), Math.max(...ts)] : null; }).filter(Boolean)) : null;
    const overAt = (i, d0, d1) => !!overBands && overBands[i].some(([e0, e1]) => d1 > e0 && d0 < e1);
    const base = (i, d) => overAt(i, d - .3, d + .3) ? CLEAR : 0; // walls down to the ground stop at the opening's top
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
      let tiers = levelledTiers(cut(st.tiersFor(i), i), st, standSet); const s0 = setAt(i);
      if (poly || obstacles.length){
        const dm = roomAt(o[i], v[i], s0); if (!isFinite(dm)){ if (S.plot.clip) noteCut(st.key, st.drawFrom, tiers, tiers); tierList.push(tiers); profs.push(profile(tiers, s0)); continue; }
        if (S.plot.clip){ const want = tiers; tiers = trimTiers(tiers, dm - margin, s0); noteCut(st.key, st.drawFrom, want, tiers); }
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
    let standWc = 0, standSeats = 0, standEvac = 0, standTop = 0, standBack = 0; const kinds = new Set(), segRecs = [], tierRecs = [], towerReqs = [];
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
    const HEb = homeEndOf(), heDir = SIDE_DIR[HEb.at], bannerRows = {};
    const homeHere = i => !!HEb.at && HEb.banners !== false && (HEb.at === st.key || (st.key === "B" && heDir && (v[i][0]*heDir[0] + v[i][1]*heDir[1]) > .55*Math.hypot(v[i][0], v[i][1])));
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
    const AC = standAccessOf(cfg), acPer = AC.per;
    if (AC.on && acPer > 0){ // along the stand's seated length (each side of a closed bowl in turn), spread out or grouped as asked
      let iL = -1, iR = -1; for (let i=0;i<m;i++) if (profs[i].some((p, k) => k >= st.drawFrom && p && !p.ghost && nRows(p) >= 1)){ if (iL < 0) iL = i; iR = i; }
      if (iL >= 0){
        const runs = closed ? ["N", "E", "S", "W"].map(d => { const si = sideHere(d); return si < 0 ? null : {a: cum[si] - lenTotal/8, L: lenTotal/4, si}; }).filter(Boolean)
          : [{a: cum[iL], L: cum[iR] - cum[iL], si: midI}];
        for (const run of runs){ const {a, L} = run, n = acPer, gap = 1.5, len = Math.max(3.2, Math.min(AC.length, (L - 4)/n - (AC.arrange === "spread" ? 1 : gap)));
          if (L < len + 4) continue;
          const group = n*len + (n - 1)*gap, side = rightAt(run.si), cs = [];
          for (let q=0;q<n;q++){
            if (AC.arrange === "middle") cs.push(a + L/2 - group/2 + q*(len + gap) + len/2);
            else if (AC.arrange === "ends"){ const half = Math.ceil(n/2), k = q < half ? q : q - half, fromLo = q < half; cs.push(fromLo ? a + 2 + k*(len + gap) + len/2 : a + L - 2 - k*(len + gap) - len/2); }
            else if (AC.arrange === "left" || AC.arrange === "right"){ const lo = (AC.arrange === "right") === (side > 0); cs.push(lo ? a + L - 2 - q*(len + gap) - len/2 : a + 2 + q*(len + gap) + len/2); }
            else cs.push(a + L*(q + .5)/n); }
          for (const lv of AC.at === "spread" ? ["back", "front", "upper"] : [AC.at])
            for (const c of cs) blocks.push({kind:"access", at:lv, si:run.si, c, hw: len/2, tierTop: lv === "upper" || lv === "upperBack"}); } } }
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
      /* the end of a tier: a solid side wall stepping up with the rows to a little over a metre above them, so nobody stands
         at an open edge, with a concrete coping and a handrail along the top */
      const yb = d => lerp(y1, y2, (d - d1)/Math.max(1e-6, d2 - d1)), cb = buf("concrete"), up = rail === false ? .15 : 1.1;
      for (let j=from;j<to;j++){ const a = p.front + j*T, b = a + T, h = p.hs[j] + up; quad(cb, V(s,a,yb(a)), V(s,b,yb(b)), V(s,b,h), V(s,a,h));
        if (j > from && p.hs[j] > p.hs[j-1]) quad(cb, V(s,a,p.hs[j-1] + up), V(s,a,p.hs[j] + up), V(s,a,p.hs[j] + up), V(s,a,p.hs[j-1] + up)); }
      if (rail === false) return; // where it meets the next stand, the wall only closes any step between them
      bar(buf("steel"), V(s, d1 + .1, p.hs[from] + up + .05), V(s, d2 - .1, p.hs[to-1] + up + .05), .06);
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
        if (b.kind === "access" && n >= 4){ b.r0 = b.at === "front" || b.at === "upper" ? 0 : b.at === "back" || b.at === "upperBack" ? n - 2 : Math.max(1, Math.floor(n*(tc.entryAt || .42)) - 2); b.R = b.r0 + 2; }
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
      /* Where fans come in, a level walkway runs the length of the tier (about 1.2 m wide): along the back, along the front,
         or across the tier just in front of the exit tunnels. The entrances sit at the heads (or feet) of the gangways, so
         everyone walks along the walkway to their gangway and on to their row. */
      const walkRows = n => { const k = Math.max(1, Math.ceil(1.15/T)); if (n < k + 3) return null;
        if (entry === "back" && tc.entry === "back") return [n - k, n];
        if (entry === "front") return [0, k];
        if (entry === "middle" && vomAt.size){ const ja = vomRows(n)[0]; return ja - k >= 1 ? [ja - k, ja] : null; }
        return null; };
      const atAisles = every => { const list = [...aisleAt].sort((a, b) => a - b); if (!list.length) return marks(every);
        const step = S.design.gangEvery*S.types[tierType].width + S.design.gangWidth, k = Math.max(1, Math.round(every/step)), out = new Set();
        list.forEach((s2, q) => { if (q % k === Math.floor((list.length - 1)/2) % k) out.add(s2); }); return out; };
      const backAt = entry === "back" && tc.entry === "back" ? atAisles(entryEvery) : new Set(), frontAt = entry === "front" ? atAisles(entryEvery) : new Set();
      const emergAt = S.design.emergEvery > 0 ? marks(S.design.emergEvery) : new Set();
      const rowLen = [], recs = [], rowCut = []; let frontLen = 0;
      const gangCut = sl => aisleAt.has(sl) ? S.design.gangWidth/2 + .05 : 0;
      const vomRows = n => { const j0 = Math.max(1, Math.min(n - 5, Math.floor(n*(tc.entryAt || 0.42)))); return [j0, Math.min(n, j0 + 4)]; };
      const vomCut = (sl, n, j) => { if (!vomAt.has(sl) || n < 6) return 0; const [ja, jb] = vomRows(n); return j >= ja && j < jb ? S.design.exitWidth/2 + .3 : 0; };
      for (let i=0;i<segs;i++){
        const j1 = nx(i), p0 = pk(i), p1 = pk(j1);
        const n0 = p0 && !p0.ghost ? nRows(p0) : 0, n1 = p1 && !p1.ghost ? nRows(p1) : 0, mr = Math.min(n0, n1);
        if (mr >= 1){
          for (let j=0;j<mr;j++){
            const a0 = p0.front + j*T, a1 = p1.front + j*T, h0 = p0.hs[j], h1 = p1.hs[j];
            if ((overAt(i, a0, a0 + T) && h0 - .6 < CLEAR) || (overAt(j1, a1, a1 + T) && h1 - .6 < CLEAR)){ // too low to clear the road under it
              rowCut[j] = (rowCut[j] || 0) + Math.hypot(pt(j1, a1+T/2)[0] - pt(i, a0+T/2)[0], pt(j1, a1+T/2)[1] - pt(i, a0+T/2)[1]); continue; }
            const alt = (tierType === "seated" || tierType === "rail") && altRow(i, j, kk);
            const m0 = pt(i, a0+T/2), m1 = pt(j1, a1+T/2), len = Math.hypot(m1[0]-m0[0], m1[1]-m0[1]) || 1e-6;
            // seats stop at the edge of a gangway or an exit tunnel rather than running through it
            const v0 = vomCut(i, n0, j), v1 = vomCut(j1, n1, j), f0 = Math.min(.49, Math.max(gangCut(i), v0)/len), f1 = 1 - Math.min(.49, Math.max(gangCut(j1), v1)/len);
            const E = (d0, y0, d1, y1, f) => { const p = V(i, d0, y0), q = V(j1, d1, y1); return [lerp(p[0],q[0],f), lerp(p[1],q[1],f), lerp(p[2],q[2],f)]; };
            const strip = (key, d0, y0, d1, y1, e0, z0, e1, z1) => quad(buf(key), E(d0,y0,d1,y1,f0), E(d0,y0,d1,y1,f1), E(e0,z0,e1,z1,f1), E(e0,z0,e1,z1,f0));
            const b0 = a0+T-.1, b1 = a1+T-.1;
            const WR = walkRows(n0);
            if (WR && j >= WR[0] && j < WR[1]){ // the walkway: level, the full length of the tier, with a yellow line along its edge
              if (j === WR[0]){ const k = WR[1] - WR[0], Ea = (d0, y0, d1, y1, f) => E(d0, y0, d1, y1, f);
                quad(buf("aisle"), Ea(a0,h0,a1,h1,0), Ea(a0,h0,a1,h1,1), Ea(a0+k*T,h0,a1+k*T,h1,1), Ea(a0+k*T,h0,a1+k*T,h1,0));
                quad(buf("barrier"), Ea(a0,h0+.01,a1,h1+.01,0), Ea(a0,h0+.01,a1,h1+.01,1), Ea(a0+.1,h0+.01,a1+.1,h1+.01,1), Ea(a0+.1,h0+.01,a1+.1,h1+.01,0));
                if (j > 0) quad(buf("riser"), Ea(a0,p0.hs[j-1],a1,p1.hs[j-1],0), Ea(a0,p0.hs[j-1],a1,p1.hs[j-1],1), Ea(a0,h0,a1,h1,1), Ea(a0,h0,a1,h1,0));
                const top0 = p0.hs[Math.min(n0 - 1, WR[1] - 1)], top1 = p1.hs[Math.min(n1 - 1, WR[1] - 1)]; // up to the row behind it
                if (top0 > h0 + .02) quad(buf("riser"), Ea(a0+k*T,h0,a1+k*T,h1,0), Ea(a0+k*T,h0,a1+k*T,h1,1), Ea(a0+k*T,top1,a1+k*T,top1,1), Ea(a0+k*T,top0,a1+k*T,top0,0)); }
              if (j === 0) frontLen += len;
              continue; }
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
          if (homeHere(i) && homeHere(j1) && !CV){ // the home end's banners, hung over the front of every tier
            const t0 = p0.hF + (p0.stacked ? 1.05 : .75), t1 = p1.hF + (p1.stacked ? 1.05 : .75), dh = Math.min(1.5, Math.max(.8, Math.min(t0, t1) - .2));
            (bannerRows[k] = bannerRows[k] || []).push({a:V(i, p0.front - .08, t0 - dh), b:V(j1, p1.front - .08, t1 - dh), h:dh, view:[0, 0]}); }
          if ((front === "plain" || front === "lattice") && tierType !== "exec"){ // a front wall a little under a metre above the front row (more on a balcony), with a coping
            const up0 = p0.stacked ? 1.05 : .75, up1 = p1.stacked ? 1.05 : .75, Eq = (d0, y0, d1, y1, f) => { const p = V(i, d0, y0), q = V(j1, d1, y1); return [lerp(p[0],q[0],f), lerp(p[1],q[1],f), lerp(p[2],q[2],f)]; };
            for (const [fa, fb, md] of FP || [[0, 1, null]]) if (md !== "cut"){
              quad(fasc, Eq(p0.front,p0.hF,p1.front,p1.hF,fa), Eq(p0.front,p0.hF,p1.front,p1.hF,fb), Eq(p0.front,p0.hF+up0,p1.front,p1.hF+up1,fb), Eq(p0.front,p0.hF+up0,p1.front,p1.hF+up1,fa));
              quad(buf("concrete"), Eq(p0.front,p0.hF+up0,p1.front,p1.hF+up1,fa), Eq(p0.front,p0.hF+up0,p1.front,p1.hF+up1,fb), Eq(p0.front+.25,p0.hF+up0,p1.front+.25,p1.hF+up1,fb), Eq(p0.front+.25,p0.hF+up0,p1.front+.25,p1.hF+up1,fa)); } }
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
          quad(buf(wallKey), V(i,bk0,base(i,bk0)), V(j1,bk1,base(j1,bk1)), V(j1,bk1,t1+1.2), V(i,bk0,t0+1.2));
          // where the depth changes from one slice to the next (an oval or blended outline), a smooth outer wall hides the steps
          if (n0 !== n1 && !profs[i].slice(k+1).some(q => q && !q.ghost && nRows(q) >= 1)){
            const e0 = p0.front + n0*T, e1 = p1.front + n1*T; quad(buf(wallKey), V(i,e0,base(i,e0)), V(j1,e1,base(j1,e1)), V(j1,e1,p1.hs[n1-1]+1.2), V(i,e0,p0.hs[n0-1]+1.2)); }
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
            if (bk > lb + .1){ quad(buf(wallKey), V(s,lb,base(s,lb)), V(s,bk,base(s,bk)), V(s,bk,top-1.5), V(s,lb,soff(lb)));
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
        if (backAt.has(s) && n >= 2){ // an entrance at the back, at the head of a gangway: a doorway from the concourse onto the walkway
          const ew = S.design.exitWidth/2, WR = walkRows(n), y0 = (WR ? p.hs[WR[0]] : p.hs[n-1]) + .02, bk = p.front + n*T - .02, cb = buf("concrete");
          const at = (d, y, side, w) => across(w, d, y, side);
          quad(buf("void"), at(bk, y0, -1, ew), at(bk, y0, 1, ew), at(bk, y0 + 2.1, 1, ew), at(bk, y0 + 2.1, -1, ew));
          for (const side of [-1, 1]) quad(cb, at(bk - .05, y0, side, ew), at(bk - .05, y0, side, ew + .35), at(bk - .05, y0 + 2.5, side, ew + .35), at(bk - .05, y0 + 2.5, side, ew));
          quad(cb, at(bk - .05, y0 + 2.1, -1, ew), at(bk - .05, y0 + 2.1, 1, ew), at(bk - .05, y0 + 2.5, 1, ew), at(bk - .05, y0 + 2.5, -1, ew));
          const c = pt(s, bk - .12); post(buf("access"), c[0], c[1], y0 + 2.15, y0 + 2.4, .5); } // a sign with the entrance number
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
          post(buf("column"), q[0], q[1], base, p.hF - 1.5, 0.45); viewPosts.push({x:q[0], z:q[1], r:.3, y0:base, y1:p.hF - 1.5, cause:"pillar"});
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
              if (reach > 1){ const r0 = b.c - w, r1 = b.c + w, h = 2.5, wa = Q(r0, (d1 + dF)/2, 0), wb = Q(r1, (d1 + dF)/2, 0); viewWalls.push({a:[wa[0], wa[2]], b:[wb[0], wb[2]], y0:0, y1:h, cause:"dugout"});
                 arc = [[0, h - .5], [.25, h - .15], [.5, h], [.75, h - .15], [1, h - .5]];
                for (const e2 of [r0, r1]) quad(buf(key), Q(e2,d1,0), Q(e2,dF,0), Q(e2,dF,h - .5), Q(e2,d1,h - .5));
                for (let q=0;q<arc.length-1;q++){ const [fa, ya] = arc[q], [fb, yb] = arc[q+1], sa = lerp(r0, r1, fa), sb = lerp(r0, r1, fb);
                  quad(buf(key), Q(sa,d1,ya), Q(sb,d1,yb), Q(sb,dF,yb), Q(sa,dF,ya)); }
                quad(buf("void"), Q(r0+.15,d1+.02,0), Q(r1-.15,d1+.02,0), Q(r1-.15,d1+.02,h - .6), Q(r0+.15,d1+.02,h - .6)); } } } }
        else if (b.kind === "bubble"){ // a perspex shelter on the apron, set back from the touchline
          const D = 2.3, dBk = dF - .4, dFr = dBk - D;
          if (dFr < 1){ if (!issues.some(x => x.key === "dugouts:fit")){ issue(`The dugouts don't fit between the touchline and the ${st.name.toLowerCase()} (they need about ${(D + 1.4).toFixed(1)} m).`, "dugouts:fit", "geo",
            {tab:st.key, fix:{label:"Sink them into the stand", run:() => { S.dugouts = Object.assign(dugoutsOf(), {style:"sunk"}); return true; }}}); } continue; }
          const seat = tint("seated", colour), H = 2.2, wa = Q(s0, (dBk + dFr)/2, 0), wb = Q(s1, (dBk + dFr)/2, 0); viewWalls.push({a:[wa[0], wa[2]], b:[wb[0], wb[2]], y0:0, y1:H - .3, cause:"dugout"});
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
      rowCut.forEach((l, j) => { if (l) roadCut[st.name] = (roadCut[st.name] || 0) + capRow((rowLen[j] || 0) + l, tierType) - capRow(rowLen[j] || 0, tierType); }); // what the road cost
      for (const r of recs){ r.seats = rowLen[r.j] ? capRow(rowLen[r.j], tierType) * r.len / rowLen[r.j] : 0; r.k = k; segRecs.push(r); }
      if (CT) for (const b of CT) if (b.kind === "access" && b.R){ // each space 0.9 m for the wheelchair, 0.7 m for a companion seat
        const sp = Math.floor(2*b.hw/1.6), P = b.P, y = P.hs[Math.min(nRows(P)-1, b.r0)], m0 = ptS(b.c - b.hw, P.front + (b.r0 + 1)*b.T), m1 = ptS(b.c + b.hw, P.front + (b.r0 + 1)*b.T);
        wheelchair += sp; standWc += sp; seats += sp*2; segRecs.push({j:b.r0, len:2*b.hw, d:P.front + (b.r0 + 1)*b.T, x:(m0[0]+m1[0])/2, z:(m0[1]+m1[1])/2, m0, m1, h0:y, h1:y, type:"seated", seats:sp*2, k, i:b.si}); }
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
      /* A see-through strip along the front lets light onto the pitch (most modern metal roofs have one); the sheets
         underneath get a grey ceiling, and steel rafters, deepening towards the back, carry the roof. */
      const mkey = ROOF_MAT_KEY[rf.mat] || "roof", opaque = ["roofSolid", "roofGreen", "roofConcrete"].includes(mkey);
      const edge = gable ? 0 : Math.max(0, Math.min(.6, rf.edge != null ? rf.edge : rf.mat === "metal" ? .2 : 0));
      const cuts = [...new Set([0, 1, ...Array.from({length:nS}, (_, s) => s/nS), ...(edge > 0 ? [edge] : [])])].sort((x, y) => x - y);
      for (let i=0;i<segs;i++){
        const j1 = nx(i), a = RR[i], b = RR[j1]; if (!a || !b) continue;
        const uA = cum[i], uB = j1 === 0 && closed ? lenTotal : cum[j1], span = Math.max(1, (a.outer - a.inner + b.outer - b.inner)/2);
        for (let c=0;c<cuts.length-1;c++){ const f0 = cuts[c], f1 = cuts[c+1], key = f1 <= edge + 1e-6 ? "roofGlass" : mkey;
          const P0 = V(i,at(a,f0),a.y(f0)), P1 = V(j1,at(b,f0),b.y(f0)), P2 = V(j1,at(b,f1),b.y(f1)), P3 = V(i,at(a,f1),a.y(f1));
          sheet(key, P0, P1, P2, P3, uA, uB, f0*span, f1*span);
          if (opaque && key === mkey) quad(buf("soffit"), [P0[0],P0[1]-.3,P0[2]], [P1[0],P1[1]-.3,P1[2]], [P2[0],P2[1]-.3,P2[2]], [P3[0],P3[1]-.3,P3[2]]); }
        // the front beam: a deep box girder with a lip underneath
        quad(buf("roofEdge"), V(i,a.inner,a.y(0)-1.6), V(j1,b.inner,b.y(0)-1.6), V(j1,b.inner,b.y(0)+.15), V(i,a.inner,a.y(0)+.15));
        quad(buf("roofEdge"), V(i,a.inner,a.y(0)-1.6), V(j1,b.inner,b.y(0)-1.6), V(j1,b.inner+.7,b.y(0)-1.6), V(i,a.inner+.7,a.y(0)-1.6));
        quad(clad, V(i,a.outer,base(i,a.outer)), V(j1,b.outer,base(j1,b.outer)), V(j1,b.outer,b.y(1)), V(i,a.outer,a.y(1)));
        if (look === "plain" && a.y(1) > 14 && b.y(1) > 14 && sty.wall !== "glassClad"){ const y0 = a.y(1)*0.42, y1 = b.y(1)*0.42; quad(buf("band"), V(i,a.outer+.08,y0), V(j1,b.outer+.08,y1), V(j1,b.outer+.08,y1+2.4), V(i,a.outer+.08,y0+2.4)); }
        if (rf.support === "truss" && !closed) latticeAlong(buf("steel"), i, j1, (k, off) => { const r = k === i ? a : b; return [V(k, r.inner + off, r.y(Math.max(0, off)/(r.outer - r.inner)))]; });
        roofQuads.push([pt(i,a.inner), pt(j1,b.inner), pt(j1,b.outer), pt(i,a.outer)]);
      }
      const ribAt = marks(12), colAt = marks(14), mastAt = marks(32), rafterAt = mkey !== "roofConcrete" ? marks(7) : new Set();
      for (const i of rafterAt){ const a = RR[i]; if (!a) continue; // steel rafters under the sheets, deeper towards the back
        const f0 = Math.max(.02, edge), steps = Math.max(2, nS*2);
        for (let q=0;q<steps;q++){ const fa = lerp(f0, .98, q/steps), fb = lerp(f0, .98, (q+1)/steps), da = .35 + 1.7*fa, db = .35 + 1.7*fb;
          quad(buf("column"), V(i,at(a,fa),a.y(fa)-.3), V(i,at(a,fb),a.y(fb)-.3), V(i,at(a,fb),a.y(fb)-.3-db), V(i,at(a,fa),a.y(fa)-.3-da)); } }
      /* A big steel girder along the top of the roof, the full length of the stand, like Old Trafford's: a box truss with
         four chords, bracing zigzagging along its front and back faces and across its top, carried down to the ground at
         the ends of an open stand. A roof support style of its own, or added to any roof on top of its usual support. */
      if (rf.support === "toptruss" || rf.topTruss){
        const sb = buf("steel"), fT = .38, D = 5.5, half = 1.7, live = []; for (let i=0;i<m;i++) if (RR[i]) live.push(i);
        const P3 = (i, up, side) => { const a = RR[i], q = pt(i, at(a, fT) + side*half); return [q[0], a.y(fT) + .3 + up, q[1]]; };
        for (let n=0;n<live.length;n++){ const i = live[n], j = live[n+1] != null ? live[n+1] : (closed ? live[0] : null); if (j == null || (!closed && j !== i + 1)) continue;
          for (const sd of [-1, 1]){ bar(sb, P3(i, 0, sd), P3(j, 0, sd), .5); bar(sb, P3(i, D, sd), P3(j, D, sd), .5); // the four chords
            bar(sb, n % 2 ? P3(i, 0, sd) : P3(i, D, sd), n % 2 ? P3(j, D, sd) : P3(j, 0, sd), .3); } // diagonals down each face
          bar(sb, P3(i, 0, -1), P3(i, D, -1), .25); bar(sb, P3(i, 0, 1), P3(i, D, 1), .25); // verticals
          bar(sb, P3(i, D, -1), P3(i, D, 1), .22); bar(sb, n % 2 ? P3(i, D, -1) : P3(i, D, 1), n % 2 ? P3(j, D, 1) : P3(j, D, -1), .18); bar(sb, P3(i, 0, -1), P3(i, 0, 1), .22); } // and across
        if (!closed) for (const i of [live[0], live[live.length-1]]) if (i != null){ const tg = tangent(i), s2 = i === live[0] ? -1 : 1, q = P3(i, D, 0), b0 = pt(i, at(RR[i], fT));
          post(sb, b0[0] + tg[0]*s2*2.5, b0[1] + tg[1]*s2*2.5, 0, q[1] + .5, 1.8); } // end posts carry it to the ground
        topAll = Math.max(topAll, ...live.map(i => P3(i, D, 0)[1] + .5));
      }
      for (let i=0;i<m;i++){ const a = RR[i]; if (!a) continue;
        const peak = gable ? a.y(.5) : Math.max(a.y(0), a.y(1), a.y(.5));
        outerTop = Math.max(outerTop, a.y(0), a.y(1));
        topAll = Math.max(topAll, peak + (rf.support === "truss" ? 3.2 : rf.support === "ribs" ? 4 : .5));
        if (rf.support === "ribs" && ribAt.has(i)) for (let s=0;s<nS;s++){ const f0 = s/nS, f1 = (s+1)/nS;
          quad(buf("steel"), V(i,at(a,f0),a.y(f0)), V(i,at(a,f1),a.y(f1)), V(i,at(a,f1),a.y(f1) + .4 + 3.6*f1), V(i,at(a,f0),a.y(f0) + .4 + 3.6*f0)); }
        if (rf.support === "columns" && colAt.has(i)){ const x = info[i], cd = Math.max(a.inner + .6, x.front + .6), f = (cd - a.inner)/(a.outer - a.inner), q = pt(i, cd);
          post(buf("column"), q[0], q[1], heightAt(x.prof, cd), a.y(f), 0.35); viewPosts.push({x:q[0], z:q[1], r:.25, y0:heightAt(x.prof, cd), y1:a.y(f), cause:"pillar"}); }
        if (rf.support === "masts" && mastAt.has(i)){ const q = pt(i, a.outer + 4), top = a.y(1) + 22, tip = pt(i, a.inner + 1), mid = pt(i, at(a, .45)), tg = tangent(i);
          post(buf("steel"), q[0], q[1], 0, top, .9);
          for (const [p2, y2] of [[tip, a.y(0)], [mid, a.y(.45)]]) quad(buf("cable"), [q[0]-tg[0]*.08, top, q[1]-tg[1]*.08], [q[0]+tg[0]*.08, top, q[1]+tg[1]*.08], [p2[0]+tg[0]*.08, y2, p2[1]+tg[1]*.08], [p2[0]-tg[0]*.08, y2, p2[1]-tg[1]*.08]);
          topAll = Math.max(topAll, top); }
        const g = pt(i, a.outer); grow(g[0], g[1]);
      }
      if (!closed){
        for (const i of [0, m-1]){ const a = RR[i]; if (!a) continue;
          if (gable) tri(clad, V(i,a.inner,a.y(0)), V(i,at(a,.5),a.y(.5)), V(i,a.outer,a.y(1)));
          if (rf.support === "truss"){ const tg = tangent(i), s = i ? 1.6 : -1.6, q = pt(i, a.inner + .8); post(buf("steel"), q[0] + tg[0]*s, q[1] + tg[1]*s, 0, a.y(0) + 3.2, 1.6); viewPosts.push({x:q[0] + tg[0]*s, z:q[1] + tg[1]*s, r:.8, y0:0, y1:a.y(0) + 3.2, cause:"pillar"}); } }
        const leitchGable = fac.gable && sty.era === "Traditional" && RR[midI];
        if (gable && RR[midI] && !leitchGable){ // central pediment facing the play (the Leitch gable takes its place)
          const a = RR[midI], tg = tangent(midI), c = pt(midI, a.inner), hw = Math.min(14, lenTotal*0.18), apex = a.yIn + hw*0.55, cm = pt(midI, at(a,.5));
          const L1 = [c[0]-tg[0]*hw, a.yIn, c[1]-tg[1]*hw], R1 = [c[0]+tg[0]*hw, a.yIn, c[1]+tg[1]*hw], A1 = [c[0], apex, c[1]];
          tri(buf(cfg.style === "pavilion" ? "white" : "lattice"), L1, R1, A1);
          quad(rm, L1, A1, [cm[0], Math.max(apex, a.y(.5)), cm[1]], [cm[0]-tg[0]*hw, a.y(.5), cm[1]-tg[1]*hw]);
          quad(rm, R1, A1, [cm[0], Math.max(apex, a.y(.5)), cm[1]], [cm[0]+tg[0]*hw, a.y(.5), cm[1]+tg[1]*hw]);
          topAll = Math.max(topAll, apex); }
        /* A Leitch gable, like Craven Cottage's: a pitched gable standing up from the middle of the roof front, painted,
           with the club's name across it and its own little pitched roof running back. Older stands only. */
        if (leitchGable && !DRY){
          const a = RR[midI], tg = tangent(midI), c = pt(midI, a.inner + .2), hw = Math.min(11, lenTotal*0.14), y0 = a.y(0), apex = y0 + hw*0.55, back = pt(midI, a.inner + Math.min(9, (a.outer - a.inner)*.6));
          const L1 = [c[0]-tg[0]*hw, y0, c[1]-tg[1]*hw], R1 = [c[0]+tg[0]*hw, y0, c[1]+tg[1]*hw], A1 = [c[0], apex, c[1]];
          const Lb = [back[0]-tg[0]*hw, y0, back[1]-tg[1]*hw], Rb = [back[0]+tg[0]*hw, y0, back[1]+tg[1]*hw], Ab = [back[0], apex, back[1]];
          tri(buf("white"), L1, R1, A1); quad(buf("slate"), L1, A1, Ab, Lb); quad(buf("slate"), R1, A1, Ab, Rb);
          for (const [p, q] of [[L1, A1], [A1, R1]]) bar(buf(fac.accent ? tint("trim", fac.accent) : "trim"), p, q, .35); // a painted barge board
          const name = String(fac.sign || sponsorsOf().title || homeEndOf().name || "FOOTBALL CLUB").slice(0, 30).toUpperCase(), sm = signMaterial(name, S.seat);
          let lh = hw*0.2; if (lh*sm.aspect > hw*1.3) lh = hw*1.3/sm.aspect;
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(lh*sm.aspect, lh), sm), toward = pt(midI, a.inner - 60);
          sign.position.set(c[0] - v[midI][0]*.08, y0 + hw*0.17, c[1] - v[midI][1]*.08); sign.lookAt(toward[0], y0 + hw*0.17, toward[1]); sign.userData.stadium = true; group.add(sign);
          topAll = Math.max(topAll, apex); }
        // a stand clock up on the roof, facing the pitch, as at Arsenal's old Clock End
        if (fac.clock === "roof" && RR[midI] && !DRY){ const a = RR[midI], r = Math.max(2, Math.min(4.5, lenTotal*0.03)), d = a.inner + Math.min(3, (a.outer - a.inner)*.3), p = pt(midI, d), tg = tangent(midI), y = a.y(.15) + r + 1;
          for (const s of [-1, 1]) post(buf("steel"), p[0] + tg[0]*r*.6*s, p[1] + tg[1]*r*.6*s, a.y(.15), y - r*.5, .2);
          addClock(p, y, pt(midI, d - 60), r); topAll = Math.max(topAll, y + r); }
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
    if (fac.clock === "wall" && info[midI] && !DRY){ // a stand clock high on the back wall, facing the street
      const R3 = roofOn && RRout ? RRout[midI] : null, d = (R3 ? R3.outer : info[midI].back) + .4, top = R3 ? R3.y(1) : info[midI].top, r = Math.max(1.8, Math.min(4, top*0.12));
      if (top > 2*r + 4) addClock(pt(midI, d), top - r - 1.5, pt(midI, d + 60), r); }
    if (fac.towers){ const ts = closed ? [...marks(60)] : [0, m-1].filter(endOpen);
      for (const i of ts){ const b = backAt(i); if (b == null) continue; const tg = tangent(i), side = closed ? 0 : (i ? 4 : -4), q = pt(i, b + 3.5);
        post(buf("tower"), q[0] + tg[0]*side, q[1] + tg[1]*side, 0, info[i].top, 6); grow(q[0], q[1]); } } // level with the back of the stand, so it doesn't poke up behind the fans
    /* Entrances: turnstile blocks standing out from the back wall, each with a row of turnstile doors, an exit gate,
       a canopy and a band in the accent colour; plain gates in between. */
    if (fac.gates){ const blocks = marks(36), band = fac.accent ? tint("trim", fac.accent) : "trim";
      for (const i of marks(12)){ const b = backAt(i); if (b == null || base(i, b) > 0) continue; const tg = tangent(i); // (none where a road runs under)
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
    if (!DRY) for (let i=0;i<segs;i++){ // (the behind-the-scenes rebuilds for fixes only need the numbers)
      const j1 = nx(i), x0 = info[i], x1 = info[j1]; if (!x0 || !x1) continue;
      const ra = RRout && RRout[i], rb = RRout && RRout[j1], roofed = roofOn && ra && rb;
      const d0 = roofed ? ra.outer : x0.back, d1 = roofed ? rb.outer : x1.back, y0 = roofed ? ra.y(1) : x0.top, y1 = roofed ? rb.y(1) : x1.top;
      const nv = [v[i][0] + v[j1][0], v[i][1] + v[j1][1]], nl = Math.hypot(nv[0], nv[1]) || 1;
      dressWall(buf, look, wallKey, pt(i, d0), pt(j1, d1), y0, y1, [nv[0]/nl, nv[1]/nl], Object.assign({along: cum[i], total: lenTotal, lift: Math.max(base(i, d0), base(j1, d1))}, wallOpt));
    }
    // the stadium's name (naming rights) goes along the main stand's roof front, unless that stand has lettering of its own
    const SP = sponsorsOf(), named = !fac.sign && SP.title && SP.onStand !== false && st.key === (lay === "bowl" ? "B" : lay === "ring" ? "R0" : "N");
    const HEn = homeEndOf(), homeNamed = !fac.sign && !named && HEn.name && HEn.at === st.key; // the home end's name, like the Kop's
    const signText = fac.sign || (named ? SP.title : homeNamed ? HEn.name : ""), signAt = named || homeNamed ? "roof" : fac.signAt;
    if (signText && !DRY){ // lettering on the outside wall, or along the roof front facing the play
      let si = midI;
      if (closed){ let bd = Infinity; si = -1; for (let i=0;i<m;i++){ if (!info[i]) continue; const d = -v[i][1]/(Math.hypot(v[i][0], v[i][1]) || 1), xx = Math.abs(pt(i, 0)[0]); if (d > .95 && xx < bd){ bd = xx; si = i; } } } // the middle of the main side
      const x = si >= 0 ? info[si] : null, R2 = x && RRout ? RRout[si] : null;
      if (x){
        const mat = signMaterial(String(signText).slice(0, 30), (named ? SP.titleColour : homeNamed ? S.seat : fac.signColour) || "#ffffff"), onRoof = signAt === "roof" && roofOn && R2;
        mat.emissiveIntensity = S.night ? .9 : .35; // a little light keeps it legible in shadow
        const vl = Math.hypot(v[si][0], v[si][1]) || 1, nOut = [v[si][0]/vl, v[si][1]/vl], tg = tangent(si);
        const top = onRoof ? R2.y(0) : roofOn && R2 ? R2.y(1) : x.top;
        // big raised letters, as clubs mount their names: about a sixth of the wall's height, never wider than most of the stand
        let h = onRoof ? Math.max(1.4, Math.min(5, top*0.11)) : Math.max(2, Math.min(7, top*0.17)); if (h*mat.aspect > lenTotal*0.7) h = lenTotal*0.7/mat.aspect;
        /* The lettering follows the line of the roof front (or the wall) round the stand, so on a curved bowl the ends of a
           name don't disappear into the roof or the wall. It reads left to right for whoever's looking at it. */
        const w = h*mat.aspect, wallOff = look === "fins" ? 1.9 : look === "concrete" ? 1.3 : look === "glass" ? .9 : .7;
        const dOf = (i, extra) => onRoof ? (RRout[i] || R2).inner - .3 - extra : ((roofOn && RRout[i] ? RRout[i].outer : (info[i] || x).back) + wallOff - extra);
        const seg = s2 => { let xx = closed ? ((s2 % lenTotal) + lenTotal) % lenTotal : Math.max(0, Math.min(cum[m-1], s2)), i = 0;
          while (i < m - 1 && cum[i+1] <= xx) i++; if (!closed && i >= m - 1) i = m - 2; const j = nx(i), sl = (j === 0 ? lenTotal : cum[j]) - cum[i];
          return [i, j, sl > 0 ? (xx - cum[i])/sl : 0]; };
        const P = (s2, extra) => { const [i, j, f] = seg(s2), a = pt(i, dOf(i, extra)), b = pt(j, dOf(j, extra)); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)]; };
        const yRoof = s2 => { const [i, j, f] = seg(s2); return lerp((RRout[i] || R2).y(0), (RRout[j] || R2).y(0), f); };
        const c0 = cum[si], q0 = P(c0 - 1, 0), q1 = P(c0 + 1, 0), stretch = Math.max(.3, Math.hypot(q1[0]-q0[0], q1[1]-q0[1])/2), span = w/stretch; // metres along the stand's own line
        const right = rightAt(si)*(onRoof ? 1 : -1), N = Math.max(8, Math.ceil(w/0.6)), ycWall = look === "sheet" && top > 10 ? top - 4.1 - h*.55 : top - h*1.05;
        const yc = s2 => onRoof ? yRoof(s2) - .3 - h/2 : ycWall;
        const strip = (material, extra) => { const pos = [], uv = [];
          for (let q=0;q<N;q++){ const sa = c0 - span/2 + span*q/N, sb = c0 - span/2 + span*(q+1)/N, A = P(sa, extra), B = P(sb, extra), ua = right > 0 ? q/N : 1 - q/N, ub = right > 0 ? (q+1)/N : 1 - (q+1)/N;
            const ya = yc(sa), yb = yc(sb);
            pos.push(A[0],ya-h/2,A[1], B[0],yb-h/2,B[1], B[0],yb+h/2,B[1], A[0],ya-h/2,A[1], B[0],yb+h/2,B[1], A[0],ya+h/2,A[1]); uv.push(ua,0, ub,0, ub,1, ua,0, ub,1, ua,1); }
          const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
          material.side = THREE.DoubleSide; const ms = new THREE.Mesh(geo, material); ms.userData.stadium = true; group.add(ms); return ms; };
        if (onRoof){ // a backing plate the length of the name, following the roof front
          const pad = 1.5/stretch;
          for (let q=0;q<N;q++){ const sa = c0 - span/2 - pad + (span + 2*pad)*q/N, sb = c0 - span/2 - pad + (span + 2*pad)*(q+1)/N, A = P(sa, -.2), B = P(sb, -.2);
            quad(buf("fascia"), [A[0], yc(sa) - h/2 - .4, A[1]], [B[0], yc(sb) - h/2 - .4, B[1]], [B[0], yRoof(sb), B[1]], [A[0], yRoof(sa), A[1]]); } }
        const mesh = strip(mat, 0);
        if (!onRoof) for (let l=1;l<=6;l++) strip(mat.edge, l*0.06); // stacked behind the face, so the letters stand off the wall
      }
    }
    if (st.sel && st.key in S.stands && lay === "stands" && info[midI]){ const q = pt(midI, info[midI].front);
      handles.push({kind:"dist", x:q[0], y:0.6, z:q[1], o:o[midI], v:v[midI], cfg}); }
    for (const r of segRecs){ r.stand = st.key; allRecs.push(r); }
    // over a road: columns along both kerbs carry the stand, the full height up to its underside
    if (overBands && !DRY) for (let s=0;s<m;s+=2) for (const [e0, e1] of overBands[s]){
      const live = profs[s].filter(p => p && !p.ghost && nRows(p) >= 1); if (!live.length) continue;
      const fr = Math.min(...live.map(p => p.front)), bk = Math.max(...live.map(p => p.front + nRows(p)*p.T));
      for (const d of [e0 - .5, e1 + .5]){ if (d < fr || d > bk) continue; const top = heightAt(live, d) - .6, q = pt(s, d); if (top > 1) post(buf("column"), q[0], q[1], 0, top, .6); } }
    if (roadCut[st.name] > 0 && !st.roadNoted){ st.roadNoted = true;
      issue(`The ${st.name.toLowerCase()} is built over a road: about ${fmt(Math.max(10, Math.round(roadCut[st.name]/10)*10))} seats at the back or bottom of it are left out to keep a ${CLEAR} m opening for the traffic underneath.`, "road:" + st.key, "geo", {tab:st.key}); }
    if (!DRY) for (const k in bannerRows) adStrip(bannerRows[k], bannerMaterial());
    maxH = Math.max(maxH, topAll); outerTop = Math.max(outerTop, standTop);
    const si = standInfo[st.key] = standInfo[st.key] || {width:0, depth:0, height:0, seats:0};
    si.width += lenTotal; si.depth = Math.max(si.depth, standBack - s0); si.height = Math.max(si.height, topAll); si.seats += standSeats;
    if (standSeats) parts.push({label:st.name, key:st.key, seats:Math.round(standSeats), kinds:(st.styleLabel === false ? "" : sty.label + " · ") + [...kinds].join(" + ") + ` · empties in ${standEvac.toFixed(1)} min` + (standWc ? ` · ${standWc} wheelchair spaces` : ""), tiers:tierRecs, wheel:standWc});
    regions.push({key:st.key, o, v, closed, profs: profs.map(p => p.slice(st.drawFrom).filter(x => !x.ghost))});
    anchors.push({key: st.ck || st.key, name: st.name, o, v, info, RR: RRout, m, closed, profs, drawFrom: st.drawFrom});
    for (const r of segRecs) r.an = anchors[anchors.length - 1];
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
      for (let s=0;s<nS;s++){ const f0 = s/nS, f1 = (s+1)/nS, sp = Math.max(1, dOut[i] - dIn[i]), u0 = i*3, u1 = (i + 1)*3;
        sheet(ROOF_MAT_KEY[gr.mat] || "roof", V3(i,at(i,f0),a(f0)), V3(j,at(j,f0),b(f0)), V3(j,at(j,f1),b(f1)), V3(i,at(i,f1),a(f1)), u0, u1, f0*sp, f1*sp); }
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
  const farName = F.flag ? "far corner" : "centre";
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
  const result = {issues, total, wheelchair, awayAlloc, maxH, bounds, covered, minC, slowest, slowestEm, far, farRef, restricted:0, obstructed:null, byType, roofNeedMax};
  result.bowlSides = isHybrid() ? bowlSeatsBySide(allRecs, F, set) : null; // the lower bowl's seats side by side, for the results
  const screenPlans = planScreens(F, anchors, closedAt, outerTop, set, issue);

  // pitchside advertising boards
  /* Any rectangular playing area gets them (football, rugby, wrestleball, a plain floor): by default 5 m behind the
     goal lines and 4 m back from the touchlines, as at most grounds, but never closer than a metre to the front of the
     stands. With seats on the floor they go just inside the front row. */
  const FP = pitchOf(F), boardsFit = S.sport === "football" || S.sport === "rugby" || (F.custom && !(FP.r > 0) && ["wrestleball","plain"].includes(S.custom.kind));
  const BS = boardSetOf(), roomX = set + (F.W - FP.W)/2 - 1, roomZ = set + (F.H - FP.H)/2 - 1 - (S.sport === "football" ? .5 : 0);
  const offX = floorRows ? .6 : Math.min(BS.end, roomX), offZ = floorRows ? .6 : Math.min(BS.side, roomZ), bH = BS.height;
  const boardsOn = S.boards && !CV && boardsFit && offX >= .5 && offZ >= .5;

  /* ---------- obstructed views ---------- */
  { const A = S.arch || {}, H = Math.max(8, outerTop), fm = floodMode();
    if (fm === "masts" || fm === "pylons"){ const mh = Math.max(maxH + 16, 30);
      for (const [x, z] of floodMastSpots(F, sext, outline)) viewPosts.push({x, z, r: fm === "pylons" ? 3 : 1, y0:0, y1:mh + 4, cause:"mast"}); }
    for (const sp of archSpans(A, F, set, sext, H, standInfo)) for (const u of [.02, .98]){ const c = sp.C(u), c2 = sp.C(u < .5 ? .07 : .93); viewPosts.push({x:c.x, z:c.z, r:sp.r0*1.5, y0:0, y1:c2.y, cause:"arch"}); }
    for (const p of screenPlans) if (p.kind === "board"){ const px = -p.n[1]*p.w/2, pz = p.n[0]*p.w/2; viewWalls.push({a:[p.x - px, p.z - pz], b:[p.x + px, p.z + pz], y0:p.y - p.h/2, y1:p.y + p.h/2, cause:"screen"}); }
    const OV = obstructedViews(allRecs, F, viewPosts, viewWalls, boardsOn ? {hx: FP.W/2 + offX, hz: FP.H/2 + offZ, h: bH} : null);
    result.restricted = OV.slight + OV.bad; result.obstructed = OV;
    for (const [name, st] of Object.entries(OV.stands)){ const seats = (standInfo[st.key] || {}).seats || 0; if (!seats || st.seats < .05*seats) continue;
      const cause = Object.keys(st.causes).sort((a, b) => st.causes[b] - st.causes[a])[0], fix = viewFix(st.key, cause);
      issue(`${fmt(st.seats)} seats in the ${name.toLowerCase()} (${Math.round(100*st.seats/seats)}%) have a restricted view, mostly ${VIEW_CAUSES[cause]}${st.bad ? `; ${fmt(st.bad)} of them badly` : ""}.`, `obstructed:${st.key}`, "view", {tab:st.key, fix}); } }
  if (DRY) return result;
  if (S.showObstructed) drawObstructed(allRecs, buf);

  if (boardsOn){
    const hx = FP.W/2 + offX, hz = FP.H/2 + offZ, dp = .3; // the boards are boxes about 30 cm deep
    const Pb = [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]], Po = [[-hx-dp,-hz-dp],[hx+dp,-hz-dp],[hx+dp,hz+dp],[-hx-dp,hz+dp]];
    // each side runs corner to corner, with a gap where the players' tunnel comes out
    const runs = (P) => P.flatMap((a, i) => { const b = P[(i+1)%4], dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz), cut = [];
      for (const g of boardGaps){ const t = ((g.x - a[0])*dx + (g.z - a[1])*dz)/(L*L), off = Math.abs((g.x - a[0])*dz - (g.z - a[1])*dx)/L;
        if (t > 0 && t < 1 && off < 6) cut.push([t - g.hw/L, t + g.hw/L]); }
      cut.sort((u, w) => u[0] - w[0]); const out = []; let t0 = 0;
      for (const [u, w] of cut){ if (u > t0) out.push([t0, u]); t0 = Math.max(t0, w); } if (t0 < 1) out.push([t0, 1]);
      return out.map(([u, w]) => [[a[0] + dx*u, a[1] + dz*u], [a[0] + dx*w, a[1] + dz*w]]); });
    for (const [a, b] of runs(Po)){ // plain backs on a frame; the adverts face the play and the TV cameras across it
      quad(buf("dark"), [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], bH + .04, b[1]], [a[0], bH + .04, a[1]]);
      const ia = [a[0] - Math.sign(a[0])*dp, a[1] - Math.sign(a[1])*dp], ib = [b[0] - Math.sign(b[0])*dp, b[1] - Math.sign(b[1])*dp]; // the top of the box
      quad(buf("dark"), [ia[0], bH + .04, ia[1]], [ib[0], bH + .04, ib[1]], [b[0], bH + .04, b[1]], [a[0], bH + .04, a[1]]); }
    adStrip(runs(Pb).map(([a, b]) => ({a:[a[0], 0.04, a[1]], b:[b[0], 0.04, b[1]], h:bH - .04, view:[0, 0]})));
  }
  addProps(group, CV ? CV.F2 : pitchOf(F), buf, CV ? CV.sp : undefined);
  drawSheets();
  for (const key in Bf) if (Bf[key].length){
    const mesh = meshFrom(Bf[key], M[key], !["roof","roofGlass","glass","roofClosed","aisle","void","glassClad","obsSlight","obsBad"].includes(key));
    if (TYPES[key.split("_")[0]] || key === "floorSeat"){ mesh.userData.seat = true; mesh.userData.kind = key.split("_")[0]; }
    mesh.userData.stadium = true;
    group.add(mesh);
  }
  if (window.__gwCheck){ let bad = 0, verts = 0; for (const k in Bf){ const arr = Bf[k]; verts += arr.length/3; for (let i=0;i<arr.length;i++) if (!isFinite(arr[i])) bad++; } result.nan = bad; result.verts = verts; result.nanKeys = Object.keys(Bf).filter(k => Bf[k].some(x => !isFinite(x))); }
  // set up for a second sport, the floor shows its markings, big enough to reach the stands either way
  const {tex, Wt, Ht} = CV ? floorTexture(CV.F2, Math.max(1, (F.W + 2*set - CV.F2.W)/2, (F.H + 2*set - CV.F2.H)/2), CV.sp) : floorTexture(F, set);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(Wt, Ht), new THREE.MeshStandardMaterial({map:tex, roughness:1}));
  floor.rotation.x = -Math.PI/2; floor.position.y = 0.02; floor.receiveShadow = true; group.add(floor);
  if (S.crowd !== false) addCrowd(allRecs, F); else CROWD = null;
  if (!DRY){ if (S.flares && S.crowd !== false) addFlares(allRecs); else SPECTACLE = null; }
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
  if (!DRY && S.halo) addHalo(anchors, buf2);
  if (!DRY && S.statues > 0) addStatues(Math.min(4, S.statues | 0), bounds, poly, buf2);
  const archTop = addArchitecture(F, A, outline, outerTop, poly, standInfo, set, sext, buf2, ext, anchors);
  result.maxH = Math.max(result.maxH, archTop);
  if (window.__gwCheck){ let bad = 0; for (const k in B2) for (const v of B2[k]) if (!isFinite(v)) bad++; group.traverse(o => { const a = o.geometry && o.geometry.attributes && o.geometry.attributes.position; if (a && a.array) for (const v of a.array) if (!isFinite(v)) bad++; }); result.archNan = bad; }
  const fm = floodMode();
  drawScreens(screenPlans, buf2, anchors);
  if (fm === "roof") roofLights(anchors, buf2, F);
  if (fm === "masts" || fm === "pylons"){
    const mh = Math.max(maxH + 16, 30);
    for (const [x, z, sx, sz] of floodMastSpots(F, sext, outline)){ // just behind the stands at each corner (see floodMastSpots)
      if (fm === "pylons") pylon(buf2, x, z, mh);
      else { const mm = new THREE.Mesh(new THREE.CylinderGeometry(.6,1.1,mh,10), M.mast); mm.position.set(x,mh/2,z); mm.castShadow = true; group.add(mm); }
      group.add(lampHead(x, mh + 3, z));
      if (S.night){ const sp = new THREE.SpotLight(0xfff4dc, LUX.flood, 0, 0.75, 0.6, 0); sp.position.set(x, mh+2, z); sp.target.position.set(-sx*F.W*0.15, 0, -sz*F.H*0.15); group.add(sp); group.add(sp.target); }
    }
  }
  // the streets round the ground: laid out last, round everything built (signature architecture and floodlights too), with no shadows to keep it quick
  if (!DRY){ const B3 = {}, keep = ext.slice(); if (fm === "masts" || fm === "pylons") for (const [x, z] of floodMastSpots(F, sext, outline)){ keep[0] = Math.max(keep[0], Math.abs(x) + 4); keep[1] = Math.max(keep[1], Math.abs(z) + 4); }
    drawNeighbourhood(poly, keep, site, k => (B3[k] = B3[k] || []));
    for (const key in B3) if (B3[key].length){ const mesh = meshFrom(B3[key], M[key], false); mesh.receiveShadow = false; mesh.userData.stadium = true; group.add(mesh); } }
  for (const key in B2) if (B2[key].length){ const mesh = meshFrom(B2[key], M[key], !["glass","roofGlass"].includes(key)); mesh.userData.stadium = true; group.add(mesh); }
  // drag handles for the selected stand
  if (handles.length){ const r = Math.max(0.9, Math.max(...sext)*0.012);
    for (const h of handles){ const s2 = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M.hball); s2.position.set(h.x, h.y, h.z); s2.userData.handle = h; s2.renderOrder = 5; group.add(s2); } }
  if (S.night && (fm === "none" || closedAt)){ // arena rig or roof-mounted lights over the play
    const pl = new THREE.PointLight(0xfff4dc, LUX.arena, 0, 0); pl.position.set(0, Math.max(18, (closedAt || maxH) - 2), 0); group.add(pl);
    const pl2 = new THREE.PointLight(0xfff0d8, LUX.arenaHigh, 0, 0); pl2.position.set(0, Math.max(30, maxH + 10), 0); group.add(pl2); }
  applyMood();
  const sc = sun.shadow.camera, half = Math.max(ext[0],ext[1]) + 30;
  sc.left=-half; sc.right=half; sc.top=half; sc.bottom=-half; sc.near=10; sc.far=1400; sc.updateProjectionMatrix();
  const screenSpots = []; for (const p of screenPlans) screenSpots[p.idx] = [p.x, p.y, p.z];
  LAST = Object.assign(result, {closedAt, focusIn, F, farName, ext, sext, parts, set, steepInfo, cutInfo, poly, lay, standInfo, handles, screenSpots,
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
