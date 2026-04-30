import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";

export type IngestedDocumentKind = "pdf" | "docx" | "text" | "zip" | "image";
export type IngestedDocumentStatus = "ready" | "ocr_required" | "failed";

export interface IngestedDocumentFile {
  fileName: string;
  kind: IngestedDocumentKind;
  status: IngestedDocumentStatus;
  textLength: number;
  error?: string;
}

export interface IngestedDocumentResult {
  status: IngestedDocumentStatus;
  kind: IngestedDocumentKind;
  text: string;
  files: IngestedDocumentFile[];
  warnings: string[];
  error?: string;
}

interface ExtractDocumentInput {
  buffer: Buffer;
  fileName: string;
  mimeType?: string | null;
  allowOcr?: boolean;
}

const MAX_ZIP_FILES = 30;
const MAX_TEXT_CHARS = 120_000;

export async function extractDocumentText(input: ExtractDocumentInput): Promise<IngestedDocumentResult> {
  const kind = detectDocumentKind(input.fileName, input.mimeType);

  if (kind === "zip") {
    return extractZipText(input);
  }

  let text = "";
  let error: string | undefined;

  try {
    if (kind === "pdf") text = await extractPdfText(input.buffer);
    if (kind === "docx") text = await extractDocxText(input.buffer);
    if (kind === "text") text = extractPlainText(input.buffer);
    if (kind === "image") {
      const ocr = await extractImageTextWithOcr(input);
      return {
        status: ocr.text ? "ready" : "ocr_required",
        kind,
        text: ocr.text,
        files: [
          {
            fileName: input.fileName,
            kind,
            status: ocr.text ? "ready" : "ocr_required",
            textLength: ocr.text.length,
            error: ocr.error,
          },
        ],
        warnings: ocr.error ? [ocr.error] : [],
        error: ocr.error,
      };
    }
  } catch (err) {
    error = errorMessage(err);
  }

  const normalized = normalizeText(text);
  if (isReadableExtractedText(normalized)) {
    const clipped = normalized.slice(0, MAX_TEXT_CHARS);
    return {
      status: "ready",
      kind,
      text: clipped,
      files: [{ fileName: input.fileName, kind, status: "ready", textLength: clipped.length }],
      warnings: clipped.length < normalized.length ? ["文档较长，已截取前 120000 字用于 AI 处理"] : [],
    };
  }

  if (kind === "pdf" || kind === "image") {
    const msg =
      kind === "pdf"
        ? "该 PDF 可能是扫描件或图片型 PDF，当前无法直接提取文字；请配置 OCR provider，或上传可复制文字的 PDF/DOCX。"
        : "图片文字识别未完成；请配置可用的 OCR provider 后重试。";
    return {
      status: "ocr_required",
      kind,
      text: "",
      files: [{ fileName: input.fileName, kind, status: "ocr_required", textLength: 0, error: error || msg }],
      warnings: [error || msg],
      error: error || msg,
    };
  }

  return {
    status: "failed",
    kind,
    text: "",
    files: [{ fileName: input.fileName, kind, status: "failed", textLength: 0, error: error || "无法提取可读文本" }],
    warnings: [],
    error: error || "无法提取可读文本",
  };
}

export function detectDocumentKind(fileName: string, mimeType?: string | null): IngestedDocumentKind {
  const lower = fileName.toLowerCase();
  const type = (mimeType || "").toLowerCase();
  if (type === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  if (type === "application/zip" || type === "application/x-zip-compressed" || lower.endsWith(".zip")) return "zip";
  if (type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(lower)) return "image";
  return "text";
}

async function extractPdfText(buffer: Buffer) {
  const pdf = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await pdf.getText();
    return result.text;
  } finally {
    await pdf.destroy();
  }
}

async function extractDocxText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

function extractPlainText(buffer: Buffer) {
  return buffer.toString("utf-8");
}

