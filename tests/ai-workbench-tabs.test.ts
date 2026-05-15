import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Unit B1 r1a · AI 工作台 Tabs 容器 + sidebar 整合
 * 静态源结构测试（与 A1/A2/C1-B 同模式）
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Unit B1 r1a · /teacher/ai-workbench 单页容器", () => {
  it("page.tsx 存在 + 引入 UsageTab / SettingsTab + Suspense 包裹", () => {
    const src = readFile("app/teacher/ai-workbench/page.tsx");
    expect(src).toContain('UsageTab } from "@/components/ai-workbench/usage-tab"');
    expect(src).toContain('SettingsTab } from "@/components/ai-workbench/settings-tab"');
    expect(src).toContain("Tabs, TabsContent, TabsList, TabsTrigger");
    expect(src).toContain("Suspense");
  });

  it("URL ?tab= 同步：useSearchParams + router.replace + 默认 usage", () => {
    const src = readFile("app/teacher/ai-workbench/page.tsx");
    expect(src).toContain("useSearchParams");
    expect(src).toContain("useRouter");
    expect(src).toMatch(/router\.replace\(`\?\$\{params\.toString\(\)\}`/);
    expect(src).toContain('DEFAULT_TAB: WorkbenchTab = "usage"');
    expect(src).toContain("isWorkbenchTab");
  });

  it("Tabs 含 usage + settings 两个 trigger 含 data-tab 标记 + 中文 label", () => {
    const src = readFile("app/teacher/ai-workbench/page.tsx");
    expect(src).toContain('data-tab="usage"');
    expect(src).toContain('data-tab="settings"');
    expect(src).toMatch(/<TabsTrigger value="usage"/);
    expect(src).toMatch(/<TabsTrigger value="settings"/);
    expect(src).toContain("用量");
    expect(src).toContain("设置");
  });
});

describe("Unit B1 r1a · 旧路径 thin redirect wrappers", () => {
  it("ai-usage 旧路径改为 server redirect → /teacher/ai-workbench?tab=usage", () => {
    const src = readFile("app/teacher/ai-usage/page.tsx");
    expect(src).toContain('redirect } from "next/navigation"');
    expect(src).toContain('redirect("/teacher/ai-workbench?tab=usage")');
    expect(src).not.toContain('"use client"'); // server component
    // 旧业务逻辑已搬走
    expect(src).not.toContain("aggregateByFeature");
    expect(src).not.toContain("FEATURE_LABEL");
  });

  it("ai-settings 旧路径改为 server redirect → /teacher/ai-workbench?tab=settings", () => {
    const src = readFile("app/teacher/ai-settings/page.tsx");
    expect(src).toContain('redirect } from "next/navigation"');
    expect(src).toContain('redirect("/teacher/ai-workbench?tab=settings")');
    expect(src).not.toContain('"use client"');
    expect(src).not.toContain("ToolSetting");
    expect(src).not.toContain("testConnection");
  });
});

describe("Unit B1 r1a · 抽离的 tab 组件", () => {
  it("UsageTab 组件存在 + export named + 保留聚合卡 / 调用明细 / 功能筛选", () => {
    const src = readFile("components/ai-workbench/usage-tab.tsx");
    expect(src).toContain("export function UsageTab");
    expect(src).toContain("aggregateByFeature");
    expect(src).toContain("FEATURE_LABEL");
    expect(src).toContain("功能筛选");
    // 保留 fetch /api/lms/ai-usage 不动 endpoint
    expect(src).toContain('"/api/lms/ai-usage"');
  });

  it("SettingsTab 组件存在 + export named + 保留 testConnection / save 流程", () => {
    const src = readFile("components/ai-workbench/settings-tab.tsx");
    expect(src).toContain("export function SettingsTab");
    expect(src).toContain("function testConnection");
    expect(src).toContain("async function save");
    expect(src).toContain('"/api/ai/tool-settings"');
    expect(src).toContain('"/api/ai/tool-settings/test-connection"');
    // testResult state 本地（unmount 自动清）
    expect(src).toContain("setTestResult");
  });
});

describe("Unit B1 r1a · sidebar 改动 9 → 7", () => {
  it("teacherNav 含 AI 工作台 入口 + 不再含 AI 用量/AI 设置/学生提问", () => {
    const src = readFile("components/sidebar.tsx");
    expect(src).toContain('label: "AI 工作台", href: "/teacher/ai-workbench"');
    // 删除项
    expect(src).not.toMatch(/label:\s*"AI 用量"/);
    expect(src).not.toMatch(/label:\s*"AI 设置"/);
    expect(src).not.toMatch(/label:\s*"学生提问"/);
  });

  it("teacherNav 总数 7（含 AI 工作台），lucide 不再 import 已不用的 icon", () => {
    const src = readFile("components/sidebar.tsx");
    // 7 entries: 仪表盘/课程管理/数据洞察/课表管理/班级管理/AI 助手/AI 工作台
    const labels = ["仪表盘", "课程管理", "数据洞察", "课表管理", "班级管理", "AI 助手", "AI 工作台"];
    for (const label of labels) {
      expect(src).toContain(`label: "${label}"`);
    }
    // 清理已不用的 import
    expect(src).not.toMatch(/\bMessageSquareText\b/);
    expect(src).not.toMatch(/\bActivity\b/);
    // Settings2 也已移除（仅在删除的 AI 设置 nav 中用过）
    expect(src).not.toMatch(/\bSettings2\b/);
  });
});
