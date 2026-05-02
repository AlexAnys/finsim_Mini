"use client";

/**
 * PR-COURSE-1+2 · C1 inline section row
 *
 * 替代原 BlockEditPanel 右侧整列：直接在课程结构表格中
 * - 小节标题：点击 Pencil 进入 inline edit（Input + Enter 保存 / Esc 取消）
 * - 每个 slot（课前/课中/课后）单元格：
 *    · 任务实例卡片（点击进入 instance 详情）
 *    · 内容块（点击展开 inline 编辑器；MarkdownEditor / LinkOrResourceEditor 等
 *      复用既有 block-editors 子组件；同一时刻只展开一个 block 由父组件控制）
 *    · "+ 添加任务" 按钮 → 触发 wizard modal
 *    · "+ 添加块" 按钮 → 触发 inline create form（小型 select + 创建）
 */

import { useState } from "react";
import {
  Plus,
  Pencil,
  Check,
  X,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  MessageSquare,
  HelpCircle,
  Box,
  Link as LinkIcon,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  BLOCK_TYPE_LABEL,
  type BlockType,
  type SlotType,
} from "@/lib/utils/course-editor-transforms";
import { BlockEditorDispatch } from "./block-editors";
import type { BlockEditorBlock } from "./block-editors/types";

const SLOT_LABEL: Record<SlotType, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

const ALL_SLOTS: SlotType[] = ["pre", "in", "post"];

const BLOCK_ICON: Record<BlockType, LucideIcon> = {
  markdown: FileText,
  resource: LinkIcon,
  simulation_config: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
  custom: Box,
};

const ALL_BLOCK_TYPES: BlockType[] = [
  "markdown",
  "resource",
  "simulation_config",
  "quiz",
  "subjective",
  "custom",
];

const TASK_ICON: Record<string, LucideIcon> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

const TASK_TYPE_LABEL: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
  archived: "已归档",
};

// Inline status colors using design tokens (not hardcoded brand-* / brand-soft)
const STATUS_CLASS: Record<string, string> = {
  draft: "bg-paper-alt text-ink-3 border-line",
  published: "bg-success/10 text-success border-success/20",
  closed: "bg-warn/10 text-warn border-warn/30",
  archived: "bg-danger/10 text-danger border-danger/20",
};

const DRAFT_STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  queued: "排队中",
  processing: "生成中",
  ready: "待审核",
  failed: "失败",
};

const DRAFT_STATUS_CLASS: Record<string, string> = {
  draft: "border-line bg-paper-alt text-ink-3",
  queued: "border-brand/20 bg-brand-soft text-brand",
  processing: "border-brand/20 bg-brand-soft text-brand",
  ready: "border-success/20 bg-success/10 text-success",
  failed: "border-danger/20 bg-danger/10 text-danger",
};

// ---------- Types ----------

export interface InlineTaskInstance {
  id: string;
  title: string;
  taskType: string;
  status: string;
  slot: string | null;
  dueAt: string;
}

export interface InlineTaskBuildDraft {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  progress: number;
  slot: string | null;
  sourceIds: string[];
  asyncJobId?: string | null;
  draftPayload?: unknown;
  asyncJob?: {
    id: string;
    type: string;
    status: string;
    progress: number;
    error: string | null;
  } | null;
  missingFields: string[];
  error: string | null;
}

export interface InlineSection {
  id: string;
  title: string;
  order: number;
  contentBlocks: BlockEditorBlock[];
  taskInstances: InlineTaskInstance[];
  taskBuildDrafts?: InlineTaskBuildDraft[];
}

export interface InlineChapter {
  id: string;
  title: string;
  order: number;
  sections: InlineSection[];
}

