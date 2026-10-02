#!/usr/bin/env python3
"""Remove obsolete ZEBJUS release leftovers and refresh repository inventory.

GitHub's web uploader replaces files with the same name but does not delete files that
were removed from a newer ZIP. CI runs this after firmware compilation so old runtime
copies cannot keep breaking validation.
"""
from pathlib import Path
import argparse, re, sys
sys.dont_write_bytecode = True
from project_files import project_files

ROOT = Path(__file__).resolve().parents[1]
FW = ROOT / 'FlightCore_Firmware'

LEGACY_FILES = [
    'drone3d.js',
    'wiring2d.js',
    'learning-lab.js',
    'fc_standoff.glb',
    'thumb_fcStandoff.png',
    # Packaging wrappers are outside the project and must not remain in GitHub.
    'UPLOAD_MANIFEST.json', 'BATCH_INVENTORY.csv', 'READ_FIRST.md', 'assemble_project.py',
    'UPLOAD_INVENTORY.json', 'UPLOAD_03_INVENTORY.json', 'UPLOAD_03_GUIDE.md', 'UPLOAD_GUIDE.md',
    'android-app/dist/ZEBJUS_Aerion_V18_3_60_Android.apk',
]

# Old naming schemes. Stable files are ZEBJUS_FLIGHTCORE.ino and
# ZEBJUS_FLIGHTCORE_<BOARD>_APP.bin.
LEGACY_FW_PATTERNS = [
    'ZEBJUS_FLIGHTCORE_V*.ino',
    'ZEBJUS_FLIGHTCORE_*_V*_APP.bin',
    'ZEBJUS_FLIGHTCORE_V*_APP.bin',
]


def remove(path: Path, dry_run=False):
    if not path.exists():
        return False
    print(f"{'would remove' if dry_run else 'remove'}: {path.relative_to(ROOT)}")
    if not dry_run:
        path.unlink()
    return True


def packaged_file_count():
    return len(project_files(ROOT))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--no-count', action='store_true', help='Do not refresh FILE_COUNT.txt')
    args = ap.parse_args()

    removed = 0
    for rel in LEGACY_FILES:
        removed += int(remove(ROOT / rel, args.dry_run))
    if FW.exists():
        for pattern in LEGACY_FW_PATTERNS:
            for p in FW.glob(pattern):
                # Never remove the current stable source.
                if p.name == 'ZEBJUS_FLIGHTCORE.ino':
                    continue
                removed += int(remove(p, args.dry_run))

    if not args.no_count and not args.dry_run:
        # FILE_COUNT.txt already exists and therefore counts as one file; rewriting it
        # does not change the number of files.
        count = packaged_file_count()
        (ROOT / 'FILE_COUNT.txt').write_text(f'{count}\n')
        print(f'FILE_COUNT.txt -> {count}')

    print(f'cleanup complete: {removed} obsolete file(s) {"would be " if args.dry_run else ""}removed')


if __name__ == '__main__':
    main()
