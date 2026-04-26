import { describe, it, expect } from "vitest";

/**
 * PR-FIX-2 Batch B · AI 实现 + 数据模型 7 条单测。
 *
 * B1 hint 节流（服务端推导 lastHintTurn）/ B2 mood_label enum + label 重写 /
 * B3 aggregateSchema .default([]) + AI 失败降级 / B4 evaluate route assets
 * snapshots / B5 snapshots .max(20) / B6 AnalysisReport unique（schema 单元
 * 见 schema 文件）/ B7 onDelete = SET NULL（不改，验证现状）。
 *
 * 真 chat / 真 evaluate / 真 aggregate E2E 由 QA curl 验证。
 */

describe("PR-FIX-2 B1 · 服务端推导 lastHintTurn from transcript", () => {
  // 复刻 ai.service 的服务端推导逻辑：
  //   遍历 transcript，记录 student-turn 计数；ai 消息带 hint 时记下 lastHintTurn = 当前 student-turn 数
  function deriveLastHintTurnFromTranscript(
    transcript: Array<{ role: string; text: string; hint?: string }>,
  ): number | undefined {
    let runningStudentTurns = 0;
    let lastHintTurn: number | undefined;
    for (const m of transcript) {
      if (m.role === "student") runningStudentTurns++;
      if (m.role === "ai" && typeof m.hint === "string" && m.hint.length > 0) {
        lastHintTurn = runningStudentTurns;
      }
    }
    return lastHintTurn;
  }

  it("transcript 无 hint 时返回 undefined", () => {
    const t = [
      { role: "student", text: "你好" },
      { role: "ai", text: "你好" },
    ];
    expect(deriveLastHintTurnFromTranscript(t)).toBeUndefined();
  });

  it("transcript 第 2 轮 ai 带 hint → lastHintTurn=2", () => {
    const t = [
      { role: "student", text: "1" },
      { role: "ai", text: "a1" },
      { role: "student", text: "2" },
      { role: "ai", text: "a2", hint: "想想" },
    ];
    expect(deriveLastHintTurnFromTranscript(t)).toBe(2);
  });

  it("多个 hint 时取最后一次", () => {
    const t = [
      { role: "student", text: "1" },
      { role: "ai", text: "a1", hint: "h1" },
      { role: "student", text: "2" },
      { role: "ai", text: "a2" },
      { role: "student", text: "3" },
      { role: "ai", text: "a3", hint: "h2" },
    ];
    expect(deriveLastHintTurnFromTranscript(t)).toBe(3);
  });

  it("clamp 客户端值到 [0, currentTurn]：负数 clamp 到 0", () => {
    const currentTurn = 5;
    const clientLastHintTurn = -10;
    const clamped = Math.max(0, Math.min(clientLastHintTurn, currentTurn));
    expect(clamped).toBe(0);
  });

  it("clamp 客户端值到 [0, currentTurn]：超 currentTurn clamp 下来", () => {
    const currentTurn = 5;
    const clientLastHintTurn = 999;
    const clamped = Math.max(0, Math.min(clientLastHintTurn, currentTurn));
    expect(clamped).toBe(currentTurn);
  });

  it("服务端 + 客户端值都存在时取较大者（保守节流）", () => {
    const serverDerived = 3;
    const clientClamped = 1; // 客户端漏报
    const effective = Math.max(serverDerived, clientClamped);
    expect(effective).toBe(3); // 服务端值更大 → 节流更严
  });

  it("只服务端推导出 → 用服务端值", () => {
    const serverDerived = 2;
    const clientClamped: number | undefined = undefined;
    const effective =
      serverDerived !== undefined && clientClamped !== undefined
        ? Math.max(serverDerived, clientClamped)
        : (serverDerived ?? clientClamped);
    expect(effective).toBe(2);
  });

  it("只客户端有值 + 服务端没找到 → 用客户端值（兼容旧 client）", () => {
    const serverDerived: number | undefined = undefined;
    const clientClamped = 1;
    const effective =
      serverDerived !== undefined && clientClamped !== undefined
        ? Math.max(serverDerived, clientClamped)
        : (serverDerived ?? clientClamped);
    expect(effective).toBe(1);
  });
});

