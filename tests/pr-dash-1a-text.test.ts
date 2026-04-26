/**
 * PR-DASH-1a guards — 教师工作台 B1/B8/B9 文案/删除变更回归守护
 *
 * 守护点：
 * - B1: greeting-header.tsx 删两按钮（"AI 生成任务"+"新建任务"），不再 import lucide Sparkles/Plus / Link / Button
 * - B8: weak-instances.tsx h2 文案 "典型实例"（旧 "待分析实例" 已替换）
 * - B9: kpi-strip.tsx 4 列；旧 "班级均分" 删除；"待批改" → "需审核"；"待分析实例" → "典型实例"
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const greeting = readFileSync(
  resolve(root, "components/teacher-dashboard/greeting-header.tsx"),
  "utf8",
);
const weak = readFileSync(
  resolve(root, "components/teacher-dashboard/weak-instances.tsx"),
  "utf8",
);
const kpi = readFileSync(
  resolve(root, "components/teacher-dashboard/kpi-strip.tsx"),
  "utf8",
);

describe("PR-DASH-1a · B1 greeting-header buttons removed", () => {
  it("does not render '新建任务' button text", () => {
    expect(greeting).not.toMatch(/新建任务/);
  });

  it("does not render 'AI 生成任务' button text", () => {
    expect(greeting).not.toMatch(/AI 生成任务/);
  });

  it("does not import lucide Plus or Sparkles icons (used by removed buttons)", () => {
    expect(greeting).not.toMatch(/from\s+["']lucide-react["']/);
  });

  it("does not import next/link (was only used by removed buttons)", () => {
    expect(greeting).not.toMatch(/from\s+["']next\/link["']/);
  });

  it("does not import Button (was only used by removed buttons)", () => {
    expect(greeting).not.toMatch(/Button.*from\s+["']@\/components\/ui\/button["']/);
  });

  it("preserves '教学工作台' page title", () => {
    expect(greeting).toMatch(/教学工作台/);
  });

  it("preserves date-line + meta line (today + pendingGradeCount + publishedThisWeek)", () => {
    expect(greeting).toMatch(/{dateLine}/);
    expect(greeting).toMatch(/{todayClassCount}/);
    expect(greeting).toMatch(/{pendingGradeCount}/);
    expect(greeting).toMatch(/{publishedThisWeek}/);
  });
});

describe("PR-DASH-1a · B8 weak-instances renamed", () => {
  it("renders '典型实例' (renamed from '待分析实例')", () => {
    expect(weak).toMatch(/典型实例/);
  });

  it("does not contain old label '待分析实例'", () => {
    expect(weak).not.toMatch(/待分析实例/);
  });

  it("preserves WeakInstance behavior (按错误率排序 caption)", () => {
    expect(weak).toMatch(/按错误率排序/);
  });
});

describe("PR-DASH-1a · B9 kpi-strip 4-column layout", () => {
  it("uses 4-column grid (md:grid-cols-4 instead of lg:grid-cols-5)", () => {
    expect(kpi).toMatch(/md:grid-cols-4/);
    expect(kpi).not.toMatch(/lg:grid-cols-5/);
  });

  it("removes '班级均分' KpiCell label", () => {
    expect(kpi).not.toMatch(/label="班级均分"/);
  });

  it("renames '待批改' → '需审核'", () => {
    expect(kpi).toMatch(/label="需审核"/);
    expect(kpi).not.toMatch(/label="待批改"/);
  });

  it("renames '待分析实例' → '典型实例'", () => {
    expect(kpi).toMatch(/label="典型实例"/);
    expect(kpi).not.toMatch(/label="待分析实例"/);
  });

  it("preserves '在教班级' and '本周提交' labels (unchanged)", () => {
    expect(kpi).toMatch(/label="在教班级"/);
    expect(kpi).toMatch(/label="本周提交"/);
  });

  it("KpiStripData type retains avgScore/avgScoreDelta (PerformanceChart 仍依赖)", () => {
    expect(kpi).toMatch(/avgScore:\s*number\s*\|\s*null/);
    expect(kpi).toMatch(/avgScoreDelta:\s*number\s*\|\s*null/);
  });
});
