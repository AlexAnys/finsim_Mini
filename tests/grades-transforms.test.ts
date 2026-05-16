import { describe, it, expect } from "vitest";
import {
  buildByTypeStats,
  buildHeaderStats,
  buildTabCounts,
  buildTrendMap,
  computePercent,
  filterByTab,
  filterReleased,
  joinSubmissions,
  scoreTone,
  type GradeRow,
  type RawSubmissionLite,
  type TaskInstanceLite,
} from "@/lib/utils/grades-transforms";

/**
 * grades-transforms 纯 utils 测试 (拆自 pr-stu-1-grades.test.ts).
 *
 * 覆盖:
 * 1. computePercent / scoreTone: 分数→百分比 + 5 档颜色映射
 * 2. filterReleased / buildHeaderStats: D1 防作弊语义（仅 released 计入聚合）
 * 3. buildByTypeStats: 3 类按 taskType 聚合 + 近 5 次 percent
 * 4. buildTabCounts / filterByTab: tab 计数 + 过滤
 * 5. buildTrendMap: 同 type 上一次对比
 * 6. joinSubmissions: 客户端 join task → course
 *
 * 拆分动机: review-test F-3 — 原文件混 6 个真 unit + 6 个 UI readFileSync grep 守护，
 * grep 守护已删 (锁字符串不锁行为)，pure utils 保留是真信号.
 */

function makeRow(partial: Partial<GradeRow>): GradeRow {
  return {
    id: partial.id ?? "row-1",
    taskId: partial.taskId ?? "t-1",
    taskInstanceId: partial.taskInstanceId ?? "ti-1",
    taskType: partial.taskType ?? "simulation",
    status: partial.status ?? "graded",
    score: partial.score ?? null,
    maxScore: partial.maxScore ?? 100,
    evaluation: partial.evaluation ?? null,
    submittedAt: partial.submittedAt ?? "2026-04-20T10:00:00Z",
    gradedAt: partial.gradedAt ?? null,
    releasedAt: partial.releasedAt ?? null,
    analysisStatus: partial.analysisStatus ?? "pending",
    taskName: partial.taskName ?? "任务",
    instanceTitle: partial.instanceTitle ?? "实例标题",
    courseName: partial.courseName ?? null,
    courseId: partial.courseId ?? null,
    scoringCriteria: partial.scoringCriteria ?? null,
    transcript: partial.transcript ?? null,
  };
}

describe("PR-STU-1 · computePercent + scoreTone", () => {
  it("score=85 / maxScore=100 → 85", () => {
    expect(computePercent(85, 100)).toBe(85);
  });

  it("score=null → null", () => {
    expect(computePercent(null, 100)).toBeNull();
  });

  it("maxScore=0 → null（防 NaN）", () => {
    expect(computePercent(50, 0)).toBeNull();
  });

  it("scoreTone 5 档分布：>=90 success / >=75 primary / >=60 warn / <60 danger / null muted", () => {
    expect(scoreTone(95)).toBe("success");
    expect(scoreTone(80)).toBe("primary");
    expect(scoreTone(65)).toBe("warn");
    expect(scoreTone(40)).toBe("danger");
    expect(scoreTone(null)).toBe("muted");
  });
});

describe("PR-STU-1 · D1 防作弊：filterReleased + buildHeaderStats", () => {
  const rows: GradeRow[] = [
    makeRow({ id: "r1", analysisStatus: "released", score: 90, maxScore: 100 }),
    makeRow({ id: "r2", analysisStatus: "analyzed_unreleased", score: 80, maxScore: 100 }),
    makeRow({ id: "r3", analysisStatus: "pending", score: null }),
    makeRow({ id: "r4", analysisStatus: "released", score: 70, maxScore: 100 }),
  ];

  it("filterReleased 仅留 released && score!=null 的行", () => {
    const f = filterReleased(rows);
    expect(f).toHaveLength(2);
    expect(f.map((r) => r.id)).toEqual(["r1", "r4"]);
  });

  it("buildHeaderStats 3 数：total=4, released=2, avg=80", () => {
    const h = buildHeaderStats(rows);
    expect(h.totalCount).toBe(4);
    expect(h.releasedCount).toBe(2);
    expect(h.avgPercent).toBe(80); // (90+70)/2
  });

  it("无任何 released 时 avg=0 占位", () => {
    const h = buildHeaderStats(rows.filter((r) => r.id === "r2" || r.id === "r3"));
    expect(h.releasedCount).toBe(0);
    expect(h.avgPercent).toBe(0);
  });
});

