/* Façade looks. Each draws onto one stretch of outside wall from a to b (points on the ground), whose top runs from ya to
   yb, facing out along n. Everything stands slightly proud of the wall so it reads from the street and from the air. */
const FACADE_LOOKS = {brick:"Brick, with rows of windows", timber:"Painted timber", deco:"Art deco ribs", concrete:"Concrete bands",
  sheet:"Metal cladding with a club-colour stripe", fins:"Metal fins over a glazed concourse", glass:"Glass curtain wall", grid:"Windows all over", plain:"Plain wall"};
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
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1/metres, 1/metres);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.keep = true; return (wallTex[kind] = t);
}
const LOOK_TEX = {brick:"brick", timber:"timber", sheet:"cladding", fins:"cladding", deco:"concrete", concrete:"concrete", grid:"concrete", plain:"concrete"};
function textured(key, kind){
  if (!kind) return key; const k = key + "~" + kind;
  if (!M[k]){ M[k] = M[key].clone(); M[k].map = wallTexture(kind); }
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
  const cache = !document.fonts || document.fonts.check(font), t = new THREE.CanvasTexture(c); t.keep = cache;
  const m = new THREE.MeshStandardMaterial({map:t, transparent:true, alphaTest:.25, roughness:.5, emissive:new THREE.Color(colour), emissiveMap:t, emissiveIntensity:0});
  m.keep = cache; m.aspect = c.width/c.height;
  m.edge = new THREE.MeshStandardMaterial({map:t, transparent:true, alphaTest:.25, roughness:.6, color:new THREE.Color(0.45, 0.45, 0.45)}); m.edge.keep = cache; // the letters' thickness
  if (cache) signTex[k] = m;
  return m;
}
const ACCENTS = new Set(["trim", "band", "lattice"]); // the club colour goes on dressings and stripes, never on glazing frames or steel
function dressWall(buf, look, wallKey, a, b, ya, yb, n, opt){
  const len = Math.hypot(b[0]-a[0], b[1]-a[1]); if (len < 0.5) return;
  opt = opt || {}; const dens = opt.windows == null ? 1 : opt.windows, wsz = opt.winSize || 1, buf0 = buf;
  buf = k => buf0(opt.accent && ACCENTS.has(k) ? tint(k, opt.accent) : k); // trims, bands and fins in the accent colour
  const tg = [(b[0]-a[0])/len, (b[1]-a[1])/len], lo = Math.min(ya, yb);
  const P = (f, out) => [a[0] + (b[0]-a[0])*f + n[0]*out, a[1] + (b[1]-a[1])*f + n[1]*out];
  const Q = (p, y) => [p[0], y, p[1]];
  const top = f => ya + (yb - ya)*f;
  // a flat panel across part of the wall, standing out from it
  const panel = (key, f0, f1, y0, y1, out) => { const p0 = P(f0,out), p1 = P(f1,out); quad(buf(key), Q(p0,y0), Q(p1,y0), Q(p1,y1), Q(p0,y1)); };
  // a horizontal band with a top and underside, so it casts a shadow line
  const ledge = (key, y0, y1, depth, slope) => { const s0 = slope ? 0 : 0, f = g => slope ? top(g) - lo : s0;
    const a0 = P(0,0), b0 = P(1,0), a1 = P(0,depth), b1 = P(1,depth);
    quad(buf(key), Q(a1,y0+f(0)), Q(b1,y0+f(1)), Q(b1,y1+f(1)), Q(a1,y1+f(0)));
    quad(buf(key), Q(a0,y0+f(0)), Q(b0,y0+f(1)), Q(b1,y0+f(1)), Q(a1,y0+f(0)));
    quad(buf(key), Q(a0,y1+f(0)), Q(b0,y1+f(1)), Q(b1,y1+f(1)), Q(a1,y1+f(0))); };
  // a vertical strip standing out from the wall (pilaster, rib or mullion)
  const rib = (key, f, w, y0, y1, depth) => { const fw = w/2/len, q0 = P(f-fw,0), q1 = P(f+fw,0), r0 = P(f-fw,depth), r1 = P(f+fw,depth);
    quad(buf(key), Q(r0,y0), Q(r1,y0), Q(r1,y1), Q(r0,y1)); quad(buf(key), Q(q0,y0), Q(r0,y0), Q(r0,y1), Q(q0,y1));
    quad(buf(key), Q(r1,y0), Q(q1,y0), Q(q1,y1), Q(r1,y1)); quad(buf(key), Q(r0,y1), Q(r1,y1), Q(q1,y1), Q(q0,y1)); };
  const cells = step => Math.max(1, Math.round(len/step));
  const windows = (key, step, storey, first, w, h, sill) => { if (dens <= 0) return; const nC = cells(step/dens); w *= wsz; h = Math.min(h*wsz, storey - 0.6);
    for (let c=0;c<nC;c++){ const fc = (c + .5)/nC, fw = w/2/len;
      for (let y = first; y + h < Math.min(top(fc), lo + 2) - 1.2; y += storey){
        const fr = .09/len; panel("frame", fc - fw - fr, fc + fw + fr, y - .09, y + h + .09, .04); panel(key, fc - fw, fc + fw, y, y + h, .07); // glass in a frame
        if (w > 1.1) panel("frame", fc - .035/len, fc + .035/len, y, y + h, .09); // and a mullion down the middle of a wide one
        if (sill) panel(sill, fc - fw*1.25, fc + fw*1.25, y - .22, y, .14); } } };
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
  if (opt.concourse && lo > 6 && look !== "fins" && look !== "glass"){ // a glazed concourse along the ground floor, under a canopy
    panel("window", 0, 1, .3, 4.4, .08); panel("glass", 0, 1, .3, 4.4, .5);
    for (let c=0;c<=cells(2.4);c++) rib("steel", c/cells(2.4), .12, .3, 4.4, .55);
    ledge("steel", 4.4, 4.75, 1.6);
  }
}
