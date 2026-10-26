/* ================= readout ================= */
const esc = s => String(s).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const CATS = {rules:["Rule breaks","Your chosen rule set says no."], view:["Viewing issues","Fans would struggle to see."], geo:["Geometry notes","Odd or ambitious shapes. Build them if you like."]};
const openBd = new Set();
function mergeParts(parts){
  const merged = [];
  for (const p of parts){ const ex = merged.find(q => q.label === p.label);
    if (!ex){ merged.push(Object.assign({}, p, {tiers:(p.tiers || []).map(t => Object.assign({}, t))})); continue; }
    ex.seats += p.seats;
    for (const t of p.tiers || []){ const et = ex.tiers.find(x => x.name === t.name && x.type === t.type);
      if (et){ et.seats += t.seats; et.rows = Math.max(et.rows, t.rows); et.steep = Math.max(et.steep, t.steep); et.evac = Math.max(et.evac, t.evac); et.emerg = Math.max(et.emerg || 0, t.emerg || 0); if (t.c != null) et.c = et.c == null ? t.c : Math.min(et.c, t.c); }
      else ex.tiers.push(Object.assign({}, t)); } }
  return merged;
}
function tierTable(tiers, total){
  if (!tiers || !tiers.length) return "";
  const L = S.limits;
  return `<table class="tiers"><thead><tr><th>Tier</th><th>Seating</th><th>Rows</th><th>Places</th><th>Share</th><th>Steepest</th><th>Sightline</th><th>Empties</th><th>Emergency</th></tr></thead><tbody>${
    tiers.map(t => `<tr${t.bad ? ' class="bad"' : ""}><td>${esc(t.name)}</td><td>${TYPES[t.type].short}</td><td>${t.rows}</td><td>${fmt(t.seats)}</td><td>${total ? Math.round(100*t.seats/total) : 0}%</td><td>${t.steep ? Math.round(t.steep) + "°" : "flat"}</td><td>${t.c == null ? "–" : `<span class="${t.c < L.minC ? "lo" : ""}">${t.c} mm</span>`}</td><td>${t.evac ? `<span class="${t.evac > L.maxEvac ? "lo" : ""}">${t.evac.toFixed(1)} min</span>` : "–"}</td><td>${t.emerg ? `<span class="${t.emerg > (L["evac" + cap1(t.risk)] || 8) ? "lo" : ""}" title="${t.risk} fire risk">${t.emerg.toFixed(1)} min</span>` : "–"}</td></tr>`).join("")}</tbody></table>`;
}
document.getElementById("breakdown").addEventListener("toggle", e => { const d = e.target; if (d.dataset && d.dataset.bd){ if (d.open) openBd.add(d.dataset.bd); else openBd.delete(d.dataset.bd); } }, true);
/* Real grounds to compare against, so a number like 41,000 means something. Capacities are rounded. */
const LIKE = [[100000,"the Melbourne Cricket Ground"],[90000,"Wembley"],[82000,"Twickenham"],[74000,"Old Trafford"],[62000,"Tottenham Hotspur Stadium"],
  [52000,"St James' Park"],[42000,"Villa Park"],[29000,"Craven Cottage"],[11000,"the Vitality Stadium"],[3000,"a non-league ground"]];
