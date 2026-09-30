"""Simple synchronous Drone API for offline PyCharm projects on the kit AP.

Pair once with pair_ap.py (or set ZEBJUS_DEVICE_ID) before changing hardware.
Python runs on the laptop; the flight controller receives local HTTP commands.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from zebjus_client import ZebjusClient


PAIRING_FILE = Path(__file__).with_name("zebjus_pairing.json")


class Drone:
    def __init__(self, device_id: str = "", url: str = "", pairing_file: str | Path = PAIRING_FILE):
        config = {}
        config_path = Path(pairing_file)
        if config_path.is_file():
            config = json.loads(config_path.read_text(encoding="utf-8"))
        identity = (device_id or os.environ.get("ZEBJUS_DEVICE_ID") or config.get("deviceId") or "").strip().upper()
        address = (url or os.environ.get("ZEBJUS_KIT_URL") or config.get("url") or "http://192.168.4.1").strip()
        if not identity:
            raise ValueError("Run pair_ap.py while connected to your kit AP, then use Drone().")
        self.client = ZebjusClient(address, expected_device_id=identity)
        self.client.status()  # Fails before any hardware write if on a different AP.

    def status(self) -> dict:
        return self.client.status()

    def telemetry(self) -> dict:
        return self.client.telemetry()

    def imu(self) -> dict:
        return self.client.imu()

    def led(self, value: int) -> dict:
        return self.client.led(value)

    def led_blink(self, milliseconds: int = 500) -> dict:
        return self.client.led_set("blink", milliseconds)

    def gpio_read(self, pin: int, mode: str = "pullup") -> dict:
        return self.client.gpio_read(pin, mode)

    def gpio_write(self, pin: int, value: int) -> dict:
        return self.client.gpio_write(pin, value)

    def i2c_scan(self) -> dict:
        return self.client.i2c_scan()

    def command(self, type: str, **data) -> dict:
        return self.client.command(type, **data)

    def rc(self, roll: int = 1500, pitch: int = 1500, throttle: int = 1000,
           yaw: int = 1500, arm: bool = False, mode: str = "ANGLE") -> dict:
        values = (roll, pitch, throttle, yaw)
        if any(not 1000 <= int(v) <= 2000 for v in values):
            raise ValueError("Roll, pitch, throttle and yaw must be 1000–2000")
        if mode.upper() not in {"ANGLE", "RATE"}:
            raise ValueError("mode must be ANGLE or RATE")
        channels = [int(roll), int(pitch), int(throttle), int(yaw),
                    2000 if arm else 1000, 1500 if mode.upper() == "RATE" else 1000]
        channels.extend([1000, 1000, 1500, 1000])
        return self.client.command("rc_frame", channels=channels)

    def disarm(self) -> dict:
        return self.rc(throttle=1000, arm=False)

    def close(self) -> None:
        self.client.release()

    def __enter__(self) -> "Drone":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()
