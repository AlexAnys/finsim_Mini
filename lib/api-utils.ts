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
    switch (err.message) {
      case "FORBIDDEN":
        return forbidden();
      case "TASK_INSTANCE_NOT_FOUND":
        return notFound("任务实例不存在");
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
      default:
        console.error("Service error:", err);
        return serverError();
    }
  }
  console.error("Unknown error:", err);
  return serverError();
}
