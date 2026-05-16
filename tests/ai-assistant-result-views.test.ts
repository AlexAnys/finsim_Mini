import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Unit C1-B · r1b · 4 工具差异化渲染
 * 静态源结构 grep（项目内 vitest 是 node 环境无 React render）。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Unit C1-B r1b · 4 工具差异化渲染 — 文件存在 & 表面", () => {
  it("4 个 result 组件 + atoms 文件存在", () => {
    expect(
      fs.existsSync(
        path.join(projectRoot, "components/ai-assistant/result-atoms.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(projectRoot, "components/ai-assistant/lesson-polish-result.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(projectRoot, "components/ai-assistant/ideology-mining-result.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(projectRoot, "components/ai-assistant/question-analysis-result.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(projectRoot, "components/ai-assistant/exam-check-result.tsx"),
      ),
    ).toBe(true);
  });

  it("4 个组件 export 对应函数 + 标记 data-tool 属性", () => {
    const lp = readFile("components/ai-assistant/lesson-polish-result.tsx");
    expect(lp).toContain("export function LessonPolishResult");
    expect(lp).toContain('data-tool="lessonPolish"');

    const im = readFile("components/ai-assistant/ideology-mining-result.tsx");
    expect(im).toContain("export function IdeologyMiningResult");
    expect(im).toContain('data-tool="ideologyMining"');

    const qa = readFile("components/ai-assistant/question-analysis-result.tsx");
    expect(qa).toContain("export function QuestionAnalysisResult");
    expect(qa).toContain('data-tool="questionAnalysis"');

    const ec = readFile("components/ai-assistant/exam-check-result.tsx");
    expect(ec).toContain("export function ExamCheckResult");
    expect(ec).toContain('data-tool="examCheck"');
  });
});

describe("Unit C1-B r1b · 工具差异化语义 (per spec)", () => {
  it("lessonPolish 渲染 GradingTableBlock（schema 数据非空时显示）", () => {
    const src = readFile("components/ai-assistant/lesson-polish-result.tsx");
    expect(src).toContain("GradingTableBlock");
  });

  it("ideologyMining 不渲染 GradingTableBlock 且含育人目标 callout", () => {
    const src = readFile("components/ai-assistant/ideology-mining-result.tsx");
    expect(src).not.toContain("GradingTableBlock");
    expect(src).toContain("育人目标");
    // 案例表达 highlight（examplesHighlight prop 传递）
    expect(src).toContain("examplesHighlight");
  });

  it("questionAnalysis 不渲染 GradingTableBlock 且 sections label 含 题型/知识点/解题步骤/易错点", () => {
    const src = readFile("components/ai-assistant/question-analysis-result.tsx");
    expect(src).not.toContain("GradingTableBlock");
    expect(src).toContain("题型");
    expect(src).toContain("知识点");
    expect(src).toContain("解题步骤");
    expect(src).toContain("易错点");
  });

  it("examCheck gradingTable 置顶 + sections 用 <details> 折叠", () => {
    const src = readFile("components/ai-assistant/exam-check-result.tsx");
    // gradingTable 在 sections 之前（置顶）
    const gradingIdx = src.indexOf("GradingTableBlock");
    const sectionsIdx = src.indexOf("逐题详细分析");
    expect(gradingIdx).toBeGreaterThan(-1);
    expect(sectionsIdx).toBeGreaterThan(-1);
    expect(gradingIdx).toBeLessThan(sectionsIdx);
    // <details> 折叠
    expect(src).toContain("<details");
    expect(src).toContain("<summary");
  });
});

describe("Unit C1-B r1b · page.tsx 分发", () => {
  it("page.tsx 调用 renderResultByTool 并 import 4 个组件", () => {
    const src = readFile("app/teacher/ai-assistant/page.tsx");
    expect(src).toContain("renderResultByTool");
    expect(src).toContain('from "@/components/ai-assistant/lesson-polish-result"');
    expect(src).toContain('from "@/components/ai-assistant/ideology-mining-result"');
    expect(src).toContain('from "@/components/ai-assistant/question-analysis-result"');
    expect(src).toContain('from "@/components/ai-assistant/exam-check-result"');
  });

  it("renderResultByTool switch 包含 4 个 case", () => {
    const src = readFile("app/teacher/ai-assistant/page.tsx");
    expect(src).toMatch(/case "ideologyMining":/);
    expect(src).toMatch(/case "questionAnalysis":/);
    expect(src).toMatch(/case "examCheck":/);
    expect(src).toMatch(/case "lessonPolish":/);
  });

  it("page.tsx 移除内联结果渲染（不再含原 hardcoded <Label>分段标题</Label>）", () => {
    const src = readFile("app/teacher/ai-assistant/page.tsx");
    expect(src).not.toContain("<Label>分段标题</Label>");
    expect(src).not.toContain("<Label>下一步动作（一行一条）</Label>");
  });
});