interface InlineSectionRowProps {
  chapter: InlineChapter;
  section: InlineSection;
  expandedBlockId: string | null;
  onToggleBlockExpand: (blockId: string | null) => void;
  onRenameSection: (sectionId: string, newTitle: string) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
  onAddTask: (
    chapterId: string,
    sectionId: string,
    slot: SlotType,
  ) => void;
  onOpenDraft: (
    draft: InlineTaskBuildDraft,
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

export function InlineSectionRow({
  chapter,
  section,
  expandedBlockId,
  onToggleBlockExpand,
  onRenameSection,
  onDeleteSection,
  onAddTask,
  onOpenDraft,
  onCreateBlock,
  onUpdateBlock,
  onDeleteBlock,
}: InlineSectionRowProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);
  const [renaming, setRenaming] = useState(false);
  const [deletingSection, setDeletingSection] = useState(false);
  const [creatingSlot, setCreatingSlot] = useState<SlotType | null>(null);
  const [creatingBlockType, setCreatingBlockType] =
    useState<BlockType>("markdown");
  const [creating, setCreating] = useState(false);

  // Group blocks by slot
  const blocksBySlot: Record<SlotType, BlockEditorBlock[]> = {
    pre: [],
    in: [],
    post: [],
  };
  for (const b of section.contentBlocks) {
    const s = b.slot as SlotType;
    if (s in blocksBySlot) blocksBySlot[s].push(b);
  }
  for (const s of ALL_SLOTS) {
    blocksBySlot[s].sort((a, b) => a.order - b.order);
  }

  // Group tasks by slot
  const tasksBySlot: Record<SlotType, InlineTaskInstance[]> = {
    pre: [],
    in: [],
    post: [],
  };
  for (const t of section.taskInstances) {
    const s = t.slot as SlotType;
    if (s in tasksBySlot) tasksBySlot[s].push(t);
  }

  const draftsBySlot: Record<SlotType, InlineTaskBuildDraft[]> = {
    pre: [],
    in: [],
    post: [],
  };
  for (const draft of section.taskBuildDrafts ?? []) {
    const s = draft.slot as SlotType;
    if (s in draftsBySlot) draftsBySlot[s].push(draft);
  }

  async function handleSaveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === section.title) {
      setEditingTitle(false);
      setTitleDraft(section.title);
      return;
    }
    setRenaming(true);
    try {
      await onRenameSection(section.id, trimmed);
      setEditingTitle(false);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteSection() {
    if (
      !window.confirm(
        `确认删除小节「${section.title}」？下属所有内容块将一并删除（不可恢复）。`,
      )
    ) {
      return;
    }
    setDeletingSection(true);
    try {
      await onDeleteSection(section.id);
    } finally {
      setDeletingSection(false);
    }
  }

  async function handleCreateBlock(slot: SlotType) {
    setCreating(true);
    try {
      await onCreateBlock(chapter.id, section.id, slot, creatingBlockType);
      setCreatingSlot(null);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      id={`section-${section.id}`}
      className="border-b border-line last:border-b-0"
    >
      {/* Section header row — inline editable title */}
      <div className="flex items-center gap-2 bg-paper-alt/40 px-4 py-2.5">
        <span className="fs-num shrink-0 text-[12px] text-ink-5">
          {chapter.order + 1}.{section.order + 1}
        </span>
        {editingTitle ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="h-8 max-w-md text-[13px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveTitle();
                } else if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleDraft(section.title);
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleSaveTitle}
              disabled={renaming}
              className="h-8 px-2"
              aria-label="保存小节标题"
            >
              {renaming ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingTitle(false);
                setTitleDraft(section.title);
              }}
              disabled={renaming}
              className="h-8 px-2"
              aria-label="取消编辑"
            >
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setTitleDraft(section.title);
                setEditingTitle(true);
              }}
              className="group flex flex-1 items-center gap-1.5 text-left text-[13.5px] font-medium text-ink hover:text-brand"
              aria-label="点击编辑小节名"
            >
              <span className="truncate">
                {section.title || "未命名小节"}
              </span>
              <Pencil className="size-3 shrink-0 text-ink-5 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteSection}
              disabled={deletingSection}
              className="size-7 shrink-0 text-ink-4 hover:text-danger"
              aria-label="删除小节"
            >
              {deletingSection ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* 3-slot grid */}
      <div className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-3">
        {ALL_SLOTS.map((slot) => {
          const tasks = tasksBySlot[slot];
          const drafts = draftsBySlot[slot];
          const blocks = blocksBySlot[slot];
          const isCreatingHere = creatingSlot === slot;
          return (
            <div
              key={slot}
              className="rounded-lg border border-line bg-surface p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
                  {SLOT_LABEL[slot]}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onAddTask(chapter.id, section.id, slot)}
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] text-brand transition-colors hover:bg-brand-soft"
                    aria-label={`在${SLOT_LABEL[slot]}添加任务`}
                  >
                    <Plus className="size-3" />
                    任务
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCreatingSlot(isCreatingHere ? null : slot)
                    }
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] text-ink-4 transition-colors hover:bg-paper-alt hover:text-ink-2"
                    aria-label={`在${SLOT_LABEL[slot]}添加内容块`}
                  >
                    <Plus className="size-3" />
                    块
                  </button>
                </div>
              </div>

              {/* Inline create-block form */}
              {isCreatingHere && (
                <div className="mb-2 flex items-center gap-1.5 rounded bg-paper-alt px-2 py-1.5">
                  <Select
                    value={creatingBlockType}
                    onValueChange={(v) =>
                      setCreatingBlockType(v as BlockType)
                    }
                  >
                    <SelectTrigger className="h-7 flex-1 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_BLOCK_TYPES.map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                          className="text-[11px]"
                        >
                          {BLOCK_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => handleCreateBlock(slot)}
                    disabled={creating}
                  >
                    {creating ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      "创建"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setCreatingSlot(null)}
                    disabled={creating}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              )}

              {drafts.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {drafts.map((draft) => {
                    const job = draft.asyncJob ?? null;
                    const displayProgress = job?.progress ?? draft.progress;
                    const statusLabel = job
                      ? `${jobStatusLabel(job.status)} · ${job.type}`
                      : DRAFT_STATUS_LABEL[draft.status] ?? draft.status;
                    const displayError = job?.error || draft.error;

                    return (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => onOpenDraft(draft, chapter.id, section.id, slot)}
                      className={cn(
                        "w-full rounded-md border px-2 py-1.5 text-left text-xs transition hover:ring-2 hover:ring-brand-soft",
                        DRAFT_STATUS_CLASS[draft.status] ??
                          "border-line bg-paper-alt text-ink-3",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="size-3 shrink-0" />
                        <span className="truncate font-medium">
                          {draft.title}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        <Badge
                          variant="outline"
                          className="h-4 px-1 py-0 text-[10px]"
                        >
                          {TASK_TYPE_LABEL[draft.taskType] ?? draft.taskType}
                        </Badge>
                        <span>{statusLabel}</span>
                        {displayProgress > 0 && (
                          <span className="tabular-nums opacity-70">
                            {displayProgress}%
                          </span>
                        )}
                      </div>
                      {job && (
                        <div className="mt-1 h-1 rounded-full bg-white/70">
                          <div
                            className="h-1 rounded-full bg-current transition-all"
                            style={{ width: `${Math.max(4, Math.min(100, displayProgress))}%` }}
                          />
                        </div>
                      )}
                      {draft.missingFields.length > 0 && (
                        <p className="mt-1 line-clamp-1 text-[10px] opacity-70">
                          待补：{draft.missingFields.slice(0, 3).join("、")}
                        </p>
                      )}
                      {displayError && (
                        <p className="mt-1 line-clamp-1 text-[10px] text-danger">
                          {displayError}
                        </p>
                      )}
                    </button>
                    );
                  })}
                </div>
              )}

              {/* Tasks list */}
              {tasks.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {tasks.map((ti) => {
                    const Icon = TASK_ICON[ti.taskType] ?? FileText;
                    return (
                      <Link
                        key={ti.id}
                        href={`/teacher/instances/${ti.id}`}
                        className={cn(
                          "block rounded-md border px-2 py-1.5 text-left text-xs transition-shadow hover:ring-2 hover:ring-brand-soft",
                          STATUS_CLASS[ti.status] ?? "border-line bg-paper-alt",
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <Icon className="size-3 shrink-0" />
                          <span className="truncate font-medium">
                            {ti.title}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                          <Badge
                            variant="outline"
                            className="h-4 px-1 py-0 text-[10px]"
                          >
                            {TASK_TYPE_LABEL[ti.taskType] ?? ti.taskType}
                          </Badge>
                          <span className="opacity-70">
                            {STATUS_LABEL[ti.status] ?? ti.status}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Blocks list — inline expand/collapse */}
              {blocks.length > 0 && (
                <ul className="space-y-1">
                  {blocks.map((b) => {
                    const t = b.blockType as BlockType;
                    const Icon = BLOCK_ICON[t] ?? Box;
                    const label = BLOCK_TYPE_LABEL[t] ?? b.blockType;
                    const isExpanded = expandedBlockId === b.id;
                    return (
                      <li
                        key={b.id}
                        className="rounded border border-line bg-paper-alt"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onToggleBlockExpand(isExpanded ? null : b.id)
                          }
                          className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left transition-colors hover:bg-paper"
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "收起" : "展开"}内容块 ${label}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-3 shrink-0 text-ink-4" />
                          ) : (
                            <ChevronRight className="size-3 shrink-0 text-ink-4" />
                          )}
                          <Icon className="size-3 shrink-0 text-ink-4" />
                          <span className="truncate text-[11.5px] text-ink-2">
                            {label}
                          </span>
                          <span className="ml-auto shrink-0 tabular-nums text-[10px] text-ink-5">
                            #{b.order}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-line bg-surface p-2.5">
                            <BlockEditorDispatch
                              block={b}
                              handlers={{
                                onSave: onUpdateBlock,
                                onDelete: async (id) => {
                                  await onDeleteBlock(id);
                                  if (expandedBlockId === id) {
                                    onToggleBlockExpand(null);
                                  }
                                },
                              }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {drafts.length === 0 &&
                tasks.length === 0 &&
                blocks.length === 0 &&
                !isCreatingHere && (
                <p className="text-center text-[10.5px] text-ink-5">
                  暂无内容
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function jobStatusLabel(status: string) {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "处理中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "失败";
    case "canceled":
      return "已取消";
    default:
      return status;
  }
}
