#!/usr/bin/env python3
"""Rebuild pinned browser dependencies. End users do not run this tool."""
import concurrent.futures
import hashlib
import json
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor'
PY_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
records = []


def download(url, dest, expected=None):
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = urllib.request.urlopen(url, timeout=120).read()
    digest = hashlib.sha256(data).hexdigest()
    if expected and digest != expected:
        raise RuntimeError(f'Checksum mismatch: {dest.name}')
    dest.write_bytes(data)
    return {'path': dest.relative_to(ROOT).as_posix(), 'bytes': len(data),
            'sha256': digest, 'source': url}


def npm(name, version, target, prefixes):
    base = name.rsplit('/', 1)[-1]
    url = f'https://registry.npmjs.org/{name}/-/{base}-{version}.tgz'
    archive = VENDOR / f'.{base}.tgz'
    download(url, archive)
    try:
        with tarfile.open(archive) as tar:
            for member in tar:
                rel = member.name.removeprefix('package/')
                if not member.isfile() or not any(rel.startswith(p) for p in prefixes):
                    continue
                dest = target / rel
                if not dest.resolve().is_relative_to(target.resolve()):
                    raise RuntimeError('Unsafe archive path')
                dest.parent.mkdir(parents=True, exist_ok=True)
                data = tar.extractfile(member).read()
                dest.write_bytes(data)
                records.append({'path': dest.relative_to(ROOT).as_posix(), 'bytes': len(data),
                                'sha256': hashlib.sha256(data).hexdigest(), 'source': url})
    finally:
        archive.unlink(missing_ok=True)


def main():
    lock_path = VENDOR / 'pyodide/pyodide-lock.json'
    records.append(download(PY_BASE + 'pyodide-lock.json', lock_path))
    lock = json.loads(lock_path.read_text())
    names = set()

    def include(name):
        if name in names:
            return
        names.add(name)
        for dep in lock['packages'][name]['depends']:
            include(dep)

    for name in ['numpy', 'matplotlib', 'opencv-python', 'pillow', 'pandas']:
        include(name)
    # Unvendored standard-library extensions must also load without the internet.
    for name, package in lock['packages'].items():
        if package['package_type'] == 'cpython_module' and name != 'test':
            include(name)
    jobs = [(PY_BASE + name, VENDOR / 'pyodide' / name, None) for name in
            ['pyodide.js', 'pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip']]
    for name in sorted(names):
        p = lock['packages'][name]
        jobs.append((PY_BASE + p['file_name'], VENDOR / 'pyodide' / p['file_name'], p['sha256']))
    jobs.append(('https://raw.githubusercontent.com/pyodide/pyodide/0.27.7/LICENSE', VENDOR / 'pyodide/LICENSE', None))
    jobs.append(('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', VENDOR / 'mediapipe/hand_landmarker.task', None))
    jobs.append(('https://raw.githubusercontent.com/google-ai-edge/mediapipe/v0.10.21/LICENSE', VENDOR / 'mediapipe/LICENSE', None))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for rec in pool.map(lambda args: download(*args), jobs):
            records.append(rec)
            print('Bundled', rec['path'], rec['bytes'], flush=True)
    npm('monaco-editor', '0.52.2', VENDOR / 'monaco', ['min/', 'LICENSE', 'ThirdPartyNotices'])
    npm('@mediapipe/tasks-vision', '0.10.21', VENDOR / 'mediapipe', ['wasm/', 'vision_bundle.mjs', 'LICENSE', 'NOTICE'])
    npm('esptool-js', '0.6.1', VENDOR / 'esptool', ['bundle.js', 'LICENSE'])
    (VENDOR / 'esptool/bundle.js').rename(VENDOR / 'esptool/bundle.mjs')
    for rec in records:
        if rec['path'] == 'vendor/esptool/bundle.js':
            rec['path'] = 'vendor/esptool/bundle.mjs'
    # Pyodide runs package-relative paths against indexURL; no CDN fallback is needed.
    (VENDOR / 'provenance.json').write_text(json.dumps({
        'pyodide': '0.27.7', 'pythonPackages': sorted(names),
        'monaco': '0.52.2', 'mediapipe': '0.10.21', 'esptool': '0.6.1',
        'files': sorted(records, key=lambda r: r['path'])}, indent=2) + '\n')
    print('Bundled bytes:', sum(r['bytes'] for r in records))


if __name__ == '__main__':
    main()
