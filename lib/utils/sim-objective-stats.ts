/**
 * S3 (P2-a) 客观统计 工具层 — 纯 read-time，0 schema。
 *
 * 只统计 simulation 客观能捕获的信号（行为 / 产出），与 AI 主观评分**分开呈现**，
 * 让老师对照核验 AI 判分是否合理。全部消费已 fetch 的提交数据，不查 DB、无副作用；
 * 供 S4 教师向面板（个体「客观行为卡」+ 班级「客观体检」）渲染。Route Handler 不放业务逻辑。
 *
 * 数据形状（来自 lib/validators/submission.schema.ts + prisma/schema.prisma 真源）：
 * - assets.sections = [{ label, items: [{ label, value }] }]（嵌套 items）
 * - rubricBreakdown = [{ criterionId, score, maxScore }]，score 为「扣分前原始分」
 * - conceptTags = string[]（Submission 上的 DB 列，每人 ≤5）
 */

import { computeTranscriptStats } from "@/lib/utils/transcript-stats";

function round(n: number): number {
  return Math.round(n);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ───────────────────────── 1. 对话参与度 ─────────────────────────

export interface StudentEngagement {
  studentId: string;
  studentName: string;
  studentTurns: number;
  studentCharTotal: number;
  studentCharAvg: number;
}

export interface EngagementClassSummary {
  studentCount: number;
  avgTurns: number;
  minTurns: number;
  maxTurns: number;
  avgCharTotal: number;
}

export interface EngagementResult {
  perStudent: StudentEngagement[];
  classSummary: EngagementClassSummary;
}

export interface EngagementInput {
  studentId: string;
  studentName: string;
  transcript: unknown;
}

/**
 * 逐人对话参与度（复用 S2 的 computeTranscriptStats 同一计数口径）+ 班级聚合。
 * 轮次固定时字数是真正区分「敷衍 vs 投入」的客观指标。
 */
export function summarizeEngagement(submissions: EngagementInput[]): EngagementResult {
  const perStudent: StudentEngagement[] = (Array.isArray(submissions) ? submissions : []).map(
    (s) => {
      const stats = computeTranscriptStats(s?.transcript);
      return {
        studentId: s?.studentId ?? "",
        studentName: s?.studentName ?? "",
        studentTurns: stats.studentTurns,
        studentCharTotal: stats.studentCharTotal,
        studentCharAvg: stats.studentCharAvg,
      };
    },
  );

  const n = perStudent.length;
  if (n === 0) {
    return {
      perStudent,
      classSummary: { studentCount: 0, avgTurns: 0, minTurns: 0, maxTurns: 0, avgCharTotal: 0 },
    };
  }
  const turns = perStudent.map((p) => p.studentTurns);
  const totalTurns = turns.reduce((a, b) => a + b, 0);
  const totalChars = perStudent.reduce((a, p) => a + p.studentCharTotal, 0);
  return {
    perStudent,
    classSummary: {
      studentCount: n,
      avgTurns: round(totalTurns / n),
      minTurns: Math.min(...turns),
      maxTurns: Math.max(...turns),
      avgCharTotal: round(totalChars / n),
    },
  };
}

// ─────────────────────── 2. 资产配置画像 ───────────────────────

/**
 * 资产类别关键词（轻量可维护方案）。匹配「item 标签 + section 标签」拼接串。
 * 判定顺序（见 classifyAsset，coordinator 核查项）：
 *   1) 权益关键词（仅 股票/股基/偏股/指数基金/权益/二级市场/ETF —— 均不含「货币/短债」字样）
 *   2) 低风险关键词（债券/债基/短债/货币基金/货币/存款/国债/现金/固收/银行理财/活期/存单/定期）
 *   3) 「基金」兜底 → 权益（教学场景默认偏股基金）
 * 顺序保证「货币基金 / 短债基金」在步骤 2 命中低风险，绝不落到步骤 3 被误判权益。
 * 其余（黄金 / 商品 / 另类等）归 other。新增类别在此处加关键词即可。
 */
const EQUITY_KEYWORDS = ["股票", "股基", "偏股", "权益", "指数基金", "二级市场", "ETF"];
const LOW_RISK_KEYWORDS = [
  "债券",
  "债基",
  "短债",
  "货币基金",
  "货币",
  "存款",
  "国债",
  "现金",
  "固定收益",
  "固收",
  "银行理财",
  "活期",
  "存单",
  "定期",
];

type AssetClass = "equity" | "lowRisk" | "other";

function classifyAsset(itemLabel: string, sectionLabel: string): AssetClass {
  const hay = `${itemLabel} ${sectionLabel}`;
  if (EQUITY_KEYWORDS.some((k) => hay.includes(k))) return "equity";
  if (LOW_RISK_KEYWORDS.some((k) => hay.includes(k))) return "lowRisk";
  // 基金未明确偏股/货币时，含「基金」按权益类敞口处理（教学场景默认偏股基金）
  if (hay.includes("基金")) return "equity";
  return "other";
}

export interface AllocationProfile {
  totalPercent: number;
  /** 合计是否=100%（允许 ±0.5 浮点误差） */
  isComplete: boolean;
  equityPercent: number;
  lowRiskPercent: number;
  otherPercent: number;
}

/**
 * 解析单份提交的 assets.sections（嵌套 items）→ 配置画像。
 * 对应「方案推荐」维度，供老师核对学生权益敞口是否超出客户风险承受。
 * 空 / 无有效项 → null（无副作用，不渲染）。
 */
export function buildAllocationProfile(assets: unknown): AllocationProfile | null {
  if (!assets || typeof assets !== "object") return null;
  const sections = (assets as Record<string, unknown>).sections;
  if (!Array.isArray(sections)) return null;

  let total = 0;
  let equity = 0;
  let lowRisk = 0;
  let other = 0;
  let validItems = 0;

  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const sec = section as Record<string, unknown>;
    const sectionLabel = typeof sec.label === "string" ? sec.label : "";
    const items = sec.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const value = it.value;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const itemLabel = typeof it.label === "string" ? it.label : "";
      validItems += 1;
      total += value;
      const cls = classifyAsset(itemLabel, sectionLabel);
      if (cls === "equity") equity += value;
      else if (cls === "lowRisk") lowRisk += value;
      else other += value;
    }
  }

  if (validItems === 0) return null;
  return {
    totalPercent: round1(total),
    isComplete: Math.abs(total - 100) <= 0.5,
    equityPercent: round1(equity),
    lowRiskPercent: round1(lowRisk),
    otherPercent: round1(other),
  };
}

