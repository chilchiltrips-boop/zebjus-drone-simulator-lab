"""ZEBJUS V18.3.49 LED and digital sensor demo (disarmed, propellers removed)."""
import sys
import time
from zebjus_client import ZebjusClient

# Supply the same URL / authentication settings as your other companion examples.
if len(sys.argv) != 3:
    raise SystemExit("Usage: python led_sensor_demo.py http://kit-ip DEVICE_ID")

with ZebjusClient(sys.argv[1], expected_device_id=sys.argv[2]) as drone:
    try:
        print(drone.led_set("blink", 500))
        print(drone.led_read())
        print(drone.command("pinmap_get"))
        print(drone.gpio_read(17, mode="pullup"))  # D7 only if unreserved
        time.sleep(3)
    finally:
        drone.led_set("off")
