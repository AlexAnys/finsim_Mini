import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { migrateTextAiSettings, migrationPlan, restoreTextAiSettings } from "@/scripts/ops/migrate-text-ai-settings.mjs";
import policy from "@/lib/ai/text-model-policy.json";
import { FEATURE_TOOL_KEYS, getProviderForFeature } from "@/lib/services/ai.service";
import { AI_TOOL_DEFINITIONS } from "@/lib/services/ai-tool-settings.service";
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, open: vi.fn(actual.open) };
});
const originalEnv = { ...process.env };
let directory: string;
let probe: string;
const initial = () => [
  {id:"text-1",teacherId:"private-user",toolKey:"simulationChat",provider:"mimo",model:"mimo-v2.5-pro",systemPromptSuffix:"保留教师要求",thinking:"enabled",temperature:0.7,updatedAt:new Date("2026-09-01")},
  {id:"text-2",teacherId:"private-user",toolKey:"simulationGrading",provider:"mimo",model:"mimo-v2.5",systemPromptSuffix:"保留评分要求",thinking:"disabled",temperature:0.2,updatedAt:new Date("2026-09-01")},
  {id:"ocr",teacherId:"private-user",toolKey:"ocr",provider:"mimo",model:"mimo-v2-omni",systemPromptSuffix:"",thinking:"disabled",temperature:0.2,updatedAt:new Date("2026-09-01")},
  {id:"custom",teacherId:"private-user",toolKey:"quizGrade",provider:"qwen",model:"qwen3-max",systemPromptSuffix:"",thinking:"disabled",temperature:0.2,updatedAt:new Date("2026-09-01")},
];
function fakeClient(rows = initial()) {
  const updateMany=vi.fn(async (args) => {
    const row=rows.find((row)=>row.id===args.where.id && row.provider===args.where.provider && row.model===args.where.model && row.updatedAt.getTime()===new Date(args.where.updatedAt).getTime());
    if(!row)return{count:0};Object.assign(row,args.data,{updatedAt:new Date(row.updatedAt.getTime()+1000)});return{count:1};
  });
  const client={ aiToolSetting: { findMany:vi.fn(async()=>structuredClone(rows)), updateMany, findUnique:vi.fn(async(args)=>structuredClone(rows.find((row)=>row.id===args.where.id))) },
    $transaction:vi.fn(async(callback)=>{const before=structuredClone(rows);try{return await callback(client);}catch(error){rows.splice(0,rows.length,...before);throw error;}}) };
  return{client,rows};
}
beforeEach(async()=>{
  vi.mocked(open).mockReset().mockImplementation((await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises")).open);
  delete process.env.APP_GIT_SHA;
  directory=await mkdtemp(join(tmpdir(),"finsim-ai-migration-"));probe=join(directory,"probe.json");
  for(const key of Object.keys(process.env))if(/^(AI_|MIMO_|QWEN_|DEEPSEEK_|GEMINI_|OPENAI_)/.test(key))delete process.env[key];
  process.env.DEEPSEEK_API_KEY="dummy-probe-key";
  await writeFile(probe,JSON.stringify({ok:true,models:["deepseek-v4-flash","deepseek-v4-pro"],baseURL:"https://api.deepseek.com/v1",at:new Date().toISOString(),keySha256:createHash("sha256").update(process.env.DEEPSEEK_API_KEY).digest("hex")}));
});
afterEach(async()=>{process.env={...originalEnv};await rm(directory,{recursive:true,force:true});});

describe("DeepSeek text migration",()=>{
  it("shares feature defaults with all teacher tool definitions",()=>{
    for(const [feature,tool]of Object.entries(FEATURE_TOOL_KEYS)){
      const resolved=getProviderForFeature(feature as keyof typeof FEATURE_TOOL_KEYS);
      expect(resolved.provider.name).toBe("deepseek");
      expect(resolved.model).toBe(policy.tools[tool as keyof typeof policy.tools]);
    }
    for(const tool of AI_TOOL_DEFINITIONS)expect(tool.defaultModel).toBe(policy.tools[tool.key as keyof typeof policy.tools]);
    expect(Object.keys(policy.tools)).not.toEqual(expect.arrayContaining(["ocr","speechToText"]));
  });
  it("dry-runs without DB writes and optionally creates a private review backup",async()=>{
    const{client,rows}=fakeClient();expect(migrationPlan(rows)).toHaveLength(2);
    expect(await migrateTextAiSettings(client)).toMatchObject({dryRun:true,planned:2,changed:0});
    const result=await migrateTextAiSettings(client,{backupDir:directory});
    expect(client.$transaction).not.toHaveBeenCalled();
    expect((await stat(result.backupPath!)).mode&0o777).toBe(0o600);
    expect(JSON.parse(await readFile(result.backupPath!,"utf8")).rows[0].systemPromptSuffix).toBe("保留教师要求");
  });
  it("backs up before applying, preserves non-routing fields and is idempotent",async()=>{
    const{client,rows}=fakeClient();
    const result=await migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe});
    expect(result.changed).toBe(2);
    expect(rows[0]).toMatchObject({provider:"deepseek",model:"deepseek-v4-flash",systemPromptSuffix:"保留教师要求",thinking:"enabled",temperature:0.7});
    expect(rows[1].model).toBe("deepseek-v4-pro");expect(rows[2].provider).toBe("mimo");expect(rows[3].provider).toBe("qwen");
    expect((await stat(directory)).mode&0o777).toBe(0o700);
    expect((await stat(result.receiptPath!)).mode&0o777).toBe(0o600);
    expect(await migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe})).toMatchObject({planned:0,changed:0});
  });
  it("requires a fresh successful real-probe proof before applying",async()=>{
    const{client}=fakeClient();await writeFile(probe,JSON.stringify({ok:false}));
    await expect(migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe})).rejects.toThrow();
    expect(client.$transaction).not.toHaveBeenCalled();expect(await readdir(directory)).toEqual(["probe.json"]);
  });
  it("binds the proof to the active endpoint, not only the key",async()=>{
    const{client}=fakeClient();process.env.DEEPSEEK_BASE_URL="http://127.0.0.1:3189/v1";
    await expect(migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe})).rejects.toThrow();
    expect(client.$transaction).not.toHaveBeenCalled();
  });
  it("binds an apply proof to APP_GIT_SHA when a candidate SHA is set",async()=>{
    const{client}=fakeClient();process.env.APP_GIT_SHA="a".repeat(40);
    const current=JSON.parse(await readFile(probe,"utf8"));
    await writeFile(probe,JSON.stringify({...current,gitSha:"b".repeat(40)}));
    await expect(migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe})).rejects.toThrow();
    expect(client.$transaction).not.toHaveBeenCalled();
    await writeFile(probe,JSON.stringify({...current,gitSha:process.env.APP_GIT_SHA}));
    expect(await migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe})).toMatchObject({changed:2});
  });
  it("does not commit if synchronizing the receipt's parent directory fails",async()=>{
    const{client,rows}=fakeClient();
    const rawOpen=(await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises")).open;
    let directorySyncs=0;
    vi.mocked(open).mockImplementation(async(...args)=>{
      const handle=await rawOpen(...args);
      if(args[0]===directory && args[1]==="r") {
        const sync=handle.sync.bind(handle);
        handle.sync=async()=>{directorySyncs++;if(directorySyncs===2)throw new Error("receipt directory fsync failed");await sync();};
      }
      return handle;
    });
    await expect(migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe})).rejects.toThrow("receipt directory fsync failed");
    expect(directorySyncs).toBe(2);
    expect(rows[0].provider).toBe("mimo");expect(rows[1].provider).toBe("mimo");
  });
  it("rolls the whole migration back if a source setting changed after backup",async()=>{
    const{client,rows}=fakeClient();client.aiToolSetting.updateMany.mockResolvedValueOnce({count:0});
    await expect(migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe})).rejects.toThrow("changed after backup");
    expect(rows[0].provider).toBe("mimo");expect(rows[1].provider).toBe("mimo");
  });
  it("restores only its own unchanged migrated rows, preserving a teacher's later edit",async()=>{
    const{client,rows}=fakeClient();const receiptPath=join(directory,"fixed-receipt.json");const migration=await migrateTextAiSettings(client,{apply:true,backupDir:directory,probeResult:probe,receiptPath});
    expect(migration.receiptPath).toBe(receiptPath);
    rows[1].systemPromptSuffix="教师后来修改";rows[1].updatedAt=new Date(rows[1].updatedAt.getTime()+1000);
    expect(await restoreTextAiSettings(client,migration.receiptPath!)).toEqual({restored:1,skipped:1});
    expect(rows[0].provider).toBe("mimo");expect(rows[1]).toMatchObject({provider:"deepseek",systemPromptSuffix:"教师后来修改"});
  });
});
