"""Small same-Wi-Fi client for computer-side ZEBJUS Python projects.

Only read operations work without pairing to a permanent Device ID. A caller
must supply that ID before any command that could change real hardware state.
"""

from __future__ import annotations

import json
import time
import uuid
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

READ_ONLY = frozenset({"ping", "pid_get", "receiver_read", "ppm_read", "attitude_read", "calibration_get", "bench_status"})


class ZebjusClient:
    def __init__(self, base_url: str, expected_device_id: str = "", timeout: float = 1.0):
        self.base_url = base_url.strip().rstrip("/")
        if not self.base_url.startswith("http://"):
            raise ValueError("Use the local kit URL, for example http://zebjus_drone_1.local")
        self.expected_device_id = expected_device_id.strip().upper()
        self.timeout = float(timeout)
        self.client_id = "PY-" + uuid.uuid4().hex
        self._owned = False
        self._last_seen_id = ""

    def _request(self, path: str, fields: dict | None = None) -> dict:
        body = None if fields is None else urlencode(fields).encode("utf-8")
        request = Request(self.base_url + path, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"} if body is not None else {})
        try:
            with urlopen(request, timeout=self.timeout) as response:
                result = json.load(response)
        except HTTPError as exc:
            try:
                error = json.load(exc)
            except (ValueError, OSError):
                error = {}
            raise RuntimeError(f"FlightCore HTTP {exc.code}: {error.get('message', exc.reason)}") from exc
        except URLError as exc:
            raise ConnectionError(f"FlightCore unavailable at {self.base_url}: {exc.reason}") from exc
        if not isinstance(result, dict) or result.get("ok") is False:
            raise RuntimeError(f"Unexpected FlightCore response: {result}")
        return result

    def status(self) -> dict:
        result = self._request("/api/status?" + urlencode({"clientId": self.client_id}))
        found = str(result.get("deviceId", "")).upper()
        if not found:
            raise RuntimeError("This endpoint did not return a ZEBJUS Device ID")
        if self.expected_device_id and found != self.expected_device_id:
            self._owned = False
            raise RuntimeError(f"Wrong kit: expected {self.expected_device_id}, found {found}")
        self._last_seen_id = found
        return result

    def telemetry(self) -> dict:
        self.status()  # Verify the permanent Device ID before using a cached IP.
        return self._request("/api/telemetry")

    def imu(self) -> dict:
        self.status()
        return self._request("/api/imu")

    def acquire(self) -> dict:
        if not self.expected_device_id:
            raise ValueError("Set ZEBJUS_DEVICE_ID to the full permanent Device ID before modifying a real kit")
        status = self.status()
        if status.get("armed"):
            raise RuntimeError("The real kit is armed; disarm before changing parameters")
        result = self._request("/api/control/acquire", {"clientId": self.client_id})
        self._owned = True
        return result

    def release(self) -> None:
        if self._owned:
            try:
                self._request("/api/control/release", {"clientId": self.client_id})
            finally:
                self._owned = False

    def command(self, type: str, **data) -> dict:
        if type not in READ_ONLY:
            if not self._owned:
                self.acquire()
            # A hostname may be reused on a different kit. Verify on every mutation.
            self.status()
        else:
            self.status()
        fields = {"clientId": self.client_id, "type": type}
        for key, value in data.items():
            if key == "channels":
                if len(value) < 6 or len(value) > 10:
                    raise ValueError("RC frames require 6 to 10 channels")
                value = ",".join(str(int(x)) for x in value)
            fields[key] = value
        return self._request("/api/command", fields)

    def set_rate_pid(self, roll: tuple[float, float, float], pitch: tuple[float, float, float], yaw: tuple[float, float, float]) -> dict:
        data = {}
        for name, axis in (("rateRoll", roll), ("ratePitch", pitch), ("rateYaw", yaw)):
            if len(axis) != 3:
                raise ValueError("Each PID axis needs (P, I, D)")
            for suffix, value in zip("PID", axis):
                data[name + suffix] = float(value)
        return self.command("pid_set", **data)

    def set_accel_offsets(self, x: float, y: float, z: float, roll_trim: float = 0, pitch_trim: float = 0) -> dict:
        return self.command("calibration_set", accelOffsetX=x, accelOffsetY=y, accelOffsetZ=z, levelTrimRoll=roll_trim, levelTrimPitch=pitch_trim)

    def __enter__(self):
        self.status()
        return self

    def __exit__(self, *_):
        self.release()


def client_from_environment() -> ZebjusClient:
    import os
    url = os.environ.get("ZEBJUS_KIT_URL", "http://zebjus_drone_1.local")
    identity = os.environ.get("ZEBJUS_DEVICE_ID", "")
    return ZebjusClient(url, identity)
