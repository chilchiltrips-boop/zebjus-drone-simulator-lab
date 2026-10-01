# V18.3.59

- Added the Aerion Flight App: dark full-screen control view, no Python interface, floating/fixed sticks with permanent left throttle/yaw and right pitch/roll assignments.
- Added top connection/AP/STA/actual ARM status, ANGLE/RATE mode, manual ARM/DISARM, STOP, settings and a connection-help screen for an unconnected kit.
- Throttle now ramps from the current value without a first-touch jump; directional axes center and throttle holds on release. Two-finger touch works independently.
- Refresh/reconnect remain read-only until Take control. Link/lock loss, hidden pages, focus changes, settings and rotation stop output; cancelled late grants cannot resume RC. A fresh session on every Take control rejects previously delayed RC/ARM frames.
- The embedded AP page and standalone `flight/` page share one editable source. Added flight-only launchers and an independent offline PWA cache; the engineering lab retains its separate Python/hand functions.
- Includes rebuilt matching A1/A2 APP and FACTORY binaries, current catalogs and offline hashes. Upload folders remain limited to 100 files and 14.5 MB raw data per batch.

See `SUPPORT/V18_3_59_UPDATE_AND_TEST.md` for opening the app, controls, firmware offsets and hardware acceptance. Automated browser/transport checks do not replace physical USB/OTA or flight testing.
