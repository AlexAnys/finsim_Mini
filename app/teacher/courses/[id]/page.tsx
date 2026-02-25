"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
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
  Upload,
  Sparkles,
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
import { Switch } from "@/components/ui/switch";
import { CourseAnalyticsTab } from "@/components/course/course-analytics-tab";
import { CourseAnnouncementsPanel } from "@/components/course/course-announcements-panel";
import { cn } from "@/lib/utils";

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

type QuizQuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestion {
  type: QuizQuestionType;
  stem: string;
  options: QuizOption[];
  correctOptionIds: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
}

const quizQuestionTypeLabels: Record<QuizQuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

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
  const [taskPreview, setTaskPreview] = useState<{
    id: string;
    taskType: string;
    requirements?: string;
    scoringCriteria?: Array<{ id: string; name: string; maxPoints: number }>;
    questions?: Array<unknown>;
  } | null>(null);
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

  // Quiz inline creation state
  const [newQuizMode, setNewQuizMode] = useState<"fixed" | "adaptive">("fixed");
  const [newTimeLimitMinutes, setNewTimeLimitMinutes] = useState("");
  const [newShowCorrectAnswer, setNewShowCorrectAnswer] = useState(false);
  const [newQuizQuestions, setNewQuizQuestions] = useState<QuizQuestion[]>([]);
  const [importingPDF, setImportingPDF] = useState(false);

  // Published tab state
  const [publishedInstances, setPublishedInstances] = useState<TaskInstance[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(false);

  // Chapter collapse state
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

  // Multi-class state
  const [courseClasses, setCourseClasses] = useState<{ id: string; classId: string; class: { id: string; name: string } }[]>([]);
  const [addClassDialogOpen, setAddClassDialogOpen] = useState(false);
  const [addClassId, setAddClassId] = useState("");
  const [addingClass, setAddingClass] = useState(false);
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);

  // Collaborative teachers state
  const [courseTeachers, setCourseTeachers] = useState<{ id: string; teacherId: string; teacher: { id: string; name: string; email: string } }[]>([]);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [addingTeacher, setAddingTeacher] = useState(false);

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

  const fetchCourseTeachers = useCallback(async () => {
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/teachers`);
      const json = await res.json();
      if (json.success) setCourseTeachers(json.data || []);
    } catch {
      // silent
    }
  }, [courseId]);

  const fetchCourseClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/classes`);
      const json = await res.json();
      if (json.success) setCourseClasses(json.data || []);
    } catch {
      // silent
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
    fetchCourseTeachers();
    fetchCourseClasses();
  }, [fetchCourse, fetchCourseTeachers, fetchCourseClasses]);

  async function fetchAvailableClasses() {
    try {
      const res = await fetch("/api/lms/classes");
      const json = await res.json();
      if (json.success) setClassesList(json.data || []);
    } catch {
      // silent
    }
  }

  async function handleAddClass() {
    if (!addClassId) {
      toast.error("请选择班级");
      return;
    }
    setAddingClass(true);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: addClassId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "添加失败");
        return;
      }
      toast.success("班级已添加");
      setAddClassId("");
      setAddClassDialogOpen(false);
      fetchCourseClasses();
    } catch {
      toast.error("网络错误");
    } finally {
      setAddingClass(false);
    }
  }

  async function handleRemoveClass(classId: string) {
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/classes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "移除失败");
        return;
      }
      toast.success("班级已移除");
      fetchCourseClasses();
    } catch {
      toast.error("网络错误");
    }
  }

  async function handleAddTeacher() {
    if (!teacherEmail.trim()) {
      toast.error("请输入教师邮箱");
      return;
    }
    setAddingTeacher(true);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/teachers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: teacherEmail.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "添加失败");
        return;
      }
      toast.success("协作教师已添加");
      setTeacherEmail("");
      setTeacherDialogOpen(false);
      fetchCourseTeachers();
    } catch {
      toast.error("网络错误");
    } finally {
      setAddingTeacher(false);
    }
  }

  async function handleRemoveTeacher(teacherId: string) {
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/teachers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "移除失败");
        return;
      }
      toast.success("协作教师已移除");
      fetchCourseTeachers();
    } catch {
      toast.error("网络错误");
    }
  }

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
    setNewQuizMode("fixed");
    setNewTimeLimitMinutes("");
    setNewShowCorrectAnswer(false);
    setNewQuizQuestions([]);
    setImportingPDF(false);
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

      if (newTaskType === "quiz") {
        taskBody.quizConfig = {
          mode: newQuizMode,
          timeLimitMinutes: newTimeLimitMinutes ? parseInt(newTimeLimitMinutes) : undefined,
          showCorrectAnswer: newShowCorrectAnswer,
        };
        if (newQuizQuestions.length > 0) {
          taskBody.quizQuestions = newQuizQuestions.map((q, i) => ({
            type: q.type,
            prompt: q.stem,
            options: q.type === "short_answer" ? undefined : q.options,
            correctOptionIds: q.type === "short_answer" ? undefined : q.correctOptionIds,
            correctAnswer: q.type === "short_answer" ? q.correctAnswer : undefined,
            points: q.points,
            explanation: q.explanation || undefined,
            order: i,
          }));
        }
      }

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

  // ---------- Quiz question helpers ----------

  function createEmptyQuestion(): QuizQuestion {
    return {
      type: "single_choice",
      stem: "",
      options: [
        { id: "A", text: "" },
        { id: "B", text: "" },
        { id: "C", text: "" },
        { id: "D", text: "" },
      ],
      correctOptionIds: [],
      correctAnswer: "",
      points: 1,
      explanation: "",
    };
  }

  function addQuizQuestion() {
    setNewQuizQuestions((prev) => [...prev, createEmptyQuestion()]);
  }

  function removeQuizQuestion(idx: number) {
    setNewQuizQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateQuizQuestion(idx: number, updates: Partial<QuizQuestion>) {
    setNewQuizQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  }

  function updateQuizQuestionType(idx: number, type: QuizQuestionType) {
    setNewQuizQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[idx], type };
      if (type === "true_false") {
        q.options = [
          { id: "A", text: "正确" },
          { id: "B", text: "错误" },
        ];
        q.correctOptionIds = [];
      } else if (type === "short_answer") {
        q.options = [];
        q.correctOptionIds = [];
      } else {
        if (q.options.length === 0 || (q.options.length === 2 && q.options[0].text === "正确")) {
          q.options = [
            { id: "A", text: "" },
            { id: "B", text: "" },
            { id: "C", text: "" },
            { id: "D", text: "" },
          ];
        }
        q.correctOptionIds = [];
      }
      next[idx] = q;
      return next;
    });
  }

  function updateQuizOptionText(qIdx: number, optIdx: number, text: string) {
    setNewQuizQuestions((prev) => {
      const next = [...prev];
      const opts = [...next[qIdx].options];
      opts[optIdx] = { ...opts[optIdx], text };
      next[qIdx] = { ...next[qIdx], options: opts };
      return next;
    });
  }

  async function handlePDFImport(file: File) {
    if (!course || !addDialogContext) return;
    setImportingPDF(true);
    try {
      // Step 1: Create a temporary task to hold the quiz
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "quiz",
          taskName: newTaskName.trim() || "PDF导入测验",
          quizConfig: {
            mode: newQuizMode,
            timeLimitMinutes: newTimeLimitMinutes ? parseInt(newTimeLimitMinutes) : undefined,
            showCorrectAnswer: newShowCorrectAnswer,
          },
        }),
      });
      const taskJson = await taskRes.json();
      if (!taskJson.success) {
        toast.error(taskJson.error?.message || "创建任务失败");
        return;
      }
      const taskId = taskJson.data.id;

      // Step 2: Upload PDF
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", taskId);
      const uploadRes = await fetch("/api/import-jobs", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success) {
        toast.error(uploadJson.error?.message || "上传失败");
        return;
      }
      const jobId = uploadJson.data.id;

      // Step 3: Poll for completion
      toast.info("PDF 正在解析中...");
      let attempts = 0;
      const maxAttempts = 30;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(`/api/import-jobs/${jobId}`);
        const pollJson = await pollRes.json();
        if (!pollJson.success) break;
        const status = pollJson.data.status;
        if (status === "completed") {
          // Fetch the created questions
          const qRes = await fetch(`/api/tasks/${taskId}`);
          const qJson = await qRes.json();
          if (qJson.success && qJson.data.questions) {
            const imported: QuizQuestion[] = qJson.data.questions.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (q: any) => ({
                type: q.type || "single_choice",
                stem: q.prompt || q.stem || "",
                options: q.options || [],
                correctOptionIds: q.correctOptionIds || [],
                correctAnswer: q.correctAnswer || "",
                points: q.points || 1,
                explanation: q.explanation || "",
              })
            );
            setNewQuizQuestions((prev) => [...prev, ...imported]);
            toast.success(`成功导入 ${imported.length} 道题目`);
          }
          break;
        }
        if (status === "failed") {
          toast.error("PDF 解析失败: " + (pollJson.data.error || "未知错误"));
          break;
        }
        attempts++;
      }
      if (attempts >= maxAttempts) {
        toast.error("PDF 解析超时，请稍后查看");
      }
    } catch {
      toast.error("PDF 导入失败");
    } finally {
      setImportingPDF(false);
    }
  }

  async function handleAIGenerateQuestions() {
    if (!newTaskName.trim()) {
      toast.error("请先输入任务名称，AI 将根据名称生成题目");
      return;
    }
    setImportingPDF(true);
    try {
      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "quiz",
          taskName: newTaskName.trim(),
          quizConfig: {
            mode: newQuizMode,
            timeLimitMinutes: newTimeLimitMinutes ? parseInt(newTimeLimitMinutes) : undefined,
            showCorrectAnswer: newShowCorrectAnswer,
          },
        }),
      });
      const taskJson = await taskRes.json();
      if (!taskJson.success) {
        toast.error(taskJson.error?.message || "创建任务失败");
        return;
      }
      const taskId = taskJson.data.id;

      // Trigger AI generation
      const genRes = await fetch(`/api/tasks/${taskId}/generate-questions`, {
        method: "POST",
      });
      const genJson = await genRes.json();
      if (genJson.success && genJson.data?.questions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generated: QuizQuestion[] = genJson.data.questions.map((q: any) => ({
          type: q.type || "single_choice",
          stem: q.prompt || q.stem || "",
          options: q.options || [],
          correctOptionIds: q.correctOptionIds || [],
          correctAnswer: q.correctAnswer || "",
          points: q.points || 1,
          explanation: q.explanation || "",
        }));
        setNewQuizQuestions((prev) => [...prev, ...generated]);
        toast.success(`AI 生成了 ${generated.length} 道题目`);
      } else {
        toast.error(genJson.error?.message || "AI 生成失败");
      }
    } catch {
      toast.error("AI 生成失败");
    } finally {
      setImportingPDF(false);
    }
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

  function toggleChapter(chapterId: string) {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
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
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-blue-100/50 p-6 dark:from-blue-950/30 dark:to-blue-900/20">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
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
              {/* Multi-class badges */}
              {courseClasses.map((cc) => (
                <Badge key={cc.id} variant="secondary" className="flex items-center gap-1">
                  <Users className="size-3" />
                  {cc.class.name}
                  <button
                    onClick={() => handleRemoveClass(cc.classId)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))}
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-muted text-muted-foreground"
                onClick={() => { setAddClassDialogOpen(true); fetchAvailableClasses(); }}
              >
                <Plus className="size-3 mr-0.5" /> 添加班级
              </Badge>

              <span className="text-muted-foreground">·</span>

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
            {/* Collaborative teachers */}
            {courseTeachers.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">协作教师：</span>
                {courseTeachers.map((ct) => (
                  <Badge key={ct.id} variant="outline" className="flex items-center gap-1 text-xs">
                    {ct.teacher.name}
                    <button
                      onClick={() => handleRemoveTeacher(ct.teacherId)}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="size-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTeacherDialogOpen(true)}>
            <Users className="size-4 mr-1" />
            添加协作教师
          </Button>
          <Button
            variant="outline"
            onClick={() => setChapterDialogOpen(true)}
          >
            <Plus className="size-4 mr-1" />
            添加章节
          </Button>
        </div>
      </div>
      </div>

      {/* Tabs Workbench */}
      <Tabs defaultValue="structure" className="w-full">
        <TabsList>
          <TabsTrigger value="structure">课程结构</TabsTrigger>
          <TabsTrigger value="analytics">数据分析</TabsTrigger>
          <TabsTrigger value="announcements">公告管理</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-6 mt-4">

      {/* Chapter jump navigation */}
      {course.chapters.length > 0 && (
        <Select onValueChange={(id) => document.getElementById(`chapter-${id}`)?.scrollIntoView({ behavior: "smooth" })}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="跳转到章节..." />
          </SelectTrigger>
          <SelectContent>
            {course.chapters.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>
                第{ch.order + 1}章：{ch.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
            <Card key={chapter.id} id={`chapter-${chapter.id}`}>
              <CardHeader className="cursor-pointer select-none" onClick={() => toggleChapter(chapter.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={cn("size-4 transition-transform", collapsedChapters.has(chapter.id) && "-rotate-90")} />
                    <CardTitle className="text-lg">
                      第 {chapter.order + 1} 章：{chapter.title}
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSectionChapterId(chapter.id);
                      setSectionDialogOpen(true);
                    }}
                  >
                    <Plus className="size-3 mr-1" />
                    添加小节
                  </Button>
                </div>
              </CardHeader>
              {!collapsedChapters.has(chapter.id) && <CardContent>
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
              </CardContent>}
            </Card>
          ))}
        </div>
      )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <CourseAnalyticsTab courseId={courseId} />
        </TabsContent>

        <TabsContent value="announcements" className="mt-4">
          <CourseAnnouncementsPanel courseId={courseId} />
        </TabsContent>
      </Tabs>

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

              {/* Quiz type - full inline config */}
              {newTaskType === "quiz" && (
                <>
                  <Separator />
                  <h3 className="text-sm font-semibold">测验配置</h3>

                  {/* Quiz mode */}
                  <div className="space-y-2">
                    <Label>测验模式</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={newQuizMode === "fixed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewQuizMode("fixed")}
                      >
                        固定题目
                      </Button>
                      <Button
                        variant={newQuizMode === "adaptive" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setNewQuizMode("adaptive")}
                      >
                        自适应
                      </Button>
                    </div>
                  </div>

                  {/* Time limit */}
                  <div className="space-y-2">
                    <Label>时间限制（分钟）</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="留空不限时"
                      value={newTimeLimitMinutes}
                      onChange={(e) => setNewTimeLimitMinutes(e.target.value)}
                    />
                  </div>

                  {/* Show correct answer */}
                  <div className="flex items-center justify-between">
                    <Label>提交后显示正确答案</Label>
                    <Switch
                      checked={newShowCorrectAnswer}
                      onCheckedChange={setNewShowCorrectAnswer}
                    />
                  </div>

                  <Separator />

                  {/* Question sources */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">题目来源</h3>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={importingPDF}
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = ".pdf";
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) handlePDFImport(file);
                          };
                          input.click();
                        }}
                      >
                        {importingPDF ? (
                          <Loader2 className="size-3 mr-1 animate-spin" />
                        ) : (
                          <Upload className="size-3 mr-1" />
                        )}
                        从 PDF 导入
                      </Button>
                      <Button variant="outline" size="sm" onClick={addQuizQuestion}>
                        <Plus className="size-3 mr-1" />
                        手动添加
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={importingPDF}
                        onClick={handleAIGenerateQuestions}
                      >
                        {importingPDF ? (
                          <Loader2 className="size-3 mr-1 animate-spin" />
                        ) : (
                          <Sparkles className="size-3 mr-1" />
                        )}
                        AI 出题
                      </Button>
                    </div>
                  </div>

                  {/* Question list editor */}
                  {newQuizQuestions.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">
                          题目列表（{newQuizQuestions.length} 题）
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          总分: {newQuizQuestions.reduce((s, q) => s + q.points, 0)}
                        </span>
                      </div>
                      {newQuizQuestions.map((q, qi) => (
                        <div key={qi} className="rounded-lg border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs">
                              第 {qi + 1} 题
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeQuizQuestion(qi)}
                              className="size-6 text-destructive"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>

                          <div className="grid gap-2 grid-cols-2">
                            <div>
                              <Label className="text-xs">题目类型</Label>
                              <Select
                                value={q.type}
                                onValueChange={(v) =>
                                  updateQuizQuestionType(qi, v as QuizQuestionType)
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    Object.entries(quizQuestionTypeLabels) as [
                                      QuizQuestionType,
                                      string,
                                    ][]
                                  ).map(([val, label]) => (
                                    <SelectItem key={val} value={val}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">分值</Label>
                              <Input
                                type="number"
                                min={1}
                                max={5}
                                value={q.points}
                                onChange={(e) =>
                                  updateQuizQuestion(qi, {
                                    points: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          {/* Question stem */}
                          <div>
                            <Label className="text-xs">题干</Label>
                            <Textarea
                              placeholder="请输入题目内容..."
                              value={q.stem}
                              onChange={(e) =>
                                updateQuizQuestion(qi, { stem: e.target.value })
                              }
                              rows={2}
                              className="text-sm"
                            />
                          </div>

                          {/* Options for choice/true_false */}
                          {(q.type === "single_choice" ||
                            q.type === "multiple_choice" ||
                            q.type === "true_false") && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">选项</Label>
                              {q.options.map((opt, oi) => (
                                <div key={oi} className="flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="size-6 flex items-center justify-center text-xs shrink-0"
                                  >
                                    {opt.id}
                                  </Badge>
                                  {q.type === "true_false" ? (
                                    <span className="text-sm">{opt.text}</span>
                                  ) : (
                                    <Input
                                      placeholder={`选项 ${opt.id}`}
                                      value={opt.text}
                                      onChange={(e) =>
                                        updateQuizOptionText(qi, oi, e.target.value)
                                      }
                                      className="h-8 text-xs flex-1"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Correct answer */}
                          <div>
                            <Label className="text-xs">正确答案</Label>
                            {q.type === "short_answer" ? (
                              <Input
                                placeholder="参考答案..."
                                value={q.correctAnswer}
                                onChange={(e) =>
                                  updateQuizQuestion(qi, {
                                    correctAnswer: e.target.value,
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            ) : q.type === "multiple_choice" ? (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {q.options.map((opt) => (
                                  <Button
                                    key={opt.id}
                                    variant={
                                      q.correctOptionIds.includes(opt.id)
                                        ? "default"
                                        : "outline"
                                    }
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => {
                                      const ids = q.correctOptionIds.includes(opt.id)
                                        ? q.correctOptionIds.filter(
                                            (id) => id !== opt.id
                                          )
                                        : [...q.correctOptionIds, opt.id];
                                      updateQuizQuestion(qi, {
                                        correctOptionIds: ids,
                                      });
                                    }}
                                  >
                                    {opt.id}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <Select
                                value={q.correctOptionIds[0] || ""}
                                onValueChange={(v) =>
                                  updateQuizQuestion(qi, {
                                    correctOptionIds: [v],
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="选择正确答案" />
                                </SelectTrigger>
                                <SelectContent>
                                  {q.options.map((opt) => (
                                    <SelectItem key={opt.id} value={opt.id}>
                                      {opt.id}: {opt.text || "..."}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          {/* Explanation */}
                          <div>
                            <Label className="text-xs">解析（选填）</Label>
                            <Textarea
                              placeholder="题目解析..."
                              value={q.explanation}
                              onChange={(e) =>
                                updateQuizQuestion(qi, {
                                  explanation: e.target.value,
                                })
                              }
                              rows={2}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      ))}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={addQuizQuestion}
                      >
                        <Plus className="size-3 mr-1" />
                        添加题目
                      </Button>
                    </div>
                  )}
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
                            {(taskPreview.scoringCriteria?.length ?? 0) > 0 && (
                              <div>
                                <span className="text-muted-foreground">评分标准：</span>
                                <ul className="ml-3 mt-0.5 space-y-0.5">
                                  {taskPreview.scoringCriteria?.map((c) => (
                                    <li key={c.id}>
                                      {c.name}（{c.maxPoints}分）
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(taskPreview.questions?.length ?? 0) > 0 && (
                              <p>
                                <span className="text-muted-foreground">题目数量：</span>
                                {taskPreview.questions?.length} 道
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

      {/* Add Class Dialog */}
      <Dialog open={addClassDialogOpen} onOpenChange={setAddClassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加班级</DialogTitle>
            <DialogDescription>
              选择要关联到此课程的班级
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={addClassId} onValueChange={setAddClassId}>
              <SelectTrigger>
                <SelectValue placeholder="选择班级" />
              </SelectTrigger>
              <SelectContent>
                {classesList
                  .filter((c) => !courseClasses.find((cc) => cc.classId === c.id))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClassDialogOpen(false)} disabled={addingClass}>
              取消
            </Button>
            <Button onClick={handleAddClass} disabled={addingClass || !addClassId}>
              {addingClass ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />添加中...</>
              ) : (
                "添加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Collaborative Teacher Dialog */}
      <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加协作教师</DialogTitle>
            <DialogDescription>
              输入教师邮箱，添加为课程协作教师。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="teacherEmail">教师邮箱 *</Label>
              <Input
                id="teacherEmail"
                type="email"
                placeholder="例如：teacher2@finsim.edu.cn"
                value={teacherEmail}
                onChange={(e) => setTeacherEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherDialogOpen(false)} disabled={addingTeacher}>
              取消
            </Button>
            <Button onClick={handleAddTeacher} disabled={addingTeacher}>
              {addingTeacher ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />添加中...</>
              ) : (
                "添加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
