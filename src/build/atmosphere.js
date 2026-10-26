/* Two-tone seat patterns: bands of rows, or a scattered mosaic like many modern grounds. */
function altRow(i, j, k){
  const p = S.seatPattern || "solid"; if (p === "solid") return false;
  if (p === "bands") return Math.floor(j/5) % 2 === 1;
  if (p === "tiers") return k % 2 === 1;
  const h = Math.sin(i*12.9898 + j*78.233 + k*37.719)*43758.5453; return (h - Math.floor(h)) < 0.28;
}
/* Lettering spelt out in the seats (a club's name or initials in a second colour, as many grounds do). The text is
   drawn small onto a grid of one cell per seat and row, and each seat looks up whether it's part of a letter. */
const letterGrids = {};
function letterGrid(text, cols, rows){
  const k = text + "|" + cols + "|" + rows; if (letterGrids[k]) return letterGrids[k];
  const c = document.createElement("canvas"); c.width = cols; c.height = rows; const g = c.getContext("2d");
  const size = Math.max(4, Math.floor(rows*0.82)); g.font = `900 ${size}px 'Arial Black', 'Arial', sans-serif`;
  const w = g.measureText(text).width || 1, sx = Math.min(1, cols*0.92/w);
  g.setTransform(sx, 0, 0, 1, cols/2, rows/2); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(text, 0, rows*0.04);
  const a = g.getImageData(0, 0, cols, rows).data, on = (col, row) => col >= 0 && row >= 0 && col < cols && row < rows && a[(row*cols + col)*4 + 3] > 110;
  if (Object.keys(letterGrids).length > 12) for (const x in letterGrids) delete letterGrids[x];
  return (letterGrids[k] = on);
}
/* A crowd: one small figure per seat (sampled on very big grounds), in club colours with a few gaps. */
/* The crowd: one person per seat or standing place (thinned out for very big grounds), each a body and a head. Home fans
   mostly wear the club's colours, with a sprinkling of jackets, coats and away shirts; the away end is a block in its own
   colours. Stewards in hi-vis stand along the front facing the crowd. Heads take a mix of skin tones, and some wear hats.
   CROWD keeps where everyone is, so a Mexican wave can stand them up and sit them down again. */
let CROWD = null;
/* In the view from a seat, the fans right round you are left out, so you see the play rather than the backs of heads. */
let crowdClear = null;
const nearEye = (x, y, z) => { if (!crowdClear) return false; const dx = x - crowdClear[0], dz = z - crowdClear[2], dy = y - crowdClear[1];
  if (Math.hypot(dx, dz) < 3) return Math.abs(dy) < 3;                                          // your neighbours
  const l = Math.hypot(crowdClear[0], crowdClear[2]) || 1, ux = -crowdClear[0]/l, uz = -crowdClear[2]/l; // towards the play
  const along = dx*ux + dz*uz, across = Math.abs(dz*ux - dx*uz);
  return along > 0 && along < 15 && across < 2 + along*0.5 && dy < 1.5 && dy > -9; };           // and a wedge of rows in front of you
function clearCrowdNear(eye){
  crowdClear = eye;
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const mesh of group.children.filter(m => m.userData.crowd && m.isInstancedMesh)){ // bodies, heads, flags and their poles
    for (const [i, arr] of mesh.userData.hid || []) mesh.setMatrixAt(i, m4.fromArray(arr)); // bring back whoever was cleared last time
    mesh.userData.hid = [];
    if (eye) for (let i=0;i<mesh.count;i++){ mesh.getMatrixAt(i, m4); const e = m4.elements;
      if (nearEye(e[12], e[13], e[14])){ mesh.userData.hid.push([i, e.slice()]); mesh.setMatrixAt(i, zero); } }
    mesh.instanceMatrix.needsUpdate = true; }
  invalidate();
}
/* The away end: an allocation of seats in one stand (or one side of a bowl), starting from the middle or either end of it
   and growing out from there, block by block, the full height of the stand, with a gap of empty seats round it to keep
   the two sets of fans apart. The home end is a whole stand where the club's most vocal fans stand. */
const AWAY = {on:false, colour:"#f2f2f2", at:"W", anchor:"middle", count:null, gap:3};
const awayOf = () => Object.assign({}, AWAY, S.away || {});
const homeEndOf = () => Object.assign({at:"", name:"", flags:true, banners:true, tifo:false, texts:""}, S.homeEnd || {});
/* Which rows of seats belong to a stand, or a side of a bowl, and where each sits along it as the fans there see it
   (u grows to their right). */
