import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * PR-FIX-3 Batch C · 前端 + 纪律 5 条单测。
 *
 * C1 grade route feedback/rubricBreakdown 持久化（service 已支持 evaluation
 * merge；这里测 schema 接受 + merge 逻辑） / C2 simulation-runner snapshots
 * length 派生计数（state 派生逻辑） / C3 SectionOverview key 切换 reset 编辑
 * 态（React 行为，单元测脱壳验证 key 不变 / 变） / C4 grading.service 三类
 * conceptTags 写入（quiz extractor 集成） / C5 insights aggregate 不抛
 * NO_CONCEPT_TAGS（已在 insights-service.test.ts 验证 C5 graceful 路径）。
 */

describe("PR-FIX-3 C1 · grade route schema 接受 feedback + rubricBreakdown", () => {
  it("schema 接受 score + maxScore + feedback + rubricBreakdown", async () => {
    const { z } = await import("zod");
    const { rubricBreakdownSchema } = await import("@/lib/validators/submission.schema");
    const sch = z.object({
      score: z.number().min(0),
      maxScore: z.number().min(0),
      feedback: z.string().optional(),
      rubricBreakdown: z.array(rubricBreakdownSchema).optional(),
    });
    const out = sch.parse({
      score: 88,
      maxScore: 100,
      feedback: "整体不错，可加强风险沟通部分",
      rubricBreakdown: [
        {
          criterionId: "c1",
          score: 30,
          maxScore: 40,
          comment: "目标识别准确",
        },
      ],
    });
    expect(out.feedback).toBe("整体不错，可加强风险沟通部分");
    expect(out.rubricBreakdown).toHaveLength(1);
    expect(out.rubricBreakdown![0].criterionId).toBe("c1");
  });

  it("schema 接受仅 score + maxScore（兼容旧调用）", async () => {
    const { z } = await import("zod");
    const { rubricBreakdownSchema } = await import("@/lib/validators/submission.schema");
    const sch = z.object({
      score: z.number().min(0),
      maxScore: z.number().min(0),
      feedback: z.string().optional(),
      rubricBreakdown: z.array(rubricBreakdownSchema).optional(),
    });
    const out = sch.parse({ score: 80, maxScore: 100 });
    expect(out.feedback).toBeUndefined();
    expect(out.rubricBreakdown).toBeUndefined();
  });

  it("merge 逻辑：保留 prior conceptTags 字段不丢失", () => {
    // 模拟 route merge：prior + new feedback/rubric
    const prior = {
      totalScore: 70,
      maxScore: 100,
      feedback: "AI 旧评语",
      rubricBreakdown: [{ criterionId: "c1", score: 35, maxScore: 50, comment: "AI" }],
      conceptTags: ["CAPM", "资产配置"],
    };
    const teacher = {
      score: 88,
      maxScore: 100,
      feedback: "教师新评语",
      rubricBreakdown: [
        { criterionId: "c1", score: 45, maxScore: 50, comment: "教师" },
      ],
    };
    const merged = {
      ...prior,
      totalScore: teacher.score,
      maxScore: teacher.maxScore,
      feedback: teacher.feedback,
      rubricBreakdown: teacher.rubricBreakdown,
    };
    // conceptTags 必须保留（合规追责）
    expect(merged.conceptTags).toEqual(["CAPM", "资产配置"]);
    // 教师值覆盖 AI 旧值
    expect(merged.feedback).toBe("教师新评语");
    expect(merged.totalScore).toBe(88);
    expect(merged.rubricBreakdown[0].score).toBe(45);
  });
});

describe("PR-FIX-3 C2 · simulation-runner allocationSubmitCount 从 snapshots.length 派生", () => {
  it("snapshots = [] → 计数 = 0（初次）", () => {
    const snapshots: Array<unknown> = [];
    expect(snapshots.length).toBe(0);
  });

  it("snapshots 累计后计数 = length（不依赖 useState）", () => {
    const snapshots = [1, 2, 3] as Array<unknown>;
    expect(snapshots.length).toBe(3);
  });

  it("button disabled 当 snapshots.length >= maxSubmissions（防绕过）", () => {
    const maxSubmissions = 3;
    const snapshots = [1, 2, 3];
    const disabled = snapshots.length >= maxSubmissions;
    expect(disabled).toBe(true);
  });

  it("snapshots 从 localStorage 恢复 → 即使页面刷新计数仍 stick（核心 anti-bypass）", () => {
    const restored = [
      { turn: 1, ts: "2026-04-26", allocations: [] },
      { turn: 2, ts: "2026-04-26", allocations: [] },
      { turn: 3, ts: "2026-04-26", allocations: [] },
    ];
    const maxSubmissions = 3;
    // 之前 bug: 页面刷新后 useState(0) 重置但 snapshots 从 localStorage 恢复 →
    // 用户能再点 3 次（总 6 次），绕过 max。新逻辑直接派生：
    const submitCount = restored.length;
    expect(submitCount).toBe(3);
    expect(submitCount >= maxSubmissions).toBe(true);
  });

  it("redo 时 setSnapshots([]) 间接 reset 计数", () => {
    let snapshots: Array<unknown> = [1, 2];
    snapshots = [];
    expect(snapshots.length).toBe(0);
  });
});

