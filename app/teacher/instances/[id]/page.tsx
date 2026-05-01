"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  MessageSquare,
  Reply,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import { SubmissionsTab } from "@/components/instance-detail/submissions-tab";
import { GradingDrawer } from "@/components/instance-detail/grading-drawer";
import { InsightsTab } from "@/components/instance-detail/insights-tab";
import { AnalyticsTab } from "@/components/instance-detail/analytics-tab";
import {
  ReleaseConfigCard,
  type ReleaseMode,
} from "@/components/instance-detail/release-config-card";
import {
  normalizeSubmission,
  type NormalizedSubmission,
} from "@/components/instance-detail/submissions-utils";
import { ContextSourcesPanel } from "@/components/course/context-sources-panel";

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
  // PR-SIM-1b · D1 公布模式（top-level scalar，schema 已就位）
  releaseMode?: ReleaseMode | null;
  autoReleaseAt?: string | null;
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

interface SubmissionsResponse {
  items: Array<Parameters<typeof normalizeSubmission>[0]>;
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

const roleLabels: Record<string, string> = {
  teacher: "教师",
  admin: "管理员",
  student: "学生",
};

const SUBMISSIONS_PAGE_SIZE = 100;

export default function InstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<InstanceDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionsResponse | null>(null);
  const [classMembers, setClassMembers] = useState<ClassMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [tab, setTab] = useState<InstanceTabKey>("overview");

