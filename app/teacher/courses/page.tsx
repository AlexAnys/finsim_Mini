"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, AlertCircle, Plus } from "lucide-react";
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

export default function TeacherCoursesPage() {
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
    }));
  }, [courses, dashboard]);

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
            <TeacherCourseCard key={c.id} data={c} />
          ))}
        </div>
      )}
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