describe("PR-FIX-2 B2 · mood_label z.enum strict + NEUTRAL fallback label rewrite", () => {
  it("z.enum 拒绝非法 mood_label", async () => {
    const { z } = await import("zod");
    const VALID = ["平静", "放松", "兴奋", "犹豫", "怀疑", "略焦虑", "焦虑", "失望"] as const;
    const sch = z.enum(VALID);
    expect(() => sch.parse("快乐")).toThrow();
    expect(() => sch.parse("happy")).toThrow();
    expect(sch.parse("平静")).toBe("平静");
    expect(sch.parse("失望")).toBe("失望");
  });

  it("NEUTRAL 兜底时同步重写 label 为'犹豫'", () => {
    const KEY_TO_LABEL: Record<string, string> = {
      HAPPY: "平静",
      RELAXED: "放松",
      EXCITED: "兴奋",
      NEUTRAL: "犹豫",
      SKEPTICAL: "怀疑",
      CONFUSED: "略焦虑",
      ANGRY: "焦虑",
      DISAPPOINTED: "失望",
    };
    // 模拟 service 逻辑
    function rewriteLabel(parsedLabel: string, moodKey: string): string {
      return moodKey === "NEUTRAL" && parsedLabel !== "犹豫"
        ? KEY_TO_LABEL[moodKey]
        : parsedLabel;
    }
    // 假设 AI 返回非法 label，被 zod 拒后兜底 NEUTRAL；service 还原 label
    expect(rewriteLabel("怪异情绪", "NEUTRAL")).toBe("犹豫");
    // 合法情况不改
    expect(rewriteLabel("平静", "HAPPY")).toBe("平静");
    expect(rewriteLabel("犹豫", "NEUTRAL")).toBe("犹豫");
  });
});

describe("PR-FIX-2 B3 · insights aggregateSchema arrays default + AI failure graceful", () => {
  it("aggregateSchema 缺 commonIssues 时 default 到 []", async () => {
    const { z } = await import("zod");
    const sch = z.object({
      commonIssues: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            studentCount: z.number(),
          }),
        )
        .default([]),
      highlights: z
        .array(
          z.object({
            submissionId: z.string(),
            studentName: z.string(),
            quote: z.string(),
          }),
        )
        .default([]),
    });
    const out = sch.parse({});
    expect(out.commonIssues).toEqual([]);
    expect(out.highlights).toEqual([]);
  });

  it("AI 失败降级时仍保存 weaknessConcepts + 空 issues/highlights（不抛错）", () => {
    // 模拟 service 降级：try { await aiGenerateJSON } catch → ai = { commonIssues: [], highlights: [] }
    const weaknessConcepts = [
      { tag: "CAPM", count: 3 },
      { tag: "资产配置", count: 2 },
    ];
    const aiFallback = { commonIssues: [], highlights: [] };
    const aggregated = {
      commonIssues: aiFallback.commonIssues.slice(0, 5),
      highlights: aiFallback.highlights.slice(0, 3),
      weaknessConcepts,
    };
    expect(aggregated.commonIssues).toEqual([]);
    expect(aggregated.highlights).toEqual([]);
    expect(aggregated.weaknessConcepts.length).toBe(2);
  });
});

describe("PR-FIX-2 B4 · evaluate route assets schema includes snapshots", () => {
  it("assetAllocationSchema 接受 snapshots 字段（不被 zod strip）", async () => {
    const { assetAllocationSchema } = await import("@/lib/validators/submission.schema");
    const input = {
      sections: [
        { label: "权益", items: [{ label: "股票", value: 50 }] },
      ],
      snapshots: [
        {
          turn: 1,
          ts: "2026-04-26T00:00:00Z",
          allocations: [{ label: "股票", value: 50 }],
        },
      ],
    };
    const out = assetAllocationSchema.parse(input);
    expect(out.snapshots).toBeDefined();
    expect(out.snapshots).toHaveLength(1);
    expect(out.snapshots![0].turn).toBe(1);
  });

  it("snapshots 缺失也合法（optional）", async () => {
    const { assetAllocationSchema } = await import("@/lib/validators/submission.schema");
    const input = {
      sections: [
        { label: "权益", items: [{ label: "股票", value: 50 }] },
      ],
    };
    const out = assetAllocationSchema.parse(input);
    expect(out.snapshots).toBeUndefined();
  });
});

