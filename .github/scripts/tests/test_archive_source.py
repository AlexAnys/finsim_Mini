"""Deployment packaging fixtures; never change the real repository or remote state."""
import importlib.util
import io
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('archive_source', ROOT / 'scripts/ops/archive-source.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class DeploymentArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Archive fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.output = self.root / 'deployment.tar.gz'

    def tearDown(self):
        self.temp.cleanup()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root)] + list(args), stderr=subprocess.PIPE).decode().strip()

    def commit(self, files):
        for name, content in files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        self.git('add', '--all')
        self.git('commit', '-qm', 'fixture')
        return self.git('rev-parse', 'HEAD')

    def names(self):
        with tarfile.open(str(self.output), 'r:gz') as bundle:
            return set(bundle.getnames())

    def test_keeps_every_other_top_level_entry_and_only_excludes_harness(self):
        files = {
            'app/page.tsx': 'app', 'lib/service.ts': 'service', 'public/demo.svg': '<svg/>',
            'prisma/schema.prisma': 'schema', 'scripts/ops/tool.py': 'script',
            '.github/workflows/deploy.yml': 'workflow', '.claude/settings.json': '{}',
            'package.json': '{}', 'Dockerfile': 'FROM node:22', 'docker-compose.yml': 'services:',
            'next.config.ts': 'config', 'AGENTS.md': 'instructions', '.env.example': 'EXAMPLE=1',
            'new-unknown-top-level.txt': 'keep unknown', '.harness-other/keep.txt': 'not .harness',
            '.harness/reports/old.md': 'history', '.harness/screenshots/large.png': 'screenshot',
        }
        commit = self.commit(files)
        result = archive.archive_source(self.root, commit, self.output)
        names = self.names()
        self.assertTrue(set(name for name in files if not name.startswith('.harness/')).issubset(names))
        self.assertFalse(any(name == '.harness' or name.startswith('.harness/') for name in names))
        self.assertEqual(result['gitSha'], commit)
        # Normal git archive still includes the history: no global export-ignore mutation.
        raw = subprocess.check_output(['git', '-C', str(self.root), 'archive', commit])
        with tarfile.open(fileobj=io.BytesIO(raw)) as bundle:
            self.assertIn('.harness/reports/old.md', bundle.getnames())

    def test_uses_the_requested_commit_not_dirty_or_untracked_files(self):
        commit = self.commit({'app/page.tsx': 'committed', '.harness/old.md': 'history'})
        (self.root / 'app/page.tsx').write_text('dirty')
        (self.root / 'untracked.txt').write_text('must not ship')
        archive.archive_source(self.root, commit, self.output)
        with tarfile.open(str(self.output), 'r:gz') as bundle:
            self.assertEqual(bundle.extractfile('app/page.tsx').read(), b'committed')
            self.assertNotIn('untracked.txt', bundle.getnames())

    def test_treats_special_top_level_names_as_literal_pathspecs(self):
        files = {'[literal].txt': 'brackets', 'space name.txt': 'space', ':magic.txt': 'colon',
                 '-leading-option.txt': 'dash', 'star*.txt': 'star', 'line\nbreak.txt': 'newline', '.harness/drop': 'drop'}
        commit = self.commit(files)
        archive.archive_source(self.root, commit, self.output)
        self.assertTrue((set(files) - {'.harness/drop'}).issubset(self.names()))
        self.assertNotIn('.harness/drop', self.names())

    def test_invalid_or_noncommit_ref_does_not_overwrite_output(self):
        self.commit({'app.ts': 'app'})
        self.output.write_bytes(b'keep prior output')
        blob = self.git('rev-parse', 'HEAD:app.ts')
        for ref in ['not-a-ref', '--help', blob]:
            with self.assertRaises(subprocess.CalledProcessError):
                archive.archive_source(self.root, ref, self.output)
            self.assertEqual(self.output.read_bytes(), b'keep prior output')

    def test_harness_only_commit_cannot_fall_back_to_archiving_everything(self):
        commit = self.commit({'.harness/history.md': 'history'})
        with self.assertRaisesRegex(ValueError, 'no deployable entries'):
            archive.archive_source(self.root, commit, self.output)
        self.assertFalse(self.output.exists())


if __name__ == '__main__':
    unittest.main()
