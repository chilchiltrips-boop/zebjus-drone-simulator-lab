# V18.3.39

## Multi-kit identity and reconnect reliability

- Kit Name is no longer treated as a physical identity. Full Device ID remains authoritative.
- A replacement board can reuse an old Kit Name without being blocked by a stale cached Device ID/IP.
- Multiple boards on the same Wi-Fi are tracked independently by Device ID, IP and Kit Name.
- Duplicate live Kit Names are never auto-selected; the UI asks the user to select the required Device ID or rename one kit.
- Background discovery continues while one kit is connected so other kits remain visible and their online/offline state can update.
- Kit switching uses strict Device ID verification and releases the previous control lock before connecting the next kit.
- Legacy 24-bit Device IDs continue to migrate to full 48-bit IDs without creating duplicate device cards.
- Module cards now show IP, Device ID and a DUPLICATE NAME warning when needed.