// ──────────────── 3. 维度短板 + 迟交对账（原始分）────────────────

export interface DimensionShortfall {
  criterionId: string;
  criterionName: string;
  /** 班级该维度平均得分（扣分前原始分） */
  avgScore: number;
  /** 该维度满分 */
  avgMaxScore: number;
  /** 得分率 %（avgScore / avgMaxScore × 100） */
  scoreRate: number;
  /** 计入均分的提交数 */
  sampleSize: number;
}

export interface ClassDimensionShortfall {
  dimensions: DimensionShortfall[];
  /**
   * coordinator pin（承接 S1 裁定）：班级维度均分用「扣分前原始分」。
   * scoreBasis 机器可读 + basisLabel 人类可读，二者一并透传到 S4 面板，
   * 与 KPI 总均分（扣分后口径）区分，避免引入新矛盾。
   */
  scoreBasis: "raw_pre_penalty";
  basisLabel: string;
}

const RAW_BASIS_LABEL = "维度均分基于扣分前原始分（未计迟交罚分），与扣分后的总均分口径不同";

interface RubricAgg {
  scoreSum: number;
  maxSum: number;
  count: number;
}

export interface DimensionSubmissionInput {
  evaluation: unknown;
}

export interface CriterionMeta {
  id: string;
  name: string;
}

/**
 * 班级各维度均分排名（扣分前原始分），得分率升序（短板在前）。
 * 直读 rubricBreakdown 维度分 = 扣分前原始分（与 scope-insights 既有口径一致）。
 */
