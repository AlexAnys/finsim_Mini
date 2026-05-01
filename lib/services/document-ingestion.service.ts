import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
import { execFile } from "child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

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
const DEFAULT_OCR_MAX_PAGES = 20;
const execFileAsync = promisify(execFile);

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

  if (kind === "pdf" && input.allowOcr !== false) {
    const ocr = await extractPdfTextWithOcr(input);
    const ocrText = normalizeText(ocr.text);
    if (isReadableExtractedText(ocrText)) {
      const clipped = ocrText.slice(0, MAX_TEXT_CHARS);
      return {
        status: "ready",
        kind,
        text: clipped,
        files: [{ fileName: input.fileName, kind, status: "ready", textLength: clipped.length }],
        warnings: [
          "该 PDF 通过 OCR 识别文字",
          ...(clipped.length < ocrText.length ? ["文档较长，已截取前 120000 字用于 AI 处理"] : []),
        ],
      };
    }
    error = ocr.error || error;
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

async function extractPdfTextWithOcr(input: ExtractDocumentInput): Promise<{ text: string; error?: string }> {
  const provider = resolveOcrProvider();
  if (!provider) {
    return { text: "", error: "OCR provider 未配置：请设置 OCR_PROVIDER=qwen 和 QWEN_API_KEY" };
  }

  let tempDir: string | null = null;
  try {
    tempDir = await mkdtemp(join(tmpdir(), "finsim-ocr-"));
    const pdfPath = join(tempDir, "input.pdf");
    const outputPrefix = join(tempDir, "page");
    await writeFile(pdfPath, input.buffer);
    await execFileAsync("pdftoppm", [
      "-png",
      "-f",
      "1",
      "-l",
      String(resolveOcrMaxPages()),
      pdfPath,
      outputPrefix,
    ]);

    const pageFiles = (await readdir(tempDir))
      .filter((name) => /^page-\d+\.png$/.test(name) || /^page\d+\.png$/.test(name))
      .sort((a, b) => pageNumber(a) - pageNumber(b));

    if (pageFiles.length === 0) {
      return { text: "", error: "PDF OCR 失败：未能渲染出可识别页面" };
    }

    const parts: string[] = [];
    const errors: string[] = [];
    for (const file of pageFiles) {
      const pageBuffer = await readFile(join(tempDir, file));
      const result =
        provider === "qwen"
          ? await extractImageTextWithQwenOcr({
              buffer: pageBuffer,
              fileName: file,
              mimeType: "image/png",
              allowOcr: input.allowOcr,
            })
          : await extractImageTextWithMimoOcr({
              buffer: pageBuffer,
              fileName: file,
              mimeType: "image/png",
              allowOcr: input.allowOcr,
            });
      if (result.text) parts.push(`【第 ${pageNumber(file)} 页】\n${result.text}`);
      if (result.error) errors.push(`第 ${pageNumber(file)} 页：${result.error}`);
    }

    const text = normalizeText(parts.join("\n\n"));
    return text ? { text } : { text: "", error: errors[0] || "PDF OCR 未返回可读文本" };
  } catch (err) {
    const message = errorMessage(err);
    if (/ENOENT|pdftoppm/i.test(message)) {
      return { text: "", error: "PDF OCR 需要安装 poppler-utils / pdftoppm 才能渲染扫描件页面" };
    }
    return { text: "", error: `PDF OCR 失败：${message}` };
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function pageNumber(fileName: string) {
  const match = fileName.match(/page-?(\d+)\.png$/);
  return match ? Number(match[1]) : 0;
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

  const provider = resolveOcrProvider();
  if (provider === "qwen") return extractImageTextWithQwenOcr(input);
  if (provider === "mimo") return extractImageTextWithMimoOcr(input);
  return { text: "", error: "OCR provider 未配置：请设置 OCR_PROVIDER=qwen 和 QWEN_API_KEY" };
}

function resolveOcrProvider(): "qwen" | "mimo" | null {
  const configured = (process.env.OCR_PROVIDER || "").trim().toLowerCase();
  if (configured === "qwen") return "qwen";
  if (configured === "mimo") return "mimo";
  if (process.env.QWEN_API_KEY) return "qwen";
  if (process.env.MIMO_API_KEY) return "mimo";
  return null;
}

function resolveOcrMaxPages() {
  const parsed = Number(process.env.OCR_MAX_PAGES || DEFAULT_OCR_MAX_PAGES);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_OCR_MAX_PAGES;
  return Math.min(Math.floor(parsed), 80);
}

async function extractImageTextWithQwenOcr(input: ExtractDocumentInput): Promise<{ text: string; error?: string }> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return { text: "", error: "OCR provider 未配置：缺少 QWEN_API_KEY" };
  }

  const baseUrl = (process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/+$/, "");
  const model = process.env.QWEN_OCR_MODEL || "qwen-vl-ocr";
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
              { type: "text", text: "请只识别图片中的可见文字，保持原文顺序。不要解释，不要补充。" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { text: "", error: `Qwen OCR 返回 ${res.status}: ${body.slice(0, 180)}` };
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = normalizeText(json.choices?.[0]?.message?.content || "");
    return text ? { text } : { text: "", error: "Qwen OCR 未返回可读文本" };
  } catch (err) {
    return { text: "", error: `Qwen OCR 调用失败：${errorMessage(err)}` };
  }
}

async function extractImageTextWithMimoOcr(input: ExtractDocumentInput): Promise<{ text: string; error?: string }> {
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
