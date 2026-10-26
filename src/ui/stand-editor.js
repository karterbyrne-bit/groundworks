/* ================= stand editor ================= */
const $ = id => document.getElementById(id);
const ringIdx = () => /^R\d+$/.test(tab) ? +tab.slice(1) : -1;
const cfgForTab = () => isRing() ? ringOf().stands[Math.max(0, ringIdx())] : isBowl() || (isHybrid() && tab === "B") ? S.bowl : (tab === "C" ? null : S.stands[tab]);
const tabName = key => /^R\d+$/.test(key) ? ((ringOf().stands[+key.slice(1)] || {}).name || "Stand " + (+key.slice(1) + 1)) : key === "B" ? (isHybrid() ? "Lower bowl" : "Bowl") : SIDE_NAMES[key] || "Corners";
const tiersEditable = () => (!isBowl() && tab === "C") ? S.cornerCustom : cfgForTab().tiers;
let clipboard = null;
function fixTab(){
  if (isRing()){ if (!ringOf().stands.length) S.ring.stands.push(ringStand(0)); if (ringIdx() < 0 || ringIdx() >= S.ring.stands.length) tab = "R0"; return; }
  if (/^R\d+$/.test(tab)) tab = "N";
  if (isBowl()) tab = "B";
  else if (tab === "B" && !isHybrid()) tab = "N";
}
function renderTabs(){
  const el = $("tabs");
  $("ringBox").hidden = !isRing();
  if (isBowl()){ el.hidden = true; return; }
  el.hidden = false;
  const items = [];
  if (isRing()){ const RG = ringOf();
    if (!$("ringBox").contains(document.activeElement)) $("ringBox").innerHTML = `<div class="row"><label>Stands round the ground</label><span class="num"><button class="mini" data-ring="-" aria-label="One fewer stand">−</button> <b>${RG.stands.length}</b> <button class="mini" data-ring="+" aria-label="One more stand">+</button></span></div>
      <div class="row"><label for="ringGap">Gap between stands</label><output>${RG.gap} m</output><input type="range" id="ringGap" data-rg="gap" min="0" max="40" step="1" value="${RG.gap}"></div>
      <div class="row"><label for="ringTurn">Turn the ring</label><output>${RG.turn}°</output><input type="range" id="ringTurn" data-rg="turn" min="0" max="359" step="1" value="${RG.turn}"></div>`;
    el.innerHTML = RG.stands.map((r, i) => `<button role="tab" aria-selected="${tab === "R" + i}" data-tab="R${i}">${esc(r.name || "Stand " + (i+1))}<span class="n">${r.tiers.length ? r.tiers.length + "T" : "gap"}</span></button>`).join("");
    return; }
  if (isHybrid()) items.push(["B","Lower bowl", S.bowl.tiers.length + "T"]);
  SIDES.forEach(s => items.push([s, SIDE_NAMES[s], S.stands[s].tiers.length ? S.stands[s].tiers.length + "T" : "none"]));
  items.push(["C","Corners", CORNERS.filter(c => { const P = cornerPlan(c); return P.wa || P.wb || P.ra > 0 || P.rb > 0 || P.stand; }).length + "/4"]);
  el.innerHTML = items.map(([k,label,n]) => `<button role="tab" aria-selected="${tab===k}" data-tab="${k}">${label}<span class="n">${n}</span></button>`).join("");
}
/* A slider paired with an exact number box, both bound to the same setting path. */
const pair = (label, p, val, min, max, step, unit, note) => `<div class="row pair"><label for="pp-${p.replace(/\./g,"-")}">${label}</label>
  <span class="num"><input type="number" data-p="${p}" value="${+(+val).toFixed(2)}" min="${min}" max="${max}" step="${step}" aria-label="${label}"> ${unit}</span>
  <input type="range" id="pp-${p.replace(/\./g,"-")}" data-p="${p}" min="${min}" max="${max}" step="${step}" value="${val}">${note ? `<small class="note">${note}</small>` : ""}</div>`;
const check = (label, p, val) => `<label class="toggle"><input type="checkbox" data-p="${p}"${val ? " checked" : ""}> ${label}</label>`;
const pick = (label, p, val, opts) => `<div class="row"><label>${label}</label><select data-p="${p}" aria-label="${label}">${Object.entries(opts).map(([k,v]) => `<option value="${k}"${k===val?" selected":""}>${v}</option>`).join("")}</select></div>`;
const SIDE_SHORT = {N:"Main", S:"Opposite", E:"East", W:"West"};
/* Rows for each side of a bowl, side by side, instead of one number for the whole way round. */
const TYPE_SHORT = {seated:"Seats", exec:"Boxes", rail:"Rail seats", bench:"Benches", terrace:"Terrace"};
const sideRowsBox = (tr, pre) => `<div class="row"><label>Seating and rows on each side</label></div><div class="siderows">${SIDES.map(s => { const gone = bowlGone(s), ty = sideTypeOf(tr, s);
  return `<label><span>${SIDE_SHORT[s]}</span><select data-p="${pre}sideType.${s}"${gone ? " disabled" : ""} aria-label="Seating on the ${SIDE_NAMES[s].toLowerCase()}">${Object.entries(TYPE_SHORT).map(([k,v]) => `<option value="${k}"${k === ty ? " selected" : ""}>${v}</option>`).join("")}</select>
    <input type="number" data-p="${pre}sideRows.${s}" value="${gone ? 0 : Math.round(sideRowsOf(tr, s))}" min="0" max="120" step="1"${gone ? " disabled" : ""} aria-label="${ty === "terrace" ? "Steps" : "Rows"} on the ${SIDE_NAMES[s].toLowerCase()}"></label>`; }).join("")}</div>`;
const TIER_FRONTS = {auto:"Stand's own style", plain:"Plain fascia", lattice:"Criss-cross lattice (Leitch)", glass:"Glass balustrade", concrete:"Concrete parapet", brick:"Brick parapet"};
const TIER_HOLDS = {none:"Nothing visible (cantilever)", pillars:"Pillars under its front edge", towers:"Towers at each end with a truss"};
const colourPick = (label, p, val, def) => `<div class="row colour"><label>${label}</label><span class="num"><input type="color" data-p="${p}" value="${val || def || "#888888"}" aria-label="${label}">
  ${val ? `<button class="mini" data-act="clearColour" data-cp="${p}">Default</button>` : `<small>default</small>`}</span></div>`;
