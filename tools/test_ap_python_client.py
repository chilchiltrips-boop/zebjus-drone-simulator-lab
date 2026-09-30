"""Exercise offline AP pairing and guarded commands against a local fake kit."""

import json
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python_companion"))
import pair_ap  # noqa: E402
from zebjus_simple import Drone  # noqa: E402

DEVICE_ID = "ZFC-001122334455"


class Kit(HTTPServer):
    device_id = DEVICE_ID
    owner = ""
    commands = []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def reply(self, status, body):
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        url = urlsplit(self.path)
        client_id = parse_qs(url.query).get("clientId", [""])[0]
        if url.path != "/api/status":
            return self.reply(404, {"ok": False})
        self.reply(200, {"ok": True, "mode": "AP SETUP", "deviceId": self.server.device_id,
                         "name": "classroom-1", "apSsid": "ZEBJUS-FC-001122334455",
                         "armed": False, "lockMine": self.server.owner == client_id})

    def do_POST(self):
        fields = {k: v[0] for k, v in parse_qs(self.rfile.read(int(self.headers["Content-Length"])).decode()).items()}
        if fields.get("expectedDeviceId") != self.server.device_id:
            return self.reply(409, {"ok": False, "message": "Device ID mismatch"})
        if self.path == "/api/control/acquire":
            self.server.owner = fields["clientId"]
        elif self.path == "/api/control/release":
            self.server.owner = ""
        elif self.path == "/api/command":
            if self.server.owner != fields.get("clientId"):
                return self.reply(423, {"ok": False, "message": "No control lock"})
            self.server.commands.append(fields)
        else:
            return self.reply(404, {"ok": False})
        self.reply(200, {"ok": True})


def main():
    server = Kit(("127.0.0.1", 0), Handler)
    server.owner, server.commands, server.device_id = "", [], DEVICE_ID
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}"
    try:
        with tempfile.TemporaryDirectory() as folder:
            config = Path(folder) / "zebjus_pairing.json"
            pair_ap.PAIRING_FILE = config
            try:
                pair_ap.pair(url, input_fn=lambda _: "ZFC-WRONG", output_fn=lambda _: None)
                raise AssertionError("Wrong kit label was accepted")
            except ValueError:
                assert not config.exists()
            pair_ap.pair(url, input_fn=lambda _: DEVICE_ID, output_fn=lambda _: None)
            with Drone(pairing_file=config) as drone:
                drone.led(1)
                server.owner = ""  # Simulate the 10-second control lock expiring.
                drone.led(0)
                drone.rc(throttle=1000, mode="RATE", arm=False)
                assert [c["mode"] for c in server.commands[:2]] == ["on", "off"]
                assert server.commands[2]["channels"].split(",")[5] == "1500"
                assert all(c["expectedDeviceId"] == DEVICE_ID for c in server.commands)
                previous = len(server.commands)
                server.device_id = "ZFC-AABBCCDDEEFF"
                try:
                    drone.led(1)
                    raise AssertionError("Wrong kit received a command")
                except RuntimeError as error:
                    assert "Wrong kit" in str(error)
                assert len(server.commands) == previous
        print("PASS: offline AP pairing, lock recovery, simple LED/RC commands and wrong-kit rejection")
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == "__main__":
    main()
