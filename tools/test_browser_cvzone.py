#!/usr/bin/env python3
"""Exercise the documented browser HandDetector subset with synthetic landmarks."""
import json
import runpy
import sys
import time
import types
from pathlib import Path

calls = []
cv2 = types.ModuleType("cv2")
cv2.FILLED = -1
cv2.FONT_HERSHEY_SIMPLEX = 0
for method in ("line", "circle", "rectangle", "putText"):
    setattr(cv2, method, lambda *args, _method=method: calls.append(_method))
bridge = types.SimpleNamespace(latestHandData=lambda: "{}")
js = types.ModuleType("js")
js.zebjusBridge = bridge
sys.modules.update({"cv2": cv2, "js": js})
module = runpy.run_path(str(Path(__file__).parents[1] / "python_companion/browser_cvzone.py"))
detector = module["HandDetector"](maxHands=2)
frame = types.SimpleNamespace(shape=(240, 320, 3))
assert detector.findHands(frame)[0] == []
landmarks = [{"x": 0.2 + .02 * i, "y": 0.8 - .03 * i, "z": 0} for i in range(21)]
data = {"landmarks": [landmarks], "handedness": ["Left"], "timestampMs": int(time.time() * 1000)}
bridge.latestHandData = lambda: json.dumps(data)
hands, drawn = detector.findHands(frame, draw=True, flipType=False)
assert drawn is frame and len(hands) == 1 and hands[0]["type"] == "Left"
assert len(hands[0]["lmList"]) == 21 and hands[0]["bbox"][2] > 0
assert "line" in calls and "rectangle" in calls and len(detector.fingersUp(hands[0])) == 5
data["timestampMs"] = 0
assert detector.findHands(frame)[0] == []
print("PASS: browser cvzone hand landmarks, drawing and stale data cleanup")
