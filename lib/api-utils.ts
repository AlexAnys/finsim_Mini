import { NextResponse } from "next/server";

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return success(data, 201);
}

export function error(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status }
  );
}

export function unauthorized(message = "请先登录") {
  return error("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "权限不足") {
  return error("FORBIDDEN", message, 403);
}

export function notFound(message = "资源不存在") {
  return error("NOT_FOUND", message, 404);
}

export function validationError(message: string, details?: unknown) {
  return error("VALIDATION_ERROR", message, 400, details);
}

export function serverError(message = "服务器内部错误") {
  return error("INTERNAL_ERROR", message, 500);
}

export function handleServiceError(err: unknown) {
  if (err instanceof Error) {
    if (err.message.startsWith("AI_PROVIDER_NOT_CONFIGURED")) {
      return error("AI_NOT_CONFIGURED", "AI 服务未配置", 500);
    }

    const aiProviderError = getAIProviderError(err);
    if (aiProviderError) {
      return error(
        aiProviderError.code,
        aiProviderError.message,
        aiProviderError.status,
        aiProviderError.details,
      );
    }

    switch (err.message) {
      case "FORBIDDEN":
        return forbidden();
      case "COURSE_NOT_FOUND":
        return notFound("课程不存在");
      case "CLASS_NOT_FOUND":
        return notFound("班级不存在");
      case "USER_NOT_FOUND":
        return notFound("用户不存在");
      case "CHAPTER_NOT_FOUND":
        return notFound("章节不存在");
      case "SECTION_NOT_FOUND":
        return notFound("小节不存在");
      case "BLOCK_NOT_FOUND":
        return notFound("内容块不存在");
      case "SECTION_PARENT_MISMATCH":
        return error("SECTION_PARENT_MISMATCH", "小节与章节/课程关系不匹配", 400);
      case "EMPTY_PATCH":
        return error("EMPTY_PATCH", "请至少提供一个可更新字段", 400);
      case "NOT_A_TEACHER":
        return error("NOT_A_TEACHER", "该用户不是教师", 400);
      case "ALREADY_OWNER":
        return error("ALREADY_OWNER", "该用户已是课程创建者", 400);
      case "CANNOT_REMOVE_PRIMARY_CLASS":
        return error("CANNOT_REMOVE_PRIMARY_CLASS", "不能移除课程的主班级", 400);
      case "EMPTY_COURSE_LIST":
        return error("EMPTY_COURSE_LIST", "请至少选择一门课程", 400);
      case "TASK_INSTANCE_NOT_FOUND":
      case "INSTANCE_NOT_FOUND":
        return notFound("任务实例不存在");
      case "TASK_NOT_FOUND":
        return notFound("任务不存在");
      case "SUBMISSION_NOT_FOUND":
        return notFound("提交不存在");
      case "FILE_NOT_FOUND":
        return notFound("文件不存在");
      case "TASK_POST_NOT_FOUND":
        return notFound("讨论不存在");
      case "GROUP_NOT_FOUND":
        return notFound("分组不存在");
      case "GROUP_MEMBER_CLASS_MISMATCH":
        return error("GROUP_MEMBER_CLASS_MISMATCH", "分组成员必须是本班学生", 400);
      case "SUBMISSION_NOT_GRADED":
        return error("SUBMISSION_NOT_GRADED", "提交尚未完成评估，无法公布", 400);
      case "JOB_NOT_FOUND":
        return notFound("导入任务不存在");
      case "TASK_NOT_PUBLISHED":
        return error("TASK_NOT_PUBLISHED", "任务尚未发布", 400);
      case "TASK_OVERDUE":
        return error("TASK_OVERDUE", "任务已过期", 400);
      case "MAX_ATTEMPTS_REACHED":
        return error("MAX_ATTEMPTS_REACHED", "已达到最大提交次数", 400);
      case "INVALID_STATUS":
        return error("INVALID_STATUS", "任务状态不正确", 400);
      case "RATE_LIMIT_EXCEEDED":
        return NextResponse.json(
          { success: false, error: { code: "RATE_LIMIT", message: "请求频率超限，请稍后再试" } },
          { status: 429 }
        );
      case "AI_PROVIDER_NOT_CONFIGURED":
        return error("AI_NOT_CONFIGURED", "AI 服务未配置", 500);
      case "KNOWLEDGE_SOURCE_NOT_FOUND":
        return notFound("课程素材不存在");
      case "KNOWLEDGE_SOURCE_EMPTY":
        return error("KNOWLEDGE_SOURCE_EMPTY", "无法从课程素材中提取文本内容", 400);
      case "KNOWLEDGE_SOURCE_UNREADABLE":
      case "DOCUMENT_OCR_REQUIRED":
        return error(
          "DOCUMENT_OCR_REQUIRED",
          "该文件需要 OCR 才能识别。当前已保留文件，请配置 OCR provider，或上传可复制文字的 PDF/DOCX/TXT。",
          400,
        );
      case "NO_GRADED_SUBMISSIONS":
        return error("NO_GRADED_SUBMISSIONS", "暂无已批改的提交，无法生成洞察", 400);
      case "NO_CONCEPT_TAGS":
        return error("NO_CONCEPT_TAGS", "已批改的提交均未生成概念标签，请等待新批改完成", 400);
      case "CLASS_COURSE_MISMATCH":
        return error("CLASS_COURSE_MISMATCH", "班级不属于该课程", 400);
      case "CHAPTER_COURSE_MISMATCH":
        return error("CHAPTER_COURSE_MISMATCH", "章节不属于该课程", 400);
      case "TASK_INSTANCE_REQUIRED":
        return error("TASK_INSTANCE_REQUIRED", "必须提供任务实例 ID", 400);
      case "AGGREGATE_TOO_FREQUENT":
        return error("AGGREGATE_TOO_FREQUENT", "聚合操作过于频繁，请稍后再试", 429);
      case "AGGREGATE_IN_PROGRESS":
        return error("AGGREGATE_IN_PROGRESS", "聚合任务正在进行，请稍后再试", 429);
      case "AI_TOOL_NOT_FOUND":
        return error("AI_TOOL_NOT_FOUND", "AI 工具不存在", 404);
      case "INPUT_TOO_LARGE":
        return error("INPUT_TOO_LARGE", "输入内容超出长度限制", 400);
      default:
        console.error("Service error:", err);
        return serverError();
    }
  }
  console.error("Unknown error:", err);
  return serverError();
}

function getAIProviderError(err: Error) {
  const maybe = err as Error & {
    name?: string;
    statusCode?: number;
    data?: {
      error?: {
        code?: string;
        type?: string;
        message?: string;
      };
    };
  };
  if (maybe.name !== "AI_APICallError" && typeof maybe.statusCode !== "number") {
    return null;
  }

  const statusCode = maybe.statusCode || 502;
  const providerCode = maybe.data?.error?.code || "";
  const providerType = maybe.data?.error?.type || "";
  const providerMessage = maybe.data?.error?.message || maybe.message;
  const lowerMessage = providerMessage.toLowerCase();
  const isInsufficientBalance =
    statusCode === 402 ||
    providerCode === "402" ||
    providerType.includes("insufficient") ||
    lowerMessage.includes("insufficient account balance");

  if (isInsufficientBalance) {
    return {
      code: "AI_PROVIDER_QUOTA_EXCEEDED",
      message: "AI 服务额度不足，请检查当前模型账号余额或切换备用模型后重试",
      status: 402,
      details: { statusCode, providerCode, providerType },
    };
  }

  return {
    code: "AI_PROVIDER_ERROR",
    message: "AI 服务暂时不可用，请稍后重试",
    status: statusCode >= 400 && statusCode < 500 ? 502 : 503,
    details: { statusCode, providerCode, providerType },
  };
}
