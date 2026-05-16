import { vi } from "vitest";
import type { Session } from "next-auth";

/**
 * 共享 user / session fixture. ID 用 UUID-like 静态值便于 expect 断言.
 */

export type FixtureUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "teacher" | "student";
  classId: string | null;
};

export const fixtureUsers = {
  admin: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "admin@finsim.edu.cn",
    name: "系统管理员",
    role: "admin",
    classId: null,
  },
  teacher1: {
    id: "00000000-0000-4000-8000-000000000010",
    email: "teacher1@finsim.edu.cn",
    name: "王教授",
    role: "teacher",
    classId: null,
  },
  teacher2: {
    id: "00000000-0000-4000-8000-000000000011",
    email: "teacher2@finsim.edu.cn",
    name: "李教授",
    role: "teacher",
    classId: null,
  },
  studentA1: {
    id: "00000000-0000-4000-8000-000000000100",
    email: "student1@finsim.edu.cn",
    name: "张三",
    role: "student",
    classId: "00000000-0000-4000-8000-0000000000a1",
  },
  studentA2: {
    id: "00000000-0000-4000-8000-000000000101",
    email: "student2@finsim.edu.cn",
    name: "李四",
    role: "student",
    classId: "00000000-0000-4000-8000-0000000000a1",
  },
  studentB1: {
    id: "00000000-0000-4000-8000-000000000110",
    email: "student5@finsim.edu.cn",
    name: "陈七",
    role: "student",
    classId: "00000000-0000-4000-8000-0000000000b1",
  },
} as const satisfies Record<string, FixtureUser>;

export const fixtureClasses = {
  classA: { id: "00000000-0000-4000-8000-0000000000a1", name: "金融2024A班" },
  classB: { id: "00000000-0000-4000-8000-0000000000b1", name: "金融2024B班" },
} as const;

/** 包装成 next-auth Session shape */
export function makeSession(user: FixtureUser): Session {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      classId: user.classId,
    } as Session["user"],
    expires: "2099-12-31T23:59:59.999Z",
  };
}

/** requireAuth/requireRole 返回值 (success path) */
export function mockAuthResult(user: FixtureUser) {
  return { session: makeSession(user), error: null };
}

/** requireAuth/requireRole 返回值 (failure path): 401/403 NextResponse-like */
export function mockAuthError(status: 401 | 403, code: string, message: string) {
  return {
    session: null,
    error: new Response(
      JSON.stringify({ success: false, error: { code, message } }),
      { status, headers: { "Content-Type": "application/json" } },
    ),
  };
}

/** 配合 vi.mocked(requireAuth) 用 — 一次性 setup */
export function setupAuthMock(
  requireAuthMock: ReturnType<typeof vi.fn>,
  requireRoleMock: ReturnType<typeof vi.fn>,
  user: FixtureUser | null,
) {
  if (user === null) {
    const err = mockAuthError(401, "UNAUTHORIZED", "未登录，请先登录");
    requireAuthMock.mockResolvedValue(err);
    requireRoleMock.mockResolvedValue(err);
  } else {
    const ok = mockAuthResult(user);
    requireAuthMock.mockResolvedValue(ok);
    requireRoleMock.mockResolvedValue(ok);
  }
}
