/**
 * PR-DASH-1e · B3 一周洞察 AI 管道
 *
 * 守护点：
 * - service: buildWeeklyInsightPrompt 输入聚合（systemPrompt + userPrompt 含数据）
 * - service: cache hit / force=true 跳缓存
 * - service: AI 失败时降级（不抛，返回空 payload）
 * - API endpoint: 401 unauth / 403 student / 200 teacher
 * - UI: AiSuggestCallout header-chip 模式下，传 onWeeklyInsightClick 显示 button
 * - UI: WeeklyInsightModal 渲染 4 sections + 重新生成按钮
 * - greeting-header 透传 onWeeklyInsightClick
 * - dashboard/page 引入 modal + state + fetch 逻辑
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");

// ============================================
// Service: prompt builder + cache
// ============================================

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    submission: { findMany: vi.fn() },
    scheduleSlot: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateJSON: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";
import {
  __clearWeeklyInsightCache,
  buildWeeklyInsightPrompt,
  computeUpcomingOccurrences,
  generateWeeklyInsight,
  type PromptInput,
} from "@/lib/services/weekly-insight.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  __clearWeeklyInsightCache();
});

describe("buildWeeklyInsightPrompt", () => {
  it("includes window dates + submissions count + upcoming slots in userPrompt", () => {
    const input: PromptInput = {
      windowStart: new Date("2026-04-20T00:00:00Z"),
      windowEnd: new Date("2026-04-27T00:00:00Z"),
      submissions: [
        {
          submissionId: "s1",
          studentId: "u1",
          studentName: "张三",
          classId: "c1",
          className: "金融2024A班",
          courseId: "co1",
          courseTitle: "个人理财",
          chapterTitle: "第二章",
          sectionTitle: "复利",
          taskName: "测验1",
          taskType: "quiz",
          score: 60,
          maxScore: 100,
          feedback: "复利计算公式应用错误",
          conceptTags: ["复利", "资金时间价值"],
        },
      ],
      upcomingSlots: [
        {
          scheduleSlotId: "slot1",
          courseId: "co1",
          courseTitle: "个人理财",
          date: "2026-04-28",
          weekday: "周二",
          time: "10:00-11:30",
          classroom: "教学楼A101",
          className: "金融2024A班",
        },
      ],
    };

    const { systemPrompt, userPrompt } = buildWeeklyInsightPrompt(input);
    expect(systemPrompt).toContain("一周洞察");
    expect(systemPrompt).toContain("严格 JSON");
    expect(userPrompt).toContain("2026-04-20");
    expect(userPrompt).toContain("2026-04-27");
    expect(userPrompt).toContain("张三");
    expect(userPrompt).toContain("个人理财");
    expect(userPrompt).toContain("复利");
    expect(userPrompt).toContain("slotId=slot1");
    expect(userPrompt).toContain("教学楼A101");
    expect(userPrompt).toContain("weakConceptsByCourse");
    expect(userPrompt).toContain("upcomingClassRecommendations");
    expect(userPrompt).toContain("highlightSummary");
  });

  it("renders empty placeholders when no submissions / no slots", () => {
    const input: PromptInput = {
      windowStart: new Date("2026-04-20"),
      windowEnd: new Date("2026-04-27"),
      submissions: [],
      upcomingSlots: [],
    };
    const { userPrompt } = buildWeeklyInsightPrompt(input);
    expect(userPrompt).toContain("0 条");
    expect(userPrompt).toContain("0 节");
  });
});

describe("computeUpcomingOccurrences", () => {
  it("returns empty when no slots", () => {
    const out = computeUpcomingOccurrences([], new Date("2026-04-27"), new Date("2026-05-04"));
    expect(out).toEqual([]);
  });

  it("returns slots that match dayOfWeek within future 7 days", () => {
    // 2026-04-27 is a Monday (day 1)
    const monday = new Date("2026-04-27T00:00:00Z");
    const slots = [
      {
        id: "s1",
        courseId: "co1",
        dayOfWeek: 1, // Monday — should hit on day 0
        slotIndex: 0,
        startWeek: 1,
        endWeek: 18,
        timeLabel: "10:00-11:30",
        classroom: "A101",
        weekType: "all",
        course: {
          id: "co1",
          courseTitle: "个人理财",
          classId: "cl1",
          semesterStartDate: new Date("2026-02-01"),
          class: { id: "cl1", name: "金融2024A班" },
        },
      },
    ];
    const out = computeUpcomingOccurrences(
      slots,
      monday,
      new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000),
    );
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].scheduleSlotId).toBe("s1");
    expect(out[0].weekday).toMatch(/周/);
    expect(out[0].className).toBe("金融2024A班");
  });
});

describe("generateWeeklyInsight cache + force", () => {
  function setupHappyPathMocks() {
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(aiGenerateJSON).mockResolvedValue({
      weakConceptsByCourse: [],
      classDifferences: [],
      studentClusters: [],
      upcomingClassRecommendations: [],
      highlightSummary: "本周教学需关注：暂无重点。",
    });
  }

  it("first call hits AI; second call returns cached without re-calling AI", async () => {
    setupHappyPathMocks();
    const r1 = await generateWeeklyInsight("teacher-1");
    expect(r1.cached).toBe(false);
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(1);

    const r2 = await generateWeeklyInsight("teacher-1");
    expect(r2.cached).toBe(true);
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(1);
  });

  it("force=true skips cache and re-calls AI", async () => {
    setupHappyPathMocks();
    await generateWeeklyInsight("teacher-1");
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(1);

    const r2 = await generateWeeklyInsight("teacher-1", { force: true });
    expect(r2.cached).toBe(false);
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(2);
  });

  it("AI failure → graceful empty payload (no throw)", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(aiGenerateJSON).mockRejectedValue(new Error("AI_PROVIDER_NOT_CONFIGURED: qwen"));

    const r = await generateWeeklyInsight("teacher-2");
    expect(r.payload.weakConceptsByCourse).toEqual([]);
    expect(r.payload.classDifferences).toEqual([]);
    expect(r.payload.studentClusters).toEqual([]);
    expect(r.payload.upcomingClassRecommendations).toEqual([]);
    expect(typeof r.payload.highlightSummary).toBe("string");
    expect(r.payload.highlightSummary.length).toBeGreaterThan(0);
  });

  it("isolates cache by teacherId", async () => {
    setupHappyPathMocks();
    await generateWeeklyInsight("teacher-A");
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(1);

    await generateWeeklyInsight("teacher-B");
    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(2);
  });

  it("aggregates submissions + uses conceptTags from simulationSubmission/quizSubmission/subjectiveSubmission", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([
      {
        id: "s1",
        score: 80,
        maxScore: 100,
        student: { id: "u1", name: "甲" },
        task: { id: "t1", taskName: "Sim 1", taskType: "simulation" },
        taskInstance: {
          class: { id: "cl1", name: "A班" },
          course: { id: "co1", courseTitle: "理财" },
          chapter: null,
          section: null,
        },
        simulationSubmission: {
          conceptTags: ["复利"],
          evaluation: { feedback: "学生在复利环节理解不够深入" },
        },
        quizSubmission: null,
        subjectiveSubmission: null,
      },
    ]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(aiGenerateJSON).mockResolvedValue({
      weakConceptsByCourse: [],
      classDifferences: [],
      studentClusters: [],
      upcomingClassRecommendations: [],
      highlightSummary: "test",
    });

    const r = await generateWeeklyInsight("t1");
    expect(r.submissionCount).toBe(1);

    // 验证传给 AI 的 userPrompt 包含 conceptTags + className + courseTitle
    const callArgs = mk(aiGenerateJSON).mock.calls[0];
    const userPrompt = callArgs[3] as string;
    expect(userPrompt).toContain("复利");
    expect(userPrompt).toContain("A班");
    expect(userPrompt).toContain("理财");
    expect(userPrompt).toContain("学生在复利环节理解不够深入");
  });
});

// ============================================
// API endpoint: 401 / 403 / 200
// ============================================

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

import { requireRole } from "@/lib/auth/guards";
import { GET as weeklyInsightGET } from "@/app/api/lms/weekly-insight/route";
import { NextResponse } from "next/server";

describe("GET /api/lms/weekly-insight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearWeeklyInsightCache();
  });

  it("returns 401 when not logged in", async () => {
    mk(requireRole).mockResolvedValue({
      session: null,
      error: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "未登录，请先登录" } },
        { status: 401 },
      ),
    });
    const req = new Request("http://localhost/api/lms/weekly-insight");
    const res = await weeklyInsightGET(req as unknown as Parameters<typeof weeklyInsightGET>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 403 when student tries", async () => {
    mk(requireRole).mockResolvedValue({
      session: null,
      error: NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "权限不足，无法访问此资源" } },
        { status: 403 },
      ),
    });
    const req = new Request("http://localhost/api/lms/weekly-insight");
    const res = await weeklyInsightGET(req as unknown as Parameters<typeof weeklyInsightGET>[0]);
    expect(res.status).toBe(403);
  });

  it("returns 200 with payload for teacher", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher" } },
      error: null,
    });
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(aiGenerateJSON).mockResolvedValue({
      weakConceptsByCourse: [],
      classDifferences: [],
      studentClusters: [],
      upcomingClassRecommendations: [],
      highlightSummary: "本周教学需关注 demo",
    });
    const req = new Request("http://localhost/api/lms/weekly-insight");
    const res = await weeklyInsightGET(req as unknown as Parameters<typeof weeklyInsightGET>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.payload.highlightSummary).toBe("本周教学需关注 demo");
    expect(json.data.submissionCount).toBe(0);
  });

  it("force=true bypasses cache when teacher hits twice", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher" } },
      error: null,
    });
    mk(prisma.submission.findMany).mockResolvedValue([]);
    mk(prisma.scheduleSlot.findMany).mockResolvedValue([]);
    mk(aiGenerateJSON).mockResolvedValue({
      weakConceptsByCourse: [],
      classDifferences: [],
      studentClusters: [],
      upcomingClassRecommendations: [],
      highlightSummary: "x",
    });

    const req1 = new Request("http://localhost/api/lms/weekly-insight");
    await weeklyInsightGET(req1 as unknown as Parameters<typeof weeklyInsightGET>[0]);
    const req2 = new Request("http://localhost/api/lms/weekly-insight?force=true");
    await weeklyInsightGET(req2 as unknown as Parameters<typeof weeklyInsightGET>[0]);

    expect(mk(aiGenerateJSON)).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// UI sources guard
// ============================================

const aiSuggestSrc = readFileSync(
  resolve(root, "components/teacher-dashboard/ai-suggest-callout.tsx"),
  "utf8",
);
const greetingSrc = readFileSync(
  resolve(root, "components/teacher-dashboard/greeting-header.tsx"),
  "utf8",
);
const modalSrc = readFileSync(
  resolve(root, "components/teacher-dashboard/weekly-insight-modal.tsx"),
  "utf8",
);
const dashboardSrc = readFileSync(
  resolve(root, "app/teacher/dashboard/page.tsx"),
  "utf8",
);
const envExample = readFileSync(resolve(root, ".env.example"), "utf8");

describe("PR-DASH-1e UI guards", () => {
  it("ai-suggest-callout header-chip 接受 onWeeklyInsightClick + weeklyInsightLoading props", () => {
    expect(aiSuggestSrc).toMatch(/onWeeklyInsightClick/);
    expect(aiSuggestSrc).toMatch(/weeklyInsightLoading/);
    // 当 onWeeklyInsightClick 存在时是 button，否则是 Link 兼容老模式
    expect(aiSuggestSrc).toMatch(/<button[\s\S]*?onClick=\{onWeeklyInsightClick\}/);
    expect(aiSuggestSrc).toMatch(/Loader2/);
  });

  it("greeting-header 透传 onWeeklyInsightClick + weeklyInsightLoading", () => {
    expect(greetingSrc).toMatch(/onWeeklyInsightClick/);
    expect(greetingSrc).toMatch(/weeklyInsightLoading/);
  });

  it("weekly-insight-modal 渲染 4 sections + 重新生成按钮", () => {
    expect(modalSrc).toMatch(/本周亮点摘要/);
    expect(modalSrc).toMatch(/各课弱点概念聚合/);
    expect(modalSrc).toMatch(/班级差异/);
    expect(modalSrc).toMatch(/学生聚类/);
    expect(modalSrc).toMatch(/接下来课堂的教学建议/);
    expect(modalSrc).toMatch(/重新生成/);
    expect(modalSrc).toMatch(/关闭/);
    expect(modalSrc).toMatch(/onRegenerate/);
  });

  it("dashboard page 引入 modal + 持有 state + 触发 fetchWeeklyInsight", () => {
    expect(dashboardSrc).toMatch(/WeeklyInsightModal/);
    expect(dashboardSrc).toMatch(/fetchWeeklyInsight/);
    expect(dashboardSrc).toMatch(/handleWeeklyClick/);
    expect(dashboardSrc).toMatch(/handleWeeklyRegenerate/);
    expect(dashboardSrc).toMatch(/\/api\/lms\/weekly-insight/);
    expect(dashboardSrc).toMatch(/force=true/);
  });

  it(".env.example 含 AI_WEEKLY_INSIGHT_PROVIDER + AI_WEEKLY_INSIGHT_MODEL", () => {
    expect(envExample).toMatch(/AI_WEEKLY_INSIGHT_PROVIDER/);
    expect(envExample).toMatch(/AI_WEEKLY_INSIGHT_MODEL/);
  });
});