describe("Unit C1-B r1b · result-atoms helpers", () => {
  it("atoms export 共享原子 (FileReportsBlock / SectionEditor / GradingTableBlock / TitleAndSummary / ActionItemsAndCautions / linesFromText)", () => {
    const src = readFile("components/ai-assistant/result-atoms.tsx");
    expect(src).toContain("export function FileReportsBlock");
    expect(src).toContain("export function SectionEditor");
    expect(src).toContain("export function GradingTableBlock");
    expect(src).toContain("export function TitleAndSummary");
    expect(src).toContain("export function ActionItemsAndCautions");
    expect(src).toContain("export function linesFromText");
  });

  it("SectionEditor 支持自定义 labels + examplesHighlight", () => {
    const src = readFile("components/ai-assistant/result-atoms.tsx");
    expect(src).toContain("labels?: SectionEditorLabels");
    expect(src).toContain("examplesHighlight");
  });
});

describe("Unit C1-B r1c · 阅读视图 + 编辑/阅读切换", () => {
  it("result-atoms 含 ViewMode 类型 + Read 系列原子（ReadHeading / ReadParagraph / ReadBulletList）", () => {
    const src = readFile("components/ai-assistant/result-atoms.tsx");
    expect(src).toContain('export type ViewMode = "read" | "edit"');
    expect(src).toContain("export function ReadHeading");
    expect(src).toContain("export function ReadParagraph");
    expect(src).toContain("export function ReadBulletList");
    // ToolResultProps 含 viewMode 字段
    expect(src).toMatch(/viewMode:\s*ViewMode/);
  });

  it("TitleAndSummary / SectionEditor / ActionItemsAndCautions 双模式分支（含 viewMode === \"read\"）", () => {
    const src = readFile("components/ai-assistant/result-atoms.tsx");
    const readBranchCount = (src.match(/viewMode === "read"/g) || []).length;
    expect(readBranchCount).toBeGreaterThanOrEqual(3);
  });

  it("page.tsx 含 viewMode state 默认 read + 编辑/完成阅读 切换 button", () => {
    const src = readFile("app/teacher/ai-assistant/page.tsx");
    expect(src).toMatch(/useState<"read" \| "edit">\("read"\)/);
    expect(src).toContain("setViewMode");
    expect(src).toContain("编辑");
    expect(src).toContain("完成阅读");
    // runTool 成功后切回 read
    expect(src).toMatch(/setJob\(json\.data\.job[\s\S]*?setViewMode\("read"\)/);
  });

  it("renderResultByTool 透传 viewMode", () => {
    const src = readFile("app/teacher/ai-assistant/page.tsx");
    expect(src).toMatch(/renderResultByTool\([\s\S]*?viewMode\s*\)/);
    expect(src).toMatch(/const props = \{ result, patchResult, patchSection, viewMode \}/);
  });

  it("hook PersistedJobState 含 viewMode 字段 + DEFAULT viewMode='read'", () => {
    const src = readFile("lib/hooks/use-persisted-job.ts");
    expect(src).toMatch(/viewMode:\s*ViewMode/);
    expect(src).toMatch(/viewMode:\s*"read"/);
    // readEntry 兼容老 cache（无 viewMode 字段时 fallback "read"）
    expect(src).toMatch(/viewMode:\s*parsed\.viewMode === "edit" \? "edit" : "read"/);
  });

  it("examCheck read mode <details open={isRead}>（read 默认展开，edit 默认折起）", () => {
    const src = readFile("components/ai-assistant/exam-check-result.tsx");
    expect(src).toMatch(/open=\{isRead\}/);
    expect(src).toContain('const isRead = viewMode === "read"');
  });

  it("4 个 result 组件签名都接收 viewMode（ToolResultProps）", () => {
    for (const file of [
      "components/ai-assistant/lesson-polish-result.tsx",
      "components/ai-assistant/ideology-mining-result.tsx",
      "components/ai-assistant/question-analysis-result.tsx",
      "components/ai-assistant/exam-check-result.tsx",
    ]) {
      const src = readFile(file);
      expect(src).toContain("viewMode");
    }
  });
});
