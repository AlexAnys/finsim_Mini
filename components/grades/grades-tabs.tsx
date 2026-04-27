"use client";

// PR-STU-1 · 学生 /grades 列表头部 tab + 排序提示
// - 4 tab：全部 / 模拟 / 测验 / 主观 — 每个含计数徽章
// - 选中态：bg-ink + text-white；未选：transparent + text-ink-3
// - 右侧固定文案"按提交时间降序"

import type { GradesTabKey } from "@/lib/utils/grades-transforms";

interface GradesTabsProps {
  active: GradesTabKey;
  counts: Record<GradesTabKey, number>;
  onChange: (next: GradesTabKey) => void;
}

const TABS: { key: GradesTabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "simulation", label: "模拟" },
  { key: "quiz", label: "测验" },
  { key: "subjective", label: "主观" },
];

export function GradesTabs({ active, counts, onChange }: GradesTabsProps) {
  return (
    <div className="flex items-center gap-1 border-b border-line px-[18px] py-3.5">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={isActive}
            className={`flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-ink text-white"
                : "text-ink-3 hover:bg-paper-alt"
            }`}
          >
            <span>{t.label}</span>
            <span className="opacity-60">{counts[t.key] ?? 0}</span>
          </button>
        );
      })}
      <div className="ml-auto text-[11.5px] text-ink-5">按提交时间降序</div>
    </div>
  );
}
