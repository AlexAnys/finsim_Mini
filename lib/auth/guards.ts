import { auth } from "@/lib/auth/auth.config";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

export { assertCourseAccess } from "@/lib/auth/course-access";

/**
 * 服务端获取 session（用于 Server Components 和 Route Handlers）
 */
export async function getSession() {
  return await auth();
}

/**
 * 验证用户已登录，返回 session。未登录返回 401 JSON 响应。
 */
export async function requireAuth(): Promise<
  | { session: Session; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await auth();

  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "未登录，请先登录" },
        },
        { status: 401 }
      ),
    };
  }

  return { session, error: null };
}

/**
 * 验证用户角色。角色不匹配返回 403 JSON 响应。
 */
export async function requireRole(
  roles: string[]
): Promise<
  | { session: Session; error: null }
  | { session: null; error: NextResponse }
> {
  const result = await requireAuth();

  if (result.error) {
    return result;
  }

  const { session } = result;

  if (!roles.includes(session.user.role)) {
    return {
      session: null,
      error: NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "权限不足，无法访问此资源" },
        },
        { status: 403 }
      ),
    };
  }

  return { session, error: null };
}
