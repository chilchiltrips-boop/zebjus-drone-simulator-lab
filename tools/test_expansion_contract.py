#!/usr/bin/env python3
"""Check the new Python templates, AP inline JS and critical PWM conversion."""
from pathlib import Path
import ast
import json
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
node = shutil.which('node')
if not node:
    raise SystemExit('node is required for Python template and AP inline JS checks')
source = ROOT.joinpath('app.js').read_text()
worker = ROOT.joinpath('python-worker.js').read_text()
program = r'''
const fs=require('fs'),vm=require('vm');
for(const file of process.argv.slice(1)){
 const js=fs.readFileSync(file,'utf8'), matches=[...js.matchAll(/const (PY_[A-Z0-9_]+_EXAMPLE|PRELUDE)=`([\s\S]*?)`;/g)];
 for(const m of matches)console.log(JSON.stringify({file,name:m[1],code:vm.runInNewContext('`'+m[2]+'`')}));
}
'''
result = subprocess.run([node, '-e', program, str(ROOT/'app.js'), str(ROOT/'python-worker.js')], capture_output=True, text=True)
if result.returncode:
    raise SystemExit(result.stderr)
examples = 0
for line in result.stdout.splitlines():
    item = json.loads(line)
    compile(item['code'], f"{item['file']}:{item['name']}", 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    examples += item['name'].startswith('PY_')
assert examples >= 40, f'Expected 40+ student templates, found {examples}'
for name in ('ap_portal_source.html','ap_fly_source.html','ap_io_source.html'):
    html=(ROOT/'tools'/name).read_text()
    script=re.search(r'<script>([\s\S]*?)</script>',html)
    assert script, name
    result=subprocess.run([node,'--check'],input=script.group(1),text=True,capture_output=True)
    if result.returncode: raise SystemExit(f'{name}: {result.stderr}')
ino=(ROOT/'FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino').read_text()
match=re.search(r'uint32_t escDutyFromUs\(int us\)\{[^}]+\}',ino)
servo=re.search(r'uint32_t servoDutyFromUs\(int us\)\{[^}]+\}',ino)
assert match and servo, 'PWM pulse conversion missing'
cpp='#include <stdint.h>\n#include <algorithm>\n#define constrain(v,lo,hi) std::clamp((v),(lo),(hi))\n'+match.group(0)+'\n'+servo.group(0)+'''\nint main(){return escDutyFromUs(1000)!=1024||escDutyFromUs(1500)!=1536||escDutyFromUs(2000)!=2048||escDutyFromUs(900)!=1024||escDutyFromUs(2100)!=2048||servoDutyFromUs(1000)!=205||servoDutyFromUs(1500)!=307||servoDutyFromUs(2000)!=410;}\n'''
compiler=shutil.which('g++')
if compiler:
    with tempfile.TemporaryDirectory() as tmp:
        out=Path(tmp)/'esc-duty'
        result=subprocess.run([compiler,'-std=c++17','-x','c++','-o',str(out),'-'],input=cpp,text=True,capture_output=True)
        if result.returncode: raise SystemExit(result.stderr)
        subprocess.run([out],check=True)
else:
    print('WARN: g++ unavailable; ESC duty C++ check skipped')
assert 'server.on("/io",HTTP_GET,sendIoPage)' in ino
assert 'ledcAttachChannel(pin,250,12,i)' in ino and 'ledcAttachChannel(pin,50,12,4)' in ino
assert ino.count('requireControl()')>=1
print(f'PASS: {examples} student examples, Python preludes, three AP scripts, ESC/servo microsecond duty endpoints and /io route')
