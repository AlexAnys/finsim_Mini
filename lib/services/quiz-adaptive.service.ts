/**
 * Unit 8 · 真自适应测验引擎（纯规则 v1）
 *
 * 核心目标（用户决策 #1）：
 *  - 按知识点 + 题型难度系数 + 答对率 进行能力估计
 *  - 题型权重：判断 0.3 / 单选 0.5 / 多选 0.8 / 简答 0.9
 *  - 目标：≤8 题诊断 ≥3 知识点掌握度
 *  - 末尾输出"薄弱知识点报告"
 *
 * 算法：纯规则引擎（贝叶斯放 Phase 4 if needed）
 */

export type QuizQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

export const TYPE_COEFFICIENT: Record<QuizQuestionType, number> = {
  true_false: 0.3,
  single_choice: 0.5,
  multiple_choice: 0.8,
  short_answer: 0.9,
};

export interface AdaptiveQuizConfig {
  maxQuestions: number;
  startDifficulty: number; // 1-10
  difficultyStep: number; // 1-3
}

export interface AdaptiveQuestionBank {
  id: string;
  type: QuizQuestionType;
  difficulty: number | null;
  knowledgeTagIds: string[];
}

export interface AnswerHistoryEntry {
  questionId: string;
  correct: boolean;
}

export interface KnowledgePointAbility {
  ability: number; // 0-1
  confidence: number; // 0-1
  questionsAnswered: number;
}

export interface AdaptiveState {
  /** Map<knowledgePointTag, KnowledgePointAbility> */
  abilities: Map<string, KnowledgePointAbility>;
  /** 已答题目 ID 集合 */
  answeredIds: Set<string>;
}

export interface AdaptiveStateSnapshot {
  abilities: Record<string, KnowledgePointAbility>;
  answeredCount: number;
  distinctKnowledgePoints: number;
}

// ============================================
// 状态构造 / 答题更新
// ============================================

/** 从历史答题构造当前状态。无状态服务端：每次请求重算。 */
export function buildAdaptiveState(
  history: AnswerHistoryEntry[],
  questionBank: AdaptiveQuestionBank[],
  config: AdaptiveQuizConfig,
): AdaptiveState {
  const state: AdaptiveState = {
    abilities: new Map(),
    answeredIds: new Set(),
  };
  const byId = new Map(questionBank.map((q) => [q.id, q]));
  for (const entry of history) {
    const q = byId.get(entry.questionId);
    if (!q) continue;
    state.answeredIds.add(entry.questionId);
    updateAbility(state, q, entry.correct, config);
  }
  return state;
}

/**
 * 更新单题对应知识点的能力估计。
 *
 * 算法：
 *  - 初始能力 = startDifficulty / 10（默认 0.5）
 *  - diff = (typeCoef × q.difficulty) 归一化到 [0, 1]
 *  - step = difficultyStep / 10
 *  - 答对：ability += diff × step（向 1 趋近）
 *  - 答错：ability -= diff × step（向 0 趋近）
 *  - confidence = min(1, questionsAnswered × 0.25)
 */
export function updateAbility(
  state: AdaptiveState,
  question: AdaptiveQuestionBank,
  correct: boolean,
  config: AdaptiveQuizConfig,
): void {
  const tags = question.knowledgeTagIds.length > 0 ? question.knowledgeTagIds : ["未分类"];
  const typeCoef = TYPE_COEFFICIENT[question.type] ?? 0.5;
  const rawDifficulty = Math.max(1, Math.min(10, question.difficulty ?? 5));
  const diff = (typeCoef * rawDifficulty) / 10;
  const step = Math.max(0.05, Math.min(0.3, (config.difficultyStep ?? 1) / 10));
  const initialAbility = Math.max(0, Math.min(1, (config.startDifficulty ?? 5) / 10));

  for (const tag of tags) {
    const existing = state.abilities.get(tag);
    const prev = existing?.ability ?? initialAbility;
    const delta = diff * step;
    const next = correct
      ? Math.min(1, prev + delta)
      : Math.max(0, prev - delta);
    const questionsAnswered = (existing?.questionsAnswered ?? 0) + 1;
    state.abilities.set(tag, {
      ability: next,
      confidence: Math.min(1, questionsAnswered * 0.25),
      questionsAnswered,
    });
  }
}

// ============================================
// 选题
// ============================================

/**
 * 选下一题。优先级：
 *  1. 仍未覆盖（未答过任一相关题）的知识点 → 选最匹配 startDifficulty 的
 *  2. 已覆盖但能力最弱的知识点 → 选 (能力 ± step) 区间内、题型系数加权最高的
 *  3. 兜底：题型不匹配时降级（任何 type 都接受，按 |当前能力 - 题目难度| 升序）
 */
