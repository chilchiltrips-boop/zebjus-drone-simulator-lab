#!/usr/bin/env python3
"""Fail closed on AP provisioning control and preserve AP router-recovery flow."""
from pathlib import Path
source=Path('FlightCore_Firmware/FlightSecurity.h').read_text()
portal=Path('tools/ap_secure_source.html').read_text()
start=source.index('if(secureApProvisioning()){')
end=source.index('if(server.arg("type")=="rc_frame"',start)
block=source[start:end]
assert 'path=="/api/wifi/sta"' in block and 'maintenance' in block
assert 'path=="/api/setup/test"' in block and 'path=="/api/security/maintenance"' in block
assert '"/api/command"' not in block and '"/api/control/acquire"' not in block
assert '"/api/firmware/begin"' not in block
assert "api('/api/setup/test'" in portal and "api('/api/wifi/sta'" in portal
assert "api('/api/control/acquire'" not in portal and "api('/api/control/ping'" not in portal
assert "AP setup authentication does not permit motor control" in portal
print('PASS: AP recovery provisions Wi-Fi without acquiring a motor-control lease')
