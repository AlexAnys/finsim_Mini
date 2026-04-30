"use client";

// PR-STU-2 · 学生 /study-buddy 单条消息气泡
// - student：右对齐、深靛底、白字、avatar 显示用户首字
// - ai：左对齐、白底+border、avatar 用品牌 logo
// - 顶行：角色名 + 模式 chip（仅 socratic ai）+ 时间
// - 气泡角：student 右下小、ai 左下小（mockup）

import Image from "next/image";
import type { StudyBuddyMode, StudyBuddyMessage } from "@/lib/utils/study-buddy-transforms";
import { formatMessageTime } from "@/lib/utils/study-buddy-transforms";

interface StudyBuddyMessageProps {
  message: StudyBuddyMessage;
  /** 用户首字（用于 avatar 占位） */
  studentInitial: string;
  /** 当前 post 的模式（决定 ai 气泡是否显 Socratic chip） */
  mode: StudyBuddyMode;
}

export function StudyBuddyMessageBubble({
  message,
  studentInitial,
  mode,
}: StudyBuddyMessageProps) {
  const isUser = message.role === "student";
  const showSocraticChip = !isUser && mode === "socratic";

  return (
    <div
      className={`mb-5 flex items-start gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`grid size-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-semibold text-white ${
          isUser ? "bg-brand" : "border border-line bg-ink"
        }`}
        aria-hidden="true"
      >
        {isUser ? (
          studentInitial
        ) : (
          <Image
            src="/brand/lingxi-logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-[7px] object-cover"
          />
        )}
      </div>

      {/* Bubble */}
      <div className="min-w-0 max-w-[72%]">
        <div
          className={`mb-1 flex items-center gap-2 ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <span className="text-[12px] font-semibold text-ink-2">
            {isUser ? "你" : "灵析 AI"}
          </span>
          {showSocraticChip && (
            <span className="rounded-sm border border-brand/20 bg-brand-soft px-1.5 py-[1px] text-[10px] font-medium text-brand">
              引导式
            </span>
          )}
          <span className="font-mono text-[10.5px] text-ink-5">
            {formatMessageTime(message.createdAt)}
          </span>
        </div>
        <div
          className={`whitespace-pre-wrap px-4 py-3 text-[13.5px] leading-[1.65] ${
            isUser
              ? "rounded-[14px] rounded-br-[4px] bg-brand text-brand-fg"
              : "rounded-[14px] rounded-bl-[4px] border border-line bg-surface text-ink-2 shadow-fs"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
