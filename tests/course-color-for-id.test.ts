import { describe, it, expect } from "vitest";
import { courseColorForId } from "@/lib/design/tokens";

describe("courseColorForId", () => {
  it("returns a tag key for normal string id", () => {
    const key = courseColorForId("e6fc049c-756f-4442-86da-35a6cdbadd6e");
    expect([
      "tagA",
      "tagB",
      "tagC",
      "tagD",
      "tagE",
      "tagF",
    ]).toContain(key);
  });

  it("is deterministic for the same id", () => {
    const a = courseColorForId("course-123");
    const b = courseColorForId("course-123");
    expect(a).toBe(b);
  });

  // Unit 6 r2: 源头 null-guard 防 free-form SB post (taskId + courseId 都 null) 崩
  it("returns default tagA for null", () => {
    expect(courseColorForId(null)).toBe("tagA");
  });

  it("returns default tagA for undefined", () => {
    expect(courseColorForId(undefined)).toBe("tagA");
  });

  it("returns default tagA for empty string", () => {
    expect(courseColorForId("")).toBe("tagA");
  });
});
