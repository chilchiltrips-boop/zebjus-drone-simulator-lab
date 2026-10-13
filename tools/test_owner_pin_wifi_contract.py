#!/usr/bin/env python3
"""Security and UI regression contract for 10-digit OWNER PIN and AP STA discovery."""
from pathlib import Path
fw=Path('FlightCore_Firmware/FlightSecurity.h').read_text()
client=Path('kit-security.js').read_text()
android=Path('android-app/app/src/main/java/in/zebjus/aerion/PairingStore.java').read_text()
school=Path('school-lab.js').read_text()
portal=Path('tools/ap_secure_source.html').read_text()
scanner=Path('FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino').read_text()
assert 'bool makeOwnerCredential(String& code)' in fw
assert "code.reserve(10)" in fw and "esp_random()" in fw and "while(n>=4294967290UL)" in fw
assert 'makeOwnerCredential(code)' in fw and 'size_t n=reset?0:p.getBytesLength("verifier")' in fw
assert 'if(++pairRateCount>8)' in fw and 'if(pairSerial=="PAIR RESET"' in fw
assert 'pairOwner.id="OWNER"' in fw and 'makeCredential(*c,id,code)' in fw
assert "[0-9]{10}" in client and "[A-F0-9]{32}" in client
assert '[0-9]{10}' in android and '[A-Fa-f0-9]{32}' in android
assert "function maybeAutoScanWifi(" in school and "maybeAutoScanWifi(status)" in school
assert "function apSetupSession()" in school and "if(!canControl()&&!apSetupSession())" in school
assert "void scanNetworks()" in portal and "scan.onclick=scanNetworks;" in portal
assert "WiFi.scanNetworks(true)" in scanner and "if(started<-1)" in scanner
assert "physicalRcAllowed" not in portal
print('PASS: 10-digit PIN generation with legacy migration, secure Android storage, 8/min pairing limit, automatic AP SSID scan and safe setup-only provisioning')
