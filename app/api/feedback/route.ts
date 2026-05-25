import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { createFeedback, listFeedback } from "@/lib/services/feedback.service";
import { FEEDBACK_SCREENSHOT_MAX_CHARS } from "@/lib/feedback/constants";

const recentErrorSchema = z.object({
  message: z.string().max(2000),
  source: z.string().max(200).optional(),
  at: z.string().max(40).optional(),
});

const createFeedbackSchema = z.object({
  type: z.enum(["issue", "feature"]),
  content: z.string().min(1, "请填写反馈内容").max(5000),
  pageUrl: z.string().max(2000),
  // 截图为客户端降采样后的 base64 dataURL，可空（采集失败/过大 → 客户端传 null，优雅降级）。
  // max 是硬防线：正常客户端已保证 ≤ 上限，此处仅拦异常/恶意超大 payload（守 R2 DB 膨胀）。
  screenshot: z.string().max(FEEDBACK_SCREENSHOT_MAX_CHARS).optional().nullable(),
  recentErrors: z.array(recentErrorSchema).max(20).optional(),
  viewport: z.string().max(40).optional().nullable(),
  userAgent: z.string().max(1000).optional().nullable(),
});

/**
 * POST /api/feedback —— 任意登录用户提交反馈（报告问题 / 想要功能）。
 */
export async function POST(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("反馈内容不合法", parsed.error.flatten());
    }

    const { user } = result.session;
    const feedback = await createFeedback(parsed.data, {
      id: user.id,
      role: user.role,
    });
    return created({ id: feedback.id });
  } catch (err) {
    return handleServiceError(err);
  }
}

/**
 * GET /api/feedback?status=&type=&take=&skip= —— 管理员收件箱列表。
 */
export async function GET(request: NextRequest) {
  const result = await requireRole(["admin"]);
  if (result.error) return result.error;

  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const typeParam = url.searchParams.get("type");
    const take = Math.min(Number.parseInt(url.searchParams.get("take") ?? "100", 10) || 100, 200);
    const skip = Math.max(Number.parseInt(url.searchParams.get("skip") ?? "0", 10) || 0, 0);

    const data = await listFeedback(
      {
        status: statusParam === "new" || statusParam === "handled" ? statusParam : undefined,
        type: typeParam === "issue" || typeParam === "feature" ? typeParam : undefined,
      },
      { take, skip },
    );
    return success(data);
  } catch (err) {
    return handleServiceError(err);
  }
}
