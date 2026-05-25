import { beforeEach, describe, expect, it, vi } from "vitest";

// resolveAdminKey is the seam: we drive its return value / throws per test
// to exercise the route's teacher branch without depending on NODE_ENV.
vi.mock("@/lib/auth/secret", () => ({
  resolveAdminKey: vi.fn(),
  isStudentSelfRegistrationEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    class: { findUnique: vi.fn() },
  },
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn(async () => "hashed-password"),
}));

import { resolveAdminKey } from "@/lib/auth/secret";
import { prisma } from "@/lib/db/prisma";
import { POST } from "@/app/api/auth/register/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function buildRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const teacherBody = {
  email: "newteacher@finsim.edu.cn",
  password: "password123",
  name: "新老师",
  role: "teacher" as const,
  adminKey: "correct-strong-admin-key-1234",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/register — teacher branch admin-key handling", () => {
  it("returns 503 + friendly Chinese (not 500) when ADMIN_KEY is weak/missing", async () => {
    mk(resolveAdminKey).mockImplementation(() => {
      throw new Error("ADMIN_KEY_WEAK");
    });

    const res = await POST(
      buildRequest(teacherBody) as unknown as Parameters<typeof POST>[0]
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("TEACHER_REGISTRATION_UNCONFIGURED");
    expect(json.error.message).toBe("教师注册暂未正确配置，请联系管理员");
    // Config error short-circuits before any DB write.
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("also maps ADMIN_KEY_REQUIRED to the same 503 unconfigured response", async () => {
    mk(resolveAdminKey).mockImplementation(() => {
      throw new Error("ADMIN_KEY_REQUIRED");
    });

    const res = await POST(
      buildRequest(teacherBody) as unknown as Parameters<typeof POST>[0]
    );

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error.code).toBe("TEACHER_REGISTRATION_UNCONFIGURED");
  });

  it("creates the teacher (201) when admin key is configured and matches", async () => {
    mk(resolveAdminKey).mockReturnValue("correct-strong-admin-key-1234");
    mk(prisma.user.findUnique).mockResolvedValue(null);
    mk(prisma.user.create).mockResolvedValue({
      id: "user-new",
      email: "newteacher@finsim.edu.cn",
      name: "新老师",
      role: "teacher",
      classId: null,
      avatarUrl: null,
      createdAt: new Date(),
    });

    const res = await POST(
      buildRequest(teacherBody) as unknown as Parameters<typeof POST>[0]
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.user.role).toBe("teacher");
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
  });

  it("returns 403 INVALID_ADMIN_KEY when key is configured but the input is wrong", async () => {
    mk(resolveAdminKey).mockReturnValue("correct-strong-admin-key-1234");

    const res = await POST(
      buildRequest({
        ...teacherBody,
        adminKey: "wrong-key",
      }) as unknown as Parameters<typeof POST>[0]
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_ADMIN_KEY");
    expect(json.error.message).toBe("教师注册密钥无效");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("still surfaces unexpected errors as 500 (not the 503 config branch)", async () => {
    mk(resolveAdminKey).mockImplementation(() => {
      throw new Error("SOMETHING_ELSE");
    });

    const res = await POST(
      buildRequest(teacherBody) as unknown as Parameters<typeof POST>[0]
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL_ERROR");
  });
});
