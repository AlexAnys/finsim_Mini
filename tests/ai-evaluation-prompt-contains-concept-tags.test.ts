import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.join(__dirname, "..");

describe("AI evaluation prompts include conceptTags extraction directive (PR-5C)", () => {
  it("ai.service.evaluateSimulation user prompt mentions conceptTags + 3-5 concepts", () => {
    const file = fs.readFileSync(
      path.join(ROOT, "lib/services/ai.service.ts"),
      "utf8"
    );
    expect(file).toContain('"conceptTags": ["核心概念1"');
    expect(file).toMatch(/3-5 个.*概念标签/);
  });

  it("ai.service.evaluateSimulation evaluation schema includes conceptTags optional", () => {
    const file = fs.readFileSync(
      path.join(ROOT, "lib/services/ai.service.ts"),
      "utf8"
    );
    expect(file).toMatch(/conceptTags:\s*z\.array\(z\.string\(\)\)\.optional\(\)/);
  });

  it("ai.service.evaluateSimulation returns conceptTags from result", () => {
    const file = fs.readFileSync(
      path.join(ROOT, "lib/services/ai.service.ts"),
      "utf8"
    );
    expect(file).toContain("result.conceptTags");
    expect(file).toContain("slice(0, 5)");
  });

  it("grading.service.gradeSubjective adds conceptTags to user prompt", () => {
    const file = fs.readFileSync(
      path.join(ROOT, "lib/services/grading.service.ts"),
      "utf8"
    );
    expect(file).toContain("conceptTags");
    expect(file).toMatch(/3-5 个.*概念标签/);
  });

  it("grading.service.gradeSimulation persists conceptTags via updateSubmissionGrade", () => {
    const file = fs.readFileSync(
      path.join(ROOT, "lib/services/grading.service.ts"),
      "utf8"
    );
    expect(file).toContain("conceptTags: evaluation.conceptTags");
  });
});
