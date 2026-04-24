"use client";

import {
  FileText,
  MessageSquare,
  HelpCircle,
  Link as LinkIcon,
  Sparkles,
  Box,
} from "lucide-react";
import {
  BLOCK_TYPE_LABEL,
  BLOCK_TYPE_HINT,
  type BlockType,
} from "@/lib/utils/course-editor-transforms";

const ICON: Record<BlockType, typeof FileText> = {
  markdown: FileText,
  resource: LinkIcon,
  simulation_config: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
  custom: Box,
};

export interface SelectedSectionBlock {
  id: string;
  blockType: BlockType | string;
  slot: string;
  order: number;
}

export interface SelectedSectionTask {
  id: string;
  title: string;
  taskType: string;
  slot: string | null;
  status: string;
  createdAt: string;
}

export interface SelectedSectionContext {
  chapterTitle: string;
  chapterOrder: number;
  sectionTitle: string;
  sectionOrder: number;
  blocks: SelectedSectionBlock[];
  tasks: SelectedSectionTask[];
}

interface BlockPropertyPanelProps {
  selected: SelectedSectionContext | null;
}

const SLOT_LABEL: Record<string, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

function isKnownBlockType(t: string): t is BlockType {
  return t in BLOCK_TYPE_LABEL;
}

export function BlockPropertyPanel({ selected }: BlockPropertyPanelProps) {
  if (!selected) {
    return (
      <aside className="sticky top-6 w-[280px] shrink-0 self-start rounded-xl border border-line bg-surface p-4 text-[12px]">
        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-ink-5">
          块属性
        </div>
        <p className="text-ink-4">
          点击左侧目录的小节查看该小节下的内容块元数据。添加内容请使用小节表格中的
          <span className="mx-1 rounded bg-paper-alt px-1 text-ink-3">+</span>
          按钮。
        </p>
        <div className="mt-4 border-t border-line-2 pt-3">
          <BlockTypeDescList />
        </div>
        <p className="mt-3 text-[10.5px] text-ink-5">
          深度编辑即将推出
        </p>
      </aside>
    );
  }

  return (
    <aside className="sticky top-6 w-[280px] shrink-0 self-start rounded-xl border border-line bg-surface p-4 text-[12px]">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-ink-5">
        块属性
      </div>

      <div className="rounded-lg bg-brand-soft px-3 py-2.5">
        <div className="text-[10.5px] text-ink-5">
          第 {selected.chapterOrder + 1}.{selected.sectionOrder + 1} 小节
        </div>
        <div className="mt-0.5 truncate text-[13px] font-semibold text-ink">
          {selected.sectionTitle || "未命名小节"}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-ink-3">
          {selected.chapterTitle}
        </div>
      </div>

      <SectionTypesSection blocks={selected.blocks} tasks={selected.tasks} />

      <p className="mt-3 border-t border-line-2 pt-2.5 text-[10.5px] text-ink-5">
        深度编辑即将推出 · 当前通过小节表格的
        <span className="mx-1 text-ink-3">+</span>按钮添加内容
      </p>
    </aside>
  );
}

function SectionTypesSection({
  blocks,
  tasks,
}: {
  blocks: SelectedSectionBlock[];
  tasks: SelectedSectionTask[];
}) {
  const counts = new Map<BlockType, number>();
  for (const b of blocks) {
    if (isKnownBlockType(b.blockType)) {
      counts.set(b.blockType, (counts.get(b.blockType) ?? 0) + 1);
    }
  }
  for (const t of tasks) {
    let key: BlockType | null = null;
    if (t.taskType === "simulation") key = "simulation_config";
    else if (t.taskType === "quiz") key = "quiz";
    else if (t.taskType === "subjective") key = "subjective";
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = blocks.length + tasks.length;

  if (total === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-line-2 px-3 py-3 text-center text-[11px] text-ink-4">
        此小节暂无内容块
      </div>
    );
  }

  const orderedTypes: BlockType[] = [
    "markdown",
    "resource",
    "simulation_config",
    "quiz",
    "subjective",
    "custom",
  ];

  return (
    <>
      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-4">
        <span>块 / 任务</span>
        <span className="fs-num text-ink-2">
          {blocks.length}
          <span className="mx-0.5 text-ink-5">块 ·</span>
          {tasks.length}
          <span className="ml-0.5 text-ink-5">任务</span>
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {orderedTypes.map((k) => {
          const n = counts.get(k) ?? 0;
          const Icon = ICON[k];
          return (
            <li
              key={k}
              className="flex items-center gap-2 rounded px-1.5 py-1 text-[11.5px] text-ink-3"
            >
              <Icon className="size-[12px] text-ink-4" />
              <span className="font-medium text-ink-2">
                {BLOCK_TYPE_LABEL[k]}
              </span>
              <span className="ml-auto fs-num text-ink-5">{n}</span>
            </li>
          );
        })}
      </ul>

      {tasks.length > 0 && (
        <div className="mt-3 border-t border-line-2 pt-2.5">
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-5">
            任务实例
          </div>
          <ul className="flex flex-col gap-1">
            {tasks.slice(0, 6).map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-1.5 text-[11px] text-ink-3"
              >
                <span className="truncate">{t.title}</span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-5">
                  {t.slot ? SLOT_LABEL[t.slot] ?? t.slot : ""}
                </span>
              </li>
            ))}
            {tasks.length > 6 && (
              <li className="text-[10.5px] text-ink-5">
                及另外 {tasks.length - 6} 项…
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}

function BlockTypeDescList() {
  const items: BlockType[] = [
    "markdown",
    "resource",
    "simulation_config",
    "quiz",
    "subjective",
    "custom",
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-ink-5">
        支持的块类型
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((k) => {
          const I = ICON[k];
          return (
            <li
              key={k}
              className="flex items-center gap-2 text-[11px] text-ink-3"
            >
              <I className="size-[11px] text-ink-4" />
              <span className="font-medium text-ink-2">
                {BLOCK_TYPE_LABEL[k]}
              </span>
              <span
                title={BLOCK_TYPE_HINT[k]}
                className="ml-auto flex items-center gap-1 rounded bg-paper-alt px-1.5 py-[1px] text-[10px] text-ink-5"
              >
                <Sparkles className="size-[9px]" />
                可用
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