  // PR-SIM-1b · D1 公布相关 UI state
  const [releaseConfigSaving, setReleaseConfigSaving] = useState(false);
  const [releasingSubmissionId, setReleasingSubmissionId] = useState<string | null>(null);
  const [retryingSubmissionId, setRetryingSubmissionId] = useState<string | null>(null);
  const [bulkReleasing, setBulkReleasing] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(null);

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
        fetch(
          `/api/submissions?taskInstanceId=${instanceId}&page=1&pageSize=${SUBMISSIONS_PAGE_SIZE}`
        ),
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
  }, [instanceId]);

  const refreshSubmissions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/submissions?taskInstanceId=${instanceId}&page=1&pageSize=${SUBMISSIONS_PAGE_SIZE}`
      );
      const json = await res.json();
      if (json.success) setSubmissions(json.data);
    } catch {
      // silent
    }
  }, [instanceId]);

  // PR-SIM-1b · D1 PATCH release-config
  const handleSaveReleaseConfig = useCallback(
    async (next: { releaseMode: ReleaseMode; autoReleaseAt: string | null }) => {
      setReleaseConfigSaving(true);
      try {
        const res = await fetch(
          `/api/lms/task-instances/${instanceId}/release-config`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          }
        );
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "保存失败");
          return;
        }
        toast.success("公布设置已保存");
        setInstance((prev) =>
          prev
            ? {
                ...prev,
                releaseMode: next.releaseMode,
                autoReleaseAt: next.autoReleaseAt,
              }
            : prev
        );
      } catch {
        toast.error("网络错误，请稍后重试");
      } finally {
        setReleaseConfigSaving(false);
      }
    },
    [instanceId]
  );

  // PR-SIM-1b · D1 单条公布 / 撤回
  const handleReleaseSubmission = useCallback(
    async (submissionId: string, released: boolean) => {
      setReleasingSubmissionId(submissionId);
      try {
        const res = await fetch(`/api/submissions/${submissionId}/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ released }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "操作失败");
          return;
        }
        toast.success(released ? "已公布" : "已撤回公布");
        await refreshSubmissions();
      } catch {
        toast.error("网络错误，请稍后重试");
      } finally {
        setReleasingSubmissionId(null);
      }
    },
    [refreshSubmissions]
  );

  // PR-SIM-1b · D1 批量公布
  const handleBatchRelease = useCallback(
    async (submissionIds: string[]) => {
      if (submissionIds.length === 0) return;
      setBulkReleasing(true);
      try {
        const res = await fetch("/api/submissions/batch-release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ submissionIds, released: true }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "批量公布失败");
          return;
        }
        const releasedCount = json.data?.released ?? 0;
        const skippedCount = json.data?.skipped ?? 0;
        if (skippedCount > 0) {
          toast.success(
            `已公布 ${releasedCount} 份 / 跳过 ${skippedCount} 份`,
            { description: "跳过的提交未达「已分析」状态" }
          );
        } else {
          toast.success(`已公布 ${releasedCount} 份`);
        }
        await refreshSubmissions();
      } catch {
        toast.error("网络错误，请稍后重试");
      } finally {
        setBulkReleasing(false);
      }
    },
    [refreshSubmissions]
  );

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

  useEffect(() => {
    const hasInProgress = submissions?.items?.some(
      (submission) => submission.status === "submitted" || submission.status === "grading",
    );
    if (!hasInProgress) return;
    const timer = window.setInterval(() => {
      void refreshSubmissions();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [submissions?.items, refreshSubmissions]);

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

  const normalizedRows = useMemo<NormalizedSubmission[]>(() => {
    if (!submissions?.items) return [];
    return submissions.items.map(normalizeSubmission);
  }, [submissions]);

  const exportGrades = useCallback(() => {
    if (!submissions || submissions.items.length === 0) {
      toast.error("暂无成绩可导出");
      return;
    }

    const headers = ["学生姓名", "状态", "分数", "满分", "提交时间", "批改时间"];
    const rows = submissions.items.map((sub) => [
      sub.student.name,
      subStatusLabels[sub.status] || sub.status,
      sub.score !== null && sub.score !== undefined ? String(sub.score) : "-",
      sub.maxScore !== null && sub.maxScore !== undefined ? String(sub.maxScore) : "-",
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

  const handleOpenGrading = useCallback((submissionId: string) => {
    setActiveSubmissionId(submissionId);
    setDrawerOpen(true);
  }, []);

  const handleRetryGrade = useCallback(
    async (submissionId: string) => {
      setRetryingSubmissionId(submissionId);
      try {
        const res = await fetch(`/api/submissions/${submissionId}/retry-grade`, {
          method: "POST",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "重新批改失败");
          return;
        }
        toast.success("已重新加入批改队列");
        await refreshSubmissions();
      } catch {
        toast.error("网络错误，请稍后重试");
      } finally {
        setRetryingSubmissionId(null);
      }
    },
    [refreshSubmissions],
  );

  // PR-FIX-3 UX2: 批量批改"下一份"队列。教师选 A/C 不应跳到 B（之前行为是按全列表跳）。
  const [bulkQueue, setBulkQueue] = useState<string[]>([]);

  const handleDrawerSaved = useCallback(
    (savedId: string) => {
      toast.success("评分已保存");
      void refreshSubmissions();
      void savedId;
    },
    [refreshSubmissions]
  );

  const handleDrawerNext = useCallback(
    (currentId: string) => {
      // PR-FIX-3 UX2: 优先按 bulkQueue 走（教师选定的 selected ids 队列）；
      // 队列耗尽（或非批量场景）才回退到全列表的 next ungraded。
      if (bulkQueue.length > 0) {
        const idx = bulkQueue.indexOf(currentId);
        const nextId = idx >= 0 ? bulkQueue[idx + 1] : bulkQueue[0];
        if (nextId) {
          setActiveSubmissionId(nextId);
          return;
        }
        // 队列结束 → 清队列 + 关 drawer
        setBulkQueue([]);
        toast.message("批量批改队列已完成");
        setDrawerOpen(false);
        return;
      }
      // 非批量场景：原行为（全列表下一未批改）
      const idx = normalizedRows.findIndex((r) => r.id === currentId);
      const nextRow = normalizedRows
        .slice(idx + 1)
        .find((r) => r.status !== "graded");
      if (nextRow) {
        setActiveSubmissionId(nextRow.id);
      } else {
        toast.message("已是最后一份待批改");
        setDrawerOpen(false);
      }
    },
    [normalizedRows, bulkQueue]
  );

  const handleBulkGrade = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      // PR-FIX-3 UX2: 用教师选定的 ids 顺序作为 queue（保留点选顺序）
      setBulkQueue(ids);
      const first = ids[0];
      handleOpenGrading(first);
      toast.message(`已开始批改 ${ids.length} 份`, {
        description: "保存后会跳到队列中的下一份",
      });
    },
    [handleOpenGrading]
  );

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
    const total = normalizedRows.length;
    const graded = normalizedRows.filter((s) => s.status === "graded").length;
    const grading = normalizedRows.filter(
      (s) => s.status === "grading" || s.status === "submitted"
    ).length;
    const assigned = classMembers?.length ?? Math.max(total, 0);
    return {
      assigned,
      submitted: total,
      grading,
      graded,
    };
  }, [normalizedRows, classMembers]);

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

      <div className="bg-surface px-6 pt-4 pb-2 md:px-10">
        <ReleaseConfigCard
          releaseMode={(instance.releaseMode ?? "manual") as ReleaseMode}
          autoReleaseAt={instance.autoReleaseAt ?? null}
          defaultAutoReleaseAt={instance.dueAt}
          saving={releaseConfigSaving}
          onSave={handleSaveReleaseConfig}
        />
      </div>

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
          <div className="space-y-6">
            <SubmissionsTab
              rows={normalizedRows}
              loading={false}
              onOpenGrading={handleOpenGrading}
              onExport={exportGrades}
              onBulkGrade={handleBulkGrade}
              onRelease={handleReleaseSubmission}
              onBatchRelease={handleBatchRelease}
              onRetryGrade={handleRetryGrade}
              releasingId={releasingSubmissionId}
              retryingId={retryingSubmissionId}
              bulkReleasing={bulkReleasing}
            />

            {/* 讨论区（保留入口） */}
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

        {tab === "contexts" && instance.course && (
          <ContextSourcesPanel
            courseId={instance.course.id}
            chapterId={instance.chapter?.id ?? null}
            sectionId={instance.section?.id ?? null}
            taskId={instance.task.id}
            taskInstanceId={instance.id}
            title="本任务额外上下文"
            description="上传只服务于本次任务实例的讲义、案例、题目解析或教师说明。学习伙伴会优先引用这些材料，再回退到任务、小节、章节和课程素材。"
          />
        )}

        {tab === "contexts" && !instance.course && (
          <Card className="border-line bg-surface shadow-fs">
            <CardContent className="py-10 text-center text-sm text-ink-4">
              当前任务实例未绑定课程，无法挂载教学上下文素材。
            </CardContent>
          </Card>
        )}

        {tab === "insights" && (
          <InsightsTab
            instanceId={instance.id}
            onExplainConcept={(tag) => {
              toast.message(`待办：生成 "${tag}" 讲解卡片`, {
                description: "Phase 6 学习伙伴会接上",
              });
            }}
          />
        )}

        {tab === "analytics" && (
          <AnalyticsTab rows={normalizedRows} taskType={instance.task.taskType} />
        )}
      </div>

      <GradingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        submissionId={activeSubmissionId}
        showAiSuggestion={true}
        onSaved={handleDrawerSaved}
        onNext={handleDrawerNext}
      />
    </div>
  );
}
