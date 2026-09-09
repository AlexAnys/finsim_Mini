"""Behavior fixtures for task evidence and clean release deployment (no network/DB)."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[3]

def load(name, path):
    spec=importlib.util.spec_from_file_location(name, ROOT/path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

state=load('task_state','.harness/scripts/task_state.py')
release=load('prepare_release','scripts/ops/prepare-release.py')
env=load('sync_env','scripts/ops/sync-env.py')
cron=load('pilot_cron','scripts/ops/cron.py')
probe=load('deepseek_probe','scripts/ops/probe-deepseek.py')

class TaskEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.git('init','-q','-b','audit-fixture');self.git('config','user.name','Test');self.git('config','user.email','test@example.invalid')
        (self.root/'.harness').mkdir();(self.root/'.harness/reports').mkdir()
        (self.root/'.harness/spec.md').write_text('Acceptance')
        (self.root/'app.ts').write_text('original')
        self.git('add','.');self.git('commit','-qm','base')
        self.ledger=state.Ledger(self.root)
        self.ledger.init(argparse.Namespace(id='task-a',spec='.harness/spec.md',base='HEAD',validation='docs',url=None,sha=None))
    def tearDown(self):self.temp.cleanup()
    def git(self,*args):return subprocess.check_output(['git','-C',str(self.root),*args]).decode().strip()
    def qa(self):
        self.ledger.start_qa(self.ledger.read())
        (self.root/'.harness/reports/qa.md').write_text('Actual evidence')
        self.ledger.finish_qa(self.ledger.read(),'PASS','.harness/reports/qa.md',['fixture passed'])
    def stop(self,active=False):
        return subprocess.run(['python3',str(ROOT/'.harness/scripts/task_state.py'),'--root',str(self.root),'stop'],input=json.dumps({'stop_hook_active':active}),text=True,capture_output=True)
    def test_new_and_committed_files_are_part_of_source_binding(self):
        before=self.ledger.fingerprint();(self.root/'new.ts').write_text('new')
        after=self.ledger.fingerprint();self.assertNotEqual(before,after)
        self.git('add','new.ts');self.git('commit','-qm','new')
        self.assertEqual(after,self.ledger.fingerprint())
        self.assertIn('new.ts',self.ledger.changes(self.ledger.read()))
    def test_source_change_during_qa_rejects_verdict(self):
        self.ledger.start_qa(self.ledger.read());(self.root/'app.ts').write_text('changed')
        (self.root/'.harness/reports/qa.md').write_text('evidence')
        with self.assertRaisesRegex(ValueError,'changed during QA'):
            self.ledger.finish_qa(self.ledger.read(),'PASS','.harness/reports/qa.md',['check'])
    def test_full_qa_requires_matching_head_and_no_dirty_source(self):
        task=self.ledger.read();task['validation']='full';task['expected_sha']='b'*40
        with self.assertRaisesRegex(ValueError,'HEAD does not match'):self.ledger.binding(task)
        task['expected_sha']=self.git('rev-parse','HEAD');(self.root/'app.ts').write_text('uncommitted')
        with self.assertRaisesRegex(ValueError,'not frozen'):self.ledger.binding(task)
    def test_manual_dispatch_forces_full_checks_even_without_a_diff(self):
        head=self.git('rev-parse','HEAD');self.git('update-ref','refs/remotes/origin/main',head)
        event=self.root/'event.json';event.write_text('{}')
        result=subprocess.check_output(['python3',str(ROOT/'.github/scripts/change_policy.py'),'--repo',str(self.root),'--event',str(event)],env={**os.environ,'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_SHA':head})
        self.assertFalse(json.loads(result)['docs_only'])
    def test_report_only_change_does_not_change_source_hash(self):
        before=self.ledger.fingerprint();self.qa();self.assertEqual(before,self.ledger.fingerprint())
        self.ledger.validate(self.ledger.read())
    def test_no_task_and_discussion_never_block(self):
        (self.root/'app.ts').write_text('work in progress')
        self.assertEqual(self.stop().returncode,0)
        self.ledger.state.unlink();self.assertEqual(self.stop().returncode,0)
    def test_stale_pass_blocks_once_and_does_not_loop(self):
        self.qa();(self.root/'new.ts').write_text('change after QA')
        self.assertEqual(self.stop().returncode,2)
        second=self.stop(True);self.assertEqual(second.returncode,0)
        self.assertIn('systemMessage',second.stdout)
    def test_spec_and_report_changes_invalidate_pass(self):
        self.qa();(self.root/'.harness/reports/qa.md').write_text('rewritten verdict')
        with self.assertRaisesRegex(ValueError,'report changed'):self.ledger.validate(self.ledger.read())
    def test_retarget_preserves_history_and_invalidates_previous_qa(self):
        self.qa();old=self.ledger.read();old_sha=old['expected_sha']
        with self.assertRaisesRegex(ValueError,'never rebind a PASS'):
            self.ledger.retarget(old,old_sha,'http://localhost:3107')
        old['status']='active';state.atomic_json(self.ledger.state,old)
        (self.root/'app.ts').write_text('r2');self.git('add','app.ts');self.git('commit','-qm','r2')
        new_sha=self.git('rev-parse','HEAD')
        self.ledger.retarget(self.ledger.read(),new_sha,'http://localhost:3107')
        current=self.ledger.read();self.assertEqual(current['expected_sha'],new_sha)
        self.assertNotIn('qa',current);self.assertNotIn('qa_start',current)
        with self.assertRaisesRegex(ValueError,'no independent PASS'):self.ledger.validate(current)
        rows=[json.loads(line) for line in self.ledger.records.read_text().splitlines()]
        self.assertTrue(any(row.get('type')=='qa' for row in rows))
        self.assertEqual(rows[-1]['previous']['sha'],old_sha);self.assertEqual(rows[-1]['candidate']['sha'],new_sha)
    def test_retarget_rejects_dirty_source_or_noncurrent_sha(self):
        task=self.ledger.read();sha=self.git('rev-parse','HEAD')
        with self.assertRaisesRegex(ValueError,'current full HEAD'):
            self.ledger.retarget(task,'b'*40,'http://localhost:3107')
        (self.root/'new.ts').write_text('not committed')
        with self.assertRaisesRegex(ValueError,'commit source'):
            self.ledger.retarget(task,sha,'http://localhost:3107')
    def test_wrong_environment_identity_is_rejected(self):
        task=self.ledger.read();task.update(base_url='http://test.invalid',expected_sha='a'*40)
        with patch.object(state,'urlopen',return_value=io.StringIO(json.dumps({'data':{'app':'other','gitSha':'a'*40}}))):
            with self.assertRaisesRegex(ValueError,'not FinSim'):self.ledger.identity(task)
    def test_archive_preserves_original_and_legacy_history(self):
        legacy=self.root/'.harness/progress.tsv';legacy.write_text('bad\told\tline\n')
        self.assertFalse(self.ledger.archive(True)['archived']);self.qa()
        task=self.ledger.read();task['status']='complete';state.atomic_json(self.ledger.state,task)
        result=self.ledger.archive(True)
        self.assertTrue((self.root/result['target']).exists());self.assertTrue((self.root/'.harness/reports/qa.md').exists())
        self.assertEqual(legacy.read_text(),'bad\told\tline\n')
        (self.root/result['target']).write_text('do not overwrite')
        with self.assertRaisesRegex(ValueError,'refusing overwrite'):self.ledger.archive(True)
    def test_locked_parallel_ledger_appends_remain_parseable(self):
        def append(i):
            with self.ledger.lock():self.ledger.append({'type':'fixture','n':i,'description':'tab\tnewline\n'})
        with ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(append,range(40)))
        rows=[json.loads(line) for line in self.ledger.records.read_text().splitlines()]
        self.assertEqual({r['n'] for r in rows if r['type']=='fixture'},set(range(40)))

class ReleaseTests(unittest.TestCase):
    def setUp(self):self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
    def tearDown(self):self.temp.cleanup()
    def tar(self,name,files):
        path=self.root/name
        with tarfile.open(path,'w:gz') as out:
            for name,content in files.items():
                member=tarfile.TarInfo(name);member.size=len(content);out.addfile(member,io.BytesIO(content))
        return path
    def test_deleted_source_does_not_survive_next_release(self):
        first=release.prepare(self.root,self.tar('one.tgz',{'app.ts':b'old','obsolete.ts':b'delete me'}),'a'*40)
        second=release.prepare(self.root,self.tar('two.tgz',{'app.ts':b'new'}),'b'*40)
        self.assertTrue((first/'obsolete.ts').exists());self.assertFalse((second/'obsolete.ts').exists())
        self.assertEqual((second/'app.ts').read_text(),'new')
    def test_archive_rejects_path_escape_and_different_same_sha(self):
        with self.assertRaisesRegex(ValueError,'unsafe'):release.prepare(self.root,self.tar('bad.tgz',{'../escape':b'x'}),'a'*40)
        release.prepare(self.root,self.tar('one.tgz',{'app.ts':b'1'}),'a'*40)
        with self.assertRaisesRegex(ValueError,'differs'):release.prepare(self.root,self.tar('two.tgz',{'app.ts':b'2'}),'a'*40)
    def test_env_migrates_text_preserves_media_and_quotes_secret_dollars(self):
        source=self.root/'old.env';target=self.root/'new.env'
        source.write_text('AI_PROVIDER=mimo\nAI_SIMULATION_MODEL=mimo-current\nAUTH_SECRET=existing\nMIMO_API_KEY=media-existing\nOCR_PROVIDER=qwen\n')
        with patch.dict(os.environ,{'CRON_TOKEN':'token$literal','AI_QUIZ_GRADE_PROVIDER':'qwen','AI_QUIZ_GRADE_MODEL':'qwen-custom','MIMO_API_KEY':'must-not-replace-media'},clear=True):
            env.sync(source,target,self.root,'a'*40,'staging')
        result=target.read_text();self.assertIn("AI_PROVIDER='deepseek'",result)
        self.assertIn("AI_SIMULATION_MODEL='deepseek-v4-flash'",result);self.assertIn('MIMO_API_KEY=media-existing',result);self.assertIn('OCR_PROVIDER=qwen',result);self.assertIn("AI_QUIZ_GRADE_PROVIDER='qwen'",result);self.assertIn("CRON_TOKEN='token$literal'",result)
        self.assertEqual(target.stat().st_mode & 0o777,0o600)
    def test_cron_distinguishes_business_failure_from_http_success(self):
        self.assertFalse(cron.business_ok({'success':True,'data':{'failed':1,'markedFailed':2}}))
        self.assertFalse(cron.business_ok({'success':True,'data':{'results':[{'ok':False}]}}))
        self.assertTrue(cron.business_ok({'success':True,'data':{'failed':0,'results':[{'ok':True,'skipped':True}]}}))
    def test_explicit_model_keeps_its_previously_inherited_non_mimo_provider(self):
        source=self.root/'old.env';target=self.root/'new.env'
        source.write_text('AI_PROVIDER=openai\nAI_QUIZ_GRADE_MODEL=gpt-custom\nCRON_TOKEN=fixture\n')
        with patch.dict(os.environ,{},clear=True):env.sync(source,target,self.root,'a'*40,'staging')
        result=target.read_text();self.assertIn("AI_PROVIDER='deepseek'",result)
        self.assertIn("AI_QUIZ_GRADE_PROVIDER='openai'",result);self.assertIn('AI_QUIZ_GRADE_MODEL=gpt-custom',result)
    def test_missing_cron_token_fails_before_runtime_mutation(self):
        source=self.root/'old.env';target=self.root/'new.env';source.write_text('AUTH_SECRET=existing\n')
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaisesRegex(ValueError,'CRON_TOKEN'):env.sync(source,target,self.root,'a'*40,'staging')
        self.assertFalse(target.exists());self.assertEqual(source.read_text(),'AUTH_SECRET=existing\n')

class DeepSeekProbeTests(unittest.TestCase):
    def test_real_generation_contract_requires_both_models_and_binds_key(self):
        class Response(io.StringIO):
            def getcode(self):return 200
        class Client:
            def __init__(self):self.calls=[]
            def open(self,request,timeout):
                body=json.loads(request.data);self.calls.append(body)
                return Response(json.dumps({'model':body['model'],'choices':[{'message':{'content':'123'}}],'usage':{'completion_tokens':1}}))
        client=Client();values={'DEEPSEEK_API_KEY':'fixture-secret','APP_GIT_SHA':'a'*40}
        result=probe.probe(values,client)
        self.assertTrue(result['ok']);self.assertEqual(len(client.calls),2)
        self.assertEqual(set(result['models']),{'deepseek-v4-flash','deepseek-v4-pro'})
        self.assertTrue(probe.fresh(result,values,300))
        self.assertFalse(probe.fresh(result,{**values,'DEEPSEEK_API_KEY':'different'},300))
        self.assertNotIn('fixture-secret',json.dumps(result))
    def test_probe_write_replaces_corrupt_content_privately(self):
        with tempfile.TemporaryDirectory() as directory:
            target=Path(directory)/'proof.json';target.write_text('corrupt')
            probe.save_private(target,{'ok':True})
            self.assertEqual(json.loads(target.read_text()),{'ok':True})
            self.assertEqual(target.stat().st_mode & 0o777,0o600)
            self.assertEqual(list(Path(directory).iterdir()),[target])
    def test_mock_or_gateway_cannot_satisfy_deployment_gate(self):
        with self.assertRaisesRegex(ValueError,'official HTTPS'):
            probe.probe({'DEEPSEEK_API_KEY':'fixture','DEEPSEEK_BASE_URL':'http://127.0.0.1:3189/v1'})
    def test_provider_failure_is_not_retried_or_marked_success(self):
        from urllib.error import HTTPError
        class Client:
            def open(self,*args,**kwargs):raise HTTPError('https://api.deepseek.com',401,'private',{},None)
        result=probe.probe({'DEEPSEEK_API_KEY':'fixture'},Client())
        self.assertFalse(result['ok']);self.assertEqual(len(result['probes']),1)
        self.assertEqual(result['probes'][0]['httpStatus'],401)

if __name__=='__main__':unittest.main()