/* The tier's own look, its length and what holds it up. */
const openMore = new Set();
const tierMore = (tr, pre, stacked, ends) => `<details class="sub" data-more="${tab}:${pre}"${openMore.has(tab + ":" + pre) ? " open" : ""}><summary>Look, entrances${ends ? ", length" : ""}${stacked ? " and support" : ""}</summary><div class="inner">
  ${pick("Front", pre + "front", tr.front || "auto", TIER_FRONTS)}
  ${colourPick("Front colour", pre + "frontColour", tr.frontColour)}
  ${tr.type === "seated" || tr.type === "rail" ? colourPick("Seat colour", pre + "seatColour", tr.seatColour) : ""}
  ${ends ? pair("Stops short of the left end", pre + "trim0", tr.trim0 || 0, 0, 80, 1, "m", "Left and right as seen from the play.") + pair("Stops short of the right end", pre + "trim1", tr.trim1 || 0, 0, 80, 1, "m") : ""}
  ${pick("Fans get in", pre + "entry", ENTRY[tr.entry] ? tr.entry : "auto", ENTRY)}
  ${tr.entry === "middle" ? pair("How far up the tier", pre + "entryAt", Math.round((tr.entryAt || .42)*100), 15, 85, 5, "%") : ""}
  ${tr.entry && tr.entry !== "auto" ? pair("One entrance every", pre + "entryEvery", tr.entryEvery || S.design.exitEvery, 8, 60, 1, "m") : ""}
  ${stacked ? pick("Held up by", pre + "support", tr.hold === "towers" ? "towers" : tr.pillars ? "pillars" : "none", TIER_HOLDS) : ""}
</div></details>`;
function tierBlocks(arr, above, base, bySide, ends){
  return arr.map((tr,k) => {
    const isT = tr.type === "terrace", nm = tierName(k, arr.length, above), stacked = k > 0 || above;
    const pre = (base ? base + "." : "") + "tiers." + k + ".";
    const depth = tr.rows * S.types[tr.type].row;
    return `<div class="tier" data-k="${k}"><div class="tier-h"><span>${nm ? nm + " tier" : "Tier"}</span><button class="mini" data-act="removeTier" data-k="${k}" aria-label="Remove this tier">Remove</button></div>
      ${bySide ? "" : `<div class="row"><label>Type</label><select data-p="${pre}type" aria-label="Seating type">${Object.entries(TYPES).map(([v,o]) => `<option value="${v}"${v===tr.type?" selected":""}>${o.label}</option>`).join("")}</select></div>`}
      ${bySide ? sideRowsBox(tr, pre) : pair(isT ? "Steps" : "Rows", pre + "rows", tr.rows, 1, 90, 1, "", `${depth.toFixed(1)} m deep`)}
      <div class="row"><label class="toggle"><input type="checkbox" data-p="${pre}auto"${tr.auto ? " checked" : ""}> Auto steepness</label><output id="o-rk-${k}"></output>
        ${tr.auto ? "" : `<input type="range" data-p="${pre}rake" min="8" max="60" step="1" value="${tr.rake}" aria-label="Steepness in degrees">`}</div>
      ${stacked ? `${pair("Projects forward over the tier below", pre + "over", tr.over || 0, -15, 40, 0.5, "m", "Negative sets it back instead.")}
      ${pair("Height above the tier below", pre + "gap", tr.gap == null ? 3 : tr.gap, 1.5, 40, 0.5, "m")}
` : ""}
      ${tierMore(tr, pre, stacked, ends)}
    </div>`;
  }).join("");
}
const groundRoofOn = () => !!(S.groundRoof && S.groundRoof.on);
function roofBlock(cfg, bowl){
  if (groundRoofOn()) return `<details class="sub" open><summary>Roof</summary><div class="inner"><p class="hint">One roof covers the whole ground, so this stand's own roof is set aside.
    Change it under <b>One roof over the whole ground</b> below, or switch that off to give each stand its own roof again.</p></div></details>`;
  const rf = cfg.roof, shapes = Object.assign({}, ROOF_SHAPES); if (!bowl) delete shapes.closed;
  const on = rf.shape !== "none";
  return `<details class="sub" open><summary>Roof</summary><div class="inner">
    ${pick("Shape", "roof.shape", rf.shape, shapes)}
    ${on ? `${pick("Material", "roof.mat", rf.mat, ROOF_MATS)}${pick("Structure", "roof.support", rf.support, ROOF_SUPPORTS)}
    ${pair("Reaches past the front row", "roof.reach", rf.reach, -40, 40, 0.5, "m", "Negative leaves the front rows open.")}
    ${check("Level roofline (one straight height along the stand)", "roof.level", rf.level !== false)}
    ${check("Line up every roof in the ground at the same height", "roofAlign", !!S.roofAlign)}
    ${pair(rf.level !== false ? "Height above the tallest row" : "Height above the top row", "roof.lift", rf.lift, 1.5, 40, 0.5, "m")}
    ${rf.shape !== "gable" ? pair("Tilt up towards the play", "roof.tilt", rf.tilt, -15, 25, 1, "°") + pair("Curve", "roof.curve", Math.round((rf.curve||0)*100), 0, 100, 5, "%") : ""}
    ${rf.shape !== "gable" ? pair("See-through strip at the front", "roof.edge", Math.round((rf.edge != null ? rf.edge : rf.mat === "metal" ? .2 : 0)*100), 0, 60, 5, "%", "Lets light reach the pitch, as most modern roofs do.") : ""}
    ${rf.shape === "closed" ? pair("Opening in the middle", "roof.opening", Math.round((rf.opening||0)*100), 0, 90, 5, "%") : ""}` : ""}
  </div></details>`;
}
/* A little plan of the bowl: tap a side or corner to leave it out. The main stand is at the top, as in Plan view. */
const BOWL_SHAPES = {full:["Full bowl", []], horseshoe:["Horseshoe", ["W","NW","SW"]], sides:["Two sides", ["E","W","NE","SE","SW","NW"]], ell:["L-shape", ["S","W","SE","SW","NW"]]};
function bowlShapeBlock(){
  const cn = {}; for (const c of CORNERS) cn[c.key] = c.name;
  const cell = k => { const on = !bowlGone(k), name = SIDE_NAMES[k] || cn[k];
    return `<button class="bp${k.length === 2 ? " corner" : ""}" data-piece="${k}" aria-pressed="${on}" aria-label="${name}: ${on ? "built" : "left out"}" title="${name}: ${on ? "tap to leave it out" : "tap to build it"}">${SIDE_SHORT[k] || ""}</button>`; };
  return `<details class="sub" open><summary>Shape of the bowl</summary><div class="inner">
    <p class="hint">Tap a side or a corner to leave it out, for a horseshoe or a bowl that stops short. The main stand is at the top, as in Plan view.</p>
    <div class="bowlplan">${cell("NW")}${cell("N")}${cell("NE")}${cell("W")}<span class="bp-floor">${field().custom ? "Floor" : "Pitch"}</span>${cell("E")}${cell("SW")}${cell("S")}${cell("SE")}</div>
    <div class="scales"><span>Quick shape:</span>${Object.entries(BOWL_SHAPES).map(([k,[label]]) => `<button class="btn small" data-act="bowlShape" data-shape="${k}">${label}</button>`).join("")}</div>
    ${check("Give each side its own seating and rows", "bowlVary", !!S.bowl.varyRows)}
    ${S.bowl.varyRows ? `<p class="hint">Each side can have its own seating (a seated main stand with terraces round the rest, say) and depth; the corners blend from one side to the next. Set a tier to 0 rows on a side to leave it off there.</p>` : ""}
  </div></details>`;
}
/* Corner controls. A corner is what's left between two stands: each stand sets how far it runs or wraps into it, and the
   corner says what fills any gap. */
