# House rules for Groundworks

## Who it's for

Groundworks is for football and rugby fans sketching their dream grounds. Fun comes first; the safety checks are a bonus, not the point. Wrestleball is the owner's own made-up sport: it stays, and it isn't a mistake to "fix".

## Talking to the owner

- The owner isn't a developer. Explain everything in plain English: what changed, what it means for the app, and what (if anything) they need to do. No jargon without a one-line explanation.
- Don't add features that weren't asked for. If you spot a good idea, suggest it instead.
- One job per request. Keep changes small and focused.

## Editing

- Only edit files in `src/`. Touch anything else (tests, docs, `build.mjs`) only when the request is about it.
- Never hand-edit `index.html`. It's built from `src/` by `npm run build`.
- `build.mjs` joins the files in `src/` into one shared scope, in the fixed order listed in its `FILES` list. Anything a file uses at start-up must be defined in that file or an earlier one. If you add a file, add it to `FILES` in the right place.

## After every change

1. Run `npm run build` and `npm test`. Both must pass. (The test opens the app in a real browser and can take up to about 20 minutes.)
2. Commit the rebuilt `index.html` along with your changes. GitHub checks it matches `src/`.

## Capacities are pinned

`tests/expected.json` holds the exact capacity and number of check issues of the default design and every preset. `npm test` fails if any of them changes, and shows the old and new number.

- If a capacity or issue count changes, tell the owner which presets changed, by how much, and why.
- Only run `npm run update-expected` (which rewrites `tests/expected.json`) once the owner has agreed the change is intended. Never update it just to make the tests pass.

## Map of the files

| File | What it does |
|---|---|
| `src/boot.js` | Starts first: the loading screen, the friendly error card, and offline support |
| `src/data.js` | Sports, floors, seating types, safety rules, architectural styles and presets |
| `src/core.js` | Geometry, tier stacking and sightline maths, the 3D scene and materials |
| `src/build/basics.js` | Shared building helpers: who gets each corner, row counts, colour-tinted materials, the pieces of a bowl |
| `src/build/atmosphere.js` | Seat patterns and lettering, the crowd, away end and home end, players, the Mexican wave, sky, scenery, day and night |
| `src/build/architecture.js` | Signature architecture: outer skins, arches, ramp towers, entrance towers, the plaza, lattice pylons |
| `src/build/fittings.js` | Floodlights, screens, sponsors' boards and banners, the tunnel and dugouts, wheelchair spaces, facilities, entrances |
| `src/build/walls.js` | The outside walls: façade looks, brick/concrete/metal/timber textures, lettering, windows |
| `src/build/roofs-site.js` | Roof-edge floodlights, the surroundings (roads, rivers, houses), roof trusses and lamp heads, convertible grounds, roof sheeting |
| `src/build/neighbourhood.js` | The streets, terraced houses, car park, trees and bigger buildings round the ground (decoration only), and roads that snap to the plot's edge |
| `src/build/stadium.js` | `build()`: builds the whole stadium, works out capacity, runs every check, plus the one-tap fix search |
| `src/ui/readout.js` | The results readout, the architect's notes, pop-up messages, one-tap fixes, and the panes of controls |
| `src/ui/camera.js` | The camera and saved views, dragging handles in 3D, the drawing loop, light/dark theme, undo/redo and autosave |
| `src/ui/stand-editor.js` | The stand editor (tiers, roofs, walls, stand presets and my stands) and the one roof over the whole ground |
| `src/ui/ground.js` | Seating sizes and rules, floors and sports, the site plot and surroundings, screens, layouts, the preset buttons |
| `src/ui/saving.js` | My stands, saved designs, design codes, share links and Surprise me |
| `src/ui/welcome.js` | The welcome card, help, keyboard shortcuts, keeping the controls in step with the design, and starting the app |
| `src/styles.css`, `src/body.html` | The page's look and layout |
| `build.mjs` | Joins and minifies `src/`, three.js and the fonts into `index.html` |
| `tests/smoke.mjs` | Opens the app in a real browser, checks the pinned capacities, then clicks through the main features |
| `tests/expected.json` | The pinned capacity and issue count of every preset |

`src/build/stadium.js` is still big (about 1,240 lines) because almost all of it is one function, `build()`, whose parts share its working variables. Splitting it further means rewriting it, so ask the owner first.
