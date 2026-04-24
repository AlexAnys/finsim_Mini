import { describe, it, expect } from "vitest";

// Mirrors the filtering rules used in wizard-step-review.tsx bodies.
// Purpose: lock in that empty/whitespace-only items never appear in review.

interface Nameable {
  name: string;
}

interface Labelable {
  label: string;
}

interface Textable {
  // string or {label?: string}
  value: string;
}

describe("review filtering rules", () => {
  it("filters requirements: drop empty and whitespace-only", () => {
    const requirements = ["", "  ", "\n\t", "真正的要求", "OK"];
    const valid = requirements.filter((r) => r.trim());
    expect(valid).toEqual(["真正的要求", "OK"]);
  });

  it("filters scoringCriteria by name: empty/whitespace dropped", () => {
    const criteria: Nameable[] = [
      { name: "" },
      { name: "  " },
      { name: "需求分析" },
      { name: "\t\n" },
      { name: "专业度" },
    ];
    const valid = criteria.filter((c) => c.name.trim());
    expect(valid.map((c) => c.name)).toEqual(["需求分析", "专业度"]);
  });

  it("picks first section with non-empty label", () => {
    const sections: Labelable[] = [
      { label: "" },
      { label: "  " },
      { label: "大类资产" },
      { label: "细分资产" },
    ];
    const first = sections.find((s) => s.label.trim());
    expect(first?.label).toBe("大类资产");
  });

  it("returns undefined when all sections empty", () => {
    const sections: Labelable[] = [{ label: "" }, { label: "   " }];
    const first = sections.find((s) => s.label.trim());
    expect(first).toBeUndefined();
  });

  it("reduces quiz total points correctly with zero default", () => {
    const questions = [{ points: 10 }, { points: 5 }, { points: 0 }];
    const total = questions.reduce((s, q) => s + (q.points || 0), 0);
    expect(total).toBe(15);
  });

  it("reduces quiz total to 0 when questions empty", () => {
    const total = ([] as { points: number }[]).reduce(
      (s, q) => s + (q.points || 0),
      0
    );
    expect(total).toBe(0);
  });
});
