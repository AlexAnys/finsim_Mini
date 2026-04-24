"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  FileText,
  Download,
  MessageSquare,
  Reply,
  Send,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  InstanceHeader,
  type InstanceHeaderData,
} from "@/components/instance-detail/instance-header";
import {
  InstanceTabsNav,
  type InstanceTabKey,
} from "@/components/instance-detail/tabs-nav";
import { OverviewTab } from "@/components/instance-detail/overview-tab";

interface InstanceDetail {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  publishedAt: string | null;
  publishAt: string | null;
  attemptsAllowed: number | null;
  createdAt: string;
  slot?: string | null;
  task: {
    id: string;
    taskName: string;
    taskType: string;
    scoringCriteria?: Array<{ id: string; name: string; maxPoints: number }>;
  };
  class: { id: string; name: string };
  course?: { id: string; courseTitle: string } | null;
  chapter?: { id: string; title: string } | null;
  section?: { id: string; title: string } | null;
  _count?: { submissions: number };
}

interface Submission {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  submittedAt: string;
  gradedAt: string | null;
  student: { id: string; name: string };
  task: { id: string; taskName: string };
}

interface SubmissionsResponse {
  items: Submission[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PostAuthor {
  id: string;
  name: string;
  role: string;
}

interface DiscussionPost {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
  replies: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: PostAuthor;
  }>;
}

interface ClassMember {
  studentId: string;
}

const subStatusLabels: Record<string, string> = {
  submitted: "待批改",
  grading: "批改中",
  graded: "已批改",
  failed: "批改失败",
};

const subStatusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  submitted: "outline",
  grading: "secondary",
  graded: "default",
  failed: "destructive",
};

const roleLabels: Record<string, string> = {
  teacher: "教师",
  admin: "管理员",
  student: "学生",
};

