# Groundworks: non-functional requirements

These describe *how well* Groundworks should work, rather than what it does. Each one has a target you can check and its status as of October 2026.

**Status:** ✅ met · 🟡 partly met or not yet measured · ⬜ not started

## 1. Speed

| # | Requirement | Target | Status |
|---|---|---|---|
| P1 | Download size | The page is under 400 KB compressed. | ✅ About 340 KB with gzip (GitHub Pages compresses automatically). |
| P2 | First view | On a mid-range phone with 4G, the stadium is on screen within 3 seconds. | 🟡 A loading screen shows straight away. Still to be timed on a real phone. |
| P3 | Response to edits | A change to a setting shows in the 3D view within 0.5 seconds. | 🟡 Instant on a laptop. Check on a mid-range phone. |
| P4 | Smooth movement | Orbiting the camera stays at 30 frames per second or better on a 2021 mid-range phone. | 🟡 Not yet measured. |
| P5 | Battery | Nothing is redrawn while the stadium sits still. | ✅ The frame loop stops completely half a second after the last change or touch. Shadows are only worked out again when the stadium changes, not while you orbit. Phones and tablets use fewer pixels and a smaller shadow map. |
| P6 | Long sessions | Editing for an hour is as quick as the first minute. | ✅ Colours, lettering and screen faces that a rebuild no longer uses are freed. The automated test checks memory stays flat after many colour changes. |

## 2. Reliability

| # | Requirement | Target | Status |
|---|---|---|---|
| R1 | No outside dependencies | The app loads and works without contacting any other website. | ✅ The 3D engine and fonts are packed into the page. The automated test checks this. |
| R2 | Works offline | After one visit, the app opens with no internet connection. | ✅ An offline copy is kept by `sw.js` (only on https, so on GitHub Pages and not when the file is opened directly). |
| R3 | Never a blank screen | If the app can't start, people see a plain-English message and a way to recover. | ✅ Recovery card with Reload and Start with a fresh design. The automated test covers this. |
| R4 | No lost work | The current design saves itself after every change, and a crash never wipes saved designs. | ✅ |
| R5 | Old designs still open | Designs saved by older versions still open after an update. | ✅ Version 5 designs are upgraded automatically. Keep this up when the design format changes. |
| R6 | Safe sharing | A shared link or design code can't run code in someone else's browser. | ✅ Shared designs are checked before opening, and the automated test tries a tampered link. |

## 3. Devices and browsers

| # | Requirement | Target | Status |
|---|---|---|---|
| D1 | Browsers | The latest two versions of Chrome, Safari, Firefox and Edge. | 🟡 Chrome is tested automatically. Check Safari (iPhone) and Firefox by hand before each release. |
| D2 | Screen sizes | Usable from 360 px wide (small phones) up to large desktops, with no sideways scrolling. | ✅ Tested at 390 px and 1400 px. |
| D3 | Touch | Buttons are easy to tap on touch screens. | ✅ Buttons get bigger on touch screens. |
| D4 | No 3D support | Devices without 3D graphics get a clear explanation. | ✅ |

## 4. Ease of use and accessibility

| # | Requirement | Target | Status |
|---|---|---|---|
| U1 | First-time visitors | A new visitor understands what to do within 30 seconds. | ✅ A welcome card explains the three main steps. 🟡 Watch three people try it. |
| U2 | Undo everything | Every change can be undone, including deleting a saved design. | ✅ |
| U3 | Keyboard | Everything in the panel can be used with a keyboard. | ✅ Keyboard shortcuts are listed under the ? button. |
| U4 | Screen readers | Every control has a label, and messages are read out. | 🟡 Labels and spoken messages are in place. Still to be checked with VoiceOver or NVDA. |
| U5 | Contrast | Text meets WCAG 2.2 AA contrast in light and dark mode. | 🟡 Designed with this in mind. Still to be checked with a contrast tool. |
| U6 | Reduced motion | Animations switch off for people who've asked their device to reduce motion. | ✅ |

## 5. Privacy, safety and legal

| # | Requirement | Target | Status |
|---|---|---|---|
| L1 | No personal data | Nothing about the user leaves their browser: no accounts, adverts or tracking. | ✅ Stated in the Help panel. |
| L2 | No third-party requests | No visitor's IP address goes to another company (UK/EU GDPR). | ✅ The fonts were on Google, and they're now packed into the page. |
| L3 | Disclaimer | It stays clear that passing the checks doesn't make a design safe, legal or buildable. | ✅ Shown in Results and Help. |
| L4 | Licences | Third-party code and fonts are used within their licences. | ✅ three.js (MIT), IBM Plex and Big Shoulders (SIL Open Font Licence). |

## 6. Running it

| # | Requirement | Target | Status |
|---|---|---|---|
| O1 | Automatic checks | Every change is built and tested in a real browser before it goes live. | ✅ GitHub Actions runs `.github/workflows/check.yml`. |
| O2 | Up-to-date build | The published `index.html` always matches the source code. | ✅ The automated check fails if they differ. |
| O3 | Rollback | A bad release can be undone quickly. | ✅ Revert the commit on GitHub, and GitHub Pages republishes in about a minute. |
| O4 | Knowing when it breaks | You find out about errors real visitors hit. | ⬜ Optional: add a free error-tracking service such as Sentry. That would mean updating the privacy note. |
| O5 | Usage numbers | You know roughly how many people use it. | ⬜ Optional: a cookie-free counter such as Plausible or GoatCounter, which wouldn't need a cookie banner. |

## Before each release

1. `npm run build` then `npm test`. Everything should pass.
2. Open it on an iPhone (Safari) and an Android phone. Try a preset, Surprise me, editing a stand and Share.
3. Check the Results numbers look sensible for the default stadium (about 57,000).
