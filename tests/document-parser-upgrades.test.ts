import { describe, expect, it } from "vitest";
import { extractDocumentText } from "@/lib/services/document-ingestion.service";
import { docxBuffer, financialText, spreadsheetBuffer } from "./_fixtures/document-buffers";

describe("real document parsing after security patches", () => {
  it("extracts a real Chinese DOCX without changing its evidence text", async () => {
    const result = await extractDocumentText({ buffer: await docxBuffer(), fileName: "报告.docx" });
    expect(result.status).toBe("ready");
    expect(result.text).toBe(financialText);
    expect(result.warnings).toEqual([]);
  });

  it("preserves valid text when a DOCX element contains many attributes", async () => {
    const result = await extractDocumentText({ buffer: await docxBuffer({ attributes: 2000 }), fileName: "多属性.docx" });
    expect(result.status).toBe("ready");
    expect(result.text).toBe(financialText);
  });

  it("rejects the malformed XML end tag that older xmldom silently accepted", async () => {
    const result = await extractDocumentText({ buffer: await docxBuffer({ malformedEndTag: true }), fileName: "损坏.docx" });
    expect(result.status).toBe("failed");
    expect(result.text).toBe("");
  });

  it.each([ ["xlsx", "xlsx"], ["biff8", "xls"], ["csv", "csv"] ] as const)("extracts Chinese text and amounts from %s", async (bookType, extension) => {
    const result = await extractDocumentText({ buffer: spreadsheetBuffer(bookType), fileName: `配置.${extension}` });
    expect(result.status).toBe("ready");
    expect(result.text).toContain(financialText);
    expect(result.text).toContain("现金,25000");
    expect(result.text).toContain("股票,75000");
  });

  it.each(["docx", "xlsx"])("fails closed for a truncated ZIP disguised as %s", async extension => {
    const result = await extractDocumentText({ buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), fileName: `坏文件.${extension}` });
    expect(result.status).toBe("failed");
    expect(result.text).toBe("");
  });
});
