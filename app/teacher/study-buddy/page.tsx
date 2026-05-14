"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, MessageSquareText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SbPost {
  id: string;
  studentId: string;
  taskId: string | null;
  courseId: string | null;
  taskInstanceId: string | null;
  title: string;
  question: string;
  mode: "socratic" | "direct";
  anonymous: boolean;
  status: "pending" | "answered" | "error";
  aiReply: string | null;
  createdAt: string;
  isFreeForm: boolean;
  inferredCourseId: string | null;
  inferredCourseTitle: string | null;
  student: { id: string; name: string | null; email: string };
  task: { id: string; taskName: string } | null;
  taskInstance: {
    id: string;
    title: string;
    chapter: { id: string; title: string } | null;
    section: { id: string; title: string } | null;
  } | null;
}

type ScopeKey = "all" | "pending" | "answered";

const SCOPE_LABEL: Record<ScopeKey, string> = {
  all: "全部",
  pending: "未答疑",
  answered: "AI 已回复",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "待回复",
  answered: "已回复",
  error: "回复失败",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  answered: "default",
  error: "destructive",
};

export default function TeacherStudyBuddyPage() {
  const [scope, setScope] = useState<ScopeKey>("all");
  const [posts, setPosts] = useState<SbPost[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    answered: number;
    students: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SbPost | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function fetchPosts(targetScope: ScopeKey = scope) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/study-buddy/posts?scope=${targetScope}`,
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载失败");
        return;
      }
      setPosts(json.data.posts);
      setStats(json.data.stats);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/study-buddy/posts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "删除失败");
        return;
      }
      toast.success("已删除");
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setDeletingId(null);
    }
  }

  const sortedPosts = useMemo(() => {
    return [...posts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [posts]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-10 pt-2 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            <MessageSquareText className="size-3.5" />
            学习问答管理
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink">
            学生提问
          </h1>
          {stats && (
            <p className="mt-1 text-[13px] text-ink-4">
              共 {stats.total} 条提问 · 待回复 {stats.pending} · 已回复 {stats.answered} ·
              涉及学生 {stats.students} 人
            </p>
          )}
        </div>
      </header>

      <Tabs value={scope} onValueChange={(v) => setScope(v as ScopeKey)}>
        <TabsList>
          {(["all", "pending", "answered"] as const).map((s) => (
            <TabsTrigger key={s} value={s}>
              {SCOPE_LABEL[s]}
              {stats && s !== "all" && (
                <span className="ml-1 text-ink-4">
                  ({s === "pending" ? stats.pending : stats.answered})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-ink-5" />
          <span className="ml-2 text-sm text-ink-4">加载提问中...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20">
          <AlertCircle className="size-8 text-destructive" />
          <p className="text-destructive">{error}</p>
        </div>
      ) : sortedPosts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-ink-4">
            <MessageSquareText className="size-10 text-ink-5" />
            <p className="mt-3">当前筛选下暂无学生提问</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedPosts.map((post) => {
            const expanded = expandedId === post.id;
            const courseTitle = post.inferredCourseTitle ?? "（未关联课程）";
            const chapterTitle = post.taskInstance?.chapter?.title;
            const sectionTitle = post.taskInstance?.section?.title;
            const taskTitle = post.taskInstance?.title ?? post.task?.taskName;
            return (
              <Card key={post.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10.5px]">
                          {courseTitle}
                        </Badge>
                        {post.isFreeForm ? (
                          <Badge
                            variant="secondary"
                            className="bg-paper-alt text-[10.5px]"
                          >
                            自由问
                          </Badge>
                        ) : (
                          taskTitle && (
                            <span className="text-[11.5px] text-ink-4">
                              · {chapterTitle ? `${chapterTitle} / ` : ""}
                              {sectionTitle ? `${sectionTitle} / ` : ""}
                              {taskTitle}
                            </span>
                          )
                        )}
                        <Badge
                          variant={STATUS_VARIANT[post.status] || "outline"}
                          className="text-[10.5px]"
                        >
                          {STATUS_LABEL[post.status] ?? post.status}
                        </Badge>
                        {post.anonymous && (
                          <Badge variant="outline" className="text-[10.5px]">
                            匿名
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-[15px] leading-snug">
                        {post.title}
                      </CardTitle>
                      <div className="mt-0.5 text-[11.5px] text-ink-4">
                        {post.anonymous
                          ? "（匿名学生）"
                          : post.student.name || post.student.email}{" "}
                        · {new Date(post.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedId(expanded ? null : post.id)
                        }
                      >
                        {expanded ? "收起" : "展开"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(post)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expanded && (
                  <CardContent className="space-y-3 border-t border-line-2 bg-paper-alt/40 pt-3">
                    <div>
                      <div className="mb-1 text-[11.5px] font-medium text-ink-4">
                        学生提问
                      </div>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                        {post.question}
                      </p>
                    </div>
                    {post.aiReply && (
                      <div>
                        <div className="mb-1 text-[11.5px] font-medium text-ink-4">
                          AI 回复
                        </div>
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                          {post.aiReply}
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除（隐藏）此提问</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{deleteTarget?.title}」？此操作会把帖子从老师与学生的列表中移除（软删，DB 仍保留记录）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
