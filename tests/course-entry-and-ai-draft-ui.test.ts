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
    expect(src).toContain('TabsTrigger value="contexts"');
    expect(src).toContain('TabsTrigger value="analytics"');
    expect(src).toContain("<CourseInstancesTab courseId={courseId} />");
    expect(src).toContain("<CourseContextSourcesTab");
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
    expect(assistant).toContain("application/pdf,.pdf");
    expect(assistant).toContain(".docx");
    expect(assistant).toContain(".zip");
    expect(assistant).toContain("image/png");
  });

  it("adds a course detail context-materials tab for teacher managed context", () => {
    const tab = readFile("components/course/course-context-sources-tab.tsx");
    const service = readFile("lib/services/study-buddy.service.ts");

    expect(tab).toContain("教学上下文素材");
    expect(tab).toContain("任务定位");
    expect(tab).toContain("/api/lms/course-knowledge-sources");
    expect(tab).toContain("application/pdf,.pdf");
    expect(tab).toContain(".docx");
    expect(tab).toContain(".zip");
    expect(tab).toContain("image/png");
    expect(service).toContain("getKnowledgeSourcesForStudyBuddy");
    expect(service).toContain("教师补充课程素材");
  });
});
