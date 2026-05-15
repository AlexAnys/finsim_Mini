import { describe, it, expect } from "vitest";
import { validateFile } from "@/lib/services/storage.service";

describe("validateFile — Phase3-B LEGACY_DOC_UNSUPPORTED", () => {
  it(".doc (application/msword) → LEGACY_DOC_UNSUPPORTED + 中文文案", () => {
    const r = validateFile("application/msword", 1024, ["document"]);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("LEGACY_DOC_UNSUPPORTED");
    expect(r.error).toContain("暂不支持旧版 .doc 格式");
    expect(r.error).toContain("另存为 .docx");
  });

  it(".docx 仍然接受", () => {
    const r = validateFile(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      1024,
      ["document"],
    );
    expect(r.valid).toBe(true);
    expect(r.code).toBeUndefined();
  });

  it("pdf 仍然接受", () => {
    const r = validateFile("application/pdf", 1024, ["document"]);
    expect(r.valid).toBe(true);
  });

  it("超大文件 → 不暴露 LEGACY_DOC_UNSUPPORTED (返回 size 错误)", () => {
    const big = 30 * 1024 * 1024;
    const r = validateFile("application/msword", big, ["document"]);
    expect(r.valid).toBe(false);
    // size check 先于 type check
    expect(r.error).toContain("文件大小不能超过 20MB");
    expect(r.code).toBeUndefined();
  });

  it("其他不支持类型仍返回通用错误", () => {
    const r = validateFile("application/x-shockwave-flash", 1024, [
      "document",
    ]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("不支持的文件类型");
    expect(r.code).toBeUndefined();
  });
});
