"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  Users,
  Calendar,
  Send,
  XCircle,
  FileText,
  Download,
  Pencil,
  BarChart3,
  MessageSquare,
  BookOpen,
  Reply,
  HelpCircle,
  Clock,
  GraduationCap,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface InstanceDetail {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  publishedAt: string | null;
  attemptsAllowed: number | null;
  createdAt: string;
  task: {
    id: string;
    taskName: string;
    taskType: string;
  };
  class: { id: string; name: string };
  course?: { id: string; courseTitle: string } | null;
  chapter?: { id: string; title: string } | null;
  section?: { id: string; title: string } | null;
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

const statusLabels: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
  archived: "已归档",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  published: "default",
  closed: "secondary",
  archived: "destructive",
};

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

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

const roleLabels: Record<string, string> = {
  teacher: "教师",
  admin: "管理员",
  student: "学生",
};

export default function InstanceDetailPage() {
  const params = useParams();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<InstanceDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editAttempts, setEditAttempts] = useState<string>("");
  const [saving, setSaving] = useState(false);

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

  async function handleStatusChange(newStatus: string) {
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
  }

  function exportGrades() {
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
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `成绩导出_${instance?.title || instanceId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("导出成功");
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) {
      toast.error("标题不能为空");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      };
      if (editDueAt) {
        body.dueAt = new Date(editDueAt).toISOString();
      }
      if (editAttempts) {
        body.attemptsAllowed = parseInt(editAttempts);
      }
      const res = await fetch(`/api/lms/task-instances/${instanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("修改已保存");
      setEditing(false);
      setLoading(true);
      fetchData();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

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

  const gradedCount =
    submissions?.items.filter((s) => s.status === "graded").length || 0;
  const totalSubs = submissions?.total || 0;
  const pendingCount =
    submissions?.items.filter((s) => s.status === "submitted").length || 0;
  const avgScore =
    gradedCount > 0
      ? Math.round(
          (submissions?.items
            .filter((s) => s.status === "graded" && s.score !== null)
            .reduce((sum, s) => sum + (s.score || 0), 0) || 0) / gradedCount
        )
      : 0;
  const maxScoreVal =
    submissions?.items.find((s) => s.maxScore !== null)?.maxScore || 100;

  const isPastDue = new Date(instance.dueAt) < new Date();
  const daysRemaining = Math.ceil(
    (new Date(instance.dueAt).getTime() - Date.now()) / 86400000
  );

  const TypeIcon = taskTypeIcons[instance.task.taskType] || FileText;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/teacher/instances" className="hover:text-foreground">
          任务实例
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">{instance.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <TypeIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">{instance.title}</h1>
            {instance.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {instance.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant[instance.status] || "outline"}>
                {statusLabels[instance.status] || instance.status}
              </Badge>
              <Badge variant="secondary">
                {taskTypeLabels[instance.task.taskType] || instance.task.taskType}
              </Badge>
              {isPastDue ? (
                <Badge variant="destructive" className="text-xs">
                  <Clock className="size-3 mr-1" />
                  已截止
                </Badge>
              ) : daysRemaining <= 3 ? (
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-600">
                  <Clock className="size-3 mr-1" />
                  剩余 {daysRemaining} 天
                </Badge>
              ) : null}
            </div>
            {instance.course && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {instance.course.courseTitle}
                {instance.chapter && ` > ${instance.chapter.title}`}
                {instance.section && ` > ${instance.section.title}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditTitle(instance.title);
              setEditDescription(instance.description || "");
              setEditDueAt(new Date(instance.dueAt).toISOString().slice(0, 16));
              setEditAttempts(instance.attemptsAllowed?.toString() || "");
              setEditing(true);
            }}
          >
            <Pencil className="size-3 mr-1" />
            编辑
          </Button>
          {instance.status === "draft" && (
            <Button
              size="sm"
              onClick={() => handleStatusChange("published")}
              disabled={actionLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {actionLoading ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <Send className="size-3 mr-1" />
              )}
              发布
            </Button>
          )}
          {instance.status === "published" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusChange("closed")}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="size-3 mr-1 animate-spin" />
              ) : (
                <XCircle className="size-3 mr-1" />
              )}
              关闭
            </Button>
          )}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/teacher/instances/${instanceId}/insights`}>
            <BarChart3 className="size-3 mr-1" />
            教学洞察
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/teacher/tasks/${instance.task.id}`}>
            <Eye className="size-3 mr-1" />
            查看任务配置
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/teacher/analytics">
            <BarChart3 className="size-3 mr-1" />
            全局分析
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={exportGrades}>
          <Download className="size-3 mr-1" />
          导出成绩
        </Button>
        {instance.task.taskType === "simulation" && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/sim/${instanceId}?preview=true`}>
              <MessageSquare className="size-3 mr-1" />
              测试预览
            </Link>
          </Button>
        )}
      </div>

      {/* Edit Form */}
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">编辑任务实例</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>截止时间</Label>
                <Input type="datetime-local" value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>尝试次数限制（留空不限制）</Label>
                <Input type="number" min="1" value={editAttempts} onChange={(e) => setEditAttempts(e.target.value)} placeholder="不限" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>取消</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <><Loader2 className="size-4 mr-2 animate-spin" />保存中...</> : "保存修改"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instance Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="size-4" />
              班级
            </div>
            <p className="mt-1 font-medium">{instance.class.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />
              原始任务
            </div>
            <Link
              href={`/teacher/tasks/${instance.task.id}`}
              className="mt-1 font-medium text-blue-600 hover:underline block truncate"
            >
              {instance.task.taskName}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4" />
              截止日期
            </div>
            <p className="mt-1 font-medium">
              {new Date(instance.dueAt).toLocaleDateString("zh-CN")}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(instance.dueAt).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="size-4" />
              提交统计
            </div>
            <p className="mt-1 font-medium">
              {totalSubs} 份提交
            </p>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>{gradedCount} 已批改</span>
              {pendingCount > 0 && (
                <span className="text-orange-600">{pendingCount} 待批改</span>
              )}
            </div>
            {gradedCount > 0 && (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">均分</span>
                  <span className="font-medium">{avgScore}/{maxScoreVal}</span>
                </div>
                <div className="mt-1 h-1.5 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${
                      maxScoreVal > 0 && avgScore / maxScoreVal > 0.7
                        ? "bg-green-500"
                        : maxScoreVal > 0 && avgScore / maxScoreVal >= 0.5
                          ? "bg-orange-500"
                          : "bg-red-500"
                    }`}
                    style={{
                      width: `${maxScoreVal > 0 ? Math.min((avgScore / maxScoreVal) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Tabbed Content: Submissions / Discussion */}
      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">
            提交记录
            {totalSubs > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {totalSubs}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="discussion">
            讨论区
            {posts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {posts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Submissions Tab */}
        <TabsContent value="submissions" className="mt-4">
          <Card id="grades">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">提交记录</CardTitle>
                <Button variant="outline" size="sm" onClick={exportGrades}>
                  <Download className="size-3 mr-1" />
                  导出成绩
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!submissions || submissions.items.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="size-8 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">暂无提交记录</p>
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
                              variant={subStatusVariant[sub.status] || "outline"}
                            >
                              {subStatusLabels[sub.status] || sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {sub.status === "graded" && sub.score !== null ? (
                              <span className="font-medium">
                                {sub.score}
                                <span className="text-muted-foreground font-normal">
                                  {" "}/ {sub.maxScore}
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

                  {/* Pagination */}
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
                            setPage((p) => Math.min(submissions.totalPages, p + 1))
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
        </TabsContent>

        {/* Discussion Tab */}
        <TabsContent value="discussion" className="mt-4">
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
              {/* New post form */}
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
                      <Loader2 className="size-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="size-4 mr-1" />
                    )}
                    发布
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Posts list */}
              {postsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">加载讨论...</span>
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
                          <span className="text-sm font-medium">{post.author.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {roleLabels[post.author.role] || post.author.role}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(post.createdAt).toLocaleString("zh-CN")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 text-xs px-2"
                            onClick={() => {
                              setReplyingTo(replyingTo === post.id ? null : post.id);
                              setReplyContent("");
                            }}
                          >
                            <Reply className="size-3 mr-0.5" />
                            回复
                          </Button>
                        </div>
                      </div>

                      {/* Replies */}
                      {post.replies.length > 0 && (
                        <div className="ml-6 space-y-2">
                          {post.replies.map((reply) => (
                            <div key={reply.id} className="rounded-lg border border-dashed p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{reply.author.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {roleLabels[reply.author.role] || reply.author.role}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(reply.createdAt).toLocaleString("zh-CN")}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply form */}
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
                              disabled={postingReply || !replyContent.trim()}
                            >
                              {postingReply ? (
                                <Loader2 className="size-4 mr-1 animate-spin" />
                              ) : (
                                <Reply className="size-4 mr-1" />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
