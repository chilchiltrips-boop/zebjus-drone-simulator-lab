"""Generate one minimal controller UI for web, offline browser and Android."""
from pathlib import Path
import sys,json
root=Path(__file__).resolve().parents[1]
source=(root/'tools/flight_app_source.html').read_text()
style='<style>\n'+(root/'controller.css').read_text()+'\n</style>'
scripts='\n'.join('<script>\n'+(root/name).read_text()+'\n</script>' for name in ['controller.js','firmware-updater.js'])
status=json.loads((root/'release-status.json').read_text())
text=source.replace('<!-- SIMPLE_STYLE -->',style).replace('<!-- SIMPLE_SCRIPTS -->','<script>window.AerionRelease='+json.dumps(status,separators=(',',':'))+';</script>\n'+scripts)
web=text.replace('<!-- ANDROID_TRANSPORT -->','')
app=text.replace('<!-- ANDROID_TRANSPORT -->','<script src="../android-transport.js"></script>')
outputs={root/'index.html':web,root/'flight/index.html':web,root/'android-app/app/src/main/assets/flight/index.html':app}
for path,data in outputs.items():
    if '--check' in sys.argv:
        if not path.is_file() or path.read_text()!=data:raise SystemExit('Regenerate controller UI: '+str(path))
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(data)
print('Shared controller UI '+('verified' if '--check' in sys.argv else 'generated'))
