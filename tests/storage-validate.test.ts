import { describe, it, expect } from "vitest";
import { validateFile } from "@/lib/services/storage.service";

// PR-B 需求变更（owner 确认，spec 留痕）：彻底支持旧版 .doc —— validateFile 不再拒绝
// application/msword，改为放行（后续由 word-extractor 解析正文）。原 LEGACY_DOC_UNSUPPORTED
// 行为已移除。本测试断言新行为，并保证 .docx/pdf/size/未知类型 回归不破。
describe("validateFile — .doc 全量支持（原 LEGACY_DOC_UNSUPPORTED 已移除）", () => {
  it(".doc (application/msword) → 通过校验，不再返回 LEGACY_DOC_UNSUPPORTED", () => {
    const r = validateFile("application/msword", 1024, ["document"]);
    expect(r.valid).toBe(true);
    expect(r.code).toBeUndefined();
    expect(r.error).toBeUndefined();
  });

  it(".doc 在 word 分类下也通过", () => {
    const r = validateFile("application/msword", 1024, ["word"]);
    expect(r.valid).toBe(true);
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

  it("超大 .doc → size 错误优先（先于类型校验）", () => {
    const big = 30 * 1024 * 1024;
    const r = validateFile("application/msword", big, ["document"]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("文件大小不能超过 20MB");
    expect(r.code).toBeUndefined();
  });

  it("其他不支持类型仍返回通用错误", () => {
    const r = validateFile("application/x-shockwave-flash", 1024, ["document"]);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("不支持的文件类型");
    expect(r.code).toBeUndefined();
  });
});
