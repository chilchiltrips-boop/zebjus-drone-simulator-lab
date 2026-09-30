"""Offline AP example: run in PyCharm after connecting Wi-Fi and pairing once."""

import time
from zebjus_simple import Drone


def main():
    with Drone() as drone:
        print("Connected:", drone.status()["deviceId"])
        try:
            while True:
                drone.led(1)
                time.sleep(1)
                drone.led(0)
                time.sleep(1)
        finally:
            drone.led(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Stopped; LED off and control released.")
