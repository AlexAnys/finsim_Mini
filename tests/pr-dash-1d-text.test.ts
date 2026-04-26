/**
 * PR-DASH-1d guards — 教师工作台 B7 班级表现重做
 *
 * 守护点：
 * - performance-chart.tsx 加课程 Select（"全部课程 / [课程名]"）
 * - 选中课程时图变多线对比 + grouped bars + 图例 chip
 * - 默认（聚合）保持原单线 + 单柱 + 总均分大数字
 * - transforms 新增 buildPerformanceCourseOptions / buildCourseClassPerformance / buildCourseClassWeeklyTrend
 * - dashboard/page.tsx 持有 performanceCourseId state 并传入 PerformanceChart
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildPerformanceCourseOptions,
  buildCourseClassPerformance,
  buildCourseClassWeeklyTrend,
  startOfWeek,
} from "@/lib/utils/teacher-dashboard-transforms";

const root = resolve(__dirname, "..");
const performanceChart = readFileSync(
  resolve(root, "components/teacher-dashboard/performance-chart.tsx"),
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

describe("PR-DASH-1d · performance-chart filter UI", () => {
  it("renders 班级表现 h2 (preserved)", () => {
    expect(performanceChart).toMatch(/班级表现/);
  });

  it("renders course Select with 全部课程 default option", () => {
    expect(performanceChart).toMatch(/SelectTrigger/);
    expect(performanceChart).toMatch(/全部课程/);
    expect(performanceChart).toMatch(/aria-label="按课程筛选班级表现"/);
  });

  it("preserves time-window radiogroup (本周/本月/学期)", () => {
    expect(performanceChart).toMatch(/role="radiogroup"/);
    expect(performanceChart).toMatch(/本周/);
    expect(performanceChart).toMatch(/本月/);
    expect(performanceChart).toMatch(/学期/);
  });

  it("preserves the dual-chart layout title (8 周提交量 & 均分 + 平均得分趋势)", () => {
    expect(performanceChart).toMatch(/平均得分趋势/);
    expect(performanceChart).toMatch(/8 周提交量 & 均分/);
  });

  it("uses fs-success / fs-warn / fs-info / fs-danger token colors for class series", () => {
    expect(performanceChart).toMatch(/--fs-success/);
    expect(performanceChart).toMatch(/--fs-warn/);
    expect(performanceChart).toMatch(/--fs-info/);
    expect(performanceChart).toMatch(/--fs-danger/);
  });

  it("renders multi-line legend (class name chip + colored dot) when course is selected", () => {
    // 多班级图例：courseClassWeekly.slice(0,5).map 渲染 className
    expect(performanceChart).toMatch(/courseClassWeekly/);
  });

  it("aggregate (no course) keeps single overall avg big number rendering", () => {
    // overallAvg null fallback "—" 仍存在（聚合视图独有）
    expect(performanceChart).toMatch(/overallAvg != null \? overallAvg\.toFixed\(1\) : "—"/);
  });

  it("multi-mode triggered by selectedCourseId != null && courseClassWeekly.length > 0", () => {
    expect(performanceChart).toMatch(
      /selectedCourseId\s*!=\s*null\s*&&\s*courseClassWeekly\.length\s*>\s*0/,
    );
  });
});

describe("PR-DASH-1d · transforms additions", () => {
  it("exports buildPerformanceCourseOptions", () => {
    expect(transforms).toMatch(/export function buildPerformanceCourseOptions/);
  });

  it("exports buildCourseClassPerformance", () => {
    expect(transforms).toMatch(/export function buildCourseClassPerformance/);
  });

  it("exports buildCourseClassWeeklyTrend", () => {
    expect(transforms).toMatch(/export function buildCourseClassWeeklyTrend/);
  });

  it("exports CourseClassPerformanceRow + CourseClassWeeklyTrendSeries types", () => {
    expect(transforms).toMatch(/export interface CourseClassPerformanceRow/);
    expect(transforms).toMatch(/export interface CourseClassWeeklyTrendSeries/);
  });

  it("preserves buildClassPerformance + buildWeeklyTrend (back-compat)", () => {
    expect(transforms).toMatch(/export function buildClassPerformance/);
    expect(transforms).toMatch(/export function buildWeeklyTrend/);
  });
});

describe("PR-DASH-1d · dashboard/page.tsx wires the new transform & state", () => {
  it("imports the 3 new transforms", () => {
    expect(dashboardPage).toMatch(/buildPerformanceCourseOptions/);
    expect(dashboardPage).toMatch(/buildCourseClassPerformance/);
    expect(dashboardPage).toMatch(/buildCourseClassWeeklyTrend/);
  });

  it("holds performanceCourseId state + setter", () => {
    expect(dashboardPage).toMatch(/performanceCourseId/);
    expect(dashboardPage).toMatch(/setPerformanceCourseId/);
  });

  it("PerformanceChart receives the new props", () => {
    expect(dashboardPage).toMatch(/courseOptions=\{performanceCourseOptions\}/);
    expect(dashboardPage).toMatch(/courseClasses=\{courseClasses\}/);
    expect(dashboardPage).toMatch(/courseClassWeekly=\{courseClassWeekly\}/);
    expect(dashboardPage).toMatch(/selectedCourseId=\{performanceCourseId\}/);
    expect(dashboardPage).toMatch(/onCourseChange=\{setPerformanceCourseId\}/);
  });
});

describe("PR-DASH-1d · buildPerformanceCourseOptions behavior", () => {
  it("returns dedup'd { id, title } pairs sorted by zh-CN title", () => {
    const opts = buildPerformanceCourseOptions([
      {
        course: { id: "C1", courseTitle: "金融工程" },
        class: { id: "K1" },
      },
      {
        course: { id: "C1", courseTitle: "金融工程" },
        class: { id: "K2" },
      },
      {
        course: { id: "C2", courseTitle: "投资学" },
        class: { id: "K1" },
      },
    ]);
    expect(opts).toHaveLength(2);
    expect(opts.map((o) => o.id).sort()).toEqual(["C1", "C2"]);
    expect(opts.map((o) => o.title)).toEqual(["金融工程", "投资学"].sort((a, b) => a.localeCompare(b, "zh-CN")));
  });

  it("excludes instances missing class id (no class data → useless for compare)", () => {
    const opts = buildPerformanceCourseOptions([
      { course: { id: "C1", courseTitle: "课 A" }, class: null },
      { course: { id: "C2", courseTitle: "课 B" }, class: { id: "K1" } },
    ]);
    expect(opts.map((o) => o.id)).toEqual(["C2"]);
  });
});

describe("PR-DASH-1d · buildCourseClassPerformance behavior", () => {
  it("groups by classId, averages avgScore, counts submissions within course", () => {
    const rows = buildCourseClassPerformance(
      [
        {
          course: { id: "C1" },
          class: { id: "K1", name: "班一", _count: { students: 30 } },
          analytics: { avgScore: 80 },
          _count: { submissions: 10 },
        },
        {
          course: { id: "C1" },
          class: { id: "K1", name: "班一", _count: { students: 30 } },
          analytics: { avgScore: 90 },
          _count: { submissions: 15 },
        },
        {
          course: { id: "C1" },
          class: { id: "K2", name: "班二", _count: { students: 28 } },
          analytics: { avgScore: 75 },
          _count: { submissions: 8 },
        },
        // different course → excluded
        {
          course: { id: "C2" },
          class: { id: "K1", name: "班一" },
          analytics: { avgScore: 50 },
          _count: { submissions: 100 },
        },
      ],
      "C1",
    );
    expect(rows).toHaveLength(2);
    const k1 = rows.find((r) => r.classId === "K1")!;
    const k2 = rows.find((r) => r.classId === "K2")!;
    expect(k1.avgScore).toBe(85); // (80+90)/2
    expect(k1.submitCount).toBe(25); // 10+15
    expect(k1.studentCount).toBe(30);
    expect(k2.avgScore).toBe(75);
    expect(k2.submitCount).toBe(8);
  });

  it("keeps classes with no analytics (avgScore=null) but counts submissions", () => {
    const rows = buildCourseClassPerformance(
      [
        {
          course: { id: "C1" },
          class: { id: "K1", name: "班一" },
          analytics: { avgScore: null },
          _count: { submissions: 5 },
        },
      ],
      "C1",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].avgScore).toBeNull();
    expect(rows[0].submitCount).toBe(5);
  });

  it("returns [] when courseId is empty string", () => {
    expect(buildCourseClassPerformance([], "")).toEqual([]);
  });
});

describe("PR-DASH-1d · buildCourseClassWeeklyTrend behavior", () => {
  const NOW = new Date("2026-04-23T10:00:00Z"); // Thursday

  it("returns one series per class, each with 8 buckets", () => {
    const weekStart = startOfWeek(NOW);
    const inCurrent = new Date(weekStart.getTime() + 3_600_000).toISOString();
    const series = buildCourseClassWeeklyTrend(
      [
        {
          id: "TI1",
          course: { id: "C1" },
          class: { id: "K1", name: "班一" },
        },
        {
          id: "TI2",
          course: { id: "C1" },
          class: { id: "K2", name: "班二" },
        },
      ],
      [
        {
          taskInstanceId: "TI1",
          submittedAt: inCurrent,
          status: "graded",
          score: 80,
          maxScore: 100,
        },
        {
          taskInstanceId: "TI2",
          submittedAt: inCurrent,
          status: "graded",
          score: 60,
          maxScore: 100,
        },
      ],
      "C1",
      NOW,
      8,
    );
    expect(series).toHaveLength(2);
    series.forEach((s) => expect(s.weeklyData).toHaveLength(8));
    const k1 = series.find((s) => s.classId === "K1")!;
    const k2 = series.find((s) => s.classId === "K2")!;
    expect(k1.weeklyData[7].avgScore).toBe(80);
    expect(k2.weeklyData[7].avgScore).toBe(60);
    expect(k1.weeklyData[7].submissionCount).toBe(1);
    expect(k2.weeklyData[7].submissionCount).toBe(1);
  });

  it("excludes submissions whose taskInstance is not in the selected course", () => {
    const weekStart = startOfWeek(NOW);
    const inCurrent = new Date(weekStart.getTime() + 3_600_000).toISOString();
    const series = buildCourseClassWeeklyTrend(
      [
        { id: "TI1", course: { id: "C1" }, class: { id: "K1", name: "班一" } },
        // TI99 belongs to another course; the submission for it should be ignored
        { id: "TI99", course: { id: "C2" }, class: { id: "K9", name: "外班" } },
      ],
      [
        {
          taskInstanceId: "TI99",
          submittedAt: inCurrent,
          status: "graded",
          score: 99,
          maxScore: 100,
        },
      ],
      "C1",
      NOW,
      8,
    );
    expect(series).toHaveLength(1); // only K1 from course C1
    expect(series[0].weeklyData[7].submissionCount).toBe(0); // TI99 sub ignored
  });

  it("returns [] when courseId is empty string", () => {
    expect(buildCourseClassWeeklyTrend([], [], "")).toEqual([]);
  });

  it("returns [] when course has no classes attached", () => {
    expect(
      buildCourseClassWeeklyTrend(
        [{ id: "TI1", course: { id: "C1" }, class: null }],
        [],
        "C1",
      ),
    ).toEqual([]);
  });
});
