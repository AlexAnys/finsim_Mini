"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronRight,
  Plus,
  Users,
  FileText,
  MessageSquare,
  HelpCircle,
  Trash2,
  CalendarDays,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TaskInstance {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  slot: string | null;
  createdAt: string;
}

interface ContentBlock {
  id: string;
  blockType: string;
  slot: string;
  order: number;
}

interface Section {
  id: string;
  title: string;
  order: number;
  contentBlocks: ContentBlock[];
  taskInstances: TaskInstance[];
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  sections: Section[];
}

interface CourseDetail {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  semesterStartDate: string | null;
  class: { id: string; name: string };
  chapters: Chapter[];
}

interface TaskDef {
  id: string;
  taskName: string;
  taskType: string;
  scoringCriteria?: Array<{ id: string; name: string; maxPoints: number }>;
}

type SlotType = "pre" | "in" | "post";

const slotLabels: Record<SlotType, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

const slots: SlotType[] = ["pre", "in", "post"];

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-yellow-100 text-yellow-700",
  archived: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
  archived: "已归档",
};

const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

// ---------- Inline task creation types ----------

interface ScoringCriterion {
  name: string;
  maxPoints: number;
  description: string;
}

interface AllocationItem {
  label: string;
}

interface AllocationSection {
  label: string;
  items: AllocationItem[];
}

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Semester start date editing
  const [editingSemesterDate, setEditingSemesterDate] = useState(false);
  const [editSemesterDate, setEditSemesterDate] = useState("");
  const [savingSemesterDate, setSavingSemesterDate] = useState(false);

  // Chapter dialog
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [creatingChapter, setCreatingChapter] = useState(false);

  // Section dialog
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionChapterId, setSectionChapterId] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);

  // Add content sheet (replaces old dialog)
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogContext, setAddDialogContext] = useState<{
    chapterId: string;
    sectionId: string;
    slot: SlotType;
  } | null>(null);

  // Template tab state
  const [availableTasks, setAvailableTasks] = useState<TaskDef[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addDueAt, setAddDueAt] = useState("");
  const [taskPreview, setTaskPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submittingContent, setSubmittingContent] = useState(false);

  // Announcement tab state
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");

  // Inline task creation state (Tab 1: 新建任务)
  const [newTaskType, setNewTaskType] = useState<"simulation" | "quiz" | "subjective">("simulation");
  const [newTaskName, setNewTaskName] = useState("");
  const [newScenario, setNewScenario] = useState("");
  const [newOpeningLine, setNewOpeningLine] = useState("");
  const [newRequirements, setNewRequirements] = useState("");
  const [newScoringCriteria, setNewScoringCriteria] = useState<ScoringCriterion[]>([
    { name: "", maxPoints: 20, description: "" },
  ]);
  const [newAllocationSections, setNewAllocationSections] = useState<AllocationSection[]>([]);
  const [newStrictnessLevel, setNewStrictnessLevel] = useState("MODERATE");
  const [newEvaluatorPersona, setNewEvaluatorPersona] = useState("");
  const [newStudyBuddyContext, setNewStudyBuddyContext] = useState("");
  const [newDueAt, setNewDueAt] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  // Published tab state
  const [publishedInstances, setPublishedInstances] = useState<TaskInstance[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(false);

  const fetchCourse = useCallback(async () => {
    try {
      const res = await fetch(`/api/lms/courses/${courseId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载失败");
        return;
      }
      setCourse(json.data);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  async function handleSaveSemesterDate() {
    if (!editSemesterDate) {
      toast.error("请选择学期开始日期");
      return;
    }
    setSavingSemesterDate(true);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterStartDate: new Date(editSemesterDate).toISOString(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("学期开始日期已更新");
      setEditingSemesterDate(false);
      fetchCourse();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSavingSemesterDate(false);
    }
  }

  async function fetchAvailableTasks() {
    setLoadingTasks(true);
    try {
      const res = await fetch("/api/tasks");
      const json = await res.json();
      if (json.success) {
        setAvailableTasks(json.data ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingTasks(false);
    }
  }

  async function fetchPublishedInstances() {
    if (!course) return;
    setLoadingPublished(true);
    try {
      const res = await fetch(`/api/lms/task-instances?courseId=${course.id}`);
      const json = await res.json();
      if (json.success) {
        setPublishedInstances(json.data ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingPublished(false);
    }
  }

  function resetInlineForm() {
    setNewTaskType("simulation");
    setNewTaskName("");
    setNewScenario("");
    setNewOpeningLine("");
    setNewRequirements("");
    setNewScoringCriteria([{ name: "", maxPoints: 20, description: "" }]);
    setNewAllocationSections([]);
    setNewStrictnessLevel("MODERATE");
    setNewEvaluatorPersona("");
    setNewStudyBuddyContext("");
    setNewDueAt("");
  }

  function openAddDialog(chapterId: string, sectionId: string, slot: SlotType) {
    setAddDialogContext({ chapterId, sectionId, slot });
    // Reset template tab
    setSelectedTaskId("");
    setAddTitle("");
    setAddDescription("");
    setAddDueAt("");
    setTaskPreview(null);
    // Reset announcement tab
    setAnnouncementTitle("");
    setAnnouncementBody("");
    // Reset inline creation form
    resetInlineForm();
    setAddDialogOpen(true);
    fetchAvailableTasks();
    fetchPublishedInstances();
  }

  // ---------- Template tab handlers ----------

  async function handleTaskSelect(taskId: string) {
    setSelectedTaskId(taskId);
    const task = availableTasks.find((t) => t.id === taskId);
    if (task) {
      setAddTitle(task.taskName);
    }
    if (taskId) {
      setLoadingPreview(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        const json = await res.json();
        if (json.success) {
          setTaskPreview(json.data);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingPreview(false);
      }
    } else {
      setTaskPreview(null);
    }
  }

  async function handleSubmitTask() {
    if (!addDialogContext || !course) return;
    if (!selectedTaskId) {
      toast.error("请选择一个任务");
      return;
    }
    if (!addTitle.trim()) {
      toast.error("请填写标题");
      return;
    }
    if (!addDueAt) {
      toast.error("请设置截止时间");
      return;
    }

    const selectedTask = availableTasks.find((t) => t.id === selectedTaskId);
    if (!selectedTask) return;

    setSubmittingContent(true);
    try {
      const createRes = await fetch("/api/lms/task-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDescription.trim() || undefined,
          taskId: selectedTaskId,
          taskType: selectedTask.taskType,
          classId: course.class.id,
          courseId: course.id,
          chapterId: addDialogContext.chapterId,
          sectionId: addDialogContext.sectionId,
          slot: addDialogContext.slot,
          dueAt: new Date(addDueAt).toISOString(),
        }),
      });
      const createJson = await createRes.json();
      if (!createJson.success) {
        toast.error(createJson.error?.message || "创建任务实例失败");
        return;
      }

      const newInstanceId = createJson.data?.id;
      if (newInstanceId) {
        const publishRes = await fetch(
          `/api/lms/task-instances/${newInstanceId}/publish`,
          { method: "POST" }
        );
        const publishJson = await publishRes.json();
        if (!publishJson.success) {
          toast.error("任务已创建但发布失败，请手动发布");
          setAddDialogOpen(false);
          fetchCourse();
          return;
        }
      }

      toast.success("任务已添加并发布");
      setAddDialogOpen(false);
      fetchCourse();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmittingContent(false);
    }
  }

  // ---------- Announcement tab handler ----------

  async function handleSubmitAnnouncement() {
    if (!course) return;
    if (!announcementTitle.trim()) {
      toast.error("请填写公告标题");
      return;
    }
    if (!announcementBody.trim()) {
      toast.error("请填写公告内容");
      return;
    }

    setSubmittingContent(true);
    try {
      const res = await fetch("/api/lms/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          status: "published",
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "发布公告失败");
        return;
      }
      toast.success("公告已发布");
      setAddDialogOpen(false);
      fetchCourse();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmittingContent(false);
    }
  }

  // ---------- Inline task creation handler ----------

  async function handleCreateInlineTask() {
    if (!newTaskName.trim()) {
      toast.error("请输入任务名称");
      return;
    }
    if (!addDialogContext || !course) return;

    setCreatingTask(true);
    try {
      // Step 1: Create the task
      const taskBody: Record<string, unknown> = {
        taskType: newTaskType,
        taskName: newTaskName.trim(),
        requirements: newRequirements.trim() || undefined,
      };

      if (newTaskType === "simulation") {
        taskBody.simulationConfig = {
          scenario: newScenario.trim(),
          openingLine: newOpeningLine.trim(),
          strictnessLevel: newStrictnessLevel,
          evaluatorPersona: newEvaluatorPersona.trim() || undefined,
          studyBuddyContext: newStudyBuddyContext.trim() || undefined,
        };
        const validCriteria = newScoringCriteria.filter((c) => c.name.trim());
        if (validCriteria.length > 0) {
          taskBody.scoringCriteria = validCriteria.map((c, i) => ({
            name: c.name.trim(),
            description: c.description.trim() || undefined,
            maxPoints: c.maxPoints,
            order: i,
          }));
        }
        const validSections = newAllocationSections.filter((s) => s.label.trim());
        if (validSections.length > 0) {
          taskBody.allocationSections = validSections.map((s, i) => ({
            label: s.label.trim(),
            order: i,
            items: s.items
              .filter((item) => item.label.trim())
              .map((item, j) => ({
                label: item.label.trim(),
                order: j,
              })),
          }));
        }
      }

      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskBody),
      });
      const taskJson = await taskRes.json();
      if (!taskJson.success) {
        toast.error(taskJson.error?.message || "创建任务失败");
        return;
      }

      // Step 2: Create task instance
      const instRes = await fetch("/api/lms/task-instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskName.trim(),
          taskId: taskJson.data.id,
          taskType: newTaskType,
          classId: course.class.id,
          courseId: course.id,
          chapterId: addDialogContext.chapterId,
          sectionId: addDialogContext.sectionId,
          slot: addDialogContext.slot,
          dueAt: newDueAt
            ? new Date(newDueAt).toISOString()
            : new Date(Date.now() + 14 * 86400000).toISOString(),
        }),
      });
      const instJson = await instRes.json();
      if (!instJson.success) {
        toast.error("任务已创建但实例创建失败");
        return;
      }

      // Step 3: Publish
      const pubRes = await fetch(
        `/api/lms/task-instances/${instJson.data.id}/publish`,
        { method: "POST" }
      );
      const pubJson = await pubRes.json();
      if (!pubJson.success) {
        toast.error("任务已创建但发布失败");
      } else {
        toast.success("任务已创建并发布");
      }

      setAddDialogOpen(false);
      fetchCourse();
    } catch {
      toast.error("网络错误");
    } finally {
      setCreatingTask(false);
    }
  }

  // ---------- Inline form helpers ----------

  function addNewCriterion() {
    setNewScoringCriteria((prev) => [...prev, { name: "", maxPoints: 20, description: "" }]);
  }

  function removeNewCriterion(idx: number) {
    setNewScoringCriteria((prev) => prev.filter((_, i) => i !== idx));
  }

  function setNewCriterion(idx: number, field: keyof ScoringCriterion, value: string | number) {
    setNewScoringCriteria((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addNewAllocationSection() {
    setNewAllocationSections((prev) => [...prev, { label: "", items: [{ label: "" }] }]);
  }

  function removeNewAllocationSection(idx: number) {
    setNewAllocationSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function setNewAllocationSectionLabel(idx: number, label: string) {
    setNewAllocationSections((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], label };
      return next;
    });
  }

  function addNewAllocationItem(sectionIdx: number) {
    setNewAllocationSections((prev) => {
      const next = [...prev];
      next[sectionIdx] = {
        ...next[sectionIdx],
        items: [...next[sectionIdx].items, { label: "" }],
      };
      return next;
    });
  }

  function removeNewAllocationItem(sectionIdx: number, itemIdx: number) {
    setNewAllocationSections((prev) => {
      const next = [...prev];
      next[sectionIdx] = {
        ...next[sectionIdx],
        items: next[sectionIdx].items.filter((_, i) => i !== itemIdx),
      };
      return next;
    });
  }

  function setNewAllocationItemLabel(sectionIdx: number, itemIdx: number, label: string) {
    setNewAllocationSections((prev) => {
      const next = [...prev];
      next[sectionIdx] = {
        ...next[sectionIdx],
        items: next[sectionIdx].items.map((item, i) =>
          i === itemIdx ? { ...item, label } : item
        ),
      };
      return next;
    });
  }

  // ---------- Chapter / Section handlers ----------

  async function handleCreateChapter() {
    if (!chapterTitle.trim()) return;
    setCreatingChapter(true);
    try {
      const order = course?.chapters.length ?? 0;
      const res = await fetch("/api/lms/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          title: chapterTitle.trim(),
          order,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setChapterTitle("");
        setChapterDialogOpen(false);
        setLoading(true);
        fetchCourse();
      }
    } finally {
      setCreatingChapter(false);
    }
  }

  async function handleCreateSection() {
    if (!sectionTitle.trim() || !sectionChapterId) return;
    setCreatingSection(true);
    try {
      const chapter = course?.chapters.find((c) => c.id === sectionChapterId);
      const order = chapter?.sections.length ?? 0;
      const res = await fetch("/api/lms/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          chapterId: sectionChapterId,
          title: sectionTitle.trim(),
          order,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSectionTitle("");
        setSectionChapterId("");
        setSectionDialogOpen(false);
        setLoading(true);
        fetchCourse();
      }
    } finally {
      setCreatingSection(false);
    }
  }

  function getTasksForSlot(section: Section, slot: SlotType): TaskInstance[] {
    return section.taskInstances.filter((ti) => ti.slot === slot);
  }

  // ---------- Loading / Error states ----------

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

  if (!course) return null;

  // ---------- Render ----------

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/teacher/courses" className="hover:text-foreground">
          课程管理
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">{course.courseTitle}</span>
      </div>

      {/* Course Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{course.courseTitle}</h1>
            {course.courseCode && (
              <p className="text-sm text-muted-foreground">{course.courseCode}</p>
            )}
            {course.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {course.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                <Users className="size-3" />
                {course.class.name}
              </Badge>
              {editingSemesterDate ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={editSemesterDate}
                    onChange={(e) => setEditSemesterDate(e.target.value)}
                    className="h-7 w-40 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={handleSaveSemesterDate}
                    disabled={savingSemesterDate}
                  >
                    {savingSemesterDate ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Check className="size-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setEditingSemesterDate(false)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : course.semesterStartDate ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 w-fit cursor-pointer hover:bg-muted"
                  onClick={() => {
                    setEditSemesterDate(course.semesterStartDate!.slice(0, 10));
                    setEditingSemesterDate(true);
                  }}
                >
                  <CalendarDays className="size-3" />
                  学期开始：{new Date(course.semesterStartDate).toLocaleDateString("zh-CN")}
                  <Pencil className="size-2.5 ml-1 text-muted-foreground" />
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 w-fit cursor-pointer hover:bg-muted text-muted-foreground"
                  onClick={() => {
                    setEditSemesterDate("");
                    setEditingSemesterDate(true);
                  }}
                >
                  <CalendarDays className="size-3" />
                  设置学期开始日期
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setChapterDialogOpen(true)}
          >
            <Plus className="size-4 mr-1" />
            添加章节
          </Button>
        </div>
      </div>

      <Separator />

      {/* Course Matrix */}
      {course.chapters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">暂无章节</p>
            <p className="text-sm text-muted-foreground">
              点击上方按钮添加第一个章节
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {course.chapters.map((chapter) => (
            <Card key={chapter.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    第 {chapter.order + 1} 章：{chapter.title}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSectionChapterId(chapter.id);
                      setSectionDialogOpen(true);
                    }}
                  >
                    <Plus className="size-3 mr-1" />
                    添加小节
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {chapter.sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无小节</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">小节</TableHead>
                        {slots.map((slot) => (
                          <TableHead key={slot} className="text-center">
                            {slotLabels[slot]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chapter.sections.map((section) => (
                        <TableRow key={section.id}>
                          <TableCell className="font-medium align-top">
                            {chapter.order + 1}.{section.order + 1}{" "}
                            {section.title}
                          </TableCell>
                          {slots.map((slot) => {
                            const tasks = getTasksForSlot(section, slot);
                            return (
                              <TableCell
                                key={slot}
                                className="align-top text-center min-w-[180px]"
                              >
                                {tasks.length === 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-blue-50"
                                    onClick={() =>
                                      openAddDialog(chapter.id, section.id, slot)
                                    }
                                  >
                                    <Plus className="size-4" />
                                  </Button>
                                ) : (
                                  <div className="space-y-1.5">
                                    {tasks.map((ti) => {
                                      const Icon =
                                        taskTypeIcons[ti.taskType] || FileText;
                                      return (
                                        <Link
                                          key={ti.id}
                                          href={`/teacher/instances/${ti.id}`}
                                          className={`block rounded-md border p-2 text-left text-xs hover:ring-2 hover:ring-blue-300 transition-shadow cursor-pointer ${
                                            statusColors[ti.status] || ""
                                          }`}
                                        >
                                          <div className="flex items-center gap-1">
                                            <Icon className="size-3 shrink-0" />
                                            <span className="font-medium truncate">
                                              {ti.title}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 mt-1">
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] px-1 py-0"
                                            >
                                              {taskTypeLabels[ti.taskType] || ti.taskType}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground">
                                              {statusLabels[ti.status] || ti.status}
                                            </span>
                                          </div>
                                        </Link>
                                      );
                                    })}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-blue-50"
                                      onClick={() =>
                                        openAddDialog(chapter.id, section.id, slot)
                                      }
                                    >
                                      <Plus className="size-3" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Chapter Dialog */}
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加章节</DialogTitle>
            <DialogDescription>
              为课程 &ldquo;{course.courseTitle}&rdquo; 添加新章节。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chapterTitle">章节标题 *</Label>
              <Input
                id="chapterTitle"
                placeholder="例如：投资组合理论"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChapterDialogOpen(false)}
              disabled={creatingChapter}
            >
              取消
            </Button>
            <Button onClick={handleCreateChapter} disabled={creatingChapter}>
              {creatingChapter ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                "确认添加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Section Dialog */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加小节</DialogTitle>
            <DialogDescription>
              为选定章节添加新的小节。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sectionTitle">小节标题 *</Label>
              <Input
                id="sectionTitle"
                placeholder="例如：风险与收益的权衡"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSectionDialogOpen(false)}
              disabled={creatingSection}
            >
              取消
            </Button>
            <Button onClick={handleCreateSection} disabled={creatingSection}>
              {creatingSection ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                "确认添加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Content Sheet (side panel with tabs) */}
      <Sheet open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <SheetContent
          side="right"
          className="w-[600px] sm:w-[700px] sm:max-w-none overflow-y-auto p-0"
        >
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>
              添加内容 - {addDialogContext ? slotLabels[addDialogContext.slot] : ""}
            </SheetTitle>
            <SheetDescription>
              选择添加方式：新建任务、发布公告、使用已有模板或查看已发布内容。
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="template" className="px-6 pb-6 mt-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="new-task">新建任务</TabsTrigger>
              <TabsTrigger value="announcement">新建公告</TabsTrigger>
              <TabsTrigger value="template">任务模板</TabsTrigger>
              <TabsTrigger value="published">已发布</TabsTrigger>
            </TabsList>

            {/* Tab 1: 新建任务 */}
            <TabsContent value="new-task" className="mt-4 space-y-4">
              {/* Task name */}
              <div className="space-y-2">
                <Label>任务名称 *</Label>
                <Input
                  placeholder="例如：客户理财咨询模拟"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                />
              </div>

              {/* Task type */}
              <div className="space-y-2">
                <Label>任务类型</Label>
                <Select
                  value={newTaskType}
                  onValueChange={(v) => setNewTaskType(v as "simulation" | "quiz" | "subjective")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simulation">模拟对话</SelectItem>
                    <SelectItem value="quiz">测验</SelectItem>
                    <SelectItem value="subjective">主观题</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Due date */}
              <div className="space-y-2">
                <Label>截止时间</Label>
                <Input
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  留空则默认为两周后
                </p>
              </div>

              {/* Simulation-specific fields */}
              {newTaskType === "simulation" && (
                <>
                  <Separator />
                  <h3 className="text-sm font-semibold">模拟对话配置</h3>

                  {/* Scenario */}
                  <div className="space-y-2">
                    <Label>情景（AI 角色背景）*</Label>
                    <Textarea
                      placeholder="描述 AI 扮演的角色和对话场景..."
                      value={newScenario}
                      onChange={(e) => setNewScenario(e.target.value)}
                      rows={4}
                    />
                  </div>

                  {/* Opening line */}
                  <div className="space-y-2">
                    <Label>对话起始句 *</Label>
                    <Textarea
                      placeholder="AI 角色的开场白..."
                      value={newOpeningLine}
                      onChange={(e) => setNewOpeningLine(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {/* Requirements */}
                  <div className="space-y-2">
                    <Label>要求（对话要求/学生目标）</Label>
                    <Textarea
                      placeholder="每行一条要求，例如：&#10;需要了解客户的风险偏好&#10;推荐合适的理财产品"
                      value={newRequirements}
                      onChange={(e) => setNewRequirements(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Allocation sections */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>配置方案工具设置</Label>
                      <Button variant="outline" size="sm" onClick={addNewAllocationSection}>
                        <Plus className="size-3 mr-1" />
                        添加分区
                      </Button>
                    </div>
                    {newAllocationSections.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        暂无配置分区，点击上方按钮添加。
                      </p>
                    )}
                    {newAllocationSections.map((section, si) => (
                      <div key={si} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">分区 {si + 1}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeNewAllocationSection(si)}
                            className="size-6 text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                        <Input
                          placeholder="分区名称，例如：股票"
                          value={section.label}
                          onChange={(e) => setNewAllocationSectionLabel(si, e.target.value)}
                        />
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">配置项</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addNewAllocationItem(si)}
                              className="h-6 text-xs"
                            >
                              <Plus className="size-3 mr-1" />
                              添加项
                            </Button>
                          </div>
                          {section.items.map((item, ii) => (
                            <div key={ii} className="flex items-center gap-2">
                              <Input
                                placeholder="名称"
                                value={item.label}
                                onChange={(e) =>
                                  setNewAllocationItemLabel(si, ii, e.target.value)
                                }
                                className="flex-1"
                              />
                              {section.items.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeNewAllocationItem(si, ii)}
                                  className="size-6 shrink-0 text-destructive"
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Study Buddy context */}
                  <div className="space-y-2">
                    <Label>Study Buddy 背景知识库</Label>
                    <Textarea
                      placeholder="提供给学习伙伴的背景知识..."
                      value={newStudyBuddyContext}
                      onChange={(e) => setNewStudyBuddyContext(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Evaluator persona */}
                  <div className="space-y-2">
                    <Label>评估角色设定</Label>
                    <Textarea
                      placeholder="评估 AI 的角色和评估标准描述..."
                      value={newEvaluatorPersona}
                      onChange={(e) => setNewEvaluatorPersona(e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Scoring criteria */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>评分标准</Label>
                      <Button variant="outline" size="sm" onClick={addNewCriterion}>
                        <Plus className="size-3 mr-1" />
                        添加标准
                      </Button>
                    </div>
                    {newScoringCriteria.map((c, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">标准 {i + 1}</span>
                          {newScoringCriteria.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeNewCriterion(i)}
                              className="size-6 text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-2 grid-cols-2">
                          <div>
                            <Label className="text-xs">名称</Label>
                            <Input
                              placeholder="例如：需求分析"
                              value={c.name}
                              onChange={(e) => setNewCriterion(i, "name", e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">最高分</Label>
                            <Input
                              type="number"
                              min={1}
                              value={c.maxPoints}
                              onChange={(e) =>
                                setNewCriterion(i, "maxPoints", parseInt(e.target.value) || 1)
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">描述</Label>
                          <Textarea
                            placeholder="该评分标准的详细说明..."
                            value={c.description}
                            onChange={(e) => setNewCriterion(i, "description", e.target.value)}
                            rows={2}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strictness level */}
                  <div className="space-y-2">
                    <Label>评分模式</Label>
                    <div className="flex gap-2">
                      {[
                        { value: "LENIENT", label: "宽松" },
                        { value: "MODERATE", label: "较为宽松" },
                        { value: "STRICT", label: "较为严苛" },
                        { value: "VERY_STRICT", label: "严苛" },
                      ].map((level) => (
                        <Button
                          key={level.value}
                          variant={newStrictnessLevel === level.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setNewStrictnessLevel(level.value)}
                        >
                          {level.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Quiz type - basic fields */}
              {newTaskType === "quiz" && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    测验类型的详细配置（题目等）请在创建后到任务详情页编辑，或使用「任务模板」标签选择已有测验。
                  </p>
                </>
              )}

              {/* Subjective type - basic fields */}
              {newTaskType === "subjective" && (
                <>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    主观题的详细配置请在创建后到任务详情页编辑，或使用「任务模板」标签选择已有主观题。
                  </p>
                </>
              )}

              {/* Submit button */}
              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={handleCreateInlineTask}
                  disabled={creatingTask}
                >
                  {creatingTask ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    "保存并添加"
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 2: 新建公告 */}
            <TabsContent value="announcement" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>公告标题 *</Label>
                <Input
                  placeholder="公告标题"
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>公告内容 *</Label>
                <Textarea
                  placeholder="请输入公告内容..."
                  value={announcementBody}
                  onChange={(e) => setAnnouncementBody(e.target.value)}
                  rows={6}
                />
              </div>
              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={handleSubmitAnnouncement}
                  disabled={submittingContent}
                >
                  {submittingContent ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      发布中...
                    </>
                  ) : (
                    "发布公告"
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Tab 3: 任务模板 */}
            <TabsContent value="template" className="mt-4 space-y-4">
              {loadingTasks ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="size-4 animate-spin" />
                  加载任务列表...
                </div>
              ) : availableTasks.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <FileText className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    暂无可用任务模板
                  </p>
                  <p className="text-xs text-muted-foreground">
                    请先在「新建任务」标签中创建任务。
                  </p>
                </div>
              ) : (
                <>
                  {/* Task cards list */}
                  <div className="space-y-2">
                    {availableTasks.map((task) => {
                      const Icon = taskTypeIcons[task.taskType] || FileText;
                      const isSelected = selectedTaskId === task.id;
                      return (
                        <div
                          key={task.id}
                          className={`rounded-lg border p-3 cursor-pointer transition-all hover:border-blue-300 ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                              : ""
                          }`}
                          onClick={() => handleTaskSelect(task.id)}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            <span className="font-medium text-sm flex-1 truncate">
                              {task.taskName}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {taskTypeLabels[task.taskType] || task.taskType}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Task preview */}
                  {selectedTaskId && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      {loadingPreview ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          加载任务详情...
                        </div>
                      ) : taskPreview ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">任务预览</span>
                            <Link
                              href={`/teacher/tasks/${taskPreview.id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              查看完整配置
                            </Link>
                          </div>
                          <div className="text-xs space-y-1">
                            <p>
                              <span className="text-muted-foreground">类型：</span>
                              {taskTypeLabels[taskPreview.taskType] || taskPreview.taskType}
                            </p>
                            {taskPreview.requirements && (
                              <p>
                                <span className="text-muted-foreground">要求：</span>
                                {taskPreview.requirements}
                              </p>
                            )}
                            {taskPreview.scoringCriteria?.length > 0 && (
                              <div>
                                <span className="text-muted-foreground">评分标准：</span>
                                <ul className="ml-3 mt-0.5 space-y-0.5">
                                  {taskPreview.scoringCriteria.map((c: any) => (
                                    <li key={c.id}>
                                      {c.name}（{c.maxPoints}分）
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {taskPreview.questions?.length > 0 && (
                              <p>
                                <span className="text-muted-foreground">题目数量：</span>
                                {taskPreview.questions.length} 道
                              </p>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  {/* Instance form fields */}
                  {selectedTaskId && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="space-y-2">
                        <Label>标题 *</Label>
                        <Input
                          placeholder="任务标题"
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>描述</Label>
                        <Textarea
                          placeholder="可选描述..."
                          value={addDescription}
                          onChange={(e) => setAddDescription(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>截止时间 *</Label>
                        <Input
                          type="datetime-local"
                          value={addDueAt}
                          onChange={(e) => setAddDueAt(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleSubmitTask}
                        disabled={submittingContent}
                      >
                        {submittingContent ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            添加中...
                          </>
                        ) : (
                          "添加到课程"
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Tab 4: 已发布任务 */}
            <TabsContent value="published" className="mt-4">
              {loadingPublished ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="size-4 animate-spin" />
                  加载已发布任务...
                </div>
              ) : publishedInstances.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <FileText className="size-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    该课程暂无已发布的任务实例
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {publishedInstances.map((inst) => {
                    const Icon = taskTypeIcons[inst.taskType] || FileText;
                    return (
                      <Link
                        key={inst.id}
                        href={`/teacher/instances/${inst.id}`}
                        className="block rounded-lg border p-3 hover:border-blue-300 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-sm flex-1 truncate">
                            {inst.title}
                          </span>
                          <Badge
                            className={`text-xs ${statusColors[inst.status] || ""}`}
                          >
                            {statusLabels[inst.status] || inst.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>
                            {taskTypeLabels[inst.taskType] || inst.taskType}
                          </span>
                          {inst.slot && (
                            <span>{slotLabels[inst.slot as SlotType] || inst.slot}</span>
                          )}
                          {inst.dueAt && (
                            <span>
                              截止：{new Date(inst.dueAt).toLocaleDateString("zh-CN")}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
