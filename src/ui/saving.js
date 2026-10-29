/* ================= saved designs ================= */
/* My stands: single stands saved to reuse in any design, kept in this browser like saved designs. */
const STANDS_KEY = "groundworks-stands";
function readStands(){ try { const l = JSON.parse(localStorage.getItem(STANDS_KEY)); return Array.isArray(l) ? l.filter(x => x && x.cfg && Array.isArray(x.cfg.tiers)) : []; } catch(e) { return []; } }
function writeStands(list){ try { localStorage.setItem(STANDS_KEY, JSON.stringify(list)); } catch(e) { flash("<b>Couldn't save:</b> this browser isn't allowing storage here."); } }
/* Bring a stand's tiers, roof and walls onto the stand being edited, keeping its place, length and name. */
function applyStandCfg(from){
  const cfg = cfgForTab(), keep = {}; for (const k of ["dist","run0","run1","wrap0","wrap1","name","share","removed","varyRows"]) if (cfg[k] !== undefined) keep[k] = cfg[k];
  for (const k of Object.keys(cfg)) delete cfg[k]; Object.assign(cfg, from, keep);
  if (isHybrid() && tab === "B") cfg.tiers = cfg.tiers.slice(0, 1);
  if ((isBowl() || (isHybrid() && tab === "B")) && cfg.roof && cfg.roof.shape === "gable") cfg.roof.shape = "slope";
  if (S.bowl.varyRows && cfg === S.bowl) for (const tr of cfg.tiers) if (!tr.sideRows){ tr.sideRows = {N:tr.rows, S:tr.rows, E:tr.rows, W:tr.rows}; tr.sideType = {N:tr.type, S:tr.type, E:tr.type, W:tr.type}; }
  renderEditor(); changed(true);
}
function readSaves(){ try { return JSON.parse(localStorage.getItem(SAVES_KEY)) || []; } catch(e) { return []; } }
function writeSaves(list){ try { localStorage.setItem(SAVES_KEY, JSON.stringify(list)); } catch(e) { flash("<b>Couldn't save:</b> this browser isn't allowing storage here."); } }
function renderSaves(){
  const list = readSaves(), el = $("saveList");
  el.innerHTML = list.length ? list.map((d,i) => `<li><span><b>${esc(d.name)}</b><small>${fmt(d.cap || 0)} capacity · ${new Date(d.at).toLocaleDateString("en-GB")}</small></span>
    <span class="acts"><button data-load="${i}">Open</button><button data-dup="${i}">Duplicate</button><button class="ghost" data-del="${i}">Delete</button></span></li>`).join("")
    : '<li class="hint">No saved designs yet. Name this one and save it.</li>';
  const opts = list.map((d,i) => `<option value="${i}">${esc(d.name)}</option>`).join("");
  $("cmpA").innerHTML = `<option value="cur">This design</option>` + opts; $("cmpB").innerHTML = `<option value="cur">This design</option>` + opts;
  if (list.length) $("cmpB").value = "0";
}
$("saveBtn").addEventListener("click", () => {
  const name = ($("saveName").value || "").trim() || `Design ${readSaves().length + 1}`;
  const list = readSaves(); list.unshift({name, at:Date.now(), cap:LAST ? LAST.total : 0, state:S}); writeSaves(list); $("saveName").value = ""; renderSaves(); flash(`<b>Saved “${esc(name)}”.</b>`);
});
$("saveList").addEventListener("click", e => {
  const list = readSaves(), l = e.target.closest("[data-load]"), d = e.target.closest("[data-dup]"), x = e.target.closest("[data-del]");
  if (l){ openState(clone(list[+l.dataset.load].state)); flash(`<b>Opened “${esc(list[+l.dataset.load].name)}”.</b>`, UNDO); }
  if (d){ const c = clone(list[+d.dataset.dup]); c.name += " (copy)"; c.at = Date.now(); list.unshift(c); writeSaves(list); renderSaves(); }
  if (x){ const i = +x.dataset.del, [gone] = list.splice(i, 1); writeSaves(list); renderSaves();
    toast(`<b>Deleted “${esc(gone.name)}”.</b>`, {label:"Undo", run:() => { const l2 = readSaves(); l2.splice(Math.min(i, l2.length), 0, gone); writeSaves(l2); renderSaves(); }}); }
});
function statsOf(state){ const keep = S; S = clone(state); let r; try { r = dryRun(); } finally { S = keep; } return r; }
$("cmpBtn").addEventListener("click", () => {
  const list = readSaves(), get = v => v === "cur" ? {name:"This design", state:S} : list[+v];
  const A = get($("cmpA").value), B = get($("cmpB").value); if (!A || !B) return;
  const a = statsOf(A.state), b = statsOf(B.state);
  const rows = [["Capacity", x => fmt(x.total)], ["Tallest point", x => fmt(x.maxH) + " m"], ["Footprint", x => `${fmt(x.bounds[1]-x.bounds[0])} × ${fmt(x.bounds[3]-x.bounds[2])} m`],
    ["Under cover", x => (x.total ? Math.round(100*x.covered/x.total) : 0) + "%"], ["Worst sightline", x => isFinite(x.minC) ? Math.round(x.minC*1000) + " mm" : "n/a"],
    ["Slowest to empty", x => x.slowest ? x.slowest.toFixed(1) + " min" : "n/a"], ["Restricted-view seats", x => fmt(x.restricted)], ["Checks raised", x => x.issues.length]];
  $("cmpOut").innerHTML = `<table><thead><tr><th></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>${rows.map(([k,f]) => `<tr><th>${k}</th><td>${f(a)}</td><td>${f(b)}</td></tr>`).join("")}</tbody></table>`;
});
$("exportBtn").addEventListener("click", () => {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); $("codeBox").value = code; $("codeBox").select();
  try { navigator.clipboard.writeText(code).then(() => flash("<b>Design code copied.</b> Paste it anywhere to keep it."), () => flash("<b>Design code is in the box.</b> Copy it from there.")); } catch(e) { flash("<b>Design code is in the box.</b> Copy it from there."); }
});
$("importBtn").addEventListener("click", () => {
  try { const st = JSON.parse(decodeURIComponent(escape(atob(($("codeBox").value || "").trim())))); if (!soundState(st)) throw 0;
    openState(st); flash("<b>Design loaded.</b>", UNDO); }
  catch(e) { flash("<b>That code doesn't look right.</b> It may have been cut short. Paste the whole design code, exactly as copied. Your current design hasn't changed."); }
});

