# V18.3.3 Automatic Local Kit Discovery

- New/factory-reset kits automatically choose the first free display name: `zebjus_drone_1`, `zebjus_drone_2`, ...
- Existing legacy automatic name `F450-<device suffix>` is migrated automatically after joining Wi-Fi.
- The browser scans `zebjus_drone_1..30` plus previously verified custom kit names.
- Display name underscores are converted to hyphens only for the mDNS hostname, e.g. `zebjus_drone_1` -> `zebjus-drone-1.local`, matching the working Python Lab architecture.
- Permanent Device ID is still verified before cached IP reuse.
- If exactly one kit is found, the webapp selects/connects it automatically.
- Default Wi-Fi profile from V18.3.2 is retained.
