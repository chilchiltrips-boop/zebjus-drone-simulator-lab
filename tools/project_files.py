"""One inventory for validation, cleanup, release checks and upload packaging."""
from pathlib import Path

TRANSIENT_DIRS = {'.git', '__pycache__', 'node_modules', '.gradle', '.venv', '.arduino-data', '.arduino-downloads'}

def project_files(root):
    root = Path(root).resolve()
    result = []
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        parts = path.relative_to(root).parts
        if any(part in TRANSIENT_DIRS for part in parts[:-1]):
            continue
        if path.name in {'.DS_Store', '.git'} or path.name.startswith('._') or path.suffix == '.pyc':
            continue
        if parts[0] == 'android-app' and (parts[1:2] == ('build',) or parts[1:3] == ('app', 'build')):
            continue
        result.append(path)
    return sorted(result)
