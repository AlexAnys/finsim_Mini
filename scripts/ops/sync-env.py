#!/usr/bin/env python3
"""Create a private candidate env file; preserve unspecified existing settings."""
import argparse
import os
from pathlib import Path
import re
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from text_policy import defaults


def sync(source, target, root, sha, environment, policy_path=None):
    lines = Path(source).read_text().splitlines()
    values = {}
    for line in lines:
        if line and not line.lstrip().startswith('#') and '=' in line:
            key, value = line.split('=', 1); values[key] = value
    allowed = {'CRON_TOKEN', 'AI_PROVIDER', 'AI_FALLBACK_PROVIDER', 
               'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL', 
               'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'GEMINI_API_KEY', 'GEMINI_BASE_URL', 'GEMINI_MODEL'}
    allowed.update(key for key in os.environ if re.fullmatch(r'AI_[A-Z_]+_(PROVIDER|MODEL|TIMEOUT_MS)', key))
    updates = {key: os.environ[key] for key in allowed if os.environ.get(key)}
    for value in updates.values():
        if '\n' in value or '\r' in value: raise ValueError('multiline runtime setting is not supported')
    previous_global=values.get('AI_PROVIDER','').strip().strip("'\"")
    policy_values=defaults(policy_path or Path(__file__).resolve().parents[2] / 'lib/ai/text-model-policy.json')
    def current(key):
        return updates.get(key, values.get(key, '')).strip().strip("'\"")
    # The user's text migration supersedes stale MiMo defaults, not media credentials.
    updates['AI_PROVIDER']=policy_values['AI_PROVIDER'];updates['AI_FALLBACK_PROVIDER']=policy_values['AI_FALLBACK_PROVIDER']
    updates['DEEPSEEK_MODEL']='' # per-feature defaults must not be shadowed by a global model
    for key,default in policy_values.items():
        if not key.endswith('_PROVIDER') or key in ['AI_PROVIDER','AI_FALLBACK_PROVIDER']:continue
        model_key=key[:-9]+'_MODEL'
        provider=current(key);model=current(model_key)
        if not provider and model and not model.startswith('mimo-') and previous_global not in ['', 'mimo', 'deepseek']:
            updates[key]=previous_global
            continue # retain the provider formerly implied by an explicit custom model
        if provider not in ['', 'mimo', 'deepseek']:
            continue # preserve an explicit non-MiMo custom provider/model pair
        if provider in ['', 'mimo']:updates[key]=default
        if provider=='mimo' or not model or model.startswith('mimo-') or model in ['deepseek-chat','deepseek-reasoner']:
            updates[model_key]=policy_values[model_key]
    updates.update(APP_GIT_SHA=sha, APP_ENV=environment, FINSIM_BUILD_CONTEXT=str(Path(root).resolve() / 'current'))
    if not current('CRON_TOKEN'): raise ValueError('CRON_TOKEN must be configured before deploying scheduled jobs')
    kept = [line for line in lines if line.split('=', 1)[0] not in updates]
    # Compose interpolates $ in unquoted values; single quotes preserve secrets literally.
    for key, value in updates.items():
        if "'" in value: raise ValueError('single quote in deployment setting is unsupported')
        kept.append(key + "='" + value + "'")
    destination=Path(target);destination.write_text('\n'.join(kept)+'\n');destination.chmod(0o600)


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['source','target','root','sha','environment']:p.add_argument(name)
    p.add_argument('--policy')
    a=p.parse_args();sync(a.source,a.target,a.root,a.sha,a.environment,a.policy)
