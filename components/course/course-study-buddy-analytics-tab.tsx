"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Loader2, MessageSquareText, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PostThreadDialog,
  type StudyBuddyPostThread,
} from "@/components/study-buddy/post-thread-dialog";

interface StudyBuddyAnalyticsTabProps {
  courseId: string;
}

interface StudyBuddyGroup {
  chapterTitle: string;
  sectionTitle: string;
  taskTitle: string;
  taskType: string;
  questionCount: number;
  pendingCount: number;
  students: Array<{ id: string; name: string; count: number }>;
  examples: string[];
}

interface StudyBuddyAnalyticsData {
  totalQuestions: number;
  pendingQuestions: number;
  activeStudents: number;
  groups: StudyBuddyGroup[];
  aiSummary: {
    keyQuestions: string[];
    knowledgeGaps: string[];
    teachingSuggestions: string[];
  } | null;
  aiError: string | null;
}

interface RawPost {
  id: string;
  title: string;
  question: string;
  aiReply: string | null;
  status: "pending" | "answered" | "error";
  anonymous: boolean;
  createdAt: string;
  student: { id: string; name: string | null; email: string };
  task: { id: string; taskName: string } | null;
  taskInstance: {
    id: string;
    title: string;
    courseId: string;
    chapter: { id: string; title: string } | null;
    section: { id: string; title: string } | null;
  } | null;
  messages: Array<{ role: string; content: string; createdAt?: string }> | null;
  isFreeForm: boolean;
}

const VISIBLE_CARDS = 12;

