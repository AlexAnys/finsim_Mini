import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";
import { createFeedback, listFeedback } from "@/lib/services/feedback.service";
import { FEEDBACK_SCREENSHOT_DOS_LIMIT } from "@/lib/feedback/constants";

const recentErrorSchema = z.object({
  message: z.string().max(2000),
  source: z.string().max(200).optional(),
  at: z.string().max(40).optional(),
});

// r3 AC10/11 定位上下文：结构化、各串限长（生产构建下抓文字/aria/testid，绑定 payload 体积）。
const capturedElementSchema = z.object({
  text: z.string().max(120).optional(),
  ariaLabel: z.string().max(200).optional(),
  testId: z.string().max(120).optional(),
  role: z.string().max(60).optional(),
  domPath: z.string().max(600),
  rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
});
const feedbackContextSchema = z.object({
  sourcePath: z.string().max(300).optional(),
  routeIds: z.record(z.string().max(40), z.string().max(120)).optional(),
  dialog: z.object({ title: z.string().max(160), step: z.string().max(60).optional() }).nullable().optional(),
  pageTitle: z.string().max(300).optional(),
  element: capturedElementSchema.nullable().optional(),
});

const createFeedbackSchema = z.object({
  type: z.enum(["issue", "feature"]),
  content: z.string().min(1, "请填写反馈内容").max(5000),
  pageUrl: z.string().max(2000),
  // 截图为客户端降采样后的 base64 dataURL，可空。AC12：Zod 仅用**宽松 DoS 上限**拦绝对畸形
  // payload（防内存/带宽滥用），**不**用 store-limit 卡 400 —— store-limit 超限由 service 丢图
  // 但反馈照常落库（201），保证「反馈永不因截图大小丢失」。
  screenshot: z.string().max(FEEDBACK_SCREENSHOT_DOS_LIMIT).optional().nullable(),
  recentErrors: z.array(recentErrorSchema).max(20).optional(),
  context: feedbackContextSchema.optional(),
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