describe("PR-STU-1 · buildByTypeStats 三类聚合", () => {
  const rows: GradeRow[] = [
    makeRow({ id: "s1", taskType: "simulation", analysisStatus: "released", score: 90, submittedAt: "2026-04-01T00:00:00Z" }),
    makeRow({ id: "s2", taskType: "simulation", analysisStatus: "released", score: 80, submittedAt: "2026-04-02T00:00:00Z" }),
    makeRow({ id: "q1", taskType: "quiz", analysisStatus: "released", score: 75, submittedAt: "2026-04-03T00:00:00Z" }),
    makeRow({ id: "q2", taskType: "quiz", analysisStatus: "analyzed_unreleased", score: 60 }), // 不计入
  ];

  it("3 行（simulation/quiz/subjective），simulation avg=85, quiz avg=75, subjective null", () => {
    const stats = buildByTypeStats(rows);
    expect(stats).toHaveLength(3);
    const sim = stats.find((s) => s.type === "simulation");
    const quiz = stats.find((s) => s.type === "quiz");
    const subj = stats.find((s) => s.type === "subjective");
    expect(sim?.avgPercent).toBe(85);
    expect(sim?.releasedCount).toBe(2);
    expect(quiz?.avgPercent).toBe(75);
    expect(quiz?.releasedCount).toBe(1); // analyzed_unreleased 不计
    expect(subj?.avgPercent).toBeNull();
    expect(subj?.releasedCount).toBe(0);
  });

  it("近 5 次 percent 时间升序（最新在右）", () => {
    const stats = buildByTypeStats(rows);
    const sim = stats.find((s) => s.type === "simulation");
    // s1=2026-04-01 score 90, s2=2026-04-02 score 80
    // 内部按 desc 取前 5 后 reverse → asc：[90, 80]
    expect(sim?.recentPercents).toEqual([90, 80]);
  });
});

describe("PR-STU-1 · buildTabCounts + filterByTab", () => {
  const rows: GradeRow[] = [
    makeRow({ id: "s1", taskType: "simulation" }),
    makeRow({ id: "s2", taskType: "simulation" }),
    makeRow({ id: "q1", taskType: "quiz" }),
    makeRow({ id: "j1", taskType: "subjective" }),
  ];

  it("tab counts: all=4, simulation=2, quiz=1, subjective=1", () => {
    const c = buildTabCounts(rows);
    expect(c.all).toBe(4);
    expect(c.simulation).toBe(2);
    expect(c.quiz).toBe(1);
    expect(c.subjective).toBe(1);
  });

  it("filterByTab(all) 不过滤", () => {
    expect(filterByTab(rows, "all")).toHaveLength(4);
  });

  it("filterByTab(simulation) 仅模拟", () => {
    const f = filterByTab(rows, "simulation");
    expect(f.map((r) => r.id)).toEqual(["s1", "s2"]);
  });
});

describe("PR-STU-1 · buildTrendMap 同类型上次对比", () => {
  it("第二次同 type released → 与第一次的 percent 差", () => {
    const rows: GradeRow[] = [
      makeRow({
        id: "first",
        taskType: "simulation",
        analysisStatus: "released",
        score: 80,
        submittedAt: "2026-04-01T00:00:00Z",
      }),
      makeRow({
        id: "second",
        taskType: "simulation",
        analysisStatus: "released",
        score: 90,
        submittedAt: "2026-04-02T00:00:00Z",
      }),
    ];
    const m = buildTrendMap(rows);
    expect(m["first"]).toBeNull(); // 没有上一次
    expect(m["second"]).toBe(10); // 90 - 80
  });

  it("未公布行 → trend null（不应泄漏对比信息）", () => {
    const rows: GradeRow[] = [
      makeRow({ id: "p", analysisStatus: "pending", score: null }),
    ];
    const m = buildTrendMap(rows);
    expect(m["p"]).toBeNull();
  });

  it("跨 type 不互相影响", () => {
    const rows: GradeRow[] = [
      makeRow({ id: "s", taskType: "simulation", analysisStatus: "released", score: 70, submittedAt: "2026-04-01T00:00:00Z" }),
      makeRow({ id: "q", taskType: "quiz", analysisStatus: "released", score: 90, submittedAt: "2026-04-02T00:00:00Z" }),
    ];
    const m = buildTrendMap(rows);
    expect(m["s"]).toBeNull();
    expect(m["q"]).toBeNull(); // quiz 没有上一次 quiz 比较
  });
});

