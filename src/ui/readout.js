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
/* Stands on a lower bowl: each side's stand counts the part of the bowl in front of it (with the bowl's tiers listed in
   its table at that side's share), instead of the lower bowl showing as a stand of its own. */
function foldBowlIntoSides(merged, sides){
  const bowl = merged.find(p => p.key === "B"); if (!sides || !bowl) return merged;
  const out = merged.filter(p => p !== bowl), total = Object.values(sides).reduce((a, b) => a + b, 0) || 1;
  for (const [k, n] of Object.entries(sides)){ if (!(n > 0)) continue; const share = n/total; let st = out.find(p => p.key === k);
    if (!st){ st = {label: SIDE_NAMES[k], key: k, seats: 0, kinds: "", tiers: []}; out.push(st); }
    st.seats += Math.round(n); st.bowlSeats = Math.round(n);
    st.tiers = [...(bowl.tiers || []).map(t => Object.assign({}, t, {name: "Lower bowl: " + t.name.charAt(0).toLowerCase() + t.name.slice(1), seats: Math.round(t.seats*share)})), ...st.tiers]; }
  return out;
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
  const merged = foldBowlIntoSides(mergeParts(D.parts), D.bowlSides);
  const max = Math.max(1, ...merged.map(p => p.seats));
  document.getElementById("standSeats").innerHTML = merged.length ? `<h3 class="bd-h">Places by stand</h3>` + merged.map(p =>
    `<div class="bd"><div class="bd-row"><span>${esc(p.label)}</span><span>${fmt(p.seats)}</span>${p.bowlSeats ? `<small>including ${fmt(p.bowlSeats)} in the lower bowl in front</small>` : ""}<i><b style="width:${(100*p.seats/max).toFixed(1)}%"></b></i></div></div>`).join("") : "";
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
/* The critic's phrasebook: the same design always gets the same words, but different designs (and different stands in one
   design) get different ones. */
const criticSay = seed => (list, salt) => { let h = (seed ^ 2166136261) >>> 0; for (const ch of String(salt)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return list[(h >>> 0) % list.length]; };
const pctOf = v => Math.round(100*v) + "%";
/* One stand, judged on its own: what sort of stand it is and how it sits with the others, its views, its materials and
   its plot. Returns null for anything that isn't a stand of its own (corners, floor seats). */
function standCritique(p, cx){
  const cfg = cfgOfKey(p.key), si = cx.D.standInfo && cx.D.standInfo[p.key]; if (!cfg || !si || !p.seats) return null;
  const say = (list, salt) => { const k0 = list.indexOf(cx.say(list, p.label + salt)); // each stand in a ground gets its own way of putting it
    for (let q=0;q<list.length;q++){ const k = (k0 + q) % list.length; if (!cx.used.has(salt + k)){ cx.used.add(salt + k); return list[k]; } } return list[k0]; }, sty = STYLES[cfg.style] || {}, era = sty.era || "Modern", n = p.tiers.length;
  const h = si.height, w = si.width || 1, ob = cx.O && cx.O.stands[p.label], obPct = ob ? ob.seats/p.seats : 0;
  const look = (cfg.facade && cfg.facade.look) || sty.look || "plain", open = !cfg.roof || cfg.roof.shape === "none";
  const terr = p.tiers.some(t => t.type === "terrace" || t.type === "rail"), steep = Math.max(0, ...p.tiers.map(t => t.steep || 0)), shallow = p.tiers.some(t => t.bad);
  const rows = Math.max(0, ...p.tiers.map(t => t.rows || 0)), squeezed = ((cx.D.cutInfo || {})[p.key] || []).some(c => c && c.want > c.fit + .5);
  const bits = []; let tone = "good", score = 0;
  // what sort of stand it is
  if (cx.count > 1 && h > cx.mean*1.4){ score += 1; bits.push(say([`the big beast of the ground at ${Math.round(h)} m tall`, `towers over everything else here at ${Math.round(h)} m`, `the one that'll be on the postcards: ${Math.round(h)} m of it`], "big")); }
  else if (cx.count > 1 && h < cx.mean*.6){ score -= .5; bits.push(say(["looks like it wandered in from a smaller ground", "keeps its head down next to its neighbours", `the runt of the litter at ${Math.round(h)} m`], "small")); }
  else if (n >= 3){ score += .5; const nw = ["three", "four", "five", "six"][n - 3] || n;
    bits.push(say([`${nw} tiers stacked up, like the Sir Alex Ferguson Stand at Old Trafford`, `a proper ${nw}-tier stack in the manner of Anfield's Main Stand`, `${nw} tiers deep, so the top rows feel a long way up`], "tiers")); }
  else if (terr && n === 1 && rows >= 35){ score += 1; bits.push(say(["one great wall of standing fans, Yellow Wall style", "a single sweep of terrace the Kop would be proud of"], "kop")); }
  else if (w/Math.max(1, h) > 9) bits.push(say([`long and low, ${Math.round(w)} m by ${Math.round(h)} m`, `stretched out: ${Math.round(w)} m long and only ${Math.round(h)} m high`], "long"));
  else bits.push(say(["a tidy, honest stand that does its job", `well proportioned at ${Math.round(w)} m long and ${Math.round(h)} m high`, `no fuss: ${fmt(p.seats)} places, sensibly arranged`,
    "workmanlike, in the best sense", `a solid ${fmt(p.seats)}-seater with nothing to apologise for`], "plain"));
  // its views
  if (obPct > .15){ tone = "warn"; score -= 2; const c = Object.keys(ob.causes).sort((a, b) => ob.causes[b] - ob.causes[a])[0];
    bits.push(say([`but ${pctOf(obPct)} of its seats are ${VIEW_CAUSES[c]}, and the ticket office will have to own up to it`, `though ${pctOf(obPct)} of the crowd here spend the match ${VIEW_CAUSES[c]}`,
      `but ${pctOf(obPct)} of its fans watch ${VIEW_CAUSES[c]}, craning to see the goals`], "obs")); }
  else if (obPct > .02){ tone = "tip"; score -= .5; const c = Object.keys(ob.causes).sort((a, b) => ob.causes[b] - ob.causes[a])[0]; bits.push(`though ${pctOf(obPct)} of its seats are ${VIEW_CAUSES[c]}`); }
  else if (shallow){ tone = "warn"; score -= 1.5; bits.push(say(["but it's too shallow: fans will be craning over the heads in front", "though the rake is too gentle to see over the person in front"], "c")); }
  else if (steep > 33){ score += .5; bits.push(say([`and at ${Math.round(steep)}° it's thrillingly steep`, `with a ${Math.round(steep)}° rake that puts you right over the play`, `and its ${Math.round(steep)}° rake keeps even the back rows close to the action`], "steep")); }
  // what it's made of, and its plot
  const glassy = look === "glass" || look === "fins", trad = era === "Traditional";
  if (trad && glassy){ score -= .3; bits.push(say(["a glass front on an old-style stand is a brave choice", "the glass front sits oddly on such a traditional stand"], "mat")); }
  else if (!trad && (look === "brick" || look === "timber")) bits.push(`the ${look} outside wall gives a modern stand some warmth`);
  else if (look === "plain" && p.seats > 5000){ score -= .5; if (tone === "good") tone = "tip"; bits.push(say(["from the street it's a blank slab, so dress the outside wall up", "the outside wall is plain, which a stand this size doesn't deserve"], "mat")); }
  if (open && cx.cover > .5){ score -= .5; if (tone === "good") tone = "tip"; bits.push(say(["and it's left without a roof, so bring a coat", "and with no roof its fans get wet while everyone else stays dry"], "roof")); }
  if (squeezed){ score -= .5; if (tone === "good") tone = "tip"; bits.push(say(["the plot cuts it short, so some rows don't fit", "it's squeezed by the edge of the plot"], "site")); }
  const text = bits.reduce((s, b, i) => !i ? cap1(b) : s + (/^(but|though|and|with)\b/.test(b) ? ", " : "; ") + b, "") + ".";
  return {name: p.label, key: p.key, tone, score, text};
}
function architectNotes(D){
  const notes = [], sc = {}, L = S.limits, lay = D.lay || layoutOf(), A = (D.screenCtx && D.screenCtx.anchors) || [];
  const note = (tone, text, act, label, rank) => notes.push({tone, text, act, label, rank: rank != null ? rank : tone === "warn" ? 3 : tone === "tip" ? (act ? 2.5 : 2) : 1});
  const clamp10 = v => Math.max(0, Math.min(10, v));
  if (!D.total){ return {notes:[{tone:"tip", text:"Nothing built yet. Give a stand a tier and I'll start taking notes."}], sc:null, stands:[]}; }
  const say = criticSay(hashSeed([D.total, S.sport, ...D.parts.map(p => p.label + p.seats)].join("|")));
  // how enclosed the ground is: the corners, and how much of the way round has stands
  let corners = 4;
  if (lay === "bowl" || lay === "hybrid") corners = CORNERS.filter(c => !(S.bowl.removed && S.bowl.removed[c.key])).length;
  else if (lay === "ring") corners = (S.ring && S.ring.gap > 10) ? 1 : (S.ring && S.ring.gap > 5) ? 2 : 4;
  else corners = CORNERS.filter(c => { const P = cornerPlan(c); return !P.gap || P.stand; }).length;
  const near = D.set, cover = D.covered/D.total, steep = Math.max(0, ...D.parts.flatMap(p => p.tiers.map(t => t.steep || 0)));
  // atmosphere: close, steep, enclosed and roofed grounds are loud
  sc.atmosphere = clamp10(10 - Math.max(0, near - 6)*0.35 - (4 - corners)*0.9 - (1 - cover)*3 + (steep > 30 ? 0.5 : 0));
  if (near > 14) note("tip", `The stands sit ${Math.round(near)} m back from the play. It feels distant and the noise drifts away. Bring them closer if the sport allows it.`, "closer", "Bring them in");
  if (corners <= 1) note("tip", `${4 - corners} of the 4 corners are open. Noise, wind and rain get in there. Filling them makes the ground feel complete.`, lay === "stands" ? "corners" : null, "Go to the corners");
  // views
  const cMM = isFinite(D.minC) ? D.minC*1000 : 120, rPct = 100*D.restricted/D.total, O = D.obstructed;
  const rW = O ? 100*(O.bad + 0.4*O.slight)/D.total : rPct; // badly restricted seats count in full, slightly restricted ones less
  sc.views = clamp10(10 - Math.min(4, Math.max(0, 90 - cMM)*0.03) - Math.min(3, Math.max(0, D.far - 150)*0.08) - Math.min(3, rW*0.4));
  if (D.far > 175) note("tip", `The furthest fan is ${Math.round(D.far)} m from the ${D.farName || "play"}. Faces become dots past about 150 m. Fewer rows up top, or steeper tiers, would help.`);
  if (cMM < L.minC) note("warn", `Some fans can't see over the heads in front (${Math.round(cMM)} mm against the ${L.minC} mm needed). The checks below have fixes.`);
  const tally = {}; if (O) for (const st of Object.values(O.stands)) for (const c in st.causes) tally[c] = (tally[c] || 0) + st.causes[c];
  const topCause = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
  if (rPct > 2) note("warn", `${rPct.toFixed(1)}% of seats have a restricted view${topCause ? ", mostly " + VIEW_CAUSES[topCause] : ""}. ${topCause === "pillar" ? "Pillars have charm, but fans pay to see the goals. Cantilevered tiers and roofs get rid of them." : "The checks below say where, and how to clear them."}`);
  // comfort: shelter from the weather
  sc.comfort = clamp10(cover*10);
  if (cover < 0.5) note("tip", `Only ${Math.round(cover*100)}% of fans are under a roof. On a wet night the rest will notice.`, "roofs", "Roof the open stands");
  // looks: the roofline, a coherent (or deliberately mixed) set of styles, dressed walls, materials that suit the stands, a fitting signature, a name
  const tops = A.map(a => Math.max(0, ...(a.RR || []).filter(Boolean).map(r => r.y(0)))).filter(h => h > 0), cfgs = standCfgs();
  const styles = new Set(cfgs.map(c => c.style)), eras = new Set(cfgs.map(c => (STYLES[c.style] || {}).era || "Modern"));
  const lookOf = c => (c.facade && c.facade.look) || (STYLES[c.style] || {}).look || "plain";
  let looks = 5, lopsided = null;
  if (tops.length >= 2){ const hi = Math.max(...tops), lo = Math.min(...tops), ratio = hi/Math.max(1, lo);
    if (ratio > 2.2 && !S.roofAlign){ looks -= 1.5; lopsided = [lo, hi]; note("tip", `The tallest roof is ${Math.round(hi)} m and the lowest ${Math.round(lo)} m, so the roofline is lopsided. That can be a statement, like Old Trafford's old main stand; to tidy it up, line the roofs up.`, "align", "Line up the roofs"); }
    else if (ratio < 1.25) looks += 1.5; }
  if (styles.size === 1) looks += D.total > 20000 ? 1 : .5; else if (eras.size === 1) looks += .5; else if (styles.size >= 4) looks -= .5;
  const plainShare = cfgs.length ? cfgs.filter(c => lookOf(c) === "plain").length/cfgs.length : 0; looks += 1.5*(1 - plainShare);
  for (const c of cfgs){ const trad = (STYLES[c.style] || {}).era === "Traditional", lk = lookOf(c); if (trad && (lk === "glass" || lk === "fins")) looks -= .3/cfgs.length*4; }
  if (sponsorsOf().title) looks += .3; else if (D.total > 15000) note("tip", "A ground this size deserves a name. Naming rights are a big earner too.", "name", "Name it", 1.2);
  // signature architecture: does it suit the ground?
  const AR = S.arch || {}, big = D.total >= 25000, tall = D.maxH > 30;
  if (AR.arch){ looks += big ? 1.5 : .5; note(big ? "good" : "tip", big ? say(["The arch earns its place: at this size it's a landmark, Wembley-style.", "An arch suits a ground this big. You'll see it from the motorway."], "arch") : `An arch over a ground of ${fmt(D.total)} is a lot of hat for a small head. It suits somewhere Wembley-sized.`, null, null, 1.6); }
  else if (AR.skin && AR.skin !== "none"){ const allOld = eras.size === 1 && eras.has("Traditional"); looks += allOld ? .5 : 1.5;
    note(allOld ? "tip" : "good", allOld ? "The outer skin hides all that lovely old brick. Is that what you want?" : styles.size >= 3 ? "The outer skin pulls a mixed set of stands into one building." : "The outer skin turns the ground into one clean object, the way the Allianz Arena's does.", null, null, 1.6); }
  else if (AR.ramps){ looks += tall ? 1.5 : .5; note(tall ? "good" : "tip", tall ? "The spiral ramps are pure San Siro, and a ground this tall carries them well." : "Spiral ramps on a ground this low are mostly for show. San Siro needed them; this doesn't.", null, null, 1.6); }
  else if (AR.towers){ looks += 1; note("good", "The entrance towers give the street something to look up at.", null, null, 1.4); }
  sc.looks = clamp10(looks);
  // getting in and out
  const em = D.issues.some(i => /^emerg:/.test(i.key)), evac = D.slowest || 0;
  sc.access = clamp10(10 - Math.max(0, evac - 4)*1.2 - (em ? 3 : 0) - D.issues.filter(i => i.cat === "rules").length*0.8);
  if (evac > L.maxEvac*0.85 && evac <= L.maxEvac) note("tip", `The slowest stand takes ${evac.toFixed(1)} minutes to empty, close to the ${L.maxEvac}-minute limit. A few more exits would give some slack.`, "exits", "Add exits");
  // wheelchair spaces and a way in for emergency vehicles
  const need = wheelchairNeed(D.total), AC = accessOf();
  if (!AC.on) note("tip", `No wheelchair spaces yet. A ground this size should have about ${need}. Switch them on under Rules.`, "access", "Add wheelchair spaces");
  if (!vehicleOf().on && (lay === "bowl" || lay === "hybrid" || corners === 4)) note("warn", "There's no way for an ambulance or fire engine to drive onto the pitch. Add an emergency vehicle entrance through one of the stands.", "vehicle", "Add one");
  // facilities, stand by stand
  const fac = cfgs.map(c => facilitiesOf(c)), basic = fac.filter(f => f === "basic").length;
  if (basic) note("tip", `${basic === fac.length ? "Every stand has" : basic + " stand" + (basic > 1 ? "s have" : " has")} basic facilities. Expect long queues for the toilets and the tea bar at half time.`);
  sc.comfort = clamp10(sc.comfort*0.75 + 2.5*(fac.length ? fac.reduce((a, f) => a + (f === "basic" ? 0.3 : f === "premium" ? 1.2 : 0.8), 0)/fac.length : 0.8));
  // the ends: an away end needs room and keeping apart
  const AW = awayOf(), AL = D.awayAlloc || {seats:0};
  if (AW.on && AL.seats){ if (AL.seats/D.total < 0.03) note("tip", `The away end holds ${fmt(AL.seats)}, under 3% of the ground. Visiting fans will feel squeezed.`);
    if (!AW.gap) note("warn", "There's no gap between home and away fans. Leave a few empty seats to keep them apart."); }
  // money: hospitality
  if (D.total > 25000 && (D.byType.exec || 0)/D.total < 0.01) note("tip", "No executive boxes. At a ground this size, hospitality pays a lot of the bills. Try a ring of boxes between two tiers.", "boxes", "Go to stands");
  if (!AC.on || (D.wheelchair || 0) < need) sc.access = clamp10(sc.access - 1.5);
  // the site: a tight plot
  const cut = Object.values(D.cutInfo || {}).flat().reduce((a, c) => a + (c ? Math.max(0, Math.round(c.want - c.fit)) : 0), 0);
  if (cut > 0) note("tip", say([`The plot is tight: ${cut} rows don't fit. Like Kenilworth Road, it's hemmed in by its neighbours, which has its own charm.`, `${cut} rows are lost to the plot boundary. Squeezed grounds have character, but that's a lot of seats left on the drawing board.`], "plot"), null, null, 1.8);
  // what it's like: a real ground it brings to mind
  const trad = eras.size === 1 && eras.has("Traditional"), modern = eras.size === 1 && eras.has("Modern");
  const like = D.total < 12000 ? say(["Small and tight, like a lower-league ground at its best: you'll hear the manager shouting.", "A compact little ground. Every seat feels close to the action."], "like")
    : lay === "bowl" ? (D.total > 50000 ? say(["In shape and scale it's a cousin of Wembley or the Emirates: one big sweeping bowl.", "A big, continuous bowl in the Wembley mould. Impressive, if a touch impersonal."], "like") : "A neat bowl in the modern European mould: every seat faces the play.")
    : trad ? say(["Pure Archibald Leitch: brick, pillars and pitched roofs, like Fratton Park or the old Ibrox.", "This could have been built in 1910. Leitch would recognise it, pillars and all."], "like")
    : styles.size >= 3 ? say(["It reads like Goodison or Villa Park: a ground that grew a stand at a time.", "A ground with a history you can read in its stands, one era after another."], "like")
    : modern && corners === 4 ? "Four big modern stands with the corners filled: the Premier League new-build look." : null;
  if (like) note("good", like, null, null, 1.5);
  const overall = (sc.atmosphere + sc.views + sc.comfort + sc.looks + sc.access)/5;
  // stand by stand
  const live = D.parts.filter(p => p.key !== "F" && cfgOfKey(p.key) && D.standInfo && D.standInfo[p.key]);
  const hs = live.map(p => D.standInfo[p.key].height), cx = {D, O, say, cover, used: new Set(), count: live.length, mean: hs.length ? hs.reduce((a, b) => a + b, 0)/hs.length : 0};
  const stands = live.map(p => standCritique(p, cx)).filter(Boolean);
  // the best and worst of it
  const evacTxt = evac ? `everyone's out in ${evac.toFixed(1)} minutes` : "plenty of ways out";
  const feats = [
    [sc.atmosphere, `the atmosphere: fans ${Math.round(near)} m from the play${corners === 4 ? " with every corner filled" : ""}`, near > 14 ? `the atmosphere: the stands sit ${Math.round(near)} m back and the noise drifts off` : `the atmosphere: ${4 - corners} open corner${4 - corners === 1 ? "" : "s"} let the noise out`],
    [sc.views, `the views: ${D.restricted ? "hardly a seat" : "not one seat"} behind anything, and nobody further than ${Math.round(D.far)} m from the far corner`, rPct > 2 ? `the views: ${rPct.toFixed(1)}% of seats are restricted` : cMM < L.minC ? "the views: some fans can't see over the heads in front" : `the views: the back rows are ${Math.round(D.far)} m from the far corner`],
    [sc.comfort, `the shelter: ${Math.round(cover*100)}% of fans are under a roof`, `the shelter: only ${Math.round(cover*100)}% of fans are under a roof`],
    [sc.looks, AR.arch || AR.ramps || (AR.skin && AR.skin !== "none") ? "the looks: a skyline you'd know from a mile off" : "the looks: a handsome, well-dressed ground", lopsided ? `the looks: the roofline lurches from ${Math.round(lopsided[0])} m to ${Math.round(lopsided[1])} m` : plainShare > .5 ? "the looks: from the street it's mostly plain walls" : "the looks: nothing catches the eye from the street"],
    [sc.access, `getting out: ${evacTxt}`, em ? "getting out: the emergency evacuation is too slow" : `getting in and out: the slowest stand takes ${evac.toFixed(1)} minutes to empty`]];
  const ranked = feats.slice().sort((a, b) => b[0] - a[0]), bestStand = stands.slice().sort((a, b) => b.score - a.score)[0], worstStand = stands.slice().sort((a, b) => a.score - b.score)[0];
  let best = ranked[0][1], worst = ranked[ranked.length - 1][2];
  if (bestStand && bestStand.score >= 1 && ranked[0][0] < 8.5) best = `the ${bestStand.name.toLowerCase()}`;
  if (worstStand && worstStand.score <= -1.5 && ranked[ranked.length - 1][0] > 4) worst = `the ${worstStand.name.toLowerCase()}`;
  const grade = overall >= 8.5 ? ["A classic in the making.", "This is the real deal.", "Frankly, I'd buy a season ticket."] : overall >= 7 ? ["A strong design.", "Plenty to like here.", "A proper ground, this."]
    : overall >= 5.5 ? ["Solid, with some work to do.", "Decent bones, rough edges.", "Promising, but not there yet."] : ["Worth a rethink.", "Back to the drawing board, I'm afraid.", "It needs more than a lick of paint."];
  const verdict = say(grade, "grade") + " " + say([`Its best feature is ${best}; the weakest is ${worst}.`, `The highlight is ${best}. The let-down is ${worst}.`, `I like ${best}. I'm less keen on ${worst}.`], "bw");
  notes.sort((a, b) => b.rank - a.rank);
  return {notes: notes.slice(0, 4), sc, overall, stands, best, worst, verdict};
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
  const {notes, sc, overall, stands, verdict} = architectNotes(D);
  const cost = D.total ? buildCost(D) : 0, money = v => v >= 1e9 ? "£" + (v/1e9).toFixed(1) + "bn" : "£" + Math.round(v/1e6) + "m";
  el.innerHTML = `<h3>Architect's notes ${sc ? `<span class="grade">${overall.toFixed(1)}</span><small>out of 10</small>` : ""}</h3>
    ${sc ? `<p class="verdict">${esc(verdict)}</p><div class="scores">${[["Atmosphere","atmosphere"],["Views","views"],["Shelter","comfort"],["Looks","looks"],["In and out","access"]].map(([l,k]) =>
      `<div class="score"><span>${l}</span>${sc[k].toFixed(1)}<i><b style="width:${sc[k]*10}%"></b></i></div>`).join("")}</div>` : ""}
    ${stands.length ? `<ul class="stand-notes">${stands.map(n => `<li class="t-${n.tone}"><span><b>${esc(n.name)}</b>: ${esc(n.text)}</span></li>`).join("")}</ul>` : ""}
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

