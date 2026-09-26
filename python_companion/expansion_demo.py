"""Read-only starter project for a verified local ZEBJUS kit.

Set ZEBJUS_KIT_URL and ZEBJUS_DEVICE_ID in your terminal first. Run in
PyCharm or with `python expansion_demo.py` while on the kit's Wi-Fi.
"""
from zebjus_client import client_from_environment

with client_from_environment() as kit:
    status = kit.status()
    print('Kit:', status['name'], status['deviceId'], status['boardId'])
    print('Motor routing:', status.get('expansion', {}).get('motors', []))
    devices = kit.i2c_scan()
    print('I2C devices:', devices['count'])
    for device in devices['devices']:
        print(' ', device['addressHex'], device.get('hint', 'I2C device'))
    print('PPM / Web rates:', status.get('ppmFrameHz'), status.get('webRcFrameHz'))
    print('Flight loop Hz:', status.get('flightLoopHz'))

    # After confirming your exact A2 wiring and removing propellers, you can
    # run mutating commands in a separate supervised script, for example:
    # kit.servo_config(17)             # signal D7; power servo externally
    # kit.servo_write(1500)            # center, 50 Hz
    # kit.gpio_write(18, 1)            # D10 is 3.3 V logic; use a load driver
    # kit.gpio_release(18)             # output LOW, return pin to input
    # kit.gps_config(19)               # GPS TX to D8 RX, 9600 baud
    # print(kit.gps_read())
    # kit.matrix_config(0x70)          # HT16K33 only
    # kit.matrix_write([0, 36, 126, 126, 60, 24, 0, 0])
    # print(kit.i2c_read(0x70, 0, 1))  # choose a register from its datasheet
    # kit.motor_map_set(('D1', 'D2', 'D3', 'D0'))  # reboots the FC
