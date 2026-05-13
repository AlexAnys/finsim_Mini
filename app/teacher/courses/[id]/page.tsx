"use client";

/**
 * PR-COURSE-1+2 · 教师课程编辑器（联合 PR）
 *
 * 重做范围：
 *
 * **C1 · 块编辑面板（5.2.1）** — 走方向 A：删除原右侧 BlockEditPanel 整列，
 *   把内容块管理 + 小节标题编辑 inline 化到课程结构中（点击小节名 inline 重命名；
 *   点击内容块行 inline 展开编辑器；同时只展开一个块）。结果：左 TOC + 中间结构
 *   两列布局，TOC 仅作为跳转锚点；编辑全部在结构里。
 *
 * **C2 · 任务向导整合（5.2.2）** — 删除 `/teacher/tasks/new` 整个路由，把 4 步
 *   向导整合到课程编辑器内部 modal（`TaskWizardModal`）。每个 slot 单元格右上角
 *   有 "+ 任务" 按钮触发；wizard 完成后自动 POST tasks → tasks-instances → publish
 *   流，回调 fetchCourse 刷新视图。
 *
 * 拆文件：
 * - `components/teacher-course-edit/inline-section-row.tsx` — 单小节行（含 3 slot）
 * - `components/teacher-course-edit/chapter-section-list.tsx` — 章节列表（含折叠）
 * - `components/teacher-course-edit/task-wizard-modal.tsx` — wizard modal 容器
 * - 既有 EditorHero / TocSidebar 不变（仍复用）
 * - 既有 BlockEditPanel 文件保留但不再被引用（见 build 报告 — 留作他途参考；如要
 *   彻底删请单独 PR 跑一遍 grep，避免本 PR 二次扩 scope）
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  CalendarDays,
  Pencil,
  Check,
  X,
  Upload,
  RotateCw,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseAnalyticsTab } from "@/components/course/course-analytics-tab";
import { CourseAnnouncementsPanel } from "@/components/course/course-announcements-panel";
import { CourseContextSourcesTab } from "@/components/course/course-context-sources-tab";
import { CourseInstancesTab } from "@/components/course/course-instances-tab";
import { CourseStudyBuddyAnalyticsTab } from "@/components/course/course-study-buddy-analytics-tab";
import { EditorHero } from "@/components/teacher-course-edit/editor-hero";
import { TocSidebar } from "@/components/teacher-course-edit/toc-sidebar";
import { ChapterSectionList } from "@/components/teacher-course-edit/chapter-section-list";
import {
  TaskWizardModal,
  type WizardModalContext,
} from "@/components/teacher-course-edit/task-wizard-modal";
import {
  buildTocTree,
  buildCourseCounts,
  semesterDateDisplay,
  type BlockType,
  type SlotType,
} from "@/lib/utils/course-editor-transforms";
import {
  isKnowledgeSourceProcessing,
  isKnowledgeSourceRetryable,
  knowledgeSourceStatusLabel,
  knowledgeSourceProgressPercent,
} from "@/lib/utils/knowledge-source-status";

// ---------- API types ----------

interface ApiTaskInstance {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  slot: string | null;
  createdAt: string;
}

interface ApiTaskBuildDraft {
  id: string;
  taskType: string;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  slot: string | null;
  sourceIds: string[];
  asyncJobId?: string | null;
  draftPayload?: unknown;
  asyncJob?: {
    id: string;
    type: string;
    status: string;
    progress: number;
    error: string | null;
  } | null;
  missingFields: string[];
  error: string | null;
  updatedAt?: string;
}

interface ApiContentBlock {
  id: string;
  blockType: string;
  slot: string;
  order: number;
  data: Record<string, unknown> | null;
}

interface ApiSection {
  id: string;
  title: string;
  order: number;
  contentBlocks: ApiContentBlock[];
  taskInstances: ApiTaskInstance[];
  taskBuildDrafts: ApiTaskBuildDraft[];
}

interface ApiChapter {
  id: string;
  title: string;
  order: number;
  sections: ApiSection[];
}

interface CourseOutlineSource {
  id: string;
  fileName: string;
  status: string;
  sourceType: string | null;
  summary: string | null;
  error: string | null;
  structuredData: unknown;
}

interface OutlineMergePreview {
  chaptersToAdd: Array<{ title: string; sectionCount: number }>;
  sectionsToAdd: Array<{ chapterTitle: string; title: string }>;
  protectedItems: Array<{ type: string; title: string; reason: string }>;
  notes: string[];
}

interface EditableOutlineSection {
  sectionId?: string;
  title: string;
  learningGoals: string[];
  knowledgeObjectives: string[];
  skillObjectives: string[];
  knowledgePoints: string[];
}

interface EditableOutlineChapter {
  chapterId?: string;
  title: string;
  learningGoals: string[];
  knowledgeObjectives: string[];
  skillObjectives: string[];
  knowledgePoints: string[];
  sections: EditableOutlineSection[];
}

interface EditableOutlineDraft {
  courseGoals: string[];
  knowledgeObjectives: string[];
  skillObjectives: string[];
  valueObjectives: string[];
  assessmentRequirements: string[];
  globalKnowledgePoints: string[];
  notes: string;
  chapters: EditableOutlineChapter[];
}

interface CourseDetail {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  semesterStartDate: string | null;
  class: { id: string; name: string };
  chapters: ApiChapter[];
}

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------- Hero auxiliary state ----------

  const [editingSemesterDate, setEditingSemesterDate] = useState(false);
  const [editSemesterDate, setEditSemesterDate] = useState("");
  const [savingSemesterDate, setSavingSemesterDate] = useState(false);
  const [outlineDialogOpen, setOutlineDialogOpen] = useState(false);
  const [outlineFile, setOutlineFile] = useState<File | null>(null);
  const [outlineTags, setOutlineTags] = useState("课程大纲,课程结构");
  const [outlineDialogSourceType, setOutlineDialogSourceType] = useState<
    "syllabus" | "question_bank"
  >("syllabus");
  const [uploadingOutline, setUploadingOutline] = useState(false);
  const [retryingSourceId, setRetryingSourceId] = useState<string | null>(null);

  // ---------- Chapter / Section dialogs ----------

  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [creatingChapter, setCreatingChapter] = useState(false);

  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionChapterId, setSectionChapterId] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);

  // ---------- Edit course / class / teacher dialogs ----------

  const [editCourseDialogOpen, setEditCourseDialogOpen] = useState(false);
  const [editCourseTitle, setEditCourseTitle] = useState("");
  const [editCourseDescription, setEditCourseDescription] = useState("");
  const [courseOutlineSources, setCourseOutlineSources] = useState<CourseOutlineSource[]>([]);
  const [outlineActiveSourceId, setOutlineActiveSourceId] = useState<string | null>(null);
  const [outlineDraftEditors, setOutlineDraftEditors] = useState<Record<string, EditableOutlineDraft>>({});
  const [outlineMergePreview, setOutlineMergePreview] = useState<OutlineMergePreview | null>(null);
  const [outlineMergePreviewSourceId, setOutlineMergePreviewSourceId] = useState<string | null>(null);
  const [outlinePreviewingSourceId, setOutlinePreviewingSourceId] = useState<string | null>(null);
  const [outlineApplyingSourceId, setOutlineApplyingSourceId] = useState<string | null>(null);
  const [outlineSavingSourceId, setOutlineSavingSourceId] = useState<string | null>(null);
  const [outlineReplacingSourceId, setOutlineReplacingSourceId] = useState<string | null>(null);
  const [savingEditCourse, setSavingEditCourse] = useState(false);

  const [courseClasses, setCourseClasses] = useState<
    { id: string; classId: string; class: { id: string; name: string } }[]
  >([]);
  const [addClassDialogOpen, setAddClassDialogOpen] = useState(false);
  const [addClassId, setAddClassId] = useState("");
  const [addingClass, setAddingClass] = useState(false);
  const [classesList, setClassesList] = useState<
    { id: string; name: string }[]
  >([]);

  const [courseTeachers, setCourseTeachers] = useState<
    {
      id: string;
      teacherId: string;
      teacher: { id: string; name: string; email: string };
    }[]
  >([]);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [addingTeacher, setAddingTeacher] = useState(false);

  // ---------- Inline UI state ----------

  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(
    new Set(),
  );
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  // ---------- Wizard modal state ----------

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardContext, setWizardContext] =
    useState<WizardModalContext | null>(null);
  const [wizardDraft, setWizardDraft] = useState<ApiTaskBuildDraft | null>(null);

  // ---------- Fetchers ----------

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

  // ---------- Class handlers ----------

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

  // ---------- Teacher handlers ----------

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

  // ---------- Course meta handlers ----------

  function openEditCourseDialog() {
    if (!course) return;
    setEditCourseTitle(course.courseTitle);
    setEditCourseDescription(course.description ?? "");
    setOutlineActiveSourceId(null);
    setOutlineDraftEditors({});
    setOutlineMergePreview(null);
    setOutlineMergePreviewSourceId(null);
    setEditCourseDialogOpen(true);
    fetchCourseOutlineSources();
  }

  const fetchCourseOutlineSources = useCallback(async () => {
    try {
      const params = new URLSearchParams({ courseId, sourceType: "syllabus" });
      const res = await fetch(`/api/lms/course-knowledge-sources?${params}`);
      const json = await res.json();
      if (json.success) setCourseOutlineSources(json.data || []);
    } catch {
      // 课程编辑不因大纲素材加载失败而阻塞。
    }
  }, [courseId]);

  useEffect(() => {
    if (!editCourseDialogOpen) return;
    const hasProcessing = courseOutlineSources.some((source) =>
      isKnowledgeSourceProcessing(source.status),
    );
    if (!hasProcessing) return;
    const timer = window.setInterval(() => {
      fetchCourseOutlineSources();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [editCourseDialogOpen, courseOutlineSources, fetchCourseOutlineSources]);

  function openOutlineEditor(source: CourseOutlineSource) {
    const nextSourceId = outlineActiveSourceId === source.id ? null : source.id;
    setOutlineActiveSourceId(nextSourceId);
    if (nextSourceId) {
      setOutlineDraftEditors((prev) => {
        if (prev[source.id]) return prev;
        const draft = normalizeOutlineDraft(source.structuredData);
        return draft ? { ...prev, [source.id]: draft } : prev;
      });
    }
    if (outlineMergePreviewSourceId !== nextSourceId) {
      setOutlineMergePreview(null);
      setOutlineMergePreviewSourceId(null);
    }
  }

  function updateOutlineEditor(sourceId: string, draft: EditableOutlineDraft) {
    setOutlineDraftEditors((prev) => ({ ...prev, [sourceId]: draft }));
    if (outlineMergePreviewSourceId === sourceId) {
      setOutlineMergePreview(null);
      setOutlineMergePreviewSourceId(null);
    }
  }

  function outlineForSource(source: CourseOutlineSource) {
    return outlineDraftEditors[source.id] || normalizeOutlineDraft(source.structuredData);
  }

  async function handleOutlineMergePreview(sourceId: string, outlineOverride?: EditableOutlineDraft | null) {
    setOutlinePreviewingSourceId(sourceId);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/outline-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, mode: "preview", outline: outlineOverride || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "生成目录差异失败");
        return;
      }
      setOutlineActiveSourceId(sourceId);
      setOutlineMergePreview(json.data.preview);
      setOutlineMergePreviewSourceId(sourceId);
      toast.success("已生成安全合并预览");
    } catch {
      toast.error("生成目录差异失败");
    } finally {
      setOutlinePreviewingSourceId(null);
    }
  }

  async function handleOutlineSafeMerge(sourceId: string, outlineOverride?: EditableOutlineDraft | null) {
    setOutlineApplyingSourceId(sourceId);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/outline-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, mode: "apply", outline: outlineOverride || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "安全合并失败");
        return;
      }
      setOutlineActiveSourceId(sourceId);
      setOutlineMergePreview(json.data.applied?.preview || null);
      setOutlineMergePreviewSourceId(sourceId);
      const createdChapters = json.data.applied?.createdChapters?.length || 0;
      const createdSections = json.data.applied?.createdSections?.length || 0;
      toast.success(`已安全合并：新增 ${createdChapters} 章、${createdSections} 节`);
      fetchCourse();
      fetchCourseOutlineSources();
    } catch {
      toast.error("安全合并失败");
    } finally {
      setOutlineApplyingSourceId(null);
    }
  }

  async function handleOutlineSaveDraft(sourceId: string, outlineOverride: EditableOutlineDraft) {
    setOutlineSavingSourceId(sourceId);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/outline-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, mode: "save-draft", outline: outlineOverride }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存草稿失败");
        return;
      }
      setOutlineActiveSourceId(sourceId);
      setOutlineMergePreview(json.data.preview || null);
      setOutlineMergePreviewSourceId(sourceId);
      const normalized = normalizeOutlineDraft(json.data.outline);
      if (normalized) {
        setOutlineDraftEditors((prev) => ({ ...prev, [sourceId]: normalized }));
      }
      toast.success("草稿已保存");
      fetchCourseOutlineSources();
    } catch {
      toast.error("保存草稿失败");
    } finally {
      setOutlineSavingSourceId(null);
    }
  }

  async function handleOutlineReplace(sourceId: string, outlineOverride: EditableOutlineDraft) {
    if (!window.confirm("替换模式会按当前草稿覆盖章节顺序、标题和层级。有任务的章节/小节会被保护。确定继续吗？")) {
      return;
    }
    setOutlineReplacingSourceId(sourceId);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/outline-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, mode: "replace", outline: outlineOverride }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "应用替换失败");
        return;
      }
      setOutlineActiveSourceId(sourceId);
      setOutlineMergePreview(json.data.applied?.preview || null);
      setOutlineMergePreviewSourceId(sourceId);
      const normalized = normalizeOutlineDraft(json.data.outline);
      if (normalized) {
        setOutlineDraftEditors((prev) => ({ ...prev, [sourceId]: normalized }));
      }
      const created = json.data.applied?.createdChapters?.length || 0;
      const updated = json.data.applied?.updatedChapters?.length || 0;
      const deleted = json.data.applied?.deletedChapters?.length || 0;
      toast.success(`已替换应用：新增 ${created} / 更新 ${updated} / 删除 ${deleted} 章`);
      fetchCourse();
      fetchCourseOutlineSources();
    } catch {
      toast.error("应用替换失败");
    } finally {
      setOutlineReplacingSourceId(null);
    }
  }

  async function handleEditCourseSave() {
    if (!course) return;
    if (!editCourseTitle.trim()) {
      toast.error("课程名称不能为空");
      return;
    }
    setSavingEditCourse(true);
    try {
      const res = await fetch(`/api/lms/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: editCourseTitle.trim(),
          description: editCourseDescription.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("课程已更新");
      setEditCourseDialogOpen(false);
      fetchCourse();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSavingEditCourse(false);
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

  // ---------- Chapter / Section creation ----------

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
        fetchCourse();
      } else {
        toast.error(json.error?.message || "创建章节失败");
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
        fetchCourse();
      } else {
        toast.error(json.error?.message || "创建小节失败");
      }
    } finally {
      setCreatingSection(false);
    }
  }

  function toggleChapter(chapterId: string) {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  // ---------- Section / Block / Task handlers used by InlineSectionRow ----------

  const handleRenameSection = useCallback(
    async (sectionId: string, newTitle: string) => {
      try {
        const res = await fetch(`/api/lms/sections/${sectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "重命名失败");
          return;
        }
        toast.success("已重命名");
        await fetchCourse();
      } catch {
        toast.error("网络错误，请稍后重试");
      }
    },
    [fetchCourse],
  );

  const handleDeleteSection = useCallback(
    async (sectionId: string) => {
      try {
        const res = await fetch(`/api/lms/sections/${sectionId}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "删除失败");
          return;
        }
        toast.success("已删除小节");
        if (activeSectionId === sectionId) setActiveSectionId(null);
        setExpandedBlockId(null);
        await fetchCourse();
      } catch {
        toast.error("网络错误，请稍后重试");
      }
    },
    [fetchCourse, activeSectionId],
  );

  const handleAddTask = useCallback(
    (chapterId: string, sectionId: string, slot: SlotType) => {
      if (!course) return;
      const ch = course.chapters.find((c) => c.id === chapterId);
      const sec = ch?.sections.find((s) => s.id === sectionId);
      setWizardDraft(null);
      setWizardContext({
        courseId: course.id,
        classId: course.class.id,
        chapterId,
        sectionId,
        slot,
        chapterTitle: ch?.title,
        sectionTitle: sec?.title,
      });
      setWizardOpen(true);
    },
    [course],
  );

  const handleOpenDraft = useCallback(
    (
      draft: ApiTaskBuildDraft,
      chapterId: string,
      sectionId: string,
      slot: SlotType,
    ) => {
      if (!course) return;
      const ch = course.chapters.find((c) => c.id === chapterId);
      const sec = ch?.sections.find((s) => s.id === sectionId);
      setWizardDraft(draft);
      setWizardContext({
        courseId: course.id,
        classId: course.class.id,
        chapterId,
        sectionId,
        slot,
        chapterTitle: ch?.title,
        sectionTitle: sec?.title,
      });
      setWizardOpen(true);
    },
    [course],
  );

  const handleDeleteDraft = useCallback(
    async (draft: ApiTaskBuildDraft) => {
      if (!window.confirm(`确认删除草稿「${draft.title}」？已发布任务和学生提交不会受影响。`)) {
        return;
      }
      try {
        const res = await fetch(`/api/lms/task-build-drafts/${draft.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "删除草稿失败");
          return;
        }
        if (wizardDraft?.id === draft.id) {
          setWizardOpen(false);
          setWizardDraft(null);
        }
        toast.success("草稿已删除");
        await fetchCourse();
      } catch {
        toast.error("网络错误，请稍后重试");
      }
    },
    [fetchCourse, wizardDraft?.id],
  );

  const handleRetryDraftJob = useCallback(
    async (draft: ApiTaskBuildDraft) => {
      if (!draft.asyncJobId) {
        toast.error("这个草稿没有可重试的异步任务");
        return;
      }
      try {
        const res = await fetch(`/api/async-jobs/${draft.asyncJobId}/retry`, {
          method: "POST",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "重试失败");
          return;
        }
        toast.success("已重新排队处理");
        await fetchCourse();
      } catch {
        toast.error("网络错误，请稍后重试");
      }
    },
    [fetchCourse],
  );

  async function handleUploadOutline() {
    if (!outlineFile) {
      toast.error(
        outlineDialogSourceType === "question_bank"
          ? "请选择题库文件"
          : "请选择课程大纲或课程内容文件",
      );
      return;
    }
    setUploadingOutline(true);
    try {
      const formData = new FormData();
      formData.append("file", outlineFile);
      formData.append("tags", outlineTags);
      let endpoint = `/api/lms/courses/${courseId}/outline-import`;
      if (outlineDialogSourceType === "question_bank") {
        formData.append("courseId", courseId);
        formData.append("sourceType", "question_bank");
        endpoint = "/api/lms/course-knowledge-sources";
      }
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(
          json.error?.message ||
            (outlineDialogSourceType === "question_bank"
              ? "上传题库失败"
              : "上传课程大纲失败"),
        );
        return;
      }
      toast.success(
        outlineDialogSourceType === "question_bank"
          ? "题库已上传，正在异步识别与解析（可在「教学上下文」Tab 查看）"
          : "课程大纲已上传，正在异步识别与解析",
      );
      setOutlineDialogOpen(false);
      setOutlineFile(null);
      fetchCourseOutlineSources();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setUploadingOutline(false);
    }
  }

  async function handleRetryKnowledgeSource(sourceId: string) {
    setRetryingSourceId(sourceId);
    try {
      const res = await fetch(
        `/api/lms/course-knowledge-sources/${sourceId}/retry`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "重新解析失败");
        return;
      }
      toast.success("已重新排队 AI 解析");
      fetchCourseOutlineSources();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setRetryingSourceId(null);
    }
  }

  const handleCreateBlock = useCallback(
    async (
      chapterId: string,
      sectionId: string,
      slot: SlotType,
      blockType: BlockType,
    ) => {
      try {
        const res = await fetch("/api/lms/content-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            chapterId,
            sectionId,
            slot,
            blockType,
          }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "创建失败");
          return;
        }
        toast.success("已创建内容块");
        await fetchCourse();
      } catch {
        toast.error("网络错误，请稍后重试");
      }
    },
    [courseId, fetchCourse],
  );

  const handleUpdateBlock = useCallback(
    async (blockId: string, payload: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/lms/content-blocks/${blockId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "保存失败");
          return;
        }
        toast.success("已保存");
        await fetchCourse();
      } catch {
        toast.error("网络错误，请稍后重试");
      }
    },
    [fetchCourse],
  );

  const handleDeleteBlock = useCallback(
    async (blockId: string) => {
      try {
        const res = await fetch(`/api/lms/content-blocks/${blockId}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message || "删除失败");
          return;
        }
        toast.success("已删除");
        if (expandedBlockId === blockId) setExpandedBlockId(null);
        await fetchCourse();
      } catch {
        toast.error("网络错误，请稍后重试");
      }
    },
    [fetchCourse, expandedBlockId],
  );

  // ---------- Memoized derived state ----------

  const tocTree = useMemo(
    () => (course ? buildTocTree(course.chapters) : []),
    [course],
  );

  const counts = useMemo(
    () =>
      course
        ? buildCourseCounts(course.chapters)
        : {
            chapterCount: 0,
            sectionCount: 0,
            totalTasks: 0,
            publishedTasks: 0,
            draftTasks: 0,
          },
    [course],
  );

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
      <EditorHero
        courseTitle={course.courseTitle}
        courseCode={course.courseCode}
        description={course.description}
        primaryClassId={course.class.id}
        courseClasses={courseClasses}
        fallbackClassName={course.class.name ?? null}
        teachers={courseTeachers.map((ct) => ({
          id: ct.id,
          teacherId: ct.teacherId,
          teacher: ct.teacher,
        }))}
        semesterStartIso={course.semesterStartDate}
        counts={counts}
        onAddChapter={() => setChapterDialogOpen(true)}
        onAddTeacher={() => setTeacherDialogOpen(true)}
        onEditCourse={openEditCourseDialog}
        onUploadSyllabus={() => setOutlineDialogOpen(true)}
        onAddClass={() => {
          setAddClassDialogOpen(true);
          fetchAvailableClasses();
        }}
        onEditSemester={() => {
          setEditSemesterDate(course.semesterStartDate?.slice(0, 10) ?? "");
          setEditingSemesterDate(true);
        }}
        onRemoveClass={handleRemoveClass}
        onRemoveTeacher={handleRemoveTeacher}
        semesterBadge={
          editingSemesterDate ? (
            <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-[3px] text-[11px] text-white/90">
              <Input
                type="date"
                value={editSemesterDate}
                onChange={(e) => setEditSemesterDate(e.target.value)}
                className="h-6 w-36 bg-white/10 border-white/20 text-white text-[11px]"
              />
              <button
                type="button"
                onClick={handleSaveSemesterDate}
                disabled={savingSemesterDate}
                className="text-white/80 hover:text-white"
                aria-label="保存学期日期"
              >
                {savingSemesterDate ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setEditingSemesterDate(false)}
                className="text-white/80 hover:text-white"
                aria-label="取消"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditSemesterDate(
                  course.semesterStartDate?.slice(0, 10) ?? "",
                );
                setEditingSemesterDate(true);
              }}
              className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-[3px] text-[11px] text-white/90 hover:bg-white/15"
              aria-label="设置学期开始日期"
            >
              <CalendarDays className="size-3" />
              {course.semesterStartDate
                ? `学期始 ${semesterDateDisplay(course.semesterStartDate)}`
                : "设置学期开始日期"}
              <Pencil className="size-[9px] opacity-70" />
            </button>
          )
        }
      />

      {/* C1 layout: 2-column. Right edit panel removed; content edits inline. */}
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <TocSidebar
          chapters={tocTree}
          collapsedChapterIds={collapsedChapters}
          activeChapterId={null}
          activeSectionId={activeSectionId}
          onToggleChapter={toggleChapter}
          onJumpChapter={(id) => {
            setActiveSectionId(null);
            document
              .getElementById(`chapter-${id}`)
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          onJumpSection={(id) => {
            setActiveSectionId(id);
            document
              .getElementById(`section-${id}`)
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        <div className="min-w-0">
          <Tabs defaultValue="structure" className="w-full">
            <TabsList>
              <TabsTrigger value="structure">课程结构</TabsTrigger>
              <TabsTrigger value="instances">任务实例</TabsTrigger>
              <TabsTrigger value="contexts">教学上下文</TabsTrigger>
              <TabsTrigger value="studybuddy">Study Buddy 统计</TabsTrigger>
              <TabsTrigger value="analytics">数据分析</TabsTrigger>
              <TabsTrigger value="announcements">公告管理</TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="mt-4 space-y-4">
              {course.chapters.length > 0 && (
                <Select
                  onValueChange={(id) =>
                    document
                      .getElementById(`chapter-${id}`)
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
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

              {course.chapters.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-full bg-paper-alt flex items-center justify-center mb-4">
                      <BookOpen className="h-6 w-6 text-ink-4" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">暂无章节</h3>
                    <p className="text-sm text-ink-4 max-w-sm">
                      点击 Hero 区右上「添加章节」按钮开始
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <ChapterSectionList
                  chapters={course.chapters}
                  collapsedChapterIds={collapsedChapters}
                  expandedBlockId={expandedBlockId}
                  onToggleChapter={toggleChapter}
                  onToggleBlockExpand={setExpandedBlockId}
                  onAddSection={(chapterId) => {
                    setSectionChapterId(chapterId);
                    setSectionDialogOpen(true);
                  }}
                  onRenameSection={handleRenameSection}
                  onDeleteSection={handleDeleteSection}
                  onAddTask={handleAddTask}
                  onOpenDraft={handleOpenDraft}
                  onDeleteDraft={handleDeleteDraft}
                  onRetryDraftJob={handleRetryDraftJob}
                  onCreateBlock={handleCreateBlock}
                  onUpdateBlock={handleUpdateBlock}
                  onDeleteBlock={handleDeleteBlock}
                />
              )}
            </TabsContent>

            <TabsContent value="instances" className="mt-4">
              <CourseInstancesTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="contexts" className="mt-4">
              <CourseContextSourcesTab
                courseId={courseId}
                courseTitle={course.courseTitle}
                chapters={course.chapters}
              />
            </TabsContent>

            <TabsContent value="studybuddy" className="mt-4">
              <CourseStudyBuddyAnalyticsTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <CourseAnalyticsTab courseId={courseId} />
            </TabsContent>

            <TabsContent value="announcements" className="mt-4">
              <CourseAnnouncementsPanel courseId={courseId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

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
            <DialogDescription>为选定章节添加新的小节。</DialogDescription>
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

      {/* Add Class Dialog */}
      <Dialog open={addClassDialogOpen} onOpenChange={setAddClassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加班级</DialogTitle>
            <DialogDescription>选择要关联到此课程的班级</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={addClassId} onValueChange={setAddClassId}>
              <SelectTrigger>
                <SelectValue placeholder="选择班级" />
              </SelectTrigger>
              <SelectContent>
                {classesList
                  .filter(
                    (c) => !courseClasses.find((cc) => cc.classId === c.id),
                  )
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddClassDialogOpen(false)}
              disabled={addingClass}
            >
              取消
            </Button>
            <Button
              onClick={handleAddClass}
              disabled={addingClass || !addClassId}
            >
              {addingClass ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  添加中...
                </>
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
            <Button
              variant="outline"
              onClick={() => setTeacherDialogOpen(false)}
              disabled={addingTeacher}
            >
              取消
            </Button>
            <Button onClick={handleAddTeacher} disabled={addingTeacher}>
              {addingTeacher ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  添加中...
                </>
              ) : (
                "添加"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Course Dialog */}
      <Dialog
        open={editCourseDialogOpen}
        onOpenChange={setEditCourseDialogOpen}
      >
        <DialogContent className="flex max-h-[92vh] w-[min(1120px,calc(100vw-2rem))] max-w-none flex-col overflow-hidden p-0 sm:max-w-[1120px]">
          <DialogHeader>
            <div className="border-b border-line px-6 py-5">
              <DialogTitle>编辑课程</DialogTitle>
              <DialogDescription className="mt-1">
              修改课程名称与描述，并查看 AI 从课程大纲、Excel 标准或整体课程内容中识别出的目录与目标草稿。
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCourseTitle">课程名称 *</Label>
              <Input
                id="editCourseTitle"
                value={editCourseTitle}
                onChange={(e) => setEditCourseTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCourseDescription">课程描述</Label>
              <Textarea
                id="editCourseDescription"
                value={editCourseDescription}
                onChange={(e) => setEditCourseDescription(e.target.value)}
                rows={4}
              />
            </div>
            <div className="rounded-lg border border-line bg-paper-alt p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">AI 解析大纲管理</div>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                    上传的课程大纲、课程标准和 Excel 编码表会被识别为课程级上下文。可先查看结构化结果，再用安全合并把缺失章节/小节同步到课程目录。题库文件请走「上传题库」入口，避免被走 AI 大纲解析浪费时间。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOutlineDialogSourceType("syllabus");
                      setOutlineTags("课程大纲,课程结构");
                      setEditCourseDialogOpen(false);
                      setOutlineDialogOpen(true);
                    }}
                  >
                    <Upload className="mr-1.5 size-3.5" />
                    上传大纲
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOutlineDialogSourceType("question_bank");
                      setOutlineTags("课程题库");
                      setEditCourseDialogOpen(false);
                      setOutlineDialogOpen(true);
                    }}
                  >
                    <FileSpreadsheet className="mr-1.5 size-3.5" />
                    上传题库
                  </Button>
                </div>
              </div>
              {courseOutlineSources.length === 0 ? (
                <p className="mt-3 rounded-md border border-dashed border-line bg-surface px-3 py-3 text-xs text-muted-foreground">
                  还没有课程级大纲素材。可以先上传课程标准、教学大纲或 Excel 编码表。
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {courseOutlineSources.slice(0, 5).map((source) => {
                    const draft = outlineForSource(source);
                    const hasOutline = Boolean(draft && draft.chapters.length > 0);
                    return (
                    <div key={source.id} className="rounded-md border border-line bg-surface px-3 py-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink">{source.fileName}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10.5px] ${
                                source.status === "ready"
                                  ? "bg-brand-soft text-brand"
                                  : isKnowledgeSourceProcessing(source.status)
                                    ? "bg-paper-alt text-ink-4"
                                    : "bg-warn-soft text-warn"
                              }`}
                            >
                              {knowledgeSourceStatusLabel(source.status)}
                            </span>
                            {hasOutline && (
                              <span className="rounded bg-paper-alt px-1.5 py-0.5 text-[10.5px] text-ink-4">
                                AI 目录 · {draft?.chapters.length || 0} 章
                              </span>
                            )}
                          </div>
                          {isKnowledgeSourceProcessing(source.status) && (
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper-alt">
                              <div
                                className="h-full bg-brand transition-all"
                                style={{
                                  width: `${knowledgeSourceProgressPercent(source.status)}%`,
                                }}
                              />
                            </div>
                          )}
                          {source.summary && (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {source.summary}
                            </p>
                          )}
                          {source.error && isKnowledgeSourceRetryable(source.status) && (
                            <p className="mt-1 text-[11px] text-warn">{source.error}</p>
                          )}
                          {outlineObjectiveSummary(source.structuredData) && (
                            <p className="mt-1 text-[11px] leading-relaxed text-ink-4">
                              {outlineObjectiveSummary(source.structuredData)}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          {isKnowledgeSourceRetryable(source.status) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={retryingSourceId === source.id}
                              onClick={() => handleRetryKnowledgeSource(source.id)}
                            >
                              {retryingSourceId === source.id ? (
                                <Loader2 className="mr-1.5 size-3 animate-spin" />
                              ) : (
                                <RotateCw className="mr-1.5 size-3" />
                              )}
                              重新 AI 解析
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!hasOutline}
                            onClick={() => openOutlineEditor(source)}
                          >
                            编辑目录草稿
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              !hasOutline ||
                              outlinePreviewingSourceId === source.id
                            }
                            onClick={() => handleOutlineMergePreview(source.id, draft)}
                          >
                            {outlinePreviewingSourceId === source.id ? (
                              <Loader2 className="mr-1.5 size-3 animate-spin" />
                            ) : null}
                            预览合并
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              !hasOutline ||
                              outlineApplyingSourceId === source.id
                            }
                            onClick={() => handleOutlineSafeMerge(source.id, draft)}
                          >
                            {outlineApplyingSourceId === source.id ? (
                              <Loader2 className="mr-1.5 size-3 animate-spin" />
                            ) : null}
                            安全合并
                          </Button>
                        </div>
                      </div>
                      {outlineActiveSourceId === source.id && (
                        <div className="mt-3 space-y-3 rounded-md border border-line bg-paper px-3 py-3">
                          {draft ? (
                            <OutlineEditableDraft
                              draft={draft}
                              currentChapters={course?.chapters || []}
                              preview={outlineMergePreviewSourceId === source.id ? outlineMergePreview : null}
                              isPreviewing={outlinePreviewingSourceId === source.id}
                              isApplying={outlineApplyingSourceId === source.id}
                              isSaving={outlineSavingSourceId === source.id}
                              isReplacing={outlineReplacingSourceId === source.id}
                              onChange={(nextDraft) => updateOutlineEditor(source.id, nextDraft)}
                              onPreview={() => handleOutlineMergePreview(source.id, draft)}
                              onApply={() => handleOutlineSafeMerge(source.id, draft)}
                              onSaveDraft={() => handleOutlineSaveDraft(source.id, draft)}
                              onReplace={() => handleOutlineReplace(source.id, draft)}
                            />
                          ) : (
                            <OutlineDraftDetails value={source.structuredData} />
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground">
                    素材删除、原文查看和标签管理在“教学上下文”Tab 中进行；安全合并不会删除已有任务或提交。
                  </p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 border-t border-line bg-background px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setEditCourseDialogOpen(false)}
              disabled={savingEditCourse}
            >
              取消
            </Button>
            <Button
              onClick={handleEditCourseSave}
              disabled={savingEditCourse}
            >
              {savingEditCourse ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Course Outline Dialog */}
      <Dialog open={outlineDialogOpen} onOpenChange={setOutlineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {outlineDialogSourceType === "question_bank"
                ? "上传课程题库"
                : "上传课程大纲 / 课程内容"}
            </DialogTitle>
            <DialogDescription>
              {outlineDialogSourceType === "question_bank"
                ? "题库文件不会被走 AI 大纲解析；regex 可直接识别的题目会作为题库素材保存到「教学上下文」Tab。"
                : "文件会保存为课程级上下文。AI 只生成目录草稿和知识点建议，教师确认后再调整课程结构。"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-dashed border-line bg-paper-alt/50 p-4">
              <Label htmlFor="outlineFile" className="mb-2 block">
                {outlineDialogSourceType === "question_bank" ? "题库文件" : "课程文件"}
              </Label>
              <Input
                id="outlineFile"
                type="file"
                accept=".pdf,.docx,.txt,.md,.zip,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                onChange={(event) => setOutlineFile(event.target.files?.[0] ?? null)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {outlineDialogSourceType === "question_bank"
                  ? "支持 PDF、DOCX、TXT/MD、XLS/XLSX/CSV、ZIP。题库直抽 regex 路径不变。"
                  : "支持 PDF、DOCX、TXT/MD、图片、ZIP、XLS/XLSX/CSV。扫描件会进入 OCR 流程。"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="outlineTags">素材标签</Label>
              <Input
                id="outlineTags"
                value={outlineTags}
                onChange={(event) => setOutlineTags(event.target.value)}
                placeholder={
                  outlineDialogSourceType === "question_bank"
                    ? "例如：课程题库,期末"
                    : "例如：课程大纲,知识点,期末复习"
                }
              />
              <p className="text-xs text-muted-foreground">
                用英文逗号分隔，后续 AI 出题和上下文检索会用这些标签筛选素材。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOutlineDialogOpen(false)}
              disabled={uploadingOutline}
            >
              取消
            </Button>
            <Button onClick={handleUploadOutline} disabled={uploadingOutline || !outlineFile}>
              {uploadingOutline ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="mr-2 size-4" />
                  上传并解析
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* C2 · Task Wizard Modal */}
      <TaskWizardModal
        open={wizardOpen}
        context={wizardContext}
        initialDraft={wizardDraft}
        onClose={() => {
          setWizardOpen(false);
          setWizardDraft(null);
        }}
        onSuccess={fetchCourse}
      />
    </div>
  );
}

function OutlineEditableDraft({
  draft,
  currentChapters,
  preview,
  isPreviewing,
  isApplying,
  isSaving,
  isReplacing,
  onChange,
  onPreview,
  onApply,
  onSaveDraft,
  onReplace,
}: {
  draft: EditableOutlineDraft;
  currentChapters: ApiChapter[];
  preview: OutlineMergePreview | null;
  isPreviewing: boolean;
  isApplying: boolean;
  isSaving: boolean;
  isReplacing: boolean;
  onChange: (draft: EditableOutlineDraft) => void;
  onPreview: () => void;
  onApply: () => void;
  onSaveDraft: () => void;
  onReplace: () => void;
}) {
  const updateList = (
    field: "courseGoals" | "knowledgeObjectives" | "skillObjectives" | "valueObjectives" | "assessmentRequirements" | "globalKnowledgePoints",
    value: string,
  ) => onChange({ ...draft, [field]: parseLines(value) });

  const updateChapter = (chapterIndex: number, patch: Partial<EditableOutlineChapter>) => {
    onChange({
      ...draft,
      chapters: draft.chapters.map((chapter, index) =>
        index === chapterIndex ? { ...chapter, ...patch } : chapter,
      ),
    });
  };

  const updateSection = (
    chapterIndex: number,
    sectionIndex: number,
    patch: Partial<EditableOutlineSection>,
  ) => {
    onChange({
      ...draft,
      chapters: draft.chapters.map((chapter, index) => {
        if (index !== chapterIndex) return chapter;
        return {
          ...chapter,
          sections: chapter.sections.map((section, sIndex) =>
            sIndex === sectionIndex ? { ...section, ...patch } : section,
          ),
        };
      }),
    });
  };

  const removeChapter = (chapterIndex: number) => {
    onChange({ ...draft, chapters: draft.chapters.filter((_, index) => index !== chapterIndex) });
  };

  const addChapter = () => {
    onChange({
      ...draft,
      chapters: [
        ...draft.chapters,
        {
          title: "新章节",
          learningGoals: [],
          knowledgeObjectives: [],
          skillObjectives: [],
          knowledgePoints: [],
          sections: [],
        },
      ],
    });
  };

  const addSection = (chapterIndex: number) => {
    onChange({
      ...draft,
      chapters: draft.chapters.map((chapter, index) =>
        index === chapterIndex
          ? {
              ...chapter,
              sections: [
                ...chapter.sections,
                {
                  title: "新小节",
                  learningGoals: [],
                  knowledgeObjectives: [],
                  skillObjectives: [],
                  knowledgePoints: [],
                },
              ],
            }
          : chapter,
      ),
    });
  };

  const removeSection = (chapterIndex: number, sectionIndex: number) => {
    onChange({
      ...draft,
      chapters: draft.chapters.map((chapter, index) =>
        index === chapterIndex
          ? {
              ...chapter,
              sections: chapter.sections.filter((_, sIndex) => sIndex !== sectionIndex),
            }
          : chapter,
      ),
    });
  };

  const moveChapter = (chapterIndex: number, direction: -1 | 1) => {
    const target = chapterIndex + direction;
    if (target < 0 || target >= draft.chapters.length) return;
    const next = [...draft.chapters];
    [next[chapterIndex], next[target]] = [next[target], next[chapterIndex]];
    onChange({ ...draft, chapters: next });
  };

  const moveSection = (chapterIndex: number, sectionIndex: number, direction: -1 | 1) => {
    const chapter = draft.chapters[chapterIndex];
    if (!chapter) return;
    const target = sectionIndex + direction;
    if (target < 0 || target >= chapter.sections.length) return;
    const nextSections = [...chapter.sections];
    [nextSections[sectionIndex], nextSections[target]] = [nextSections[target], nextSections[sectionIndex]];
    onChange({
      ...draft,
      chapters: draft.chapters.map((c, index) =>
        index === chapterIndex ? { ...c, sections: nextSections } : c,
      ),
    });
  };

  return (
    <div className="space-y-3">
      <details open className="rounded-md border border-line bg-surface px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink">
          课程背景与目标草稿
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <OutlineTextarea
            label="课程目标"
            value={joinLines(draft.courseGoals)}
            onChange={(value) => updateList("courseGoals", value)}
          />
          <OutlineTextarea
            label="课程级知识点"
            value={joinLines(draft.globalKnowledgePoints)}
            onChange={(value) => updateList("globalKnowledgePoints", value)}
          />
          <OutlineTextarea
            label="知识目标"
            value={joinLines(draft.knowledgeObjectives)}
            onChange={(value) => updateList("knowledgeObjectives", value)}
          />
          <OutlineTextarea
            label="技能目标"
            value={joinLines(draft.skillObjectives)}
            onChange={(value) => updateList("skillObjectives", value)}
          />
          <OutlineTextarea
            label="素养/思政目标"
            value={joinLines(draft.valueObjectives)}
            onChange={(value) => updateList("valueObjectives", value)}
          />
          <OutlineTextarea
            label="评价要求"
            value={joinLines(draft.assessmentRequirements)}
            onChange={(value) => updateList("assessmentRequirements", value)}
          />
        </div>
        <div className="mt-3 space-y-1">
          <Label className="text-xs text-ink-3">教师确认备注</Label>
          <Textarea
            value={draft.notes}
            onChange={(event) => onChange({ ...draft, notes: event.target.value })}
            rows={2}
            className="text-xs"
            placeholder="记录需要确认、暂不合并或后续补充的地方。"
          />
        </div>
      </details>

      <details open className="rounded-md border border-line bg-surface px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink">
          可编辑课程目录草稿 · {draft.chapters.length} 章
        </summary>
        <div className="mt-3 space-y-3">
          {draft.chapters.map((chapter, chapterIndex) => (
            <div key={`${chapter.title}-${chapterIndex}`} className="rounded-md border border-line bg-paper px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={chapter.title}
                  onChange={(event) => updateChapter(chapterIndex, { title: event.target.value })}
                  className="h-8 flex-1 text-sm font-medium"
                  placeholder="章节标题"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={chapterIndex === 0}
                  onClick={() => moveChapter(chapterIndex, -1)}
                  aria-label="上移章节"
                >
                  上移
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={chapterIndex === draft.chapters.length - 1}
                  onClick={() => moveChapter(chapterIndex, 1)}
                  aria-label="下移章节"
                >
                  下移
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSection(chapterIndex)}
                >
                  添加小节
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeChapter(chapterIndex)}
                >
                  删除章
                </Button>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <OutlineTextarea
                  label="本章学习目标"
                  value={joinLines(chapter.learningGoals)}
                  onChange={(value) => updateChapter(chapterIndex, { learningGoals: parseLines(value) })}
                />
                <OutlineTextarea
                  label="本章知识点"
                  value={joinLines(chapter.knowledgePoints)}
                  onChange={(value) => updateChapter(chapterIndex, { knowledgePoints: parseLines(value) })}
                />
              </div>
              <div className="mt-2 space-y-2">
                {chapter.sections.map((section, sectionIndex) => (
                  <div key={`${section.title}-${sectionIndex}`} className="rounded border border-line bg-surface px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={section.title}
                        onChange={(event) =>
                          updateSection(chapterIndex, sectionIndex, { title: event.target.value })
                        }
                        className="h-8 flex-1 text-xs"
                        placeholder="小节标题"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={sectionIndex === 0}
                        onClick={() => moveSection(chapterIndex, sectionIndex, -1)}
                        aria-label="上移小节"
                      >
                        上移
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={sectionIndex === chapter.sections.length - 1}
                        onClick={() => moveSection(chapterIndex, sectionIndex, 1)}
                        aria-label="下移小节"
                      >
                        下移
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSection(chapterIndex, sectionIndex)}
                      >
                        删除
                      </Button>
                    </div>
                    <div className="mt-2">
                      <OutlineTextarea
                        label="本节知识点"
                        value={joinLines(section.knowledgePoints)}
                        onChange={(value) =>
                          updateSection(chapterIndex, sectionIndex, { knowledgePoints: parseLines(value) })
                        }
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
                {chapter.sections.length === 0 && (
                  <p className="rounded border border-dashed border-line bg-surface px-2 py-2 text-xs text-muted-foreground">
                    该章节暂无小节草稿，可以添加后再预览合并。
                  </p>
                )}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addChapter}>
            添加章节草稿
          </Button>
        </div>
      </details>

      <details className="rounded-md border border-line bg-surface px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink">
          当前课程目录 · {currentChapters.length} 章
        </summary>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {currentChapters.map((chapter) => (
            <div key={chapter.id} className="rounded border border-line bg-paper-alt px-2.5 py-2">
              <div className="text-xs font-semibold text-ink">{chapter.title}</div>
              <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                {chapter.sections.map((section) => (
                  <div key={section.id} className="flex justify-between gap-2">
                    <span>{section.title}</span>
                    {section.taskInstances.length > 0 && <span>{section.taskInstances.length} 个任务</span>}
                  </div>
                ))}
                {chapter.sections.length === 0 && <div>暂无小节</div>}
              </div>
            </div>
          ))}
        </div>
      </details>

      {preview && <OutlineMergePreviewPanel preview={preview} />}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSaveDraft} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
          保存编辑
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onPreview} disabled={isPreviewing}>
          {isPreviewing ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
          按当前草稿预览合并
        </Button>
        <Button type="button" size="sm" onClick={onApply} disabled={isApplying}>
          {isApplying ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
          安全合并
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onReplace} disabled={isReplacing}>
          {isReplacing ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
          应用到课程结构（替换）
        </Button>
      </div>
    </div>
  );
}

function OutlineTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-ink-3">{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="text-xs"
        placeholder="每行一条，可在合并前调整。"
      />
    </div>
  );
}

function OutlineDraftDetails({ value }: { value: unknown }) {
  const data = normalizeOutlineDraft(value);
  if (!data) {
    return <p className="text-xs text-muted-foreground">该素材暂无结构化目录。</p>;
  }

  return (
    <div className="space-y-3">
      <details open className="rounded-md border border-line bg-surface px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink">课程背景与目标</summary>
        <div className="mt-2 grid gap-2 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2">
          <OutlineList title="课程目标" items={data.courseGoals} />
          <OutlineList title="知识目标" items={data.knowledgeObjectives} />
          <OutlineList title="技能目标" items={data.skillObjectives} />
          <OutlineList title="素养/思政目标" items={data.valueObjectives} />
          <OutlineList title="评价要求" items={data.assessmentRequirements} />
        </div>
      </details>
      <details className="rounded-md border border-line bg-surface px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-ink">
          AI 目录草稿 · {data.chapters.length} 章
        </summary>
        <div className="mt-2 space-y-2">
          {data.chapters.slice(0, 8).map((chapter, index) => (
            <div key={`${chapter.title}-${index}`} className="rounded border border-line bg-paper-alt px-2.5 py-2">
              <div className="text-xs font-semibold text-ink">
                {index + 1}. {chapter.title || "未命名章节"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {chapter.knowledgePoints.slice(0, 6).map((point) => (
                  <span key={point} className="rounded bg-surface px-1.5 py-0.5 text-[10.5px] text-ink-4">
                    {point}
                  </span>
                ))}
              </div>
              {chapter.sections.length > 0 && (
                <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {chapter.sections.map((section) => section.title).filter(Boolean).join(" / ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function OutlineList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="font-semibold text-ink-3">{title}</div>
      {items.length === 0 ? (
        <div className="text-ink-5">暂无识别内容</div>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {items.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OutlineMergePreviewPanel({ preview }: { preview: OutlineMergePreview }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
      <div className="font-semibold">安全合并预览</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <div className="font-medium">新增章节 {preview.chaptersToAdd.length}</div>
          <div className="mt-1 space-y-0.5 text-amber-900">
            {preview.chaptersToAdd.slice(0, 4).map((item) => (
              <div key={item.title}>{item.title}（{item.sectionCount} 节）</div>
            ))}
            {preview.chaptersToAdd.length === 0 && <div>无</div>}
          </div>
        </div>
        <div>
          <div className="font-medium">新增小节 {preview.sectionsToAdd.length}</div>
          <div className="mt-1 space-y-0.5 text-amber-900">
            {preview.sectionsToAdd.slice(0, 4).map((item) => (
              <div key={`${item.chapterTitle}-${item.title}`}>{item.chapterTitle} / {item.title}</div>
            ))}
            {preview.sectionsToAdd.length === 0 && <div>无</div>}
          </div>
        </div>
        <div>
          <div className="font-medium">受保护内容 {preview.protectedItems.length}</div>
          <div className="mt-1 space-y-0.5 text-amber-900">
            {preview.protectedItems.slice(0, 4).map((item) => (
              <div key={`${item.type}-${item.title}`}>{item.title}：{item.reason}</div>
            ))}
            {preview.protectedItems.length === 0 && <div>无</div>}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-amber-800">{preview.notes.join(" ")}</div>
    </div>
  );
}

function outlineObjectiveSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const data = value as {
    courseGoals?: unknown;
    knowledgeObjectives?: unknown;
    skillObjectives?: unknown;
    valueObjectives?: unknown;
    assessmentRequirements?: unknown;
  };
  const parts = [
    ["总体目标", data.courseGoals],
    ["知识目标", data.knowledgeObjectives],
    ["技能目标", data.skillObjectives],
    ["素养/思政目标", data.valueObjectives],
    ["评价要求", data.assessmentRequirements],
  ]
    .map(([label, raw]) => {
      const values = Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        : [];
      return values.length ? `${label} ${values.length} 条` : "";
    })
    .filter(Boolean);
  return parts.join(" · ");
}

function normalizeOutlineDraft(value: unknown): EditableOutlineDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as {
    courseGoals?: unknown;
    knowledgeObjectives?: unknown;
    skillObjectives?: unknown;
    valueObjectives?: unknown;
    assessmentRequirements?: unknown;
    globalKnowledgePoints?: unknown;
    notes?: unknown;
    chapters?: unknown;
  };
  const chapters = Array.isArray(data.chapters)
    ? data.chapters
        .map((raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
          const chapter = raw as {
            chapterId?: unknown;
            title?: unknown;
            learningGoals?: unknown;
            knowledgeObjectives?: unknown;
            skillObjectives?: unknown;
            knowledgePoints?: unknown;
            sections?: unknown;
          };
          const sectionList = Array.isArray(chapter.sections)
            ? chapter.sections
                .map((rawSection) => {
                    if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) return null;
                    const section = rawSection as {
                      sectionId?: unknown;
                      title?: unknown;
                      learningGoals?: unknown;
                      knowledgeObjectives?: unknown;
                      skillObjectives?: unknown;
                      knowledgePoints?: unknown;
                    };
                    const next: EditableOutlineSection = {
                      title: typeof section.title === "string" ? section.title : "",
                      learningGoals: stringArray(section.learningGoals),
                      knowledgeObjectives: stringArray(section.knowledgeObjectives),
                      skillObjectives: stringArray(section.skillObjectives),
                      knowledgePoints: stringArray(section.knowledgePoints),
                    };
                    if (typeof section.sectionId === "string") next.sectionId = section.sectionId;
                    return next;
                  })
                .filter((section): section is EditableOutlineSection => section !== null)
            : [];
          const next: EditableOutlineChapter = {
            title: typeof chapter.title === "string" ? chapter.title : "",
            learningGoals: stringArray(chapter.learningGoals),
            knowledgeObjectives: stringArray(chapter.knowledgeObjectives),
            skillObjectives: stringArray(chapter.skillObjectives),
            knowledgePoints: stringArray(chapter.knowledgePoints),
            sections: sectionList,
          };
          if (typeof chapter.chapterId === "string") next.chapterId = chapter.chapterId;
          return next;
        })
        .filter((chapter): chapter is EditableOutlineChapter => chapter !== null)
    : [];

  return {
    courseGoals: stringArray(data.courseGoals),
    knowledgeObjectives: stringArray(data.knowledgeObjectives),
    skillObjectives: stringArray(data.skillObjectives),
    valueObjectives: stringArray(data.valueObjectives),
    assessmentRequirements: stringArray(data.assessmentRequirements),
    globalKnowledgePoints: stringArray(data.globalKnowledgePoints),
    notes: typeof data.notes === "string" ? data.notes : "",
    chapters,
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function parseLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(values: string[]) {
  return values.join("\n");
}
