#!/usr/bin/env python3
"""Incomplete batches, wrong bytes and generated build files must be handled consistently."""
import tempfile, unittest
from pathlib import Path
from release_integrity import verify_manifest, write_manifest
from project_files import project_files

class UploadIntegrityTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'VERSION.txt').write_text('18.3.61\n')
        (self.root / 'app.js').write_text('console.log("ready");\n')
        (self.root / 'vendor').mkdir()
        (self.root / 'vendor/runtime.wasm').write_bytes(b'complete runtime')
        write_manifest(self.root)

    def test_complete_upload_passes(self):
        self.assertEqual(verify_manifest(self.root), 3)

    def test_missing_later_batch_fails(self):
        (self.root / 'vendor/runtime.wasm').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing: vendor/runtime.wasm'):
            verify_manifest(self.root)

    def test_same_size_wrong_bytes_fail(self):
        path = self.root / 'vendor/runtime.wasm'
        path.write_bytes(bytes(value ^ 1 for value in path.read_bytes()))
        with self.assertRaisesRegex(ValueError, 'Changed/incomplete: vendor/runtime.wasm'):
            verify_manifest(self.root)

    def test_unexpected_wrapper_fails(self):
        (self.root / 'UPLOAD_MANIFEST.json').write_text('{}\n')
        with self.assertRaisesRegex(ValueError, 'Unexpected: UPLOAD_MANIFEST.json'):
            verify_manifest(self.root)

    def test_generated_outputs_do_not_change_inventory(self):
        before = project_files(self.root)
        for rel in ['tools/__pycache__/example.pyc', 'node_modules/example/index.js', 'android-app/build/output.apk', 'android-app/app/build/classes/example.class', 'android-app/.gradle/cache.bin', '.DS_Store']:
            path = self.root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'generated')
        self.assertEqual(project_files(self.root), before)
        self.assertEqual(verify_manifest(self.root), 3)

    def test_release_refresh_after_intentional_edit(self):
        (self.root / 'app.js').write_text('console.log("new release");\n')
        with self.assertRaises(ValueError):
            verify_manifest(self.root)
        write_manifest(self.root)
        self.assertEqual(verify_manifest(self.root), 3)

    def test_first_seal_counts_its_manifest(self):
        (self.root / 'release-integrity.json').unlink()
        (self.root / 'FILE_COUNT.txt').write_text('0\n')
        write_manifest(self.root)
        self.assertEqual(int((self.root / 'FILE_COUNT.txt').read_text()), len(project_files(self.root)))
        self.assertEqual(verify_manifest(self.root), 4)

if __name__ == '__main__':
    unittest.main()
