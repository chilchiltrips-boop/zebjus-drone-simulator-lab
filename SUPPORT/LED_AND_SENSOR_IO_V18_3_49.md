# XIAO ESP32-C6 LED and sensor I/O

Flash the new firmware once to enable `led_set`/`led_read`. The orange user LED is GPIO15 and active low. The blink scheduler is nonblocking, toggling on each HTTP/flight loop iteration. It is not a precise timer if network handling stalls. `led_set(mode="off")` stops it. A disconnected Python client leaves the previously selected LED state in place; explicitly turn it off in `finally`.

Use `drone.led_set("blink", 500)`, `drone.led_read()`, and `drone.led_set("off")`. Modes are `on`, `off`, `blink` (interval 100–5000 ms). Requires a control session. The status/read command can be called read-only.

Spare pins: D7, D8, D9, D10, minus the configured PPM/GPS/servo pins. Motor D0–D3 and I2C D4/D5 are reserved. D6 is reserved for PPM selection. D10 is unavailable if selected as PPM. Get the current assignments from `pinmap_get` before wiring. GPIO reads offer `pullup`, `pulldown`, or `floating` input. `gpio_write(pin, 0/1)` and `gpio_release(pin)` work while disarmed only. GPIO and I2C read/writes are command/diagnostic interfaces, not flight timing or safety sensor interfaces.

For I2C sensors use `i2c_scan`, `i2c_read(address, reg, length)` and `i2c_write(address, reg, values)`. The bus is 3.3 V; check voltage, address, register map, and current draw for each sensor. Existing firmware recognizes MPU6050 and LSM6DS3 for generic readings; only the MPU6050 profile has been integrated into the flight stabilization path. For GPS use `gps_config` and `gps_read`; UART pins are removed from the spare GPIO pool. No free analog input is exposed by this A2 pin allocation. An ADC battery monitor needs a reviewed board/pin and resistor-divider design before adding firmware support.

Bench check without propellers: run LED blink, confirm each selected digital input with a 3.3 V logic signal, check I2C address discovery, then stop LED and release each output. Never connect 5 V sensor outputs directly to the ESP32-C6 inputs.
