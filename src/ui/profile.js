/* ================= Ground profile =================
   An encyclopedia-style article about the current ground, written from the design with templates, like the Architect's
   notes: the same design always reads the same, and different grounds read differently. Text is plain, with **bold**
   and line breaks, so it can go on the page and onto a picture alike. */
function groundProfile(){
  const D = LAST; if (!D || !D.total) return null;
  const say = criticSay(hashSeed(["profile", D.total, S.sport, ...D.parts.map(p => p.label + p.seats)].join("|")));
  const F = field(), wb = F.kind === "wrestleball", sport = wb ? "Wrestleball" : S.sport;
  const name = sponsorsOf().title || say(["Ashworth", "Millbrook", "Harlow", "Saltmarsh", "Fenwick"], "town") + say([" Park", " Road", " Lane"], "kind");
  const A = architectNotes(D), cost = buildCost(D), cover = D.covered/D.total, terr = D.byType.terrace + D.byType.rail, HE = homeEndOf(), AW = awayOf(), AR = S.arch || {};
  const parts = mergeParts(D.parts).filter(p => p.seats > 0 && p.key !== "F");
  const eras = new Set(standCfgs().map(c => (STYLES[c.style] || {}).era || "Modern")), old = eras.has("Traditional"), h = hashSeed(name + D.total);
  const opened = old ? 1895 + h % 35 : eras.has("1970s–90s") ? 1968 + h % 25 : 1996 + h % 28;
  const end = k => { const c = CORNERS.find(c => c.key === k); return (c ? c.name : SIDE_NAMES[k] || "").toLowerCase(); };
  const kind = terr > D.total*.3 ? "a terraced" : terr ? "a mostly all-seater" : "an all-seater", r = Math.round;
  const lead = say([`**${name}** is ${kind} ${sport} stadium with a capacity of ${fmt(D.total)}.`,
    `**${name}** is ${D.total > 40000 ? "one of the larger" : D.total < 12000 ? "one of the more intimate" : "a mid-sized"} ${sport} grounds, holding ${fmt(D.total)}.`,
    `**${name}** holds ${fmt(D.total)} on a good day, and on a bad one.`], "lead");
  const fact = [["Location", "Fictional"], ["Capacity", fmt(D.total)], ["Record attendance", fmt(D.total) + " (every match)"],
    ["Surface", S.sport === "athletics" ? "Track and grass" : cap1(F.surface || "grass")], ["Sport", cap1(sport)], ["Home end", HE.at ? cap1(end(HE.at)) : "Undecided"],
    ["Roof", groundRoofOn() ? "Single roof" : cover > .97 ? "Over every seat" : cover < .05 ? "None" : `Over ${r(cover*100)}% of seats`],
    ["Architect", "You"], ["Opened", opened], ["Build cost", "About £" + (cost >= 1e9 ? (cost/1e9).toFixed(1) + " billion" : r(cost/1e6) + " million")]];
  const hist = [wb ? "Wrestleball is a contact sport played on a 16.5 × 4.5 m strip of grass: two 4 m end zones either side of an 8.5 m centre. Its followers regard the narrowness as the whole point." : "",
    old ? say([`The ground opened in ${opened}, in the age of brick and pillars.`, `Its first stand went up in ${opened}.`], "h1")
      : say([`The ground opened in ${opened} as a purpose-built ${sport} venue.`, `It was completed in ${opened}, roughly on time.`], "h1"),
    eras.size > 1 ? say(["It grew a stand at a time.", "No two stands share a decade."], "h2") : "",
    AR.arch ? "Its arch is visible from the ring road." : AR.skin && AR.skin !== "none" ? "An outer skin later wrapped it into one building." : ""];
  const struct = parts.map(p => { const cfg = cfgOfKey(p.key) || {}, n = p.tiers.length, crit = A.stands.find(s => s.name === p.label);
    return `The **${p.label}** holds ${fmt(p.seats)} on ${n === 1 ? "a single tier" : n + " tiers"} and ${groundRoofOn() ? "is under the single roof" : p.key === "B" && isHybrid() ? "runs under the stands" : !cfg.roof || cfg.roof.shape === "none" ? "is open to the sky" : `has a ${(ROOF_MATS[cfg.roof.mat] || "metal").toLowerCase()} roof`}.`
      + (crit ? ` ${say(["The architect's notes call it", "Critics call it"], p.label)} "${crit.text.charAt(0).toLowerCase() + crit.text.slice(1, -1)}".` : ""); });
  const atm = [say([`The front row is ${r(D.set)} m from the play.`, `Nobody is closer than ${r(D.set)} m to the play.`], "a1"),
    HE.at ? `The home support gathers in the ${end(HE.at)}${HE.name ? `, known as ${HE.name}` : ""}.` : "",
    AW.on && D.awayAlloc && D.awayAlloc.seats ? `Away fans get ${fmt(r(D.awayAlloc.seats))} places in the ${end(AW.at)}.` : "",
    S.halo || S.flares ? "On matchdays the roofs glow and flares are tolerated." : "",
    A.sc.atmosphere >= 8 ? say(["It is a loud ground for its size.", "Visiting players mention the noise."], "a2")
      : A.sc.atmosphere < 5 ? say(["The noise drifts away over the open ends.", "The atmosphere is described locally as \"polite\"."], "a2") : "The atmosphere is considered decent."];
  const triv = [`The architect's notes give it ${A.overall.toFixed(1)}/10; its best feature is ${A.best}.`,
    D.restricted ? `${fmt(D.restricted)} seats have a restricted view.` : "Not one seat has a restricted view, as the club often says.",
    likeText(D.total), `Its highest point is ${r(D.maxH)} m up; the furthest seat is ${r(D.far)} m from the ${D.farName || "play"}.`];
  const j = (a, s) => a.filter(Boolean).join(s);
  return {name, lead, fact, sec:[["History", j(hist, " ")], ["Structure", j(struct, "\n\n")], ["Atmosphere", j(atm, " ")], ["Trivia", j(triv.map(t => t && "• " + t), "\n")]]};
}
const profileBox = $("profile"), richText = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
function showProfile(){
  const P = groundProfile(); if (!P) return toast("<b>Nothing built yet.</b>");
  $("profileBody").innerHTML = `<h2>${esc(P.name)}</h2><aside class="infobox"><img id="profilePic" alt="The ground from above"><table>${P.fact.map(([k, v]) => `<tr><th>${k}<td>${esc(v)}`).join("")}</table></aside>
    <p>${richText(P.lead)}</p>${P.sec.map(([hd, t]) => `<h3>${hd}</h3><p>${richText(t)}</p>`).join("")}`;
  if (!profileBox.open) profileBox.showModal();
  /* a small picture from the aerial view, whatever the camera is doing */
  const cam = persp.clone(), T = camTarget("aerial"), c = document.createElement("canvas");
  cam.aspect = 1.5; cam.updateProjectionMatrix(); cam.position.copy(T.p); cam.lookAt(T.t); c.width = 480; c.height = 320;
  try { renderer.setPixelRatio(1); renderer.setSize(480, 320, false); renderer.render(scene, cam); c.getContext("2d").drawImage(renderer.domElement, 0, 0); $("profilePic").src = c.toDataURL("image/jpeg", .85); }
  catch(e) {} finally { resize(); invalidate(); }
}
/* The article as a picture: the title, the photo, the facts, then the text. */
function profileImage(){
  const P = groundProfile(), W = 1080, M = 60, c = document.createElement("canvas"), g = c.getContext("2d"), pic = $("profilePic");
  const font = (b, z) => b ? `800 ${z}px 'Big Shoulders Display', sans-serif` : `400 ${z}px 'IBM Plex Sans', sans-serif`;
  const lay = (txt, z, wMax) => { g.font = font(0, z); const out = [];
    for (const para of txt.replace(/\*\*/g, "").split("\n")){ let line = ""; for (const word of para.split(" ")){ const t = line ? line + " " + word : word;
      if (g.measureText(t).width > wMax && line){ out.push(line); line = word; } else line = t; } out.push(line); } return out; };
  const body = [[lay(P.fact.map(f => f.join(": ")).join("\n"), 22, W), 22], [lay(P.lead, 25, W), 25]];
  for (const [hd, t] of P.sec) body.push([[hd], 34, 1], [lay(t, 22, W), 22]);
  const H = body.reduce((a, [ls, z]) => a + ls.length*z*1.4 + 12, 520);
  c.width = W + 2*M; c.height = H; g.fillStyle = "#f7f8f4"; g.fillRect(0, 0, W + 2*M, H); g.textBaseline = "top"; g.fillStyle = "#17201b";
  g.font = font(1, 56); g.fillText(P.name.toUpperCase(), M, M);
  if (pic && pic.naturalWidth) g.drawImage(pic, M, 140, 480, 320);
  let y = 490; for (const [ls, z, b] of body){ g.font = font(b, z); for (const t of ls){ g.fillText(t, M, y); y += z*1.4; } y += 12; }
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(), "image/png"));
}
$("profileBtn").addEventListener("click", showProfile);
$("profileClose").addEventListener("click", () => profileBox.close());
$("profileSave").addEventListener("click", e => saveImage(e.currentTarget, profileImage, "-profile"));
