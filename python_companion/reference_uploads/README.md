# Supplied Python reference files

These five files are preserved unchanged from the supplied attachments. Their native desktop imports and APIs are historical references, not the current browser Python API or FlightCore HTTP transport.

- `legacy_udp_flight_client.py` speaks a different UDP DroneWiFiTelemetry protocol; it does not address this firmware's verified Device ID / HTTP control lock. Do not run it against the current kit.
- `legacy_mediapipe_face_detector.py`, `cvzone_face_camera.py`, and `opencv_camera_basics.py` expect a desktop webcam and window manager. Old MediaPipe `mp.solutions` examples may need adaptation for a current version.
- `hand_distance_serial_legacy.py` needs separate `HandTrackingModule` and `SerialModule`, and targets a serial device outside this project's FlightCore command protocol.

Use the project-root Python Lab's browser camera and `cv2.imshow` window, or the adapted `../camera_telemetry.py`, `../cvzone_hands.py`, and `../face_detection.py` with `requirements-vision.txt` installed in a desktop virtual environment. Vision examples are read-only; test new control code with propellers removed.
