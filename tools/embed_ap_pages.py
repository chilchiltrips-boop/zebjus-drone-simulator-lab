"""Regenerate embedded ESP32 AP HTML from editable, responsive source pages."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
firmware = root / "FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino"
source = firmware.read_text(encoding="utf-8")
portal = (root / "tools/ap_portal_source.html").read_text(encoding="utf-8")
fly = (root / "tools/ap_fly_source.html").read_text(encoding="utf-8")
assert ")rawliteral" not in portal + fly, "raw string terminator in AP page"

portal_cpp = '''String portalPage(){
  String h=R"rawliteral(%s)rawliteral";
  h.replace("{{DEVICE_ID}}",htmlEscape(deviceId));
  h.replace("{{AP_NAME}}",htmlEscape(apName));
  h.replace("{{KIT_NAME}}",htmlEscape(kitName));
  return h;
}''' % portal.rstrip()
fly_cpp = 'String flyPage(){return R"rawliteral(%s)rawliteral";}' % fly.rstrip()
source, n = re.subn(r"String portalPage\(\)\{.*?\n\}", lambda _: portal_cpp, source, count=1, flags=re.S)
assert n == 1, "portalPage not found"
source, n = re.subn(r'String flyPage\(\)\{return R"rawliteral\(.*?\)rawliteral";\}', lambda _: fly_cpp, source, count=1, flags=re.S)
assert n == 1, "flyPage not found"
if "--check" in sys.argv:
    if firmware.read_text(encoding="utf-8") != source:
        raise SystemExit("AP page templates differ from embedded firmware. Run python3 tools/embed_ap_pages.py")
    print("AP page templates match embedded firmware")
else:
    firmware.write_text(source, encoding="utf-8")
    print("Embedded AP setup and direct control pages")
