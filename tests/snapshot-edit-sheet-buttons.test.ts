import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Slice 5 (B4) · AlertDialog 内"复制为新任务"假占位按钮删除。
 * review-pr13 F-7 — disabled + tooltip"即将上线" = UI 向用户承诺不存在的功能。
 * 保留 3 处 description 文字作建议路径提示，仅删按钮本身。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Slice 5 · 假占位按钮删除", () => {
  const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");

  it("不再含 data-action=\"copy-as-new\" 占位按钮标记", () => {
    expect(src).not.toContain('data-action="copy-as-new"');
  });

  it("不再含「即将上线」/「敬请期待」tooltip", () => {
    expect(src).not.toContain("即将上线");
    expect(src).not.toContain("敬请期待");
  });

  it("AlertDialogFooter 仅两按钮：AlertDialogCancel + AlertDialogAction", () => {
    // 占位按钮删后，footer 内不应有独立 <Button> 与 disabled title 配对
    expect(src).not.toMatch(/<Button[\s\S]{0,200}disabled[\s\S]{0,200}title="即将上线/);
  });

  it("保留 description 文字「复制为新任务」作为引导路径（不删全部字符串）", () => {
    // 至少保留 1 处描述（AlertDialogDescription / 资产分组提示 / 题库提示）
    expect(src).toContain("复制为新任务");
  });
});
