#!/usr/bin/env python3
"""Check runtime inventory, dependency closure and every bundled file hash."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'offline-manifest.json').read_text())
provenance = json.loads((ROOT / 'vendor/provenance.json').read_text())
lock = json.loads((ROOT / 'vendor/pyodide/pyodide-lock.json').read_text())
assert manifest['version'] == (ROOT / 'VERSION.txt').read_text().strip()
assert manifest['totalBytes'] == sum(f['bytes'] for f in manifest['files'])
paths = {f['path'] for f in manifest['files']}
assert len(paths) == len(manifest['files'])
for f in manifest['files'] + provenance['files']:
    p = ROOT / f['path']
    assert p.resolve().is_relative_to(ROOT.resolve())
    data = p.read_bytes()
    assert len(data) == f['bytes'], f['path']
    assert hashlib.sha256(data).hexdigest() == f['sha256'], f['path']
for name in provenance['pythonPackages']:
    package = lock['packages'][name]
    assert set(package['depends']).issubset(provenance['pythonPackages']), name
    p = ROOT / 'vendor/pyodide' / package['file_name']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == package['sha256'], name
    assert p.relative_to(ROOT).as_posix() in paths
for required in ['lab-workflow.js','lab-workflow.css','fc-setup.js','mobile-flight-console.js','flight-training.js','flight-training-core.js','telemetry-cockpit.js','control-sticks.js','kit-console.js','flight-diagnostics.js','app.js','python-worker.js','monaco-worker.js','offline-support.js',
                 'python_companion/simple_syntax.py','python_companion/browser_cv2.py',
                 'python_companion/browser_cvzone.py','vendor/pyodide/pyodide.js',
                 'vendor/pyodide/pyodide.asm.wasm','vendor/pyodide/python_stdlib.zip',
                 'vendor/mediapipe/hand_landmarker.task','vendor/mediapipe/vision_bundle.mjs',
                 'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
                 'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm',
                 'vendor/monaco/min/vs/loader.js','vendor/esptool/bundle.mjs']:
    assert required in paths, required
for filename in ['app.js','python-worker.js','firmware-updater.js']:
    text = (ROOT / filename).read_text()
    assert not re.search(r'https://(?:cdn\.jsdelivr\.net|unpkg\.com|storage\.googleapis\.com)', text), filename
    assert 'vendor/' in text, filename
print(f'Offline bundle PASS: {len(paths)} runtime assets, {len(provenance["pythonPackages"])} Python packages, {manifest["totalBytes"]} bytes')
