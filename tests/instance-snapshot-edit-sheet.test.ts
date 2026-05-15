import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Unit A1 r1b · SnapshotEditSheet 源结构测试
 */

const here = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(here));

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(projectRoot, relPath), "utf-8");
}

describe("Unit A1 r1b · SnapshotEditSheet 文件 & 表面", () => {
  it("Sheet 组件文件存在", () => {
    expect(
      fs.existsSync(
        path.join(
          projectRoot,
          "components/instance-detail/snapshot-edit-sheet.tsx",
        ),
      ),
    ).toBe(true);
  });

  it("export SnapshotEditSheet + Props interface 含必要字段", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("export function SnapshotEditSheet");
    expect(src).toContain("interface SnapshotEditSheetProps");
    expect(src).toMatch(/instanceId:\s*string/);
    expect(src).toMatch(/taskType:\s*TaskTypeKey/);
    expect(src).toMatch(/snapshot:\s*Record<string, unknown> \| null/);
    expect(src).toMatch(/gradedCount:\s*number/);
    expect(src).toMatch(/onSaved:\s*\(\)/);
    expect(src).toMatch(/onOpenChange:\s*\(open: boolean\)/);
  });
});

describe("Unit A1 r1b · 3 taskType 分支表单", () => {
  it("含 simulation / quiz / subjective 三个 form 组件并 data-form 标记", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain('data-form="simulation"');
    expect(src).toContain('data-form="quiz"');
    expect(src).toContain('data-form="subjective"');
    expect(src).toContain("function SimulationForm");
    expect(src).toContain("function QuizForm");
    expect(src).toContain("function SubjectiveForm");
  });

  it("simulation form 含 scenario / openingLine / dialogueRequirements / strictness", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("场景描述");
    expect(src).toContain("开场白");
    expect(src).toContain("对话要求");
    expect(src).toContain("评分严格度");
  });

  it("quiz form 含 mode / 限时 / 最大题量 + adaptive 模式才显 startDifficulty/difficultyStep", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("固定模式");
    expect(src).toContain("自适应模式");
    expect(src).toContain("限时（分钟）");
    expect(src).toContain("最大题量");
    expect(src).toContain('state.mode === "adaptive"');
    expect(src).toContain("起始难度");
    expect(src).toContain("难度步长");
  });

  it("subjective form 含 prompt / allowedAttachmentTypes / 严格度", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("题目提示");
    expect(src).toContain("允许的附件类型");
    expect(src).toContain("允许文本作答");
  });

  it("simulation / subjective 各含 ScoringCriteriaEditor", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("function ScoringCriteriaEditor");
    expect(src).toContain('data-section="scoring-criteria"');
    expect(src).toContain("新增标准");
  });
});

describe("Unit A1 r1b · graded 警告 AlertDialog 三按钮", () => {
  it("含 AlertDialog 并 gradedCount > 0 时触发", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("<AlertDialog");
    expect(src).toContain("setWarningOpen(true)");
    expect(src).toMatch(/if \(gradedCount > 0\) \{[\s\S]*?setWarningOpen\(true\)/);
  });

  it("AlertDialog 三按钮文案: 取消 / 复制为新任务 / 我知道，仍然保存", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("AlertDialogCancel");
    expect(src).toContain("复制为新任务");
    expect(src).toContain("我知道，仍然保存");
  });

  it("「复制为新任务」disabled + tooltip「即将上线」", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toMatch(/disabled[\s\S]*?title="即将上线，敬请期待"/);
    expect(src).toContain('data-action="copy-as-new"');
  });
});

describe("Unit A1 r1b · PATCH 调用 + 错误处理", () => {
  it("PATCH endpoint URL 精确匹配 /api/lms/task-instances/{id}/snapshot", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("`/api/lms/task-instances/${instanceId}/snapshot`");
    expect(src).toMatch(/method:\s*"PATCH"/);
  });

  it("成功 toast「实例配置已更新」+ onSaved + 关闭 Sheet", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain('toast.success("实例配置已更新")');
    expect(src).toContain("onSaved()");
    expect(src).toContain("onOpenChange(false)");
  });

  it("失败走 toast.error 中文 fallback + 网络错误兜底", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toContain("保存失败");
    expect(src).toContain("网络错误，请稍后重试");
  });
});

describe("Unit A1 r1b · buildPatchBody 形状", () => {
  it("simulation patch 含 taskType + simulationConfig + scoringCriteria", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toMatch(/taskType:\s*"simulation"\s*as\s*const/);
    expect(src).toContain("simulationConfig:");
    expect(src).toContain("scoringCriteria:");
  });

  it("quiz patch 含 taskType + quizConfig（不发送 quizQuestions 因为只读）", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toMatch(/taskType:\s*"quiz"\s*as\s*const/);
    expect(src).toContain("quizConfig:");
    // quiz form 现在不编辑题目内容
    expect(src).not.toMatch(/quizQuestions:\s*\[/);
  });

  it("subjective patch 含 taskType + subjectiveConfig + scoringCriteria", () => {
    const src = readFile("components/instance-detail/snapshot-edit-sheet.tsx");
    expect(src).toMatch(/taskType:\s*"subjective"\s*as\s*const/);
    expect(src).toContain("subjectiveConfig:");
  });
});

describe("Unit A1 r1b · overview-tab + page 集成", () => {
  it("overview-tab 接 onEditSnapshot prop + 渲染「编辑配置」按钮", () => {
    const src = readFile("components/instance-detail/overview-tab.tsx");
    expect(src).toContain("onEditSnapshot?: () => void");
    expect(src).toContain('data-action="edit-snapshot"');
    expect(src).toContain("编辑配置");
  });

  it("page.tsx 引入 SnapshotEditSheet + 维护 snapshotSheetOpen state + 透传 props", () => {
    const src = readFile("app/teacher/instances/[id]/page.tsx");
    expect(src).toContain('SnapshotEditSheet } from "@/components/instance-detail/snapshot-edit-sheet"');
    expect(src).toContain("snapshotSheetOpen");
    expect(src).toContain("setSnapshotSheetOpen");
    expect(src).toContain("onEditSnapshot={() => setSnapshotSheetOpen(true)}");
    // taskSnapshot 字段加入 InstanceDetail
    expect(src).toContain("taskSnapshot?: Record<string, unknown> | null");
    // gradedCount={stats.graded}
    expect(src).toContain("gradedCount={stats.graded}");
  });

  it("page.tsx handleSnapshotSaved 重新拉取 GET /api/lms/task-instances/{id} 刷新 instance state", () => {
    const src = readFile("app/teacher/instances/[id]/page.tsx");
    expect(src).toContain("handleSnapshotSaved");
    expect(src).toContain("`/api/lms/task-instances/${instanceId}`");
    expect(src).toMatch(/if \(json\.success\) setInstance\(json\.data\)/);
  });
});
