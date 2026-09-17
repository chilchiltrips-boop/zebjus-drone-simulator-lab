# Python Lab reference adopted in Drone Lab V18.3

The uploaded `ZEBJUS_Python_Lab_FULL_v6_4_6_DeviceFaultIsolation_FINAL` was used as the connection reference.

Adopted behaviors:

1. Saved Wi-Fi is attempted directly on boot; setup AP is fallback/recovery rather than the normal operating path.
2. Browser connection order: cached verified IP -> `<kit-name>.local` mDNS -> known/default-name scan.
3. `/api/status` verifies product identity and permanent physical Device ID before an address is accepted.
4. Successful responses refresh cached IP and identity.
5. 1–4 transient health misses do not blink the UI to disconnected; the 5th consecutive miss declares the kit offline.
6. Background reconnect uses the cached IP and mDNS fallback.
7. Captive setup uses wildcard DNS and common captive-portal probe routes.
8. Wi-Fi credentials are kept on the kit; DHCP IP changes do not change kit identity.
9. Python commands in Drone Lab use the same selected local kit bridge rather than requiring a cloud device registry.

Drone-specific addition:

- Single-user real-hardware lock is enforced on the ESP32 itself, with a 10-second heartbeat expiry. Other browsers remain view-only.
