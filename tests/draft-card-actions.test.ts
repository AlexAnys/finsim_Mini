import { describe, it, expect } from "vitest";
import { getDraftCardActions } from "@/lib/utils/draft-card-actions";

/**
 * publish-flow · B1 seam — 草稿卡片按状态显示哪些动作（纯策略，无渲染）。
 *
 * 根因：审核完（status: ready→approved）后系统提示「去课程发布页发布」，
 * 但课程页 approved 卡片只渲染「查看对照」链接（绕回审核页），没有可发现的
 * 「发布」入口 → 用户找不到发布的地方。本 seam 把「卡片显示哪些动作」抽成
 * 纯函数，组件消费它：approved/ready 都给可发现的「发布」动作（点开向导落
 * review/发布步），ready 额外保留「审核」逐字段对照，approved 保留「查看对照」。
 *
 * 仓库 vitest 是 node 环境无 jsdom，渲染层不可单元测 —— 只测策略。
 */
describe("getDraftCardActions", () => {
  it("approved: 显示可发现的「发布」动作 + 「查看对照」次要入口", () => {
    const actions = getDraftCardActions("approved");
    expect(actions.showPublish).toBe(true);
    expect(actions.showReview).toBe(true);
    expect(actions.reviewLabel).toBe("查看对照");
  });

  it("ready: 显示「发布」动作 + 「审核」逐字段对照", () => {
    const actions = getDraftCardActions("ready");
    expect(actions.showPublish).toBe(true);
    expect(actions.showReview).toBe(true);
    expect(actions.reviewLabel).toBe("审核");
  });

  it("draft: 内容未齐，不显示发布也不显示对照（继续编辑补全）", () => {
    const actions = getDraftCardActions("draft");
    expect(actions.showPublish).toBe(false);
    expect(actions.showReview).toBe(false);
  });

  it.each(["queued", "processing", "failed"])(
    "%s: 异步进行中/失败，不显示发布",
    (status) => {
      const actions = getDraftCardActions(status);
      expect(actions.showPublish).toBe(false);
      expect(actions.showReview).toBe(false);
    },
  );

  it("published: 已发布，卡片已是任务态，不再显示发布动作", () => {
    const actions = getDraftCardActions("published");
    expect(actions.showPublish).toBe(false);
    expect(actions.showReview).toBe(false);
  });

  it("未知状态: 安全降级为不显示任何发布/对照动作", () => {
    const actions = getDraftCardActions("something-unexpected");
    expect(actions.showPublish).toBe(false);
    expect(actions.showReview).toBe(false);
  });
});
