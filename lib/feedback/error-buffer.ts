/**
 * 轻量错误缓冲（客户端）。
 *
 * 收集页面近期的 console.error / window error / unhandledrejection / 失败网络请求，
 * 反馈提交时一并带上，帮助非技术用户「说不清问题，但截图 + 报错能定位」。
 *
 * 设计：模块级环形缓冲（最多 N 条），纯函数核心可单测；
 * 监听器安装由 <FeedbackErrorBuffer/> provider 在客户端挂载时完成（R4：不拖性能）。
 */

export interface CapturedError {
  message: string;
  source?: string;
  at: string; // ISO 时间
}

const MAX_BUFFER = 20;
const buffer: CapturedError[] = [];

/** 记录一条错误（截断超长 message，维持环形上限）。 */
export function recordError(message: string, source?: string): void {
  const trimmed = (message ?? "").toString().slice(0, 2000);
  if (!trimmed) return;
  buffer.push({
    message: trimmed,
    source: source ? source.slice(0, 200) : undefined,
    at: new Date().toISOString(),
  });
  while (buffer.length > MAX_BUFFER) buffer.shift();
}

/** 读取近期错误快照（拷贝，避免外部 mutate）。 */
export function getRecentErrors(): CapturedError[] {
  return buffer.slice();
}

/** 清空（测试用 / 提交成功后可选清理）。 */
export function clearErrors(): void {
  buffer.length = 0;
}

export const __MAX_ERROR_BUFFER = MAX_BUFFER;
