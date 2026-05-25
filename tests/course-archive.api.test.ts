import { describe, it, expect, vi, beforeEach } from "vitest";

// U2: 归档/恢复/彻底删除/回收站列表 route handler 测试。mock guards + service（薄包装层）。
vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/services/course.service", () => ({
  archiveCourse: vi.fn(),
  restoreCourse: vi.fn(),
  purgeCourse: vi.fn(),
  getArchivedCourses: vi.fn(),
  getCourseWithStructure: vi.fn(),
}));

import { requireRole } from "@/lib/auth/guards";
import {
  archiveCourse,
  restoreCourse,
  purgeCourse,
  getArchivedCourses,
} from "@/lib/services/course.service";
import { DELETE as ARCHIVE } from "@/app/api/lms/courses/[id]/route";
import { POST as RESTORE } from "@/app/api/lms/courses/[id]/restore/route";
import { DELETE as PURGE } from "@/app/api/lms/courses/[id]/purge/route";
import { GET as ARCHIVED_LIST } from "@/app/api/lms/courses/archived/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const ok = (role: string, id = "u-1") =>
  mk(requireRole).mockResolvedValue({ session: { user: { id, role } }, error: null });
const unauth = () =>
  mk(requireRole).mockResolvedValue({
    error: new Response(JSON.stringify({ success: false }), { status: 401 }),
  });

const params = (id: string) => ({ params: Promise.resolve({ id }) });
function jsonReq(method: string, body?: unknown) {
  return new Request("http://localhost/x", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("DELETE /api/lms/courses/[id] (归档)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 未登录", async () => {
    unauth();
    const res = await ARCHIVE(jsonReq("DELETE"), params("c-1"));
    expect(res.status).toBe(401);
    expect(archiveCourse).not.toHaveBeenCalled();
  });

  it("200 归档成功，调 archiveCourse(role 透传)", async () => {
    ok("teacher", "owner-1");
    mk(archiveCourse).mockResolvedValue({ id: "c-1" });
    const res = await ARCHIVE(jsonReq("DELETE"), params("c-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual({ archived: true });
    expect(archiveCourse).toHaveBeenCalledWith("c-1", "owner-1", "teacher");
  });

  it("403 非 owner（service 抛 FORBIDDEN 经 handleServiceError）", async () => {
    ok("teacher", "intruder");
    mk(archiveCourse).mockRejectedValue(new Error("FORBIDDEN"));
    const res = await ARCHIVE(jsonReq("DELETE"), params("c-1"));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/lms/courses/[id]/restore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 未登录", async () => {
    unauth();
    const res = await RESTORE(jsonReq("POST"), params("c-1"));
    expect(res.status).toBe(401);
    expect(restoreCourse).not.toHaveBeenCalled();
  });

  it("200 恢复成功", async () => {
    ok("teacher", "owner-1");
    mk(restoreCourse).mockResolvedValue({ id: "c-1", deletedAt: null });
    const res = await RESTORE(jsonReq("POST"), params("c-1"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ restored: true });
    expect(restoreCourse).toHaveBeenCalledWith("c-1", "owner-1", "teacher");
  });

  it("403 非 owner", async () => {
    ok("teacher", "intruder");
    mk(restoreCourse).mockRejectedValue(new Error("FORBIDDEN"));
    const res = await RESTORE(jsonReq("POST"), params("c-1"));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/lms/courses/[id]/purge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 未登录", async () => {
    unauth();
    const res = await PURGE(jsonReq("DELETE", { confirmTitle: "金融学" }), params("c-1"));
    expect(res.status).toBe(401);
    expect(purgeCourse).not.toHaveBeenCalled();
  });

  it("400 缺 confirmTitle（zod）", async () => {
    ok("teacher", "owner-1");
    const res = await PURGE(jsonReq("DELETE", {}), params("c-1"));
    expect(res.status).toBe(400);
    expect(purgeCourse).not.toHaveBeenCalled();
  });

  it("200 彻底删除成功，confirmTitle 透传", async () => {
    ok("teacher", "owner-1");
    mk(purgeCourse).mockResolvedValue({ chapters: 2, sections: 3, instances: 1, submissions: 5 });
    const res = await PURGE(jsonReq("DELETE", { confirmTitle: "金融学" }), params("c-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.purged).toBe(true);
    expect(json.data.chapters).toBe(2);
    expect(purgeCourse).toHaveBeenCalledWith("c-1", "owner-1", "teacher", "金融学");
  });

  it("400 名称不符（service 抛 PURGE_TITLE_MISMATCH）", async () => {
    ok("teacher", "owner-1");
    mk(purgeCourse).mockRejectedValue(new Error("PURGE_TITLE_MISMATCH"));
    const res = await PURGE(jsonReq("DELETE", { confirmTitle: "错的" }), params("c-1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("PURGE_TITLE_MISMATCH");
  });
});

describe("GET /api/lms/courses/archived", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 未登录", async () => {
    unauth();
    const res = await ARCHIVED_LIST(jsonReq("GET"));
    expect(res.status).toBe(401);
    expect(getArchivedCourses).not.toHaveBeenCalled();
  });

  it("200 返回归档列表，透传 userId/role", async () => {
    ok("teacher", "u-9");
    mk(getArchivedCourses).mockResolvedValue([{ id: "c-1", deletedAt: new Date() }]);
    const res = await ARCHIVED_LIST(jsonReq("GET"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data)).toBe(true);
    expect(getArchivedCourses).toHaveBeenCalledWith("u-9", "teacher", expect.any(Object));
  });
});