function standRecs(recs, at){
  const dir = SIDE_DIR[at];
  let list = recs.filter(r => !r.floor && r.seats > 0 && (r.stand === at || (dir && r.stand === "B" && (r.x*dir[0] + r.z*dir[1]) > 0.55*Math.hypot(r.x, r.z))));
  if (!list.length) return [];
  let n = dir; if (!n){ const cx = list.reduce((a, r) => a + r.x, 0)/list.length, cz = list.reduce((a, r) => a + r.z, 0)/list.length, l = Math.hypot(cx, cz) || 1; n = [cx/l, cz/l]; }
  for (const r of list) r.u = -r.x*n[1] + r.z*n[0];
  return list;
}
function allocateAway(recs){
  for (const r of recs){ r.away = false; r.empty = false; r.home = false; }
  const HE = homeEndOf(); if (HE.at) for (const r of standRecs(recs, HE.at)) r.home = true; // the stand and its side of the bowl below
  const A = awayOf(), out = {seats:0, gap:0}; if (!A.on) return out;
  const list = standRecs(recs, A.at); if (!list.length) return out;
  const us = list.map(r => r.u), lo = Math.min(...us), hi = Math.max(...us), u0 = A.anchor === "left" ? lo : A.anchor === "right" ? hi : (lo + hi)/2;
  const total = recs.reduce((a, r) => a + (r.seats || 0), 0), want = A.count != null ? A.count : Math.min(3000, Math.round(total*0.1));
  list.sort((a, b) => Math.abs(a.u - u0) - Math.abs(b.u - u0));
  let edge = 0;
  for (const r of list){ if (out.seats >= want) break; r.away = true; out.seats += r.seats; edge = Math.max(edge, Math.abs(r.u - u0)); }
  for (const r of list) if (!r.away && Math.abs(r.u - u0) <= edge + A.gap){ r.empty = true; out.gap += r.seats; }
  return out;
}
const SKIN = [0xf1c7a6, 0xe0ac86, 0xc68a62, 0x9d6a46, 0x6f4a32, 0x4a3022, 0xf5d3b8, 0xd29b74].map(c => new THREE.Color(c));
const CLOTHES = [0x22262b, 0x2d3a4f, 0x45494d, 0x6b6e70, 0xf4f4f0, 0x3a5a7a, 0x5b4636, 0xd8c9a8, 0x1f2a3a, 0x8a1f1f].map(c => new THREE.Color(c));
const crowdGeo = {body: new THREE.BoxGeometry(0.44, 1, 0.28), head: new THREE.BoxGeometry(0.2, 0.23, 0.21)}; // a box head is 12 triangles, a ball would be eight times that
crowdGeo.body.keep = crowdGeo.head.keep = true;
function addCrowd(recs, F){
  CROWD = null;
  const totalP = recs.reduce((a,r) => a + (r.seats || 0), 0); if (totalP < 1) return;
  const cap = LIGHT ? 26000 : 45000, step = Math.max(1, totalP/cap), widen = Math.min(1.8, Math.sqrt(step));
  const n0 = Math.min(cap + 2000, Math.ceil(totalP/step) + recs.length) + 400;
  const mk = geo => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({roughness:.85}), n0); m.receiveShadow = true; m.castShadow = false; m.userData.crowd = true; return m; };
  const bodies = mk(crowdGeo.body), heads = mk(crowdGeo.head);
  const club = new THREE.Color(S.seat), club2 = new THREE.Color(S.seat2 || "#f2f2f2"), dark = club.clone().multiplyScalar(0.7);
  const A = awayOf(), away = new THREE.Color(A.colour), HE = homeEndOf();
  /* No two shirts quite the same: old and new kits, faded and fresh, a scarf over one. A few shades of each colour. */
  const shades = col => [0.8, 0.9, 1, 1, 1.1].map(k => col.clone().multiplyScalar(k)), clubS = shades(club), club2S = shades(club2), awayS = shades(away);
  const full = S.crowdFill == null ? 0.93 : Math.max(0, Math.min(1, S.crowdFill));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0,1,0), hsc = new THREE.Vector3(1,1,1);
  const phase = [], baseY = [], flags = [];
  let c = 0, carry = 0, seed = 1;
  const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  const pick = list => list[Math.floor(rnd()*list.length)];
  const place = (x, y, z, hgt, w, shirt, head, ph, d) => {
    pos.set(x, y, z); sc.set(w, hgt, d || 1); m4.compose(pos, q, sc); bodies.setMatrixAt(c, m4); bodies.setColorAt(c, shirt);
    pos.y = y + hgt/2 + 0.1; hsc.setScalar(0.9 + rnd()*0.2); m4.compose(pos, q, hsc); heads.setMatrixAt(c, m4); heads.setColorAt(c, head);
    phase.push(ph); baseY.push(y); c++; };
  const angle = (x, z) => Math.atan2(z, x);
  let gapRun = 0; // empty seats come in twos and threes, as real gaps do, not one at a time
  for (const r of recs){
    const want = (r.seats || 0)/step + carry, n = Math.floor(want); carry = want - n; if (n < 1) continue;
    const dx = r.m1[0]-r.m0[0], dz = r.m1[1]-r.m0[1]; q.setFromAxisAngle(up, Math.atan2(-dz, dx));
    const standing = r.type === "terrace" || r.type === "rail" || (r.home && r.type !== "exec"), fill = (r.type === "exec" ? 0.75 : 1)*full, hgt = standing ? 1.35 : 0.62;
    if (r.empty) continue; // the segregation gap round the away end
    const a = angle(r.x, r.z), inAway = !!r.away, kop = !inAway && !!r.home; // the home end: all in the club's colours, full and on its feet
    for (let k=0;k<n && c<n0 - 400;k++){
      const fillHere = kop ? Math.max(fill, .99) : fill;
      if (gapRun > 0 && fillHere < .995){ gapRun--; continue; }
      if (rnd() > 1 - (1 - fillHere)/1.6){ gapRun = rnd() < .45 ? 1 + Math.floor(rnd()*2) : 0; continue; }
      const f = (k + 0.5 + (rnd()-0.5)*0.3)/n, x = r.m0[0] + dx*f, z = r.m0[1] + dz*f;
      const v = rnd(), shirt = inAway ? (v < .7 ? pick(awayS) : CLOTHES[Math.floor(rnd()*CLOTHES.length)])
        : r.type === "exec" ? CLOTHES[Math.floor(rnd()*4)] // suits and smart coats in the boxes
        : kop && HE.tifo ? (Math.floor(r.j/3) % 2 ? club2 : club) // a card display: bands of colour held up row by row
        : kop ? (v < .7 ? pick(clubS) : v < .85 ? dark : pick(club2S))
        : v < .42 ? pick(clubS) : v < .52 ? dark : v < .59 ? pick(club2S) : CLOTHES[Math.floor(rnd()*CLOTHES.length)]; // and plenty in their own clothes
      const head = kop && HE.tifo ? shirt : rnd() < .14 ? (inAway ? away : rnd() < .7 ? club : CLOTHES[0]) : SKIN[Math.floor(rnd()*SKIN.length)]; // a bobble hat or a cap now and then; cards held over faces
      // tall and short, broad and slight, and the odd child next to a parent
      const h = hgt*(0.86 + rnd()*0.28)*(rnd() < .05 ? 0.76 : 1), y = lerp(r.h0, r.h1, f) + (standing ? 0.05 + h/2 + 0.35 : 0.42 + h/2) + (rnd()-0.5)*0.05;
      if (nearEye(x, y, z)) continue; // cleared for the view from a seat
      place(x, y, z, h, widen*(0.8 + rnd()*0.42), shirt, head, a, 0.88 + rnd()*0.3);
      if ((kop && HE.flags && !HE.tifo && rnd() < .05) || (inAway && HE.flags && rnd() < .03)) flags.push([x, y + h/2 + 1.25, z, inAway ? (rnd() < .6 ? away : club2.clone().lerp(away, .3)) : rnd() < .55 ? club : club2, q.clone()]);
    }
  }
  // flags held up over the home end (and a few in the away end), each on a short pole above its owner's head
  if (flags.length){ const fm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3, .85), new THREE.MeshStandardMaterial({roughness:.8, side:THREE.DoubleSide}), flags.length);
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(.04, 1.5, .04), new THREE.MeshStandardMaterial({color:0x6b5a44, roughness:.9}), flags.length), fm4 = new THREE.Matrix4(), fq = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    flags.forEach(([x, y, z, col, qq], i) => { fq.copy(qq).multiply(new THREE.Quaternion().setFromAxisAngle(up, (rnd() - .5)*1.4));
      fm4.compose(new THREE.Vector3(x, y, z), fq, one); fm.setMatrixAt(i, fm4); fm.setColorAt(i, col);
      fm4.compose(new THREE.Vector3(x, y - .3, z), fq, one); pm.setMatrixAt(i, fm4); });
    for (const mm of [fm, pm]){ mm.userData.crowd = true; group.add(mm); } }
  // stewards in hi-vis along the front of the lowest tiers, every 20 m or so, facing the crowd
  if (F && S.stewards !== false){ const vis = new THREE.Color(0xd8ff1e), front = recs.filter(r => r.j === 0 && !r.floor && r.h0 < 3);
    let run = 0; for (const r of front){ run += r.len || 0; if (run < 20 || c >= n0) continue; run = 0;
      const dx = r.m1[0]-r.m0[0], dz = r.m1[1]-r.m0[1], L = Math.hypot(dx, dz) || 1, nx = dz/L, nz = -dx/L, out = Math.sign(nx*r.x + nz*r.z) || 1; // towards the play
      q.setFromAxisAngle(up, Math.atan2(-dz, dx) + Math.PI);
      place(r.x - nx*out*2.2, 0.9, r.z - nz*out*2.2, 1.2, 1, vis, SKIN[Math.floor(rnd()*SKIN.length)], NaN); } }
  // put everyone in order round the ground, so a wave only has to touch one run of fans at a time
  const order = [...Array(c).keys()].sort((i, j) => (phase[i] !== phase[i] ? 9 : phase[i]) - (phase[j] !== phase[j] ? 9 : phase[j]));
  for (const m of [bodies, heads]){
    const mo = m.instanceMatrix.array, co = m.instanceColor.array, mn = new Float32Array(mo.length), cn = new Float32Array(co.length);
    order.forEach((from, to) => { mn.set(mo.subarray(from*16, from*16 + 16), to*16); cn.set(co.subarray(from*3, from*3 + 3), to*3); });
    mo.set(mn); co.set(cn); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = c; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; group.add(m); }
  const ph = Float32Array.from(order, i => phase[i]), live = ph.findIndex(x => x !== x);
  CROWD = {bodies, heads, phase:ph, n: live < 0 ? c : live, base:[bodies.instanceMatrix.array.slice(0, c*16), heads.instanceMatrix.array.slice(0, c*16)], lo:0, hi:0};
}
/* Players lined up for kick-off: the home side in the club's colours, the away side in the away colours (or white or
   black, whichever stands out more), keepers in their own kits, and a referee with the ball on the centre spot. */
