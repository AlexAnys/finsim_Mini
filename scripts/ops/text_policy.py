#!/usr/bin/env python3
"""Render environment defaults from the same text-only model policy as the app."""
import argparse
import json
from pathlib import Path
import re


def defaults(policy_path):
    policy=json.loads(Path(policy_path).read_text())
    if policy['provider']!='deepseek' or policy['fallbackProvider']!='deepseek':raise ValueError('unsupported text migration policy')
    result={'AI_PROVIDER':policy['provider'],'AI_FALLBACK_PROVIDER':policy['fallbackProvider'],'DEEPSEEK_MODEL':''}
    aliases={'simulationChat':'SIMULATION','simulation':'SIMULATION','simulationGrading':'EVALUATION','studyBuddy':'STUDY_BUDDY','importParse':'IMPORT'}
    for tool,model in policy['tools'].items():
        if model not in ['deepseek-v4-flash','deepseek-v4-pro']:raise ValueError('model needs a corresponding real deployment probe')
        prefix='AI_'+aliases.get(tool,re.sub(r'(?<!^)(?=[A-Z])','_',tool).upper())
        result[prefix+'_PROVIDER']=policy['provider'];result[prefix+'_MODEL']=model
        result[prefix+'_FALLBACK_PROVIDER']=policy['fallbackProvider'];result[prefix+'_FALLBACK_MODEL']=policy['fallbackModel']
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('policy');a=p.parse_args()
    for key,value in defaults(a.policy).items():print(key+'='+value)
