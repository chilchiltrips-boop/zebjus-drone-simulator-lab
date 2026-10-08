"""Read cvzone hand tracking beside real kit telemetry. No flight commands."""
import time

import cv2
from cvzone.HandTrackingModule import HandDetector

from zebjus_client import client_from_environment


def main():
    with client_from_environment() as kit:
        print("Verified kit:", kit.status()["deviceId"])
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            raise RuntimeError("Camera unavailable on this computer")
        detector = HandDetector(detectionCon=0.7, maxHands=2)
        telemetry, last_read = {}, 0.0
        try:
            while True:
                ok, frame = camera.read()
                if not ok:
                    break
                hands, frame = detector.findHands(frame, draw=True, flipType=False)
                if time.monotonic() - last_read > .3:
                    try:
                        telemetry = kit.telemetry()
                    except (ConnectionError, RuntimeError) as exc:
                        telemetry = {"rcSource": "OFFLINE"}
                        print(exc)
                    last_read = time.monotonic()
                fingers = [detector.fingersUp(hand) for hand in hands]
                text = f"Hands: {len(hands)}  Fingers: {[sum(f) for f in fingers]}  RC: {telemetry.get('rcSource','--')}"
                cv2.putText(frame, text, (12, 30), cv2.FONT_HERSHEY_SIMPLEX, .55, (30, 230, 140), 2)
                cv2.imshow("ZEBJUS cvzone + FlightCore (Q to quit)", frame)
                if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                    break
        finally:
            camera.release()
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
