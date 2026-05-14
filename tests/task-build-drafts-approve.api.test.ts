import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/services/task-build-draft.service", () => ({
  approveTaskBuildDraft: vi.fn(),
  getTaskBuildDraft: vi.fn(),
}));

import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import {
  approveTaskBuildDraft,
  getTaskBuildDraft,
} from "@/lib/services/task-build-draft.service";
import { PATCH } from "@/app/api/lms/task-build-drafts/[id]/approve/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function buildRequest() {
  return new Request("http://localhost/api/lms/task-build-drafts/draft-1/approve", {
    method: "PATCH",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/lms/task-build-drafts/[id]/approve", () => {
  it("returns 401 when no auth session", async () => {
    mk(requireRole).mockResolvedValue({
      error: new Response("Unauthorized", { status: 401 }),
    });

    const res = await PATCH(buildRequest() as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "draft-1" }),
    });
    expect(res.status).toBe(401);
    expect(approveTaskBuildDraft).not.toHaveBeenCalled();
  });

  it("returns 403 when teacher does not own the course", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-other", role: "teacher" } },
      error: null,
    });
    mk(getTaskBuildDraft).mockResolvedValue({ id: "draft-1", courseId: "course-1" });
    mk(assertCourseAccess).mockRejectedValue(new Error("FORBIDDEN"));

    const res = await PATCH(buildRequest() as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "draft-1" }),
    });
    expect(res.status).toBe(403);
    expect(approveTaskBuildDraft).not.toHaveBeenCalled();
  });

  it("approves a ready draft (200) + writes audit via service", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher" } },
      error: null,
    });
    mk(getTaskBuildDraft).mockResolvedValue({
      id: "draft-1",
      courseId: "course-1",
      status: "ready",
    });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(approveTaskBuildDraft).mockResolvedValue({
      id: "draft-1",
      status: "approved",
      approvedBy: "teacher-1",
    });

    const res = await PATCH(buildRequest() as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "draft-1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("approved");
    expect(approveTaskBuildDraft).toHaveBeenCalledWith("draft-1", "teacher-1");
  });

  it("returns 400 Chinese error when draft is not ready (TASK_BUILD_DRAFT_NOT_READY_FOR_APPROVAL)", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher" } },
      error: null,
    });
    mk(getTaskBuildDraft).mockResolvedValue({
      id: "draft-1",
      courseId: "course-1",
      status: "draft",
    });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(approveTaskBuildDraft).mockRejectedValue(
      new Error("TASK_BUILD_DRAFT_NOT_READY_FOR_APPROVAL"),
    );

    const res = await PATCH(buildRequest() as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "draft-1" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("TASK_BUILD_DRAFT_NOT_READY_FOR_APPROVAL");
    expect(json.error.message).toMatch(/审核|批准|草稿/);
  });

  it("returns 404 when draft does not exist", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher" } },
      error: null,
    });
    mk(getTaskBuildDraft).mockRejectedValue(new Error("TASK_BUILD_DRAFT_NOT_FOUND"));

    const res = await PATCH(buildRequest() as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: "missing" }),
    });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toMatch(/草稿|不存在/);
  });
});