function likeText(n){
  if (n < 500) return "";
  const best = LIKE.reduce((a, b) => Math.abs(Math.log(b[0]/n)) < Math.abs(Math.log(a[0]/n)) ? b : a);
  const r = n/best[0];
  const how = r > 1.12 ? `${Math.round((r-1)*100)}% bigger than` : r < 0.88 ? `${Math.round((1-r)*100)}% smaller than` : "about the size of";
  return `${how[0].toUpperCase() + how.slice(1)} ${best[1]} (≈${fmt(best[0])}).`;
}
/* Count the capacity up or down to its new value rather than jumping. */
function countTo(el, to){
  const from = el._v == null ? to : el._v; el._v = to;
  cancelAnimationFrame(el._raf);
  if (reduce || from === to){ el.textContent = fmt(to); return; }
  el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  const t0 = performance.now(), dur = Math.min(700, 250 + Math.abs(to - from)/60);
  const step = now => { const k = Math.min(1, (now - t0)/dur), e = 1 - Math.pow(1-k, 3); el.textContent = fmt(Math.round(from + (to - from)*e)); if (k < 1) el._raf = requestAnimationFrame(step); };
  el._raf = requestAnimationFrame(step);
}
let wasHard = null, quiet = true;
function renderStats(){
  const D = LAST, L = S.limits; if (!D) return;
  countTo(document.getElementById("cap"), D.total);
  $("like").textContent = likeText(D.total);
  const mix = Object.entries(D.byType).filter(([,v]) => v > 0).map(([k,v]) => `${fmt(v)} ${TYPES[k].short}`);
  document.getElementById("mix").textContent = mix.length > 1 ? mix.join(" · ") : "";
  const cMM = isFinite(D.minC) ? Math.round(D.minC*1000) : null;
  const pill = (ok, good, bad) => `<span class="pill ${ok ? "good" : "bad"}">${ok ? good : bad}</span>`;
  const roofPct = D.total ? Math.min(100, Math.round(100*D.covered/D.total)) : 0;
  const rPct = D.total ? D.restricted/D.total*100 : 0;
  const items = [
    ["Floor", `${+D.F.W.toFixed(1)} × ${+D.F.H.toFixed(1)} m`, ""],
    ["Tallest point", fmt(D.maxH)+" m", ""],
    ["Footprint", `${fmt(D.bounds[1]-D.bounds[0])} × ${fmt(D.bounds[3]-D.bounds[2])} m`, ""],
    ["Under cover", roofPct+"%", ""],
    ["Worst sightline", cMM===null ? "n/a" : cMM+" mm", cMM===null ? "" : pill(cMM >= L.minC, "ok", "low")],
    ["Furthest fan to " + D.farName, fmt(D.far)+" m", pill(D.far <= L.maxView, "ok", "far")],
    ["Slowest stand to empty", D.slowest ? D.slowest.toFixed(1) + " min" : "n/a", D.slowest ? pill(D.slowest <= L.maxEvac, "ok", "slow") : ""],
    ...(D.awayAlloc && D.awayAlloc.seats ? [["Away allocation", `${fmt(D.awayAlloc.seats)} (${(100*D.awayAlloc.seats/Math.max(1, D.total)).toFixed(1)}%)`, ""]] : []),
    ["Slowest emergency evacuation", D.slowestEm ? D.slowestEm.toFixed(1) + " min" : "n/a", D.slowestEm ? pill(!D.issues.some(i => /^emerg:/.test(i.key)), "ok", "slow") : ""]
  ];
  if (D.restricted) items.push(["Restricted view", `${fmt(D.restricted)} seats` + (D.obstructed && D.obstructed.bad ? ` (${fmt(D.obstructed.bad)} badly)` : ""), `<span class="pill ${rPct > 5 ? "bad" : "warn"}">${rPct.toFixed(1)}%</span>`]);
  document.getElementById("metrics").innerHTML = items.map(([k,v,p]) => `<div class="metric"><div class="k">${k}</div><div class="v">${v}${p}</div></div>`).join("");
  const sf = document.getElementById("safety"), std = S.standard === "custom" ? "your own rules" : (S.standard === "minimum" ? "UK guidance minimums" : "UK recommended guidance");
  const fixable = D.issues.filter(i => i.fix).length;
  const counts = Object.keys(CATS).map(c => [c, D.issues.filter(i => i.cat === c).length]);
  const head = `<div class="checks-h"><h3>Checks</h3>${counts.map(([c,n]) => `<span class="pill ${n ? (c === "geo" ? "warn" : "bad") : "good"}">${n} ${CATS[c][0].toLowerCase()}</span>`).join("")}
    ${fixable ? `<button class="fixall" data-fixall="1">Fix ${fixable > 1 ? "all " + fixable : "it"} for me</button>` : ""}</div>
    ${D.issues.some(i => i.alts && i.alts.length) ? `<label class="toggle small"><input type="checkbox" id="keepClose"${S.keepClose !== false ? " checked" : ""}> When fixing views, keep seats close (steeper tiers) rather than moving them back</label>` : ""}`;
  const groups = counts.filter(([,n]) => n).map(([c]) => `<details class="cgroup" ${c !== "geo" ? "open" : ""}><summary>${CATS[c][0]} <small>${CATS[c][1]}</small></summary><ul>${
    D.issues.map((i,n) => i.cat !== c ? "" : `<li><span>${esc(i.text)}</span><span class="acts">
      ${i.fix ? `<button data-fix="${n}">${esc(i.fix.label)}</button>` : ""}${(i.alts || []).map((a,k) => `<button class="alt" data-fix="${n}" data-alt="${k}">${esc(a.label)}</button>`).join("")}
      ${i.tab ? `<button class="ghost" data-show="${n}">Show me</button>` : ""}</span></li>`).join("")}</ul></details>`).join("");
  sf.className = "safety" + (D.issues.some(i => i.cat !== "geo") ? " has" : "");
  sf.innerHTML = head + (D.issues.length ? groups : `<p class="ok">Nothing to report against ${std}.</p>`) +
    `<label class="toggle small"><input type="checkbox" id="trimToggle"${S.trim ? " checked" : ""}> Mark problem tiers in red in the 3D view</label>
     <label class="toggle small"><input type="checkbox" id="obsToggle"${S.showObstructed ? " checked" : ""}> Show obstructed views (amber: part of the pitch is hidden, red: a lot of it)</label>
     <p class="disclaimer">Groundworks is a creative sandbox. Passing these checks doesn't mean a design is safe, legal or buildable; real stadiums need professional design and approval.</p>`;
  const merged = mergeParts(D.parts);
  const max = Math.max(1, ...merged.map(p => p.seats));
  document.getElementById("breakdown").innerHTML = obstructedBreakdown(D) + (merged.length ? `<h3 class="bd-h">Capacity by stand and tier</h3>` + merged.map(p =>
    `<details class="bd"${openBd.has(p.label) ? " open" : ""} data-bd="${esc(p.label)}"><summary><span>${esc(p.label)}</span><span>${fmt(p.seats)}</span><small>${esc(p.kinds)}</small><i><b style="width:${(100*p.seats/max).toFixed(1)}%"></b></i></summary>${tierTable(p.tiers, p.seats)}</details>`).join("")
    : '<p class="hint">No stands yet. Give at least one stand a tier to start seating fans.</p>');
  renderArchitect(D); renderSummary(); updateHud();
}
/* Restricted views, stand by stand and by what's in the way, each with a "Show me" that turns the colours on and looks at them. */
function obstructedBreakdown(D){
  const O = D.obstructed; if (!O || !D.restricted) return "";
  const rows = Object.entries(O.stands).sort((a, b) => b[1].seats - a[1].seats).map(([name, st]) => {
    const causes = Object.entries(st.causes).sort((a, b) => b[1] - a[1]).map(([c, n]) =>
      `<li><span>${fmt(Math.round(n))} ${VIEW_CAUSES[c]}</span><button class="ghost" data-obs="${esc(name)}|${c}">Show me</button></li>`).join("");
    return `<div class="obs-st"><b>${esc(name)}</b> <span>${fmt(st.seats)} seats${st.bad ? `, ${fmt(st.bad)} badly` : ""}</span><ul>${causes}</ul></div>`; }).join("");
  return `<details class="bd obs"${openBd.has("obs") ? " open" : ""} data-bd="obs"><summary><span>Restricted views</span><span>${fmt(D.restricted)}</span><small>Seats where something hides part of the play, by stand and by what's in the way</small></summary>${rows}</details>`;
}
document.getElementById("breakdown").addEventListener("click", e => {
  const b = e.target.closest("[data-obs]"); if (!b || !LAST || !LAST.obstructed) return;
  const [name, cause] = b.dataset.obs.split("|"), st = LAST.obstructed.stands[name], at = st && st.spots[cause]; if (!at) return;
  if (!S.showObstructed){ S.showObstructed = true; changed(); }
  showObstructedAt(at);
});
/* ================= architect's notes =================
   How the design works as a building, rather than whether it passes the rules: atmosphere, views, comfort, looks and
   getting people in and out, each scored out of 10, with notes in plain words and a one-tap change where one helps. */
