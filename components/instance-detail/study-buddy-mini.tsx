"use client";

// PR-15 bug 4: 任务详情 overview tab 的 Study Buddy mini 模块
// 显示本任务实例的提问 count + 前 3 条，0-state 提示

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  PostThreadDialog,
  type StudyBuddyPostThread,
} from "@/components/study-buddy/post-thread-dialog";

interface ApiPost {
  id: string;
  title: string;
  question: string;
  aiReply: string | null;
  status: "pending" | "answered" | "error";
  anonymous: boolean;
  createdAt: string;
  student: { id: string; name: string | null; email: string };
  taskInstance: {
    id: string;
    title: string;
    chapter: { id: string; title: string } | null;
    section: { id: string; title: string } | null;
  } | null;
  messages: Array<{ role: string; content: string; createdAt?: string }> | null;
  isFreeForm: boolean;
}

const PREVIEW_LIMIT = 3;

interface StudyBuddyMiniProps {
  taskInstanceId: string;
  courseId?: string | null;
}

export function StudyBuddyMini({ taskInstanceId, courseId }: StudyBuddyMiniProps) {
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openPost, setOpenPost] = useState<ApiPost | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/teacher/study-buddy/posts?taskInstanceId=${taskInstanceId}&scope=all&take=50`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          toast.error(json.error?.message || "加载学生提问失败");
          return;
        }
        const raw = (json.data.posts as ApiPost[]) ?? [];
        setPosts(raw);
        setTotal(json.data.stats?.total ?? raw.length);
      } catch {
        if (!cancelled) toast.error("网络错误");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [taskInstanceId]);

  const preview = posts.slice(0, PREVIEW_LIMIT);
  const remaining = Math.max(0, total - PREVIEW_LIMIT);

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Bot className="size-[14px]" />
          学生学习伙伴
          {total > 0 && (
            <Badge variant="outline" className="text-[10.5px]">
              {total} 条提问
            </Badge>
          )}
        </h2>
        {courseId && (
          <Link
            href={`/teacher/courses/${courseId}#study-buddy`}
            className="text-[11.5px] text-brand hover:underline"
          >
            课程汇总 →
          </Link>
        )}
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-ink-4">
          <Loader2 className="size-3.5 animate-spin" />
          加载提问中…
        </div>
      ) : total === 0 ? (
        <p className="mt-3 text-xs text-ink-4">本任务暂无学生提问</p>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {preview.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOpenPost(p)}
                className="w-full rounded-md border border-line bg-paper-alt p-2.5 text-left transition hover:border-brand hover:bg-surface"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                  <span className="text-ink-4">
                    {p.anonymous
                      ? "匿名学生"
                      : p.student.name || p.student.email}
                  </span>
                  <span className="text-ink-5">·</span>
                  <span className="text-ink-5">
                    {new Date(p.createdAt).toLocaleString("zh-CN")}
                  </span>
                  {p.status === "pending" && (
                    <Badge variant="outline" className="border-warn/40 text-warn">
                      未回复
                    </Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-medium text-ink">
                  {p.title}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-4">
                  {p.question}
                </p>
              </button>
            ))}
          </div>
          {remaining > 0 && (
            <p className="mt-2 text-[11px] text-ink-5">
              还有 {remaining} 条提问，点击卡片查看完整对话。
            </p>
          )}
        </>
      )}

      <PostThreadDialog
        open={openPost !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPost(null);
        }}
        post={openPost ? toThreadPost(openPost) : null}
      />
    </section>
  );
}

function toThreadPost(p: ApiPost): StudyBuddyPostThread {
  return {
    id: p.id,
    title: p.title,
    question: p.question,
    aiReply: p.aiReply,
    status: p.status,
    anonymous: p.anonymous,
    createdAt: p.createdAt,
    student: p.student,
    taskInstance: p.taskInstance
      ? {
          title: p.taskInstance.title,
          chapter: p.taskInstance.chapter,
          section: p.taskInstance.section,
        }
      : null,
    messages: p.messages ?? [],
    isFreeForm: p.isFreeForm,
  };
}
