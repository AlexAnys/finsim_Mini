import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * PR-COURSE-1+2 · 课程编辑器联合改造（C1 + C2）
 *
 * 静态守护：
 * - C1 方向 A 落地：BlockEditPanel 不再被 page.tsx 引用，inline 编辑由
 *   InlineSectionRow / ChapterSectionList 承担。
 * - C2 整合：/teacher/tasks/new 路由删除（page.tsx 文件不存在），
 *   wizard 资产搬到 components/teacher-course-edit/task-wizard-modal.tsx。
 * - 旧 caller 链接已改：app/teacher/tasks/page.tsx 不再 link `/teacher/tasks/new`。
 * - 中文 UI 守护：关键文案 "添加任务" / "未命名小节" / "前往课程添加任务"
 *   出现在对应文件。
 *
 * E2E 真 curl 流程见 build report.r1（teacher1 cookie POST tasks → instances →
 * publish 200 闭环）。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(rel: string): string {
  return fs.readFileSync(path.join(projectRoot, rel), "utf-8");
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(projectRoot, rel));
}

describe("PR-COURSE-1+2 · C1 块编辑器去整列（方向 A · inline 编辑）", () => {
  it("app/teacher/courses/[id]/page.tsx 不再 import BlockEditPanel", () => {
    const src = readFile("app/teacher/courses/[id]/page.tsx");
    expect(src).not.toMatch(/from\s+["'].*block-edit-panel["']/);
    expect(src).not.toContain("<BlockEditPanel");
  });

  it("page.tsx 不再使用 3-列 lg:grid-cols-[220px_minmax(0,1fr)_280px] 布局", () => {
    const src = readFile("app/teacher/courses/[id]/page.tsx");
    // C1 方向 A 删除右侧 280px 整列；保留 220px TOC + 中间内容两列
    expect(src).not.toMatch(/220px_minmax\(0,1fr\)_280px/);
    expect(src).toMatch(/220px_minmax\(0,1fr\)\]/);
  });

  it("InlineSectionRow 组件存在并实现 inline 标题编辑", () => {
    expect(exists("components/teacher-course-edit/inline-section-row.tsx")).toBe(true);
    const src = readFile("components/teacher-course-edit/inline-section-row.tsx");
    expect(src).toContain("InlineSectionRow");
    // 双击/点击编辑 + Enter 保存 + Escape 取消
    expect(src).toContain("setEditingTitle(true)");
    expect(src).toMatch(/e\.key\s*===\s*["']Enter["']/);
    expect(src).toMatch(/e\.key\s*===\s*["']Escape["']/);
    // BlockEditorDispatch 仍被复用（block-editors 子组件不动）
    expect(src).toContain("BlockEditorDispatch");
  });

  it("ChapterSectionList 组件存在并 render InlineSectionRow", () => {
    expect(exists("components/teacher-course-edit/chapter-section-list.tsx")).toBe(true);
    const src = readFile("components/teacher-course-edit/chapter-section-list.tsx");
    expect(src).toContain("ChapterSectionList");
    expect(src).toContain("InlineSectionRow");
  });

  it("page.tsx 直接渲染 ChapterSectionList（替代原 Table 矩阵）", () => {
    const src = readFile("app/teacher/courses/[id]/page.tsx");
    expect(src).toContain("<ChapterSectionList");
    // 原 Table 矩阵已经撤掉
    expect(src).not.toMatch(/<TableHeader[\s\S]{0,400}slotLabels\[slot\]/);
  });
});

describe("PR-COURSE-1+2 · C2 任务向导整合（modal · 删 /teacher/tasks/new）", () => {
  it("/teacher/tasks/new 路由文件已删除", () => {
    expect(exists("app/teacher/tasks/new/page.tsx")).toBe(false);
    expect(exists("app/teacher/tasks/new")).toBe(false);
  });

  it("TaskWizardModal 组件存在并复用既有 wizard 4 步组件", () => {
    expect(exists("components/teacher-course-edit/task-wizard-modal.tsx")).toBe(true);
    const src = readFile("components/teacher-course-edit/task-wizard-modal.tsx");
    expect(src).toContain("TaskWizardModal");
    // 4 步组件仍 import 自 components/task-wizard/*
    for (const comp of [
      "WizardStepper",
      "WizardStepType",
      "WizardStepBasic",
      "WizardStepSim",
      "WizardStepQuiz",
      "WizardStepSubjective",
      "WizardStepReview",
      "AIQuizDialog",
    ]) {
      expect(src).toContain(comp);
    }
    // 原子接口避免 tasks → task-instances → publish 三步留下半成品
    expect(src).toContain('"/api/lms/task-instances/with-task"');
    expect(src).not.toContain('"/api/tasks"');
    expect(src).not.toContain('"/api/lms/task-instances"');
    expect(src).not.toMatch(/\/api\/lms\/task-instances\/[^"]+\/publish/);
  });

  it("page.tsx 引入 TaskWizardModal 并通过 onAddTask 触发", () => {
    const src = readFile("app/teacher/courses/[id]/page.tsx");
    expect(src).toContain("TaskWizardModal");
    expect(src).toContain("handleAddTask");
    expect(src).toContain("setWizardOpen(true)");
  });

  it("InlineSectionRow 在每个 slot 单元格暴露 '+ 任务' 按钮调用 onAddTask", () => {
    const src = readFile("components/teacher-course-edit/inline-section-row.tsx");
    expect(src).toContain("onAddTask(chapter.id, section.id, slot)");
    // 中文文案 + aria-label
    expect(src).toContain("aria-label={`在${SLOT_LABEL[slot]}添加任务`}");
  });
});

describe("PR-COURSE-1+2 · caller 链接清理 + 文案", () => {
  it("app/teacher/tasks/page.tsx 不再 Link 到 /teacher/tasks/new", () => {
    const src = readFile("app/teacher/tasks/page.tsx");
    expect(src).not.toContain('href="/teacher/tasks/new"');
    // 改为前往课程
    expect(src).toContain('href="/teacher/courses"');
    expect(src).toContain("前往课程添加任务");
  });

  it("源代码（非 .next / .harness）不再有 /teacher/tasks/new 路由引用（除文档注释）", () => {
    const dirs = ["app", "components", "lib"];
    let routeRefs = 0;
    function walk(p: string) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        for (const f of fs.readdirSync(p)) {
          if (f === "node_modules" || f === ".next" || f.startsWith(".")) continue;
          walk(path.join(p, f));
        }
      } else if (/\.(tsx?|jsx?)$/.test(p)) {
        const text = fs.readFileSync(p, "utf-8");
        // 路由形式只能是 href="/teacher/tasks/new" 或 router.push("/teacher/tasks/new")
        if (
          text.match(/href=["']\/teacher\/tasks\/new["']/) ||
          text.match(/router\.push\(["']\/teacher\/tasks\/new["']/)
        ) {
          routeRefs += 1;
        }
      }
    }
    for (const d of dirs) {
      walk(path.join(projectRoot, d));
    }
    expect(routeRefs).toBe(0);
  });

  it("wizard modal 中文文案命中关键 UX 词", () => {
    const src = readFile("components/teacher-course-edit/task-wizard-modal.tsx");
    for (const text of ["添加任务", "创建并发布", "课程编辑器"]) {
      expect(src).toContain(text);
    }
  });
});