const pct = v => Math.round(v*100) + "%";
const lower = k => SIDE_NAMES[k].toLowerCase();
function cornerSummary(c){
  const P = cornerPlan(c), A = S.stands[c.a], B = S.stands[c.b], bits = [];
  if (P.ra > 0) bits.push(`The ${lower(c.a)} runs ${Math.round(P.ra)} m past the pitch into it.`);
  if (P.rb > 0) bits.push(`The ${lower(c.b)} runs ${Math.round(P.rb)} m past the pitch into it.`);
  if (P.wa > 0) bits.push(`The ${lower(c.a)} wraps ${pct(P.wa)} of the way round.`);
  if (P.wb > 0) bits.push(`The ${lower(c.b)} wraps ${pct(P.wb)} of the way round.`);
  if (P.meet) bits.push("They meet, so the corner is filled.");
  else if (!P.gap) bits.push("Nothing else fits.");
  else if (!bits.length) bits.push(A.tiers.length || B.tiers.length ? "Neither stand comes into it." : "There are no stands either side yet.");
  return bits.join(" ");
}
/* How far a stand runs or wraps at one end, and a word on what's stopping it when another stand has the corner. */
function endControls(cfg, s, e){
  const ck = SIDE_ENDS[s][e], c = CORNERS.find(x => x.key === ck), other = c.a === s ? c.b : c.a, P = cornerPlan(c), mine = c.a === s ? {w:P.wa, r:P.ra} : {w:P.wb, r:P.rb};
  const want = {w:+cfg["wrap" + e] || 0, r:+cfg["run" + e] || 0}, stands = layoutOf() === "stands";
  let note = "";
  if (want.w > 0.005 && mine.w < 0.005) note = `The ${lower(other)} already has this corner, so this end stops at the pitch.`;
  else if (want.w > mine.w + 0.01) note = `It meets the ${lower(other)}, ${pct(mine.w)} of the way round.`;
  else if (stands && !want.w && want.r > 0 && mine.r <= 0) note = `The ${lower(other)} already comes into this corner, so this end stops at the pitch.`;
  return `<div class="tier-h"><span>Towards the ${lower(other)}</span></div>
    <div class="row"><label>Wraps round the corner</label><output>${pct(want.w)}</output>
      <input type="range" data-wrap="${e}" min="0" max="100" step="5" value="${Math.round(want.w*100)}" aria-label="How far the stand wraps round towards the ${lower(other)}"></div>
    ${stands && !want.w ? pair("Runs past the pitch", "run" + e, want.r, -40, 60, 1, "m", "Negative stops it short of the pitch.") : ""}
    ${note ? `<p class="hint">${note}</p>` : ""}`;
}
function renderEditor(){
  fixTab(); renderTabs();
  const ed = $("editor"), hyb = isHybrid();
  // the toggle event comes a moment after a click, so note what's open now in case this redraw beats it
  ed.querySelectorAll("details[data-more]").forEach(d => { if (d.open) openMore.add(d.dataset.more); else openMore.delete(d.dataset.more); });
  if (!isBowl() && tab === "C"){
    const anyStand = CORNERS.some(c => cornerPlan(c).stand);
    ed.innerHTML = `<p class="hint">A corner is whatever is left between two stands. Each stand sets how far it runs past the pitch or wraps round into the corner (under that stand's <b>Length</b>); here you choose what fills any gap. The shape (curved, angled or right angle) is under Layout.</p>
      ${CORNERS.map(c => { const cc = S.corners[c.key], P = cornerPlan(c); return `<div class="cornerbox"><div class="tier-h"><span>${c.name}</span></div>
        <p class="hint">${cornerSummary(c)}</p>
        ${P.gap ? `<div class="row"><label>The gap</label><select data-corner="${c.key}" data-cf="mode" aria-label="What fills ${c.name}">
          ${[["open","Left open"],["stand","Its own corner stand"]].map(([v,l]) => `<option value="${v}"${(cc.mode === "stand") === (v === "stand") ? " selected" : ""}>${l}</option>`).join("")}</select></div>
          ${cc.mode === "stand" ? `<label class="toggle"><input type="checkbox" data-corner="${c.key}" data-cf="roof"${cc.roof ? " checked" : ""}> Roof over the corner stand</label>` : ""}` : ""}
        <div class="acts-row"><button class="btn small" data-cfill="${c.key}">Fill it with the stands</button><button class="btn small" data-copen="${c.key}">Open it up</button></div></div>`; }).join("")}
      <button class="btn link" id="allCorners">Make all four corners match the first</button>
      ${anyStand ? `<div class="tier-h" style="margin-top:4px"><span>Corner stand tiers</span></div><p class="hint">Every corner stand uses these tiers.</p>${tierBlocks(S.cornerCustom, hyb, "cc")}<button class="btn small" data-act="addTier">Add a tier</button>` : ""}`;
  } else {
    const cfg = cfgForTab(), bowl = isBowl(), ring = hyb && tab === "B", above = hyb && !ring, side = !bowl && !ring;
    const sty = STYLES[cfg.style] || STYLES.modern, fac = cfg.facade || {};
    const eras = {}; for (const [k,v] of Object.entries(STYLES)) (eras[v.era] = eras[v.era] || []).push([k,v]);
    ed.innerHTML = `<div class="summary" id="standSummary"></div>
      <div class="acts-row">
        <button class="btn small" data-act="addTier">+ Tier</button>
        <button class="btn small" data-act="addBoxes">+ Executive boxes</button>
        ${ring || groundRoofOn() ? "" : `<button class="btn small" data-act="toggleRoof">${cfg.roof.shape === "none" ? "+ Roof" : "Remove roof"}</button>`}
        ${side && OPPOSITE[tab] ? `<button class="btn small" data-act="mirror">Copy to the ${SIDE_NAMES[OPPOSITE[tab]].toLowerCase()}</button>` : ""}
        <button class="btn small" data-act="copy">Copy settings</button>
        <button class="btn small" data-act="paste"${clipboard ? "" : " disabled"}>Paste settings</button>
        ${ring || groundRoofOn() ? "" : `<button class="btn small" data-act="altRoof">Try another roof</button>`}
        <button class="btn small" data-act="surprise">Surprise me</button>
        <button class="btn small" data-act="reset">Reset</button>
      </div>
      <div class="row"><label for="sty">Architecture</label><select id="sty" data-act-change="style">${Object.entries(eras).map(([era, list]) => `<optgroup label="${era}">${list.map(([v,o]) => `<option value="${v}"${v===cfg.style?" selected":""}>${o.label}</option>`).join("")}</optgroup>`).join("")}</select></div>
      <p class="hint">${sty.note} Picking a style brings in its own tiers, overhangs, roof and façade; everything stays editable.</p>
      <details class="sub" data-standlib data-more="lib"${openMore.has("lib") ? " open" : ""}><summary>Famous stands and my stands</summary><div class="inner">
        <div class="row"><label for="standPre">Start this stand from</label><select id="standPre" aria-label="Start this stand from"><option value="">Pick a stand…</option>
          <optgroup label="Famous kinds of stand">${Object.entries(STAND_PRESETS).map(([k, v]) => `<option value="p:${k}">${esc(v.label)}</option>`).join("")}</optgroup>
          ${readStands().length ? `<optgroup label="My stands">${readStands().map((x, i) => `<option value="m:${i}">${esc(x.name)}</option>`).join("")}</optgroup>` : ""}</select></div>
        <p class="hint">It keeps this stand's place, length and name, and brings in the tiers, roof and walls. Undo if you liked it better before.</p>
        <div class="saverow"><input type="text" id="standName" maxlength="30" placeholder="Name this stand" aria-label="Name for this stand"><button class="btn small" data-act="saveStand">Save to my stands</button></div>
        ${readStands().length ? `<ul class="savelist">${readStands().map((x, i) => `<li><span>${esc(x.name)}</span><button class="mini" data-act="delStand" data-i="${i}">Delete</button></li>`).join("")}</ul>` : ""}
      </div></details>
      ${ring ? "" : `<div class="scales"><span>Quick size:</span>${Object.entries(SCALES).map(([k,v]) => `<button class="btn small" data-act="scale" data-scale="${k}">${v.label}</button>`).join("")}</div>`}
      ${(side && layoutOf() === "stands") || (above && SIDE_ENDS[tab]) ? `<details class="sub" open><summary>${above ? "Length" : "Position and length"}</summary><div class="inner">
        ${above ? "" : check("Same distance from the play as the other stands", "distSame", cfg.dist == null)}
        ${above || cfg.dist == null ? "" : pair("Distance from the play", "dist", cfg.dist, Math.max(1, hardStop()), 80, 0.5, "m")}
        <p class="hint">${above ? "How far round into each corner this stand's tiers carry on over the bowl." : "How far this stand runs past the pitch, or wraps round into the corner, at each end. Two stands that wrap in meet up."}</p>
        ${[0, 1].map(e => endControls(cfg, tab, e)).join("")}</div></details>` : ""}
      ${isRing() ? `<details class="sub" open><summary>Place in the ring</summary><div class="inner">
        <div class="row"><label for="ringName">Name</label><input type="text" id="ringName" data-p="name" maxlength="30" value="${esc(cfg.name || "")}" aria-label="Stand name"></div>
        ${pair("Share of the way round", "share", cfg.share || 1, 0.2, 4, 0.1, "×", "Bigger stands take more of the ring; take all its tiers away to leave a gap.")}</div></details>` : ""}
      ${above ? `<p class="hint">These tiers sit on top of the lower bowl and follow its shape. Remove them all to leave just the bowl here, with or without a roof.${bowlGone(tab) ? " The lower bowl is left out on this side, so they start at ground level." : ""}</p>` : ""}
      ${bowl || ring ? bowlShapeBlock() : ""}
      ${tierBlocks(cfg.tiers, above, "", (bowl || ring) && S.bowl.varyRows, !bowl && !ring)}
      ${cfg.tiers.length < MAX_TIERS ? `<button class="btn small" data-act="addTier">Add a tier</button>` : `<p class="hint">${MAX_TIERS} tiers is as high as it goes.</p>`}
      ${ring ? "" : roofBlock(cfg, bowl)}
      <details class="sub"><summary>Facilities, access and fire risk</summary><div class="inner">
        ${pick("Facilities", "facilities", facilitiesOf(cfg), FACILITIES)}
        <p class="hint">Better facilities cost more to build but make for happier fans (see the Architect's notes under Results).</p>
        ${accessOf().on ? (() => { const SA = standAccessOf(cfg), own = cfg.access || {}, here = LAST ? LAST.parts.filter(p => p.key === tab).reduce((a, p) => a + (p.wheel || 0), 0) : 0;
          return `<div class="row"><label>Wheelchair platforms</label><output>${here} spaces here</output></div>
            ${pair(isBowl() ? "Platforms on each side" : "Platforms in this stand", "access.count", SA.per, 0, 16, 1, "")}
            ${pick("Where", "access.at", own.at || "", Object.assign({"":"Same as the whole ground"}, ACCESS_AT))}
            ${pick("Arranged", "access.arrange", own.arrange || "", Object.assign({"":"Same as the whole ground"}, ACCESS_ARRANGE))}
            ${pair("Length of each", "access.length", SA.length, 4, 30, 1, "m", `${Math.floor(SA.length/1.6)} spaces each, with a companion seat beside every one.`)}`; })() : ""}
        ${pick("Fire risk", "fire", cfg.fire || "auto", FIRE_RISKS)}
        <p class="hint">Sets how quickly this stand has to clear in an emergency: ${S.limits.evacLow} minutes for low risk, ${S.limits.evacMedium} for medium, ${S.limits.evacHigh} for high. Worked out from its style, this one counts as <b>${fireRiskOf(cfg)}</b>.</p></div></details>
      ${ring ? "" : `<details class="sub" open><summary>Outside walls</summary><div class="inner">
        ${pick("Look", "facade.look", FACADE_LOOKS[fac.look] ? fac.look : sty.look || "plain", FACADE_LOOKS)}
        ${colourPick("Wall colour", "facade.colour", fac.colour, "#" + (sty.clad || 0x888888).toString(16).padStart(6, "0"))}
        ${colourPick("Accent colour", "facade.accent", fac.accent, "#d9d2c2")}
        <p class="hint">The accent colours the trims, bands, ribs and fins.</p>
        ${pair("Windows", "facade.windows", fac.windows == null ? 1 : fac.windows, 0, 2, 0.25, "×", "0 leaves the wall blank, 2 doubles them.")}
        ${pair("Window size", "facade.winSize", fac.winSize || 1, 0.5, 1.6, 0.1, "×")}
        ${check("Glazed concourse along the ground floor", "facade.concourse", fac.concourse)}
        <div class="row"><label for="facSign">Lettering</label><input type="text" id="facSign" data-p="facade.sign" maxlength="30" value="${esc(fac.sign || "")}" placeholder="e.g. YOUR CLUB" aria-label="Lettering"></div>
        ${fac.sign ? pick("Lettering goes", "facade.signAt", fac.signAt || "wall", {wall:"On the outside wall", roof:"Along the roof front"}) + colourPick("Lettering colour", "facade.signColour", fac.signColour, "#ffffff") : ""}
        ${check("Stair towers", "facade.towers", fac.towers)}${check("Entrance gates", "facade.gates", fac.gates)}
        ${sty.era === "Traditional" && cfg.roof && cfg.roof.shape !== "none" ? check("Leitch gable with the club's name in the middle of the roof", "facade.gable", fac.gable) : ""}
        ${pick("Stand clock", "facade.clock", fac.clock || "", {"":"None", roof:"On the roof, facing the pitch", wall:"On the back wall, facing the street"})}
        <button class="btn link" data-act="seeOutside">See it from the street</button></div></details>`}`;
  }
  refreshOutputs(); renderSummary(); renderGroundRoof();
}
function renderSummary(){
  const el = $("standSummary"); if (!el || !LAST) return;
  const si = LAST.standInfo[tab]; const name = tabName(tab);
  const mine = mergeParts(LAST.parts.filter(p => p.key === tab)), tiers = [].concat(...mine.map(p => p.tiers || []));
  el.innerHTML = si ? `<b>${name}</b>${tab === "C" ? "" : `<span>${fmt(si.width)} m long</span>`}<span>${fmt(si.depth)} m deep</span><span>${fmt(si.height)} m high</span><span>${fmt(si.seats)} places</span>` +
    (tiers.length ? `<div class="tierlist">${tiers.map(t => `<span><em>${esc(t.name)}</em> ${fmt(t.seats)} · ${t.rows} rows ${TYPES[t.type].short}</span>`).join("")}</div>` : "")
    : `<b>${name}</b><span>Nothing built here yet.</span>`;
}
function refreshOutputs(){
  const arr = (!isBowl() && tab === "C") ? S.cornerCustom : (cfgForTab() || {}).tiers || [];
  arr.forEach((tr,k) => {
    const rk = $("o-rk-"+k); if (!rk) return;
    const lim = tr.type === "terrace" ? S.limits.terraceRake : S.limits.seatRake;
    const info = LAST && LAST.steepInfo[tab];
    const v = tr.auto ? (info && info[k] ? info[k] : 0) : tr.rake, over = v > lim + 0.05;
    rk.textContent = (tr.auto ? (v ? "up to " + Math.round(v) + "°" : "auto") : tr.rake + "°") + (over ? " · over " + lim + "°" : "");
    rk.classList.toggle("over", over);
    // rows the plot leaves off: say so under the rows, or adding rows looks like it does nothing
    const rowsIn = $("editor").querySelector(`input[type=range][data-p$="tiers.${k}.rows"]`), note = rowsIn && rowsIn.closest(".pair").querySelector(".note");
    if (note){ const c = LAST && LAST.cutInfo && LAST.cutInfo[tab] && LAST.cutInfo[tab][k], word = tr.type === "terrace" ? "steps" : "rows";
      note.innerHTML = (tr.rows*S.types[tr.type].row).toFixed(1) + " m deep" + (c && c.fit < c.want ? ` · <span class="cut">Only ${c.fit} of ${c.want} ${word} fit ${LAST.poly ? "inside the plot" : "clear of the surroundings"}</span>` : ""); }
  });
}
function applyStyle(cfg, key, ring){
  const st = STYLES[key], tiers = st.tiers();
  cfg.style = key; cfg.facade = Object.assign({}, st.facade);
  cfg.tiers = ring ? tiers.slice(0, 1) : isHybrid() ? (tiers.length > 1 ? tiers.slice(1) : tiers) : tiers;
  const roof = st.roof(); if (isBowl() && roof.shape === "gable") roof.shape = "slope"; cfg.roof = roof;
}
function targetObj(){ return (!isBowl() && tab === "C") ? {tiers:S.cornerCustom} : cfgForTab(); }
const getPath = (obj, path) => path.split(".").reduce((o, k) => o == null ? o : o[k], obj);
/* Redraw the editor without losing the typing cursor (for when lettering appears or goes and its options change). */
function renderEditorKeepFocus(el){ const id = el.id, pos = el.selectionStart; renderEditor(); const n = id && document.getElementById(id); if (n){ n.focus(); try { n.setSelectionRange(pos, pos); } catch(e) {} } }
function setPath(obj, path, val){
  const parts = path.split("."); if (parts[0] === "cc"){ obj = {tiers:S.cornerCustom}; parts.shift(); }
  let o = obj; for (let i=0;i<parts.length-1;i++) o = o[parts[i]] = o[parts[i]] || {};
  const last = parts[parts.length-1];
  if (last === "curve" || last === "opening" || last === "entryAt" || last === "edge") val = val/100;
  o[last] = val;
}
$("editor").addEventListener("toggle", e => { const d = e.target; if (d.dataset && d.dataset.more){ if (d.open) openMore.add(d.dataset.more); else openMore.delete(d.dataset.more); } }, true);
$("ringBox").addEventListener("click", e => { const b = e.target.closest("[data-ring]"); if (!b) return; const RG = ringOf();
  if (b.dataset.ring === "+"){ if (RG.stands.length >= 16) return flash("<b>Sixteen stands is the most a ring can have.</b>"); RG.stands.push(ringStand(RG.stands.length)); tab = "R" + (RG.stands.length - 1); }
  else { if (RG.stands.length <= 1) return; RG.stands.pop(); if (ringIdx() >= RG.stands.length) tab = "R" + (RG.stands.length - 1); }
  $("ringBox").innerHTML = ""; renderEditor(); changed(); });