describe("PR-STU-1 · joinSubmissions 客户端 join", () => {
  const rawItems: RawSubmissionLite[] = [
    {
      id: "sub-1",
      taskId: "t-1",
      taskInstanceId: "ti-1",
      taskType: "simulation",
      status: "graded",
      score: 85,
      maxScore: 100,
      evaluation: { feedback: "好" },
      submittedAt: "2026-04-20T10:00:00Z",
      gradedAt: "2026-04-20T10:30:00Z",
      releasedAt: "2026-04-20T11:00:00Z",
      analysisStatus: "released",
      task: { id: "t-1", taskName: "客户访谈" },
      taskInstance: { id: "ti-1", title: "实例 A" },
    },
    {
      id: "sub-2",
      taskId: "t-2",
      taskInstanceId: "ti-2",
      taskType: "quiz",
      status: "submitted",
      score: null,
      maxScore: null,
      evaluation: null,
      submittedAt: "2026-04-21T10:00:00Z",
      gradedAt: null,
    },
  ];

  const dashboardTasks: TaskInstanceLite[] = [
    {
      id: "ti-1",
      title: "实例 A 标题",
      course: { id: "c-1", courseTitle: "个人理财规划" },
    },
  ];

  it("join 命中：courseName/courseId 落到 row 上", () => {
    const rows = joinSubmissions(rawItems, dashboardTasks);
    expect(rows[0].courseName).toBe("个人理财规划");
    expect(rows[0].courseId).toBe("c-1");
    expect(rows[0].instanceTitle).toBe("实例 A 标题");
    expect(rows[0].analysisStatus).toBe("released");
    expect(rows[0].evaluation).toEqual({ feedback: "好" });
  });

  it("join 未命中（dashboardTasks 缺）→ courseName null + 兜底派生 status", () => {
    const rows = joinSubmissions(rawItems, dashboardTasks);
    const r2 = rows[1];
    expect(r2.courseName).toBeNull();
    expect(r2.courseId).toBeNull();
    expect(r2.analysisStatus).toBe("pending"); // submitted + no releasedAt
  });

  it("dashboard 全空也不 crash", () => {
    const rows = joinSubmissions(rawItems, []);
    expect(rows).toHaveLength(2);
    expect(rows[0].courseName).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// PR-15 bug 6 · joinSubmissions 新增字段：scoringCriteria + transcript
// ─────────────────────────────────────────────────────────────

describe("PR-15 bug 6 · scoringCriteria join (criterion CUID → name 映射真源)", () => {
  it("task.scoringCriteria 数组透传成 row.scoringCriteria", () => {
    const raw: RawSubmissionLite[] = [
      {
        id: "s-1",
        taskId: "t-1",
        taskInstanceId: "ti-1",
        taskType: "simulation",
        status: "graded",
        score: 80,
        maxScore: 100,
        evaluation: null,
        submittedAt: "2026-05-01T00:00:00Z",
        gradedAt: "2026-05-01T01:00:00Z",
        releasedAt: "2026-05-01T02:00:00Z",
        analysisStatus: "released",
        task: {
          id: "t-1",
          taskName: "客户访谈",
          scoringCriteria: [
            { id: "c1", name: "沟通能力", maxPoints: 40, order: 0 },
            { id: "c2", name: "专业知识", maxPoints: 60, order: 1 },
          ],
        },
      },
    ];
    const rows = joinSubmissions(raw, []);
    expect(rows[0].scoringCriteria).toHaveLength(2);
    expect(rows[0].scoringCriteria?.[0]).toEqual({
      id: "c1",
      name: "沟通能力",
      maxPoints: 40,
    });
  });

  it("task.scoringCriteria 缺失 → row.scoringCriteria=null（panel 自动 fallback 到 CUID 显示）", () => {
    const raw: RawSubmissionLite[] = [
      {
        id: "s-1",
        taskId: "t-1",
        taskInstanceId: "ti-1",
        taskType: "simulation",
        status: "submitted",
        score: null,
        maxScore: null,
        evaluation: null,
        submittedAt: "2026-05-01T00:00:00Z",
        gradedAt: null,
      },
    ];
    const rows = joinSubmissions(raw, []);
    expect(rows[0].scoringCriteria).toBeNull();
  });
});

describe("PR-15 bug 6 · transcript defensive filter (Json schema drift 防爆)", () => {
  it("正常 transcript：role+text 全合法 → 透传 + 字段子集", () => {
    const raw: RawSubmissionLite[] = [
      {
        id: "s-1",
        taskId: "t-1",
        taskInstanceId: "ti-1",
        taskType: "simulation",
        status: "graded",
        score: 80,
        maxScore: 100,
        evaluation: null,
        submittedAt: "2026-05-01T00:00:00Z",
        gradedAt: "2026-05-01T01:00:00Z",
        releasedAt: "2026-05-01T02:00:00Z",
        analysisStatus: "released",
        simulationSubmission: {
          // @ts-expect-error 测试用 raw Json shape — joiner 应防御性接受
          transcript: [
            { id: "m1", role: "ai", text: "你好，我想咨询理财", timestamp: "2026-05-01T00:01:00Z", mood: "NEUTRAL" },
            { id: "m2", role: "student", text: "好的，我建议分散投资" },
          ],
        },
      },
    ];
    const rows = joinSubmissions(raw, []);
    expect(rows[0].transcript).toHaveLength(2);
    expect(rows[0].transcript?.[0]).toMatchObject({
      role: "ai",
      text: "你好，我想咨询理财",
      timestamp: "2026-05-01T00:01:00Z",
    });
    // mood 字段不在 GradeRow.transcript 类型里 (defensive subset)
    expect((rows[0].transcript?.[0] as Record<string, unknown>).mood).toBeUndefined();
  });

  it("过滤掉非法 role 与缺 text 的消息（schema drift 防爆）", () => {
    const raw: RawSubmissionLite[] = [
      {
        id: "s-1",
        taskId: "t-1",
        taskInstanceId: "ti-1",
        taskType: "simulation",
        status: "graded",
        score: 80,
        maxScore: 100,
        evaluation: null,
        submittedAt: "2026-05-01T00:00:00Z",
        gradedAt: "2026-05-01T01:00:00Z",
        releasedAt: "2026-05-01T02:00:00Z",
        analysisStatus: "released",
        simulationSubmission: {
          // @ts-expect-error 测试用 raw Json shape
          transcript: [
            { id: "m1", role: "ai", text: "合法" },
            { id: "m2", role: "system", text: "未来枚举值" }, // 过滤
            { id: "m3", role: "student", text: null }, // 过滤
            { id: "m4", role: "student" }, // 过滤
            null, // 过滤
            { id: "m5", role: "student", text: "OK" },
          ],
        },
      },
    ];
    const rows = joinSubmissions(raw, []);
    expect(rows[0].transcript).toHaveLength(2);
    expect(rows[0].transcript?.map((m) => m.text)).toEqual(["合法", "OK"]);
  });

  it("transcript 缺失 → null（panel 不渲染对话 section）", () => {
    const raw: RawSubmissionLite[] = [
      {
        id: "s-1",
        taskId: "t-1",
        taskInstanceId: "ti-1",
        taskType: "simulation",
        status: "submitted",
        score: null,
        maxScore: null,
        evaluation: null,
        submittedAt: "2026-05-01T00:00:00Z",
        gradedAt: null,
      },
    ];
    const rows = joinSubmissions(raw, []);
    expect(rows[0].transcript).toBeNull();
  });

  it("transcript 非数组 → null（防 schema drift 把 array 改成 object）", () => {
    const raw: RawSubmissionLite[] = [
      {
        id: "s-1",
        taskId: "t-1",
        taskInstanceId: "ti-1",
        taskType: "simulation",
        status: "graded",
        score: 80,
        maxScore: 100,
        evaluation: null,
        submittedAt: "2026-05-01T00:00:00Z",
        gradedAt: "2026-05-01T01:00:00Z",
        releasedAt: "2026-05-01T02:00:00Z",
        analysisStatus: "released",
        simulationSubmission: {
          // @ts-expect-error 测试用故意非法 shape
          transcript: { messages: [] },
        },
      },
    ];
    const rows = joinSubmissions(raw, []);
    expect(rows[0].transcript).toBeNull();
  });
});

