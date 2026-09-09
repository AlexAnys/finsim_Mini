import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertTaskReadyForPublish } from "@/lib/services/task-instance.service";

describe("task publish config guards", () => {
  it("blocks quiz publish when config or questions are missing", () => {
    expect(() =>
      assertTaskReadyForPublish({
        taskType: "quiz",
        quizConfig: null,
        quizQuestions: [],
      }),
    ).toThrow("TASK_CONFIG_INCOMPLETE");

    expect(() =>
      assertTaskReadyForPublish({
        taskType: "quiz",
        quizConfig: { mode: "fixed" },
        quizQuestions: [],
      }),
    ).toThrow("TASK_CONFIG_INCOMPLETE");
  });

  it("blocks subjective and simulation publish when required config is missing", () => {
    expect(() =>
      assertTaskReadyForPublish({
        taskType: "subjective",
        subjectiveConfig: { prompt: " " },
      }),
    ).toThrow("TASK_CONFIG_INCOMPLETE");

    expect(() =>
      assertTaskReadyForPublish({
        taskType: "simulation",
        simulationConfig: null,
      }),
    ).toThrow("TASK_CONFIG_INCOMPLETE");
  });

  it("allows complete quiz, subjective, and simulation tasks", () => {
    expect(() =>
      assertTaskReadyForPublish({
        taskType: "quiz",
        quizConfig: { mode: "fixed" },
        quizQuestions: [{ id: "q1" }],
      }),
    ).not.toThrow();

    expect(() =>
      assertTaskReadyForPublish({
        taskType: "subjective",
        subjectiveConfig: { prompt: "请分析案例。" },
        scoringCriteria: [{ id: "r1", name: "分析质量", maxPoints: 10 }],
      }),
    ).not.toThrow();

    expect(() =>
      assertTaskReadyForPublish({
        taskType: "simulation",
        simulationConfig: { scenario: "客户咨询" },
        scoringCriteria: [{ id: "r1", name: "沟通质量", maxPoints: 10 }],
      }),
    ).not.toThrow();
  });
});

describe("production UI copy guards", () => {
  it("student bad task fallback explains the task is temporarily unavailable", () => {
    const file = readFileSync(
      join(process.cwd(), "app/(student)/tasks/[id]/page.tsx"),
      "utf-8",
    );

    expect(file).toContain("任务暂不可用");
    expect(file).toContain("尚未完成题目或测验配置");
    expect(file).toContain("返回学生首页");
  });

  it("AI settings search state clearly says search is disabled", () => {
    // Unit B1: 抽离到 components/ai-workbench/settings-tab.tsx
    const file = readFileSync(
      join(process.cwd(), "components/ai-workbench/settings-tab.tsx"),
      "utf-8",
    );

    expect(file).toContain("搜索未启用 · AI 不会联网搜索");
    expect(file).toContain("当前未接入联网搜索");
    // Search is not implemented: retain the disclosure and remove the misleading enable switch.
    expect(file).not.toContain("checked={searchConfigured && tool.enableSearch}");
    expect(file).not.toContain("onCheckedChange={(checked) => updateTool(tool.key, { enableSearch: checked })}");
    const route = readFileSync(join(process.cwd(), "app/api/ai/tool-settings/route.ts"), "utf-8");
    expect(route).toContain("searchProviderConfigured: false");
  });

  it("analytics charts keep stable minimum dimensions for Recharts", () => {
    const scoreDistribution = readFileSync(
      join(process.cwd(), "components/analytics-v2/score-distribution-chart.tsx"),
      "utf-8",
    );
    const kpiTrailing = readFileSync(
      join(process.cwd(), "components/analytics-v2/kpi-trailing-visual.tsx"),
      "utf-8",
    );
    const sparkline = readFileSync(
      join(process.cwd(), "components/analytics-v2/sparkline.tsx"),
      "utf-8",
    );

    expect(scoreDistribution).toContain("min-h-[240px]");
    expect(kpiTrailing).toContain("width={160}");
    expect(kpiTrailing).toContain("height={36}");
    expect(sparkline).toContain("minHeight: 1");
    expect(sparkline).toContain("minWidth: 1");
    expect(sparkline).toContain("<LineChart width={width} height={height}");
  });
});
