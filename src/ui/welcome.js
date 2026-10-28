/* ================= welcome, help and keyboard shortcuts ================= */
const welcome = $("welcome"), help = $("help");
const openSheet = d => { if (d.open) return; if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); };
$("helpBtn").addEventListener("click", () => openSheet(help));
help.addEventListener("close", () => { if (help.returnValue === "tour") openSheet(welcome); });
welcome.addEventListener("close", () => { try { localStorage.setItem("groundworks-welcomed", "1"); } catch(e) {} });
for (const d of [welcome, help]) d.addEventListener("click", e => { // tap outside the card to close
  const r = d.getBoundingClientRect(); if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) d.close(); });
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, select, textarea, [contenteditable]") || welcome.open || help.open) return;
  const k = e.key, panes = [...document.querySelectorAll("#panes [data-pane]")];
  if (k === "?"){ openSheet(help); }
  else if (/^[1-7]$/.test(k)) showPane(panes[+k - 1].dataset.pane);
  else if (k === "a") goCam("aerial");
  else if (k === "p") goCam("plan");
  else if (k === "f") goCam("seat");
  else if (k === "n"){ S.night = !S.night; changed(); }
  else if (k === "r") randomStadium();
  else return;
  e.preventDefault();
});

function syncUI(){
  const F = field(), lay = layoutOf();
  document.querySelector(`input[name=sport][value=${S.sport}]`).checked = true;
  $("ly-stands").disabled = !!F.noStands; $("ly-bowl").disabled = false; $("ly-hybrid").disabled = false; $("ly-ring").disabled = false;
  document.querySelector(`input[name=layout][value=${lay}]`).checked = true;
  document.querySelector(`input[name=cshape][value=${S.cornerShape || "curved"}]`).checked = true;
  $("layoutNote").textContent = lay === "hybrid" ? "A continuous lower bowl, with each side free to have its own tiers and roof above it."
    : lay === "ring" ? "Any number of separate stands round the ground, each its own design. Set how many under Stands."
    : lay === "bowl" ? "One continuous bowl. Under Stands you can leave out a side, for a horseshoe, or give each side its own depth." : "Four separate stands, joined by corners if you want them.";
  $("sportNote").textContent = F.note;
  $("customFloor").hidden = !F.custom;
  { const FS = fieldShapeOf(), can = canShapeField(S.sport); $("fieldShapeBox").hidden = !can; $("fieldShape").value = FS.shape;
    $("fieldMarginRow").hidden = $("fieldShapeHint").hidden = FS.shape === "pitch"; $("fieldMargin").value = FS.margin; $("o-fieldMargin").textContent = FS.margin + " m"; }
  $("kinds").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.kind === S.custom.kind)));
  $("cornerRow").hidden = lay === "stands" || S.cornerShape === "square" || (F.r > 0 && (F.custom || F.noStands));
  for (const [id, key] of [["nW","W"],["nH","H"],["nR","r"]]) if (document.activeElement !== $(id)) $(id).value = S.custom[key];
  $("floorSummary").textContent = `${S.custom.W} × ${S.custom.H} m`;
  const so = (id, v, txt) => { $(id).value = v; if ($("o-"+id) && txt !== undefined) $("o-"+id).textContent = txt; };
  so("floorRows", S.custom.floor || 0, (S.custom.floor || 0) ? S.custom.floor + " rows" : "none");
  const effSet = LAST ? LAST.set : S.setback;
  const hs = hardStop(); $("runoffRow").hidden = $("runoffNote").hidden = S.sport !== "football"; $("setback").min = Math.max(1, hs);
  so("runoff", S.runoff == null ? 3 : S.runoff, (S.runoff == null ? 3 : S.runoff) + " m");
  so("setback", S.setback, S.setback + " m" + (effSet > S.setback + 0.01 ? ` (${+effSet.toFixed(1)} m to fit floor seats)` : ""));
  so("corner", S.corner, S.corner + " m");
  const fIn = LAST && LAST.focusIn != null ? LAST.focusIn : (S.focusIn || 0);
  $("focusIn").max = Math.max(0.5, Math.floor(maxFocusIn(F)*2)/2);
  so("focusIn", fIn, fIn < 0.05 ? "edge of play" : `${+fIn.toFixed(1)} m into the floor` + (S.focusIn == null ? " (auto)" : ""));
  const OU = Object.assign({shape:"follow", fit:"ring", size:0}, S.outer || {}), upper = lay === "bowl" ? S.bowl.tiers.length > 1 : SIDES.some(s => S.stands[s].tiers.length);
  $("outerBox").hidden = lay === "stands" || lay === "ring";
  document.querySelector(`input[name=outerShape][value=${OU.shape}]`).checked = true;
  document.querySelector(`input[name=outerFit][value=${OU.fit}]`).checked = true;
  $("outerMore").hidden = OU.shape === "follow" || !upper;
  so("outerSize", OU.size, (OU.size > 0 ? "+" : "") + OU.size + " m");
  $("outerFitNote").textContent = OU.fit === "fill" ? "The upper tiers grow back until their back row, outer wall and roof trace the outline, so the corners get deeper." : "The front of the upper tiers sits on the outline, floating back from the lower tier along the sides.";
  $("outerNone").textContent = upper ? "" : (lay === "bowl" ? "Add a second tier to the bowl (under Stands) to use this." : "Give a stand some tiers above the lower bowl (under Stands) to use this.");
  $("outerNone").hidden = upper;
  $("grOn").checked = groundRoofOn();
  $("plotOn").checked = S.plot.on; $("plotBox").hidden = !S.plot.on; $("plotClip").checked = S.plot.clip;
  if (S.plot.pts && plotDrawn !== JSON.stringify(S.plot.pts)) renderPlot();
  if (siteDrawn !== JSON.stringify(S.site || [])) renderSite();
  syncConvert();
  $("boards").checked = !!S.boards;
  { const BS = boardSetOf(), D = LAST, FP = D ? pitchOf(D.F) : null; $("boardRows").hidden = !S.boards;
    $("bdEnd").value = BS.end; $("bdSide").value = BS.side; $("bdHeight").value = BS.height;
    $("o-bdEnd").textContent = BS.end + " m"; $("o-bdSide").textContent = BS.side + " m"; $("o-bdHeight").textContent = BS.height.toFixed(1) + " m";
    const roomX = D ? D.set + (D.F.W - FP.W)/2 - 1 : 99, roomZ = D ? D.set + (D.F.H - FP.H)/2 - 1 : 99, tight = BS.end > roomX + .01 || BS.side > roomZ + .01;
    $("bdNote").hidden = !tight; $("bdNote").textContent = tight ? `The stands are close, so the boards stop a metre short of them (${Math.max(0, Math.min(BS.end, roomX)).toFixed(1)} m behind the goals, ${Math.max(0, Math.min(BS.side, roomZ)).toFixed(1)} m from the touchlines).` : ""; }
  const AR = Object.assign({skin:"none", skinShape:"round"}, S.arch || {});
  $("skin").value = AR.skin; document.querySelector(`input[name=skinShape][value=${AR.skinShape}]`).checked = true; $("skinShapeRow").hidden = AR.skin === "none";
  for (const k of ["arch","ramps","towers","plaza"]) $("a-"+k).checked = !!AR[k];
  $("archAt").value = ["main", "diagonal", "cross"].includes(AR.archAt) ? AR.archAt : "main"; $("archAtRow").hidden = !AR.arch;
  $("statues").value = String(Math.max(0, Math.min(4, S.statues | 0)));
  $("spectacle").checked = !!(S.halo || S.flares); $("flaresHint").hidden = !!homeEndOf().at;
  $("flood").value = floodMode(); if (!$("screens").contains(document.activeElement) && screensDrawn !== JSON.stringify(Array.isArray(S.screens) ? S.screens : screenList(LAST && LAST.closedAt))) renderScreens();
  { const SP = sponsorsOf(); if (document.activeElement !== $("spTitle")) $("spTitle").value = SP.title || "";
    if (document.activeElement !== $("spNames")) $("spNames").value = SP.names.join("\n");
    if (document.activeElement !== $("spTitleColour")) $("spTitleColour").value = SP.titleColour || "#ffffff";
    $("spOnStand").checked = SP.onStand !== false; $("spTitleRow").hidden = $("spOnStandRow").hidden = !SP.title;
    $("stadiumTitle").textContent = SP.title || ""; $("stadiumTitle").hidden = !SP.title; }
  $("hour").value = S.hour == null ? 15 : S.hour; $("o-hour").textContent = clock(S.hour == null ? 15 : S.hour); $("hourRow").hidden = !!S.night;
  { const TNs = tunnelOf(), DGs = dugoutsOf(), opts = tdSides(), sel = (id, val) => { $(id).innerHTML = opts.map(([k, n]) => `<option value="${k}"${k === val ? " selected" : ""}>${esc(n)}</option>`).join(""); };
    $("tdBox").hidden = !hasDugouts();
    $("tnOn").checked = TNs.on; $("tnRows").hidden = !TNs.on; sel("tnAt", TNs.at); $("tnExtend").checked = TNs.extend !== false;
    $("tnPos").value = TNs.pos; $("o-tnPos").textContent = TNs.pos ? `${Math.abs(TNs.pos)} m ${TNs.pos < 0 ? "left" : "right"}` : "middle";
    $("tnWidth").value = TNs.width; $("o-tnWidth").textContent = TNs.width + " m";
    if (document.activeElement !== $("tnColour")) $("tnColour").value = TNs.colour || S.seat;
    $("dgOn").checked = DGs.on; $("dgRows").hidden = !DGs.on; $("dgStyle").value = DGs.style; sel("dgAt", DGs.at);
    $("dgLength").value = DGs.length; $("o-dgLength").textContent = DGs.length + " m";
    $("dgGap").value = DGs.gap; $("o-dgGap").textContent = DGs.gap + " m";
    if (document.activeElement !== $("dgColour")) $("dgColour").value = DGs.colour || "#1d2a3a"; }
  $("players").checked = !!S.players; $("playersRow").hidden = !["football","rugby"].includes(S.sport);
  $("scenery").checked = S.scenery !== "model"; $("crowd").checked = S.crowd !== false; $("night").checked = !!S.night; $("seeThrough").checked = !!S.seeThrough;
  { const AW = awayOf(), fillPct = Math.round(100*(S.crowdFill == null ? 0.93 : S.crowdFill));
    $("crowdBox").hidden = S.crowd === false; $("crowdFill").value = fillPct; $("o-crowdFill").textContent = fillPct + "%";
    const HEs = homeEndOf(), AL = LAST && LAST.awayAlloc, opts = tdSides().concat(CORNERS.filter(c => (AL && AL.corners || []).includes(c.key) || c.key === AW.at || c.key === HEs.at).map(c => [c.key, c.name.toLowerCase()]));
    $("awayOn").checked = AW.on; $("awayRows").hidden = !AW.on;
    $("awayAt").innerHTML = opts.map(([k, n]) => `<option value="${k}"${k === AW.at ? " selected" : ""}>${esc(n)}</option>`).join("");
    $("awayAnchor").value = AW.anchor; $("awayGap").value = AW.gap; $("o-awayGap").textContent = AW.gap ? AW.gap + " m" : "none";
    if (document.activeElement !== $("awayCount")) $("awayCount").value = AW.count != null ? AW.count : Math.min(3000, Math.round((LAST ? LAST.total : 0)*0.1/100)*100);
    $("awayNote").textContent = AL && AW.on ? `${fmt(AL.seats)} seats given to away fans${AL.gap ? `, ${fmt(AL.gap)} left empty to keep the fans apart` : ""}.` : "";
    if (document.activeElement !== $("awayColour")) $("awayColour").value = AW.colour;
    $("homeAt").innerHTML = `<option value="">None</option>` + opts.map(([k, n]) => `<option value="${k}"${k === HEs.at ? " selected" : ""}>${esc(n)}</option>`).join("");
    $("homeRows").hidden = !HEs.at; if (document.activeElement !== $("homeName")) $("homeName").value = HEs.name || "";
    $("homeFlags").checked = HEs.flags !== false; $("homeBanners").checked = HEs.banners !== false; $("homeTifo").checked = !!HEs.tifo;
    $("homeTextsRow").hidden = $("homeTexts").hidden = HEs.banners === false; if (document.activeElement !== $("homeTexts")) $("homeTexts").value = HEs.texts || "";
    $("stewards").checked = S.stewards !== false; }
  $("seeBtn").setAttribute("aria-pressed", String(!!S.seeThrough)); $("nightBtn").setAttribute("aria-pressed", String(!!S.night));
  { const T = S.seatText || {}, opts = seatTextStands();
    if (document.activeElement !== $("seatText")) $("seatText").value = T.text || "";
    $("seatTextAt").innerHTML = opts.map(([k, n]) => `<option value="${k}"${k === T.at ? " selected" : ""}>${esc(n)}</option>`).join("");
    $("seatTextAtRow").hidden = !T.text; }
  $("seatPattern").value = S.seatPattern || "solid"; $("seat2Row").hidden = (S.seatPattern || "solid") === "solid" && !(S.seatText && S.seatText.text);
  if (document.activeElement !== $("seat2")) $("seat2").value = S.seat2 || "#f2f2f2";
  $("swatches").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.hex === S.seat)));
  syncSizes(); syncLimits();
}
let pending = false, recam = false;
/* Football's hard stop: push anything that has crept onto the pitch or its run-off back off it. */
function keepPitchClear(){
  const hard = hardStop(); if (!hard) return;
  const F = field(), hx = F.W/2 + hard, hz = F.H/2 + hard, zone = [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]];
  if (S.setback < hard) S.setback = hard;
  for (const s2 of SIDES) if (S.stands[s2].dist != null && S.stands[s2].dist < hard) S.stands[s2].dist = hard;
  for (const r of (S.ring && S.ring.stands) || []) if (r.dist != null && r.dist < hard) r.dist = hard;
  // surroundings: slide each one straight out from the middle until it's clear
  const overlaps = f => { const P = featurePoly(f, 0); return P.some(q => inPoly(q, zone)) || zone.some(q => inPoly(q, P)) ||
    P.some((a, i) => { const b = P[(i+1)%4]; return zone.some((c, j) => { const d = zone[(j+1)%4], den = cross([b[0]-a[0], b[1]-a[1]], [d[0]-c[0], d[1]-c[1]]); if (Math.abs(den) < 1e-9) return false;
      const t = cross([c[0]-a[0], c[1]-a[1]], [d[0]-c[0], d[1]-c[1]])/den, u = cross([c[0]-a[0], c[1]-a[1]], [b[0]-a[0], b[1]-a[1]])/den; return t > 0 && t < 1 && u > 0 && u < 1; }); }); };
  for (const f of (Array.isArray(S.site) ? S.site : [])){ let n = 0; const l = Math.hypot(f.x, f.z) || 1; let ux = f.x/l, uz = f.z/l; if (!ux && !uz) uz = 1;
    while (overlaps(f) && n++ < 400){ f.x = Math.round((f.x + ux) * 10)/10; f.z = Math.round((f.z + uz) * 10)/10; } }
  // the plot: corners can't be inside the zone, and the zone's corners must be inside the plot
  if (S.plot.on && S.plot.pts){ const pts = S.plot.pts;
    for (const q of pts) if (Math.abs(q[0]) < hx && Math.abs(q[1]) < hz){ if (hx - Math.abs(q[0]) < hz - Math.abs(q[1])) q[0] = Math.sign(q[0] || 1)*Math.ceil(hx + .5); else q[1] = Math.sign(q[1] || 1)*Math.ceil(hz + .5); }
    for (let n=0;n<40;n++){ const out = zone.find(c => !inPoly(c, pts)); if (!out) break;
      let bi = 0, bd = Infinity; pts.forEach((a, i) => { const b = pts[(i+1)%pts.length], ex = b[0]-a[0], ez = b[1]-a[1], L = Math.hypot(ex, ez) || 1, d = Math.abs(cross([out[0]-a[0], out[1]-a[1]], [ex, ez]))/L; if (d < bd){ bd = d; bi = i; } });
      const a = pts[bi], b = pts[(bi+1)%pts.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]) || 1; let nx = -(b[1]-a[1])/L, nz = (b[0]-a[0])/L;
      if (nx*(a[0]+b[0]) + nz*(a[1]+b[1]) < 0){ nx = -nx; nz = -nz; } // push away from the middle
      const step = bd + 1; for (const q of [a, b]){ q[0] = Math.round(q[0] + nx*step); q[1] = Math.round(q[1] + nz*step); } } }
}
function changed(moveCam, coalesce){
  if (moveCam) recam = true;
  keepPitchClear(); followSnappedRoads(); // roads that run along the plot's edge move with it
  syncUI(); renderTabs(); save(coalesce);
  if (pending) return; pending = true;
  requestAnimationFrame(() => { pending = false; build(); if (wire) applyWire(); syncUI(); renderSummary(); if (recam){ recam = false; if (camMode !== "seat") goCam(camMode); } });
}

