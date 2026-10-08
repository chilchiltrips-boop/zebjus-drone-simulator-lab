"""Record one kit's Device ID locally for simple offline PyCharm scripts."""

from __future__ import annotations

import json
from zebjus_client import ZebjusClient
from zebjus_simple import PAIRING_FILE


def pair(url: str = "http://192.168.4.1", input_fn=input, output_fn=print):
    status = ZebjusClient(url).status()
    if not str(status.get("mode", "")).startswith("AP"):
        raise RuntimeError("Connect this laptop to the kit's AP Wi-Fi before pairing.")
    found = str(status["deviceId"]).upper()
    output_fn(f"Kit: {status.get('name', 'Unknown')}\nDevice ID: {found}\nAP: {status.get('apSsid', 'Unknown')}")
    typed = input_fn("Type the FULL Device ID printed on this kit's case: ").strip().upper()
    if typed != found:
        raise ValueError("Device ID did not match. Nothing was saved; check the AP and the case label.")
    PAIRING_FILE.write_text(json.dumps({"url": url, "deviceId": found}, indent=2) + "\n", encoding="utf-8")
    output_fn(f"Saved this kit identity beside zebjus_simple.py. Run main_ap.py in PyCharm; URL {url}.")
    return found


if __name__ == "__main__":
    pair()
