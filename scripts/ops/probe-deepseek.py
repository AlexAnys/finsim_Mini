#!/usr/bin/env python3
"""Bounded real completion probes against the official DeepSeek endpoint only."""
import argparse
from datetime import datetime, timezone
import json
import hashlib
import os
import tempfile
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, HTTPRedirectHandler, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise HTTPError(req.full_url, code, 'redirect blocked', headers, None)


# Verified official API aliases: https://api-docs.deepseek.com/quick_start/pricing/
# Keep the configured request and actual response distinct; never accept arbitrary prefixes.
MODEL_RESPONSES = {
    'deepseek-v4-flash': {'deepseek-v4-flash', 'deepseek-flash'},
    'deepseek-v4-pro': {'deepseek-v4-pro'},
}


def matches_model(requested, actual):
    return isinstance(actual, str) and actual in MODEL_RESPONSES.get(requested, set())


def read_env(path):
    values={}
    for line in Path(path).read_text().splitlines():
        if not line or line.lstrip().startswith('#') or '=' not in line:continue
        key,value=line.split('=',1);value=value.strip()
        if len(value)>1 and value[0] in "'\"" and value[-1]==value[0]:value=value[1:-1]
        values[key]=value
    return values


def probe(values, opener=None):
    base=values.get('DEEPSEEK_BASE_URL') or 'https://api.deepseek.com/v1'
    url=urlparse(base)
    if url.scheme!='https' or url.hostname!='api.deepseek.com' or url.port not in [None,443] or url.path.rstrip('/') not in ['', '/v1'] or url.username or url.password or url.query or url.fragment:
        raise ValueError('deployment requires the official HTTPS DeepSeek endpoint')
    key=values.get('DEEPSEEK_API_KEY')
    if not key:raise ValueError('DEEPSEEK_API_KEY is missing')
    client=opener or build_opener(NoRedirect())
    rows=[]
    for model in ['deepseek-v4-flash','deepseek-v4-pro']:
        row={'requestedModel':model,'ok':False}
        request=Request(base.rstrip('/')+'/chat/completions',method='POST',headers={'Content-Type':'application/json','Authorization':'Bearer '+key},data=json.dumps({
            'model':model,'messages':[{'role':'user','content':'只回复三个数字123。'}],
            'thinking':{'type':'disabled'},'temperature':0,'max_tokens':128,'stream':False,
        }).encode())
        try:
            with client.open(request,timeout=30) as response:
                result=json.load(response);actual=str(result.get('model',''))
                content=result.get('choices',[{}])[0].get('message',{}).get('content')
                row.update(httpStatus=response.getcode(),actualModel=actual,
                    ok=response.getcode()==200 and matches_model(model, actual) and isinstance(content,str) and bool(content.strip()),
                    outputTokens=result.get('usage',{}).get('completion_tokens'))
        except HTTPError as error:
            row['httpStatus']=error.code;error.close()
        except (OSError,ValueError,IndexError,TypeError):row['error']='completion_probe_failed'
        rows.append(row)
        if not row['ok']:break # no repeated failures or additional paid calls after failure
    return {'at':datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),'provider':'deepseek','officialEndpoint':True,
            'gitSha':values.get('APP_GIT_SHA'),'ok':len(rows)==2 and all(row['ok'] for row in rows),
            'models':[row['requestedModel'] for row in rows if row['ok']], 'probes':rows,
            'keySha256':hashlib.sha256(key.encode()).hexdigest(),'baseURL':base.rstrip('/')}


def fresh(result, values, seconds):
    try:
        age=(datetime.now(timezone.utc)-datetime.strptime(result['at'],'%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)).total_seconds()
        rows=result.get('probes', [])
        responses_valid=len(rows)==2 and {row.get('requestedModel') for row in rows}==set(MODEL_RESPONSES) and all(
            row.get('ok') is True and row.get('httpStatus')==200 and matches_model(row.get('requestedModel'), row.get('actualModel')) for row in rows)
        return responses_valid and seconds>0 and 0<=age<=seconds and result.get('ok') is True and set(result.get('models',[]))==set(MODEL_RESPONSES) and result.get('keySha256')==hashlib.sha256(values.get('DEEPSEEK_API_KEY','').encode()).hexdigest() and result.get('baseURL')==(values.get('DEEPSEEK_BASE_URL') or 'https://api.deepseek.com/v1').rstrip('/') and result.get('gitSha')==values.get('APP_GIT_SHA')
    except (ValueError,KeyError,TypeError,AttributeError):return False


def save_private(path, result):
    target=Path(path);descriptor,temporary=tempfile.mkstemp(prefix='.'+target.name+'-',dir=str(target.parent))
    try:
        with os.fdopen(descriptor,'w') as out:
            out.write(json.dumps(result)+'\n');out.flush();os.fsync(out.fileno())
        os.replace(temporary,str(target))
    finally:
        if os.path.exists(temporary):os.unlink(temporary)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('env_file');parser.add_argument('--output');parser.add_argument('--reuse-if-fresh',type=int,default=0);args=parser.parse_args()
    try:
        values=read_env(args.env_file);result=None
        if args.output and Path(args.output).exists():
            try:previous=json.loads(Path(args.output).read_text())
            except (ValueError,OSError):previous={}
            if fresh(previous,values,args.reuse_if_fresh):result=previous
        if result is None:result=probe(values)
    except (ValueError,OSError):result={'ok':False,'error':'official_deepseek_configuration_required'}
    if args.output:
        save_private(args.output,result)
    print(json.dumps({key:value for key,value in result.items() if key!='keySha256'}))
    sys.exit(0 if result['ok'] else 1)
