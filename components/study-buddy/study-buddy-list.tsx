"use client";

// PR-STU-2 · 学生 /study-buddy 左侧列表（340px 宽）
// - 顶部 header：标题 + 主按钮"新问题"
// - 副标题文案：mockup "遇到卡点时向 AI 发起对话，按课程和任务归档"
// - 计数小标题（"最近对话（N）"）
// - 列表 overflow-auto 占满剩余空间

import { Plus } from "lucide-react";
import type { StudyBuddyPostRow } from "@/lib/utils/study-buddy-transforms";
import { Button } from "@/components/ui/button";
import { StudyBuddyListItem } from "./study-buddy-list-item";

interface StudyBuddyListProps {
  posts: StudyBuddyPostRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewClick: () => void;
}

export function StudyBuddyList({
  posts,
  selectedId,
  onSelect,
  onNewClick,
}: StudyBuddyListProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-line bg-surface lg:w-[340px]">
      {/* Header */}
      <div className="border-b border-line px-5 pb-4 pt-5">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <h1 className="text-[20px] font-bold leading-tight tracking-[-0.01em] text-ink">
            学习伙伴
          </h1>
          <Button
            type="button"
            size="sm"
            onClick={onNewClick}
            className="h-7 gap-1 rounded-md bg-brand px-2.5 text-[12px] font-medium text-brand-fg hover:bg-brand-lift"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            新问题
          </Button>
        </div>
        <p className="text-[12px] leading-relaxed text-ink-4">
          遇到卡点时向 AI 发起对话，按课程和任务归档。
        </p>
      </div>

      {/* Section label */}
      <div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-5">
        最近对话（{posts.length}）
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {posts.length === 0 ? (
          <div className="px-5 py-12 text-center text-[12.5px] text-ink-4">
            还没有对话。
            <br />
            点击右上「新问题」开始。
          </div>
        ) : (
          posts.map((post) => (
            <StudyBuddyListItem
              key={post.id}
              post={post}
              selected={selectedId === post.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  );
}
