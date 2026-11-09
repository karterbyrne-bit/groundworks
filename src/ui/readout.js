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
  renderSummary(); updateHud();
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
  renderEditor(); changed();
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
  renderEditor(); changed();
  const left = dryIssues().filter(i => i.cat !== "geo").length;
  const ruled = S.standard === "custom" && (S.limits.seatRake > rk0.seatRake || S.limits.terraceRake > rk0.terraceRake);
  flash(`<b>Fixed ${fixed} ${fixed === 1 ? "thing" : "things"}.</b>` + (ruled ? ` Your rules now allow ${[S.limits.seatRake > rk0.seatRake ? S.limits.seatRake + "° seating" : "", S.limits.terraceRake > rk0.terraceRake ? S.limits.terraceRake + "° terraces" : ""].filter(Boolean).join(" and ")}.` : "") + (left ? ` ${left} still ${left === 1 ? "needs" : "need"} a decision from you.` : ""), fixed ? UNDO : null);
}
/* ================= panes: one section of controls at a time, so the 3D view stays in sight ================= */
let pane = "start";
try { pane = localStorage.getItem("groundworks-pane") || "start"; } catch(e) {}
function showPane(name, keepScroll){
  if (name === "stats" || name === "rules") name = "details"; // the two tabs that became one
  if (!document.querySelector(`#panes [data-pane="${name}"]`)) name = "start";
  pane = name;
  document.querySelectorAll("#panes [data-pane]").forEach(b => { b.setAttribute("aria-selected", String(b.dataset.pane === name)); b.tabIndex = b.dataset.pane === name ? 0 : -1; });
  document.querySelectorAll("#panebody > [data-pane]").forEach(el => el.classList.toggle("on", el.dataset.pane === name));
  if (!keepScroll) $("panebody").scrollTop = 0;
  M.picked.visible = name === "stands"; redraw(); // the stand being edited is only outlined while its controls are showing
  try { localStorage.setItem("groundworks-pane", name); } catch(e) {}
}
document.getElementById("panes").addEventListener("click", e => { const b = e.target.closest("[data-pane]"); if (b) showPane(b.dataset.pane); });
document.getElementById("panes").addEventListener("keydown", e => {
  const tabs = [...document.querySelectorAll("#panes [data-pane]")], i = tabs.indexOf(document.activeElement); if (i < 0) return;
  const j = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
  if (j < 0) return; e.preventDefault(); tabs[j].focus(); showPane(tabs[j].dataset.pane);
});
document.getElementById("hud").addEventListener("click", () => showPane("results"));
/* Folding groups of controls (data-keep) remember whether each was left open or shut. */
let keptOpen = {};
try { keptOpen = JSON.parse(localStorage.getItem("groundworks-open")) || {}; } catch(e) {}
document.querySelectorAll("details[data-keep]").forEach(d => { const k = d.dataset.keep; if (k in keptOpen) d.open = !!keptOpen[k];
  d.addEventListener("toggle", () => { keptOpen[k] = d.open; try { localStorage.setItem("groundworks-open", JSON.stringify(keptOpen)); } catch(e) {} }); });
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

