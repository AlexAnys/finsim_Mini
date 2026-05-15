"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface TaskInstance {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  createdAt: string;
  task: {
    id: string;
    taskName: string;
    taskType: string;
  };
  class: { id: string; name: string };
  _count: { submissions: number };
}

interface CourseInstancesTabProps {
  courseId?: string;
  showTitle?: boolean;
}

const statusLabels: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
  archived: "已归档",
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  published: "default",
  closed: "secondary",
  archived: "destructive",
};

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

export function CourseInstancesTab({
  courseId,
  showTitle = false,
}: CourseInstancesTabProps) {
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    id: string;
    title: string;
    action: "close" | "delete";
  } | null>(null);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (courseId) params.set("courseId", courseId);
      const query = params.toString();
      const res = await fetch(`/api/lms/task-instances${query ? `?${query}` : ""}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载失败");
        return;
      }
      setInstances(json.data || []);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  async function handleStatusChange(id: string, newStatus: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/lms/task-instances/${id}`, {
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
        newStatus === "published"
          ? "已发布"
          : newStatus === "closed"
            ? "已关闭"
            : "状态已更新",
      );
      await fetchInstances();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCloseConfirmed(id: string) {
    setConfirm(null);
    setActionLoading(id);
    try {
      const res = await fetch(`/api/lms/task-instances/${id}/close`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "关闭失败");
        return;
      }
      toast.success("已关闭");
      await fetchInstances();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReopen(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/lms/task-instances/${id}/reopen`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "重新开放失败");
        return;
      }
      toast.success("已重新开放");
      await fetchInstances();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteConfirmed(id: string) {
    setConfirm(null);
    setActionLoading(id);
    try {
      const res = await fetch(`/api/lms/task-instances/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "删除失败");
        return;
      }
      toast.success("已删除");
      await fetchInstances();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  }

  const filtered =
    filter === "all"
      ? instances
      : instances.filter((inst) => inst.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载任务实例...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTitle && <h1 className="text-2xl font-bold">任务实例</h1>}

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="draft">草稿</TabsTrigger>
          <TabsTrigger value="published">已发布</TabsTrigger>
          <TabsTrigger value="closed">已关闭</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              {courseId ? "当前课程暂无任务实例" : "暂无任务实例"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>原始任务</TableHead>
                <TableHead>班级</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>截止日期</TableHead>
                <TableHead>提交数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {taskTypeLabels[inst.task.taskType] || inst.task.taskType}
                      </Badge>
                      <span className="max-w-[120px] truncate">
                        {inst.task.taskName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{inst.class.name}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[inst.status] || "outline"}>
                      {statusLabels[inst.status] || inst.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(inst.dueAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell>{inst._count.submissions}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/teacher/instances/${inst.id}`}>
                          <ExternalLink className="size-3 mr-1" />
                          详情
                        </Link>
                      </Button>
                      {inst.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusChange(inst.id, "published")}
                          disabled={actionLoading === inst.id}
                          className="text-green-600 hover:text-green-700"
                        >
                          {actionLoading === inst.id ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <Send className="size-3 mr-1" />
                          )}
                          发布
                        </Button>
                      )}
                      {inst.status === "published" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setConfirm({
                              id: inst.id,
                              title: inst.title,
                              action: "close",
                            })
                          }
                          disabled={actionLoading === inst.id}
                          className="text-orange-600 hover:text-orange-700"
                        >
                          {actionLoading === inst.id ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <XCircle className="size-3 mr-1" />
                          )}
                          关闭
                        </Button>
                      )}
                      {inst.status === "closed" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReopen(inst.id)}
                            disabled={actionLoading === inst.id}
                            className="text-green-600 hover:text-green-700"
                          >
                            {actionLoading === inst.id ? (
                              <Loader2 className="size-3 animate-spin mr-1" />
                            ) : (
                              <RotateCcw className="size-3 mr-1" />
                            )}
                            重新开放
                          </Button>
                          {inst._count.submissions > 0 ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="text-destructive opacity-50"
                                  >
                                    <Trash2 className="size-3 mr-1" />
                                    删除
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                已有学生提交，无法删除
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirm({
                                  id: inst.id,
                                  title: inst.title,
                                  action: "delete",
                                })
                              }
                              disabled={actionLoading === inst.id}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-3 mr-1" />
                              删除
                            </Button>
                          )}
                        </>
                      )}
                      {inst.status === "draft" && inst._count.submissions === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setConfirm({
                              id: inst.id,
                              title: inst.title,
                              action: "delete",
                            })
                          }
                          disabled={actionLoading === inst.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3 mr-1" />
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "close" ? "关闭任务实例" : "删除任务实例"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "close"
                ? `关闭「${confirm.title}」后，学生无法继续答题，已提交的答卷仍可在「成绩」中回看。`
                : `删除「${confirm?.title ?? ""}」后无法恢复，且该实例下若有讨论 / 报告等数据将一并清除。确认删除？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                if (confirm.action === "close") {
                  void handleCloseConfirmed(confirm.id);
                } else {
                  void handleDeleteConfirmed(confirm.id);
                }
              }}
              disabled={!!actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {confirm?.action === "close" ? "关闭中..." : "删除中..."}
                </>
              ) : confirm?.action === "close" ? (
                "确认关闭"
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