export default function InstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<InstanceDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionsResponse | null>(null);
  const [classMembers, setClassMembers] = useState<ClassMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<InstanceTabKey>("overview");

  // Discussion state
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [postingNew, setPostingNew] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [postingReply, setPostingReply] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [instRes, subRes] = await Promise.all([
        fetch(`/api/lms/task-instances/${instanceId}`),
        fetch(`/api/submissions?taskInstanceId=${instanceId}&page=${page}&pageSize=20`),
      ]);
      const instJson = await instRes.json();
      const subJson = await subRes.json();

      if (!instJson.success) {
        setError(instJson.error?.message || "加载失败");
        return;
      }
      setInstance(instJson.data);

      if (subJson.success) {
        setSubmissions(subJson.data);
      }

      const classId = instJson.data?.class?.id;
      if (classId) {
        try {
          const cmRes = await fetch(`/api/lms/classes/${classId}/members`);
          const cmJson = await cmRes.json();
          if (cmJson.success) {
            setClassMembers(cmJson.data || []);
          }
        } catch {
          // silent; fallback handled in computed stats
        }
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [instanceId, page]);

  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/lms/task-posts?taskInstanceId=${instanceId}`);
      const json = await res.json();
      if (json.success) {
        setPosts(json.data || []);
      }
    } catch {
      // silent - discussion is non-critical
    } finally {
      setPostsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setActionLoading(true);
      try {
        const res = await fetch(`/api/lms/task-instances/${instanceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "操作失败");
          return;
        }
        toast.success(
          newStatus === "published" ? "已发布" : newStatus === "closed" ? "已关闭" : "状态已更新"
        );
        setInstance((prev) => (prev ? { ...prev, status: newStatus } : prev));
      } catch {
        toast.error("网络错误，请稍后重试");
      } finally {
        setActionLoading(false);
      }
    },
    [instanceId]
  );

  const exportGrades = useCallback(() => {
    if (!submissions || submissions.items.length === 0) {
      toast.error("暂无成绩可导出");
      return;
    }

    const headers = ["学生姓名", "状态", "分数", "满分", "提交时间", "批改时间"];
    const rows = submissions.items.map((sub) => [
      sub.student.name,
      subStatusLabels[sub.status] || sub.status,
      sub.score !== null ? String(sub.score) : "-",
      sub.maxScore !== null ? String(sub.maxScore) : "-",
      new Date(sub.submittedAt).toLocaleString("zh-CN"),
      sub.gradedAt ? new Date(sub.gradedAt).toLocaleString("zh-CN") : "-",
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const BOM = "﻿";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `成绩导出_${instance?.title || instanceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  }, [submissions, instance?.title, instanceId]);

  const handleRemind = useCallback(() => {
    toast.message("催交通知已记录", {
      description: "后续版本将支持批量发送站内信 / 邮件",
    });
  }, []);

  const handleStartGrading = useCallback(() => {
    setTab("submissions");
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        const el = document.getElementById("tabpanel-submissions");
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

  const handlePreviewStudent = useCallback(() => {
    if (!instance) return;
    const type = instance.task.taskType;
    const base =
      type === "simulation"
        ? `/sim/${instanceId}?preview=true`
        : `/tasks/${instanceId}?preview=true`;
    router.push(base);
  }, [instance, instanceId, router]);

  async function handleCreatePost() {
    if (!newPostContent.trim()) return;
    setPostingNew(true);
    try {
      const res = await fetch("/api/lms/task-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskInstanceId: instanceId,
          content: newPostContent.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "发布失败");
        return;
      }
      toast.success("讨论已发布");
      setNewPostContent("");
      fetchPosts();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setPostingNew(false);
    }
  }

  async function handleReply(postId: string) {
    if (!replyContent.trim()) return;
    setPostingReply(true);
    try {
      const res = await fetch("/api/lms/task-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskInstanceId: instanceId,
          content: replyContent.trim(),
          replyToPostId: postId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "回复失败");
        return;
      }
      toast.success("回复成功");
      setReplyContent("");
      setReplyingTo(null);
      fetchPosts();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setPostingReply(false);
    }
  }

  const stats = useMemo(() => {
    const items = submissions?.items || [];
    const total = submissions?.total ?? items.length;
    const graded = items.filter((s) => s.status === "graded").length;
    const grading = items.filter((s) => s.status === "grading").length;
    const assigned = classMembers?.length ?? Math.max(total, 0);
    return {
      assigned,
      submitted: total,
      grading,
      graded,
    };
  }, [submissions, classMembers]);

  const totalPoints = useMemo(() => {
    if (!instance?.task.scoringCriteria) return 100;
    const sum = instance.task.scoringCriteria.reduce(
      (acc, c) => acc + (c.maxPoints || 0),
      0
    );
    return sum > 0 ? sum : 100;
  }, [instance?.task.scoringCriteria]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!instance) return null;

  const headerData: InstanceHeaderData = {
    id: instance.id,
    title: instance.title,
    taskType: instance.task.taskType,
    status: instance.status,
    dueAt: instance.dueAt,
    assigned: stats.assigned,
    totalPoints,
    course: instance.course
      ? { id: instance.course.id, title: instance.course.courseTitle }
      : null,
    chapter: instance.chapter ? { title: instance.chapter.title } : null,
    section: instance.section ? { title: instance.section.title } : null,
    slot: instance.slot ?? null,
  };

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100vh-3.5rem)] bg-paper md:-mx-6 md:-my-6">
      <InstanceHeader
        instance={headerData}
        actionLoading={actionLoading}
        onPublish={() => handleStatusChange("published")}
        onClose={() => handleStatusChange("closed")}
        onExport={exportGrades}
        onRemind={handleRemind}
        onStartGrading={handleStartGrading}
      />

      <div className="bg-surface px-6 md:px-10">
        <InstanceTabsNav
          value={tab}
          onChange={setTab}
          submittedCount={stats.submitted}
        />
      </div>

      <div className="px-6 py-6 md:px-10 md:py-6">
        {tab === "overview" && (
          <OverviewTab
            instance={{
              id: instance.id,
              title: instance.title,
              description: instance.description,
              taskType: instance.task.taskType,
              dueAt: instance.dueAt,
              publishedAt: instance.publishedAt,
              createdAt: instance.createdAt,
            }}
            stats={stats}
            onRemind={handleRemind}
            onStartGrading={handleStartGrading}
            onPreviewStudent={handlePreviewStudent}
          />
        )}

        {tab === "submissions" && (
          <div
            id="tabpanel-submissions"
            role="tabpanel"
            aria-labelledby="tab-submissions"
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">提交记录</CardTitle>
                  <Button variant="outline" size="sm" onClick={exportGrades}>
                    <Download className="size-3" />
                    导出成绩
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!submissions || submissions.items.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="size-8 text-muted-foreground mx-auto" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      暂无提交记录
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>学生</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>分数</TableHead>
                          <TableHead>提交时间</TableHead>
                          <TableHead>批改时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {submissions.items.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">
                              {sub.student.name}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  subStatusVariant[sub.status] || "outline"
                                }
                              >
                                {subStatusLabels[sub.status] || sub.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {sub.status === "graded" && sub.score !== null ? (
                                <span className="font-medium">
                                  {sub.score}
                                  <span className="text-muted-foreground font-normal">
                                    {" "}
                                    / {sub.maxScore}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(sub.submittedAt).toLocaleString("zh-CN")}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {sub.gradedAt
                                ? new Date(sub.gradedAt).toLocaleString("zh-CN")
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {submissions.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          共 {submissions.total} 条记录，第 {submissions.page} /{" "}
                          {submissions.totalPages} 页
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                          >
                            上一页
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPage((p) =>
                                Math.min(submissions.totalPages, p + 1)
                              )
                            }
                            disabled={page >= submissions.totalPages}
                          >
                            下一页
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* 讨论区 */}
            <Card id="discussion-section">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="size-4" />
                    讨论区
                  </CardTitle>
                  {posts.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {posts.length} 条讨论
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="发表讨论..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    rows={2}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleCreatePost}
                      disabled={postingNew || !newPostContent.trim()}
                    >
                      {postingNew ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      发布
                    </Button>
                  </div>
                </div>

                <Separator />

                {postsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      加载讨论...
                    </span>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="size-8 text-muted-foreground mx-auto" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      暂无讨论，发布第一条讨论吧
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div key={post.id} className="space-y-2">
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {post.author.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {roleLabels[post.author.role] || post.author.role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.createdAt).toLocaleString("zh-CN")}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {post.content}
                          </p>
                          <div className="mt-2">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setReplyingTo(
                                  replyingTo === post.id ? null : post.id
                                );
                                setReplyContent("");
                              }}
                            >
                              <Reply className="size-3" />
                              回复
                            </Button>
                          </div>
                        </div>

                        {post.replies.length > 0 && (
                          <div className="ml-6 space-y-2">
                            {post.replies.map((reply) => (
                              <div
                                key={reply.id}
                                className="rounded-lg border border-dashed p-3"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">
                                    {reply.author.name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {roleLabels[reply.author.role] ||
                                      reply.author.role}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(reply.createdAt).toLocaleString(
                                      "zh-CN"
                                    )}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">
                                  {reply.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {replyingTo === post.id && (
                          <div className="ml-6 space-y-2">
                            <Textarea
                              placeholder="输入回复..."
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              rows={2}
                              autoFocus
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyContent("");
                                }}
                              >
                                取消
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleReply(post.id)}
                                disabled={
                                  postingReply || !replyContent.trim()
                                }
                              >
                                {postingReply ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Reply className="size-4" />
                                )}
                                回复
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "insights" && (
          <div
            id="tabpanel-insights"
            role="tabpanel"
            aria-labelledby="tab-insights"
            className="rounded-xl border border-line bg-surface p-10 text-center"
          >
            <Sparkles className="mx-auto size-8 text-sim" />
            <div className="mt-3 text-sm font-medium text-ink-2">
              AI 洞察即将上线
            </div>
            <p className="mt-1 text-xs text-ink-4">
              PR-5C 会带来共性问题 / 亮点 / 薄弱概念聚合
            </p>
          </div>
        )}

        {tab === "analytics" && (
          <div
            id="tabpanel-analytics"
            role="tabpanel"
            aria-labelledby="tab-analytics"
            className="rounded-xl border border-line bg-surface p-10 text-center"
          >
            <BarChart3 className="mx-auto size-8 text-ink-4" />
            <div className="mt-3 text-sm font-medium text-ink-2">
              数据分析即将上线
            </div>
            <p className="mt-1 text-xs text-ink-4">
              PR-5D 会带来分布 / 散点 / 热图
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
