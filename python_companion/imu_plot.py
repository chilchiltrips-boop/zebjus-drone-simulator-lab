"""Plot live IMU samples from a verified kit on the same Wi-Fi."""
import time

import matplotlib.pyplot as plt

from zebjus_client import client_from_environment


def main():
    with client_from_environment() as kit:
        status = kit.status()
        print(status["deviceId"], status.get("name"), status.get("imuModel"))
        data = []
        for _ in range(80):
            try:
                sample = kit.imu()["accel"]
                data.append((sample["x"], sample["y"], sample["z"]))
            except (ConnectionError, RuntimeError) as exc:
                print("Sample skipped:", exc)
            time.sleep(0.10)
    if not data:
        raise RuntimeError("No IMU samples; check the kit connection and I²C sensor")
    figure, axis = plt.subplots(figsize=(9, 4))
    for index, name in enumerate("XYZ"):
        axis.plot([sample[index] for sample in data], label=name)
    axis.set(xlabel="Sample", ylabel="Acceleration (g)", title="ZEBJUS FlightCore IMU")
    axis.grid(True)
    axis.legend()
    figure.tight_layout()
    figure.savefig("zebjus_imu_plot.png", dpi=160)
    print("Saved zebjus_imu_plot.png")


if __name__ == "__main__":
    main()
