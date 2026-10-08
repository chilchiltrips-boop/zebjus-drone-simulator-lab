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
for name in ('tools/flight_app_source.html','flight/index.html','android-app/app/src/main/assets/flight/index.html'):
    html=(ROOT/name).read_text()
    scripts=re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',html)
    assert scripts,name
    for script in scripts:
        result=subprocess.run([node,'--check'],input=script,text=True,capture_output=True)
        if result.returncode:raise SystemExit(f'{name}: {result.stderr}')
subprocess.run([sys.executable,'-B',ROOT/'tools/embed_ap_pages.py','--check'],check=True)
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
    # Compile the actual ISR body with fake pulse edges. Partial/invalid frames
    # must not publish a stale CH5/CH6 arming or flight-mode value.
    isr=re.search(r'void IRAM_ATTR ppmIsr\(\)\{[\s\S]*?\n\}',ino)
    assert isr, 'PPM frame decoder missing'
    ppm_cpp='''#include <stdint.h>
#include <assert.h>
#define IRAM_ATTR
static uint32_t clockUs=0;
uint32_t micros(){return clockUs;}
const uint32_t PPM_SYNC_US=3000,PPM_MIN_US=750,PPM_MAX_US=2250;
volatile uint16_t ppmCh[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};
volatile uint16_t ppmPending[10]={};
volatile uint8_t ppmIndex=0;
volatile bool ppmInvalidFrame=false;
volatile uint32_t ppmLastEdgeUs=0,ppmLastFrameUs=0,ppmFrames=0;
''' + isr.group(0) + '''
void edge(uint32_t dt){clockUs+=dt;ppmIsr();}
int main(){
 edge(4000);
 for(uint32_t pulse: {1500u,1500u,1000u,1500u,1000u,1000u})edge(pulse);
 edge(4000);assert(ppmFrames==1&&ppmCh[4]==1000&&ppmCh[5]==1000);
 auto publishedAt=ppmLastFrameUs;
 for(uint32_t pulse: {1500u,1500u,1000u})edge(pulse);
 edge(4000);assert(ppmFrames==1&&ppmLastFrameUs==publishedAt);
 for(uint32_t pulse: {1500u,1500u,1000u,1500u,2000u,2000u})edge(pulse);
 edge(4000);assert(ppmFrames==2&&ppmCh[4]==2000&&ppmCh[5]==2000&&ppmCh[6]==1000&&ppmCh[8]==1500);
 for(uint32_t pulse: {1450u,1550u,1000u,1500u})edge(pulse);
 edge(4000);assert(ppmFrames==3&&ppmCh[0]==1450&&ppmCh[1]==1550&&ppmCh[4]==1000&&ppmCh[5]==1000);
 edge(1500);edge(2500);
 for(uint32_t pulse: {1500u,1500u,1000u,1500u,1000u,1000u})edge(pulse);
 edge(4000);assert(ppmFrames==3&&ppmCh[4]==1000);
}
'''
    ppm_cpp=ppm_cpp.replace('#include <assert.h>','#include <assert.h>\n#include <initializer_list>')
    with tempfile.TemporaryDirectory() as tmp:
        out=Path(tmp)/'ppm-frame'
        result=subprocess.run([compiler,'-std=c++17','-x','c++','-o',str(out),'-'],input=ppm_cpp,text=True,capture_output=True)
        if result.returncode: raise SystemExit(result.stderr)
        subprocess.run([out],check=True)
else:
    print('WARN: g++ unavailable; ESC duty C++ check skipped')
assert 'server.on("/io",HTTP_GET,sendIoPage)' not in ino
assert 'server.on("/",HTTP_GET,wifiSetupPage)' in ino
assert 'server.on("/setup",HTTP_GET,wifiSetupPage)' in ino
assert '/api/wifi/set' in (ROOT/'FlightCore_Firmware/WIFI_SETUP_PAGE.h').read_text()
assert 'DNSServer' not in ino
assert 'ledcAttachChannel(pin,250,12,i)' in ino and 'ledcAttachChannel(pin,50,12,4)' in ino
assert ino.count('requireControl()')>=1
print(f'PASS: {examples} student examples, Python preludes, installed Flight App scripts, PWM endpoints, complete-frame PPM parser and AP Wi-Fi recovery page')
