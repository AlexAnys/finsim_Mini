/**
 * Route 三角 — Group 4a: Study Buddy posts (2 routes × 3 = 6 case)
 *
 * 覆盖:
 *   POST /api/study-buddy/posts (codex r1-r4 自由问 cross-course leak 主战场)
 *   DELETE /api/study-buddy/posts/[id]
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixtureUsers, mockAuthResult, mockAuthError } from "../_fixtures/users";
import { buildJsonRequest, makeRouteContext } from "../_fixtures/requests";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/services/study-buddy.service", () => ({
  createPost: vi.fn(),
  listStudyBuddyPosts: vi.fn(),
  hideStudyBuddyPost: vi.fn(),
  continueConversation: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/guards";
import {
  createPost,
  hideStudyBuddyPost,
} from "@/lib/services/study-buddy.service";

import { POST as postsPOST } from "@/app/api/study-buddy/posts/route";
import { DELETE as postsDELETE } from "@/app/api/study-buddy/posts/[id]/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const POST_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/study-buddy/posts (free-form question)", () => {
  it("200: student 发自由问 (无 taskId) 成功", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentA1));
    mk(createPost).mockResolvedValue({ id: POST_ID, title: "smoke" });
    const req = buildJsonRequest("/api/study-buddy/posts", "POST", {
      title: "smoke",
      question: "什么是分散投资",
      mode: "direct",
      anonymous: false,
    });
    const res = await postsPOST(req);
    expect(res.status).toBe(201);
    expect((await res.json()).success).toBe(true);
  });

  it("401: 未登录", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest("/api/study-buddy/posts", "POST", {
      title: "x",
      question: "x",
      mode: "direct",
    });
    const res = await postsPOST(req);
    expect(res.status).toBe(401);
  });

  it("403: 跨班 — student 关联他人 class courseId 被 service 拒", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentA1));
    mk(createPost).mockRejectedValue(new Error("COURSE_ACCESS_DENIED"));
    const req = buildJsonRequest("/api/study-buddy/posts", "POST", {
      title: "x",
      question: "x",
      mode: "direct",
      courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    const res = await postsPOST(req);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/study-buddy/posts/[id]", () => {
  it("200: student 删自己 post 成功", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentA1));
    mk(hideStudyBuddyPost).mockResolvedValue(undefined);
    const req = buildJsonRequest(`/api/study-buddy/posts/${POST_ID}`, "DELETE");
    const res = await postsDELETE(req, makeRouteContext({ id: POST_ID }));
    expect(res.status).toBe(200);
  });

  it("401: 未登录", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthError(401, "UNAUTHORIZED", "未登录"));
    const req = buildJsonRequest(`/api/study-buddy/posts/${POST_ID}`, "DELETE");
    const res = await postsDELETE(req, makeRouteContext({ id: POST_ID }));
    expect(res.status).toBe(401);
  });

  it("403: 跨用户 student 删别人 post 触 service 403", async () => {
    mk(requireAuth).mockResolvedValue(mockAuthResult(fixtureUsers.studentB1));
    mk(hideStudyBuddyPost).mockRejectedValue(new Error("FORBIDDEN"));
    const req = buildJsonRequest(`/api/study-buddy/posts/${POST_ID}`, "DELETE");
    const res = await postsDELETE(req, makeRouteContext({ id: POST_ID }));
    expect(res.status).toBe(403);
  });
});