showPane(pane, true); applyTheme(); renderTypeSizes(); fixTab(); if (isHybrid()) tab = "B"; renderEditor(); renderViews(); renderSaves(); syncUI(); build(); record(); resize(); setLook(false); goCam("aerial", true); setTip();
wake();
/* Hand over from the loading screen once the first frame is drawn, then greet first-time visitors. */
requestAnimationFrame(() => requestAnimationFrame(async () => {
  if (window.gwStarted) window.gwStarted();
  noteSwappedSport();
  const shared = await openFromLink();
  let seen = false; try { seen = !!localStorage.getItem("groundworks-welcomed"); } catch(e) { seen = true; }
  if (!seen && !shared) setTimeout(() => openSheet(welcome), reduce ? 0 : 450);
}));
window.addEventListener("hashchange", openFromLink);
/* read-only hook for automated checks */
window.__gw = {state:() => JSON.parse(JSON.stringify(S)), last:() => LAST, seat:(x, y, z, standing) => seatView({x, y, z}, standing, true), busy:() => pending, boards:() => { let n = 0; group.traverse(o => { if (o.userData.ads) n++; }); return n > 0; }, crowd:() => { if (!CROWD) return null; const a = CROWD.bodies.instanceMatrix.array; let up = 0; for (let i=0;i<CROWD.n;i++) if (a[i*16+13] > CROWD.base[0][i*16+13] + 0.05) up++; return {n:CROWD.n, standing:up}; }, memory:() => Object.assign({materials:Object.keys(M).length, programs:renderer.info.programs.length}, renderer.info.memory), regions:() => LAST_REGIONS, obsShown:() => { let n = 0; group.traverse(o => { if (o.material === M.obsSlight || o.material === M.obsBad) n++; }); return n; }, settle:settleNow, ao:() => AO && {on:!AO.off, frames:AO.frames, ms:AO.ms}, look:(p, t, stand) => { anim = null; if (stand){ picking = false; setLook(true); } moveCam(new THREE.Vector3(...p), new THREE.Vector3(...t), true); invalidate(); }};
