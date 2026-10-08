"""Generate installed/offline Flight App copies; firmware AP serves a small Wi-Fi recovery page."""
from pathlib import Path
import sys,re
root=Path(__file__).resolve().parents[1]
source=root/'tools/flight_app_source.html'
text=source.read_text()
shared='<script>\n'+(root/'vendor/crypto/zfc-crypto.js').read_text()+'\n'+(root/'kit-security.js').read_text()+'\n'+(root/'control-sticks.js').read_text()+'\n'+(root/'mobile-flight-console.js').read_text()+'\n'+(root/'flight-recorder.js').read_text()+'\n</script>'
text=re.sub(r'<!-- AERION_SHARED_BEGIN -->.*?<!-- AERION_SHARED_END -->',lambda _: '<!-- AERION_SHARED_BEGIN -->\n'+shared+'\n<!-- AERION_SHARED_END -->',text,flags=re.S)
if '--check' in sys.argv and text!=source.read_text():raise SystemExit('Regenerate shared Flight App scripts')
if '--check' not in sys.argv:source.write_text(text)
flight=text.encode()
outputs={root/'flight/index.html':flight,root/'android-app/app/src/main/assets/flight/index.html':flight.replace(b'<script>\n(()=>',b'<script src="../android-transport.js"></script>\n<script>\n(()=>',1)}
portal=(root/'tools/ap_secure_source.html').read_text().replace('<!-- SECURE_SCRIPTS -->','<script>\n'+(root/'vendor/crypto/zfc-crypto.js').read_text()+'\n'+(root/'kit-security.js').read_text()+'\n</script>')
outputs[root/'FlightCore_Firmware/WIFI_SETUP_PAGE.h']=('#pragma once\n// Authenticated AP Wi-Fi maintenance; controls stay in the installed app.\nstatic const char WIFI_SETUP_PAGE[] PROGMEM=R"HTML('+portal+')HTML";\n').encode()
for path,data in outputs.items():
    if '--check' in sys.argv:
        if not path.is_file() or path.read_bytes()!=data:raise SystemExit('Regenerate installed Flight App: '+str(path))
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
print('Installed Flight App copies '+('verified' if '--check' in sys.argv else 'generated')+'; AP Wi-Fi recovery page is separate')
