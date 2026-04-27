"use client";

// PR-STU-2 · 学生 /study-buddy 底部 composer
// - 圆角卡 + 阴影
// - Textarea：自适应高度（最少 28px，最多 ~120px）
// - 底栏：模式切换（引导式/直接 segmented control）+ 匿名 checkbox + 发送按钮
// - 中文文案 + ⌘↵ 提示
// - Enter（无 Shift）发送，Shift+Enter 换行
//
// 注意：模式切换在每条 follow-up 仅作为前端 UI 状态展示（service 层 followup 仍按
// 原 post.mode 走 — 保留现有业务逻辑，避免改 service 接口）。

import { Send, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import type { StudyBuddyMode } from "@/lib/utils/study-buddy-transforms";

interface StudyBuddyComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  isSending: boolean;
  /** 当前对话模式（仅展示，不可改 — 由 post 创建时锁定） */
  currentMode: StudyBuddyMode;
  /** 当前对话是否匿名（仅展示，不可改 — 由 post 创建时锁定） */
  anonymous: boolean;
  /** pending 状态时禁用发送 */
  disabled: boolean;
}

const MODES: { key: StudyBuddyMode; label: string }[] = [
  { key: "socratic", label: "引导式" },
  { key: "direct", label: "直接" },
];

export function StudyBuddyComposer({
  value,
  onChange,
  onSend,
  isSending,
  currentMode,
  anonymous,
  disabled,
}: StudyBuddyComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整 textarea 高度
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [value]);

  const sendDisabled = !value.trim() || isSending || disabled;

  return (
    <div className="border-t border-line bg-paper px-6 pb-5 pt-4 lg:px-8">
      <div className="rounded-[14px] border-[1.5px] border-line bg-surface p-3 shadow-fs-lg">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) ||
              ((e.metaKey || e.ctrlKey) && e.key === "Enter")
            ) {
              e.preventDefault();
              if (!sendDisabled) onSend();
            }
          }}
          placeholder={disabled ? "灵析正在回复…" : "继续提问…"}
          disabled={disabled}
          rows={1}
          className="block w-full resize-none border-none bg-transparent px-1.5 py-1 text-[13.5px] leading-[1.55] text-ink-2 placeholder:text-ink-5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="mt-2 flex items-center gap-2 border-t border-line-2 pt-2">
          {/* 模式 segmented control（只读展示当前对话模式） */}
          <div className="inline-flex gap-0.5 rounded-md bg-paper p-0.5">
            {MODES.map((m) => {
              const active = currentMode === m.key;
              return (
                <span
                  key={m.key}
                  aria-current={active ? "true" : undefined}
                  className={`inline-flex h-6 items-center rounded-[5px] px-2.5 text-[11.5px] ${
                    active
                      ? "bg-surface font-semibold text-ink-2 shadow-fs"
                      : "font-medium text-ink-4"
                  }`}
                >
                  {m.label}
                </span>
              );
            })}
          </div>

          {/* 匿名只读 indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-ink-5">
            <span
              aria-hidden="true"
              className={`grid size-3 place-items-center rounded-[3px] border ${
                anonymous
                  ? "border-brand bg-brand text-brand-fg"
                  : "border-line bg-paper"
              }`}
            >
              {anonymous && (
                <span className="text-[8px] leading-none">✓</span>
              )}
            </span>
            匿名
          </div>

          {/* 发送按钮 */}
          <button
            type="button"
            onClick={onSend}
            disabled={sendDisabled}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-brand px-3 text-[12px] font-semibold text-brand-fg transition-colors hover:bg-brand-lift disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? (
              <>
                <Send className="size-3 animate-pulse" aria-hidden="true" />
                发送中…
              </>
            ) : (
              <>
                <Sparkles className="size-3" aria-hidden="true" />
                发送
                <span className="ml-0.5 font-mono text-[10.5px] opacity-70">
                  ⌘↵
                </span>
              </>
            )}
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-5">
        AI 回复仅作学习引导，重要概念请以教材和教师讲解为准。
      </p>
    </div>
  );
}
