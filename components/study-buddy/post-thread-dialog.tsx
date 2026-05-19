"use client";

// PR-15 bug 3 + bug 4 共用：完整 thread Dialog
// 学生原 post + AI 回复 + 学生 follow-up + AI 追加回复（按 messages 时间轴展开）

import { Bot, User as UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface StudyBuddyMessageLike {
  role: string;
  content: string;
  createdAt?: string;
}

export interface StudyBuddyPostThread {
  id: string;
  title: string;
  question: string;
  aiReply: string | null;
  status: "pending" | "answered" | "error";
  anonymous: boolean;
  createdAt: string;
  student: { id: string; name: string | null; email: string };
  taskInstance?: {
    title?: string | null;
    chapter?: { title: string | null } | null;
    section?: { title: string | null } | null;
  } | null;
  messages?: StudyBuddyMessageLike[] | null;
  isFreeForm?: boolean;
}

interface PostThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: StudyBuddyPostThread | null;
}

function safeFormatTime(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-CN");
  } catch {
    return value;
  }
}

export function PostThreadDialog({
  open,
  onOpenChange,
  post,
}: PostThreadDialogProps) {
  if (!post) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>加载中</DialogTitle>
            <DialogDescription>正在加载提问完整对话…</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const messages = Array.isArray(post.messages) ? post.messages : [];
  const followUps = messages.filter(
    (m, idx) => !(idx === 0 && (m.role === "user" || m.role === "student")),
  );
  const studentName = post.anonymous
    ? "匿名学生"
    : post.student?.name || post.student?.email || "学生";

  const ti = post.taskInstance;
  const scopeLabel = post.isFreeForm
    ? "自由问"
    : [
        ti?.chapter?.title,
        ti?.section?.title,
        ti?.title,
      ]
        .filter(Boolean)
        .join(" / ") || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-2xl">
        <DialogHeader className="space-y-2 border-b border-line px-1 pb-3">
          <DialogTitle className="line-clamp-2 text-base leading-snug">
            {post.title}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-[11.5px] text-ink-4">
            <span>{studentName}</span>
            <span className="text-ink-5">·</span>
            <span>{safeFormatTime(post.createdAt)}</span>
            {post.isFreeForm ? (
              <Badge variant="secondary" className="text-[10.5px]">
                自由问
              </Badge>
            ) : (
              <span className="text-ink-5">·</span>
            )}
            {!post.isFreeForm && (
              <span className="text-ink-3">{scopeLabel}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="space-y-4 py-3">
            <ThreadBubble
              role="student"
              authorName={studentName}
              content={post.question}
              timestamp={post.createdAt}
            />

            {post.aiReply && (
              <ThreadBubble
                role="assistant"
                authorName="灵析 AI"
                content={post.aiReply}
              />
            )}

            {followUps.length > 0 && (
              <div className="space-y-3">
                {followUps.map((m, i) => (
                  <ThreadBubble
                    key={`${post.id}-fu-${i}`}
                    role={
                      m.role === "assistant" || m.role === "ai"
                        ? "assistant"
                        : "student"
                    }
                    authorName={
                      m.role === "assistant" || m.role === "ai"
                        ? "灵析 AI"
                        : studentName
                    }
                    content={m.content}
                    timestamp={m.createdAt}
                  />
                ))}
              </div>
            )}

            {!post.aiReply && followUps.length === 0 && (
              <p className="text-center text-[12px] text-ink-4">
                {post.status === "pending"
                  ? "AI 尚未回复或正在处理"
                  : "本次提问无后续对话"}
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ThreadBubble({
  role,
  authorName,
  content,
  timestamp,
}: {
  role: "student" | "assistant";
  authorName: string;
  content: string;
  timestamp?: string;
}) {
  const isAi = role === "assistant";
  return (
    <div className="flex items-start gap-2.5">
      <div
        className={
          "grid size-8 shrink-0 place-items-center rounded-lg " +
          (isAi ? "bg-brand-soft text-brand" : "bg-paper-alt text-ink-3")
        }
        aria-hidden="true"
      >
        {isAi ? <Bot className="size-4" /> : <UserIcon className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-4">
          <span className="font-medium text-ink-3">{authorName}</span>
          {timestamp && <span>{safeFormatTime(timestamp)}</span>}
        </div>
        <p className="whitespace-pre-wrap rounded-md border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink-2">
          {content}
        </p>
      </div>
    </div>
  );
}
