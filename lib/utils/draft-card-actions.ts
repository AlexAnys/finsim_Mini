// publish-flow · B1 seam — 草稿卡片按状态显示哪些动作（纯策略，无渲染、无副作用）。
//
// 由 components/teacher-course-edit/inline-section-row.tsx 消费：决定 approved/ready
// 草稿卡片是否显示可发现的「发布」动作（点开向导落 review/发布步），以及「审核 /
// 查看对照」次要入口的文案。其余状态（draft/queued/processing/failed/published）
// 不显示发布与对照入口（继续编辑补全 / 异步进行中 / 已发布）。
//
// 背景：审核完（ready→approved）后旧提示「去课程发布页发布」，但课程页 approved 卡片
// 只有「查看对照」（绕回审核页），缺可发现的发布入口 → 用户找不到发布的地方。

export type DraftCardStatus =
  | "draft"
  | "queued"
  | "processing"
  | "ready"
  | "approved"
  | "failed"
  | "published"
  | string;

export interface DraftCardActions {
  /** 是否显示可发现的「发布」动作（点开向导落 review/发布步）。 */
  showPublish: boolean;
  /** 是否显示「审核 / 查看对照」次要入口（链接到审核页）。 */
  showReview: boolean;
  /** 次要入口文案：ready → 审核（逐字段对照）；approved → 查看对照。 */
  reviewLabel: string;
}

export function getDraftCardActions(status: DraftCardStatus): DraftCardActions {
  switch (status) {
    case "ready":
      // 内容已齐待审核：可直接发布，同时保留逐字段「审核」对照。
      return { showPublish: true, showReview: true, reviewLabel: "审核" };
    case "approved":
      // 已批准：可发现的「发布」入口为主，「查看对照」降为次要。
      return { showPublish: true, showReview: true, reviewLabel: "查看对照" };
    default:
      // draft（待补全）/ queued / processing（异步进行中）/ failed（需先 retry）/
      // published（已是任务态）/ 未知状态 → 不显示发布与对照入口。
      return { showPublish: false, showReview: false, reviewLabel: "" };
  }
}
