#!/usr/bin/env python3
"""Host scheduler: authenticated local calls with bounded waits and private status."""
import argparse
import fcntl
import json
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen


def business_ok(payload):
    if payload.get('success') is not True: return False
    data=payload.get('data', {})
    if not isinstance(data, dict): return False
    if any(isinstance(data.get(key), (int, float)) and data[key] > 0 for key in ['failed', 'markedFailed']): return False
    return all(row.get('ok') is True for row in data.get('results', []) if isinstance(row, dict))


def run(root, environment, mode):
    root=Path(root); token=''
    for line in (root/'.env').read_text().splitlines():
        if line.startswith('CRON_TOKEN='): token=line.split('=',1)[1].strip().strip("'\"")
    if not token: raise ValueError('CRON_TOKEN missing')
    routes=['weekly-insight'] if mode=='weekly' else ['release-submissions','sweep-stuck-jobs','sweep-stuck-ai-runs']
    port=3000 if environment=='production' else 3001
    output=[]
    with (root / ('.cron-'+mode+'.lock')).open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        for route in routes:
            ok=False
            try:
                request=Request(f'http://127.0.0.1:{port}/api/cron/{route}',headers={'x-cron-token':token})
                with urlopen(request,timeout=180) as response: ok=business_ok(json.load(response))
            except (OSError, ValueError):pass
            output.append({'route':route,'ok':ok})
        status={'at':datetime.now(timezone.utc).isoformat(),'results':output}
        path=root/('last-cron-'+mode+'.json');path.write_text(json.dumps(status)+'\n');path.chmod(0o600)
    if not all(row['ok'] for row in output):raise RuntimeError('scheduled business job failed; inspect private last-cron status')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('root');p.add_argument('environment',choices=['production','staging']);p.add_argument('mode',choices=['frequent','weekly']);a=p.parse_args();run(a.root,a.environment,a.mode)
