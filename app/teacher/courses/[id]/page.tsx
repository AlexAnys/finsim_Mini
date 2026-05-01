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
  missingFields: string[];
  error: string | null;
  updatedAt: string;
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
    setEditCourseDialogOpen(true);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑课程</DialogTitle>
            <DialogDescription>
              修改课程名称与描述。其他元数据（班级、学期、协作教师）请在 Hero
              区域直接编辑。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
          </div>
          <DialogFooter>
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

      {/* C2 · Task Wizard Modal */}
      <TaskWizardModal
        open={wizardOpen}
        context={wizardContext}
        onClose={() => setWizardOpen(false)}
        onSuccess={fetchCourse}
      />
    </div>
  );
}
