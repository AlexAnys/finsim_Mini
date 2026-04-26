import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/guards";
import {
  createSubmission,
  getSubmissions,
  stripSubmissionForStudent,
  deriveAnalysisStatus,
} from "@/lib/services/submission.service";
import { gradeSubmission } from "@/lib/services/grading.service";
import { createSubmissionSchema } from "@/lib/validators/submission.schema";
import {
  assertTaskInstanceReadable,
  assertTaskReadable,
} from "@/lib/auth/resource-access";
import { prisma } from "@/lib/db/prisma";
import { success, created, validationError, handleServiceError, error } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const result = await requireRole(["student"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = createSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const data = parsed.data;
    const { user } = result.session;

    // PR-FIX-1 A2: 学生提交必须指定 taskInstanceId（防对未分配 task 提交）
    if (!data.taskInstanceId) {
      throw new Error("TASK_INSTANCE_REQUIRED");
    }
    // 守护：assertTaskInstanceReadable 会校验 student.classId === instance.classId + status==="published"
    await assertTaskInstanceReadable(data.taskInstanceId, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });

    // 服务端从 instance 派生权威 taskId/taskType（不信任客户端）
    const inst = await prisma.taskInstance.findUnique({
      where: { id: data.taskInstanceId },
      select: { taskId: true, taskType: true },
    });
    if (!inst) throw new Error("TASK_INSTANCE_NOT_FOUND");
    if (inst.taskId !== data.taskId) throw new Error("FORBIDDEN");
    if (inst.taskType !== data.taskType) throw new Error("FORBIDDEN");

    const submission = await createSubmission(user.id, data);

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

  const { user } = result.session;

  // 学生只能看自己的
  const effectiveStudentId =
    user.role === "student" ? user.id : studentId;

  // 防止广扫：必须至少提供一个范围限定（taskInstanceId / taskId / studentId 之一）
  if (!taskInstanceId && !taskId && !effectiveStudentId) {
    return error("FORBIDDEN", "必须提供 taskInstanceId / taskId / studentId 之一", 403);
  }

  try {
    // 教师/管理员若按 taskInstanceId 拉列表，必须验证对该实例有访问权
    if (taskInstanceId && user.role !== "student") {
      await assertTaskInstanceReadable(taskInstanceId, {
        id: user.id,
        role: user.role,
        classId: user.classId,
      });
    }
    // 教师/管理员若按 taskId 拉列表，必须验证对该 task 有访问权
    if (taskId && user.role !== "student") {
      await assertTaskReadable(taskId, {
        id: user.id,
        role: user.role,
        classId: user.classId,
      });
    }

    const data = await getSubmissions({
      taskInstanceId,
      studentId: effectiveStudentId,
      taskId,
      status,
      page,
      pageSize,
    });
    // PR-SIM-1a D1: 学生看列表时也要剥离未公布的 score/evaluation/conceptTags
    // 教师列表加 analysisStatus 字段供 UI 显示"已分析未公布"标签
    const items = data.items.map((it) => {
      if (user.role === "student") {
        return stripSubmissionForStudent(it as unknown as Record<string, unknown>);
      }
      return {
        ...it,
        analysisStatus: deriveAnalysisStatus({
          status: String(it.status),
          releasedAt: it.releasedAt,
        }),
      };
    });
    return success({ ...data, items });
  } catch (err) {
    return handleServiceError(err);
  }
}