async function extractZipText(input: ExtractDocumentInput): Promise<IngestedDocumentResult> {
  const zip = await JSZip.loadAsync(input.buffer);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir).slice(0, MAX_ZIP_FILES);
  const parts: string[] = [];
  const files: IngestedDocumentFile[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    const name = entry.name.split("/").pop() || entry.name;
    const kind = detectDocumentKind(name);
    if (kind === "zip") {
      warnings.push(`${entry.name}: 已跳过嵌套 zip`);
      continue;
    }

    try {
      const buffer = Buffer.from(await entry.async("uint8array"));
      const result = await extractDocumentText({
        buffer,
        fileName: name,
        mimeType: mimeForKind(kind),
        allowOcr: input.allowOcr,
      });
      files.push(...result.files);
      warnings.push(...result.warnings.map((warning) => `${entry.name}: ${warning}`));
      if (result.text) {
        parts.push(`【${entry.name}】\n${result.text}`);
      }
    } catch (err) {
      const msg = errorMessage(err);
      files.push({ fileName: entry.name, kind, status: "failed", textLength: 0, error: msg });
      warnings.push(`${entry.name}: ${msg}`);
    }
  }

  if (Object.values(zip.files).filter((entry) => !entry.dir).length > MAX_ZIP_FILES) {
    warnings.push(`ZIP 文件数量超过 ${MAX_ZIP_FILES}，已只处理前 ${MAX_ZIP_FILES} 个文件`);
  }

  const text = normalizeText(parts.join("\n\n")).slice(0, MAX_TEXT_CHARS);
  if (!text) {
    return {
      status: files.some((file) => file.status === "ocr_required") ? "ocr_required" : "failed",
      kind: "zip",
      text: "",
      files,
      warnings,
      error: "ZIP 中没有可识别的文档文本",
    };
  }

  return {
    status: "ready",
    kind: "zip",
    text,
    files,
    warnings,
  };
}

function mimeForKind(kind: IngestedDocumentKind) {
  if (kind === "pdf") return "application/pdf";
  if (kind === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (kind === "zip") return "application/zip";
  if (kind === "image") return "image/png";
  return "text/plain";
}

async function extractImageTextWithOcr(input: ExtractDocumentInput): Promise<{ text: string; error?: string }> {
  if (input.allowOcr === false) {
    return { text: "", error: "OCR 未启用" };
  }

  const apiKey = process.env.MIMO_API_KEY;
  if (!apiKey) {
    return { text: "", error: "OCR provider 未配置：缺少 MIMO_API_KEY" };
  }

  const baseUrl = (process.env.MIMO_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1").replace(/\/+$/, "");
  const model = process.env.MIMO_OCR_MODEL || "mimo-v2-omni";
  const mimeType = input.mimeType || "image/png";
  const dataUrl = `data:${mimeType};base64,${input.buffer.toString("base64")}`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "请只识别图片中的可见文字，保持原文顺序，不要解释。" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
        max_completion_tokens: 4096,
        thinking: { type: "disabled" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { text: "", error: `OCR provider 返回 ${res.status}: ${body.slice(0, 180)}` };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = normalizeText(json.choices?.[0]?.message?.content || "");
    return text ? { text } : { text: "", error: "OCR provider 未返回可读文本" };
  } catch (err) {
    return { text: "", error: `OCR provider 调用失败：${errorMessage(err)}` };
  }
}

function normalizeText(text: string) {
  return text
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isReadableExtractedText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (/^%PDF-\d/.test(normalized)) return false;
  const artifactHits = [
    /\bobj\b/i,
    /\bendobj\b/i,
    /\bxref\b/i,
    /\btrailer\b/i,
    /\/Type\b/i,
    /\/Filter\b/i,
    /\/Length\b/i,
    /\bstream\b/i,
    /\bendstream\b/i,
  ].reduce((count, pattern) => count + (pattern.test(normalized) ? 1 : 0), 0);
  if (artifactHits >= 3) return false;
  if (normalized.length < 8) return false;
  const objectMarkers = (normalized.match(/\/(Type|Length|Filter|FlateDecode|ObjStm|XObject)\b/g) || []).length;
  const readableChars = (normalized.match(/[\p{Script=Han}A-Za-z0-9，。！？；：、,.!?;:]/gu) || []).length;
  const ratio = readableChars / Math.max(normalized.length, 1);
  return objectMarkers < 6 && ratio > 0.22;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