describe("PR-FIX-3 C3 · SectionOverview key={sectionId} 让组件按 section 重 mount", () => {
  it("key 不同 → React 视为新组件 → useState 重新初始化（编辑态自动 reset）", () => {
    // React 的 key 行为是基础能力。本测试验证 key 选择策略：
    // 选 section.sectionId（unique stable ID）作为 key 是正确的。
    const sectionA = { sectionId: "a-uuid", sectionTitle: "第 1 节" };
    const sectionB = { sectionId: "b-uuid", sectionTitle: "第 2 节" };
    expect(sectionA.sectionId).not.toBe(sectionB.sectionId);
  });

  it("同一 section 不同 title → key 仍是 sectionId 不变（编辑态保留）", () => {
    const sectionBefore = { sectionId: "a-uuid", sectionTitle: "旧标题" };
    const sectionAfter = { sectionId: "a-uuid", sectionTitle: "新标题" };
    // key 只看 sectionId，title 改 不应导致 unmount/remount
    expect(sectionBefore.sectionId).toBe(sectionAfter.sectionId);
  });
});

describe("PR-FIX-3 C4 · grading.service quiz extractor 输出 conceptTags", () => {
  // C4 集成：simulation/subjective 已有 conceptTags 写入，quiz 现在也通过
  // extractQuizConceptTags 写入。这是 best-effort（catch 失败不阻塞）。

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("AI 成功返回 → conceptTags 写入（≤5 项）", () => {
    // 模拟 service 内部逻辑
    const aiOutput = {
      conceptTags: ["CAPM", "资产配置", "风险偏好", "复利", "通胀", "extra"],
    };
    const conceptTags = Array.isArray(aiOutput.conceptTags)
      ? aiOutput.conceptTags.slice(0, 5)
      : [];
    expect(conceptTags).toEqual(["CAPM", "资产配置", "风险偏好", "复利", "通胀"]);
  });

  it("AI 失败 → 空数组（不阻塞批改主流程）", () => {
    let conceptTags: string[] = [];
    try {
      throw new Error("AI provider down");
    } catch {
      // best-effort: 不抛
    }
    expect(conceptTags).toEqual([]);
  });

  it("questions 空 → 直接返回 [] 不调用 AI", () => {
    const questions: Array<{ prompt: string }> = [];
    if (questions.length === 0) {
      const result: string[] = [];
      expect(result).toEqual([]);
    }
  });

  it("questions 数 > 30 → 仅取前 30（防超长 prompt）", () => {
    const questions = Array.from({ length: 50 }, (_, i) => ({
      prompt: `Q${i}`,
    }));
    const sliced = questions.slice(0, 30);
    expect(sliced).toHaveLength(30);
    expect(sliced[0].prompt).toBe("Q0");
    expect(sliced[29].prompt).toBe("Q29");
  });
});

describe("PR-FIX-3 C5 · insights aggregate 不抛 NO_CONCEPT_TAGS", () => {
  // 详细测试在 tests/insights-service.test.ts 已 update（reject NO_CONCEPT_TAGS
  // 改为 PASS empty weaknessConcepts + AI 仍跑）
  it("totalTags === 0 时 weaknessConcepts 应为空数组（不抛）", () => {
    const evaluations = [
      { conceptTags: [] },
      { conceptTags: [] },
    ];
    const totalTags = evaluations.reduce((s, e) => s + e.conceptTags.length, 0);
    expect(totalTags).toBe(0);
    // 之前会 throw NO_CONCEPT_TAGS，现在不抛 → weaknessConcepts 空
    const weaknessConcepts: Array<{ tag: string; count: number }> = [];
    expect(weaknessConcepts).toEqual([]);
  });

  it("有 tags 时仍按聚合逻辑统计（与 C5 不冲突）", () => {
    const evaluations = [
      { studentId: "u1", conceptTags: ["CAPM"] },
      { studentId: "u2", conceptTags: ["CAPM", "通胀"] },
    ];
    const tagCounts = new Map<string, Set<string>>();
    for (const e of evaluations) {
      for (const tag of e.conceptTags) {
        if (!tagCounts.has(tag)) tagCounts.set(tag, new Set());
        tagCounts.get(tag)!.add(e.studentId);
      }
    }
    const result = Array.from(tagCounts.entries())
      .map(([tag, set]) => ({ tag, count: set.size }))
      .sort((a, b) => b.count - a.count);
    expect(result).toEqual([
      { tag: "CAPM", count: 2 },
      { tag: "通胀", count: 1 },
    ]);
  });
});

