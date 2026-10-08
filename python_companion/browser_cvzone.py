"""Small browser HandTrackingModule adapter for the ZEBJUS Python Lab.

Landmarks come from the page's MediaPipe Tasks model while this Python run is
active. This implements HandDetector.findHands/fingersUp for student examples;
the complete native cvzone package belongs in the laptop companion.
"""
import json
import sys
import time
import types

import cv2
from js import zebjusBridge as _bridge


CONNECTIONS = (
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20), (0, 17),
)


class HandDetector:
    def __init__(self, staticMode=False, maxHands=2, modelComplexity=1,
                 detectionCon=0.5, minTrackCon=0.5):
        self.maxHands = max(1, min(int(maxHands), 2))

    def findHands(self, img, draw=True, flipType=True):
        if img is None or not hasattr(img, "shape"):
            raise ValueError("findHands needs a decoded OpenCV BGR frame")
        height, width = img.shape[:2]
        data = json.loads(str(_bridge.latestHandData()) or "{}")
        if time.time() * 1000 - data.get("timestampMs", 0) > 900:
            return [], img
        hands = []
        for index, landmarks in enumerate(data.get("landmarks", [])[:self.maxHands]):
            if len(landmarks) != 21:
                continue
            points = [[max(0, min(width - 1, round(p["x"] * width))),
                       max(0, min(height - 1, round(p["y"] * height))),
                       round(p.get("z", 0) * width)] for p in landmarks]
            xs, ys = [p[0] for p in points], [p[1] for p in points]
            x0, y0 = min(xs), min(ys)
            handedness = data.get("handedness") or []
            side = handedness[index] if index < len(handedness) else "Unknown"
            if flipType and side in ("Left", "Right"):
                side = "Left" if side == "Right" else "Right"
            hand = {"lmList": points, "bbox": (x0, y0, max(xs)-x0, max(ys)-y0),
                    "center": ((x0+max(xs))//2, (y0+max(ys))//2), "type": side}
            hands.append(hand)
            if draw:
                for a, b in CONNECTIONS:
                    cv2.line(img, tuple(points[a][:2]), tuple(points[b][:2]), (67, 218, 135), 2)
                for n, p in enumerate(points):
                    cv2.circle(img, tuple(p[:2]), 5 if n in (4, 8, 12, 16, 20) else 3,
                               (180, 86, 248), cv2.FILLED)
                cv2.rectangle(img, (max(x0-12, 0), max(y0-12, 0)),
                              (min(max(xs)+12, width-1), min(max(ys)+12, height-1)),
                              (67, 218, 135), 2)
                cv2.putText(img, side, (max(x0-8, 0), max(y0-18, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (67, 218, 135), 2)
        return hands, img

    def fingersUp(self, hand):
        points = hand["lmList"]
        if len(points) != 21:
            raise ValueError("fingersUp needs 21 hand landmarks")
        thumb = int(points[4][0] < points[3][0]) if hand.get("type") == "Right" else int(points[4][0] > points[3][0])
        return [thumb] + [int(points[tip][1] < points[tip-2][1]) for tip in (8, 12, 16, 20)]


_pkg = types.ModuleType("cvzone")
_pkg.__path__ = []
_tracking = types.ModuleType("cvzone.HandTrackingModule")
_tracking.HandDetector = HandDetector
_pkg.HandTrackingModule = _tracking
sys.modules["cvzone"] = _pkg
sys.modules["cvzone.HandTrackingModule"] = _tracking