export function selectNextQuestion(
  state: AdaptiveState,
  bank: AdaptiveQuestionBank[],
  config: AdaptiveQuizConfig,
): AdaptiveQuestionBank | null {
  const remaining = bank.filter((q) => !state.answeredIds.has(q.id));
  if (remaining.length === 0) return null;

  const seenTags = new Set(state.abilities.keys());
  const targetAbility = config.startDifficulty / 10;

  // 1. uncovered knowledge points first
  const uncovered = remaining.filter((q) =>
    q.knowledgeTagIds.length === 0
      ? !seenTags.has("未分类")
      : q.knowledgeTagIds.some((t) => !seenTags.has(t)),
  );
  if (uncovered.length > 0) {
    return pickByAbility(uncovered, targetAbility, config);
  }

  // 2. weakest covered knowledge point
  const weakestEntry = Array.from(state.abilities.entries()).sort(
    (a, b) => a[1].ability - b[1].ability,
  )[0];
  if (!weakestEntry) return remaining[0];

  const [weakestTag, weakestInfo] = weakestEntry;
  const relevant = remaining.filter((q) =>
    q.knowledgeTagIds.length === 0
      ? weakestTag === "未分类"
      : q.knowledgeTagIds.includes(weakestTag),
  );
  if (relevant.length > 0) {
    return pickByAbility(relevant, weakestInfo.ability, config);
  }

  // 3. fallback: any remaining question, closest to weakest ability
  return pickByAbility(remaining, weakestInfo.ability, config);
}

function pickByAbility(
  pool: AdaptiveQuestionBank[],
  targetAbility: number,
  config: AdaptiveQuizConfig,
): AdaptiveQuestionBank {
  const step = Math.max(0.05, (config.difficultyStep ?? 1) / 10);
  const target = targetAbility;
  // score = type weight × (1 - distance to target ability)
  // type weight 高的题（多选/简答）优先于判断题
  const scored = pool.map((q) => {
    const typeCoef = TYPE_COEFFICIENT[q.type] ?? 0.5;
    const rawDiff = Math.max(1, Math.min(10, q.difficulty ?? 5)) / 10;
    const distance = Math.abs(rawDiff - target);
    // 偏好 distance ≤ 1 step；超过则线性惩罚
    const distanceScore = distance <= step ? 1 : Math.max(0, 1 - (distance - step));
    return { q, score: typeCoef * 0.7 + distanceScore * 0.3 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].q;
}

// ============================================
// 早停判断
// ============================================

/**
 * 早停条件：
 *  - 已答 ≥ maxQuestions → 强制停（兜底）
 *  - 已答 ≥ 4 题 AND 覆盖 ≥ 3 知识点 AND 所有知识点 confidence ≥ 0.4 → 停
 *  - 其他情况继续
 */
export function shouldStop(
  state: AdaptiveState,
  config: AdaptiveQuizConfig,
): boolean {
  if (state.answeredIds.size >= config.maxQuestions) return true;
  if (state.answeredIds.size < 4) return false;
  if (state.abilities.size < 3) return false;
  for (const info of state.abilities.values()) {
    if (info.confidence < 0.4) return false;
  }
  return true;
}

// ============================================
// 薄弱知识点报告
// ============================================

export interface MasteryReportPoint {
  tag: string;
  ability: number;
  confidence: number;
  questionsAnswered: number;
  classification: "薄弱" | "一般" | "掌握";
}

export interface MasteryReport {
  totalQuestions: number;
  correctCount: number;
  knowledgePoints: MasteryReportPoint[];
  weakestTopics: string[];
  recommendation: string;
}

export function buildMasteryReport(
  state: AdaptiveState,
  history: AnswerHistoryEntry[],
): MasteryReport {
  const points: MasteryReportPoint[] = Array.from(state.abilities.entries())
    .map(([tag, info]) => ({
      tag,
      ability: Math.round(info.ability * 100) / 100,
      confidence: Math.round(info.confidence * 100) / 100,
      questionsAnswered: info.questionsAnswered,
      classification: classifyAbility(info.ability),
    }))
    .sort((a, b) => a.ability - b.ability);

  const weakestTopics = points
    .filter((p) => p.classification === "薄弱")
    .slice(0, 3)
    .map((p) => p.tag);

  const recommendation = buildRecommendation(points, weakestTopics);

  return {
    totalQuestions: history.length,
    correctCount: history.filter((h) => h.correct).length,
    knowledgePoints: points,
    weakestTopics,
    recommendation,
  };
}

function classifyAbility(a: number): "薄弱" | "一般" | "掌握" {
  if (a < 0.4) return "薄弱";
  if (a < 0.7) return "一般";
  return "掌握";
}

function buildRecommendation(
  points: MasteryReportPoint[],
  weakest: string[],
): string {
  if (points.length === 0) return "本次测验覆盖的知识点较少，建议继续答题以获得诊断。";
  if (weakest.length === 0) {
    return "整体掌握情况良好，可挑战更高难度的题目以巩固。";
  }
  return `建议优先复习：${weakest.join("、")}。这些知识点的当前掌握度偏低，可以结合课程素材针对性学习。`;
}
