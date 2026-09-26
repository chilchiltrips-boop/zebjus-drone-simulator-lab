"""Adapted supplied cvzone face project with read-only ZEBJUS kit telemetry.

Install requirements-vision.txt in a desktop venv; set ZEBJUS_KIT_URL and
ZEBJUS_DEVICE_ID. The frame stays on the laptop; no flight command is sent.
"""
import time

import cv2
from cvzone.FaceDetectionModule import FaceDetector

from zebjus_client import client_from_environment


def main():
    with client_from_environment() as kit:
        print("Verified kit:", kit.status()["deviceId"])
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            raise RuntimeError("Camera unavailable. Check webcam access and other camera apps.")
        detector = FaceDetector(minDetectionCon=0.55)
        telemetry, read_at = {}, 0.0
        try:
            while True:
                ok, frame = camera.read()
                if not ok:
                    break
                frame, faces = detector.findFaces(frame, draw=True)
                if time.monotonic() - read_at > 0.5:
                    telemetry = kit.telemetry()
                    read_at = time.monotonic()
                    print("faces", len(faces), "RC", telemetry.get("rcSource", "--"),
                          "loop Hz", telemetry.get("flightLoopHz", "--"))
                label = f"Faces {len(faces)}  FC {telemetry.get('flightLoopHz','--')} Hz"
                cv2.putText(frame, label, (12, 32), cv2.FONT_HERSHEY_SIMPLEX,
                            .6, (55, 230, 150), 2)
                cv2.imshow("ZEBJUS faces + kit telemetry (Q to quit)", frame)
                if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                    break
        finally:
            camera.release()
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
