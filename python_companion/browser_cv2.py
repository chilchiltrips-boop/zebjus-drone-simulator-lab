"""Browser-only cv2 camera/window adapter; loaded by the isolated Pyodide Worker.

Camera frames arrive from the main page. cv2.VideoCapture(0).read() uses the
latest frame; a loop must yield using ``await drone.wait_key(30)`` so new frames
can arrive. Native desktop cv2 and cvzone projects use the laptop companion.
"""
import base64
import time

import cv2
import numpy as np
from js import zebjusBridge as _bridge
from zebjus import Drone


class BrowserVideoCapture:
    def __init__(self, source=0):
        if source not in (0, "0"):
            raise RuntimeError("Browser VideoCapture supports camera 0. Use the laptop companion for video files or other cameras.")
        self.opened = True

    def isOpened(self):
        return self.opened

    def read(self):
        if not self.opened:
            return False, None
        raw = str(_bridge.latestCameraFrame())
        if not raw:
            return False, None
        data = np.frombuffer(base64.b64decode(raw), dtype=np.uint8)
        frame = cv2.imdecode(data, cv2.IMREAD_COLOR)
        return frame is not None, frame

    def set(self, _property, _value):
        return True

    def get(self, property_id):
        if property_id == cv2.CAP_PROP_FRAME_WIDTH:
            return 320.0
        if property_id == cv2.CAP_PROP_FRAME_HEIGHT:
            return 240.0
        return 0.0

    def release(self):
        self.opened = False


_last_imshow_at = 0.0


def browser_imshow(name, frame):
    global _last_imshow_at
    now = time.monotonic()
    if now - _last_imshow_at < 0.08:
        return
    _last_imshow_at = now
    Drone().show_image(frame, title=str(name))


def browser_wait_key(_delay=1):
    raise RuntimeError("In a browser camera loop, use await drone.wait_key(30) so the camera can deliver its next frame. Desktop cv2.waitKey runs in python_companion on a laptop.")


cv2.VideoCapture = BrowserVideoCapture
cv2.imshow = browser_imshow
cv2.waitKey = browser_wait_key
cv2.destroyAllWindows = lambda: None
