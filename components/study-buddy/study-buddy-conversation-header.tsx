"use client";

// PR-STU-2 · 学生 /study-buddy 右侧对话头部
// - 顶行：课程 tag（mono 软底）+ 任务名 + 模式 chip + 匿名 chip
// - 标题：18px 加粗（mockup）

import type { StudyBuddyPostRow } from "@/lib/utils/study-buddy-transforms";
import { courseColorForId } from "@/lib/design/tokens";

interface StudyBuddyConversationHeaderProps {
  post: StudyBuddyPostRow;
}

const TAG_CLASS_MAP: Record<string, string> = {
  tagA: "bg-tag-a text-tag-a-fg",
  tagB: "bg-tag-b text-tag-b-fg",
  tagC: "bg-tag-c text-tag-c-fg",
  tagD: "bg-tag-d text-tag-d-fg",
  tagE: "bg-tag-e text-tag-e-fg",
  tagF: "bg-tag-f text-tag-f-fg",
};

export function StudyBuddyConversationHeader({
  post,
}: StudyBuddyConversationHeaderProps) {
  const courseSeed = post.courseId ?? post.taskId;
  const tagKey = courseColorForId(courseSeed);
  const tagClass = TAG_CLASS_MAP[tagKey] ?? TAG_CLASS_MAP.tagA;

  const courseLabel = post.courseName ?? "未关联课程";
  const taskLabel = post.taskName ?? null;

  const modeChipClass =
    post.mode === "socratic"
      ? "border-brand/20 bg-brand-soft text-brand"
      : "border-info/20 bg-info-soft text-info";
  const modeLabel =
    post.mode === "socratic" ? "引导式（Socratic）" : "直接回答";

  return (
    <header className="border-b border-line bg-paper px-6 pb-4 pt-5 lg:px-8">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-sm px-2 py-0.5 font-mono text-[11px] font-semibold ${tagClass}`}
        >
          {courseLabel}
        </span>
        {taskLabel && (
          <span className="text-[11.5px] text-ink-4">· {taskLabel}</span>
        )}
        <span
          className={`rounded-sm border px-1.5 py-[1px] text-[10.5px] font-medium ${modeChipClass}`}
        >
          {modeLabel}
        </span>
        {post.anonymous && (
          <span className="rounded-sm border border-line bg-paper px-1.5 py-[1px] text-[10.5px] font-medium text-ink-4">
            匿名
          </span>
        )}
      </div>
      <h2 className="text-[18px] font-bold leading-snug tracking-[-0.005em] text-ink">
        {post.title}
      </h2>
    </header>
  );
}
