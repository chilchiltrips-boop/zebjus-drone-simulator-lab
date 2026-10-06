# V18.3.69 installation and hardware checks

1. Install android-app/dist/ZEBJUS_Aerion_V18_3_69_Android.apk; flash matching A1 or A2 firmware for your board. Reload the web app and confirm 18.3.69.
2. Connect app and web to the same kit Wi-Fi or router and verify the same Device ID. Select Tripod or Flight Training, ARM at low throttle and move all axes. Web Joystick must mirror the sticks; simulator outputs must remain physical DISARMED.
3. Choose Take web control while physical outputs are disarmed. App control ends, simulation stops, web starts neutral; enable web transmitter and ARM manually. Armed real outputs block transfer.
4. Receiver defaults to PPM. App / Web selection needs no RX calibration and enables Next after saving input.
5. PID opens with saved firmware values. Edit the dark Rate/Attitude tables and check Tripod preview. Reload restores firmware values; Save writes and reads them back. Simulator controls do not write kit PID.

Automated checks use simulated HTTP and production native UDP over loopback, and compile both board profiles. They do not establish real Wi-Fi quality, motor operation or physical flight safety.
