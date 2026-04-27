"use client";

// PR-STU-2 · 学生 /study-buddy 右侧对话视图组合
// - 包含：ConversationHeader + Messages 滚动区 + Composer
// - 空状态：未选中任何 post 时占位（"选择左侧对话或发起新问题"）
// - pending 时在末尾追加 typing dots 占位气泡

import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import type { StudyBuddyPostRow } from "@/lib/utils/study-buddy-transforms";
import { StudyBuddyConversationHeader } from "./study-buddy-conversation-header";
import { StudyBuddyMessageBubble } from "./study-buddy-message";
import { StudyBuddyComposer } from "./study-buddy-composer";

interface StudyBuddyConversationProps {
  post: StudyBuddyPostRow | null;
  studentInitial: string;
  composerValue: string;
  onComposerChange: (v: string) => void;
  onSendFollowUp: () => void;
  isSendingFollowUp: boolean;
  onCreateNew: () => void;
}

export function StudyBuddyConversation({
  post,
  studentInitial,
  composerValue,
  onComposerChange,
  onSendFollowUp,
  isSendingFollowUp,
  onCreateNew,
}: StudyBuddyConversationProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [post?.id, post?.messages.length, post?.status]);

  if (!post) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-3 bg-paper px-6 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft">
          <Bot className="size-7 text-brand" aria-hidden="true" />
        </div>
        <div className="text-[15px] font-semibold text-ink">
          选择左侧对话或发起新问题
        </div>
        <p className="max-w-[340px] text-[12.5px] leading-relaxed text-ink-4">
          灵析 AI 会基于你的课程与任务上下文，帮你梳理思路、找到知识点的关键。
        </p>
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-2 inline-flex h-8 items-center rounded-md bg-brand px-3 text-[12px] font-semibold text-brand-fg hover:bg-brand-lift"
        >
          发起新问题
        </button>
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-paper">
      <StudyBuddyConversationHeader post={post} />

      {/* Messages 滚动区 */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6 lg:px-8">
        {post.messages.map((m, i) => (
          <StudyBuddyMessageBubble
            key={`${post.id}-${i}`}
            message={m}
            studentInitial={studentInitial}
            mode={post.mode}
          />
        ))}
        {post.status === "pending" && (
          <div className="mb-5 flex items-start gap-3">
            <div
              className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink-2"
              aria-hidden="true"
            >
              <Bot className="size-[18px] text-ochre" />
            </div>
            <div className="rounded-[14px] rounded-bl-[4px] border border-line bg-surface px-4 py-3 shadow-fs">
              <div className="flex items-center gap-1.5" aria-label="灵析 AI 正在回复">
                <span className="size-1.5 animate-pulse rounded-full bg-ink-5" />
                <span
                  className="size-1.5 animate-pulse rounded-full bg-ink-5"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="size-1.5 animate-pulse rounded-full bg-ink-5"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </div>
        )}
        {post.status === "error" && (
          <div className="mb-5 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-[12.5px] text-danger">
            灵析 AI 回复失败，请稍后再试或换一种问法。
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <StudyBuddyComposer
        value={composerValue}
        onChange={onComposerChange}
        onSend={onSendFollowUp}
        isSending={isSendingFollowUp}
        currentMode={post.mode}
        anonymous={post.anonymous}
        disabled={post.status === "pending"}
      />
    </section>
  );
}
