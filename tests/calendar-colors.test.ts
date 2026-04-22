import { describe, it, expect } from "vitest";
import { getCourseColor } from "@/lib/utils/calendar-colors";

describe("getCourseColor", () => {
  it("returns same color for same courseId (deterministic)", () => {
    const a = getCourseColor("course-abc-123");
    const b = getCourseColor("course-abc-123");
    expect(a).toEqual(b);
  });

  it("returns different colors for different courseIds (probabilistically — sample)", () => {
    const ids = [
      "c-aaaa-1",
      "c-bbbb-2",
      "c-cccc-3",
      "c-dddd-4",
      "c-eeee-5",
      "c-ffff-6",
    ];
    const hues = new Set(
      ids.map((id) => getCourseColor(id).backgroundColor)
    );
    // At least 4 distinct out of 6 ids is very likely — guards against hash collapse
    expect(hues.size).toBeGreaterThanOrEqual(4);
  });

  it("all fields are non-empty valid CSS color strings", () => {
    const c = getCourseColor("any-id");
    expect(c.backgroundColor).toMatch(/^hsl\(/);
    expect(c.color).toMatch(/^hsl\(/);
    expect(c.borderColor).toMatch(/^hsl\(/);
  });

  it("handles empty string id without throwing", () => {
    expect(() => getCourseColor("")).not.toThrow();
  });
});
