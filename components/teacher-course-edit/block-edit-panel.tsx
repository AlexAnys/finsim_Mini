"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Loader2,
  FileText,
  MessageSquare,
  HelpCircle,
  Link as LinkIcon,
  Box,
  Trash2,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BLOCK_TYPE_LABEL,
  type BlockType,
  type SlotType,
} from "@/lib/utils/course-editor-transforms";
import { cn } from "@/lib/utils";
import { BlockEditorDispatch } from "./block-editors";
import type { BlockEditorBlock, BlockEditorHandlers } from "./block-editors/types";

export interface EditableSectionContext {
  courseId: string;
  chapterId: string;
  sectionId: string;
  chapterTitle: string;
  chapterOrder: number;
  sectionTitle: string;
  sectionOrder: number;
  blocks: BlockEditorBlock[];
}

const BLOCK_ICON: Record<BlockType, LucideIcon> = {
  markdown: FileText,
  resource: LinkIcon,
  simulation_config: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
  custom: Box,
};

const SLOT_LABEL: Record<SlotType, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

const ALL_BLOCK_TYPES: BlockType[] = [
  "markdown",
  "resource",
  "simulation_config",
  "quiz",
  "subjective",
  "custom",
];
const ALL_SLOTS: SlotType[] = ["pre", "in", "post"];

interface Props {
  section: EditableSectionContext | null;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string | null) => void;
  onCreateBlock: (
    slot: SlotType,
    blockType: BlockType
  ) => Promise<void>;
  onUpdateBlock: (blockId: string, payload: Record<string, unknown>) => Promise<void>;
  onDeleteBlock: (blockId: string) => Promise<void>;
  onReorderBlock: (blockId: string, direction: "up" | "down") => Promise<void>;
  onRenameSection: (newTitle: string) => Promise<void>;
  onDeleteSection: () => Promise<void>;
}

export function BlockEditPanel({
  section,
  selectedBlockId,
  onSelectBlock,
  onCreateBlock,
  onUpdateBlock,
  onDeleteBlock,
  onReorderBlock,
  onRenameSection,
  onDeleteSection,
}: Props) {
  if (!section) {
    return (
      <aside className="sticky top-6 w-[320px] shrink-0 self-start rounded-xl border border-line bg-surface p-4">
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-ink-5">
          块编辑
        </div>
        <p className="text-xs text-ink-4">
          点击左侧目录或下方章节表格选中一个小节，即可在此面板管理该小节的内容块与任务引用。
        </p>
      </aside>
    );
  }

  const selectedBlock =
    selectedBlockId === null
      ? null
      : section.blocks.find((b) => b.id === selectedBlockId) ?? null;

  return (
    <aside className="sticky top-6 w-[320px] shrink-0 self-start rounded-xl border border-line bg-surface text-xs">
      {selectedBlock ? (
        <BlockEditorView
          section={section}
          block={selectedBlock}
          onBack={() => onSelectBlock(null)}
          onSave={onUpdateBlock}
          onDelete={async (id) => {
            await onDeleteBlock(id);
            onSelectBlock(null);
          }}
        />
      ) : (
        <SectionOverview
          // PR-FIX-3 C3: key={sectionId} 让切换小节时整个组件重 mount，自动 reset 编辑态
          // （editingTitle / titleDraft / creatingSlot 等 useState 不会跨 section 串味）
          key={section.sectionId}
          section={section}
          onSelectBlock={onSelectBlock}
          onCreateBlock={onCreateBlock}
          onReorderBlock={onReorderBlock}
          onRenameSection={onRenameSection}
          onDeleteSection={onDeleteSection}
        />
      )}
    </aside>
  );
}

function BlockEditorView({
  section,
  block,
  onBack,
  onSave,
  onDelete,
}: {
  section: EditableSectionContext;
  block: BlockEditorBlock;
  onBack: () => void;
  onSave: (id: string, p: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const typeLabel =
    BLOCK_TYPE_LABEL[block.blockType as BlockType] ?? block.blockType;
  const slotLabel = SLOT_LABEL[block.slot as SlotType] ?? block.slot;
  const handlers: BlockEditorHandlers = {
    onSave,
    onDelete,
  };
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-1.5"
          onClick={onBack}
          aria-label="返回小节概览"
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] text-ink-5">
            {slotLabel} · {typeLabel}
          </div>
          <div className="truncate text-[12px] font-semibold text-ink">
            {section.sectionTitle}
          </div>
        </div>
      </div>
      <div className="p-3.5">
        <BlockEditorDispatch block={block} handlers={handlers} />
      </div>
    </div>
  );
}

