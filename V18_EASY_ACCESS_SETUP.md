# V18.2 Easy Access Setup

## First use

- Connect to the kit AP.
- Captive portal opens automatically; fallback is `192.168.4.1`.
- Set Kit Name.
- Scan and select the school 2.4 GHz Wi-Fi.
- Enter password.
- Press **SAVE & TEST WI-FI**.
- A wrong password is not saved.
- After success, the board switches to STA and the page redirects to the webapp with `?kit=<permanent-device-id>&kitName=<saved-name>&autoconnect=1`.

The webapp uses the permanent Device ID to select the exact configured kit, while displaying the same saved Kit Name.

## Normal classroom use

- Students connect computers to the school Wi-Fi.
- Open the same ZEBJUS webapp.
- Kits appear automatically.
- Optional search/filter by Kit Name or Device ID.
- One browser controls real hardware; others are hardware View Only.
- Every browser can use its own simulator.

## Recovery

- Hold BOOT ~5 seconds: force AP setup mode without erasing settings.
- Hold BOOT ~10 seconds: factory reset Kit Name and Wi-Fi.
- Captive portal also provides Forget Wi-Fi and Factory Reset buttons.
