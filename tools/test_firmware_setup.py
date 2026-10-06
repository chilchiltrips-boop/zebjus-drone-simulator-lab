#!/usr/bin/env python3
"""Exercise transient setup errors and persistent failures without network access."""
import contextlib, hashlib, io, runpy, subprocess, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
BUILD = runpy.run_path(str(ROOT / 'tools/build_firmware.py'))

class SetupTest(unittest.TestCase):
    def test_monitor_task_frame_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory);report=path/'monitor.su'
            with self.assertRaisesRegex(RuntimeError,'unmeasured'): BUILD['verify_monitor_stack'](path)
            report.write_text('FlightRcMonitor.h:15:6:void rcMonitorTask(void*)\t6672\tstatic\n')
            with self.assertRaisesRegex(RuntimeError,'1024-byte'): BUILD['verify_monitor_stack'](path)
            report.write_text('FlightRcMonitor.h:15:6:void rcMonitorTask(void*)\t256\tstatic\n')
            self.assertEqual(BUILD['verify_monitor_stack'](path)['directFrameBytes'],256)
            report.write_text('FlightRcMonitor.h:15:6:void rcMonitorTask(void*)\t256\tdynamic\n')
            with self.assertRaisesRegex(RuntimeError,'unmeasured'): BUILD['verify_monitor_stack'](path)

    def test_transient_server_failure_recovers(self):
        failure = subprocess.CalledProcessError(1, ['arduino-cli'])
        with patch('subprocess.run', side_effect=[failure, failure, None]) as call, patch('time.sleep') as sleep, contextlib.redirect_stdout(io.StringIO()):
            BUILD['run'](['arduino-cli', 'core', 'install'], 'ESP32 core installation', attempts=4)
        self.assertEqual(call.call_count, 3)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [10, 20])

    def test_persistent_setup_failure_stops(self):
        with patch('subprocess.run', side_effect=subprocess.CalledProcessError(1, ['arduino-cli'])) as call, patch('time.sleep') as sleep, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, 'ESP32 core installation.*4 attempt'):
                BUILD['run'](['arduino-cli', 'core', 'install'], 'ESP32 core installation', attempts=4)
        self.assertEqual(call.call_count, 4)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [10, 20, 40])

    def test_compile_errors_are_not_retried(self):
        with patch('subprocess.run', side_effect=subprocess.CalledProcessError(2, ['arduino-cli'])) as call, patch('time.sleep') as sleep, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, 'compile.*1 attempt'):
                BUILD['run'](['arduino-cli', 'compile'], 'A2 compile')
        self.assertEqual(call.call_count, 1)
        sleep.assert_not_called()

    def test_install_only_leaves_delivered_firmware_unchanged(self):
        paths = list((ROOT / 'FlightCore_Firmware').glob('*')) + [ROOT / 'firmware-catalog.json', ROOT / 'firmware-updater.js']
        hashes = {p: hashlib.sha256(p.read_bytes()).digest() for p in paths if p.is_file()}
        with patch.object(sys, 'argv', ['build_firmware.py', '--install-only']), patch('shutil.which', return_value='arduino-cli'), patch('subprocess.run') as call, contextlib.redirect_stdout(io.StringIO()):
            BUILD['main']()
        self.assertEqual([c.args[0][1:3] for c in call.call_args_list], [['core', 'update-index'], ['core', 'install']])
        self.assertTrue(all(hashlib.sha256(p.read_bytes()).digest() == h for p, h in hashes.items()))

if __name__ == '__main__':
    unittest.main()
