/**
 * 反馈功能共享常量（客户端 + 服务端通用，**不 import prisma**，可安全进客户端 bundle）。
 */

/**
 * 截图 base64 dataURL 的 **store-limit**（约 700KB）—— 入库体积上限（R2 防 DB 膨胀）。
 *
 * 契约（AC5 + AC12 修订）：
 * - 客户端：降采样/压缩后仍超此上限 → 丢图传 null + 轻提示，其余字段照常提交。
 * - 服务端（AC12 LIVE 兜底）：**超此上限丢图传 null，但反馈照常落库**（绝不因截图大小 400 拒反馈）。
 * 即此上限只决定「截图存不存」，**不决定「反馈收不收」**。
 */
export const FEEDBACK_SCREENSHOT_MAX_CHARS = 700_000;

/**
 * 截图字段的 **宽松 DoS 上限**（约 12MB 字符）—— route 层 Zod 仅用它拦绝对异常/恶意超大 payload。
 *
 * AC12：store-limit 与 DoS-limit 分离 —— 介于两者之间的截图由 service 丢图但保住反馈（201）；
 * 仅超过此 DoS 上限的畸形 payload 才在 Zod 层 400（防内存/带宽滥用）。远大于正常客户端产出。
 */
export const FEEDBACK_SCREENSHOT_DOS_LIMIT = 12_000_000;