const KICKOFF = {
  football:[[-.93,0,1],[-.62,-.6],[-.66,-.2],[-.66,.2],[-.62,.6],[-.32,-.62],[-.34,-.2],[-.34,.2],[-.32,.62],[-.06,-.14],[-.02,.12]],
  rugby:[[-.08,-.5],[-.08,0],[-.08,.5],[-.12,-.25],[-.12,.25],[-.16,-.6],[-.16,.6],[-.2,0],[-.3,-.1],[-.38,-.25],[-.5,-.62],[-.46,-.4],[-.46,.4],[-.5,.62],[-.8,0]]
};
function addPlayers(F, sp){
  const lineup = KICKOFF[sp]; if (!lineup) return;
  const home = new THREE.Color(S.seat), A = S.away || {}, lum = c => 0.3*c.r + 0.59*c.g + 0.11*c.b;
  const away = A.on && A.colour ? new THREE.Color(A.colour) : new THREE.Color(lum(home) > 0.5 ? 0x15181c : 0xf4f4f0);
  const mats = {}, mat = c => { const k = c.getHexString(); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({color:c.clone(), roughness:.7})); };
  const shorts = c => lum(c) > 0.5 ? new THREE.Color(0x1d2228) : new THREE.Color(0xf4f4f0);
  const body = new THREE.BoxGeometry(0.5, 0.75, 0.3), legs = new THREE.BoxGeometry(0.42, 0.85, 0.26), head = new THREE.BoxGeometry(0.24, 0.27, 0.25);
  const skins = [0xf1c7a6, 0xc68a62, 0x6f4a32, 0xe0ac86, 0x9d6a46];
  let seed = 3; const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  const person = (x, z, shirt, short, face) => {
    for (const [geo, c, y] of [[legs, short, 0.43], [body, shirt, 1.23], [head, new THREE.Color(skins[face % skins.length]), 1.75]]){
      const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.rotation.y = Math.atan2(-x, -z) + (rnd() - .5)*.6; m.castShadow = true; m.userData.stadium = true; group.add(m); } };
  const hx = F.W/2, hz = F.H/2;
  lineup.forEach(([fx, fz, gk], i) => {
    person(fx*hx + (rnd() - .5), fz*hz + (rnd() - .5), gk ? new THREE.Color(0x3fbf5a) : home, shorts(home), i);
    const [gx, gz] = [-fx*hx + (rnd() - .5), -fz*hz + (rnd() - .5)]; person(gx, gz, gk ? new THREE.Color(0xf2c230) : away, shorts(away), i + 2); });
  person(3, hz*0.28, new THREE.Color(0x111111), new THREE.Color(0x111111), 1); // the referee
  const ball = new THREE.Mesh(new THREE.SphereGeometry(sp === "rugby" ? 0.15 : 0.11, 12, 8), mat(new THREE.Color(0xffffff)));
  if (sp === "rugby") ball.scale.set(1, 0.68, 0.68); ball.position.set(0, 0.13, 0); ball.castShadow = true; ball.userData.stadium = true; group.add(ball);
}
/* A Mexican wave: a band of fans stands up as it sweeps round the ground, twice and a bit. Only the fans the band has
   reached or just left are moved and sent to the graphics card each frame. Returns false once everyone's sat down. */
