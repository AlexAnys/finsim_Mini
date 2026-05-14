"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronRight,
  Clock,
  FileText,
  HelpCircle,
  ListChecks,
  Loader2,
  MessageSquare,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatRelativeDue } from "@/lib/utils/dashboard-formatters";

interface TaskItem {
  id: string;
  title?: string;
  taskName?: string;
  status: string; // instance status: published / closed / draft / archived
  studentStatus: string; // todo / submitted / grading / graded / failed / overdue
  taskType?: string;
  task?: { id: string; taskName: string; taskType: string };
  course?: { id: string; courseTitle: string } | null;
  chapter?: { id: string; title: string } | null;
  section?: { id: string; title: string } | null;
  slot?: "pre" | "in" | "post" | null;
  dueAt?: string | null;
  attemptsAllowed?: number | null;
  attemptsUsed?: number | null;
  canSubmit?: boolean;
  latestSubmissionId?: string | null;
}

interface DashboardSummary {
  tasks?: TaskItem[];
}

type TabKey = "todo" | "in_progress" | "graded" | "closed";

const TAB_DEFS: Array<{ key: TabKey; label: string }> = [
  { key: "todo", label: "待办" },
  { key: "in_progress", label: "进行中" },
  { key: "graded", label: "已批改" },
  { key: "closed", label: "已结束" },
];

const TASK_TYPE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "all", label: "全部类型" },
  { key: "simulation", label: "模拟对话" },
  { key: "quiz", label: "测验" },
  { key: "subjective", label: "主观题" },
];

const TASK_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const STUDENT_STATUS_LABELS: Record<string, string> = {
  todo: "待办",
  submitted: "已提交",
  grading: "批改中",
  graded: "已批改",
  failed: "批改失败",
  overdue: "已过期",
};

function classifyTab(task: TaskItem): TabKey | null {
  // closed instance with own submission -> 已结束 tab
  if (task.status === "closed") return "closed";
  // published path
  const ss = task.studentStatus;
  if (ss === "graded") return "graded";
  if (ss === "submitted" || ss === "grading" || ss === "failed") return "in_progress";
  // todo or overdue -> 待办
  return "todo";
}

function taskHref(task: TaskItem): string {
  if (
    task.status === "closed" &&
    task.studentStatus === "graded" &&
    task.latestSubmissionId
  ) {
    return `/grades?focus=${task.latestSubmissionId}`;
  }
  const type = task.task?.taskType ?? task.taskType;
  if (type === "simulation") return `/sim/${task.id}`;
  return `/tasks/${task.id}`;
}

function getActionLabel(task: TaskItem): string {
  if (task.status === "closed") {
    return task.studentStatus === "graded" ? "查看结果" : "回看";
  }
  if (task.studentStatus === "graded") return "结果";
  if (
    task.studentStatus === "submitted" ||
    task.studentStatus === "grading" ||
    task.studentStatus === "failed"
  ) {
    return "查看";
  }
  return "开始";
}

