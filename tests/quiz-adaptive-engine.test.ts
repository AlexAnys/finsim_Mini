import { describe, it, expect } from "vitest";
import {
  buildAdaptiveState,
  buildMasteryReport,
  selectNextQuestion,
  shouldStop,
  TYPE_COEFFICIENT,
  updateAbility,
  type AdaptiveQuestionBank,
  type AdaptiveQuizConfig,
  type AdaptiveState,
} from "@/lib/services/quiz-adaptive.service";

const config: AdaptiveQuizConfig = {
  maxQuestions: 8,
  startDifficulty: 5,
  difficultyStep: 1,
};

function q(
  id: string,
  type: AdaptiveQuestionBank["type"],
  difficulty: number,
  tags: string[],
): AdaptiveQuestionBank {
  return { id, type, difficulty, knowledgeTagIds: tags };
}

describe("TYPE_COEFFICIENT", () => {
  it("matches 用户决策 #1：判断 0.3 / 单选 0.5 / 多选 0.8 / 简答 0.9", () => {
    expect(TYPE_COEFFICIENT.true_false).toBe(0.3);
    expect(TYPE_COEFFICIENT.single_choice).toBe(0.5);
    expect(TYPE_COEFFICIENT.multiple_choice).toBe(0.8);
    expect(TYPE_COEFFICIENT.short_answer).toBe(0.9);
  });
});

describe("updateAbility", () => {
  it("答对 → ability 增加；答错 → ability 减少", () => {
    const state: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    const question = q("q1", "single_choice", 5, ["KP-A"]);

    updateAbility(state, question, true, config);
    const after1 = state.abilities.get("KP-A")!;
    expect(after1.ability).toBeGreaterThan(0.5);

    updateAbility(state, question, false, config);
    const after2 = state.abilities.get("KP-A")!;
    expect(after2.ability).toBeLessThan(after1.ability);
  });

  it("题型系数影响 delta 大小（简答 > 多选 > 单选 > 判断）", () => {
    const tf: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    const sc: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    const mc: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    const sa: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };

    updateAbility(tf, q("q1", "true_false", 5, ["KP"]), true, config);
    updateAbility(sc, q("q2", "single_choice", 5, ["KP"]), true, config);
    updateAbility(mc, q("q3", "multiple_choice", 5, ["KP"]), true, config);
    updateAbility(sa, q("q4", "short_answer", 5, ["KP"]), true, config);

    const deltaTF = tf.abilities.get("KP")!.ability - 0.5;
    const deltaSC = sc.abilities.get("KP")!.ability - 0.5;
    const deltaMC = mc.abilities.get("KP")!.ability - 0.5;
    const deltaSA = sa.abilities.get("KP")!.ability - 0.5;

    expect(deltaTF).toBeLessThan(deltaSC);
    expect(deltaSC).toBeLessThan(deltaMC);
    expect(deltaMC).toBeLessThan(deltaSA);
  });

  it("无 knowledgeTagIds 题目归入 '未分类' 桶", () => {
    const state: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    updateAbility(state, q("q1", "single_choice", 5, []), true, config);
    expect(state.abilities.has("未分类")).toBe(true);
  });

  it("confidence 随答题数增加（4 题 → 1.0 封顶）", () => {
    const state: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    for (let i = 0; i < 4; i++) {
      updateAbility(state, q(`q${i}`, "single_choice", 5, ["KP"]), true, config);
    }
    expect(state.abilities.get("KP")!.confidence).toBe(1);
  });
});

describe("selectNextQuestion", () => {
  const bank = [
    q("q1", "single_choice", 5, ["KP-A"]),
    q("q2", "multiple_choice", 5, ["KP-B"]),
    q("q3", "short_answer", 6, ["KP-C"]),
    q("q4", "single_choice", 4, ["KP-A"]),
    q("q5", "true_false", 3, ["KP-B"]),
  ];

  it("第一题优先选未覆盖知识点", () => {
    const state: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    const next = selectNextQuestion(state, bank, config);
    expect(next).not.toBeNull();
    // 任何 question 都未覆盖 → 应选其一
    expect(["q1", "q2", "q3", "q4", "q5"]).toContain(next!.id);
  });

  it("已覆盖 KP-A 后，选 KP-B 或 KP-C 而非 KP-A", () => {
    const state = buildAdaptiveState(
      [{ questionId: "q1", correct: true }],
      bank,
      config,
    );
    const next = selectNextQuestion(state, bank, config);
    expect(next).not.toBeNull();
    expect(next!.knowledgeTagIds.some((t) => t !== "KP-A")).toBe(true);
  });

  it("全覆盖后，倾向选最弱 KP 的题", () => {
    // 让 KP-A 答错（变弱），KP-B 答对（保持）
    const state = buildAdaptiveState(
      [
        { questionId: "q1", correct: false }, // KP-A 弱
        { questionId: "q2", correct: true }, // KP-B 强
        { questionId: "q3", correct: true }, // KP-C 强
      ],
      bank,
      config,
    );
    const next = selectNextQuestion(state, bank, config);
    expect(next).not.toBeNull();
    // 应选 q4（KP-A 的另一题）而非 q5（KP-B）
    expect(next!.id).toBe("q4");
  });

  it("已答题不再返回", () => {
    const state = buildAdaptiveState(
      [
        { questionId: "q1", correct: true },
        { questionId: "q2", correct: true },
      ],
      bank,
      config,
    );
    const next = selectNextQuestion(state, bank, config);
    expect(next).not.toBeNull();
    expect(["q3", "q4", "q5"]).toContain(next!.id);
  });

  it("题库耗尽时返回 null", () => {
    const state = buildAdaptiveState(
      bank.map((q) => ({ questionId: q.id, correct: true })),
      bank,
      config,
    );
    const next = selectNextQuestion(state, bank, config);
    expect(next).toBeNull();
  });
});

