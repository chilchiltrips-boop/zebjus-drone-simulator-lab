# V18.3.2 Default Wi-Fi

Factory default Wi-Fi profile is preloaded on first flash / after factory reset:

- SSID: `KeralaVision_Binu_1384`
- Password: configured in firmware

Behavior:
- First boot: default profile is written to NVS and tried automatically.
- Students can add/change Wi-Fi from AP setup or the webapp.
- **Forget All Wi-Fi** removes profiles and does not automatically re-add the default.
- **Factory Reset** restores firmware defaults, including the default Wi-Fi profile on next boot.