const ARCH_ACTS = {
  align:() => { S.roofAlign = true; },
  closer:() => { S.setback = Math.max(hardStop(), Math.min(S.setback, 8)); for (const k of SIDES) if (S.stands[k].dist != null) S.stands[k].dist = null; },
  corners:() => { showPane("stands"); tab = "C"; renderEditor(); return "nochange"; },
  roofs:() => { for (const cfg of [S.bowl, ...SIDES.map(k => S.stands[k])]) if (cfg.tiers.length && cfg.roof.shape === "none") cfg.roof = Object.assign(R("slope"), {mat:"metal", reach:1.5}); },
  exits:() => { S.design.exitEvery = Math.max(8, S.design.exitEvery - 4); },
  boxes:() => { showPane("stands"); return "nochange"; },
  access:() => { S.access = Object.assign(accessOf(), {on:true}); },
  vehicle:() => { const opts = tdSides(); S.vehicle = Object.assign(vehicleOf(), {on:true, at: opts.some(o => o[0] === "W") ? "W" : (opts[0] || ["N"])[0]}); },
  name:() => { showPane("look"); setTimeout(() => $("spTitle").focus(), 50); return "nochange"; }
};
function architectNotes(D){
  const notes = [], sc = {}, L = S.limits, lay = D.lay || layoutOf(), A = (D.screenCtx && D.screenCtx.anchors) || [];
  const note = (tone, text, act, label) => notes.push({tone, text, act, label});
  const clamp10 = v => Math.max(0, Math.min(10, v));
  if (!D.total){ return {notes:[{tone:"tip", text:"Nothing built yet. Give a stand a tier and I'll start taking notes."}], sc:null}; }
  // how enclosed the ground is: the corners, and how much of the way round has stands
  let corners = 4;
  if (lay === "bowl" || lay === "hybrid") corners = CORNERS.filter(c => !(S.bowl.removed && S.bowl.removed[c.key])).length;
  else if (lay === "ring") corners = (S.ring && S.ring.gap > 10) ? 1 : (S.ring && S.ring.gap > 5) ? 2 : 4;
  else corners = CORNERS.filter(c => { const P = cornerPlan(c); return !P.gap || P.stand; }).length;
  const near = D.set, cover = D.covered/D.total, steep = Math.max(0, ...D.parts.flatMap(p => p.tiers.map(t => t.steep || 0)));
  // atmosphere: close, steep, enclosed and roofed grounds are loud
  sc.atmosphere = clamp10(10 - Math.max(0, near - 6)*0.35 - (4 - corners)*0.9 - (1 - cover)*3 + (steep > 30 ? 0.5 : 0));
  if (near <= 8) note("good", `The stands are ${Math.round(near)} m from the play. Fans are right on top of the action, which makes for a loud ground.`);
  else if (near > 14) note("tip", `The stands sit ${Math.round(near)} m back from the play. It feels distant and the noise drifts away. Bring them closer if the sport allows it.`, "closer", "Bring them in");
  if (corners <= 1) note("tip", `${4 - corners} of the 4 corners are open. Noise, wind and rain get in there. Filling them makes the ground feel complete.`, lay === "stands" ? "corners" : null, "Go to the corners");
  else if (corners === 4) note("good", "All four corners are closed, so the ground holds its noise in.");
  // views
  const cMM = isFinite(D.minC) ? D.minC*1000 : 120, rPct = 100*D.restricted/D.total, O = D.obstructed;
  const rW = O ? 100*(O.bad + 0.4*O.slight)/D.total : rPct; // badly restricted seats count in full, slightly restricted ones less
  sc.views = clamp10(10 - Math.min(4, Math.max(0, 90 - cMM)*0.03) - Math.min(3, Math.max(0, D.far - 150)*0.08) - Math.min(3, rW*0.4));
  if (D.far <= 150) note("good", `Every fan is within ${Math.round(D.far)} m of the far corner of the play. Even the back row gets a decent view.`);
  else if (D.far > 175) note("tip", `The furthest fan is ${Math.round(D.far)} m from the ${D.farName || "play"}. Faces become dots past about 150 m. Fewer rows up top, or steeper tiers, would help.`);
  if (cMM < L.minC) note("warn", `Some fans can't see over the heads in front (${Math.round(cMM)} mm against the ${L.minC} mm needed). The checks below have fixes.`);
  if (rPct > 2){ const tally = {}; if (O) for (const st of Object.values(O.stands)) for (const c in st.causes) tally[c] = (tally[c] || 0) + st.causes[c];
    const top = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    note("warn", `${rPct.toFixed(1)}% of seats have a restricted view${top ? ", mostly " + VIEW_CAUSES[top] : ""}. The checks below say where, and how to clear them.`); }
  // comfort: shelter from the weather
  sc.comfort = clamp10(cover*10);
  if (cover < 0.5) note("tip", `Only ${Math.round(cover*100)}% of fans are under a roof. On a wet night the rest will notice.`, "roofs", "Roof the open stands");
  else if (cover > 0.95) note("good", "Almost everyone is under cover.");
  // looks: a tidy roofline, a coherent or deliberately mixed set of styles, dressed walls, a name
  const tops = A.map(a => Math.max(0, ...(a.RR || []).filter(Boolean).map(r => r.y(0)))).filter(h => h > 0);
  const styles = new Set([S.bowl, ...SIDES.map(k => S.stands[k])].filter(c => c && c.tiers.length).map(c => c.style));
  let looks = 7;
  if (tops.length >= 2){ const hi = Math.max(...tops), lo = Math.min(...tops), ratio = hi/Math.max(1, lo);
    if (ratio > 2.2 && !S.roofAlign){ looks -= 2; note("tip", `The tallest roof is ${Math.round(hi)} m and the lowest ${Math.round(lo)} m, so the roofline is lopsided. That can be a statement, like Old Trafford's old main stand; to tidy it up, line the roofs up.`, "align", "Line up the roofs"); }
    else if (ratio < 1.25){ looks += 1.5; note("good", "The roofline is nice and even all the way round."); } }
  if (styles.size >= 4){ looks -= 0.5; note("tip", `${styles.size} different stand styles. It reads like a ground that grew over a century: charming, but not one design.`); }
  else if (styles.size === 1 && D.total > 20000) { looks += 1; note("good", "One style all the way round gives the ground a single, confident look."); }
  const AR = S.arch || {}; if (AR.arch || (AR.skin && AR.skin !== "none") || AR.towers || AR.ramps){ looks += 1.5; note("good", "The signature architecture gives it a skyline you'd recognise from a distance."); }
  if (!sponsorsOf().title && D.total > 15000) note("tip", "A ground this size deserves a name. Naming rights are a big earner too.", "name", "Name it");
  sc.looks = clamp10(looks);
  // getting in and out
  const em = D.issues.some(i => /^emerg:/.test(i.key)), evac = D.slowest || 0;
  sc.access = clamp10(10 - Math.max(0, evac - 4)*1.2 - (em ? 3 : 0) - D.issues.filter(i => i.cat === "rules").length*0.8);
  if (evac > L.maxEvac*0.85 && evac <= L.maxEvac) note("tip", `The slowest stand takes ${evac.toFixed(1)} minutes to empty, close to the ${L.maxEvac}-minute limit. A few more exits would give some slack.`, "exits", "Add exits");
  else if (evac && evac < 5) note("good", `Everyone's out within ${evac.toFixed(1)} minutes. Plenty of exits.`);
  // wheelchair spaces and a way in for emergency vehicles
  const need = wheelchairNeed(D.total), AC = accessOf();
  if (!AC.on) note("tip", `No wheelchair spaces yet. A ground this size should have about ${need}. Switch them on under Rules.`, "access", "Add wheelchair spaces");
  else if ((D.wheelchair || 0) >= need) note("good", `${D.wheelchair} wheelchair spaces, spread round the ground. That meets the guidance.`);
  if (!vehicleOf().on && (lay === "bowl" || lay === "hybrid" || corners === 4)) note("warn", "There's no way for an ambulance or fire engine to drive onto the pitch. Add an emergency vehicle entrance through one of the stands.", "vehicle", "Add one");
  // facilities, stand by stand
  const fac = standCfgs().map(c => facilitiesOf(c)), basic = fac.filter(f => f === "basic").length, prem = fac.filter(f => f === "premium").length;
  if (basic) note("tip", `${basic === fac.length ? "Every stand has" : basic + " stand" + (basic > 1 ? "s have" : " has")} basic facilities. Expect long queues for the toilets and the tea bar at half time.`);
  if (prem) note("good", `${prem === fac.length ? "Every stand has" : prem + " stand" + (prem > 1 ? "s have" : " has")} premium facilities: lounges and restaurants that earn money on non-match days too.`);
  sc.comfort = clamp10(sc.comfort*0.75 + 2.5*(fac.length ? fac.reduce((a, f) => a + (f === "basic" ? 0.3 : f === "premium" ? 1.2 : 0.8), 0)/fac.length : 0.8));
  // the ends: a home end behind a goal makes the noise; an away end needs room and keeping apart
  const HE = homeEndOf(), AW = awayOf(), AL = D.awayAlloc || {seats:0};
  if (HE.at){ const p = D.parts.find(x => x.key === HE.at), terr = p && p.tiers.some(t => t.type === "terrace" || t.type === "rail");
    note("good", `${HE.name ? HE.name.charAt(0) + HE.name.slice(1).toLowerCase() : "The home end"} is a sea of the club's colours${terr ? ", and standing there makes it louder still" : ""}.`); }
  if (AW.on && AL.seats){ const share = AL.seats/D.total;
    if (share < 0.03) note("tip", `The away end holds ${fmt(AL.seats)}, under 3% of the ground. Visiting fans will feel squeezed.`);
    if (!AW.gap) note("warn", "There's no gap between home and away fans. Leave a few empty seats to keep them apart."); }
  // money: hospitality
  const boxShare = (D.byType.exec || 0)/D.total;
  if (D.total > 25000 && boxShare < 0.01) note("tip", "No executive boxes. At a ground this size, hospitality pays a lot of the bills. Try a ring of boxes between two tiers.", "boxes", "Go to stands");
  if (!AC.on || (D.wheelchair || 0) < need) sc.access = clamp10(sc.access - 1.5);
  const overall = (sc.atmosphere + sc.views + sc.comfort + sc.looks + sc.access)/5;
  return {notes, sc, overall};
}
/* A very rough idea of what it would cost to build, from typical costs per place for each kind of seating, more for each
   tier stacked higher, plus roofs and the big architectural extras. Only good for comparing designs. */
