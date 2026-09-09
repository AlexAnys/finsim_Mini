#!/usr/bin/env python3
import argparse
import json
import time
from urllib.request import urlopen


def verify(url, sha, attempts=12, delay=5):
    for attempt in range(attempts):
        try:
            with urlopen(url.rstrip('/') + '/api/health/ready', timeout=8) as response:
                data=json.load(response).get('data', {})
            if data.get('ready') is True and data.get('app')=='finsim' and data.get('gitSha')==sha:
                return data
        except (OSError, ValueError): pass
        if attempt+1<attempts:time.sleep(delay)
    raise RuntimeError('expected FinSim revision is not database-ready')


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('url');p.add_argument('sha');a=p.parse_args()
    print(json.dumps(verify(a.url,a.sha)))
