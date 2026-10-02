"""Generate deterministic gzip firmware pages and identical offline Flight App copies."""
from pathlib import Path
import gzip,sys,re
root=Path(__file__).resolve().parents[1]
fly=root/'tools/ap_fly_source.html'
text=fly.read_text()
shared='<script>\n'+(root/'control-sticks.js').read_text()+'\n'+(root/'kit-console.js').read_text()+'\n</script>'
text=re.sub(r'<!-- AERION_SHARED_BEGIN -->.*?<!-- AERION_SHARED_END -->',lambda _: '<!-- AERION_SHARED_BEGIN -->\n'+shared+'\n<!-- AERION_SHARED_END -->',text,flags=re.S)
if '--check' in sys.argv and text!=fly.read_text():raise SystemExit('Regenerate shared AP scripts')
if '--check' not in sys.argv:fly.write_text(text)
parts=['#pragma once\n#include <Arduino.h>\n']
for kind,name in [('PORTAL','ap_portal_source.html'),('FLY','ap_fly_source.html'),('IO','ap_io_source.html')]:
    raw=(root/'tools'/name).read_bytes()
    data=gzip.compress(raw,compresslevel=9,mtime=0)
    rows=[','.join(f'0x{x:02x}' for x in data[i:i+24]) for i in range(0,len(data),24)]
    parts.append(f'// {name}: {len(raw)} HTML bytes, {len(data)} gzip bytes\nstatic const uint8_t AP_{kind}[] PROGMEM={{\n'+',\n'.join(rows)+'\n};\n')
header=''.join(parts)
flight=(root/'tools/ap_fly_source.html').read_bytes()
outputs={root/'FlightCore_Firmware/AP_ASSETS.h':header.encode(),root/'flight/index.html':flight,root/'android-app/app/src/main/assets/flight/index.html':flight.replace(b'<script>\n(()=>',b'<script src="../android-transport.js"></script>\n<script>\n(()=>',1)}
for path,data in outputs.items():
    if '--check' in sys.argv:
        if not path.is_file() or path.read_bytes()!=data:raise SystemExit('Regenerate embedded pages: '+str(path))
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
print('Deterministic compressed AP pages '+('verified' if '--check' in sys.argv else 'generated'))
