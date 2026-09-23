#!/usr/bin/env python3
import argparse, hashlib, json, shutil, subprocess, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'FlightCore_Firmware'/'ZEBJUS_FLIGHTCORE_V18_3_24.ino'
OUT=ROOT/'FlightCore_Firmware'
CAT=OUT/'catalog.json'
CORE_VERSION='3.3.7'
INDEX_URL='https://espressif.github.io/arduino-esp32/package_esp32_index.json'

def run(cmd):
    print('+',' '.join(map(str,cmd)),flush=True); subprocess.run(cmd,check=True)

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()

def find_app_bin(build):
    bins=[p for p in build.glob('*.bin') if not any(x in p.name.lower() for x in ('bootloader','partitions','merged','factory'))]
    bins.sort(key=lambda p:p.stat().st_size,reverse=True)
    if not bins: raise RuntimeError('Application .bin was not produced')
    return bins[0]

def main():
    catalog=json.loads(CAT.read_text())
    ids=[b['id'] for b in catalog.get('boards',[]) if b.get('build',{}).get('builder')=='arduino-cli']
    ap=argparse.ArgumentParser(description='Build verified ZEBJUS FlightCore firmware packages without Arduino IDE.')
    ap.add_argument('--board',default='all',help='Board profile ID from catalog.json, or all')
    ap.add_argument('--skip-core-install',action='store_true')
    args=ap.parse_args()
    if args.board!='all' and args.board not in ids: raise SystemExit(f'Unknown/non-buildable board profile: {args.board}. Available: {", ".join(ids)}')
    cli=shutil.which('arduino-cli')
    if not cli: raise SystemExit('arduino-cli not found. Install Arduino CLI, then rerun this script.')
    if not SRC.exists(): raise SystemExit(f'Missing source: {SRC}')
    if not args.skip_core_install:
        run([cli,'core','update-index','--additional-urls',INDEX_URL])
        run([cli,'core','install',f'esp32:esp32@{CORE_VERSION}','--additional-urls',INDEX_URL])
    targets=[b for b in catalog['boards'] if b['id'] in ids and (args.board=='all' or b['id']==args.board)]
    for b in targets:
        cfg=b['build']; pkg=b['latest']['app']; filename=pkg['file']
        with tempfile.TemporaryDirectory(prefix='zfc-build-') as td:
            td=Path(td); sketch=td/'ZEBJUS_FLIGHTCORE_V18_3_24'; sketch.mkdir(); shutil.copy2(SRC,sketch/'ZEBJUS_FLIGHTCORE_V18_3_24.ino')
            build=td/'build'; build.mkdir()
            run([cli,'compile','--fqbn',cfg['fqbn'],'--output-dir',str(build),str(sketch)])
            srcbin=find_app_bin(build); dst=OUT/filename; shutil.copy2(srcbin,dst); digest=sha(dst)
            pkg.update({'available':True,'sha256':digest}); print(f'{b["name"]}: {dst.name} {dst.stat().st_size} bytes SHA256 {digest}')
    CAT.write_text(json.dumps(catalog,indent=2)+'\n'); (ROOT/'firmware-catalog.json').write_text(json.dumps(catalog,indent=2)+'\n'); print('Updated',CAT)

if __name__=='__main__': main()
