# House rules for Groundworks

## Who it's for

Groundworks is for football, rugby and athletics fans sketching their dream grounds, plus Wrestleball. Fun comes first; the safety checks are a bonus, not the point. Wrestleball is the owner's own made-up sport: it stays, and it isn't a mistake to "fix".

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

Claude Code sessions run the full `npm test` locally before opening a pull request. GitHub's "Check" runs only on pull requests, and runs the quicker `npm run test:quick` (the pinned capacities, then the main features at phone size) to save Actions minutes. To have GitHub run the full test, add the `full-test` label to the pull request, or run "Check" by hand from the Actions tab.

## Capacities are pinned

`tests/expected.json` holds the exact capacity and number of check issues of the default design and every preset. `npm test` fails if any of them changes, and shows the old and new number.

- If a capacity or issue count changes, tell the owner which presets changed, by how much, and why.
- Only run `npm run update-expected` (which rewrites `tests/expected.json`) once the owner has agreed the change is intended. Never update it just to make the tests pass.

## Budget

Groundworks has to stay quick on a phone, so its size is capped.

- `index.html` must not grow past **1,145,000 bytes** (raised by the owner on 28 October to make room for the Ground profile and the roof controls) without the owner's OK. If a job would push it over, say by how much and why, and ask first.
- `build()` in `src/build/stadium.js` must not grow (it is **1,295 lines** now; when it's split into stages, the cap becomes its new length). New features go in their own files and are called from `build()` in one line.
- Before adding any new control (a switch, slider, menu or button), check whether an existing one could do the job, and say which you checked.
- At the end of every job, report `index.html`'s size and `build()`'s length:
  - size: `wc -c < index.html`
  - length: `awk '/^function build\(/{s=NR} s && /^}/{print NR-s+1; exit}' src/build/stadium.js`

## Map of the files

| File | What it does |
|---|---|
| `src/boot.js` | Starts first: the loading screen, the friendly error card, and offline support |
| `src/data.js` | Sports (football, rugby, athletics, Wrestleball and a plain floor), seating types, safety rules, architectural styles and presets, and opening old designs that used a removed sport as football |
| `src/core.js` | Geometry, tier stacking and sightline maths, the 3D scene and materials |
| `src/build/basics.js` | Shared building helpers: who gets each corner, row counts, colour-tinted materials, the pieces of a bowl |
| `src/build/atmosphere.js` | Seat patterns and lettering, the crowd, away end and home end, players, the Mexican wave, sky, scenery, day and night |
| `src/build/architecture.js` | Signature architecture: outer skins, arches, ramp towers, entrance towers, the plaza, lattice pylons |
| `src/build/fittings.js` | Floodlights, screens, sponsors' boards and banners, the tunnel and dugouts, wheelchair spaces, facilities, entrances |
| `src/build/walls.js` | The outside walls: façade looks, brick/concrete/metal/timber textures, lettering, windows |
| `src/build/roofs-site.js` | Roof-edge floodlights, the surroundings (roads, rivers, houses), roof trusses and lamp heads, convertible grounds, roof sheeting |
| `src/build/neighbourhood.js` | The streets, terraced houses, car park, trees and bigger buildings round the ground (decoration only), and roads that snap to the plot's edge |
| `src/build/views.js` | Obstructed views: which seats have pillars, overhangs, masts or screens in the way, and how badly, plus the amber/red colouring |
| `src/build/leveller.js` | The tier leveller: an upper tier set to line up with the same tier of another stand |
| `src/build/stadium.js` | `build()`: builds the whole stadium, works out capacity, runs every check, plus the one-tap fix search |
| `src/ui/readout.js` | The results readout, the architect's notes, pop-up messages, one-tap fixes, and the panes of controls |
| `src/ui/camera.js` | The camera and saved views, dragging handles in 3D, the drawing loop, light/dark theme, undo/redo and autosave |
| `src/ui/stand-editor.js` | The stand editor (tiers, roofs, walls, stand presets and my stands) and the one roof over the whole ground |
| `src/ui/ground.js` | Seating sizes and rules, floors and sports, the site plot and surroundings, screens, layouts, the preset buttons |
| `src/ui/saving.js` | My stands, saved designs, design codes, share links and Surprise me |
| `src/ui/welcome.js` | The welcome card, help, keyboard shortcuts, keeping the controls in step with the design, and starting the app |
| `src/styles.css`, `src/body.html` | The page's look and layout |
| `build.mjs` | Joins and minifies `src/`, three.js and the fonts into `index.html` |
| `tests/smoke.mjs` | Opens the app in a real browser, checks the pinned capacities, then clicks through the main features (`--quick`: at phone size only) |
| `.github/workflows/check.yml` | GitHub's check on each pull request: the build matches `src/`, then the quick test (or the full one with the `full-test` label) |
| `tests/expected.json` | The pinned capacity and issue count of every preset |

`src/build/stadium.js` is still big (about 1,240 lines) because almost all of it is one function, `build()`, whose parts share its working variables. Splitting it further means rewriting it, so ask the owner first.