$("ringBox").addEventListener("input", e => { const el = e.target; if (!el.dataset.rg) return; ringOf()[el.dataset.rg] = +el.value;
  el.parentElement.querySelector("output").textContent = el.value + (el.dataset.rg === "turn" ? "°" : " m"); changed(false, true); });
$("tabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (!b) return; selectTab(b.dataset.tab, false); });
$("editor").addEventListener("input", e => {
  const el = e.target, p = el.dataset.p;
  if (el.dataset.wrap){ const cfg = cfgForTab(); cfg["wrap" + el.dataset.wrap] = +el.value/100; el.parentElement.querySelector("output").textContent = el.value + "%"; changed(false, true); return; }
  if (!p || el.tagName === "SELECT") return;
  if (el.type === "checkbox"){
    if (p === "roofAlign"){ S.roofAlign = el.checked; changed(); return; }
    if (p === "roof.level"){ setPath(targetObj(), p, el.checked); renderEditor(); changed(); return; }
    if (p === "bowlVary"){ S.bowl.varyRows = el.checked;
      if (el.checked) S.bowl.tiers.forEach(tr => { tr.sideRows = {N:tr.rows, S:tr.rows, E:tr.rows, W:tr.rows}; tr.sideType = {N:tr.type, S:tr.type, E:tr.type, W:tr.type}; });
      else S.bowl.tiers.forEach(tr => { if (tr.sideRows) tr.rows = Math.max(1, ...SIDES.filter(s2 => !bowlGone(s2)).map(s2 => tr.sideRows[s2] != null ? tr.sideRows[s2] : tr.rows)); }); // keep the deepest side
      renderEditor(); changed(); return; }
    if (p === "distSame"){ cfgForTab().dist = el.checked ? null : (LAST ? LAST.set : S.setback); renderEditor(); changed(); return; }
    setPath(targetObj(), p, el.checked);
    if (p.endsWith(".auto")) renderEditor();
    changed(); return;
  }
  if (el.type === "color"){ setPath(targetObj(), p, el.value); changed(false, true); return; }
  if (el.type === "text"){ const had = !!getPath(targetObj(), p); setPath(targetObj(), p, el.value.replace(/[<>"'`\\]/g, "").slice(0, 30)); if (had !== !!el.value) renderEditorKeepFocus(el); changed(false, true); return; }
  const v = +el.value; if (!isFinite(v)) return;
  setPath(targetObj(), p, p.includes(".sideRows.") ? clamp(Math.round(v), 0, 120) : el.type === "number" && p.endsWith("rows") ? Math.max(1, Math.round(v)) : v);
  $("editor").querySelectorAll(`[data-p="${p}"]`).forEach(o => { if (o !== el) o.value = el.value; });
  if (p.endsWith(".rows")){ const tr = p.split(".").slice(-2)[0], tier = targetObj().tiers[+tr]; const note = el.closest(".pair").querySelector(".note"); if (note) note.textContent = (tier.rows*S.types[tier.type].row).toFixed(1) + " m deep"; }
  refreshOutputs(); changed(false, el.type === "range");
});
$("editor").addEventListener("change", e => {
  const el = e.target;
  if (el.id === "standPre" && el.value){ const [kind, key] = el.value.split(":"), from = kind === "p" ? STAND_PRESETS[key] && STAND_PRESETS[key].cfg() : (readStands()[+key] || {}).cfg;
    if (from){ applyStandCfg(clone(from)); flash(`<b>${esc(kind === "p" ? STAND_PRESETS[key].label : readStands()[+key].name)}.</b> ${kind === "p" ? esc(STAND_PRESETS[key].note) : ""}`, UNDO); } return; }
  if (el.dataset.wrap){ renderEditor(); return; } // runs and notes depend on how far it wraps
  if (el.dataset.corner){ const cc = S.corners[el.dataset.corner], f = el.dataset.cf; cc[f] = el.type === "checkbox" ? el.checked : el.value; renderEditor(); changed(); return; }
  if (el.dataset.actChange === "style"){ applyStyle(cfgForTab(), el.value, isHybrid() && tab === "B"); renderEditor(); changed(); return; }
  if (el.tagName === "SELECT" && el.dataset.p && el.dataset.p.endsWith(".support")){ // pillars, towers or nothing
    const tr = el.dataset.p.split(".").slice(0, -1).reduce((o, k) => o[k], el.dataset.p.startsWith("cc.") ? {cc:{tiers:S.cornerCustom}} : targetObj());
    tr.pillars = el.value === "pillars"; if (el.value === "towers") tr.hold = "towers"; else delete tr.hold; renderEditor(); changed(); return; }
  if (el.type === "color") return;
  if (el.tagName === "SELECT" && el.dataset.p && el.dataset.p.includes(".sideType.")){ // keep the side as deep as it was
    const parts = el.dataset.p.split("."), side = parts.pop(), tr = parts.slice(0, -1).reduce((o, k) => o[k], targetObj());
    const from = sideTypeOf(tr, side), rows = sideRowsOf(tr, side);
    tr.sideType = Object.assign({}, tr.sideType, {[side]: el.value});
    tr.sideRows = Object.assign({}, tr.sideRows, {[side]: Math.max(1, Math.round(rows*S.types[from].row/S.types[el.value].row))});
    renderEditor(); changed(); return; }
  if (el.tagName === "SELECT" && el.dataset.p){ setPath(targetObj(), el.dataset.p, el.value); renderEditor(); changed(); }
});
$("editor").addEventListener("click", e => {
  const pc = e.target.closest("[data-piece]");
  if (pc){ const k = pc.dataset.piece, gone = Object.assign({}, S.bowl.removed), was = !!gone[k];
    gone[k] = !was;
    if (SIDE_ENDS[k]) for (const ck of SIDE_ENDS[k]){ // a side takes the corners at its ends with it, and brings them back where the other side is built
      const c = CORNERS.find(x => x.key === ck), other = c.a === k ? c.b : c.a;
      if (!was) gone[ck] = true; else if (!gone[other]) gone[ck] = false; }
    if (BOWL_PIECES.every(x => gone[x])) return flash("<b>A bowl needs at least one part.</b> Build another side first.");
    for (const x in gone) if (!gone[x]) delete gone[x];
    S.bowl.removed = gone; renderEditor(); changed(); return; }
  const cf = e.target.closest("[data-cfill],[data-copen]");
  if (cf){ const c = CORNERS.find(x => x.key === (cf.dataset.cfill || cf.dataset.copen)), A = S.stands[c.a], B = S.stands[c.b], ta = A.tiers.length > 0, tb = B.tiers.length > 0;
    A.run1 = Math.min(0, A.run1 || 0); B.run0 = Math.min(0, B.run0 || 0); // nothing pushes straight in any more
    if (cf.dataset.cfill){ if (!ta && !tb) return flash("<b>There's no stand either side of this corner yet.</b> Give one some tiers first.");
      A.wrap1 = ta ? (tb ? .5 : 1) : 0; B.wrap0 = tb ? (ta ? .5 : 1) : 0; }
    else { A.wrap1 = 0; B.wrap0 = 0; S.corners[c.key].mode = "open"; }
    renderEditor(); changed(); return; }
  const b = e.target.closest("[data-act]"); if (!b) { if (e.target.id === "allCorners"){ // the first corner's set-up, stand by stand, in all four
      const v = clone(S.corners.NE), N0 = S.stands.N, E0 = S.stands.E, wa = N0.wrap1 || 0, wb = E0.wrap0 || 0, ra = N0.run1 || 0, rb = E0.run0 || 0;
      for (const c of CORNERS){ S.corners[c.key] = clone(v); Object.assign(S.stands[c.a], {wrap1:wa, run1:ra}); Object.assign(S.stands[c.b], {wrap0:wb, run0:rb}); }
      renderEditor(); changed(); } return; }
  const act = b.dataset.act, cfg = cfgForTab(), arr = tiersEditable();
  const say = m => flash(m);
  if (act === "addTier"){ if (arr.length >= MAX_TIERS) return say(`<b>${MAX_TIERS} tiers is as high as a stand goes.</b>`);
    const k = arr.length; arr.push(t("seated", [18,14,12][k] || 10, Math.min(34, 22 + 4*k), true, k ? {over: k > 1 ? -2 : 3, gap:3.6} : {})); }
  if (act === "removeTier"){ arr.splice(+b.dataset.k, 1); if (!arr.length && (isBowl() || (isHybrid() && tab === "B"))) arr.push(t("seated",16,22)); }
  if (act === "addBoxes"){ if (arr.length >= MAX_TIERS) return say(`<b>${MAX_TIERS} tiers is as high as a stand goes.</b> Remove one first.`);
    const at = Math.min(1, arr.length); arr.splice(at, 0, t("exec", 4, 22, true, at || isHybrid() ? {over:2, gap:3.6} : {})); }
  if (act === "toggleRoof"){ cfg.roof = cfg.roof.shape === "none" ? STYLES[cfg.style].roof() : Object.assign({}, cfg.roof, {shape:"none"}); if (cfg.roof.shape === "none" && STYLES[cfg.style].roof().shape === "none" && b.textContent.includes("+")) cfg.roof = R("slope"); }
  if (act === "clearColour"){ const parts = b.dataset.cp.split("."), tr = parts.slice(0, -1).reduce((o, k) => o[k], b.dataset.cp.startsWith("cc.") ? {cc:{tiers:S.cornerCustom}} : targetObj()); delete tr[parts[parts.length-1]]; }
  if (act === "bowlShape"){ const [label, gone] = BOWL_SHAPES[b.dataset.shape]; S.bowl.removed = {}; for (const k of gone) S.bowl.removed[k] = true;
    flash(`<b>${label}.</b> Tap the plan to fine-tune it.`, UNDO); }
  if (act === "mirror"){ const m2 = clone(cfg); [m2.run0, m2.run1, m2.wrap0, m2.wrap1] = [cfg.run1, cfg.run0, cfg.wrap1, cfg.wrap0]; // the opposite stand runs the other way round
    S.stands[OPPOSITE[tab]] = m2; flash(`<b>Copied</b> to the ${SIDE_NAMES[OPPOSITE[tab]].toLowerCase()}.`, UNDO); }
  if (act === "seeOutside"){ goCam("exterior"); return; }
  if (act === "saveStand"){ const nm = cleanName($("standName").value || "").trim() || "My stand " + (readStands().length + 1), list = readStands();
    const keep = clone(cfg); for (const k of ["dist","run0","run1","wrap0","wrap1","name","share","removed","varyRows"]) delete keep[k];
    list.unshift({name:nm, cfg:keep}); writeStands(list.slice(0, 40)); flash(`<b>Saved “${esc(nm)}”</b> to your stands. Pick it from <b>Start this stand from</b> on any stand, in any design.`); renderEditor(); return; }
  if (act === "delStand"){ const list = readStands(), gone = list.splice(+b.dataset.i, 1)[0]; writeStands(list);
    flash(`<b>Deleted “${esc(gone ? gone.name : "")}”.</b>`, {label:"Undo", run:() => { const l2 = readStands(); l2.splice(+b.dataset.i, 0, gone); writeStands(l2); renderEditor(); }}); renderEditor(); return; }
  if (act === "copy"){ clipboard = clone(cfg); say("<b>Copied.</b> Pick another stand and paste."); renderEditor(); return; }
  if (act === "paste" && clipboard){ const c2 = clone(clipboard); if (isHybrid() && tab === "B") c2.tiers = c2.tiers.slice(0,1); Object.assign(cfg, c2); }
  if (act === "reset"){ const fresh = mk(cfg.style); if (isHybrid()) fresh.tiers = tab === "B" ? fresh.tiers.slice(0,1) : fresh.tiers.slice(1); Object.assign(cfg, fresh); }
  if (act === "scale"){ const sc = SCALES[b.dataset.scale]; cfg.tiers = sc.tiers(); if (isHybrid()) cfg.tiers = cfg.tiers.slice(1); if (cfg.roof.shape !== "none") Object.assign(cfg.roof, sc.roof); }
  if (act === "altRoof"){ const rnd = a => a[Math.floor(Math.random()*a.length)];
    cfg.roof = R(rnd(["slope","slope","gable"]), {mat:rnd(Object.keys(ROOF_MATS)), support:rnd(Object.keys(ROOF_SUPPORTS)), reach:r05(-6 + Math.random()*12), lift:r05(3 + Math.random()*7), tilt:Math.round(-4 + Math.random()*14), curve:Math.random() < .4 ? +(Math.random()*.8).toFixed(2) : 0});
    if (isBowl() && cfg.roof.shape === "gable") cfg.roof.shape = "slope"; }
  if (act === "surprise"){ const keys = Object.keys(STYLES).filter(k => k !== cfg.style), k = keys[Math.floor(Math.random()*keys.length)], st = STYLES[k];
    cfg.style = k; cfg.facade = Object.assign({}, st.facade); const ro = st.roof(); if (ro.shape !== "none" || cfg.roof.shape === "none") cfg.roof = Object.assign(ro, {shape: isBowl() && ro.shape === "gable" ? "slope" : ro.shape});
    flash(`<b>Restyled as ${st.label}.</b> Tiers kept as they were.`, UNDO); }
  renderEditor(); changed();
});

/* ================= one roof over the whole ground ================= */
const groundRoofOf = () => (S.groundRoof = Object.assign({}, GROUND_ROOF, S.groundRoof || {}));
function renderGroundRoof(){
  const box = $("groundRoof"), on = groundRoofOn(); box.hidden = !on; if (!on){ box.innerHTML = ""; return; }
  const gr = groundRoofOf(), p = k => "gr." + k;
  box.innerHTML = `${pick("Outline", p("shape"), gr.shape, GROUND_ROOF_SHAPES)}${pick("Cover", p("cover"), gr.cover, GROUND_ROOF_COVER)}
    ${gr.cover === "closed" ? pair("Opening in the middle", p("opening"), Math.round((gr.opening||0)*100), 0, 90, 5, "%") : ""}
    ${pick("Material", p("mat"), gr.mat, ROOF_MATS)}${pick("Structure", p("support"), gr.support, GROUND_ROOF_SUPPORTS)}
    ${pair("Reaches past the front row", p("reach"), gr.reach, -20, 40, 0.5, "m", gr.shape === "follow" ? "Negative leaves the front rows open." : "Measured halfway along the long sides. Negative leaves the front rows open.")}
    ${pair("Overhang behind the back row", p("back"), gr.back, 0, 30, 0.5, "m")}
    ${pair("Height above the tallest stand", p("lift"), gr.lift, 1.5, 40, 0.5, "m")}
    ${pair("Tilt up towards the play", p("tilt"), gr.tilt, -15, 25, 1, "°")}${pair("Curve", p("curve"), Math.round((gr.curve||0)*100), 0, 100, 5, "%")}
    ${check("Close in the outside, down to the ground", p("wall"), gr.wall)}`;
}
$("grOn").addEventListener("change", e => { groundRoofOf().on = e.target.checked; renderGroundRoof(); renderEditor(); changed(); });
$("groundRoof").addEventListener("input", e => { const el = e.target, p = el.dataset.p; if (!p || el.tagName === "SELECT") return;
  const key = p.slice(3), gr = groundRoofOf();
  if (el.type === "checkbox"){ gr[key] = el.checked; changed(); return; }
  const v = +el.value; if (!isFinite(v)) return;
  gr[key] = key === "curve" || key === "opening" ? v/100 : v;
  $("groundRoof").querySelectorAll(`[data-p="${p}"]`).forEach(o => { if (o !== el) o.value = el.value; });
  changed(false, el.type === "range"); });
$("groundRoof").addEventListener("change", e => { const el = e.target; if (el.tagName !== "SELECT" || !el.dataset.p) return; groundRoofOf()[el.dataset.p.slice(3)] = el.value; renderGroundRoof(); changed(); });

