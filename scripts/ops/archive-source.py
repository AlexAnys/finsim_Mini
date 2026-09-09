#!/usr/bin/env python3
"""Package one committed tree for deployment, excluding only top-level .harness."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


def archive_source(repo, ref, output):
    repo = Path(repo).resolve()
    output = Path(output).resolve()
    # Resolve first: caller text is never interpreted as a Git option or passed to a shell.
    commit = subprocess.check_output([
        'git', '-C', str(repo), 'rev-parse', '--verify', '--end-of-options', ref + '^{commit}'
    ], stderr=subprocess.PIPE).decode('ascii').strip()
    if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', commit):
        raise ValueError('ref must resolve to exactly one commit')
    raw = subprocess.check_output(['git', '-C', str(repo), 'ls-tree', '-z', '--name-only', commit])
    names = [os.fsdecode(name) for name in raw.split(b'\0') if name and name != b'.harness']
    if not names:
        raise ValueError('commit has no deployable entries outside .harness')
    output.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.archive-source-', suffix='.tar.gz', dir=str(output.parent))
    os.close(fd)
    try:
        subprocess.run([
            'git', '-C', str(repo), '--literal-pathspecs', 'archive', '--format=tar.gz',
            '--output=' + temporary, commit, '--'
        ] + names, check=True, stderr=subprocess.PIPE)
        os.replace(temporary, str(output))
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return {'gitSha': commit, 'bytes': output.stat().st_size, 'topLevelEntries': len(names)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', default='.')
    parser.add_argument('--ref', default='HEAD')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(archive_source(args.repo, args.ref, args.output)))
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, 'Deployment archive failed: ' + str(error) + '\n')