function waveTick(t){
  const W = CROWD; if (!W || !W.n) return false;
  const dur = 9000, k = Math.min(1, t/dur), TAU = Math.PI*2, width = 0.35, P = W.phase, n = W.n;
  const front = k < 1 ? -Math.PI + k*TAU*1.4 : NaN;
  const find = x => { let a = 0, b = n; while (a < b){ const m = (a + b) >> 1; if (P[m] < x) a = m + 1; else b = m; } return a; };
  let lo = 0, hi = n; // everyone, when the band wraps past the back of the ground or the wave is over
  if (k < 1){ const f = Math.atan2(Math.sin(front), Math.cos(front)); if (f - width > -Math.PI && f + width < Math.PI){ lo = find(f - width); hi = find(f + width); } }
  const a = Math.min(lo, W.lo), b = Math.max(hi, W.hi); W.lo = lo; W.hi = hi;
  [W.bodies, W.heads].forEach((m, which) => { const arr = m.instanceMatrix.array, base = W.base[which];
    for (let i=a;i<b;i++){ let d = front - P[i]; d -= Math.round(d/TAU)*TAU; const lift = d === d ? Math.max(0, 1 - Math.abs(d)/width) : 0;
      arr[i*16 + 13] = base[i*16 + 13] + 0.5*Math.sin(lift*Math.PI/2)*(which ? 1.15 : 1); }
    m.instanceMatrix.updateRange.offset = a*16; m.instanceMatrix.updateRange.count = Math.max(0, b - a)*16; m.instanceMatrix.needsUpdate = true; });
  return k < 1;
}
/* Scenery round the ground. Realistic: a sky that fades to a hazy horizon, grass fields that melt into it, and a
   light-polluted glow at night. Model: the plain backdrop that matches the app. The haze is always there but pushed out
   of sight for the model look and the plan view, since switching it on and off would rebuild every material. */
