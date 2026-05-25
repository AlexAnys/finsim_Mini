"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { BookOpen, Loader2, AlertCircle, Plus, Trash2, RotateCcw, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  CourseSummaryStrip,
  type SummaryStripItem,
} from "@/components/dashboard/course-summary-strip";
import {
  TeacherCourseCard,
  type TeacherCourseCardData,
} from "@/components/teacher-courses/teacher-course-card";
import {
  buildClassNames,
  buildCourseMetrics,
  buildTeacherCourseSummary,
  buildTeacherList,
} from "@/lib/utils/teacher-courses-transforms";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface CourseApiItem extends Record<string, any> {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  createdAt: string;
  semesterStartDate: string | null;
}

interface DashboardData {
  taskInstances: Array<Record<string, any>>;
  recentSubmissions: Array<Record<string, any>>;
  stats: { pendingCount: number };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface ClassItem {
  id: string;
  name: string;
  _count: { students: number };
}

interface ArchivedCourse {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  deletedAt: string | null;
  _count?: { chapters: number; taskInstances: number };
}

function RecycleBinDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRestore: (id: string) => Promise<boolean>;
  onPurge: (id: string, confirmTitle: string) => Promise<boolean>;
}) {
  const [items, setItems] = useState<ArchivedCourse[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 彻底删除强确认
  const [purgeTarget, setPurgeTarget] = useState<ArchivedCourse | null>(null);
  const [purgeInput, setPurgeInput] = useState("");
  const [purging, setPurging] = useState(false);

  const loadArchived = useCallback(async () => {
    setItems(null);
    setLoadErr(null);
    try {
      const res = await fetch("/api/lms/courses/archived");
      const json = await res.json();
      if (!json.success) {
        setLoadErr(json.error?.message || "加载已删除课程失败");
        return;
      }
      setItems(json.data);
    } catch {
      setLoadErr("网络错误，请稍后重试");
    }
  }, []);

  // 抽屉打开时拉取已删除课程。包到 async IIFE 里、把 loadArchived 推到 await
  // 之后执行，避免在 effect 同步体内直接 setState（React Compiler 规则）。
  useEffect(() => {
    if (!props.open) return;
    let ignore = false;
    (async () => {
      if (ignore) return;
      await loadArchived();
    })();
    return () => {
      ignore = true;
    };
  }, [props.open, loadArchived]);

  async function doRestore(id: string) {
    setBusyId(id);
    const ok = await props.onRestore(id);
    setBusyId(null);
    if (ok) loadArchived();
  }

  async function doPurge() {
    if (!purgeTarget) return;
    setPurging(true);
    const ok = await props.onPurge(purgeTarget.id, purgeInput);
    setPurging(false);
    if (ok) {
      setPurgeTarget(null);
      setPurgeInput("");
      loadArchived();
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>回收站 · 已删除课程</DialogTitle>
          <DialogDescription>
            已删除的课程从所有页面消失但未被销毁。可恢复回归原状，或彻底删除（不可恢复，将永久移除课程及其全部任务、提交、成绩等）。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
          {items === null && !loadErr && (
            <div className="flex items-center justify-center py-10 text-sm text-ink-4">
              <Loader2 className="mr-2 size-4 animate-spin" />
              加载中...
            </div>
          )}
          {loadErr && <p className="py-6 text-center text-sm text-danger">{loadErr}</p>}
          {items !== null && items.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-4">回收站为空</p>
          )}
          {items?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {c.courseCode && (
                    <span className="rounded bg-paper-alt px-1.5 py-[1px] text-[11px] text-ink-3">
                      {c.courseCode}
                    </span>
                  )}
                  <span className="truncate text-[14px] font-semibold text-ink">
                    {c.courseTitle}
                  </span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-ink-4">
                  {c._count ? `${c._count.chapters} 章节 · ${c._count.taskInstances} 任务实例` : ""}
                  {c.deletedAt && (
                    <>
                      <span className="mx-1 text-ink-5">·</span>
                      删除于 {formatArchivedAt(c.deletedAt)}
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === c.id}
                  onClick={() => doRestore(c.id)}
                >
                  {busyId === c.id ? (
                    <Loader2 className="size-[13px] animate-spin" />
                  ) : (
                    <RotateCcw className="size-[13px]" />
                  )}
                  恢复
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setPurgeTarget(c);
                    setPurgeInput("");
                  }}
                >
                  <Trash2 className="size-[13px]" />
                  彻底删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>

      {/* 彻底删除强确认：输入课程名一致才可点 */}
      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => !open && !purging && setPurgeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>彻底删除「{purgeTarget?.courseTitle}」</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可恢复，将永久删除该课程及其全部章节、内容、任务实例、学生提交与成绩、分析报告、公告、课表等。
              请输入课程名称 <span className="font-semibold text-ink">{purgeTarget?.courseTitle}</span> 以确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-1">
            <Input
              value={purgeInput}
              onChange={(e) => setPurgeInput(e.target.value)}
              placeholder="输入课程名称确认"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purging}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                doPurge();
              }}
              disabled={purging || purgeInput !== purgeTarget?.courseTitle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {purging ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  删除中...
                </>
              ) : (
                "彻底删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function formatArchivedAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TeacherCoursesPage() {
  const { data: session } = useSession();
  const myUserId = session?.user?.id;
  const [courses, setCourses] = useState<CourseApiItem[] | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  // 删除（归档）confirm dialog
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 回收站（已删除课程）抽屉
  const [recycleOpen, setRecycleOpen] = useState(false);

  async function fetchData() {
    try {
      const [coursesRes, dashRes, classesRes] = await Promise.all([
        fetch("/api/lms/courses"),
        fetch("/api/lms/dashboard/summary"),
        fetch("/api/lms/classes"),
      ]);
      const [coursesJson, dashJson, classesJson] = await Promise.all([
        coursesRes.json(),
        dashRes.json(),
        classesRes.json(),
      ]);

      if (!coursesJson.success) {
        setError(coursesJson.error?.message || "加载课程失败");
        return;
      }
      setCourses(coursesJson.data);
      if (dashJson.success) setDashboard(dashJson.data);
      if (classesJson.success) setClasses(classesJson.data);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const cards = useMemo<TeacherCourseCardData[]>(() => {
    if (!courses) return [];
    const tis = dashboard?.taskInstances ?? [];
    const subs = dashboard?.recentSubmissions ?? [];
    return courses.map((c) => ({
      id: c.id,
      courseTitle: c.courseTitle,
      courseCode: c.courseCode,
      description: c.description,
      classNames: buildClassNames(c),
      teachers: buildTeacherList(c),
      metrics: buildCourseMetrics(c, tis, subs),
      semesterStartIso: c.semesterStartDate ?? null,
      // Unit 5a: owner-only 删除显示
      isOwner: !!myUserId && c.creator?.id === myUserId,
      chapterCount: c._count?.chapters ?? 0,
      taskInstanceCount: c._count?.taskInstances ?? 0,
    }));
  }, [courses, dashboard, myUserId]);

  const summaryItems = useMemo<SummaryStripItem[]>(() => {
    if (!courses || courses.length === 0) return [];
    const tis = dashboard?.taskInstances ?? [];
    const s = buildTeacherCourseSummary({
      courses,
      taskInstances: tis,
      pendingCount: dashboard?.stats?.pendingCount ?? 0,
    });
    return [
      {
        label: "总课程",
        value: s.totalCourses,
        suffix: "门",
        sub: "本学期",
      },
      {
        label: "学生总数",
        value: s.totalStudents,
        suffix: "人",
        sub: "跨班级去重",
      },
      {
        label: "本周活跃任务",
        value: s.totalActiveTasks,
        suffix: "项",
        sub: "发布且未归档",
      },
      {
        label: "待批改",
        value: s.totalPending,
        suffix: "份",
        sub: s.totalPending > 0 ? "需尽快处理" : "已全部批改",
        tone: s.totalPending > 0 ? "warn" : "success",
      },
    ];
  }, [courses, dashboard]);

  async function handleCreate() {
    if (!courseTitle.trim()) {
      setFormError("请输入课程名称");
      return;
    }
    if (!classId) {
      setFormError("请选择班级");
      return;
    }

    setCreating(true);
    setFormError(null);

    try {
      const res = await fetch("/api/lms/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: courseTitle.trim(),
          courseCode: courseCode.trim() || undefined,
          description: description.trim() || undefined,
          classId,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormError(json.error?.message || "创建失败");
        return;
      }

      setCourseTitle("");
      setCourseCode("");
      setDescription("");
      setClassId("");
      setDialogOpen(false);
      setLoading(true);
      fetchData();
    } catch {
      setFormError("网络错误，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmedDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/courses/${confirmDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "删除失败");
        return;
      }
      toast.success("课程已移入回收站，可在回收站恢复");
      setConfirmDelete(null);
      setLoading(true);
      fetchData();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setDeleting(false);
    }
  }

  // 从回收站恢复
  async function handleRestore(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/lms/courses/${id}/restore`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "恢复失败");
        return false;
      }
      toast.success("课程已恢复");
      setLoading(true);
      fetchData();
      return true;
    } catch {
      toast.error("网络错误，请稍后重试");
      return false;
    }
  }

  // 彻底删除（需课程名强确认）
  async function handlePurge(id: string, confirmTitle: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/lms/courses/${id}/purge`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmTitle }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "彻底删除失败");
        return false;
      }
      toast.success("课程已彻底删除");
      return true;
    } catch {
      toast.error("网络错误，请稍后重试");
      return false;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink-5" />
        <span className="ml-2 text-sm text-ink-4">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <AlertCircle className="size-8 text-danger" />
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!courses) return null;

  return (
    <div className="mx-auto max-w-[1320px] space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            本学期
          </div>
          <h1 className="text-[26px] font-bold tracking-[-0.01em] text-ink">
            课程管理
          </h1>
          <p className="mt-1 text-[13px] text-ink-4">
            共 {courses.length} 门课程
            {courses.length > 0 && (
              <>
                <span className="mx-1.5 text-ink-5">·</span>
                {cards.reduce((acc, c) => acc + c.metrics.taskCount, 0)} 项任务
                <span className="mx-1.5 text-ink-5">·</span>
                {cards.reduce((acc, c) => acc + c.metrics.studentCount, 0)} 人次在读
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRecycleOpen(true)}
          >
            <Archive className="size-[13px]" />
            回收站
          </Button>
          <CreateCourseDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            classes={classes}
            courseTitle={courseTitle}
            setCourseTitle={setCourseTitle}
            courseCode={courseCode}
            setCourseCode={setCourseCode}
            description={description}
            setDescription={setDescription}
            classId={classId}
            setClassId={setClassId}
            creating={creating}
            formError={formError}
            onCreate={handleCreate}
          />
        </div>
      </header>

      {summaryItems.length > 0 && <CourseSummaryStrip items={summaryItems} />}

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface py-14">
          <BookOpen className="size-12 text-ink-5" />
          <p className="text-sm text-ink-4">暂无课程</p>
          <p className="text-xs text-ink-5">
            点击右上角 &ldquo;新建课程&rdquo; 创建第一门课
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cards.map((c) => (
            <TeacherCourseCard
              key={c.id}
              data={c}
              onArchive={(id, title) => setConfirmDelete({ id, title })}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && !deleting && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除课程（移入回收站）</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{confirmDelete?.title}」？课程及其章节内容、已发布任务将从所有页面消失，
              但不会被销毁——可在&ldquo;回收站&rdquo;中恢复或彻底删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "删除（移入回收站）"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecycleBinDialog
        open={recycleOpen}
        onOpenChange={setRecycleOpen}
        onRestore={handleRestore}
        onPurge={handlePurge}
      />
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classes: ClassItem[];
  courseTitle: string;
  setCourseTitle: (v: string) => void;
  courseCode: string;
  setCourseCode: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  classId: string;
  setClassId: (v: string) => void;
  creating: boolean;
  formError: string | null;
  onCreate: () => void;
}

function CreateCourseDialog(props: DialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-[13px]" />
          新建课程
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建新课程</DialogTitle>
          <DialogDescription>
            填写课程基本信息，选择关联的主班级（可在创建后扩展协讲教师与次班）。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courseTitle">课程名称 *</Label>
            <Input
              id="courseTitle"
              placeholder="例如：个人理财规划"
              value={props.courseTitle}
              onChange={(e) => props.setCourseTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="courseCode">课程代码</Label>
            <Input
              id="courseCode"
              placeholder="例如：FIN101"
              value={props.courseCode}
              onChange={(e) => props.setCourseCode(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">课程描述</Label>
            <Textarea
              id="description"
              placeholder="简要描述课程内容..."
              value={props.description}
              onChange={(e) => props.setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="classId">关联班级 *</Label>
            <Select value={props.classId} onValueChange={props.setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择班级" />
              </SelectTrigger>
              <SelectContent>
                {props.classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}（{c._count.students} 人）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {props.formError && (
            <p className="text-sm text-danger">{props.formError}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => props.onOpenChange(false)}
            disabled={props.creating}
          >
            取消
          </Button>
          <Button onClick={props.onCreate} disabled={props.creating}>
            {props.creating ? (
              <>
                <Loader2 className="size-[13px] animate-spin" />
                创建中...
              </>
            ) : (
              "确认创建"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
