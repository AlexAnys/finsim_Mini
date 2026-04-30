import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(rel: string) {
  return fs.readFileSync(path.join(projectRoot, rel), "utf-8");
}

describe("course entry and course-scoped task instances", () => {
  it("course cards keep only the Enter CTA and route it to course detail", () => {
    const src = readFile("components/teacher-courses/teacher-course-card.tsx");

    expect(src).not.toContain("Pencil");
    expect(src).not.toContain("管理");
    expect(src).not.toContain("/teacher/instances?courseId=");
    expect(src).toContain("进入课程处理");
    expect(src).toContain("href={`/teacher/courses/${c.id}`}");
  });

  it("course detail adds the task instances tab between structure and analytics", () => {
    const src = readFile("app/teacher/courses/[id]/page.tsx");

    expect(src).toContain('TabsTrigger value="structure"');
    expect(src).toContain('TabsTrigger value="instances"');
    expect(src).toContain('TabsTrigger value="analytics"');
    expect(src).toContain("<CourseInstancesTab courseId={courseId} />");
  });

  it("global task instances page reuses the shared tab component", () => {
    const src = readFile("app/teacher/instances/page.tsx");

    expect(src).toContain('import { CourseInstancesTab }');
    expect(src).toContain("<CourseInstancesTab showTitle />");
    expect(src).not.toContain("useState");
  });
});

describe("task wizard course-material AI draft integration", () => {
  it("wires the assistant, PDF source API, and context draft API into the wizard", () => {
    const modal = readFile("components/teacher-course-edit/task-wizard-modal.tsx");
    const assistant = readFile("components/task-wizard/knowledge-source-assistant.tsx");

    expect(modal).toContain("KnowledgeSourceAssistant");
    expect(modal).toContain("/api/ai/task-draft/from-context");
    expect(modal).toContain("sourceIds: selectedSourceIds");
    expect(modal).toContain("draftSourceLabel");
    expect(assistant).toContain("/api/lms/course-knowledge-sources");
    expect(assistant).toContain('accept="application/pdf,.pdf"');
  });
});
