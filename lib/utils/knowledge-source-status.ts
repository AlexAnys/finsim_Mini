export type KnowledgeSourceStatus =
  | "uploaded"
  | "extracting"
  | "ocr_required"
  | "ocr_processing"
  | "processing"
  | "ai_summary_failed"
  | "ready"
  | "failed"
  | string;

const PROGRESS_STATUSES = new Set([
  "uploaded",
  "extracting",
  "ocr_processing",
  "processing",
]);

const RETRYABLE_STATUSES = new Set([
  "ai_summary_failed",
  "failed",
  "ocr_required",
  "ready",
]);

export function isKnowledgeSourceProcessing(status: KnowledgeSourceStatus) {
  return PROGRESS_STATUSES.has(status);
}

export function isKnowledgeSourceRetryable(status: KnowledgeSourceStatus) {
  return RETRYABLE_STATUSES.has(status);
}

export function knowledgeSourceStatusLabel(status: KnowledgeSourceStatus): string {
  switch (status) {
    case "ready":
      return "可用";
    case "ai_summary_failed":
      return "AI 解析失败";
    case "ocr_required":
      return "需 OCR";
    case "failed":
      return "处理失败";
    case "extracting":
      return "正在抽取文本";
    case "ocr_processing":
      return "OCR 识别中";
    case "processing":
      return "AI 正在解析";
    case "uploaded":
      return "排队中";
    default:
      return "处理中";
  }
}

export function knowledgeSourceProgressPercent(status: KnowledgeSourceStatus): number {
  switch (status) {
    case "uploaded":
      return 15;
    case "extracting":
      return 35;
    case "ocr_processing":
      return 50;
    case "processing":
      return 70;
    case "ai_summary_failed":
      return 90;
    case "ready":
      return 100;
    case "ocr_required":
    case "failed":
      return 0;
    default:
      return 25;
  }
}

export function knowledgeSourceRetryLabel(status: KnowledgeSourceStatus): string {
  return status === "ready" ? "重新解析素材" : "重新 AI 解析";
}
