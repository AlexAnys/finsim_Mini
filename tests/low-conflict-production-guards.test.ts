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
      }),
    ).not.toThrow();

    expect(() =>
      assertTaskReadyForPublish({
        taskType: "simulation",
        simulationConfig: { scenario: "客户咨询" },
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
    const file = readFileSync(
      join(process.cwd(), "app/teacher/ai-settings/page.tsx"),
      "utf-8",
    );

    expect(file).toContain("搜索未启用 · AI 不会联网搜索");
    expect(file).toContain("AI 不会联网搜索或伪造结果");
    expect(file).toContain("disabled={!searchConfigured}");
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
