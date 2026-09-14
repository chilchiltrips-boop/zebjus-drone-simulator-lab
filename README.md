# ZEBJUS F450 Drone Engineering Lab — V10 Startup Fixed

This build fixes the page getting stuck on **“Starting local 3D engine…”**.

## Exact root cause found
`app.js` contained an invalid JavaScript object key in the optional GPS component:

`I/O:'External GPIO'`

Because `I/O` was not quoted, the ES module failed during parsing. That means **none of `app.js` executed**, so the status text never reached the code that changes it to “Local 3D engine ready”.

V10 changes it to a valid quoted key and adds startup diagnostics so the page will no longer silently stay on a starting message if a future module/runtime error happens.

## V10 fixes
- `app.js` syntax error fixed.
- `ui-runtime.js` now detects script-load, module-parse, runtime, and unhandled-promise failures.
- Startup is split into guarded boot steps, so one non-critical section cannot freeze the whole UI.
- Assembly 3D errors show a visible diagnostic card while 2D/non-3D tools remain available.
- Tripod simulator is now **lazy-loaded only when its tab is opened**, reducing startup GPU load.
- Local Three.js remains bundled; no CDN is required for the main 3D lab.
- Cache-busting query strings were added to `styles.css`, `ui-runtime.js`, and `app.js` for GitHub Pages updates.
- The 3D camera “3D / Top / Front” active-button logic is corrected.
- Canvas rounded-rectangle drawing has a compatibility fallback.
- Browser save now fails gracefully if localStorage is blocked by an iframe/private session.
- Legacy `drone3d.js` now points to the same-folder `three.module.min.js`.
- Version labels updated to V10.

## F450 frame geometry update
The arm root is now placed at the **bottom-plate corner/edge root zone**, not near the plate centre.
The local arm length was shortened so the motor centre still aligns with the existing motor/guard positions.
Frame screw positions were also moved outward to the four real root zones.
The integrated F450 landing foot still rests at bench Y=0.

## GitHub Pages
Upload the contents of this folder directly to the repository root, then publish from:

`Settings → Pages → Deploy from a branch → main → /(root)`

After upload, do a hard refresh once. V10 also uses versioned script URLs to avoid an older `app.js` remaining in browser cache.

## Wix
The normal simulator UI can be embedded with the supplied `WIX_EMBED.txt`.

For a real flight-controller connection, opening the GitHub Pages lab directly in a new tab is more reliable than running hardware permissions inside a Wix iframe.

## Safety
Virtual motor/PID tests are simulations. For real motor-order, ESC or calibration tests, remove propellers until the hardware setup is verified.