export default function StudentTasksListPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("todo");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        const res = await fetch("/api/lms/dashboard/summary");
        const json = await res.json();
        if (aborted) return;
        if (!json.success) {
          setError(json.error?.message || "加载失败");
          return;
        }
        const data = json.data as DashboardSummary;
        setTasks(data.tasks ?? []);
      } catch {
        if (!aborted) setError("网络错误，请稍后重试");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, []);

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.course?.id) map.set(t.course.id, t.course.courseTitle);
    }
    return [{ id: "all", title: "全部课程" }, ...Array.from(map.entries()).map(([id, title]) => ({ id, title }))];
  }, [tasks]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = {
      todo: 0,
      in_progress: 0,
      graded: 0,
      closed: 0,
    };
    for (const t of tasks) {
      const key = classifyTab(t);
      if (key) counts[key]++;
    }
    return counts;
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => classifyTab(t) === tab)
      .filter((t) => courseFilter === "all" || t.course?.id === courseFilter)
      .filter((t) => {
        if (typeFilter === "all") return true;
        const type = t.task?.taskType ?? t.taskType;
        return type === typeFilter;
      })
      .sort((a, b) => {
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return aDue - bDue;
      });
  }, [tasks, tab, courseFilter, typeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载任务中心...</span>
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
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-10 pt-2 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            <ListChecks className="size-3.5" />
            任务中心
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink">
            我的任务
          </h1>
          <p className="mt-1 text-[13px] text-ink-4">
            共 {tasks.length} 项任务 · 待办 {tabCounts.todo} · 进行中 {tabCounts.in_progress} · 已批改 {tabCounts.graded} · 已结束 {tabCounts.closed}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            {TAB_DEFS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}（{tabCounts[t.key]}）
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-xs text-ink-4">
            课程：
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="ml-1 rounded-md border border-line bg-surface px-2 py-1 text-xs"
            >
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-ink-4">
            类型：
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="ml-1 rounded-md border border-line bg-surface px-2 py-1 text-xs"
            >
              {TASK_TYPE_OPTIONS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-sm text-ink-4">
            <ListChecks className="size-10 text-ink-5" />
            <p className="mt-3">当前筛选下暂无任务</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: TaskItem }) {
  const type = task.task?.taskType ?? task.taskType ?? "subjective";
  const Icon = TASK_TYPE_ICONS[type] ?? FileText;
  const typeLabel = TASK_TYPE_LABELS[type] ?? type;
  const due = task.dueAt ? formatRelativeDue(task.dueAt) : null;
  const statusLabel = STUDENT_STATUS_LABELS[task.studentStatus] ?? task.studentStatus;
  const isClosed = task.status === "closed";

  const taskName = task.task?.taskName ?? task.taskName ?? task.title ?? "未命名任务";
  const metaParts = [
    task.course?.courseTitle,
    task.chapter?.title,
    task.section?.title,
  ].filter(Boolean) as string[];

  const href = taskHref(task);
  const canNavigate =
    Boolean(task.canSubmit) ||
    task.studentStatus === "submitted" ||
    task.studentStatus === "grading" ||
    task.studentStatus === "failed" ||
    task.studentStatus === "graded" ||
    task.studentStatus === "overdue" ||
    isClosed;

  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-fs">
      <div className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-paper-alt">
          <Icon className="size-4 text-ink-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10.5px]">
              {typeLabel}
            </Badge>
            <Badge variant="secondary" className="bg-paper-alt text-[10.5px] text-ink-3">
              {statusLabel}
            </Badge>
            {isClosed && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10.5px] text-amber-800">
                已结束
              </Badge>
            )}
            {due && !isClosed && (
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1 text-[10.5px]",
                  due.isUrgent ? "bg-warn-soft text-warn" : "bg-paper-alt text-ink-3",
                )}
              >
                <Clock className="size-[10px]" />
                {due.label}
              </Badge>
            )}
          </div>
          <div className="text-[14px] font-semibold leading-snug text-ink">
            {taskName}
          </div>
          {metaParts.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-4">
              {metaParts.map((p, i) => (
                <span key={`${task.id}-${i}`} className={i === 0 ? "font-medium text-brand" : ""}>
                  {i > 0 && <span className="mr-1.5 text-ink-5">·</span>}
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant={task.studentStatus === "todo" && !isClosed ? "default" : "secondary"}
          className="h-8 min-w-[64px] shrink-0 gap-1 rounded-lg px-3 text-[12px] font-semibold"
          disabled={!canNavigate}
          asChild={canNavigate}
        >
          {canNavigate ? (
            <Link href={href}>
              {!isClosed && <Play className="size-[11px]" />}
              {getActionLabel(task)}
              {isClosed && <ChevronRight className="size-[12px]" />}
            </Link>
          ) : (
            <span>{getActionLabel(task)}</span>
          )}
        </Button>
      </div>
    </div>
  );
}
