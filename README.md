# Groundworks

A 3D stadium-building sandbox that runs in the browser. Pick a playing area, build stands tier by tier, squeeze the ground onto a plot of land and dress it up, while it estimates capacity, sightlines, viewing distance and how fast each stand empties.

It's a creative tool. Its checks are loosely based on UK sports-ground guidance (the Green Guide), but passing them doesn't mean a design is safe, legal or buildable.

## What it does

- **Playing areas:** football, rugby, cricket, athletics, baseball, and arena floors (Wrestleball, boxing, MMA cage, basketball, ice hockey, tennis, concert, bullring, or any custom size).
- **Layouts:** separate stands, a continuous bowl, or a bowl with independent stands above it.
- **Stands:** 21 architectural styles, up to four tiers each (seats, executive boxes, rail seats, benches or terracing), overhangs, pillars, corners that join some or all tiers, and drag handles in the 3D view.
- **Roofs:** sloping, pitched or closed; five materials; five structural styles; level rooflines.
- **Sites:** squeeze the ground onto a plot, with hard or soft boundaries.
- **Architecture:** outer skins, an arch, spiral ramp towers, entrance towers, a raised plaza.
- **Floodlights and screens:** corner masts, lattice pylons or roof-edge lights; screens on any stand, corner or over the centre.
- **Atmosphere:** crowd, night matches, see-through roofs, seat colours and patterns.
- **Results:** capacity by stand and tier, sightline (C-value), furthest fan, emptying time, roof cover, restricted-view seats, and checks with one-tap fixes.
- **Workflow:** undo/redo, saved designs, compare designs, shareable design codes, saved camera views, presentation mode.

## Files

| Path | What it is |
|---|---|
| `index.html` | The finished app: one self-contained page. Open it in a browser or host it anywhere. |
| `src/data.js` | Sports, floors, seating types, safety rules, architectural styles and presets |
| `src/core.js` | Geometry, tier stacking and sightline maths, the 3D scene and materials |
| `src/build.js` | Builds the stadium, runs the checks, draws architecture, lights and screens |
| `src/ui.js` | The control panel, camera, editing, saving and undo |
| `src/styles.css`, `src/body.html` | The page's look and layout |
| `build.mjs` | Joins and minifies `src/` into `index.html` |

## Making changes

Edit the files in `src/`, then rebuild `index.html`:

```
npm install        # once
npm run build      # minified index.html
npm run build:dev  # unminified, easier to debug
```

## Hosting it free on GitHub Pages

In the repository on github.com: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, folder: / (root) → Save**. After a minute it's live at `https://<your-username>.github.io/groundworks/`.

## Notes

- Uses [three.js](https://threejs.org) r128, loaded from a CDN, so it needs an internet connection.
- Designs are saved in the browser you use; use a design code to move one elsewhere.
