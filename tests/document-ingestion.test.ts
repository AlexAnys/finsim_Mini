import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  extractDocumentText,
  detectDocumentKind,
} from "@/lib/services/document-ingestion.service";

const originalEnv = process.env;

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
});

describe("document ingestion OCR provider selection", () => {
  it("uses Qwen OCR for image inputs when OCR_PROVIDER=qwen", async () => {
    process.env.OCR_PROVIDER = "qwen";
    process.env.QWEN_API_KEY = "test-qwen-key";
    process.env.QWEN_BASE_URL = "https://dashscope.example/v1";
    process.env.QWEN_OCR_MODEL = "qwen-vl-ocr";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "第一章 个人理财基础" } }],
        }),
        { status: 200 },
      ),
    );

    const result = await extractDocumentText({
      buffer: Buffer.from("fake-image"),
      fileName: "scan.png",
      mimeType: "image/png",
    });

    expect(result.status).toBe("ready");
    expect(result.text).toContain("个人理财基础");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-qwen-key",
        }),
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe("qwen-vl-ocr");
    expect(body.messages[0].content[1].image_url.url).toContain("data:image/png;base64,");
  });

  it("returns ocr_required when Qwen OCR is selected but missing key", async () => {
    process.env.OCR_PROVIDER = "qwen";
    delete process.env.QWEN_API_KEY;
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await extractDocumentText({
      buffer: Buffer.from("fake-image"),
      fileName: "scan.png",
      mimeType: "image/png",
    });

    expect(result.status).toBe("ocr_required");
    expect(result.error).toContain("QWEN_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// PR-B：旧版 .doc (OLE2) 全量支持 —— word-extractor 纯 JS 解析正文。
describe("document ingestion — 旧版 .doc 解析", () => {
  it("detectDocumentKind：application/msword 或 .doc 扩展名 → \"doc\"，不误伤 .docx", () => {
    expect(detectDocumentKind("x.doc", "application/msword")).toBe("doc");
    expect(detectDocumentKind("x.doc", null)).toBe("doc");
    expect(detectDocumentKind("legacy", "application/msword")).toBe("doc");
    // .docx 仍判 docx（endsWith(".doc") 对 "x.docx" 为 false）
    expect(detectDocumentKind("x.docx", null)).toBe("docx");
    expect(
      detectDocumentKind(
        "x.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
  });

  it("真实 .doc fixture → status ready + 解析出可读中文/英文正文", async () => {
    const buffer = await readFile(join(__dirname, "_fixtures", "sample.doc"));
    const result = await extractDocumentText({
      buffer,
      fileName: "sample.doc",
      mimeType: "application/msword",
    });

    expect(result.kind).toBe("doc");
    expect(result.status).toBe("ready");
    expect(result.text).toContain("FinSim 测试文档");
    expect(result.text).toContain("风险沟通练习");
    expect(result.text).toContain("English text");
    expect(result.text.length).toBeGreaterThan(10);
  });

  it("损坏/非 .doc 内容（仅垃圾字节）→ 优雅 failed + 中文兜底，不抛异常", async () => {
    const result = await extractDocumentText({
      buffer: Buffer.from("this is not a real OLE2 doc file at all"),
      fileName: "broken.doc",
      mimeType: "application/msword",
    });

    expect(result.kind).toBe("doc");
    expect(result.status).toBe("failed");
    expect(result.text).toBe("");
    expect(result.error).toBeTruthy();
    // 中文兜底（不是英文 throw 冒泡）
    expect(/[一-鿿]/.test(result.error || "")).toBe(true);
  });
});
