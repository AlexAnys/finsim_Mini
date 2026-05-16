/**
 * Route 三角 — Group 5: 其他高频热区 (5 routes × 3 = 15 case)
 *
 * 覆盖:
 *   POST /api/lms/tasks/[id]/adaptive-quiz/next (codex r1-r3 多轮主战场)
 *   POST /api/lms/quiz-questions/[id]/check (codex r2 P1-3)
 *   POST /api/ai/study-buddy/reply
 *   PATCH /api/lms/sections/[id]
 *   PATCH /api/lms/chapters/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixtureUsers, mockAuthResult, mockAuthError } from "../_fixtures/users";
import { buildJsonRequest, makeRouteContext } from "../_fixtures/requests";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/resource-access", () => ({
  assertTaskInstanceReadable: vi.fn(),
  assertSectionWritable: vi.fn(),
  assertChapterWritable: vi.fn(),
}));

vi.mock("@/lib/services/course.service", () => ({
  updateSection: vi.fn(),
  deleteSection: vi.fn(),
  updateChapter: vi.fn(),
  deleteChapter: vi.fn(),
}));

vi.mock("@/lib/services/study-buddy.service", () => ({
  continueConversation: vi.fn(),
}));

vi.mock("@/lib/services/quiz-adaptive.service", () => ({
  buildAdaptiveState: vi.fn(),
  buildMasteryReport: vi.fn(),
  selectNextQuestion: vi.fn(),
  shouldStop: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/services/audit.service", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/auth/actor-role", () => ({
  getCourseActorRole: vi.fn().mockResolvedValue("owner"),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    quizQuestion: { findUnique: vi.fn(), findMany: vi.fn() },
    quizConfig: { findUnique: vi.fn() },
    task: { findUnique: vi.fn() },
    taskInstance: { findUnique: vi.fn() },
    section: { findUnique: vi.fn() },
    chapter: { findUnique: vi.fn() },
  },
}));

import { requireAuth, requireRole } from "@/lib/auth/guards";
import {
  assertTaskInstanceReadable,
  assertSectionWritable,
  assertChapterWritable,
} from "@/lib/auth/resource-access";
import { continueConversation } from "@/lib/services/study-buddy.service";
import {
  selectNextQuestion,
  buildAdaptiveState,
} from "@/lib/services/quiz-adaptive.service";
import { updateSection, updateChapter } from "@/lib/services/course.service";
import { prisma } from "@/lib/db/prisma";

import { POST as adaptiveNextPOST } from "@/app/api/lms/tasks/[id]/adaptive-quiz/next/route";
import { POST as quizCheckPOST } from "@/app/api/lms/quiz-questions/[id]/check/route";
import { POST as sbReplyPOST } from "@/app/api/ai/study-buddy/reply/route";
import { PATCH as sectionPATCH } from "@/app/api/lms/sections/[id]/route";
import { PATCH as chapterPATCH } from "@/app/api/lms/chapters/[id]/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const Q_ID = "11111111-2222-4333-8444-555555555555";
const POST_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SEC_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const CH_ID = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/lms/tasks/[id]/adaptive-quiz/next", () => {
  it("200: student 拿下一题", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentA1));
    mk(assertTaskInstanceReadable).mockResolvedValue(undefined);
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ taskId: TASK_ID });
    mk(prisma.task.findUnique).mockResolvedValue({
      id: TASK_ID,
      taskType: "quiz",
      quizConfig: {
        mode: "adaptive",
        maxQuestions: 8,
        startDifficulty: 5,
        difficultyStep: 1,
      },
      quizQuestions: [
        {
          id: Q_ID,
          type: "single_choice",
          prompt: "Q1",
          options: [{ id: "a", text: "A" }],
          points: 10,
          knowledgeTagIds: ["k1"],
          difficulty: 5,
          order: 0,
        },
      ],
    });
    mk(buildAdaptiveState).mockReturnValue({ ability: 0, answeredIds: new Set(), abilities: new Map() });
    mk(selectNextQuestion).mockReturnValue({ id: Q_ID, prompt: "Q1", options: [] });
    const req = buildJsonRequest(`/api/lms/tasks/${TASK_ID}/adaptive-quiz/next`, "POST", {
      taskInstanceId: INST_ID,
      history: [],
    });
    const res = await adaptiveNextPOST(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/tasks/${TASK_ID}/adaptive-quiz/next`, "POST", {
      taskInstanceId: INST_ID,
      history: [],
    });
    const res = await adaptiveNextPOST(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 跨班 student 触 assertTaskInstanceReadable 403", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentB1));
    mk(assertTaskInstanceReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/lms/tasks/${TASK_ID}/adaptive-quiz/next`, "POST", {
      taskInstanceId: INST_ID,
      history: [],
    });
    const res = await adaptiveNextPOST(req, makeRouteContext({ id: TASK_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/lms/quiz-questions/[id]/check", () => {
  it("200: student 判定单题答对", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentA1));
    mk(assertTaskInstanceReadable).mockResolvedValue(undefined);
    mk(prisma.quizQuestion.findUnique).mockResolvedValue({
      taskId: TASK_ID,
      type: "single_choice",
      correctOptionIds: ["c"],
      correctAnswer: null,
    });
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ taskId: TASK_ID });
    const req = buildJsonRequest(`/api/lms/quiz-questions/${Q_ID}/check`, "POST", {
      taskInstanceId: INST_ID,
      selectedOptionIds: ["c"],
    });
    const res = await quizCheckPOST(req, makeRouteContext({ id: Q_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/quiz-questions/${Q_ID}/check`, "POST", {
      taskInstanceId: INST_ID,
    });
    const res = await quizCheckPOST(req, makeRouteContext({ id: Q_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 跨班 student 触 assertTaskInstanceReadable 403 (codex r2 P1-3)", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentB1));
    mk(assertTaskInstanceReadable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/lms/quiz-questions/${Q_ID}/check`, "POST", {
      taskInstanceId: INST_ID,
    });
    const res = await quizCheckPOST(req, makeRouteContext({ id: Q_ID }));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/ai/study-buddy/reply", () => {
  it("200: student 继续对话成功", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentA1));
    mk(continueConversation).mockResolvedValue({ id: "msg-1", role: "ai", content: "回复" });
    const req = buildJsonRequest("/api/ai/study-buddy/reply", "POST", {
      postId: POST_ID,
      content: "继续问",
    });
    const res = await sbReplyPOST(req);
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/ai/study-buddy/reply", "POST", {
      postId: POST_ID,
      content: "x",
    });
    const res = await sbReplyPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: 跨用户 — service 拒绝", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentB1));
    mk(continueConversation).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest("/api/ai/study-buddy/reply", "POST", {
      postId: POST_ID,
      content: "x",
    });
    const res = await sbReplyPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/lms/sections/[id]", () => {
  it("200: owner teacher 改 section title", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertSectionWritable).mockResolvedValue(undefined);
    mk(prisma.section.findUnique).mockResolvedValue({ courseId: "course-1" });
    mk(updateSection).mockResolvedValue({ id: SEC_ID, title: "新名" });
    const req = buildJsonRequest(`/api/lms/sections/${SEC_ID}`, "PATCH", { title: "新名" });
    const res = await sectionPATCH(req, makeRouteContext({ id: SEC_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/sections/${SEC_ID}`, "PATCH", { title: "x" });
    const res = await sectionPATCH(req, makeRouteContext({ id: SEC_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 assertSectionWritable 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertSectionWritable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/lms/sections/${SEC_ID}`, "PATCH", { title: "x" });
    const res = await sectionPATCH(req, makeRouteContext({ id: SEC_ID }));
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/lms/chapters/[id]", () => {
  it("200: owner teacher 改 chapter title", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher1));
    mk(assertChapterWritable).mockResolvedValue(undefined);
    mk(prisma.chapter.findUnique).mockResolvedValue({ courseId: "course-1" });
    mk(updateChapter).mockResolvedValue({ id: CH_ID, title: "新章节" });
    const req = buildJsonRequest(`/api/lms/chapters/${CH_ID}`, "PATCH", { title: "新章节" });
    const res = await chapterPATCH(req, makeRouteContext({ id: CH_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireRole).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/lms/chapters/${CH_ID}`, "PATCH", { title: "x" });
    const res = await chapterPATCH(req, makeRouteContext({ id: CH_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 非 owner teacher 触 assertChapterWritable 403", async () => {
    mk(requireRole).mockResolvedValue(mockAuthResult(fixtureUsers.teacher2));
    mk(assertChapterWritable).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/lms/chapters/${CH_ID}`, "PATCH", { title: "x" });
    const res = await chapterPATCH(req, makeRouteContext({ id: CH_ID }));
    expect(res.status).toBe(403);
  });
});
