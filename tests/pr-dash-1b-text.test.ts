/**
 * PR-DASH-1b guards — 教师工作台 B2/B4 文案 + 布局变更回归守护
 *
 * 守护点：
 * - B2: AiSuggestCallout 加 variant="header-chip"；文案 "查看洞察" → "一周洞察"
 * - B2: GreetingHeader 内 import + 渲染 AiSuggestCallout chip（占据原右上区域）
 * - B2: dashboard page.tsx 删除右下角原 <AiSuggestCallout />
 * - B4: today-schedule.tsx 标题 "今日课表" → "近期课表"；不再 import dayLabel；TeacherUpcomingSlot 类型
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const aiCallout = readFileSync(
  resolve(root, "components/teacher-dashboard/ai-suggest-callout.tsx"),
  "utf8",
);
const greeting = readFileSync(
  resolve(root, "components/teacher-dashboard/greeting-header.tsx"),
  "utf8",
);
const dashboard = readFileSync(
  resolve(root, "app/teacher/dashboard/page.tsx"),
  "utf8",
);
const todaySchedule = readFileSync(
  resolve(root, "components/teacher-dashboard/today-schedule.tsx"),
  "utf8",
);

describe("PR-DASH-1b · B2 AiSuggestCallout chip variant", () => {
  it("declares header-chip variant in props type", () => {
    expect(aiCallout).toMatch(/variant\?:\s*"callout"\s*\|\s*"header-chip"/);
  });

  it("renames AiSuggestCallout '查看洞察' → '一周洞察' (both variants)", () => {
    expect(aiCallout).toMatch(/一周洞察/);
    // Only checking AiSuggestCallout file — weak-instances 查看洞察 is in B6 scope
    expect(aiCallout).not.toMatch(/查看洞察/);
  });

  it("preserves big-card variant 'AI 助手 · 本周建议' label", () => {
    expect(aiCallout).toMatch(/AI 助手/);
    expect(aiCallout).toMatch(/本周建议/);
  });

  it("preserves variant default = 'callout' (not breaking existing call sites)", () => {
    expect(aiCallout).toMatch(/variant\s*=\s*"callout"/);
  });
});

describe("PR-DASH-1b · B2 GreetingHeader renders AiSuggestCallout chip", () => {
  it("imports AiSuggestCallout", () => {
    expect(greeting).toMatch(
      /import\s*{\s*AiSuggestCallout\s*}\s*from\s*["']@\/components\/teacher-dashboard\/ai-suggest-callout["']/,
    );
  });

  it("renders AiSuggestCallout with variant='header-chip'", () => {
    expect(greeting).toMatch(/<AiSuggestCallout\s+variant=["']header-chip["']\s*\/>/);
  });

  it("preserves '教学工作台' page title", () => {
    expect(greeting).toMatch(/教学工作台/);
  });
});

describe("PR-DASH-1b · B2 dashboard page no longer renders bottom-right AiSuggestCallout", () => {
  it("does not import AiSuggestCallout (now nested in GreetingHeader)", () => {
    expect(dashboard).not.toMatch(/from\s+["']@\/components\/teacher-dashboard\/ai-suggest-callout["']/);
  });

  it("does not render <AiSuggestCallout /> directly in dashboard page", () => {
    expect(dashboard).not.toMatch(/<AiSuggestCallout\s*\/>/);
  });
});

describe("PR-DASH-1b · B4 TodaySchedule renamed to '近期课表'", () => {
  it("renders '近期课表' (renamed from '今日课表')", () => {
    expect(todaySchedule).toMatch(/近期课表/);
  });

  it("does not contain old label '今日课表'", () => {
    expect(todaySchedule).not.toMatch(/今日课表/);
  });

  it("uses TeacherUpcomingSlot type (not the old TeacherTodaySlot)", () => {
    expect(todaySchedule).toMatch(/TeacherUpcomingSlot/);
  });

  it("removes dayLabel prop from props interface", () => {
    // ensure no `dayLabel:` field nor `dayLabel}` reference (dateLabel is fine)
    expect(todaySchedule).not.toMatch(/\bdayLabel\b/);
  });

  it("renders dateLabel + weekdayLabel + startTime in each slot row", () => {
    expect(todaySchedule).toMatch(/dateLabel/);
    expect(todaySchedule).toMatch(/weekdayLabel/);
    expect(todaySchedule).toMatch(/startTime/);
  });

  it("preserves classroom display when present", () => {
    expect(todaySchedule).toMatch(/classroom/);
  });
});

describe("PR-DASH-1b · B4 dashboard page uses buildUpcomingSchedule", () => {
  it("imports buildUpcomingSchedule", () => {
    expect(dashboard).toMatch(/buildUpcomingSchedule/);
  });

  it("does not import buildTodaySchedule (replaced)", () => {
    expect(dashboard).not.toMatch(/import[\s\S]*buildTodaySchedule/);
  });

  it("passes 4 as upcoming count", () => {
    expect(dashboard).toMatch(/buildUpcomingSchedule\([^)]*,\s*4\s*\)/);
  });
});
