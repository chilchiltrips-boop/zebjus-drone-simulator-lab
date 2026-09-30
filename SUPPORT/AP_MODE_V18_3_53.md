# AP and saved Wi-Fi mode · V18.3.53

V18.3.54 moves the AP Wi-Fi settings page to `http://192.168.4.1/setup`; the AP root URL now opens the Flight App. The mode rules below still apply.

## Before closing the case

1. Build and flash the matching A2 firmware. Keep the USB Serial monitor open at 115200 for the first AP boot. Label this **specific case** with its full Device ID, `ZEBJUS-FC-<12-hex>` SSID and randomly generated 16-character AP password. Do not use a shared `12345678` label.
2. If the firmware is already connected to school Wi-Fi, connect the verified Device ID in Drone Lab, take control, and open **Settings → Show this kit's AP details**. Copy the displayed Device ID, SSID and password to the case before switching modes.
3. Verify the label by joining the indicated AP from a phone and opening `http://192.168.4.1/`; confirm the displayed Device ID equals the label. Multiple kits may use that same IP, since each AP is a separate local network.

The AP key is stored in a separate `zjap` NVS namespace. Ordinary web factory reset preserves it, as do firmware updates that preserve NVS. Erasing the **whole flash** generates a new key and invalidates the old label. If the key is lost while the board is offline, the USB Serial log is the available recovery path; record it before enclosing the board.

## Mode rules

| Current state | Action | After reboot |
| --- | --- | --- |
| STA connected | Settings → Switch selected kit to AP, while disarmed and holding control | AP only, persistent |
| STA cannot reach saved Wi-Fi at boot, or loses it while disarmed | Automatic fallback | AP only, persistent |
| AP connected | `192.168.4.1` → Kit status → Activate saved Wi-Fi mode | Tries saved profiles; STA if successful, persistent AP if unavailable |
| AP connected | Wi-Fi setup → Save & test Wi-Fi | STA after verification; failed test leaves AP active |
| Either mode | Power cycle | Keeps selected AP mode, or tries saved STA and falls back to AP |

The ordinary AP mode runs the AP radio only. A Wi-Fi scan or explicit Save & Test temporarily enables the station radio; successful setup restarts into STA. Mode switching is blocked while armed or during bench outputs. The physical BOOT button is optional recovery and is not required for mode changes. The AP portal also hosts `/fly` and `/io`; browser camera permission normally requires HTTPS or localhost, so direct AP HTTP is for direct kit controls rather than camera Python lessons.

The browser verifies the permanent Device ID on connection and sends the expected ID on commands; the firmware rejects commands addressed to another kit. Unique AP passwords prevent using the same credential for different kits, but the local control lock is not user authentication. Treat this as device selection and network isolation, not as a full secure pairing system.
