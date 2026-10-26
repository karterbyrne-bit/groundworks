/* Façade looks. Each draws onto one stretch of outside wall from a to b (points on the ground), whose top runs from ya to
   yb, facing out along n. Everything stands slightly proud of the wall so it reads from the street and from the air. */
const FACADE_LOOKS = {brick:"Brick, with rows of windows", timber:"Painted timber", deco:"Art deco ribs", concrete:"Concrete bands",
  sheet:"Metal cladding with a club-colour stripe", fins:"Metal fins over a glazed concourse", glass:"Glass curtain wall", grid:"Windows all over",
  exposed:"Exposed structure: raking beams, stair cores and open concourse bays", plain:"Plain wall"};
/* Real-looking wall materials: brick courses, board-marked concrete, profiled metal sheet and timber boarding, drawn as
   light patterns that the wall's own colour tints. They repeat every few metres along the wall. */
const wallTex = {};
function wallTexture(kind){
  if (wallTex[kind]) return wallTex[kind];
  const c = document.createElement("canvas"), N = 512; c.width = c.height = N; const g = c.getContext("2d");
  let seed = 7; const rnd = () => { seed = (seed*16807) % 2147483647; return seed/2147483647; };
  const shade = v => { const x = Math.round(255*Math.max(0, Math.min(1, v))); return `rgb(${x},${x},${x})`; };
  let metres = 4;
  if (kind === "brick"){ // 4 m square: 0.075 m courses of 0.225 m bricks in stretcher bond, lighter mortar
    g.fillStyle = shade(1); g.fillRect(0,0,N,N); const ch = N/53.3, bw = N/17.8;
    for (let r=0, y=0; y<N; r++, y+=ch) for (let x = (r%2) ? -bw/2 : 0; x<N; x+=bw){ g.fillStyle = shade(0.74 + rnd()*0.16); g.fillRect(x + 1, y + 1, bw - 2, ch - 2); } }
  else if (kind === "concrete"){ // 4.8 m: board-marked panels with tie holes and a little staining
    metres = 4.8; g.fillStyle = shade(0.92); g.fillRect(0,0,N,N);
    for (let i=0;i<5000;i++){ g.fillStyle = shade(0.84 + rnd()*0.14); g.fillRect(rnd()*N, rnd()*N, 2, 2); }
    g.fillStyle = shade(0.78); for (const y of [0, N/2]) g.fillRect(0, y, N, 3); for (const x of [0, N/2]) g.fillRect(x, 0, 3, N);
    g.fillStyle = shade(0.7); for (const x of [N/8, 3*N/8, 5*N/8, 7*N/8]) for (const y of [N/8, 3*N/8, 5*N/8, 7*N/8]){ g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
  else if (kind === "cladding"){ // 2 m: profiled metal sheet with a rib every 0.25 m
    metres = 2; for (let x=0;x<N;x++){ const f = (x % (N/8))/(N/8), v = f < .15 ? 0.7 + f*1.5 : f < .3 ? 1 : 0.88 + 0.04*Math.sin(f*6); g.fillStyle = shade(v); g.fillRect(x, 0, 1, N); }
    g.fillStyle = shade(0.8); g.fillRect(0, N - 3, N, 3); }
  else if (kind === "roofMetal"){ // 4 m: profiled sheet, a rib every half metre running front to back, a lap joint at the end of each sheet
    for (let x=0;x<N;x++){ const f = (x % (N/8))/(N/8), v = f < .12 ? 0.74 + f*2 : f < .22 ? 1 : 0.9 + 0.05*Math.cos(f*6.3); g.fillStyle = shade(v); g.fillRect(x, 0, 1, N); }
    g.fillStyle = shade(0.8); g.fillRect(0, 0, N, 3); }
  else if (kind === "roofPoly"){ // 4 m: twin-wall polycarbonate, faint ribs every 25 cm and a glazing bar every 2 m
    g.fillStyle = shade(1); g.fillRect(0,0,N,N); g.fillStyle = shade(0.8); for (let x=0;x<N;x+=N/16) g.fillRect(x, 0, 3, N);
    g.fillStyle = shade(0.45); for (const x of [0, N/2]) g.fillRect(x, 0, 8, N); g.fillRect(0, 0, N, 5); }
  else if (kind === "roofGlass"){ // 4 m: glass panes 2 m by 1.33 m in a dark frame
    g.fillStyle = shade(1); g.fillRect(0,0,N,N); g.fillStyle = shade(0.35); for (const x of [0, N/2]) g.fillRect(x, 0, 5, N); for (const y of [0, N/3, 2*N/3]) g.fillRect(0, y, N, 4); }
  else if (kind === "roofTin"){ // 2 m: corrugated sheet, a ripple every 7.5 cm
    metres = 2; for (let x=0;x<N;x++){ g.fillStyle = shade(0.86 + 0.12*Math.sin(x/N*2*Math.PI*26)); g.fillRect(x, 0, 1, N); } }
  else { // timber boarding, 0.16 m boards
    metres = 3; for (let y=0, i=0; y<N; y+=N/18.75, i++){ g.fillStyle = shade(0.82 + rnd()*0.14); g.fillRect(0, y, N, N/18.75); g.fillStyle = shade(0.6); g.fillRect(0, y, N, 2); } }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1/metres, 1/metres);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.keep = true; return (wallTex[kind] = t);
}
const LOOK_TEX = {brick:"brick", timber:"timber", sheet:"cladding", fins:"cladding", deco:"concrete", concrete:"concrete", grid:"concrete", exposed:"concrete", plain:"concrete"};
/* The same pattern gives the surface a little relief, so mortar joints, board marks and sheet ribs catch the light. */
const RELIEF = {brick:2.2, concrete:1.2, cladding:2.6, timber:1.6, roofMetal:1.8, roofTin:2.2, roofPoly:.6, roofGlass:.3};
function textured(key, kind){
  if (!kind) return key; const k = key + "~" + kind;
  if (!M[k]){ M[k] = M[key].clone(); M[k].map = wallTexture(kind); if (RELIEF[kind]){ M[k].bumpMap = M[k].map; M[k].bumpScale = RELIEF[kind]; }
    if (M[k].userData.weather) weather(M[k], M[k].userData.weather); }
  M_USED.add(k); return k;
}
/* Lettering for an outside wall or a roof front, in the club's own words. */
const signTex = {}, SIGN_USED = new Set();
function signMaterial(text, colour){
  const k = text + "|" + colour; SIGN_USED.add(k); if (signTex[k]) return signTex[k];
  const font = "800 110px 'Big Shoulders Display', 'Arial Narrow', sans-serif", c = document.createElement("canvas"), g = c.getContext("2d");
  g.font = font; c.width = Math.min(4096, Math.ceil(g.measureText(text).width) + 40); c.height = 140;
  g.font = font; g.fillStyle = colour; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width/2, 76);
  // kept between builds once the lettering font has loaded; until then made afresh and freed with the build
  const cache = !document.fonts || document.fonts.check(font), t = canvasTex(c); t.keep = cache;
  const m = new THREE.MeshStandardMaterial({map:t, transparent:true, alphaTest:.25, roughness:.5, emissive:new THREE.Color(colour), emissiveMap:t, emissiveIntensity:0});
  m.keep = cache; m.aspect = c.width/c.height;
  m.edge = new THREE.MeshStandardMaterial({map:t, transparent:true, alphaTest:.25, roughness:.6, color:new THREE.Color(0.45, 0.45, 0.45)}); m.edge.keep = cache; // the letters' thickness
  if (cache) signTex[k] = m;
  return m;
}
/* A stand clock's face, showing the time of day used for the lighting (3pm for a day match with no time set, quarter to
   eight for a night match). One picture per quarter of an hour, kept, and the faces in the stadium are updated when the
   time of day changes. */
