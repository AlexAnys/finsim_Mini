#!/usr/bin/env python3
"""Local task/QA ledger; deterministic, locked, no legacy-history rewrites."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.request import urlopen
from urllib.parse import urlparse


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args]).decode().strip()


def digest(content):
    return hashlib.sha256(content).hexdigest()


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    with temporary.open('w') as out:
        json.dump(value, out, ensure_ascii=False, indent=2)
        out.write('\n'); out.flush(); os.fsync(out.fileno())
    temporary.replace(path)


class Ledger:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.state = self.root / '.harness/current-task.json'
        self.records = self.root / '.harness/records.jsonl'

    @contextmanager
    def lock(self):
        path = Path(git(self.root, 'rev-parse', '--git-path', 'harness-task.lock'))
        if not path.is_absolute(): path = self.root / path
        with path.open('a') as handle:
            fcntl.flock(handle, fcntl.LOCK_EX)
            yield

    def read(self):
        if not self.state.exists(): return None
        value = json.loads(self.state.read_text())
        if not isinstance(value, dict) or value.get('schema') != 1 or value.get('status') not in {'active', 'awaiting_user', 'reviewing', 'ready', 'complete'}:
            raise ValueError('invalid current task record')
        return value

    def path(self, name):
        path = (self.root / name).resolve()
        if not path.is_relative_to(self.root): raise ValueError('path must stay in this worktree')
        return path

    def names(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args, '-z']).decode().split('\0')

    @staticmethod
    def evidence_path(name):
        return name in {'.harness/current-task.json', '.harness/records.jsonl', '.harness/progress.tsv', '.harness/HANDOFF.md'} or name.startswith(('.harness/reports/', '.harness/archive/', '.harness/state/', '.harness/screenshots/'))

    def fingerprint(self):
        names = self.names('ls-files', '--cached', '--others', '--exclude-standard')
        entries = []
        for name in sorted(set(names) - {''}):
            if self.evidence_path(name): continue
            path = self.root / name
            if path.is_symlink(): content = b'symlink:' + os.readlink(path).encode()
            elif path.is_file(): content = str(path.stat().st_mode & 0o777).encode() + b':' + path.read_bytes()
            else: content = b'deleted'
            entries.append([name, digest(content)])
        return digest(json.dumps(entries, ensure_ascii=True).encode())

    def changes(self, task):
        tracked = self.names('diff', '--name-only', '--no-renames', task['base_sha'])
        untracked = self.names('ls-files', '--others', '--exclude-standard')
        return sorted(set(tracked + untracked) - {''})

    def append(self, row):
        self.records.parent.mkdir(parents=True, exist_ok=True)
        with self.records.open('a') as out:
            out.write(json.dumps({'timestamp': datetime.now(timezone.utc).isoformat(), **row}, ensure_ascii=False) + '\n')
            out.flush(); os.fsync(out.fileno())

    def identity(self, task):
        if not task.get('base_url'):
            if task['validation'] != 'docs': raise ValueError('full QA requires an explicit base_url')
            return None
        with urlopen(task['base_url'].rstrip('/') + '/api/version', timeout=10) as response:
            identity = json.load(response).get('data', {})
        if identity.get('app') != 'finsim' or identity.get('gitSha') != task['expected_sha']:
            raise ValueError('QA environment is not FinSim at expected_sha')
        return identity

    def binding(self, task):
        if task['worktree'] != str(self.root) or task['branch'] != git(self.root, 'branch', '--show-current'):
            raise ValueError('task belongs to another worktree/branch')
        if task['validation'] == 'full':
            if git(self.root, 'rev-parse', 'HEAD') != task['expected_sha']:
                raise ValueError('HEAD does not match the tested environment SHA')
            dirty = self.names('diff', '--name-only', 'HEAD') + self.names('ls-files', '--others', '--exclude-standard')
            if any(name and not self.evidence_path(name) for name in dirty):
                raise ValueError('source is not frozen at HEAD; commit before formal QA')
        return {'source_hash': self.fingerprint(), 'spec_hash': digest(self.path(task['spec_path']).read_bytes())}

    def init(self, args):
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}', args.id): raise ValueError('invalid task id')
        previous = self.read()
        if previous and previous['status'] != 'complete': raise ValueError('existing task is unfinished; do not replace it')
        spec = self.path(args.spec)
        if not spec.is_file(): raise ValueError('spec does not exist')
        task = {'schema': 1, 'task_id': args.id, 'status': 'active', 'worktree': str(self.root),
                'branch': git(self.root, 'branch', '--show-current'), 'base_sha': git(self.root, 'rev-parse', args.base + '^{commit}'),
                'spec_path': str(spec.relative_to(self.root)), 'validation': args.validation,
                'base_url': args.url, 'expected_sha': args.sha or git(self.root, 'rev-parse', 'HEAD')}
        atomic_json(self.state, task); self.append({'type': 'task-start', **task})

    def retarget(self, task, sha, url):
        if task['status'] not in {'active', 'awaiting_user'}:
            raise ValueError('retarget requires active or awaiting_user; never rebind a PASS')
        if not re.fullmatch(r'[a-f0-9]{40}', sha) or git(self.root, 'rev-parse', 'HEAD') != sha:
            raise ValueError('retarget SHA must be the current full HEAD commit')
        if task['worktree'] != str(self.root) or task['branch'] != git(self.root, 'branch', '--show-current'):
            raise ValueError('task belongs to another worktree/branch')
        parsed = urlparse(url)
        if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('retarget requires an explicit HTTP(S) base URL without credentials')
        dirty = self.names('diff', '--name-only', 'HEAD') + self.names('ls-files', '--others', '--exclude-standard')
        if any(name and not self.evidence_path(name) for name in dirty):
            raise ValueError('commit source changes before retarget')
        previous = {'sha': task['expected_sha'], 'base_url': task.get('base_url')}
        task.update(expected_sha=sha, base_url=url.rstrip('/'), status='active')
        task.pop('qa', None); task.pop('qa_start', None)
        atomic_json(self.state, task)
        self.append({'type': 'retarget', 'task_id': task['task_id'], 'previous': previous,
                     'candidate': {'sha': sha, 'base_url': task['base_url']}, 'previous_qa_invalidated': True})

    def start_qa(self, task):
        task['qa_start'] = {**self.binding(task), 'identity': self.identity(task)}
        task['status'] = 'reviewing'; task.pop('qa', None)
        atomic_json(self.state, task)

    def finish_qa(self, task, verdict, report, checks):
        start = task.get('qa_start')
        if not start: raise ValueError('qa-start is required')
        binding = self.binding(task)
        if any(start[key] != binding[key] for key in binding): raise ValueError('source/spec changed during QA; restart QA')
        identity = self.identity(task)
        if identity != start['identity']: raise ValueError('QA environment identity changed')
        path = self.path(report)
        if not report.startswith('.harness/reports/') or not path.is_file(): raise ValueError('report must exist under .harness/reports/')
        row = {'type': 'qa', 'task_id': task['task_id'], 'verdict': verdict, 'tested_sha': git(self.root, 'rev-parse', 'HEAD'),
               **binding, 'identity': identity, 'report_path': report, 'report_hash': digest(path.read_bytes()),
               'checks': checks, 'changed_paths': self.changes(task)}
        self.append(row); task['qa'] = row; task['status'] = 'ready' if verdict == 'PASS' else 'active'
        atomic_json(self.state, task)

    def validate(self, task):
        qa = task.get('qa', {})
        if qa.get('verdict') != 'PASS': raise ValueError('no independent PASS is recorded')
        if any(qa.get(k) != v for k, v in self.binding(task).items()): raise ValueError('source/spec changed after QA; PASS is stale')
        if digest(self.path(qa['report_path']).read_bytes()) != qa['report_hash']: raise ValueError('QA report changed after verification')

    def archive(self, apply=False):
        task = self.read()
        if not task or task['status'] != 'complete': return {'archived': False, 'reason': 'no completed task'}
        self.validate(task); qa = task['qa']; source = self.path(qa['report_path'])
        target = self.root / '.harness/archive/tasks' / task['task_id'] / source.name
        if target.exists() and digest(target.read_bytes()) != qa['report_hash']: raise ValueError('archive target differs; refusing overwrite')
        if apply and not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + '.tmp'); temporary.write_bytes(source.read_bytes()); temporary.replace(target)
            self.append({'type': 'archive', 'task_id': task['task_id'], 'report_path': str(target.relative_to(self.root)), 'report_hash': qa['report_hash']})
        return {'archived': apply, 'target': str(target.relative_to(self.root)), 'original_preserved': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=os.environ.get('CLAUDE_PROJECT_DIR', '.'))
    sub = parser.add_subparsers(dest='command', required=True)
    init = sub.add_parser('init'); init.add_argument('--id', required=True); init.add_argument('--spec', required=True)
    init.add_argument('--base', default='origin/main'); init.add_argument('--validation', choices=['docs', 'full'], default='full')
    init.add_argument('--url'); init.add_argument('--sha')
    for name in ['show', 'fingerprint', 'qa-start', 'complete', 'stop']: sub.add_parser(name)
    target = sub.add_parser('retarget'); target.add_argument('--sha', required=True); target.add_argument('--url', required=True)
    qa = sub.add_parser('qa-finish'); qa.add_argument('--verdict', choices=['PASS', 'FAIL', 'BLOCKED'], required=True)
    qa.add_argument('--report', required=True); qa.add_argument('--check', action='append', required=True)
    status = sub.add_parser('status'); status.add_argument('value', choices=['active', 'awaiting_user'])
    archive = sub.add_parser('archive'); archive.add_argument('--apply', action='store_true')
    args = parser.parse_args(); ledger = Ledger(args.root)
    try:
        with ledger.lock():
            task = ledger.read()
            if args.command == 'init': ledger.init(args)
            elif args.command == 'show': print(json.dumps(task or {'status': 'no_active_task'}, ensure_ascii=False, indent=2))
            elif args.command == 'fingerprint': print(ledger.fingerprint())
            elif args.command == 'archive': print(json.dumps(ledger.archive(args.apply)))
            elif args.command == 'stop':
                if task and task['status'] in {'ready', 'complete'}: ledger.validate(task)
            elif not task: raise ValueError('no active task; run init first')
            elif args.command == 'retarget': ledger.retarget(task, args.sha, args.url)
            elif args.command == 'qa-start': ledger.start_qa(task)
            elif args.command == 'qa-finish': ledger.finish_qa(task, args.verdict, args.report, args.check)
            elif args.command == 'status': task['status'] = args.value; atomic_json(ledger.state, task)
            elif args.command == 'complete':
                ledger.validate(task)
                if ledger.identity(task) != task['qa']['identity']: raise ValueError('environment changed after QA')
                task['status'] = 'complete'; atomic_json(ledger.state, task)
                ledger.append({'type': 'task-complete', 'task_id': task['task_id'], 'qa': task['qa']})
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as exc:
        if args.command == 'stop':
            try: resumed = json.load(sys.stdin).get('stop_hook_active', False)
            except (ValueError, OSError): resumed = False
            if resumed:
                print(json.dumps({'systemMessage': '验收无效，任务尚未完成：' + str(exc)}, ensure_ascii=False)); return
            print('验收无效，不能声称完成：' + str(exc), file=sys.stderr); raise SystemExit(2)
        print(str(exc), file=sys.stderr); raise SystemExit(1)


if __name__ == '__main__': main()