/* Every stand's own settings, whatever the layout. */
const standCfgs = () => isRing() ? ringOf().stands.filter(r => r.tiers.length) : [...(isBowl() || isHybrid() ? [S.bowl] : []), ...(isBowl() ? [] : SIDES.map(k => S.stands[k]).filter(c => c.tiers.length))];
const cfgOfKey = k => k === "B" ? S.bowl : /^R\d+$/.test(k) ? ringOf().stands[+k.slice(1)] : S.stands[k];
function buildCost(D){
  const per = {seated:3800, exec:14000, rail:3300, bench:2400, terrace:1400}, facMul = {basic:.85, good:1, premium:1.35};
  let c = 0; for (const p of D.parts) for (const t of p.tiers) c += t.seats * (per[t.type] || 3000) * (1 + Math.max(0, (t.height || 0) - 12)/60) * (facMul[facilitiesOf(cfgOfKey(p.key))] || 1);
  c += D.covered * 1700;
  const AR = S.arch || {}; if (AR.arch) c += 45e6; if (AR.skin && AR.skin !== "none") c += D.total*450; if (AR.towers) c += 8e6; if (AR.ramps) c += 6e6;
  if (S.groundRoof && S.groundRoof.on && S.groundRoof.cover === "closed") c += 120e6;
  return c;
}
function renderArchitect(D){
  const el = $("architect"); if (!el) return;
  const {notes, sc, overall} = architectNotes(D);
  const verdict = overall == null ? "" : overall >= 8.5 ? "A classic in the making." : overall >= 7 ? "A strong design." : overall >= 5.5 ? "Solid, with some work to do." : "Worth a rethink.";
  const cost = D.total ? buildCost(D) : 0, money = v => v >= 1e9 ? "£" + (v/1e9).toFixed(1) + "bn" : "£" + Math.round(v/1e6) + "m";
  el.innerHTML = `<h3>Architect's notes ${sc ? `<span class="grade">${overall.toFixed(1)}</span><small>out of 10</small>` : ""}</h3>
    ${sc ? `<p class="verdict">${verdict}</p><div class="scores">${[["Atmosphere","atmosphere"],["Views","views"],["Shelter","comfort"],["Looks","looks"],["In and out","access"]].map(([l,k]) =>
      `<div class="score"><span>${l}</span>${sc[k].toFixed(1)}<i><b style="width:${sc[k]*10}%"></b></i></div>`).join("")}</div>` : ""}
    <ul>${notes.map((n, i) => `<li class="t-${n.tone}"><span>${esc(n.text)}</span>${n.act ? `<button data-arch="${n.act}">${esc(n.label)}</button>` : ""}</li>`).join("")}</ul>
    ${cost ? `<p class="cost">Rough build cost: <b>${money(cost)}</b>, about £${fmt(cost/D.total)} a place. A ballpark figure for comparing designs, not a quote.</p>` : ""}`;
}
document.getElementById("architect").addEventListener("click", e => { const b = e.target.closest("[data-arch]"); if (!b || !ARCH_ACTS[b.dataset.arch]) return;
  const r = ARCH_ACTS[b.dataset.arch](); if (r === "nochange") return; renderEditor(); changed(); flash("<b>Done.</b> Undo if you liked it better before.", UNDO); });