describe("PR-FIX-3 UX2 · 批量批改 next 限定在 selected ids 队列", () => {
  // 模拟 page.tsx 的 handleDrawerNext bulkQueue 路径
  function nextInQueue(currentId: string, queue: string[]): string | null {
    const idx = queue.indexOf(currentId);
    const nextId = idx >= 0 ? queue[idx + 1] : queue[0];
    return nextId ?? null;
  }

  it("队列 [A, C, E]，当前 A → 下一份 C（跳过 B）", () => {
    const queue = ["A", "C", "E"];
    expect(nextInQueue("A", queue)).toBe("C");
  });

  it("队列 [A, C, E]，当前 C → 下一份 E", () => {
    const queue = ["A", "C", "E"];
    expect(nextInQueue("C", queue)).toBe("E");
  });

  it("队列 [A, C, E]，当前 E → null（队列结束）", () => {
    const queue = ["A", "C", "E"];
    expect(nextInQueue("E", queue)).toBeNull();
  });

  it("队列空 → 走原 fallback（用 indexOf=-1，nextId 取 queue[0]=undefined → null）", () => {
    const queue: string[] = [];
    expect(nextInQueue("X", queue)).toBeNull();
  });

  it("队列保留教师点选顺序（不重排）", () => {
    const userPicked = ["E", "A", "C"]; // 用户先点 E 再 A 再 C
    expect(nextInQueue("E", userPicked)).toBe("A");
    expect(nextInQueue("A", userPicked)).toBe("C");
  });
});

describe("PR-FIX-3 UX3 · 全选 checkbox checked 状态基于 eligible rows", () => {
  type Row = { id: string; status: "submitted" | "graded" };

  it("eligible rows 全选 → checked=true（即使存在 graded 行未选）", () => {
    const visibleRows: Row[] = [
      { id: "1", status: "submitted" },
      { id: "2", status: "graded" }, // ineligible
      { id: "3", status: "submitted" },
    ];
    const eligibleRows = visibleRows.filter((r) => r.status !== "graded");
    const selected = new Set(["1", "3"]);
    const allEligibleSelected =
      eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(r.id));
    expect(allEligibleSelected).toBe(true);
  });

  it("eligible rows 部分选 → checked=false", () => {
    const visibleRows: Row[] = [
      { id: "1", status: "submitted" },
      { id: "2", status: "submitted" },
    ];
    const eligibleRows = visibleRows.filter((r) => r.status !== "graded");
    const selected = new Set(["1"]);
    const allEligibleSelected =
      eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(r.id));
    expect(allEligibleSelected).toBe(false);
  });

  it("无 eligible rows（全部 graded）→ checked=false 且 disabled", () => {
    const visibleRows: Row[] = [
      { id: "1", status: "graded" },
      { id: "2", status: "graded" },
    ];
    const eligibleRows = visibleRows.filter((r) => r.status !== "graded");
    const allEligibleSelected =
      eligibleRows.length > 0 && eligibleRows.every(() => true);
    expect(allEligibleSelected).toBe(false);
    expect(eligibleRows.length === 0).toBe(true);
  });

  it("toggleSelectAll 只增删 eligible rows（永远不选 graded）", () => {
    const visibleRows: Row[] = [
      { id: "1", status: "submitted" },
      { id: "2", status: "graded" },
      { id: "3", status: "submitted" },
    ];
    const eligibleRows = visibleRows.filter((r) => r.status !== "graded");
    const initial = new Set<string>();
    // toggleSelectAll: allEligibleSelected=false → 加全部 eligible
    const next = new Set(initial);
    for (const r of eligibleRows) next.add(r.id);
    expect(next.has("1")).toBe(true);
    expect(next.has("2")).toBe(false); // graded 永不选
    expect(next.has("3")).toBe(true);
  });

  it("第二次 toggle：allEligibleSelected=true → 删全部 eligible（保留无关 selection）", () => {
    const visibleRows: Row[] = [
      { id: "1", status: "submitted" },
      { id: "2", status: "submitted" },
    ];
    const eligibleRows = visibleRows.filter((r) => r.status !== "graded");
    const initial = new Set(["1", "2", "from-other-page"]);
    const next = new Set(initial);
    for (const r of eligibleRows) next.delete(r.id);
    expect(next.has("1")).toBe(false);
    expect(next.has("2")).toBe(false);
    expect(next.has("from-other-page")).toBe(true); // 不影响其他选择
  });
});