describe("shouldStop", () => {
  const bank = [
    q("q1", "single_choice", 5, ["A"]),
    q("q2", "single_choice", 5, ["B"]),
    q("q3", "single_choice", 5, ["C"]),
    q("q4", "single_choice", 5, ["A"]),
    q("q5", "single_choice", 5, ["B"]),
  ];

  it("< 4 题永不停", () => {
    const state = buildAdaptiveState(
      [
        { questionId: "q1", correct: true },
        { questionId: "q2", correct: true },
        { questionId: "q3", correct: true },
      ],
      bank,
      config,
    );
    expect(shouldStop(state, config)).toBe(false);
  });

  it("4 题但 KP < 3 不停", () => {
    const state = buildAdaptiveState(
      [
        { questionId: "q1", correct: true },
        { questionId: "q4", correct: true }, // 又是 A
        { questionId: "q1", correct: true }, // 重复（不会累计 ids）
        { questionId: "q4", correct: true }, // 重复
      ],
      bank,
      config,
    );
    // distinct ids = q1, q4 → 2 题 → 但 KP={A:2 questions}
    expect(state.abilities.size).toBe(1);
    expect(shouldStop(state, config)).toBe(false);
  });

  it("4 题 + 3 KP + 全 confidence ≥ 0.4 → 停（每个 KP 多题）", () => {
    const state = buildAdaptiveState(
      [
        { questionId: "q1", correct: true }, // A: 1q conf 0.25
        { questionId: "q2", correct: true }, // B: 1q conf 0.25
        { questionId: "q3", correct: true }, // C: 1q conf 0.25
        { questionId: "q4", correct: true }, // A: 2q conf 0.5
        { questionId: "q5", correct: true }, // B: 2q conf 0.5
        // C 还是 1q，但 spec 写 "all confidence ≥ 0.4"
      ],
      bank,
      config,
    );
    // 5 题 / 3 KP — A.conf=0.5, B.conf=0.5, C.conf=0.25 → 应不停
    expect(shouldStop(state, config)).toBe(false);

    // 再答一题 C → C.conf=0.5
    state.abilities.set("C", { ability: 0.5, confidence: 0.5, questionsAnswered: 2 });
    expect(shouldStop(state, config)).toBe(true);
  });

  it("maxQuestions 强制停", () => {
    const cfg = { ...config, maxQuestions: 2 };
    const state = buildAdaptiveState(
      [
        { questionId: "q1", correct: true },
        { questionId: "q2", correct: true },
      ],
      bank,
      cfg,
    );
    expect(shouldStop(state, cfg)).toBe(true);
  });
});

describe("买力诊断完整路径：3 KP × 8 题（spec 字面要求）", () => {
  it("8 题路径覆盖 ≥3 distinct KP", () => {
    const bank: AdaptiveQuestionBank[] = [
      q("Q-A1", "single_choice", 5, ["KP-储蓄"]),
      q("Q-A2", "multiple_choice", 6, ["KP-储蓄"]),
      q("Q-B1", "single_choice", 5, ["KP-投资"]),
      q("Q-B2", "short_answer", 7, ["KP-投资"]),
      q("Q-C1", "single_choice", 5, ["KP-保险"]),
      q("Q-C2", "multiple_choice", 6, ["KP-保险"]),
      q("Q-D1", "true_false", 3, ["KP-储蓄"]),
      q("Q-D2", "single_choice", 4, ["KP-投资"]),
    ];
    let state: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    const history: Array<{ questionId: string; correct: boolean }> = [];
    let questionsAsked = 0;

    while (!shouldStop(state, config) && questionsAsked < 8) {
      const next = selectNextQuestion(state, bank, config);
      if (!next) break;
      const correct = questionsAsked % 2 === 0; // 模拟答对率 50%
      history.push({ questionId: next.id, correct });
      updateAbility(state, next, correct, config);
      state.answeredIds.add(next.id);
      questionsAsked++;
    }

    expect(state.abilities.size).toBeGreaterThanOrEqual(3);
    expect(state.answeredIds.size).toBeLessThanOrEqual(8);
  });

  it("buildMasteryReport: 至少 3 KP 诊断且 classification 完整", () => {
    const state: AdaptiveState = { abilities: new Map(), answeredIds: new Set() };
    state.abilities.set("KP-储蓄", { ability: 0.3, confidence: 0.5, questionsAnswered: 2 });
    state.abilities.set("KP-投资", { ability: 0.6, confidence: 0.5, questionsAnswered: 2 });
    state.abilities.set("KP-保险", { ability: 0.85, confidence: 0.5, questionsAnswered: 2 });

    const report = buildMasteryReport(state, [
      { questionId: "Q-A1", correct: true },
      { questionId: "Q-A2", correct: false },
      { questionId: "Q-B1", correct: true },
      { questionId: "Q-B2", correct: true },
      { questionId: "Q-C1", correct: true },
      { questionId: "Q-C2", correct: false },
    ]);

    expect(report.knowledgePoints).toHaveLength(3);
    // 排序后 weakest 在前
    expect(report.knowledgePoints[0].classification).toBe("薄弱");
    expect(report.knowledgePoints[2].classification).toBe("掌握");
    expect(report.weakestTopics).toContain("KP-储蓄");
    expect(report.recommendation).toContain("KP-储蓄");
    expect(report.totalQuestions).toBe(6);
    expect(report.correctCount).toBe(4);
  });
});