/* ================= share links, random stadiums ================= */
/* A shared design must look like one of ours. Text containing markup characters is refused outright, since parts of
   a design end up in the page. A plain apostrophe (as in an older design's "Members' Stand") becomes a curly one first. */
function curlApostrophes(v, depth){
  if (depth > 12 || !v || typeof v !== "object") return;
  for (const k in v){ if (typeof v[k] === "string") v[k] = v[k].replace(/'/g, "’"); else curlApostrophes(v[k], depth + 1); }
}
function safeState(st){
  if (!st || typeof st !== "object" || st.version !== 6 || !SPORTS[st.sport] || !st.stands || !st.bowl || !st.limits || !st.types) return false;
  let ok = true;
  (function walk(v, depth){ if (!ok) return; if (depth > 12) { ok = false; return; }
    if (typeof v === "string"){ if (/[<>"'`\\]/.test(v) || v.length > 200) ok = false; }
    else if (v && typeof v === "object") for (const k in v){ if (/[<>"'`]/.test(k)) { ok = false; return; } walk(v[k], depth + 1); } })(st, 0);
  return ok;
}
/* A design code or link can arrive damaged: cut off when it was pasted, or edited by hand. Before opening one, fill in
   anything a newer version added, check every stand has proper tiers, then try building it out of sight. If any of that
   fails it's refused, rather than half-loading and freezing the 3D view. */
function soundState(st){
  dropRemovedSports(st); curlApostrophes(st, 0); if (!safeState(st)) return false;
  const num = v => typeof v === "number" && isFinite(v);
  const tiersOk = a => Array.isArray(a) && a.length <= 40 && a.every(x => x && typeof x === "object" && TYPES[x.type] && num(x.rows) && x.rows >= 0 && x.rows <= 200 && num(x.rake));
  const standOk = c => !!c && typeof c === "object" && tiersOk(c.tiers) && !!c.roof && typeof c.roof === "object" && typeof c.roof.shape === "string";
  const trial = x => { try { const r = statsOf(upgradeCorners(clone(x))); return !!r && num(r.total) && num(r.maxH); } catch(e) { return false; } };
  if (!trial(st)){ for (const k in BASE) if (st[k] === undefined) st[k] = clone(BASE[k]); } // an older design missing something newer
  if (!standOk(st.bowl) || !SIDES.every(k => standOk(st.stands[k]))) return false;
  if (!st.ring || !Array.isArray(st.ring.stands) || !st.ring.stands.every(standOk)) return false;
  if (st.cornerCustom != null && !tiersOk(st.cornerCustom)) return false;
  if (!st.corners || typeof st.corners !== "object") return false;
  for (const k in BASE.types) if (!st.types[k] || !num(st.types[k].row)) return false;
  if (!num(st.setback) || !num(st.corner)) return false;
  return trial(st);
}
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function pipe(bytes, stream){ return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
async function shareCode(){
  const raw = new TextEncoder().encode(JSON.stringify(S));
  if (window.CompressionStream){ try { return "z" + b64u(await pipe(raw, new CompressionStream("deflate-raw"))); } catch(e) {} }
  return "j" + b64u(raw);
}
async function readShareCode(code){
  let bytes = unb64u(code.slice(1));
  if (code[0] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  return JSON.parse(new TextDecoder().decode(bytes));
}
$("shareBtn").addEventListener("click", async () => {
  const url = location.href.split("#")[0] + "#d=" + await shareCode();
  if (navigator.share && matchMedia("(pointer:coarse)").matches){ try { await navigator.share({title: sponsorsOf().title || "My Groundworks stadium", text:`${sponsorsOf().title || "My stadium"} holds ${fmt(LAST.total)}. Have a look:`, url}); return; } catch(e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(url); toast(`<b>Link copied.</b> Anyone who opens it gets this exact stadium.`); }
  catch(e) { $("codeBox").value = url; showPane("start"); $("codeBox").closest("details").open = true; toast("<b>Copy the link from the box</b> under Share as a design code."); }
});
/* Save as image: a clean picture of the 3D view (none of the buttons over it), at least 1600 pixels wide and drawn at the
   best settings, big soft shadows and ambient occlusion, even on a phone, with a caption bar along the bottom. */
async function stadiumImage(){
  const vw = view.clientWidth || 1200, vh = view.clientHeight || 800, w = Math.max(1600, Math.round(vw*renderer.getPixelRatio())), h = Math.round(w*vh/vw);
  const keep = {pr:renderer.getPixelRatio(), map:sun.shadow.mapSize.clone(), radius:sun.shadow.radius, ol:ortho.left, or:ortho.right, aoOff:AO && AO.off};
  const freshShadows = () => { if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } renderer.shadowMap.needsUpdate = true; };
  const pic = document.createElement("canvas"), cap = Math.round(w*0.05); pic.width = w; pic.height = h + cap; const g = pic.getContext("2d");
  try {
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); persp.aspect = w/h; persp.updateProjectionMatrix();
    const oh = (ortho.top - ortho.bottom)/2; ortho.left = -oh*w/h; ortho.right = oh*w/h; ortho.updateProjectionMatrix();
    sun.shadow.mapSize.set(4096, 4096); sun.shadow.radius = 4; freshShadows();
    if (AO && camera === persp){ AO.gtao.setSize(w, h); drawAO(); } else renderer.render(scene, camera);
    g.drawImage(renderer.domElement, 0, 0, w, h); // straight after drawing, while the picture is still there to copy
  } finally {
    renderer.setPixelRatio(keep.pr); sun.shadow.mapSize.copy(keep.map); sun.shadow.radius = keep.radius; freshShadows();
    ortho.left = keep.ol; ortho.right = keep.or; ortho.updateProjectionMatrix(); if (AO) AO.off = keep.aoOff; resize(); }
  // the caption: the ground's name (or My stadium), its capacity, and a small credit with the site's address
  const site = /^https?:/.test(location.protocol) ? (location.host + location.pathname.replace(/index\.html$/, "")).replace(/\/$/, "") : "Groundworks";
  const name = (sponsorsOf().title || "My stadium").toUpperCase(), y = h + cap/2;
  g.fillStyle = "#111714"; g.fillRect(0, h, w, cap); g.textBaseline = "middle";
  g.font = `800 ${Math.round(cap*.5)}px 'Big Shoulders Display', 'Arial Narrow', sans-serif`; g.fillStyle = "#ffffff"; g.fillText(name, cap*.45, y);
  const nw = g.measureText(name).width;
  g.font = `500 ${Math.round(cap*.32)}px 'IBM Plex Sans', sans-serif`; g.fillStyle = "#cfd8d2"; g.fillText(`${fmt(LAST.total)} capacity`, cap*.45 + nw + cap*.5, y);
  g.textAlign = "right"; g.font = `400 ${Math.round(cap*.24)}px 'IBM Plex Mono', monospace`; g.fillStyle = "#9fb0a6"; g.fillText(`Made with Groundworks · ${site}`, w - cap*.45, y);
  return new Promise((res, rej) => pic.toBlob(b => b ? res(b) : rej(new Error("no image")), "image/png"));
}
/* Phones get the share sheet with the picture where they can; everything else downloads it. */
async function saveImage(btn, make, what){
  if (!LAST) return; btn.disabled = true;
  try {
    const blob = await (make || stadiumImage)(), fname = ((sponsorsOf().title || "my stadium").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "my-stadium") + (what || "") + ".png";
    const file = new File([blob], fname, {type:"image/png"});
    if (navigator.canShare && matchMedia("(pointer:coarse)").matches && navigator.canShare({files:[file]})){
      try { await navigator.share({files:[file], title: sponsorsOf().title || "My Groundworks stadium"}); return; } catch(e) { if (e && e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast("<b>Picture saved.</b> Look for it in your downloads.");
  } catch(e) { toast("<b>Couldn't make the picture.</b> Try again, or take a screenshot instead."); }
  finally { btn.disabled = false; }
}
document.querySelectorAll("[data-saveimage]").forEach(b => b.addEventListener("click", () => saveImage(b)));
async function openFromLink(){
  const m = location.hash.match(/^#d=([zj][A-Za-z0-9_-]+)$/); if (!m) return false;
  history.replaceState(null, "", location.pathname + location.search);
  try { const st = await readShareCode(m[1]); if (!soundState(st)) throw 0; openState(st); toast("<b>Opened a shared stadium.</b> Your own design is one Undo away.", UNDO); return true; }
  catch(e) { toast("<b>That link didn't contain a design we could open.</b> It may have been cut short when it was copied."); return false; }
}
function randomStadium(){
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const keys = Object.keys(PRESETS), styleKeys = Object.keys(STYLES);
  openState(clone(PRESETS[pick(keys)]), null, () => {
    if (isBowl()) applyStyle(S.bowl, pick(styleKeys), false);
    else { const one = Math.random() < .5 ? pick(styleKeys) : null;
      for (const k of SIDES) if (S.stands[k].tiers.length || !isHybrid()) applyStyle(S.stands[k], one || pick(styleKeys), false); }
    S.seat = pick(SWATCHES)[1];
    if (Math.random() < .35){ S.seatPattern = pick(["bands","mosaic","tiers"]); S.seat2 = pick(SWATCHES.filter(s => s[1] !== S.seat))[1]; }
    S.night = Math.random() < .3;
    const A = archOf(); A.arch = Math.random() < .15; A.towers = Math.random() < .2; A.ramps = Math.random() < .1;
  });
  requestAnimationFrame(() => requestAnimationFrame(() => toast(`🎲 <b>${fmt(LAST.total)} places.</b> ${likeText(LAST.total)} Tap a stand to tweak it.`, UNDO)));
}
$("randomBtn").addEventListener("click", randomStadium);