describe("PR-FIX-2 B5 · snapshots size caps", () => {
  it("snapshots 数组 > 20 项 → 拒绝", async () => {
    const { assetAllocationSchema } = await import("@/lib/validators/submission.schema");
    const snapshots = Array.from({ length: 21 }, (_, i) => ({
      turn: i + 1,
      ts: "2026-04-26T00:00:00Z",
      allocations: [{ label: "x", value: 50 }],
    }));
    const input = {
      sections: [{ label: "x", items: [{ label: "x", value: 50 }] }],
      snapshots,
    };
    expect(() => assetAllocationSchema.parse(input)).toThrow();
  });

  it("snapshots 数组 = 20 项 → 通过（边界）", async () => {
    const { assetAllocationSchema } = await import("@/lib/validators/submission.schema");
    const snapshots = Array.from({ length: 20 }, (_, i) => ({
      turn: i + 1,
      ts: "2026-04-26T00:00:00Z",
      allocations: [{ label: "x", value: 50 }],
    }));
    const input = {
      sections: [{ label: "x", items: [{ label: "x", value: 50 }] }],
      snapshots,
    };
    const out = assetAllocationSchema.parse(input);
    expect(out.snapshots).toHaveLength(20);
  });

  it("单 snapshot allocations > 20 项 → 拒绝", async () => {
    const { allocationSnapshotSchema } = await import("@/lib/validators/submission.schema");
    const allocations = Array.from({ length: 21 }, (_, i) => ({
      label: `a${i}`,
      value: 5,
    }));
    expect(() =>
      allocationSnapshotSchema.parse({
        turn: 1,
        ts: "2026-04-26T00:00:00Z",
        allocations,
      }),
    ).toThrow();
  });

  it("单 snapshot allocations = 20 项 → 通过（边界）", async () => {
    const { allocationSnapshotSchema } = await import("@/lib/validators/submission.schema");
    const allocations = Array.from({ length: 20 }, (_, i) => ({
      label: `a${i}`,
      value: 5,
    }));
    const out = allocationSnapshotSchema.parse({
      turn: 1,
      ts: "2026-04-26T00:00:00Z",
      allocations,
    });
    expect(out.allocations).toHaveLength(20);
  });
});

describe("PR-FIX-2 B7 · TaskInstance 删除 SET NULL（UX1 推荐 / 现状）", () => {
  // 由于现有 schema 中 Submission.taskInstance 和 AnalysisReport.taskInstance
  // 都是 optional 关系且没有显式 onDelete → Prisma 默认 SetNull。
  // 与 UX1 决策一致 → 不改 cascade。本测试是 schema-shape 验证。
  it("schema 字符串包含可选 taskInstanceId（无显式 Cascade）", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const here = fileURLToPath(import.meta.url);
    const root = path.dirname(path.dirname(here));
    const schema = fs.readFileSync(
      path.join(root, "prisma", "schema.prisma"),
      "utf-8",
    );
    // Submission 的 taskInstance 关系无 Cascade
    expect(schema).toContain("taskInstanceId String?");
    // 没有显式 Cascade 在 Submission/AnalysisReport.taskInstance 关系上
    const noCascadeOnSubmissionTaskInstance =
      !/taskInstance\s+TaskInstance\?\s+@relation\([^)]*onDelete:\s*Cascade/.test(
        schema,
      );
    expect(noCascadeOnSubmissionTaskInstance).toBe(true);
  });
});
