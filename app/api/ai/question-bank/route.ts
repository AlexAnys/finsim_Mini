import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { handleServiceError, success, validationError } from "@/lib/api-utils";
import { enqueueAsyncJob } from "@/lib/services/async-job.service";
import { assertKnowledgeSourceScope } from "@/lib/services/course-knowledge-source.service";
import {
  parseQuestionBankRequest,
  runQuestionBankProcessing,
  type QuestionBankRequest,
} from "@/lib/services/question-bank.service";
import { getTaskBuildDraft, updateTaskBuildDraft } from "@/lib/services/task-build-draft.service";

export async function POST(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = parseQuestionBankRequest(body);
    if (!parsed.success) return validationError("请求参数错误", parsed.error.flatten());

    const user = result.session.user;
    const data = parsed.data;
    const action = normalizeAction(data.action);

    await assertCourseAccess(data.courseId, user.id, user.role);
    await assertKnowledgeSourceScope({
      courseId: data.courseId,
      chapterId: data.chapterId,
      sectionId: data.sectionId,
    });

    const validationMessage = validateQuestionBankRequest(action, data);
    if (validationMessage) return validationError(validationMessage);

    if (isAsyncQuestionBankRequest(body)) {
      if (!data.draftId) return validationError("异步题库导入需要先保存任务草稿");
      const draft = await getTaskBuildDraft(data.draftId);
      if (draft.courseId !== data.courseId) return validationError("任务草稿与当前课程不匹配");

      const jobInput = {
        ...data,
        action,
      } satisfies Record<string, unknown>;
      const job = await enqueueAsyncJob({
        type: "task_import_parse",
        entityType: "taskBuildDraft",
        entityId: data.draftId,
        input: jobInput as Prisma.InputJsonValue,
        createdBy: user.id,
      });

      await updateTaskBuildDraft(data.draftId, {
        status: "queued",
        progress: 0,
        sourceIds: data.sourceIds,
        asyncJobId: job.id,
        error: null,
      });

      return success({ draftId: data.draftId, job });
    }

    const processed = await runQuestionBankProcessing({ ...data, action }, user.id);
    return success(processed);
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      return validationError("AI 返回格式不完整，请重试或改用手动导入", formatParseError(err));
    }
    return handleServiceError(err);
  }
}

function normalizeAction(action: QuestionBankRequest["action"]): "import" | "checkOptimize" {
  return action === "check" || action === "optimize" ? "checkOptimize" : action;
}

function validateQuestionBankRequest(action: "import" | "checkOptimize", data: QuestionBankRequest) {
  if (action === "import" && data.sourceIds.length === 0) {
    return "请先选择要导入的课程素材";
  }
  if (action === "checkOptimize" && data.sourceIds.length === 0 && data.questions.length === 0) {
    return "请先选择素材或添加题目后再质检优化";
  }
  return null;
}

function isAsyncQuestionBankRequest(body: unknown) {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) && (body as { async?: unknown }).async);
}

function formatParseError(err: unknown) {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  }
  return err instanceof Error ? err.message : String(err);
}
