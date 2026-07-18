import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readPage(): string {
  return fs.readFileSync(
    path.join(projectRoot, "app/teacher/ai-assistant/page.tsx"),
    "utf-8",
  );
}

function readRoute(): string {
  return fs.readFileSync(
    path.join(projectRoot, "app/api/ai/work-assistant/route.ts"),
    "utf-8",
  );
}

describe("F3 AI 助手 · 四工具专属输入", () => {
  it("题目解析已正名并使用准确描述", () => {
    const src = readPage();
    expect(src).toContain('label: "题目解析"');
    expect(src).toContain('desc: "识别题型、知识点、解题步骤与易错点"');
    expect(src).not.toContain('label: "搜题与解析"');
  });

  it("TOOLS 为四个工具配置专属字段", () => {
    const src = readPage();

    expect(src).toContain("extraFields:");
    for (const label of [
      "课时",
      "学段",
      "学生基础",
      "专业方向",
      "题目数量",
      "知识点范围",
      "标准答案",
      "评分标准",
      "满分",
    ]) {
      expect(src, label).toContain(`label: "${label}"`);
    }
  });

  it("按 activeTool 的配置渲染专属字段", () => {
    const src = readPage();
    expect(src).toMatch(/active\.extraFields\.map\(/);
    expect(src).toContain("extraFields[field.key]");
    expect(src).toContain("extraFieldsByTool[activeTool]");
    expect(src).toMatch(/\[activeTool\]:\s*\{ \.\.\.current\[activeTool\], \[key\]: value \}/);
  });

  it("把 extraFields 序列化进 FormData", () => {
    const src = readPage();
    expect(src).toMatch(
      /form\.set\(\s*["']extraFields["']\s*,\s*JSON\.stringify\(extraFields\)\s*\)/,
    );
    const route = readRoute();
    expect(route).toContain('formData.get("extraFields")');
    expect(route).toMatch(/input:\s*\{[\s\S]*?extraFields,/);
  });

  it("移除请求搜索增强开关及前端状态", () => {
    const src = readPage();
    expect(src).not.toContain("请求搜索增强");
    expect(src).not.toContain("enableSearch");
    expect(src).not.toContain("setEnableSearch");
    expect(readRoute()).not.toContain("enableSearch");
  });
});
