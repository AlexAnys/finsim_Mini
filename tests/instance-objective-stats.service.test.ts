import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    taskInstance: { findUnique: vi.fn() },
    submission: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { getInstanceObjectiveStats } from "@/lib/services/instance-objective-stats.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * S4a 班级「客观体检」服务层单测（mock prisma）。
 *
 * getInstanceObjectiveStats(instanceId)：fetch instance + submissions（只 select 必要字段），
 * 调 S3 utils 聚合：维度短板（带 basisLabel）/ 概念热力 / 配置分布 / 参与度分布。
 * simulation-only：非 sim 任务返回 isSimulation=false（面板不渲染该 section）。read-time、0 schema。
 */

const SIM_INSTANCE = {
  id: "inst-1",
  taskType: "simulation",
  task: {
    scoringCriteria: [
      { id: "c1", name: "需求分析", maxPoints: 25 },
      { id: "c2", name: "合规意识", maxPoints: 15 },
    ],
  },
};

function simSub(opts: {
  studentId: string;
  studentName: string;
  status?: string;
  rubric?: Array<{ criterionId: string; score: number; maxScore: number }>;
  transcript?: Array<{ role: string; text: string }>;
  sections?: Array<{ label: string; items: Array<{ label: string; value: number }> }>;
  conceptTags?: string[];
}) {
  return {
    student: { id: opts.studentId, name: opts.studentName },
    status: opts.status ?? "graded",
    simulationSubmission: {
      transcript: opts.transcript ?? [],
      assets: opts.sections ? { sections: opts.sections } : null,
      evaluation: opts.rubric ? { rubricBreakdown: opts.rubric } : null,
      conceptTags: opts.conceptTags ?? [],
    },
  };
}

describe("getInstanceObjectiveStats", () => {
  it("非 simulation 任务：isSimulation=false，不算客观面板", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue({
      id: "inst-q",
      taskType: "quiz",
      task: { scoringCriteria: [] },
    });
    mk(prisma.submission.findMany).mockResolvedValue([]);
    const result = await getInstanceObjectiveStats("inst-q");
    expect(result.isSimulation).toBe(false);
  });

  it("instance 不存在：抛 INSTANCE_NOT_FOUND", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue(null);
    await expect(getInstanceObjectiveStats("nope")).rejects.toThrow("INSTANCE_NOT_FOUND");
  });

  it("simulation：聚合维度短板（basisLabel）+ 概念热力 + 配置分布 + 参与度", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue(SIM_INSTANCE);
    mk(prisma.submission.findMany).mockResolvedValue([
      simSub({
        studentId: "s1",
        studentName: "张三",
        rubric: [
          { criterionId: "c1", score: 20, maxScore: 25 },
          { criterionId: "c2", score: 6, maxScore: 15 }, // 合规弱
        ],
        transcript: [
          { role: "student", text: "我建议稳健配置" }, // 7
          { role: "ai", text: "好的" },
          { role: "student", text: "债券为主搭配货币基金" }, // 10
        ],
        sections: [
          { label: "权益", items: [{ label: "股票", value: 20 }] },
          { label: "固收", items: [{ label: "债券", value: 80 }] },
        ],
        conceptTags: ["资产配置", "风险披露"],
      }),
      simSub({
        studentId: "s2",
        studentName: "李四",
        rubric: [
          { criterionId: "c1", score: 25, maxScore: 25 },
          { criterionId: "c2", score: 9, maxScore: 15 },
        ],
        transcript: [{ role: "student", text: "随便配" }], // 3
        sections: [{ label: "权益", items: [{ label: "股票", value: 60 }] }], // 合计 60 ≠100
        conceptTags: ["资产配置", "风险揭示"], // 与 s1 风险披露归并
      }),
    ]);

    const r = await getInstanceObjectiveStats("inst-1");
    expect(r.isSimulation).toBe(true);
    expect(r.gradedCount).toBe(2);

    // 维度短板：合规(c2) 得分率最低排首 + basisLabel
    expect(r.dimensionShortfall.scoreBasis).toBe("raw_pre_penalty");
    expect(r.dimensionShortfall.basisLabel).toContain("扣分前原始分");
    expect(r.dimensionShortfall.dimensions[0].criterionId).toBe("c2");

    // 概念热力：资产配置 2 人（覆盖率 100%）、风险（披露+揭示归并）2 人。
    // 二者 count 均为 2，并列时排序由 localeCompare 决定（不稳定假设位置），用 find 按概念名核。
    expect(r.conceptHeatmap.studentCount).toBe(2);
    const assetConcept = r.conceptHeatmap.concepts.find((c) => c.canonical === "资产配置");
    expect(assetConcept).toBeDefined();
    expect(assetConcept!.count).toBe(2);
    expect(assetConcept!.coverage).toBe(100);
    const riskConcept = r.conceptHeatmap.concepts.find((c) => /风险/.test(c.canonical));
    expect(riskConcept!.count).toBe(2); // 风险披露+风险揭示归并

    // 参与度：班级聚合存在
    expect(r.engagement.classSummary.studentCount).toBe(2);
    expect(r.engagement.perStudent).toHaveLength(2);

    // 配置分布：有 profile 的学生数 + 班级平均权益/低风险/其它 + 合计=100 人数
    expect(r.allocationDistribution.withProfileCount).toBe(2);
    // s1 权益20/低风险80；s2 权益60/低风险0 → 均权益40 均低风险40
    expect(r.allocationDistribution.avgEquityPercent).toBe(40);
    expect(r.allocationDistribution.avgLowRiskPercent).toBe(40);
    // 仅 s1 合计=100
    expect(r.allocationDistribution.completeCount).toBe(1);
  });

  it("simulation 但无已批改/无数据：聚合空但结构完整，不抛错", async () => {
    mk(prisma.taskInstance.findUnique).mockResolvedValue(SIM_INSTANCE);
    mk(prisma.submission.findMany).mockResolvedValue([]);
    const r = await getInstanceObjectiveStats("inst-1");
    expect(r.isSimulation).toBe(true);
    expect(r.gradedCount).toBe(0);
    expect(r.dimensionShortfall.dimensions).toEqual([]);
    expect(r.dimensionShortfall.scoreBasis).toBe("raw_pre_penalty"); // 仍带标注
    expect(r.conceptHeatmap.concepts).toEqual([]);
    expect(r.engagement.perStudent).toEqual([]);
    expect(r.allocationDistribution.withProfileCount).toBe(0);
    expect(r.allocationDistribution.avgEquityPercent).toBe(0);
  });
});
