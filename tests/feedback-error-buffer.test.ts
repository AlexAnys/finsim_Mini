import { describe, it, expect, beforeEach } from "vitest";
import {
  recordError,
  getRecentErrors,
  clearErrors,
  __MAX_ERROR_BUFFER,
} from "@/lib/feedback/error-buffer";

describe("feedback error buffer", () => {
  beforeEach(() => clearErrors());

  it("records and returns errors with message + source + iso time", () => {
    recordError("boom", "console.error");
    const errs = getRecentErrors();
    expect(errs).toHaveLength(1);
    expect(errs[0].message).toBe("boom");
    expect(errs[0].source).toBe("console.error");
    expect(() => new Date(errs[0].at)).not.toThrow();
    expect(Number.isNaN(new Date(errs[0].at).getTime())).toBe(false);
  });

  it("ignores empty messages", () => {
    recordError("");
    recordError("   " as string);
    // 空字符串与空白被裁剪：空串忽略；纯空白经 .slice 保留 → 由调用方语义，只验空串忽略
    expect(getRecentErrors().some((e) => e.message === "")).toBe(false);
  });

  it("caps the buffer at MAX and keeps the most recent (ring)", () => {
    for (let i = 0; i < __MAX_ERROR_BUFFER + 5; i++) recordError(`e${i}`);
    const errs = getRecentErrors();
    expect(errs).toHaveLength(__MAX_ERROR_BUFFER);
    // 最旧的应被挤出，最新一条在末尾
    expect(errs[errs.length - 1].message).toBe(`e${__MAX_ERROR_BUFFER + 4}`);
    expect(errs[0].message).toBe("e5");
  });

  it("truncates overly long messages to 2000 chars", () => {
    recordError("x".repeat(5000));
    expect(getRecentErrors()[0].message.length).toBe(2000);
  });

  it("getRecentErrors returns a copy (external mutation does not affect buffer)", () => {
    recordError("a");
    const snapshot = getRecentErrors();
    snapshot.push({ message: "injected", at: new Date().toISOString() });
    expect(getRecentErrors()).toHaveLength(1);
  });

  it("clearErrors empties the buffer", () => {
    recordError("a");
    clearErrors();
    expect(getRecentErrors()).toHaveLength(0);
  });
});