const clockTex = {}, CLOCK_FACES = [];
const clockTime = () => S.night ? 19.75 : (S.hour == null ? 15 : S.hour);
function clockTexture(t){
  const k = Math.round(t*4)/4; if (clockTex[k]) return clockTex[k];
  const N = 256, c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d"), R = N/2;
  g.fillStyle = "#f4f1e6"; g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.fill();
  g.strokeStyle = "#1d2124"; g.lineCap = "round";
  for (let i=0;i<60;i++){ const a = i/60*Math.PI*2, big = i % 5 === 0, r0 = R*(big ? .78 : .86); g.lineWidth = big ? 7 : 2.5;
    g.beginPath(); g.moveTo(R + Math.sin(a)*r0, R - Math.cos(a)*r0); g.lineTo(R + Math.sin(a)*R*.93, R - Math.cos(a)*R*.93); g.stroke(); }
  const hand = (a, len, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(R - Math.sin(a)*len*.15, R + Math.cos(a)*len*.15); g.lineTo(R + Math.sin(a)*len, R - Math.cos(a)*len); g.stroke(); };
  hand(((k % 12) + 0)/12*Math.PI*2, R*.5, 11); hand((k % 1)*Math.PI*2, R*.75, 7);
  g.fillStyle = "#1d2124"; g.beginPath(); g.arc(R, R, 9, 0, 7); g.fill();
  const tx = canvasTex(c); tx.keep = true; return (clockTex[k] = tx);
}
function updateClocks(){ for (const m of CLOCK_FACES){ m.map = m.emissiveMap = clockTexture(clockTime()); m.emissiveIntensity = S.night ? .9 : .08; m.needsUpdate = true; } }
/* A clock face of radius r at p (on the ground plan, at height y), facing the point it looks at, on a dark surround. */
function addClock(p, y, look, r){
  const m = new THREE.MeshStandardMaterial({roughness:.5, emissive:0xffffff}); CLOCK_FACES.push(m);
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 40), m), back = new THREE.Mesh(new THREE.CircleGeometry(r*1.13, 40), M.dark);
  const dir = new THREE.Vector3(look[0] - p[0], 0, look[1] - p[1]).normalize();
  for (const [o, off] of [[back, 0], [face, .06]]){ o.position.set(p[0] + dir.x*off, y, p[1] + dir.z*off); o.lookAt(p[0] + dir.x*50, y, p[1] + dir.z*50); o.castShadow = true; o.userData.stadium = true; group.add(o); }
  updateClocks();
}
const ACCENTS = new Set(["trim", "band", "lattice"]); // the club colour goes on dressings and stripes, never on glazing frames or steel
function dressWall(buf, look, wallKey, a, b, ya, yb, n, opt){
  const len = Math.hypot(b[0]-a[0], b[1]-a[1]); if (len < 0.5) return;
  opt = opt || {}; const dens = opt.windows == null ? 1 : opt.windows, wsz = opt.winSize || 1, buf0 = buf;
  buf = k => buf0(opt.accent && ACCENTS.has(k) ? tint(k, opt.accent) : k); // trims, bands and fins in the accent colour
  const tg = [(b[0]-a[0])/len, (b[1]-a[1])/len], lo = Math.min(ya, yb), yl = opt.lift || 0; // over a road, nothing comes below the opening's top
  const P = (f, out) => [a[0] + (b[0]-a[0])*f + n[0]*out, a[1] + (b[1]-a[1])*f + n[1]*out];
  const Q = (p, y) => [p[0], y, p[1]];
  const top = f => ya + (yb - ya)*f;
  // a flat panel across part of the wall, standing out from it
  const panel = (key, f0, f1, y0, y1, out) => { y0 = Math.max(y0, yl); if (y1 <= y0) return; const p0 = P(f0,out), p1 = P(f1,out); quad(buf(key), Q(p0,y0), Q(p1,y0), Q(p1,y1), Q(p0,y1)); };
  // a horizontal band with a top and underside, so it casts a shadow line
  const ledge = (key, y0, y1, depth, slope) => { if (y1 <= yl) return; y0 = Math.max(y0, yl); const s0 = slope ? 0 : 0, f = g => slope ? top(g) - lo : s0;
    const a0 = P(0,0), b0 = P(1,0), a1 = P(0,depth), b1 = P(1,depth);
    quad(buf(key), Q(a1,y0+f(0)), Q(b1,y0+f(1)), Q(b1,y1+f(1)), Q(a1,y1+f(0)));
    quad(buf(key), Q(a0,y0+f(0)), Q(b0,y0+f(1)), Q(b1,y0+f(1)), Q(a1,y0+f(0)));
    quad(buf(key), Q(a0,y1+f(0)), Q(b0,y1+f(1)), Q(b1,y1+f(1)), Q(a1,y1+f(0))); };
  // a vertical strip standing out from the wall (pilaster, rib or mullion)
  const rib = (key, f, w, y0, y1, depth) => { y0 = Math.max(y0, yl); if (y1 <= y0) return; const fw = w/2/len, q0 = P(f-fw,0), q1 = P(f+fw,0), r0 = P(f-fw,depth), r1 = P(f+fw,depth);
    quad(buf(key), Q(r0,y0), Q(r1,y0), Q(r1,y1), Q(r0,y1)); quad(buf(key), Q(q0,y0), Q(r0,y0), Q(r0,y1), Q(q0,y1));
    quad(buf(key), Q(r1,y0), Q(q1,y0), Q(q1,y1), Q(r1,y1)); quad(buf(key), Q(r0,y1), Q(r1,y1), Q(q1,y1), Q(q0,y1)); };
  // a solid block standing out from the wall: front face, top, underside and both ends
  const block = (key, f0, f1, y0, y1, out0, out1) => { y0 = Math.max(y0, yl); if (y1 <= y0) return; const a0 = P(f0,out0), b0 = P(f1,out0), a1 = P(f0,out1), b1 = P(f1,out1);
    quad(buf(key), Q(a1,y0), Q(b1,y0), Q(b1,y1), Q(a1,y1)); quad(buf(key), Q(a0,y1), Q(a1,y1), Q(b1,y1), Q(b0,y1)); quad(buf(key), Q(a0,y0), Q(b0,y0), Q(b1,y0), Q(a1,y0));
    quad(buf(key), Q(a0,y0), Q(a1,y0), Q(a1,y1), Q(a0,y1)); quad(buf(key), Q(b1,y0), Q(b0,y0), Q(b0,y1), Q(b1,y1)); };
  // a slanting bar on the wall (a raking beam), from (fA, yA) to (fB, yB)
  const slant = (key, fA, yA, fB, yB, w, out) => { if (Math.min(yA, yB) < yl) return; const pa = P(fA,out), pb = P(fB,out), qa = P(fA,.05), qb = P(fB,.05);
    quad(buf(key), Q(pa,yA-w/2), Q(pb,yB-w/2), Q(pb,yB+w/2), Q(pa,yA+w/2)); quad(buf(key), Q(qa,yA+w/2), Q(pa,yA+w/2), Q(pb,yB+w/2), Q(qb,yB+w/2));
    quad(buf(key), Q(qa,yA-w/2), Q(qb,yB-w/2), Q(pb,yB-w/2), Q(pa,yA-w/2)); };
  const cells = step => Math.max(1, Math.round(len/step));
  /* Windows set back into the wall: a deep surround in the wall's own material (so the reveals show), the dark glass
     well behind its face in a slim frame, and a sill that throws a shadow line. */
  const windows = (key, step, storey, first, w, h, sill) => { if (dens <= 0) return; const nC = cells(step/dens); w *= wsz; h = Math.min(h*wsz, storey - 0.6);
    const surround = ACCENTS.has(sill) || !sill ? wallKey : sill, dr = .24, sw = .14/len;
    for (let c=0;c<nC;c++){ const fc = (c + .5)/nC, fw = w/2/len;
      for (let y = first; y + h < Math.min(top(fc), lo + 2) - 1.2; y += storey){
        block(surround, fc - fw - sw, fc + fw + sw, y + h, y + h + .18, 0, dr); // the head
        block(surround, fc - fw - sw, fc - fw, y, y + h, 0, dr); block(surround, fc + fw, fc + fw + sw, y, y + h, 0, dr); // the jambs
        const fr = .05/len; panel("frame", fc - fw, fc + fw, y, y + h, .02); panel(key, fc - fw + fr, fc + fw - fr, y + .05, y + h - .05, .035); // glass in a frame
        if (w > 1.1) panel("frame", fc - .03/len, fc + .03/len, y, y + h, .05); // and a mullion down the middle of a wide one
        block(sill || "trim", fc - fw - sw*1.6, fc + fw + sw*1.6, y - .14, y, 0, dr + .1); } } };
  if (look === "brick"){
    panel("trim", 0, 1, 0, 0.9, .1);
    windows("window", 4.5, 4.2, 4.4, 1.5, 2.3, "trim");
    for (let c=0;c<=cells(4.5);c+=2) rib("trim", c/cells(4.5), .55, .9, Math.max(1.5, top(c/cells(4.5)) - 1.1), .3);
    ledge("trim", lo - 1.1, lo - .4, .45, true);
  } else if (look === "timber"){
    windows("window", 3, 3.6, 2.4, 1.2, 1.6, "white");
    for (let c=0;c<=cells(1.6);c++) rib(wallKey, c/cells(1.6), .12, .3, Math.max(.8, top(c/cells(1.6)) - .3), .06); // cover battens
    ledge("roofGreen", lo - .9, lo - .2, .3, true);
  } else if (look === "deco"){
    const nC = cells(3.2);
    if (dens > 0) for (let c=0;c<nC;c++){ if (dens < 1 && (c % Math.round(1/dens))) continue; const fc = (c + .5)/nC, fw = .7*wsz/len; panel("window", fc - fw, fc + fw, 2.2, Math.max(2.4, top(fc) - 3), .05); }
    for (let c=0;c<=nC;c++) rib("trim", c/nC, .6, .4, Math.max(1, top(c/nC) - .6), .9);
    ledge("trim", lo - 1.3, lo - .3, .7, true); panel("trim", 0, 1, 0, .6, .12);
  } else if (look === "concrete"){
    for (let y = 3; y + 3.2 < lo - .5; y += 5.2){ if (dens > 0) panel("window", 0, 1, y, y + 1.6*wsz, .05); ledge("concrete", y + 1.6, y + 3.1, .8); }
    ledge("concrete", lo - 1.2, lo - .2, .9, true);
  } else if (look === "sheet"){ // profiled metal panels between the stand's frame, a glazed ground floor and one bold club stripe
    const base = Math.min(4.4, lo - 1.5);
    if (base > 2.5){ panel("window", 0, 1, .3, base, .07); for (let c=0;c<=cells(1.8);c++) rib("frame", c/cells(1.8), .1, .3, base, .14); ledge("steel", base, base + .4, 1.4); }
    const stripe = lo > 10;
    for (let c=0;c<=cells(8);c++) rib(wallKey, c/cells(8), .4, Math.max(0, base) + .4, Math.max(base + .8, stripe ? lo - 3.6 : top(c/cells(8)) - .1), .22);
    if (stripe) ledge("band", lo - 3.6, lo - 1.8, .3, true);
    ledge("steel", lo - .45, lo - .05, .4, true);
  } else if (look === "fins"){
    panel("window", 0, 1, .3, Math.min(4.6, lo - 1), .05); panel("glass", 0, 1, .3, Math.min(4.6, lo - 1), .5);
    const nC = cells(2.4);
    for (let c=0;c<=nC;c++){ const f = c/nC, p0 = P(f, .1), p1 = [p0[0] + n[0]*1.3 + tg[0]*.7, p0[1] + n[1]*1.3 + tg[1]*.7];
      quad(buf("steel"), Q(p0, 5.2), Q(p1, 5.2), Q(p1, Math.max(5.4, top(f) - .2)), Q(p0, Math.max(5.4, top(f) - .2))); }
    ledge("steel", 4.6, 5.2, 1.4);
  } else if (look === "glass"){
    panel("glass", 0, 1, .2, Math.max(.4, lo - .2), .35);
    const nC = cells(2.2);
    for (let c=0;c<=nC;c++) rib("steel", c/nC, .14, .2, Math.max(.4, top(c/nC) - .2), .4);
    for (let y = 3.6; y < lo - .5; y += 3.6) ledge("steel", y, y + .14, .4);
  } else if (look === "grid"){
    windows("window", 2.6, 3.3, 1.6, 1.3, 1.8, null);
    for (let y = 3.75; y < lo - 1.5; y += 3.3) ledge(wallKey, y, y + .3, .25); // a floor edge between each storey
    ledge("trim", lo - .8, lo - .2, .3, true);
  }
  else if (look === "exposed"){ // the back of most British stands: the frame on show, not hidden behind a wall
    const nC = cells(8), conc = Math.min(4.2, lo - 1.5), cw = .7/len;
    if (conc > 2.4){ panel("void", 0, 1, 0, conc, .03); ledge("concrete", conc, conc + .8, .55); } // open concourse bays under a beam
    for (let c=0;c<=nC;c++) rib("concrete", c/nC, .7, 0, Math.max(conc + 1, top(c/nC) - .3), .65); // the columns
    for (let c=0;c<nC;c++){ const f0 = c/nC + cw, f1 = (c + 1)/nC - cw; // a raking beam climbing each bay with the seats behind
      slant("steel", f0, conc + 1.1, f1, Math.max(conc + 1.6, top(f1) - .9), .55, .4); }
    const cores = Math.max(1, Math.round(len/45)), cwid = Math.min(6, len/(cores*3))/len;
    for (let k=0;k<cores;k++){ const fc = (k + .5)/cores; // stair cores: solid concrete towers with a slit of window up each
      block("concrete", fc - cwid, fc + cwid, 0, top(fc) + 1, 0, 3.4); panel("window", fc - .25/len, fc + .25/len, 1.5, Math.max(2, top(fc) - 1), 3.43); }
  }
  if (opt.concourse && lo > 6 && look !== "fins" && look !== "glass" && look !== "exposed"){ // a glazed concourse along the ground floor, under a canopy
    panel("window", 0, 1, .3, 4.4, .08); panel("glass", 0, 1, .3, 4.4, .5);
    for (let c=0;c<=cells(2.4);c++) rib("steel", c/cells(2.4), .12, .3, 4.4, .55);
    ledge("steel", 4.4, 4.75, 1.6);
  }
  /* Life at street level, whatever the look: a plinth along the foot of the wall, doors, a pair of roller-shutter gates,
     and blocks of turnstiles standing out from the wall, each under its own little canopy. The wall arrives a few metres
     at a time, so everything is spaced by its distance along the whole stand (opt.along is where this piece starts). */
  if (lo < 3.2 || opt.lift) return; // (no doors or turnstiles where a road runs under the stand)
  ledge("concrete", 0, .55, .16);
  const s0 = opt.along || 0, total = opt.total || len, here = d => d >= s0 && d < s0 + len, f = d => (d - s0)/len;
  const turn = []; for (let d = 17; d < total - 6; d += 34) turn.push(d);
  const gates = total > 40 ? [total*.25, total*.75].filter(g => turn.every(t => Math.abs(t - g) > 7)) : [];
  for (const d of turn) if (here(d)){ const fc = f(d), tw = 2.75/len; // turnstile blocks
    block("concrete", fc - tw, fc + tw, 0, 3, 0, 1.6); block("steel", fc - tw*1.08, fc + tw*1.08, 3, 3.25, 0, 2.2);
    for (let s=0;s<4;s++){ const fs = fc - tw + (s + .5)*(2*tw/4); panel("gate", fs - .3/len, fs + .3/len, .2, 2.3, 1.62); } }
  for (const d of gates) if (here(d)){ const fg = f(d); panel("steel", fg - 2.1/len, fg + 2.1/len, 0, 3.6, .1); // roller shutters for match-day crowds
    for (let y = .3; y < 3.6; y += .3) panel("frame", fg - 2.1/len, fg + 2.1/len, y, y + .04, .12); block("frame", fg - 2.3/len, fg + 2.3/len, 3.6, 4.1, 0, .35); }
  for (let d = 6.5; d < total - 2; d += 13) if (here(d) && turn.every(t => Math.abs(t - d) > 5) && gates.every(g => Math.abs(g - d) > 4)){
    const fd = f(d); panel("frame", fd - 1/len, fd + 1/len, .3, 2.55, .05); panel("gate", fd - .9/len, fd + .9/len, .3, 2.45, .07); } // doors, in a frame
}
