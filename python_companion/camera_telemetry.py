"""Show OpenCV camera frames with read-only FlightCore telemetry overlay."""
import time

import cv2

from zebjus_client import client_from_environment


def main():
    with client_from_environment() as kit:
        print("Verified kit:", kit.status()["deviceId"])
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            raise RuntimeError("Camera unavailable on this computer")
        telemetry, last_read = {}, 0.0
        try:
            while True:
                ok, frame = camera.read()
                if not ok:
                    break
                if time.monotonic() - last_read > .25:
                    try:
                        telemetry = kit.telemetry()
                    except (ConnectionError, RuntimeError) as exc:
                        telemetry = {"rcSource": "OFFLINE"}
                        print(exc)
                    last_read = time.monotonic()
                text = "R {:+.1f}  P {:+.1f}  {}  {}".format(float(telemetry.get("roll", 0)), float(telemetry.get("pitch", 0)), telemetry.get("flightMode", "--"), telemetry.get("rcSource", "--"))
                cv2.putText(frame, text, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, .6, (30, 230, 140), 2)
                cv2.imshow("ZEBJUS camera + FlightCore telemetry (Q to quit)", frame)
                if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                    break
        finally:
            camera.release()
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