export function CourseStudyBuddyAnalyticsTab({ courseId }: StudyBuddyAnalyticsTabProps) {
  const [data, setData] = useState<StudyBuddyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async (summarize = false) => {
    if (summarize) setSummarizing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/lms/study-buddy/analytics?courseId=${courseId}${summarize ? "&summarize=true" : ""}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "加载 Study Buddy 统计失败");
        return;
      }
      setData(json.data);
      if (summarize && json.data.aiError) {
        toast.error(`AI 总结失败：${json.data.aiError}`);
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
      setSummarizing(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        加载 Study Buddy 统计...
      </div>
    );
  }

  // PR-15 bug 3: 即使 analytics endpoint (task-bound only) 返回 0，
  // 也要渲染高频问题卡（含自由问）。零状态由 HighFrequencyQuestionsGrid 内部 + 任务分组卡内部各自负责。
  const hasAnyData = data && data.totalQuestions > 0;
  const totalQuestions = data?.totalQuestions ?? 0;
  const pendingQuestions = data?.pendingQuestions ?? 0;
  const activeStudents = data?.activeStudents ?? 0;
  const aiSummary = data?.aiSummary ?? null;
  const groups = data?.groups ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="学生提问" value={totalQuestions} />
        <Metric label="未完成回复" value={pendingQuestions} />
        <Metric label="参与学生" value={activeStudents} />
      </div>

      {hasAnyData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">AI 问题总结</CardTitle>
            <Button size="sm" onClick={() => load(true)} disabled={summarizing}>
              {summarizing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              生成总结
            </Button>
          </CardHeader>
          <CardContent>
            {aiSummary ? (
              <div className="grid gap-4 md:grid-cols-3">
                <SummaryBlock title="主要问题" items={aiSummary.keyQuestions} />
                <SummaryBlock title="知识盲区" items={aiSummary.knowledgeGaps} />
                <SummaryBlock title="补讲建议" items={aiSummary.teachingSuggestions} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">先展示确定性统计；需要时可生成 AI 聚类总结。</p>
            )}
          </CardContent>
        </Card>
      )}

      <HighFrequencyQuestionsGrid courseId={courseId} />

      {hasAnyData && groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">按任务分组（高频问题来源）</CardTitle>
            <p className="text-xs text-muted-foreground">
              按任务聚合学生提问，与上方「高频问题」互补。
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {groups.map((group, index) => (
              <div
                key={`${group.taskTitle}-${index}`}
                className="rounded-md border border-line p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{group.taskType}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {group.chapterTitle} / {group.sectionTitle}
                      </span>
                    </div>
                    <h4 className="mt-1 truncate text-sm font-semibold">{group.taskTitle}</h4>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>{group.questionCount} 问</span>
                    {group.pendingCount > 0 && <Badge variant="secondary">{group.pendingCount} 未回复</Badge>}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3" />
                      {group.students.length}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                  <div className="space-y-1">
                    {group.examples.slice(0, 3).map((question, i) => (
                      <p key={i} className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                        {question}
                      </p>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {group.students.slice(0, 4).map((student) => (
                      <div key={student.id} className="flex justify-between rounded-md border px-2 py-1 text-xs">
                        <span className="truncate">{student.name}</span>
                        <span>{student.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <PendingQuestionsList courseId={courseId} />
    </div>
  );
}

function HighFrequencyQuestionsGrid({ courseId }: { courseId: string }) {
  const [posts, setPosts] = useState<RawPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [chapterId, setChapterId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const [openPost, setOpenPost] = useState<RawPost | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/teacher/study-buddy/posts?courseId=${courseId}&scope=all&take=200`,
        );
        const json = await res.json();
        if (cancelled) return;
        if (!json.success) {
          toast.error(json.error?.message || "加载学生提问失败");
          return;
        }
        setPosts((json.data.posts as RawPost[]) ?? []);
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
  }, [courseId]);

  const chapterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) {
      const ch = p.taskInstance?.chapter;
      if (ch?.id) map.set(ch.id, ch.title);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [posts]);

  const sectionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of posts) {
      const sec = p.taskInstance?.section;
      const ch = p.taskInstance?.chapter;
      if (sec?.id && (chapterId === "all" || ch?.id === chapterId)) {
        map.set(sec.id, sec.title);
      }
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [posts, chapterId]);

  useEffect(() => {
    if (sectionId !== "all" && !sectionOptions.some((s) => s.id === sectionId)) {
      setSectionId("all");
    }
  }, [sectionId, sectionOptions]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (chapterId !== "all") {
        if (p.taskInstance?.chapter?.id !== chapterId) return false;
      }
      if (sectionId !== "all") {
        if (p.taskInstance?.section?.id !== sectionId) return false;
      }
      return true;
    });
  }, [posts, chapterId, sectionId]);

  const rankedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => {
      const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (t !== 0) return t;
      return a.id.localeCompare(b.id);
    });
  }, [filteredPosts]);

  const visible = rankedPosts.slice(0, VISIBLE_CARDS);
  const remaining = Math.max(0, rankedPosts.length - VISIBLE_CARDS);

  return (
    <Card data-section="high-freq-questions">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">高频问题</CardTitle>
          <p className="text-xs text-muted-foreground">
            按时间倒序展示前 {VISIBLE_CARDS} 条提问；点击卡片查看完整对话。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="章节" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部章节</SelectItem>
              {chapterOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="小节" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部小节</SelectItem>
              {sectionOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            加载提问中…
          </div>
        ) : visible.length === 0 ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <MessageSquareText className="size-4" />
            当前筛选下没有提问
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => (
                <QuestionCard
                  key={p.id}
                  post={p}
                  onOpen={() => setOpenPost(p)}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                共 {filteredPosts.length} 条匹配
                {remaining > 0 ? ` · 仅展示前 ${VISIBLE_CARDS} 条` : ""}
              </span>
              {remaining > 0 && (
                <Link
                  href="/teacher/study-buddy"
                  className="text-brand hover:underline"
                >
                  查看全部 →
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>

      <PostThreadDialog
        open={openPost !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPost(null);
        }}
        post={openPost ? toThreadPost(openPost) : null}
      />
    </Card>
  );
}

function toThreadPost(p: RawPost): StudyBuddyPostThread {
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

function QuestionCard({ post, onOpen }: { post: RawPost; onOpen: () => void }) {
  const ch = post.taskInstance?.chapter?.title;
  const sec = post.taskInstance?.section?.title;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full flex-col rounded-md border border-line bg-surface p-3 text-left transition hover:border-brand hover:bg-paper"
    >
      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
        {post.isFreeForm ? (
          <Badge variant="secondary" className="text-[10.5px]">
            自由问
          </Badge>
        ) : (
          <span className="text-ink-4">
            {ch ? ch : "未绑定章节"}
            {sec ? ` / ${sec}` : ""}
          </span>
        )}
        {post.status === "pending" && (
          <Badge variant="outline" className="border-warn/40 text-warn">
            未回复
          </Badge>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-medium leading-snug text-ink">
        {post.title}
      </p>
      <p className="mt-1 line-clamp-2 text-[11.5px] text-ink-4">
        {post.question}
      </p>
      <div className="mt-auto pt-2 text-[10.5px] text-ink-5">
        {new Date(post.createdAt).toLocaleString("zh-CN")}
      </div>
    </button>
  );
}

interface SbPostLite {
  id: string;
  title: string;
  question: string;
  aiReply: string | null;
  status: "pending" | "answered" | "error";
  anonymous: boolean;
  createdAt: string;
  student: { id: string; name: string | null; email: string };
  taskInstance: {
    title: string;
    chapter: { title: string } | null;
    section: { title: string } | null;
  } | null;
  isFreeForm: boolean;
}

function PendingQuestionsList({ courseId }: { courseId: string }) {
  const [posts, setPosts] = useState<SbPostLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SbPostLite | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/teacher/study-buddy/posts?courseId=${courseId}&scope=pending`,
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "加载未答疑列表失败");
        return;
      }
      setPosts(json.data.posts as SbPostLite[]);
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const handleDelete = async () => {
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
  };

  return (
    <Card data-section="pending-questions">
      <CardHeader>
        <CardTitle className="text-base">未答疑列表</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            加载中...
          </div>
        ) : posts.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquareText className="size-4" />
            本课程暂无未答疑提问
          </p>
        ) : (
          posts.map((post) => {
            const expanded = expandedId === post.id;
            const ti = post.taskInstance;
            return (
              <div
                key={post.id}
                className="rounded-md border border-line bg-surface p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      {post.isFreeForm ? (
                        <Badge variant="secondary" className="text-[10.5px]">
                          自由问
                        </Badge>
                      ) : (
                        ti && (
                          <span className="text-[11.5px] text-ink-4">
                            {ti.chapter?.title ? `${ti.chapter.title} / ` : ""}
                            {ti.section?.title ? `${ti.section.title} / ` : ""}
                            {ti.title}
                          </span>
                        )
                      )}
                      {post.anonymous && (
                        <Badge variant="outline" className="text-[10.5px]">
                          匿名
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-snug">
                      {post.title}
                    </p>
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
                      aria-label="删除该提问"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
                {expanded && (
                  <div className="mt-3 space-y-2 border-t border-line-2 pt-3">
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
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>

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
            <AlertDialogAction onClick={handleDelete} disabled={!!deletingId}>
              {deletingId ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无</p>
      ) : (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={index}>{index + 1}. {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
