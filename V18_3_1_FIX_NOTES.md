# V18.3.1 Fix Notes

- Fixed repeated `Background discovery: Cannot set properties of null (setting textContent)` errors.
- Kit Connection page now follows the proven ZEBJUS Python Lab connection workflow.
- Automatic scan of predictable default kit names plus previously used kits.
- Cached IP first, then mDNS, with permanent Device ID verification.
- Connected kit details (name, ID, IP, SSID, RSSI, firmware, control state).
- Change unique kit name + Reset Auto Name. Reset Auto Name selects `zebjus_drone_N`, which is discoverable by the browser scanner.
- Wi-Fi scan, save/switch, list saved profiles, forget selected, forget all.
- Existing single-controller lock and automatic lock timeout retained.
