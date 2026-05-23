import { prisma } from "@/lib/db/prisma";
import {
  summarizeEngagement,
  buildAllocationProfile,
  buildClassDimensionShortfall,
  buildConceptHeatmap,
  type EngagementResult,
  type ClassDimensionShortfall,
  type ConceptHeatmap,
} from "@/lib/utils/sim-objective-stats";

/**
 * S4a 班级「客观体检」数据层（DB 访问 + 编排 = 正确的 service 层）。
 *
 * read-time、0 schema：fetch 该 instance 的 submissions（只 select 必要字段，避免过取），
 * 调 S3 纯函数 utils 聚合成教师向客观面板数据，与 AI 主观评分分开呈现供老师对照核验。
 *
 * simulation-only：transcript / assets 是 simulation 概念，非 sim 任务返回 isSimulation=false，
 * 面板不渲染该 section。
 *
 * 维度短板用「扣分前原始分」（rubricBreakdown 维度分本就是扣分前；与 scope-insights 口径一致），
 * 经 buildClassDimensionShortfall 携带 scoreBasis/basisLabel 透传给面板显著呈现（S1 pin）。
 */

export interface AllocationDistribution {
  /** 有有效配置画像的学生数 */
  withProfileCount: number;
  /** 班级平均权益敞口 %（仅对有 profile 的学生求均） */
  avgEquityPercent: number;
  /** 班级平均低风险占比 % */
  avgLowRiskPercent: number;
  /** 班级平均其它（未覆盖类别）占比 % */
  avgOtherPercent: number;
  /** 配置合计=100% 的学生数（数据质量信号） */
  completeCount: number;
}

export interface InstanceObjectiveStats {
  isSimulation: boolean;
  gradedCount: number;
  dimensionShortfall: ClassDimensionShortfall;
  conceptHeatmap: ConceptHeatmap;
  engagement: EngagementResult;
  allocationDistribution: AllocationDistribution;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const EMPTY_ALLOCATION: AllocationDistribution = {
  withProfileCount: 0,
  avgEquityPercent: 0,
  avgLowRiskPercent: 0,
  avgOtherPercent: 0,
  completeCount: 0,
};

/**
 * 班级客观体检聚合。
 * @throws INSTANCE_NOT_FOUND 实例不存在
 */
export async function getInstanceObjectiveStats(
  instanceId: string,
): Promise<InstanceObjectiveStats> {
  const instance = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      taskType: true,
      task: {
        select: {
          scoringCriteria: {
            select: { id: true, name: true, maxPoints: true },
            orderBy: { order: "asc" },
          },
        },
      },
    },
  });
  if (!instance) throw new Error("INSTANCE_NOT_FOUND");

  const isSimulation = instance.taskType === "simulation";

  // 仅 select 客观面板必要字段，避免过取（QA caution + spec 风险登记）
  const submissions = await prisma.submission.findMany({
    where: { taskInstanceId: instanceId, status: "graded" },
    select: {
      student: { select: { id: true, name: true } },
      simulationSubmission: {
        select: {
          transcript: true,
          assets: true,
          evaluation: true,
          conceptTags: true,
        },
      },
    },
    orderBy: { gradedAt: "desc" },
    take: 200,
  });

  const criteria = (instance.task?.scoringCriteria ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  // 非 simulation：结构完整但 section 不渲染（面板按 isSimulation 门控）
  if (!isSimulation) {
    return {
      isSimulation: false,
      gradedCount: submissions.length,
      dimensionShortfall: buildClassDimensionShortfall([], criteria),
      conceptHeatmap: buildConceptHeatmap([]),
      engagement: summarizeEngagement([]),
      allocationDistribution: EMPTY_ALLOCATION,
    };
  }

  const sims = submissions.map((s) => ({
    studentId: s.student.id,
    studentName: s.student.name,
    sim: s.simulationSubmission,
  }));

  // 维度短板（扣分前原始分 + basisLabel）
  const dimensionShortfall = buildClassDimensionShortfall(
    sims.map((s) => ({ evaluation: s.sim?.evaluation })),
    criteria,
  );

  // 概念热力（每人一组 conceptTags → 归并 → 频次）
  const conceptHeatmap = buildConceptHeatmap(
    sims.map((s) => s.sim?.conceptTags ?? []),
  );

  // 参与度（轮次 + 字数；逐人 + 班级聚合）
  const engagement = summarizeEngagement(
    sims.map((s) => ({
      studentId: s.studentId,
      studentName: s.studentName,
      transcript: s.sim?.transcript,
    })),
  );

  // 配置分布：逐份 buildAllocationProfile 聚合
  const profiles = sims
    .map((s) => buildAllocationProfile(s.sim?.assets))
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const allocationDistribution: AllocationDistribution =
    profiles.length === 0
      ? EMPTY_ALLOCATION
      : {
          withProfileCount: profiles.length,
          avgEquityPercent: round1(
            profiles.reduce((a, p) => a + p.equityPercent, 0) / profiles.length,
          ),
          avgLowRiskPercent: round1(
            profiles.reduce((a, p) => a + p.lowRiskPercent, 0) / profiles.length,
          ),
          avgOtherPercent: round1(
            profiles.reduce((a, p) => a + p.otherPercent, 0) / profiles.length,
          ),
          completeCount: profiles.filter((p) => p.isComplete).length,
        };

  return {
    isSimulation: true,
    gradedCount: submissions.length,
    dimensionShortfall,
    conceptHeatmap,
    engagement,
    allocationDistribution,
  };
}
