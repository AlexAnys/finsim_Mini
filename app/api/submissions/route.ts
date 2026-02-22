import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import { createSubmission, getSubmissions } from "@/lib/services/submission.service";
import { gradeSubmission } from "@/lib/services/grading.service";
import { createSubmissionSchema } from "@/lib/validators/submission.schema";
import { success, created, validationError, handleServiceError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireRole(["student"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const submission = await createSubmission(result.session.user.id, parsed.data);

    // 异步触发 AI 批改
    gradeSubmission(submission.id).catch(console.error);

    return created(submission);
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const taskInstanceId = searchParams.get("taskInstanceId") || undefined;
  const studentId = searchParams.get("studentId") || undefined;
  const taskId = searchParams.get("taskId") || undefined;
  const status = searchParams.get("status") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");

  // 学生只能看自己的
  const effectiveStudentId =
    result.session.user.role === "student"
      ? result.session.user.id
      : studentId;

  try {
    const data = await getSubmissions({
      taskInstanceId,
      studentId: effectiveStudentId,
      taskId,
      status,
      page,
      pageSize,
    });
    return success(data);
  } catch (err) {
    return handleServiceError(err);
  }
}
