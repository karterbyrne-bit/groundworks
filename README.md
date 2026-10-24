# Groundworks

A 3D stadium-building sandbox that runs in the browser. Pick a playing area, build stands tier by tier, squeeze the ground onto a plot of land and dress it up, while it estimates capacity, sightlines, viewing distance and how fast each stand empties.

It's a creative tool. Its checks are loosely based on UK sports-ground guidance (the Green Guide), but passing them doesn't mean a design is safe, legal or buildable.

## What it does

- **Playing areas:** football, rugby, cricket, athletics, baseball, and arena floors (Wrestleball, boxing, MMA cage, basketball, ice hockey, tennis, concert, bullring, or any custom size).
- **Layouts:** separate stands, a continuous bowl, or a bowl with independent stands above it. Upper tiers can follow their own oval or round outline (like La Cartuja or El Monumental) while the lower tier hugs the play.
- **Outside walls:** brick with windows, timber, art deco ribs, concrete bands, metal cladding, fins, glass curtain walls; windows light up at night.
- **Stands:** 21 architectural styles, up to four tiers each (seats, executive boxes, rail seats, benches or terracing), overhangs, pillars, corners that join some or all tiers, and drag handles in the 3D view.
- **Roofs:** sloping, pitched or closed; five materials; five structural styles; level rooflines.
- **Sites:** squeeze the ground onto a plot, with hard or soft boundaries.
- **Architecture:** outer skins, an arch, spiral ramp towers, entrance towers, a raised plaza.
- **Floodlights and screens:** corner masts, lattice pylons or roof-edge lights; screens on any stand, corner or over the centre.
- **Atmosphere:** crowd, night matches, see-through roofs, seat colours and patterns.
- **Results:** capacity by stand and tier, sightline (C-value), furthest fan, emptying time, roof cover, restricted-view seats, and checks with one-tap fixes.
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
| `src/build.js` | Builds the stadium, runs the checks, draws architecture, lights and screens |
| `src/ui.js` | The control panel, camera, editing, saving and undo |
| `src/styles.css`, `src/body.html` | The page's look and layout |
| `build.mjs` | Joins and minifies `src/`, three.js and the fonts into `index.html` |
| `sw.js`, `manifest.webmanifest`, `icon*`, `og.png` | Offline support, the installable-app details, icons and the link preview image |
| `tests/smoke.mjs` | Automated test that opens the app in a real browser and clicks through it |
| `docs/NFRs.md` | Non-functional requirements: speed, reliability, privacy and so on, with their status |

## Hosting it on Vercel

Import the repository in Vercel; `vercel.json` already tells it to run `npm run build` and publish the `dist/` folder. No other settings are needed.

## Making changes

Edit the files in `src/`, then rebuild `index.html`:

```
npm install        # once
npm run build      # minified index.html
npm run build:dev  # unminified, easier to debug
npm test           # opens the app in a browser and checks the main features work
```

Commit `index.html` along with your changes. GitHub checks the build and runs the tests on every push.

## Hosting it free on GitHub Pages

In the repository on github.com: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, folder: / (root) → Save**. After a minute it's live at `https://<your-username>.github.io/groundworks/`.

## Notes

- Uses [three.js](https://threejs.org) r128 (MIT licence) and the IBM Plex and Big Shoulders fonts (SIL Open Font Licence), all packed into the page.
- Designs are saved in the browser you use. Use Share this design to move one elsewhere. Nothing is sent to a server.
- The link preview (`og.png`) assumes the site lives at `https://karterbyrne-bit.github.io/groundworks/`. If it moves, change `SITE` in `build.mjs`.
