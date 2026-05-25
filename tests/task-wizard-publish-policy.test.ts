import { describe, it, expect } from "vitest";
import { getPublishPolicy } from "@/components/task-wizard/publish-policy";

describe("getPublishPolicy — AI 审稿降级为软提醒（不再 block 发布）", () => {
  it("ready 草稿（AI 已生成、未批准）：可发布 + 显示 AI 审稿提醒", () => {
    expect(getPublishPolicy("ready")).toEqual({
      canPublish: true,
      showReviewReminder: true,
    });
  });

  it("异步生成中（processing/queued）：不可发布 + 无提醒", () => {
    expect(getPublishPolicy("processing")).toEqual({
      canPublish: false,
      showReviewReminder: false,
    });
    expect(getPublishPolicy("queued")).toEqual({
      canPublish: false,
      showReviewReminder: false,
    });
  });

  it("手动草稿 / 已批准 / 无草稿：可发布 + 无提醒（不显示 AI 审稿提醒）", () => {
    for (const status of ["draft", "approved", null]) {
      expect(getPublishPolicy(status)).toEqual({
        canPublish: true,
        showReviewReminder: false,
      });
    }
  });
});
