/**
 * PR-DASH-1c guards — 教师工作台 B5（任务列表 + filter）+ B6（卡片重做）文案/结构变更回归守护
 *
 * 守护点：
 * - B5: attention-list.tsx h2 改 "任务列表"（不带 4 数字）；filter bar（课程 select + 类型 chip + 回到当天）；可滚动列表 + 时间线分组；不再写死 ".slice(0, 4)" / "需要你关注"
 * - B6: 卡片新增 完成度 / 均分 / 测试 / 管理 字样；中间装饰线（"flex-1 overflow-hidden rounded-full bg-line-2" 进度条结构保留，但旧的 "查看" link 替换为 "管理"）；
 *       卡片可点击（role="button" + cursor-pointer）；章节信息（chapterTitle 渲染）；课前/课中/课后 slot label
 * - dashboard/page.tsx 调用 buildTaskTimelineItems 而非 buildAttentionItems；
 *   保留课程 filter 选项 + filters state
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const attentionList = readFileSync(
  resolve(root, "components/teacher-dashboard/attention-list.tsx"),
  "utf8",
);
const dashboardPage = readFileSync(
  resolve(root, "app/teacher/dashboard/page.tsx"),
  "utf8",
);
const transforms = readFileSync(
  resolve(root, "lib/utils/teacher-dashboard-transforms.ts"),
  "utf8",
);

describe("PR-DASH-1c · B5 任务列表头部 + filter bar", () => {
  it("renders '任务列表' h2 (renamed from '需要你关注')", () => {
    expect(attentionList).toMatch(/任务列表/);
    expect(attentionList).not.toMatch(/需要你关注/);
  });

  it("removes the count-badge after the title (no 4 number)", () => {
    // 旧实现里 h2 之后渲染 <Badge ... > items.length </Badge>；新实现改纯标题
    expect(attentionList).not.toMatch(/items\.length\s*>\s*0\s*&&\s*\(\s*<Badge/);
  });

  it("renders course Select with '全部课程' default option", () => {
    expect(attentionList).toMatch(/SelectTrigger/);
    expect(attentionList).toMatch(/全部课程/);
  });

  it("renders task-type chip toggles (全部 / 测验 / 模拟 / 主观)", () => {
    expect(attentionList).toMatch(/全部/);
    expect(attentionList).toMatch(/测验/);
    expect(attentionList).toMatch(/模拟/);
    expect(attentionList).toMatch(/主观/);
    expect(attentionList).toMatch(/role="radiogroup"/);
  });

  it("renders '回到当天' button", () => {
    expect(attentionList).toMatch(/回到当天/);
  });

  it("scrollable container with max-h", () => {
    expect(attentionList).toMatch(/max-h-\[500px\]/);
    expect(attentionList).toMatch(/overflow-y-auto/);
  });

  it("uses TaskTimelineItem (not the old AttentionItem)", () => {
    expect(attentionList).toMatch(/TaskTimelineItem/);
  });
});

describe("PR-DASH-1c · B6 任务卡片重做", () => {
  it("renders 完成度 + progress bar text", () => {
    expect(attentionList).toMatch(/完成度/);
  });

  it("renders 均分 text + 暂无均分 fallback", () => {
    expect(attentionList).toMatch(/均分/);
    expect(attentionList).toMatch(/暂无均分/);
  });

  it("renders 测试 button with real preview routing", () => {
    expect(attentionList).toMatch(/测试/);
    expect(attentionList).toMatch(/preview=true/);
    expect(attentionList).not.toMatch(/模拟学生功能即将上线/);
  });

  it("renders 管理 button (replaces old 查看 link)", () => {
    expect(attentionList).toMatch(/管理/);
    // No old 查看 button text
    expect(attentionList).not.toMatch(/>查看</);
  });

  it("card root is role=button + cursor-pointer (whole-card clickable)", () => {
    expect(attentionList).toMatch(/role="button"/);
    expect(attentionList).toMatch(/cursor-pointer/);
    expect(attentionList).toMatch(/onKeyDown/);
  });

  it("removes the old fixed 150px middle decoration column with submission ratio", () => {
    // 旧版中间装饰线：`<div className="hidden w-[150px] shrink-0 ...">` 配合 progress + 0/5 数字
    expect(attentionList).not.toMatch(/w-\[150px\]/);
  });

  it("uses Lucide Sparkles + Settings icons for action buttons", () => {
    expect(attentionList).toMatch(/Sparkles/);
    expect(attentionList).toMatch(/Settings/);
  });

  it("renders chapter / section line under class name (相关章节)", () => {
    expect(attentionList).toMatch(/chapterTitle/);
    expect(attentionList).toMatch(/sectionTitle/);
  });

  it("renders slot label (课前/课中/课后) Badge", () => {
    expect(attentionList).toMatch(/TASK_SLOT_POSITION_LABEL/);
  });
});

describe("PR-DASH-1c · transforms additions", () => {
  it("exports buildTaskTimelineItems", () => {
    expect(transforms).toMatch(/export function buildTaskTimelineItems/);
  });

  it("exports buildCourseFilterOptions", () => {
    expect(transforms).toMatch(/export function buildCourseFilterOptions/);
  });

  it("exports TaskTimelineFilters interface", () => {
    expect(transforms).toMatch(/export interface TaskTimelineFilters/);
  });

  it("exports TASK_TIMELINE_GROUP_LABEL with 5 zh labels", () => {
    expect(transforms).toMatch(/TASK_TIMELINE_GROUP_LABEL/);
    expect(transforms).toMatch(/已过期/);
    expect(transforms).toMatch(/今天/);
    expect(transforms).toMatch(/本周/);
    expect(transforms).toMatch(/下周/);
    expect(transforms).toMatch(/之后/);
  });

  it("preserves buildAttentionItems for back-compat (still exported, not deleted)", () => {
    expect(transforms).toMatch(/export function buildAttentionItems/);
  });
});

describe("PR-DASH-1c · dashboard/page.tsx wires the new transform", () => {
  it("imports buildTaskTimelineItems + buildCourseFilterOptions + TaskTimelineFilters", () => {
    expect(dashboardPage).toMatch(/buildTaskTimelineItems/);
    expect(dashboardPage).toMatch(/buildCourseFilterOptions/);
    expect(dashboardPage).toMatch(/TaskTimelineFilters/);
  });

  it("does not import buildAttentionItems anymore", () => {
    // It may still appear in the function name within transforms file, but page.tsx no longer imports it
    expect(dashboardPage).not.toMatch(/buildAttentionItems/);
  });

  it("AttentionList receives filters + courseOptions + onFiltersChange", () => {
    expect(dashboardPage).toMatch(/courseOptions=/);
    expect(dashboardPage).toMatch(/filters=/);
    expect(dashboardPage).toMatch(/onFiltersChange=/);
  });
});
