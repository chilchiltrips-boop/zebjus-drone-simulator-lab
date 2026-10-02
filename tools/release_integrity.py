#!/usr/bin/env python3
"""Verify complete release uploads before a build or merge. --write seals a release."""
import argparse, hashlib, json, sys
from pathlib import Path

sys.dont_write_bytecode = True
from project_files import project_files

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = 'release-integrity.json'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_manifest(root):
    root = Path(root).resolve()
    count_file = root / 'FILE_COUNT.txt'
    if count_file.is_file():
        count = len(project_files(root)) + int(not (root / MANIFEST).is_file())
        count_file.write_text(str(count) + '\n')
    entries = [{'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size, 'sha256': digest(p)}
               for p in project_files(root) if p.relative_to(root).as_posix() != MANIFEST]
    payload = {'schema': 1, 'version': (root / 'VERSION.txt').read_text().strip(), 'files': entries}
    (root / MANIFEST).write_text(json.dumps(payload, indent=2) + '\n')
    return payload

def verify_manifest(root):
    root = Path(root).resolve()
    payload = json.loads((root / MANIFEST).read_text())
    if payload.get('schema') != 1 or payload.get('version') != (root / 'VERSION.txt').read_text().strip():
        raise ValueError('Release integrity version/schema mismatch')
    entries = payload['files']
    expected = set()
    errors = []
    for entry in entries:
        rel = Path(entry['path'])
        if rel.is_absolute() or '..' in rel.parts or '\\' in entry['path'] or not rel.parts:
            raise ValueError('Invalid release path')
        name = rel.as_posix()
        if name == MANIFEST or name in expected:
            raise ValueError('Duplicate/self-referencing release path')
        expected.add(name)
        path = root / rel
        if not path.is_file():
            errors.append('Missing: ' + name)
        elif path.stat().st_size != entry['bytes'] or digest(path) != entry['sha256']:
            errors.append('Changed/incomplete: ' + name)
    actual = {p.relative_to(root).as_posix() for p in project_files(root)} - {MANIFEST}
    errors.extend('Unexpected: ' + name for name in sorted(actual - expected))
    if errors:
        raise ValueError('\n'.join(errors) + '\nUpload every batch before building/merging. For intentional source edits, regenerate with python3 -B tools/release_integrity.py --write.')
    return len(entries)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--check', action='store_true')
    mode.add_argument('--write', action='store_true')
    args = parser.parse_args()
    try:
        if args.write:
            print('Release integrity written:', len(write_manifest(ROOT)['files']), 'files')
        else:
            print('Release integrity PASS:', verify_manifest(ROOT), 'files')
    except (ValueError, KeyError, OSError) as error:
        print('Release integrity FAILED:', error, file=sys.stderr)
        raise SystemExit(1)

if __name__ == '__main__':
    main()
