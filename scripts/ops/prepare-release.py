#!/usr/bin/env python3
"""Extract git archive into a new SHA directory; never overlay old source."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tarfile
import tempfile


def prepare(root, archive, sha):
    if not re.fullmatch(r'[0-9a-f]{40}', sha): raise ValueError('expected a full commit SHA')
    root, archive = Path(root).resolve(), Path(archive).resolve()
    releases = root / 'releases'; releases.mkdir(parents=True, exist_ok=True)
    target = releases / sha
    archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    manifest = {'gitSha': sha, 'archiveSha256': archive_hash}
    if target.exists():
        if json.loads((target / '.release.json').read_text()) != manifest: raise ValueError('existing release differs')
        return target
    temporary = Path(tempfile.mkdtemp(prefix='.incoming-', dir=releases))
    try:
        with tarfile.open(archive, 'r:gz') as bundle:
            for member in bundle.getmembers():
                name = PurePosixPath(member.name)
                if name.is_absolute() or '..' in name.parts or member.isdev() or member.islnk(): raise ValueError('unsafe archive entry')
                if member.issym():
                    dest = (temporary / member.name).parent / member.linkname
                    try: dest.resolve().relative_to(temporary)
                    except ValueError: raise ValueError('symlink escapes release')
            bundle.extractall(temporary)  # Members and links validated above; supports the deployment host Python 3.6.
        (temporary / '.release.json').write_text(json.dumps(manifest) + '\n')
        os.rename(temporary, target)
        return target
    finally:
        if temporary.exists(): shutil.rmtree(temporary)


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('root');p.add_argument('archive');p.add_argument('sha')
    a=p.parse_args();print(prepare(a.root,a.archive,a.sha))
