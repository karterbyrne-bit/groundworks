/* ================= the one roof's structure =================
   What holds up the one roof over the whole ground, drawn round the ring of slices build() lays out for it: P(i, d) is
   a point d out along slice i, dIn/dOut its inner and outer edges, Y(i)(f) the roof's height a share f of the way out,
   cum how far round the ring each slice is. Every roof but a hidden one gets slim rafters under the sheeting; deep
   trusses hang under it front to back on columns behind the stands; a deep girder runs round the top of it on great corner
   towers, with trusses reaching in, as at San Siro. Returns the highest point it reaches. */
function groundRoofStructure(R){
  const {n, P, dIn, dOut, Y, buf, gr, cum, grow} = R, sb = buf(gr.colour ? tint("steel", gr.colour) : "steel"), kind = gr.support; // the steel in its own colour, if it has one
  const at = (i, f, y) => { const q = P(i, lerp(dIn[i], dOut[i], f)); return [q[0], y, q[1]]; };
  const every = step => { const out = []; let next = step/2; for (let i=0;i<n;i++) if (cum[i] >= next){ out.push(i); next += step; } return out; };
  let top = 0;
  if (kind !== "none") for (const i of every(kind === "trusses" ? 6 : 8)){ const a = Y(i); // rafters under the sheeting
    for (let k=0;k<4;k++) bar(sb, at(i, k/4, a(k/4) - .25), at(i, (k+1)/4, a((k+1)/4) - .25), .22); }
  if (kind === "trusses") for (const i of every(12)){ const a = Y(i), K = 6, t = f => a(f) - .3, b = f => a(f) - 1.1 - 3.4*f; // deepest at the back, where it's held
    for (let k=0;k<K;k++){ const f0 = k/K, f1 = (k+1)/K;
      bar(sb, at(i, f0, t(f0)), at(i, f1, t(f1)), .32); bar(sb, at(i, f0, b(f0)), at(i, f1, b(f1)), .32);
      bar(sb, at(i, f1, t(f1)), at(i, f1, b(f1)), .18); bar(sb, k % 2 ? at(i, f0, t(f0)) : at(i, f0, b(f0)), k % 2 ? at(i, f1, b(f1)) : at(i, f1, t(f1)), .16); }
    bar(sb, at(i, 0, t(0)), at(i, 0, b(0)), .18);
    const c = P(i, dOut[i] - .6); post(buf("column"), c[0], c[1], 0, b(1), .7); }
  if (kind === "girders"){ // San Siro: a deep lattice girder right round the top of the roof, on great towers at the corners, with trusses reaching in from it
    const gb = sb, lo = i => Y(i)(1) + .35, hi = i => Y(i)(1) + 8;
    for (let i=0;i<n;i++){ const j = (i+1)%n, p = at(i, 1, 0), q = at(j, 1, 0), A = y => [p[0], y, p[2]], B = y => [q[0], y, q[2]];
      bar(gb, A(lo(i)), B(lo(j)), .55); bar(gb, A(hi(i)), B(hi(j)), .55); bar(gb, A(lo(i)), A(hi(i)), .3); bar(gb, i % 2 ? A(lo(i)) : A(hi(i)), i % 2 ? B(hi(j)) : B(lo(j)), .26); }
    for (const i of every(18)){ const a = Y(i), K = 6, t = f => a(f) + .35 + (hi(i) - a(1) - .35)*f; // down from the girder to the roof's inner edge
      for (let k=0;k<K;k++){ const f0 = k/K, f1 = (k+1)/K; bar(gb, at(i, f0, t(f0)), at(i, f1, t(f1)), .4); bar(gb, at(i, f1, a(f1) + .35), at(i, f1, t(f1)), .2); } }
    const corner = [[1,1],[1,-1],[-1,1],[-1,-1]].map(([sx, sz]) => { let best = 0, bd = -2; // the slice pointing most nearly at each corner
      for (let i=0;i<n;i++){ const p0 = P(i, dIn[i]), p1 = P(i, dOut[i]), dx = p1[0]-p0[0], dz = p1[1]-p0[1], l = Math.hypot(dx, dz) || 1, d = (dx*sx + dz*sz)/(l*Math.SQRT2); if (d > bd){ bd = d; best = i; } } return best; });
    for (const i of corner){ const q = P(i, dOut[i] + 5), yT = hi(i) + 2; post(buf("concrete"), q[0], q[1], 0, yT, 7); bar(gb, at(i, 1, hi(i)), [q[0], yT - 1, q[1]], .6); grow(q[0], q[1]); top = Math.max(top, yT); }
    top = Math.max(top, ...Array.from({length:n}, (_, i) => hi(i))); }
  return top;
}
/* Famous roofs to start the one roof from: its own settings, plus the signature architecture that goes with it. */
const FAMOUS_ROOFS = {
  wembley:{label:"Wembley: a ring under an arch", roof:{shape:"oval", cover:"ring", mat:"translucent", support:"none", reach:6, back:2, lift:6, tilt:6, curve:.2, wall:false}, arch:{arch:true}},
  allianz:{label:"Allianz Arena: glowing cushions all round", roof:{shape:"oval", cover:"ring", mat:"translucent", support:"none", reach:4, back:1.5, lift:3, tilt:2, curve:.3, wall:true}, arch:{skin:"cushion", skinShape:"round"}},
  etihad:{label:"Etihad: masts and cables", roof:{shape:"follow", cover:"ring", mat:"metal", support:"masts", reach:3, back:1.5, lift:5, tilt:4, curve:0, wall:false}},
  sansiro:{label:"San Siro: red girders on towers", roof:{shape:"follow", cover:"ring", mat:"translucent", support:"girders", colour:"#c8102e", reach:2, back:3, lift:6, tilt:0, curve:0, wall:false}, arch:{ramps:true}},
  stadefrance:{label:"Stade de France: a floating ellipse", roof:{shape:"oval", cover:"ring", mat:"translucent", support:"columns", reach:10, back:2, lift:8, tilt:3, curve:0, wall:false}},
  cardiff:{label:"Cardiff: a roof that closes", roof:{shape:"follow", cover:"closed", opening:.55, mat:"metal", support:"masts", reach:3, back:1.5, lift:5, tilt:3, curve:0, wall:false}},
  trussed:{label:"Old-school: deep trusses on columns", roof:{shape:"follow", cover:"ring", mat:"metal", support:"trusses", reach:2, back:1.5, lift:4, tilt:4, curve:0, wall:false}},
};