function SectionOverview({
  section,
  onSelectBlock,
  onCreateBlock,
  onReorderBlock,
  onRenameSection,
  onDeleteSection,
}: {
  section: EditableSectionContext;
  onSelectBlock: (id: string | null) => void;
  onCreateBlock: (slot: SlotType, blockType: BlockType) => Promise<void>;
  onReorderBlock: (blockId: string, direction: "up" | "down") => Promise<void>;
  onRenameSection: (newTitle: string) => Promise<void>;
  onDeleteSection: () => Promise<void>;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.sectionTitle);
  const [renaming, setRenaming] = useState(false);
  const [deletingSection, setDeletingSection] = useState(false);
  const [creatingSlot, setCreatingSlot] = useState<SlotType | null>(null);
  const [createBlockType, setCreateBlockType] = useState<BlockType>("markdown");
  const [creating, setCreating] = useState(false);

  const grouped: Record<SlotType, BlockEditorBlock[]> = {
    pre: [],
    in: [],
    post: [],
  };
  for (const b of section.blocks) {
    const s = b.slot as SlotType;
    if (s in grouped) grouped[s].push(b);
  }
  // within each slot, sort by order ascending
  for (const s of ALL_SLOTS) {
    grouped[s].sort((a, b) => a.order - b.order);
  }

  async function handleSaveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === section.sectionTitle) {
      setEditingTitle(false);
      setTitleDraft(section.sectionTitle);
      return;
    }
    setRenaming(true);
    try {
      await onRenameSection(trimmed);
      setEditingTitle(false);
    } finally {
      setRenaming(false);
    }
  }

  async function handleDeleteSection() {
    if (
      !window.confirm(
        `确认删除小节「${section.sectionTitle}」？下属所有内容块将一并删除（不可恢复）。`
      )
    )
      return;
    setDeletingSection(true);
    try {
      await onDeleteSection();
    } finally {
      setDeletingSection(false);
    }
  }

  async function handleCreate(slot: SlotType) {
    setCreating(true);
    try {
      await onCreateBlock(slot, createBlockType);
      setCreatingSlot(null);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-line-2 px-3 py-2.5">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-ink-5">
          块编辑
        </div>
        <div className="mt-1 text-[10.5px] text-ink-5">
          第 {section.chapterOrder + 1}.{section.sectionOrder + 1} 小节
        </div>
        {editingTitle ? (
          <div className="mt-1 flex items-center gap-1.5">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              className="h-7 text-[12px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                else if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleDraft(section.sectionTitle);
                }
              }}
            />
            <Button
              size="sm"
              onClick={handleSaveTitle}
              disabled={renaming}
              className="h-7"
            >
              {renaming ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                "保存"
              )}
            </Button>
          </div>
        ) : (
          <div className="mt-1 flex items-start gap-1">
            <div className="flex-1 truncate text-[13px] font-semibold text-ink">
              {section.sectionTitle || "未命名小节"}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-ink-4 hover:text-brand"
              onClick={() => {
                setEditingTitle(true);
                setTitleDraft(section.sectionTitle);
              }}
              aria-label="重命名小节"
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-ink-4 hover:text-danger"
              onClick={handleDeleteSection}
              disabled={deletingSection}
              aria-label="删除小节"
            >
              {deletingSection ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </Button>
          </div>
        )}
        <div className="mt-0.5 truncate text-[11px] text-ink-4">
          {section.chapterTitle}
        </div>
      </div>

      <div className="px-3 py-2.5">
        {ALL_SLOTS.map((slot) => {
          const blocks = grouped[slot];
          const isCreatingHere = creatingSlot === slot;
          return (
            <div key={slot} className="mb-3 last:mb-0">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-ink-2">
                  {SLOT_LABEL[slot]}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCreatingSlot(isCreatingHere ? null : slot)
                  }
                  className="flex items-center gap-0.5 text-ink-4 transition-colors hover:text-brand"
                >
                  <Plus className="size-3" />
                  <span className="text-[10.5px]">新建块</span>
                </button>
              </div>

              {isCreatingHere && (
                <div className="mb-1.5 flex items-center gap-1.5 rounded bg-paper-alt px-2 py-1.5">
                  <Label className="shrink-0 text-[10.5px] text-ink-4">类型</Label>
                  <Select
                    value={createBlockType}
                    onValueChange={(v) => setCreateBlockType(v as BlockType)}
                  >
                    <SelectTrigger className="h-7 flex-1 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_BLOCK_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-[11px]">
                          {BLOCK_TYPE_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-7"
                    onClick={() => handleCreate(slot)}
                    disabled={creating}
                  >
                    {creating ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      "创建"
                    )}
                  </Button>
                </div>
              )}

              {blocks.length === 0 ? (
                <div className="rounded border border-dashed border-line-2 px-2 py-2 text-center text-[10.5px] text-ink-5">
                  暂无
                </div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {blocks.map((b, idx) => {
                    const t = b.blockType as BlockType;
                    const Icon = BLOCK_ICON[t] ?? Box;
                    const label = BLOCK_TYPE_LABEL[t] ?? b.blockType;
                    const isFirst = idx === 0;
                    const isLast = idx === blocks.length - 1;
                    return (
                      <li
                        key={b.id}
                        className={cn(
                          "flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-1 transition-colors",
                          "hover:border-brand/40 hover:bg-brand-soft/40"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectBlock(b.id)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          <Icon className="size-3 shrink-0 text-ink-4" />
                          <span className="truncate text-[11.5px] text-ink-2">
                            {label}
                          </span>
                          <span className="ml-auto shrink-0 tabular-nums text-[10px] text-ink-5">
                            #{b.order}
                          </span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-ink-4 disabled:opacity-30"
                          disabled={isFirst}
                          onClick={() => onReorderBlock(b.id, "up")}
                          aria-label="上移"
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 text-ink-4 disabled:opacity-30"
                          disabled={isLast}
                          onClick={() => onReorderBlock(b.id, "down")}
                          aria-label="下移"
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
