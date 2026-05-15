import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Unit C1-B · r1a · usePersistedJob hook
 * - 静态源测试（与项目内 pr-sim-bug-fix-leak.test.ts 同模式）
 * - 运行时纯函数测试（buildPersistKey / clearPersistedJob / readActiveTool / writeActiveTool）
 *   通过临时给 globalThis 桩入 localStorage + window 实现 node 环境运行
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

function createMockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  } as Storage;
}

interface WindowStub {
  localStorage: Storage;
  addEventListener: () => void;
  removeEventListener: () => void;
}

describe("Unit C1-B r1a · usePersistedJob 源结构", () => {
  it("hook 文件存在并 export 关键 API", () => {
    const src = readFile("lib/hooks/use-persisted-job.ts");
    expect(src).toContain("export function usePersistedJob");
    expect(src).toContain("export function buildPersistKey");
    expect(src).toContain("export function clearPersistedJob");
    expect(src).toContain("export function readActiveTool");
    expect(src).toContain("export function writeActiveTool");
    expect(src).toContain('PERSIST_KEY_PREFIX = "aiAssistant.lastJob."');
    expect(src).toContain('ACTIVE_TOOL_KEY = "aiAssistant.activeTool"');
  });

  it("hook 包含 24h TTL + schemaVersion + storage event 同步", () => {
    const src = readFile("lib/hooks/use-persisted-job.ts");
    expect(src).toMatch(/TTL_MS\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    expect(src).toContain("schemaVersion: 1");
    expect(src).toMatch(/window\.addEventListener\("storage"/);
    expect(src).toMatch(/Date\.now\(\)\s*-\s*obj\.savedAt\s*>\s*TTL_MS/);
  });

  it("hook 容错：SSR 安全（typeof window === \"undefined\" 全分支）", () => {
    const src = readFile("lib/hooks/use-persisted-job.ts");
    const matches = src.match(/typeof window === "undefined"/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});

describe("Unit C1-B r1a · usePersistedJob 运行时（mock storage）", () => {
  let originalWindow: unknown;
  let originalLocalStorage: unknown;

  beforeEach(() => {
    originalWindow = (globalThis as { window?: unknown }).window;
    originalLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    const storage = createMockStorage();
    const win: WindowStub = {
      localStorage: storage,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as unknown as { window: WindowStub }).window = win;
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { localStorage?: unknown }).localStorage = originalLocalStorage;
  });

  it("buildPersistKey 含 toolKey", async () => {
    const mod = await import("@/lib/hooks/use-persisted-job");
    expect(mod.buildPersistKey("lessonPolish")).toBe("aiAssistant.lastJob.lessonPolish");
    expect(mod.buildPersistKey("examCheck")).toBe("aiAssistant.lastJob.examCheck");
  });

  it("clearPersistedJob 删指定 toolKey，不影响其他", async () => {
    const mod = await import("@/lib/hooks/use-persisted-job");
    const storage = (globalThis as { localStorage: Storage }).localStorage;
    storage.setItem(mod.buildPersistKey("lessonPolish"), "x");
    storage.setItem(mod.buildPersistKey("examCheck"), "y");
    mod.clearPersistedJob("lessonPolish");
    expect(storage.getItem(mod.buildPersistKey("lessonPolish"))).toBeNull();
    expect(storage.getItem(mod.buildPersistKey("examCheck"))).toBe("y");
  });

  it("readActiveTool 返回 null 当无值，writeActiveTool 写入后能读回", async () => {
    const mod = await import("@/lib/hooks/use-persisted-job");
    expect(mod.readActiveTool()).toBeNull();
    mod.writeActiveTool("ideologyMining");
    expect(mod.readActiveTool()).toBe("ideologyMining");
  });

  it("readActiveTool 拒绝非法值", async () => {
    const mod = await import("@/lib/hooks/use-persisted-job");
    const storage = (globalThis as { localStorage: Storage }).localStorage;
    storage.setItem(mod.ACTIVE_TOOL_KEY, "notARealTool");
    expect(mod.readActiveTool()).toBeNull();
  });
});
