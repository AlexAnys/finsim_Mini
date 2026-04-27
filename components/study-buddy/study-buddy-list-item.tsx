"use client";

// PR-STU-2 · 学生 /study-buddy 左侧列表单项
// - 顶行：课程 tag（mockup: 课程名走 mono 小字 + 软底）+ 状态 chip + 匿名 chip
// - 标题：单行加粗
// - 底行：消息计数 + 模式 + 相对时间
// - 选中态：bg-paper-alt + 左 3px 深靛条 + 减少 padding-left

import { MessageCircle } from "lucide-react";
import type {
  StudyBuddyMode,
  StudyBuddyPostRow,
  StudyBuddyStatus,
} from "@/lib/utils/study-buddy-transforms";
import { courseColorForId } from "@/lib/design/tokens";

interface StudyBuddyListItemProps {
  post: StudyBuddyPostRow;
  selected: boolean;
  onSelect: (id: string) => void;
}

const TAG_CLASS_MAP: Record<string, string> = {
  tagA: "bg-tag-a text-tag-a-fg",
  tagB: "bg-tag-b text-tag-b-fg",
  tagC: "bg-tag-c text-tag-c-fg",
  tagD: "bg-tag-d text-tag-d-fg",
  tagE: "bg-tag-e text-tag-e-fg",
  tagF: "bg-tag-f text-tag-f-fg",
};

const MODE_LABEL: Record<StudyBuddyMode, string> = {
  socratic: "引导式",
  direct: "直接",
};

const STATUS_CHIP: Record<
  StudyBuddyStatus,
  { label: string; class: string } | null
> = {
  pending: {
    label: "等待回复",
    class: "border-warn/20 bg-warn-soft text-warn",
  },
  error: {
    label: "回复失败",
    class: "border-danger/20 bg-danger-soft text-danger",
  },
  answered: null,
};

export function StudyBuddyListItem({
  post,
  selected,
  onSelect,
}: StudyBuddyListItemProps) {
  // 课程 tag 色：courseId 缺失时退化用 taskId 保稳定
  const courseSeed = post.courseId ?? post.taskId;
  const tagKey = courseColorForId(courseSeed);
  const tagClass = TAG_CLASS_MAP[tagKey] ?? TAG_CLASS_MAP.tagA;

  const statusChip = STATUS_CHIP[post.status];
  const courseLabel = post.courseName ?? "未关联课程";

  return (
    <button
      type="button"
      onClick={() => onSelect(post.id)}
      aria-pressed={selected}
      className={`block w-full border-b border-line-2 py-3 text-left transition-colors hover:bg-paper-alt/60 ${
        selected
          ? "border-l-[3px] border-l-brand bg-paper-alt pl-[13px] pr-4"
          : "border-l-[3px] border-l-transparent px-4"
      }`}
    >
      {/* 顶行：课程 tag + 状态 + 匿名 chip */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className={`rounded-sm px-1.5 py-[1px] font-mono text-[10.5px] font-semibold ${tagClass}`}
        >
          {courseLabel}
        </span>
        {statusChip && (
          <span
            className={`rounded-sm border px-1.5 py-[1px] text-[10.5px] font-medium ${statusChip.class}`}
          >
            {statusChip.label}
          </span>
        )}
        {post.anonymous && (
          <span className="rounded-sm border border-line bg-paper px-1.5 py-[1px] text-[10.5px] font-medium text-ink-4">
            匿名
          </span>
        )}
      </div>

      {/* 标题 */}
      <div className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink">
        {post.title}
      </div>

      {/* 底行：消息计数 + 模式 + 相对时间 */}
      <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-ink-5">
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="size-3" aria-hidden="true" />
          {post.messageCount}
        </span>
        <span>{MODE_LABEL[post.mode]}</span>
        <span className="ml-auto truncate">{post.relativeTime}</span>
      </div>
    </button>
  );
}
