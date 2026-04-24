"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TocChapter } from "@/lib/utils/course-editor-transforms";

interface TocSidebarProps {
  chapters: TocChapter[];
  collapsedChapterIds: Set<string>;
  activeChapterId: string | null;
  activeSectionId: string | null;
  onToggleChapter: (chapterId: string) => void;
  onJumpChapter: (chapterId: string) => void;
  onJumpSection: (sectionId: string) => void;
}

export function TocSidebar({
  chapters,
  collapsedChapterIds,
  activeChapterId,
  activeSectionId,
  onToggleChapter,
  onJumpChapter,
  onJumpSection,
}: TocSidebarProps) {
  return (
    <nav
      aria-label="课程目录"
      className="sticky top-6 w-[220px] shrink-0 self-start rounded-xl border border-line bg-surface p-3"
    >
      <div className="mb-2 px-1 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-ink-5">
        课程目录
      </div>
      {chapters.length === 0 ? (
        <p className="px-1 py-4 text-[12px] text-ink-4">暂无章节</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {chapters.map((ch) => {
            const collapsed = collapsedChapterIds.has(ch.id);
            const isActiveChapter = activeChapterId === ch.id;
            return (
              <li key={ch.id}>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="展开/折叠章节"
                    onClick={() => onToggleChapter(ch.id)}
                    className="grid size-5 shrink-0 place-items-center rounded text-ink-5 transition-colors hover:bg-paper-alt hover:text-ink-3"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3 transition-transform",
                        collapsed && "-rotate-90",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onJumpChapter(ch.id)}
                    className={cn(
                      "flex-1 truncate rounded px-1.5 py-1 text-left text-[12.5px] transition-colors",
                      isActiveChapter
                        ? "font-semibold text-brand"
                        : "text-ink-2 hover:bg-paper-alt",
                    )}
                  >
                    <span className="fs-num mr-1 text-ink-5">
                      {ch.order + 1}.
                    </span>
                    {ch.title || "未命名章节"}
                  </button>
                </div>
                {!collapsed && ch.sections.length > 0 && (
                  <ul className="ml-6 mt-0.5 flex flex-col gap-0.5 border-l border-line-2 pl-2">
                    {ch.sections.map((s) => {
                      const isActive = activeSectionId === s.id;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onJumpSection(s.id)}
                            className={cn(
                              "flex w-full items-center gap-1 rounded px-1.5 py-[3px] text-left text-[11.5px] transition-colors",
                              isActive
                                ? "bg-brand-soft font-medium text-brand"
                                : "text-ink-3 hover:bg-paper-alt",
                            )}
                          >
                            <span className="truncate">
                              <span className="fs-num mr-1 text-ink-5">
                                {ch.order + 1}.{s.order + 1}
                              </span>
                              {s.title || "未命名小节"}
                            </span>
                            {s.taskCount > 0 && (
                              <span className="fs-num ml-auto text-[10px] text-ink-5">
                                {s.taskCount}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