const FOG = new THREE.Fog(0xdfe8ec, 1e5, 2e5); scene.fog = FOG;
const sceneryTex = {};
function skyTexture(night){
  const dusk = !night && S.hour != null && 62*Math.sin(Math.PI*(S.hour - 5.5)/15) < 14;
  const k = night ? "night" : dusk ? "dusk" : "day"; if (sceneryTex[k]) return sceneryTex[k];
  const c = document.createElement("canvas"); c.width = 4; c.height = 512; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
  if (night){ gr.addColorStop(0, "#03060d"); gr.addColorStop(0.55, "#0b1528"); gr.addColorStop(0.85, "#1e2a44"); gr.addColorStop(1, "#33405a"); }
  else if (dusk){ gr.addColorStop(0, "#2f4f86"); gr.addColorStop(0.5, "#8a8fb8"); gr.addColorStop(0.82, "#f0a878"); gr.addColorStop(1, "#ffd59a"); }
  else { gr.addColorStop(0, "#4f86c6"); gr.addColorStop(0.5, "#8fb6dd"); gr.addColorStop(0.85, "#cddff0"); gr.addColorStop(1, "#e4ecf0"); }
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = canvasTex(c); t.keep = true; return (sceneryTex[k] = t);
}
function grassTexture(){
  if (sceneryTex.grass) return sceneryTex.grass;
  const c = document.createElement("canvas"), N = 256; c.width = c.height = N; const g = c.getContext("2d");
  let seed = 11; const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  g.fillStyle = "#cfd8c4"; g.fillRect(0, 0, N, N);
  for (let i=0;i<9000;i++){ const v = 180 + Math.floor(rnd()*60); g.fillStyle = `rgb(${v-14},${v},${v-24})`; g.fillRect(rnd()*N, rnd()*N, 2, 2); }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(600, 600); t.keep = true; return (sceneryTex.grass = t);
}
function setGroundMap(map){ if (groundMat.map !== map){ groundMat.map = map; groundMat.needsUpdate = true; } }
function fogReach(){ const real = S && S.scenery !== "model" && camera !== ortho; FOG.near = real ? 650 : 1e5; FOG.far = real ? 3200 : 2e5; }
function realScenery(night){
  const sky = skyTexture(night); scene.background = sky; FOG.color.set(night ? 0x2a3650 : sky === sceneryTex.dusk ? 0xf0c8a0 : 0xe1eaef); fogReach();
  setGroundMap(grassTexture()); groundMat.color.set(night ? 0x223024 : 0x5a6e4c); plazaMat.color.set(night ? 0x34373a : 0xc4c2ba);
}
function plainScenery(){ setGroundMap(null); fogReach(); }
/* Day or night, and whether roofs can be seen through. */
function applyMood(){
  const night = !!S.night;
  hemi.intensity = night ? LUX.nightHemi : LUX.hemi; sun.intensity = night ? LUX.nightSun : LUX.sun; fill.intensity = night ? LUX.nightFill : LUX.fill;
  scene.environmentIntensity = night ? LUX.nightEnv : LUX.env;
  /* The sun's place in the sky from the time of day: up in the east in the morning, high at lunchtime, low and golden in
     the evening, with long shadows. Without a time set it stays where it always was. */
  sun.color.set(0xffffff); hemi.color.set(0xffffff);
  if (S.hour == null || night) sun.position.set(140, 260, 90);
  else { const hr = S.hour, elD = Math.max(3, 62*Math.sin(Math.PI*(hr - 5.5)/15)), el = elD*Math.PI/180, az = Math.PI*(hr - 6)/14, R = 320;
    sun.position.set(R*Math.cos(el)*Math.cos(az), R*Math.sin(el), R*Math.cos(el)*Math.sin(az));
    const warm = Math.max(0, Math.min(1, (22 - elD)/18)); sun.color.lerp(new THREE.Color(0xffa860), warm); hemi.color.lerp(new THREE.Color(0xffd2a8), warm*0.5);
    sun.intensity = lerp(LUX.sun, LUX.eveSun, warm); hemi.intensity = lerp(LUX.hemi, LUX.eveHemi, warm); scene.environmentIntensity = lerp(LUX.env, LUX.eveEnv, warm); }
  M.lamp.emissiveIntensity = night ? 2.2 : 0.9; M.band.emissive.set(night ? 0xffc46b : 0x000000); M.band.emissiveIntensity = night ? 0.55 : 0;
  M.board.emissiveIntensity = night ? 1.6 : 0.8; M.screen.emissiveIntensity = night ? 1.4 : 0.7;
  M.window.emissive.set(night ? 0xffc77a : 0x000000); M.window.emissiveIntensity = night ? 0.6 : 0;
  if (night && S.scenery !== "model") realScenery(true);
  else if (night){ plainScenery(); scene.background = new THREE.Color(0x0a1220); groundMat.color.set(0x1d2420); plazaMat.color.set(0x262c28); }
  else if (typeof applyTheme === "function") applyTheme(true);
  const see = !!S.seeThrough;
  for (const [k, o] of [["roof",.92],["roofSolid",1],["roofGreen",1],["roofConcrete",1],["roofClosed",.45],["roofGlass",.45],["roofEdge",1]]){
    const m = M[k]; if (!m) continue; m.transparent = see || o < 1; m.opacity = see ? Math.min(o, 0.18) : o; m.depthWrite = !see && o >= 1; m.needsUpdate = true; }
}