document.getElementById("safety").addEventListener("click", e => {
  const fb = e.target.closest("[data-fix]"), sb = e.target.closest("[data-show]"), fa = e.target.closest("[data-fixall]");
  if (fb){ const is = LAST.issues[+fb.dataset.fix]; runFix(fb.dataset.alt != null ? {fix:is.alts[+fb.dataset.alt]} : is); }
  else if (sb) showIssue(LAST.issues[+sb.dataset.show]);
  else if (fa) fixAll();
});
document.getElementById("safety").addEventListener("change", e => { if (e.target.id === "trimToggle"){ S.trim = e.target.checked; changed(); } if (e.target.id === "keepClose"){ S.keepClose = e.target.checked; changed(); } if (e.target.id === "obsToggle"){ S.showObstructed = e.target.checked; changed(); } });
/* Pop-up messages. An optional action (usually Undo) gives a one-tap way back. */
function toast(msg, action, ms){
  const box = $("toasts"), el = document.createElement("div");
  el.className = "toast"; el.innerHTML = `<span>${msg}</span>`;
  if (action){ const b = document.createElement("button"); b.textContent = action.label; b.addEventListener("click", () => { action.run(); close(); }); el.appendChild(b); }
  function close(){ if (!el.isConnected || el.classList.contains("out")) return; el.classList.add("out"); setTimeout(() => el.remove(), reduce ? 0 : 260); }
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(el); setTimeout(close, ms || (action ? 7000 : 4500));
  return el;
}
window.gwToast = msg => toast(msg);
const UNDO = {label:"Undo", run:() => restore(hIdx - 1)};
function flash(msg, action){ toast(msg, action === undefined && /Undo/.test(msg) ? UNDO : action); }
function runFix(is){
  if (!is || !is.fix) return;
  const label = is.fix.label, ok = is.fix.run();
  renderTypeSizes(); renderEditor(); changed();
  flash(ok ? `<b>Fixed:</b> ${esc(label.charAt(0).toLowerCase() + label.slice(1))}.` : `<b>That one needs a bigger change</b> than I can make safely. Use Show me to go to its settings.`, ok ? UNDO : null);
}
function fixAll(){
  const rk0 = {seatRake:S.limits.seatRake, terraceRake:S.limits.terraceRake};
  const done = new Set(); let fixed = 0, tries = 0;
  while (tries++ < 24){
    const list = dryIssues().filter(i => i.fix && !done.has(i.key + "|" + i.fix.label));
    if (!list.length) break;
    const is = list[0]; done.add(is.key + "|" + is.fix.label);
    if (is.fix.run()) fixed++; // each fix already works through every way of clearing its check, in the preferred order
  }
  renderTypeSizes(); renderEditor(); changed();
  const left = dryIssues().filter(i => i.cat !== "geo").length;
  const ruled = S.standard === "custom" && (S.limits.seatRake > rk0.seatRake || S.limits.terraceRake > rk0.terraceRake);
  flash(`<b>Fixed ${fixed} ${fixed === 1 ? "thing" : "things"}.</b>` + (ruled ? ` Your rules now allow ${[S.limits.seatRake > rk0.seatRake ? S.limits.seatRake + "° seating" : "", S.limits.terraceRake > rk0.terraceRake ? S.limits.terraceRake + "° terraces" : ""].filter(Boolean).join(" and ")}.` : "") + (left ? ` ${left} still ${left === 1 ? "needs" : "need"} a decision from you.` : ""), fixed ? UNDO : null);
}
/* ================= panes: one section of controls at a time, so the 3D view stays in sight ================= */
let pane = "start";
try { pane = localStorage.getItem("groundworks-pane") || "start"; } catch(e) {}
function showPane(name, keepScroll){
  if (!document.querySelector(`#panes [data-pane="${name}"]`)) name = "start";
  pane = name;
  document.querySelectorAll("#panes [data-pane]").forEach(b => { b.setAttribute("aria-selected", String(b.dataset.pane === name)); b.tabIndex = b.dataset.pane === name ? 0 : -1; });
  document.querySelectorAll("#panebody > [data-pane]").forEach(el => el.classList.toggle("on", el.dataset.pane === name));
  if (!keepScroll) $("panebody").scrollTop = 0;
  try { localStorage.setItem("groundworks-pane", name); } catch(e) {}
}
document.getElementById("panes").addEventListener("click", e => { const b = e.target.closest("[data-pane]"); if (b) showPane(b.dataset.pane); });
document.getElementById("panes").addEventListener("keydown", e => {
  const tabs = [...document.querySelectorAll("#panes [data-pane]")], i = tabs.indexOf(document.activeElement); if (i < 0) return;
  const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
  if (j < 0) return; e.preventDefault(); tabs[j].focus(); showPane(tabs[j].dataset.pane);
});
document.getElementById("hud").addEventListener("click", () => showPane("results"));
function updateHud(){
  if (!LAST) return;
  countTo($("hudCap"), LAST.total);
  const hard = LAST.issues.filter(i => i.cat !== "geo").length, geo = LAST.issues.length - hard;
  if (wasHard && !hard && !quiet) toast("✅ <b>Every check passes.</b> Fans can see the play and get out in time.");
  wasHard = hard; quiet = false;
  $("hudChecks").innerHTML = hard ? `places · <span class="pill bad">${hard} to fix</span>` : `places · <span class="pill good">checks ok</span>`;
  const bd = $("paneBadge"); bd.hidden = !(hard || geo); bd.textContent = hard || geo; bd.classList.toggle("geo", !hard);
}
function showIssue(is){
  if (!is || !is.tab) return;
  selectTab(is.tab, true);
  requestAnimationFrame(() => {
    const el = is.k !== undefined ? document.querySelector(`#editor .tier[data-k="${is.k}"]`) : document.getElementById("editor");
    if (!el) return;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    el.scrollIntoView({block:"nearest", behavior: reduce ? "auto" : "smooth"});
  });
}

