import { describe, it, expect } from "vitest";
import {
  normalizeAllowedTypes,
  DEFAULT_ALLOWED_EXTENSIONS,
  IMAGE_EXTENSIONS,
} from "@/components/subjective/subjective-runner";

describe("normalizeAllowedTypes", () => {
  it("returns default fallback when input is undefined", () => {
    expect(normalizeAllowedTypes(undefined)).toEqual(DEFAULT_ALLOWED_EXTENSIONS);
  });

  it("returns default fallback when input is empty array", () => {
    expect(normalizeAllowedTypes([])).toEqual(DEFAULT_ALLOWED_EXTENSIONS);
  });

  it("normalizes case + trim", () => {
    expect(normalizeAllowedTypes(["PDF", "  JPG  ", "Docx"])).toEqual([
      "pdf",
      "jpg",
      "docx",
    ]);
  });

  it("strips leading dot", () => {
    expect(normalizeAllowedTypes([".pdf", ".docx"])).toEqual(["pdf", "docx"]);
  });

  it("teacher 限定 pdf only → 不接受 docx", () => {
    const allowed = normalizeAllowedTypes(["pdf"]);
    expect(allowed.includes("docx")).toBe(false);
    expect(allowed.includes("pdf")).toBe(true);
  });

  it("teacher 允许 pdf+docx+jpg → 三种都通过", () => {
    const allowed = normalizeAllowedTypes(["pdf", "docx", "jpg"]);
    expect(allowed).toEqual(["pdf", "docx", "jpg"]);
  });

  it("filters empty entries after normalization", () => {
    expect(normalizeAllowedTypes(["", "  ", "pdf"])).toEqual(["pdf"]);
  });
});

describe("IMAGE_EXTENSIONS set", () => {
  it("includes common image types", () => {
    expect(IMAGE_EXTENSIONS.has("jpg")).toBe(true);
    expect(IMAGE_EXTENSIONS.has("jpeg")).toBe(true);
    expect(IMAGE_EXTENSIONS.has("png")).toBe(true);
  });

  it("does NOT include doc types", () => {
    expect(IMAGE_EXTENSIONS.has("pdf")).toBe(false);
    expect(IMAGE_EXTENSIONS.has("docx")).toBe(false);
  });
});

// 验证 capture 触发条件：当 allowedTypes 含 image 时应 useCapture
describe("capture 'environment' trigger condition", () => {
  it("teacher 配置仅 pdf → 不应触发 capture", () => {
    const types = normalizeAllowedTypes(["pdf"]);
    const acceptHasImage = types.some((t) => IMAGE_EXTENSIONS.has(t));
    expect(acceptHasImage).toBe(false);
  });

  it("teacher 配置 pdf+jpg → 应触发 capture", () => {
    const types = normalizeAllowedTypes(["pdf", "jpg"]);
    const acceptHasImage = types.some((t) => IMAGE_EXTENSIONS.has(t));
    expect(acceptHasImage).toBe(true);
  });

  it("teacher 配置仅 image → 应触发 capture", () => {
    const types = normalizeAllowedTypes(["jpg", "png"]);
    const acceptHasImage = types.some((t) => IMAGE_EXTENSIONS.has(t));
    expect(acceptHasImage).toBe(true);
  });

  it("默认 fallback (含 jpg/png) → 应触发 capture", () => {
    const types = normalizeAllowedTypes(undefined);
    const acceptHasImage = types.some((t) => IMAGE_EXTENSIONS.has(t));
    expect(acceptHasImage).toBe(true);
  });
});
