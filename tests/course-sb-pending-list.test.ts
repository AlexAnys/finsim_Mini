import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Unit B2 · 学生提问搬课程 SB 统计 tab
 * 静态源结构测试（与 A1/A2/B1/C1-B 同模式）。
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Unit B2 · API courseId filter（方案 C）", () => {
  it("`/api/teacher/study-buddy/posts` 加 ?courseId= 过滤", () => {
    const src = readFile("app/api/teacher/study-buddy/posts/route.ts");
    expect(src).toContain('searchParams.get("courseId")');
    expect(src).toContain("filterCourseId");
    expect(src).toContain("effectiveCourseIds");
  });

  it("courseId 必须先与 owner+collab courseIds 求交集（防 enum scan）", () => {
    const src = readFile("app/api/teacher/study-buddy/posts/route.ts");
    expect(src).toContain("courseIds.includes(filterCourseId)");
    // 未授权直接返空（不暴露错误）
    expect(src).toMatch(/if \(filterCourseId && !courseIds\.includes/);
  });

  it("where.OR 用 effectiveCourseIds 而非 courseIds（filter 生效）", () => {
    const src = readFile("app/api/teacher/study-buddy/posts/route.ts");
    // 两处都已切换
    const matches = src.match(/effectiveCourseIds/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(3);
    // 不再有原 courseIds 在 where.OR 中（旧 `{ in: courseIds }` 在 OR 段被替换）
    expect(src).not.toMatch(/courseId: \{ in: courseIds \}/);
    expect(src).not.toMatch(/taskInstance: \{ courseId: \{ in: courseIds \} \}/);
  });

  it("courseId 缺省时回退到全 courseIds（向后兼容 /teacher/study-buddy 老页面）", () => {
    const src = readFile("app/api/teacher/study-buddy/posts/route.ts");
    expect(src).toContain("filterCourseId ? [filterCourseId] : courseIds");
  });
});

describe("Unit B2 · PendingQuestionsList 组件", () => {
  it("课程 SB tab 含 PendingQuestionsList 函数 + data-section 标记", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    expect(src).toContain("function PendingQuestionsList");
    expect(src).toContain('<PendingQuestionsList courseId={courseId} />');
    expect(src).toContain('data-section="pending-questions"');
  });

  it("fetch endpoint 含 courseId + scope=pending（不污染老页面 contract）", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    expect(src).toContain(
      "`/api/teacher/study-buddy/posts?courseId=${courseId}&scope=pending`",
    );
  });

  it("含 AlertDialog 软删除 + DELETE /api/study-buddy/posts/[id]", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    expect(src).toContain("AlertDialog");
    expect(src).toContain("AlertDialogAction");
    expect(src).toContain("`/api/study-buddy/posts/${deleteTarget.id}`");
    expect(src).toMatch(/method:\s*"DELETE"/);
    expect(src).toContain("删除（隐藏）此提问");
  });

  it("展开/收起 + 学生提问 + AI 回复显示 + 删除乐观更新", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    expect(src).toContain("setExpandedId");
    expect(src).toContain("学生提问");
    expect(src).toContain("AI 回复");
    expect(src).toContain("prev.filter((p) => p.id !== deleteTarget.id)");
  });

  it("空状态文案「本课程暂无未答疑提问」+ loading 状态", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    expect(src).toContain("本课程暂无未答疑提问");
    expect(src).toContain("Loader2");
  });

  it("成功 toast「已删除」 + 失败 toast 中文 fallback", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    expect(src).toContain('toast.success("已删除")');
    expect(src).toContain("删除失败");
    expect(src).toContain("网络错误");
  });
});

describe("Unit B2 · Anti-regression", () => {
  it("`/teacher/study-buddy` 老页面文件存在（D3 双轨保留）", () => {
    expect(
      fs.existsSync(path.join(projectRoot, "app/teacher/study-buddy/page.tsx")),
    ).toBe(true);
  });

  it("现有 SB tab 4 大 section（KPI / AI 总结 / groups / 新加 PendingList）共存", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    // 现有 section markers
    expect(src).toContain("AI 问题总结");
    expect(src).toContain("生成总结");
    // PR-15 bug 3: 重构后从 data.groups.map 改为 destructured groups.map（同义）
    expect(src).toContain("groups.map");
    // 新 section
    expect(src).toContain("PendingQuestionsList");
  });

  it("`/api/lms/study-buddy/analytics` 端点 import 未触动（fetch URL 不变）", () => {
    const src = readFile("components/course/course-study-buddy-analytics-tab.tsx");
    expect(src).toContain("/api/lms/study-buddy/analytics?courseId=");
  });
});
