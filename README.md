# Groundworks

A 3D stadium-building sandbox that runs in the browser. Pick a playing area, build stands tier by tier, squeeze the ground onto a plot of land and dress it up, while it estimates capacity, sightlines, viewing distance and how fast each stand empties.

It's a creative tool. Its checks are loosely based on UK sports-ground guidance (the Green Guide), but passing them doesn't mean a design is safe, legal or buildable.

## What it does

- **Playing areas:** football, rugby, cricket (any boundary size, with the square, rope, sightscreens and scoreboard), athletics, baseball (set each outfield wall's distance and height, with a batter's eye and dugouts), and other outdoor floors (Wrestleball, tennis, a bullring, or any custom size).
- **Field shape:** the field round the pitch can follow the pitch, or be an oval or a circle (a round wrestleball ground, say), with the stands following it while the pitch keeps its own size and markings.
- **Layouts:** separate stands, a continuous bowl, a bowl with independent stands above it, or a ring of any number of separate stands (cricket grounds, ballparks). Upper tiers can follow their own oval or round outline (like La Cartuja or El Monumental) while the lower tier hugs the play. Bowls can leave out any side or corner (a horseshoe, two sides, an L) and give each side its own number of rows, with the corners blending between them.
- **Outside walls:** brick with windows, timber, art deco ribs, concrete bands, metal cladding, fins, glass curtain walls, with real brick, concrete, metal and timber textures. Pick each stand's wall and accent colours, how many windows and how big, a glazed concourse, and lettering on the wall or roof front; windows light up at night.
- **Stands:** 21 architectural styles, as many tiers as you like (up to 20) (seats, executive boxes, rail seats, benches or terracing), overhangs, pillars, and drag handles in the 3D view. Each stand has its own length: it can run on past the end of the pitch, or wrap part or all of the way round into the corner at either end, and two stands that wrap in meet up. A corner is whatever is left between two stands: left open, or given a corner stand of its own. Each tier can have its own front (plain, Leitch lattice, glass, concrete, brick) and colours, stop short of either end, and be held up by towers at each end with a truss, like Ibrox's Club Deck. Upper tiers stay level along their stand.
- **Stand presets and my stands:** start any stand from a famous kind of stand (a giant standing terrace like the Yellow Wall, a Kop-style home end, a Leitch main stand, a three-tier super stand, a sheer Bombonera-style stand of boxes, an Edwardian single-decker, a Victorian cricket pavilion), or save your own stand and put it on any side of any design.
- **Roofs:** sloping, pitched or closed; five materials with real sheeting (profiled metal, ribbed polycarbonate, framed glass, corrugated tin), a grey ceiling and steel rafters underneath, a deep front beam, and an optional see-through strip along the front; six structural styles, including a big truss along the top; level rooflines. Or one roof over the whole ground, designed on its own: it follows the stands or is oval or round, spans gaps and open corners, and can close over the floor.
- **Convertible grounds:** give a ground a second sport (athletics, football, rugby, tennis, wrestleball) and switch between the two set-ups: the lower tier slides back or has its front rows decked over for a bigger field, and pull-out seats come forward for a smaller one, with the capacity both ways.
- **Sites:** squeeze the ground onto a plot, with hard or soft boundaries; drag its posts or type its exact width, depth and corners. Add roads, rivers, canals, railways, terraced houses and buildings at real sizes; stands are cut back to clear them.
- **Architecture:** outer skins, an arch, spiral ramp towers, entrance towers, a raised plaza.
- **Floodlights and screens:** corner masts, lattice pylons or roof-edge lights; screens on any stand, corner or over the centre.
- **Tunnel and dugouts:** a players' tunnel out of any stand, at any point along it and any width, with an extending tunnel onto the pitch; dugouts either side of halfway as perspex shelters by the touchline (with the technical area marked), sunk into the front of the stand, or padded seats in the front rows, at any length and spacing and in their own colour.
- **Access and facilities:** wheelchair platforms (each space with a companion seat) at the front, middle or back of the lower tier or the front of the top tier, spread evenly, grouped in the middle, towards the ends or at one end, with each stand able to set its own number, place, arrangement and length, and checked against guidance for the ground's size; an emergency vehicle entrance through any stand so an ambulance or fire engine can drive onto the pitch; basic, good or premium facilities for each stand.
- **Entrances:** for each tier, choose whether fans come in from the middle (exit tunnels, at whatever height up the tier you like), from the back or from the front, and how far apart the entrances are. A level walkway runs the length of the tier where fans come in (in front of the exit tunnels, or along the back or front), with the entrances at the heads of the gangways, and there's a check on how far the furthest fan has to walk.
- **Name and sponsors:** give the ground a name (naming rights) that goes up along the main stand's roof, and list up to eight sponsors for the advertising boards round the pitch (set how far behind the goals and back from the touchlines they stand, and how tall they are) and the LED ribbons along the tier fronts.
- **Atmosphere:** a crowd of people in the club's colours; an away end in any stand, starting from its middle or either end, with its own allocation of seats and a gap of empty seats round it; a home end (taking in its side of a bowl too) packed with the club's colours, on its feet, with flags, banners over every tier front carrying the fans' own words, an optional card display, and its name on the roof; stewards in hi-vis, how full the ground is, and a Mexican wave; a real sky and fields round the ground (or a plain model look); night matches and the time of day (long golden shadows in the evening), see-through roofs, seat colours and patterns, letters spelt out in the seats, and players lined up for kick-off.
- **Results:** capacity by stand and tier, sightline (C-value), furthest fan, normal emptying time and emergency evacuation time (set by each stand's fire risk, and helped by emergency gates in the pitch-side wall and emergency-only exits at the back of each tier, with green exit signs), roof cover, restricted-view seats, and checks with one-tap fixes, including rows with a gangway at one end only.
- **Architect's notes:** a score out of 10 for atmosphere, views, shelter, looks and getting in and out, with notes in plain words, one-tap changes and a rough build cost.
- **Workflow:** undo/redo, saved designs, compare designs, share links, saved camera views, presentation mode, keyboard shortcuts (press `?`).
- **Just for fun:** Surprise me builds a random stadium, and the capacity is compared with real grounds.
- **Works anywhere:** no other websites needed, works offline once visited, and can be installed like an app on a phone.

## Files

| Path | What it is |
|---|---|
| `index.html` | The finished app: one self-contained page, with the 3D engine and fonts packed in. Open it in a browser or host it anywhere. |
| `src/boot.js` | Starts first: the loading screen, the friendly error card, and offline support |
| `src/data.js` | Sports, floors, seating types, safety rules, architectural styles and presets |
| `src/core.js` | Geometry, tier stacking and sightline maths, the 3D scene and materials |
| `src/build/` | Builds the stadium and runs the checks: `basics.js` (shared helpers, bowl pieces), `atmosphere.js` (crowd, home and away ends, sky, day and night), `architecture.js` (skins, arches, towers), `fittings.js` (floodlights, screens, sponsors, tunnel, dugouts, access), `walls.js` (outside walls), `roofs-site.js` (roof lights and sheeting, surroundings), `neighbourhood.js` (the streets and houses round the ground), `views.js` (obstructed views), `leveller.js` (lining tiers up across stands), `stadium.js` (the main build and every check) |
| `src/ui/` | The control panel: `readout.js` (results and architect's notes), `camera.js` (camera, views, undo), `stand-editor.js` (stands and roofs), `ground.js` (sports, site, layouts, presets), `saving.js` (saved designs, share links, Surprise me), `welcome.js` (welcome, help, shortcuts, start-up) |
| `src/styles.css`, `src/body.html` | The page's look and layout |
| `build.mjs` | Joins and minifies `src/`, three.js and the fonts into `index.html` |
| `sw.js`, `manifest.webmanifest`, `icon*`, `og.png` | Offline support, the installable-app details, icons and the link preview image |
| `tests/smoke.mjs` | Automated test that opens the app in a real browser, checks every preset's capacity, and clicks through it |
| `tests/expected.json` | The exact capacity and number of check issues of every preset, which the test compares against |
| `CLAUDE.md` | House rules for Claude Code sessions working on this project |
| `docs/NFRs.md` | Non-functional requirements: speed, reliability, privacy and so on, with their status |

## Hosting it on Vercel

Import the repository in Vercel; `vercel.json` already tells it to run `npm run build` and publish the `dist/` folder. No other settings are needed.

## Making changes

Edit the files in `src/`, then rebuild `index.html`:

```
npm install        # once
npm run build      # minified index.html
npm run build:dev  # unminified, easier to debug
npm test           # opens the app in a browser and checks the main features work, desktop and phone
npm run test:quick # the same at phone size only (what GitHub runs on a pull request)
npm run update-expected  # only after a deliberate change to the maths: re-records every preset's capacity
```

Commit `index.html` along with your changes. GitHub checks the build and runs the tests on every push.

## Hosting it free on GitHub Pages

In the repository on github.com: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, folder: / (root) → Save**. After a minute it's live at `https://<your-username>.github.io/groundworks/`.

## Notes

- Uses [three.js](https://threejs.org) r186 (MIT licence) and the IBM Plex and Big Shoulders fonts (SIL Open Font Licence), all packed into the page.
- Designs are saved in the browser you use. Use Share this design to move one elsewhere. Nothing is sent to a server.
- The link preview (`og.png`) assumes the site lives at `https://karterbyrne-bit.github.io/groundworks/`. If it moves, change `SITE` in `build.mjs`.
- Copyright © 2026 Karter Byrne. All rights reserved. The code is visible here but not licensed for reuse; see `LICENSE`.
