import { describe, it, expect } from "vitest";
import {
  buildWeeklyInsightPrompt,
  WEEKLY_INSIGHT_PROMPT_VERSION,
} from "@/lib/ai/prompts/weekly-insight";
import {
  buildInsightsAggregatePrompt,
  INSIGHTS_AGGREGATE_PROMPT_VERSION,
} from "@/lib/ai/prompts/insights-aggregate";
import {
  buildScopeInsightsDiagnosisPrompt,
  buildScopeInsightsAdvicePrompt,
  SCOPE_INSIGHTS_DIAGNOSIS_PROMPT_VERSION,
  SCOPE_INSIGHTS_ADVICE_PROMPT_VERSION,
} from "@/lib/ai/prompts/scope-insights";

describe("insight prompt builders (PR-1 E)", () => {
  it("weekly-insight system snapshot (empty submissions / slots)", () => {
    const r = buildWeeklyInsightPrompt({
      windowStart: new Date("2026-05-10T00:00:00Z"),
      windowEnd: new Date("2026-05-16T23:59:59Z"),
      submissions: [],
      upcomingSlots: [],
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(WEEKLY_INSIGHT_PROMPT_VERSION);
  });

  it("weekly-insight with one submission + one slot", () => {
    const r = buildWeeklyInsightPrompt({
      windowStart: new Date("2026-05-10T00:00:00Z"),
      windowEnd: new Date("2026-05-16T23:59:59Z"),
      submissions: [
        {
          submissionId: "s1",
          studentName: "张三",
          className: "金融2024A",
          courseTitle: "个人理财规划",
          chapterTitle: "复利",
          sectionTitle: "复利应用",
          taskName: "理财模拟",
          taskType: "simulation",
          score: 80,
          maxScore: 100,
          feedback: "基础好，但配置略保守",
          conceptTags: ["复利", "风险偏好"],
        },
      ],
      upcomingSlots: [
        {
          scheduleSlotId: "slot1",
          courseId: "c1",
          courseTitle: "个人理财规划",
          date: "2026-05-18",
          weekday: "周一",
          time: "08:00-09:30",
          classroom: "A201",
          className: "金融2024A",
        },
      ],
    });
    expect(r.userPrompt).toContain("张三");
    expect(r.userPrompt).toContain("理财模拟");
  });

  it("insights-aggregate snapshot", () => {
    const r = buildInsightsAggregatePrompt({
      instanceTitle: "第三周练习",
      taskType: "quiz",
      evaluations: [
        { submissionId: "s1", studentName: "李四", score: 70, feedback: "概念混淆" },
      ],
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(INSIGHTS_AGGREGATE_PROMPT_VERSION);
  });

  it("scope-insights diagnosis snapshot", () => {
    const r = buildScopeInsightsDiagnosisPrompt({
      llmInputJson: '[{"index":1,"criterion":"需求挖掘","studentCount":3,"samples":[]}]',
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(SCOPE_INSIGHTS_DIAGNOSIS_PROMPT_VERSION);
  });

  it("scope-insights advice snapshot", () => {
    const r = buildScopeInsightsAdvicePrompt({
      promptInputJson: '{"kpis":{"avgScore":75}}',
    });
    expect(r.systemPrompt).toMatchSnapshot();
    expect(r.userPrompt).toMatchSnapshot();
    expect(r.version).toBe(SCOPE_INSIGHTS_ADVICE_PROMPT_VERSION);
  });
});