export function buildClassDimensionShortfall(
  submissions: DimensionSubmissionInput[],
  criteria: CriterionMeta[],
): ClassDimensionShortfall {
  const nameById = new Map<string, string>();
  for (const c of Array.isArray(criteria) ? criteria : []) {
    if (c?.id && c?.name) nameById.set(c.id, c.name);
  }

  const aggById = new Map<string, RubricAgg>();
  for (const s of Array.isArray(submissions) ? submissions : []) {
    const evaluation = s?.evaluation;
    if (!evaluation || typeof evaluation !== "object") continue;
    const breakdown = (evaluation as Record<string, unknown>).rubricBreakdown;
    if (!Array.isArray(breakdown)) continue;
    for (const entry of breakdown) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const criterionId = typeof e.criterionId === "string" ? e.criterionId : null;
      const score = typeof e.score === "number" && Number.isFinite(e.score) ? e.score : null;
      const maxScore =
        typeof e.maxScore === "number" && Number.isFinite(e.maxScore) ? e.maxScore : null;
      if (!criterionId || score === null || maxScore === null) continue;
      const agg = aggById.get(criterionId) ?? { scoreSum: 0, maxSum: 0, count: 0 };
      agg.scoreSum += score;
      agg.maxSum += maxScore;
      agg.count += 1;
      aggById.set(criterionId, agg);
    }
  }

  const dimensions: DimensionShortfall[] = [];
  for (const [criterionId, agg] of aggById) {
    const avgScore = round1(agg.scoreSum / agg.count);
    const avgMaxScore = round1(agg.maxSum / agg.count);
    const scoreRate = avgMaxScore > 0 ? round1((agg.scoreSum / agg.maxSum) * 100) : 0;
    dimensions.push({
      criterionId,
      criterionName: nameById.get(criterionId) ?? criterionId,
      avgScore,
      avgMaxScore,
      scoreRate,
      sampleSize: agg.count,
    });
  }
  // 短板在前：得分率升序；并列时按维度名稳定排序
  dimensions.sort((a, b) =>
    a.scoreRate !== b.scoreRate
      ? a.scoreRate - b.scoreRate
      : a.criterionName.localeCompare(b.criterionName),
  );

  return { dimensions, scoreBasis: "raw_pre_penalty", basisLabel: RAW_BASIS_LABEL };
}

// ───────────────────── 4. 概念覆盖热力 ─────────────────────

/**
 * conceptTag 同义归并表（轻量可维护方案）：碎片 → 规范名。
 * 数据里存在同义碎片（风险披露/风险揭示、合规披露/合规销售/投资者适当性、投资期限/投资期限匹配）。
 * 仅在此表加一行即可扩展；未命中的 tag 原样保留（trim 后），不丢数据。
 */
const CONCEPT_SYNONYMS: Record<string, string> = {
  风险披露: "风险揭示",
  风险揭示: "风险揭示",
  风险提示: "风险揭示",
  合规披露: "合规",
  合规销售: "合规",
  合规意识: "合规",
  投资者适当性: "适当性",
  适当性管理: "适当性",
  适当性: "适当性",
  风险偏好: "风险偏好",
  风险承受能力: "风险偏好",
  资产配置: "资产配置",
  分散投资: "资产配置",
  // B（coordinator 从生产 conceptTags 确认）：投资期限碎片归并；
  // 其余单例（流动性管理 / 目标日期投资 / 投资目标 / 教育金规划）是独立概念，不入表。
  投资期限: "投资期限",
  投资期限匹配: "投资期限",
};

/** 把单个 conceptTag 归并到规范名；未知 tag trim 后原样返回。 */
export function canonicalizeConceptTag(tag: string): string {
  const t = (tag ?? "").trim();
  return CONCEPT_SYNONYMS[t] ?? t;
}

export interface ConceptHeatItem {
  /** 归并后的规范概念名 */
  canonical: string;
  /** 出现该概念的学生人数（同一学生同义不重复计数） */
  count: number;
  /** 覆盖率 %（count / studentCount × 100） */
  coverage: number;
}

export interface ConceptHeatmap {
  studentCount: number;
  concepts: ConceptHeatItem[];
}

/**
 * 班级概念覆盖热力：每人一组 conceptTags → 归并 → 按出现人数降序。
 * 暴露合规 / 适当性等教学盲点。同一学生内同义只计一次。
 */
export function buildConceptHeatmap(perStudentTags: string[][]): ConceptHeatmap {
  const rows = Array.isArray(perStudentTags) ? perStudentTags : [];
  const studentCount = rows.length;
  const countByCanonical = new Map<string, number>();

  for (const tags of rows) {
    // 单个学生：归并后去重，避免同义碎片在同一人身上重复计数
    const seen = new Set<string>();
    for (const raw of Array.isArray(tags) ? tags : []) {
      if (typeof raw !== "string") continue;
      const canonical = canonicalizeConceptTag(raw);
      if (!canonical) continue;
      seen.add(canonical);
    }
    for (const canonical of seen) {
      countByCanonical.set(canonical, (countByCanonical.get(canonical) ?? 0) + 1);
    }
  }

  const concepts: ConceptHeatItem[] = [...countByCanonical.entries()]
    .map(([canonical, count]) => ({
      canonical,
      count,
      coverage: studentCount > 0 ? round1((count / studentCount) * 100) : 0,
    }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.canonical.localeCompare(b.canonical)));

  return { studentCount, concepts };
}
