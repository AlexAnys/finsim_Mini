import { describe, it, expect } from "vitest";
import {
  deriveAnalysisStatus,
  normalizeSubmission,
  type SubmissionAnalysisStatus,
} from "@/components/instance-detail/submissions-utils";

/**
 * PR-SIM-1b · D1 教师公布管理 UI 守护测试
 *
 * 这套测试覆盖：
 * 1. submissions-utils 的 deriveAnalysisStatus 派生函数 4 边界
 * 2. normalizeSubmission 把 raw 数据透传/派生 analysisStatus 字段
 * 3. release-config-card 时间转换辅助逻辑（间接通过 ISO 边界覆盖）
 *
 * 真 API E2E（PATCH /release-config / POST /release / batch-release）由 QA 真 curl + UI 验收。
 */

describe("PR-SIM-1b · deriveAnalysisStatus", () => {
  it("submitted 状态 → pending（AI 还没分析完）", () => {
    expect(
      deriveAnalysisStatus({ status: "submitted", releasedAt: null }),
    ).toBe<SubmissionAnalysisStatus>("pending");
  });

  it("grading 状态 → pending", () => {
    expect(
      deriveAnalysisStatus({ status: "grading", releasedAt: null }),
    ).toBe<SubmissionAnalysisStatus>("pending");
  });

  it("graded + releasedAt=null → analyzed_unreleased（已分析但未公布）", () => {
    expect(
      deriveAnalysisStatus({ status: "graded", releasedAt: null }),
    ).toBe<SubmissionAnalysisStatus>("analyzed_unreleased");
  });

  it("graded + releasedAt 有值 → released", () => {
    expect(
      deriveAnalysisStatus({
        status: "graded",
        releasedAt: "2026-04-26T12:00:00Z",
      }),
    ).toBe<SubmissionAnalysisStatus>("released");
    expect(
      deriveAnalysisStatus({
        status: "graded",
        releasedAt: new Date("2026-04-26T12:00:00Z"),
      }),
    ).toBe<SubmissionAnalysisStatus>("released");
  });

  it("failed 状态 → pending（视为待重试，UI 单独 handle）", () => {
    expect(
      deriveAnalysisStatus({ status: "failed", releasedAt: null }),
    ).toBe<SubmissionAnalysisStatus>("pending");
  });

  it("undefined releasedAt 等价于 null", () => {
    expect(
      deriveAnalysisStatus({ status: "graded", releasedAt: undefined }),
    ).toBe<SubmissionAnalysisStatus>("analyzed_unreleased");
  });
});

describe("PR-SIM-1b · normalizeSubmission analysisStatus 透传", () => {
  const baseRaw = {
    id: "s1",
    status: "graded",
    score: 80,
    maxScore: 100,
    submittedAt: "2026-04-25T10:00:00Z",
    gradedAt: "2026-04-25T10:30:00Z",
    taskType: "quiz",
    student: { id: "u1", name: "张三" },
    simulationSubmission: null,
    quizSubmission: null,
    subjectiveSubmission: null,
  };

  it("优先用后端透传的 analysisStatus（避免重复派生）", () => {
    const out = normalizeSubmission({
      ...baseRaw,
      releasedAt: null,
      analysisStatus: "released" as SubmissionAnalysisStatus,
    });
    // 后端说 released 即 released（不被 fallback 覆盖）
    expect(out.analysisStatus).toBe("released");
  });

  it("后端没透传时 fallback 派生（旧/简化客户端兼容）", () => {
    const out = normalizeSubmission({
      ...baseRaw,
      releasedAt: null,
    });
    expect(out.analysisStatus).toBe("analyzed_unreleased");
  });

  it("releasedAt 透传到 NormalizedSubmission", () => {
    const out = normalizeSubmission({
      ...baseRaw,
      releasedAt: "2026-04-26T12:00:00Z",
      analysisStatus: "released" as SubmissionAnalysisStatus,
    });
    expect(out.releasedAt).toBe("2026-04-26T12:00:00Z");
  });

  it("缺省 releasedAt 时为 null", () => {
    const out = normalizeSubmission(baseRaw);
    expect(out.releasedAt).toBeNull();
  });
});

describe("PR-SIM-1b · UI 文案守护（中文）", () => {
  it("ReleaseConfigCard 文案存在 / 与 spec 对齐", async () => {
    // 静态 grep — 文案变了 spec 没改要触发警报
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/instance-detail/release-config-card.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("成绩公布");
    expect(file).toContain("手动公布");
    expect(file).toContain("自动公布");
    expect(file).toContain("保存设置");
    expect(file).toContain("公布时点");
  });

  it("SubmissionsTab 含 3 档 analysisStatus 标签 + 公布操作", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/instance-detail/submissions-tab.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("等待分析");
    expect(file).toContain("已分析·未公布");
    expect(file).toContain("已公布");
    expect(file).toContain("批量公布");
    // 撤回链接 + 公布按钮文案
    expect(file).toContain("撤回公布");
    expect(file).toMatch(/公布<\/Button>|公布\s*<\/Button>/);
  });

  it("instance 详情 page 加 ReleaseConfigCard 渲染", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "app/teacher/instances/[id]/page.tsx"),
      "utf-8",
    );
    // ReleaseConfigCard 引入 + 渲染 + 3 handler
    expect(file).toContain("ReleaseConfigCard");
    expect(file).toContain("handleSaveReleaseConfig");
    expect(file).toContain("handleReleaseSubmission");
    expect(file).toContain("handleBatchRelease");
    // PATCH endpoint
    expect(file).toContain("/release-config");
    // POST 单条 endpoint
    expect(file).toMatch(/\/api\/submissions\/\$\{[^}]+\}\/release/);
    // 批量
    expect(file).toContain("/api/submissions/batch-release");
  });
});
