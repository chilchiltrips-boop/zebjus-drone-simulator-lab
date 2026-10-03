# Offline WebApp — V18.3.63

## Joystick-only Aerion Flight App

On Windows open `Start_Flight_App.bat`; on Mac open `Start_Flight_App.command`. Or run `python3 start_offline.py --flight`, or `node server.js` and open **http://localhost:8787/flight/**. This flight page has no editor or Python runtime. The launcher's Python/Node server only serves static files.

The V18.3.63 controller serves only the API at 192.168.4.1, with no browser/captive page. Use the locally served/cached Flight App or installed Android APK after joining kit Wi-Fi. See SUPPORT/V18_3_63_UPDATE_AND_TEST.md.

## Laptop, including the first run without internet

1. Extract the **whole ZIP**. Keep `vendor` beside `index.html`; do not copy only the top-level files.
2. Windows: open `Start_Offline.bat`. Mac: open `Start_Offline.command`. Alternatively run `python3 start_offline.py` from Terminal, or run `start_offline.py` in PyCharm. Python 3 must already be installed. The launcher itself needs no pip packages. `npm start` also works with installed Node.js.
3. Open **http://localhost:8787/**. Keep the launcher window running.
4. Join the exact kit's AP Wi-Fi even if it says “No internet”. Kit Connect discovers `192.168.4.1`; verify its permanent Device ID and Take Control when using real hardware. Select Real kit in Python for LED/sensor/output code.
5. Open Python Lab, type your code and press Run. Allow the laptop camera when requested.

Python runs in the browser. No internet login, CDN fetch or per-run package installation is required for the included features. All runtimes and package wheels are in this ZIP. Browser OpenCV does not require desktop `pip install opencv-python`. `while True:`, simple `Drone` methods, `cv2.waitkey`/`cv2.waitKey`, Stop and Rerun retain their existing classroom behaviour.

Mac may request permission to open a downloaded launcher. If double-click is blocked, use Terminal or PyCharm to run `start_offline.py`. Do not open `index.html` as a `file://` URL: browser workers, ES modules and WASM need the local HTTP server.

## Save a browser copy

Settings → **Save for offline use** stores and verifies the complete app, editor, Python runtimes/packages, models, images and 3D assets in this browser. Wait for **Browser offline copy ready**. **Check offline files** checks whether the copy is complete. Saving is blocked while Python runs or the selected kit is armed.

After saving, reopen the **same address in the same browser/profile**. This copy can run even if internet and the laptop server are unavailable. Clearing site/browser data removes it; browsers can also evict storage. The extracted ZIP and launcher remain the reliable local fallback. Repeat Save for offline use after replacing app files with a new version. The settings screen reports the required storage size.

## Included offline features

- Monaco Python editor, suggestions and error markers.
- Python 3.12 / Pyodide 0.27.7, standard library and bundled native extensions.
- NumPy, OpenCV, Pillow, Matplotlib, pandas and their pinned dependencies. Plots use the local Agg backend and included fonts.
- Browser camera and the existing cvzone HandDetector subset (`findHands`, `fingersUp`) with MediaPipe Tasks Vision 0.10.21. Both SIMD and non-SIMD WASM files and the hand-landmark model are included.
- Joystick/simulator, 2D/3D assembly, kit connection, sensor/I/O APIs and the local USB flasher engine. Matching A1/A2 APP and FACTORY binaries are included and saved by the complete offline-cache preparation. See `SUPPORT/V18_3_61_UPDATE_AND_TEST.md` before choosing a firmware image.

New third-party Python packages are not automatically available offline. Native `mediapipe`, full native cvzone and SerialModule still use the desktop Python companion. The browser HandDetector API works through the included browser adapter. Companion pip packages must be installed before taking that separate desktop route offline.

## AP, phones and camera access

AP serves API endpoints only. Install matching V18.3.63 firmware and the new APK. Laptop uses the local/cached full WebApp; camera requires localhost/HTTPS and permission. A phone browser Python/vision session needs the full WebApp saved from a suitable HTTPS origin, retained in the same browser/profile. Local kit access remains subject to browser network permission. APK has no Python/camera interface.

After replacing WebApp files, repeat Save for offline use. The full extracted bundle supports first-run offline use with the local launcher.

## Rebuilding the bundle

Development only: `python3 tools/bundle_offline_assets.py` downloads the pinned upstream dependencies and checks Python wheel hashes. It is not part of an end-user offline launch. `vendor/provenance.json` records sources and SHA-256 values. Upstream license files accompany the bundled runtimes; the esptool bundle also retains its pako notices. Regenerate `offline-manifest.json` with `python3 tools/make_offline_manifest.py` after changing runtime files, then update `FILE_COUNT.txt` and run project validation.

Verification includes real browser WASM execution with external requests blocked, synthetic camera inference, and the same Python/plot/hand tests after stopping the local server and setting the browser offline. Synthetic camera frames establish model loading/inference and adapter behaviour, not recognition accuracy on real hands. No physical kit, real webcam, Windows/Mac double-click launcher or real flight was tested in this environment.
