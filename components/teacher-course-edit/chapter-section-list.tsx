"use client";

/**
 * PR-COURSE-1+2 · 章节列表（章节卡 → 小节行）
 *
 * 职责：
 * - 渲染所有章节（折叠/展开 chapter）
 * - 每章节内部嵌入 InlineSectionRow（小节行 + 3 slot 内容）
 * - 顶部章节内"添加小节"按钮
 *
 * 父组件（page.tsx）通过 props 注入：
 * - 数据：chapters
 * - 折叠 state：collapsedChapterIds + onToggleChapter
 * - 展开 block：expandedBlockId + onToggleBlockExpand（同时只展开一个）
 * - section / block / task 操作回调
 *
 * 不持有数据，纯受控。
 */

import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  InlineSectionRow,
  type InlineChapter,
} from "./inline-section-row";
import type {
  BlockType,
  SlotType,
} from "@/lib/utils/course-editor-transforms";

interface Props {
  chapters: InlineChapter[];
  collapsedChapterIds: Set<string>;
  expandedBlockId: string | null;
  onToggleChapter: (chapterId: string) => void;
  onToggleBlockExpand: (blockId: string | null) => void;
  onAddSection: (chapterId: string) => void;
  onRenameSection: (sectionId: string, newTitle: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
  onAddTask: (
    chapterId: string,
    sectionId: string,
    slot: SlotType,
  ) => void;
  onCreateBlock: (
    chapterId: string,
    sectionId: string,
    slot: SlotType,
    blockType: BlockType,
  ) => Promise<void>;
  onUpdateBlock: (
    blockId: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onDeleteBlock: (blockId: string) => Promise<void>;
}

export function ChapterSectionList({
  chapters,
  collapsedChapterIds,
  expandedBlockId,
  onToggleChapter,
  onToggleBlockExpand,
  onAddSection,
  onRenameSection,
  onDeleteSection,
  onAddTask,
  onCreateBlock,
  onUpdateBlock,
  onDeleteBlock,
}: Props) {
  return (
    <div className="space-y-4">
      {chapters.map((chapter) => {
        const collapsed = collapsedChapterIds.has(chapter.id);
        return (
          <div
            key={chapter.id}
            id={`chapter-${chapter.id}`}
            className="overflow-hidden rounded-xl border border-line bg-surface"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line bg-paper-alt px-4 py-3">
              <button
                type="button"
                onClick={() => onToggleChapter(chapter.id)}
                className="flex flex-1 items-center gap-2 text-left"
                aria-expanded={!collapsed}
                aria-label={`${collapsed ? "展开" : "折叠"}章节`}
              >
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-ink-4 transition-transform",
                    collapsed && "-rotate-90",
                  )}
                />
                <span className="text-base font-semibold text-ink">
                  第 {chapter.order + 1} 章 · {chapter.title || "未命名章节"}
                </span>
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddSection(chapter.id)}
              >
                <Plus className="size-3 mr-1" />
                添加小节
              </Button>
            </div>

            {!collapsed && (
              <div>
                {chapter.sections.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-ink-4">
                    暂无小节，点击右上角「添加小节」开始
                  </p>
                ) : (
                  chapter.sections.map((section) => (
                    <InlineSectionRow
                      key={section.id}
                      chapter={chapter}
                      section={section}
                      expandedBlockId={expandedBlockId}
                      onToggleBlockExpand={onToggleBlockExpand}
                      onRenameSection={onRenameSection}
                      onDeleteSection={onDeleteSection}
                      onAddTask={onAddTask}
                      onCreateBlock={onCreateBlock}
                      onUpdateBlock={onUpdateBlock}
                      onDeleteBlock={onDeleteBlock}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
