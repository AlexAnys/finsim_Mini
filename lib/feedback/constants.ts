/**
 * 反馈功能共享常量（客户端 + 服务端通用，**不 import prisma**，可安全进客户端 bundle）。
 */

/**
 * 截图 base64 dataURL 字符长度上限（约 700KB）。
 *
 * 契约（AC5 + R2）：**客户端负责保证截图 ≤ 此上限**——降采样/压缩后若仍超限，
 * 客户端丢弃截图（传 null）+ 轻提示，其余字段照常走成功路径提交。
 * Zod（route 层）以同一上限作硬防线，仅拦异常/恶意超大 payload（正常客户端不可达）。
 */
export const FEEDBACK_SCREENSHOT_MAX_CHARS = 700_000;
