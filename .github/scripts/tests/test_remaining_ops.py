"""Execute the cleanup shell against owned fixtures and check host-guard upgrade."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('guard', ROOT / 'scripts/ops/update-health-guard.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class CleanupTests(unittest.TestCase):
    def run_cleanup(self, owner, fail=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage = root / 'staging'
            stage.mkdir()
            (stage / 'last-deployed-pr').write_text(owner)
            cron = root / 'cron'
            cron.mkdir()
            for name in ['finsim-staging', 'finsim-production']:
                (cron / name).write_text('existing schedule')
            logrotate = root / 'logrotate'
            logrotate.mkdir()
            (logrotate / 'finsim-staging').write_text('existing logrotate')
            binary = root / 'bin'
            binary.mkdir()
            for name, body in {
                'docker': 'echo "$*" >> "$CALL_LOG"\ncase "$*" in *down*) exit "$DOWN_STATUS";; esac',
                'flock': 'echo "flock $*" >> "$CALL_LOG"',
            }.items():
                file = binary / name
                file.write_text('#!/bin/sh\n' + body + '\n')
                file.chmod(0o755)
            source = (ROOT / '.github/workflows/cleanup-staging.yml').read_text()
            script = textwrap.dedent(source.split('          script: |\n', 1)[1])
            script = script.replace('/opt/finsim-staging', str(stage))
            script = script.replace('/etc/cron.d', str(cron)).replace('/etc/logrotate.d', str(logrotate))
            result = subprocess.run(['bash', '-c', script], capture_output=True, text=True, env={
                **os.environ, 'PATH': str(binary) + ':' + os.environ['PATH'], 'PR_NUMBER': '38',
                'CALL_LOG': str(root / 'calls'), 'DOWN_STATUS': '1' if fail else '0',
            })
            return {
                'code': result.returncode,
                'owner': (stage / 'last-deployed-pr').exists(),
                'stopped': (stage / 'last-stopped-at').exists(),
                'staging_cron': (cron / 'finsim-staging').exists(),
                'production_cron': (cron / 'finsim-production').read_text(),
                'logrotate': (logrotate / 'finsim-staging').exists(),
                'calls': (root / 'calls').read_text(),
            }

    def test_owned_cleanup_removes_schedule_then_stops(self):
        result = self.run_cleanup('38\n')
        self.assertEqual(result['code'], 0)
        self.assertFalse(result['staging_cron'] or result['logrotate'] or result['owner'])
        self.assertTrue(result['stopped'])
        self.assertLess(result['calls'].index('flock'), result['calls'].index('down'))
        self.assertEqual(result['production_cron'], 'existing schedule')

    def test_other_owner_is_untouched(self):
        result = self.run_cleanup('39')
        self.assertEqual(result['code'], 0)
        self.assertTrue(result['staging_cron'] and result['logrotate'] and result['owner'])
        self.assertFalse(result['stopped'])
        self.assertNotIn('down', result['calls'])

    def test_failed_teardown_is_not_success(self):
        result = self.run_cleanup('38', fail=True)
        self.assertNotEqual(result['code'], 0)
        self.assertTrue(result['owner'])
        self.assertFalse(result['stopped'])
        self.assertEqual(result['production_cron'], 'existing schedule')


class GuardTests(unittest.TestCase):
    def test_upgrade_retains_policy_and_backup_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'health-guard.sh'
            original = ('URL="https://finsim.anlanai.cn/login"\nFAIL_THRESHOLD=4\n'
                        'docker compose -f "$COMPOSE_FILE" up -d\n')
            path.write_text(original)
            path.chmod(0o755)
            guard.upgrade(path)
            self.assertIn('/api/health/ready', path.read_text())
            self.assertIn('FAIL_THRESHOLD=4', path.read_text())
            self.assertIn('-p finsim up -d --no-recreate', path.read_text())
            before = path.read_bytes()
            guard.upgrade(path)
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(path.with_name(path.name + '.before-readiness').read_text(), original)
            self.assertEqual(path.stat().st_mode & 0o777, 0o755)

    def test_custom_guard_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'guard.sh'
            path.write_text('URL="https://custom.invalid/check"')
            with self.assertRaisesRegex(ValueError, 'Unrecognized'):
                guard.upgrade(path)
            self.assertEqual(path.read_text(), 'URL="https://custom.invalid/check"')


if __name__ == '__main__':
    unittest.main()
