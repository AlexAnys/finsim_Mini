import { describe, it, expect } from "vitest";
import {
  deriveAnalysisStatus,
  type SubmissionAnalysisStatus,
} from "@/components/instance-detail/submissions-utils";

/**
 * PR-SIM-1c · D1 学生防作弊 UI 守护测试
 *
 * 这套测试覆盖：
 * 1. 学生页面引用的 deriveAnalysisStatus（与 service 同步）的 4 边界
 * 2. UI 文案 grep 守护（grades / dashboard recent-grades / simulation submitted view）
 *
 * 真 cookie + UI 双角色 E2E（teacher 公布后学生刷新看分数）由 QA 真浏览器验收。
 */

describe("PR-SIM-1c · 学生客户端 deriveAnalysisStatus（与 service 同步）", () => {
  it("submitted + releasedAt=null → pending（学生看到'等待 AI 分析' chip）", () => {
    expect(
      deriveAnalysisStatus({ status: "submitted", releasedAt: null }),
    ).toBe<SubmissionAnalysisStatus>("pending");
  });

  it("graded + releasedAt=null → analyzed_unreleased（学生看到'已分析 · 等待教师公布'）", () => {
    expect(
      deriveAnalysisStatus({ status: "graded", releasedAt: null }),
    ).toBe<SubmissionAnalysisStatus>("analyzed_unreleased");
  });

  it("graded + releasedAt 有值 → released（学生看到完整分数）", () => {
    expect(
      deriveAnalysisStatus({
        status: "graded",
        releasedAt: "2026-04-26T12:00:00Z",
      }),
    ).toBe<SubmissionAnalysisStatus>("released");
  });

  it("undefined releasedAt 兜底等价 null", () => {
    expect(
      deriveAnalysisStatus({ status: "graded", releasedAt: undefined }),
    ).toBe<SubmissionAnalysisStatus>("analyzed_unreleased");
  });
});

describe("PR-SIM-1c · UI 文案守护（中文）", () => {
  it("学生 /grades 页面含 3 档 analysisStatus chip + 类型导入", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "app/(student)/grades/page.tsx"),
      "utf-8",
    );
    expect(file).toContain("等待 AI 分析");
    expect(file).toContain("已分析 · 等待教师公布");
    // 引入派生函数 + 类型
    expect(file).toContain("deriveAnalysisStatus");
    expect(file).toContain("SubmissionAnalysisStatus");
    // 仅"已公布"才计入平均分（防作弊语义）
    expect(file).toContain("releasedSubmissions");
    // 详情按钮仅 isReleased 时渲染
    expect(file).toMatch(/isReleased\s*&&\s*sub\.evaluation/);
  });

  it("RecentGrades 组件根据 analysisStatus 切换 chip vs 分数 progress bar", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "components/dashboard/recent-grades.tsx"),
      "utf-8",
    );
    expect(file).toContain("analysisStatus");
    expect(file).toContain("等待 AI 分析");
    expect(file).toContain("已分析 · 等待教师公布");
    // isReleased branching 控制渲染
    expect(file).toMatch(/isReleased/);
  });

  it("学生 dashboard recentGrades useMemo 携带 analysisStatus + KPI 仅基于已公布", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "app/(student)/dashboard/page.tsx"),
      "utf-8",
    );
    // 不再仅 filter graded+score!=null，让 pending 的也参与渲染
    expect(file).toContain("deriveAnalysisStatus");
    expect(file).toContain("releasedSubs");
    // KPI 文案改为"次公布成绩"以反映防作弊语义
    expect(file).toContain("次公布成绩");
  });

  it("simulation runner 加 SimulationSubmittedView + student mode 不再 router.back()", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "components/simulation/simulation-runner.tsx"),
      "utf-8",
    );
    expect(file).toContain("SimulationSubmittedView");
    expect(file).toContain("已提交，AI 分析中");
    expect(file).toContain("你将在教师公布后看到详细评估");
    // student mode 改 setSubmitted(true) 而非 router.back()
    expect(file).toMatch(/setSubmitted\(true\)[\s\S]{0,200}toast\.success\("提交成功，AI 分析中"\)/);
  });
});
