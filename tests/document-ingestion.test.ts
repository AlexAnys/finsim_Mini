import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";

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
