"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { BookOpen, FileText, Layers, ListChecks, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContextTaskInstance {
  id: string;
  title: string;
  taskType: string;
  slot: string | null;
  status: string;
}

interface ContextSection {
  id: string;
  title: string;
  order: number;
  taskInstances: ContextTaskInstance[];
}

interface ContextChapter {
  id: string;
  title: string;
  order: number;
  sections: ContextSection[];
}

interface KnowledgeSourceItem {
  id: string;
  fileName: string;
  status: "uploaded" | "extracting" | "ocr_required" | "ocr_processing" | "processing" | "ai_summary_failed" | "ready" | "failed";
  summary: string | null;
  conceptTags: string[];
  error: string | null;
  excerpt: string;
}

interface CourseContextSourcesTabProps {
  courseId: string;
  courseTitle: string;
  chapters: ContextChapter[];
}

const COURSE_SCOPE = "__course_scope";
const SECTION_SCOPE = "__section_scope";
const TASK_SCOPE = "__task_scope";

const TASK_TYPE_LABELS: Record<string, string> = {
  simulation: "模拟",
  quiz: "测验",
  subjective: "主观",
};

const SLOT_LABELS: Record<string, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

function statusLabel(status: KnowledgeSourceItem["status"]) {
  switch (status) {
    case "ready":
      return "可用";
    case "ai_summary_failed":
      return "文本可用";
    case "ocr_required":
      return "需 OCR";
    case "failed":
      return "失败";
    case "extracting":
      return "抽取中";
    case "ocr_processing":
      return "OCR 中";
    default:
      return "处理中";
  }
}

export function CourseContextSourcesTab({
  courseId,
  courseTitle,
  chapters,
}: CourseContextSourcesTabProps) {
  const [selectedChapterId, setSelectedChapterId] = useState(COURSE_SCOPE);
  const [selectedSectionId, setSelectedSectionId] = useState(SECTION_SCOPE);
  const [selectedTaskId, setSelectedTaskId] = useState(TASK_SCOPE);
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const flattenedTasks = useMemo(() => {
    return chapters.flatMap((chapter) =>
      chapter.sections.flatMap((section) =>
        section.taskInstances.map((task) => ({
          ...task,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sectionId: section.id,
          sectionTitle: section.title,
        })),
      ),
    );
  }, [chapters]);

  const selectedTask = useMemo(
    () => flattenedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [flattenedTasks, selectedTaskId],
  );

  const sectionOptions = useMemo(() => {
    if (selectedChapterId === COURSE_SCOPE) return [];
    return chapters.find((chapter) => chapter.id === selectedChapterId)?.sections ?? [];
  }, [chapters, selectedChapterId]);

  const taskOptions = useMemo(() => {
    return flattenedTasks.filter((task) => {
      if (selectedChapterId !== COURSE_SCOPE && task.chapterId !== selectedChapterId) {
        return false;
      }
      if (selectedSectionId !== SECTION_SCOPE && task.sectionId !== selectedSectionId) {
        return false;
      }
      return true;
    });
  }, [flattenedTasks, selectedChapterId, selectedSectionId]);

  const effectiveChapterId =
    selectedTask?.chapterId ??
    (selectedChapterId === COURSE_SCOPE ? null : selectedChapterId);
  const effectiveSectionId =
    selectedTask?.sectionId ??
    (selectedSectionId === SECTION_SCOPE ? null : selectedSectionId);

  const scopeLabel = useMemo(() => {
    if (selectedTask) {
      return `${courseTitle} / ${selectedTask.chapterTitle} / ${selectedTask.sectionTitle} / ${selectedTask.title}`;
    }
    const chapter = chapters.find((item) => item.id === effectiveChapterId);
    const section = chapter?.sections.find((item) => item.id === effectiveSectionId);
    return [courseTitle, chapter?.title, section?.title].filter(Boolean).join(" / ");
  }, [chapters, courseTitle, effectiveChapterId, effectiveSectionId, selectedTask]);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ courseId });
      if (effectiveChapterId) params.set("chapterId", effectiveChapterId);
      if (effectiveSectionId) params.set("sectionId", effectiveSectionId);
      if (selectedTask) params.set("taskInstanceId", selectedTask.id);
      const res = await fetch(`/api/lms/course-knowledge-sources?${params}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "上下文素材加载失败");
        return;
      }
      setSources(json.data || []);
    } catch {
      toast.error("上下文素材加载失败");
    } finally {
      setLoading(false);
    }
  }, [courseId, effectiveChapterId, effectiveSectionId, selectedTask]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    const hasProcessing = sources.some((source) =>
      ["uploaded", "extracting", "ocr_processing", "processing"].includes(source.status),
    );
    if (!hasProcessing) return;
    const timer = window.setInterval(fetchSources, 2500);
    return () => window.clearInterval(timer);
  }, [fetchSources, sources]);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("courseId", courseId);
      if (effectiveChapterId) formData.set("chapterId", effectiveChapterId);
      if (effectiveSectionId) formData.set("sectionId", effectiveSectionId);
      if (selectedTask) formData.set("taskInstanceId", selectedTask.id);

      const res = await fetch("/api/lms/course-knowledge-sources", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "素材上传解析失败");
        return;
      }
      const source = json.data as KnowledgeSourceItem;
      if (source.status === "ready" || source.status === "ai_summary_failed") {
        toast.success("素材已解析为教学上下文");
      } else {
        toast.warning(source.error || "素材已保存，但仍需处理");
      }
      await fetchSources();
    } catch {
      toast.error("素材上传解析失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Card className="border-line bg-surface shadow-fs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-[18px] text-ink">教学上下文素材</CardTitle>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-4">
                按课程、章节、小节或任务上传 PDF/教案。学习伙伴和 AI 草稿会把这些素材作为额外上下文，学生仍只看到 AI 整理后的学习引导。
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={fetchSources} disabled={loading || uploading}>
              <RefreshCw className="mr-1.5 size-3.5" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-ink-3">章节</Label>
              <Select
                value={selectedChapterId}
                onValueChange={(value) => {
                  setSelectedChapterId(value);
                  setSelectedSectionId(SECTION_SCOPE);
                  setSelectedTaskId(TASK_SCOPE);
                }}
              >
                <SelectTrigger className="bg-paper">
                  <SelectValue placeholder="选择章节" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COURSE_SCOPE}>整门课程</SelectItem>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      第 {chapter.order + 1} 章 · {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-ink-3">小节</Label>
              <Select
                value={selectedSectionId}
                onValueChange={(value) => {
                  setSelectedSectionId(value);
                  setSelectedTaskId(TASK_SCOPE);
                }}
                disabled={selectedChapterId === COURSE_SCOPE}
              >
                <SelectTrigger className="bg-paper">
                  <SelectValue placeholder="选择小节" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SECTION_SCOPE}>本章全部小节</SelectItem>
                  {sectionOptions.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.order + 1}. {section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-ink-3">任务定位</Label>
              <Select
                value={selectedTaskId}
                onValueChange={(value) => {
                  setSelectedTaskId(value);
                  const task = flattenedTasks.find((item) => item.id === value);
                  if (task) {
                    setSelectedChapterId(task.chapterId);
                    setSelectedSectionId(task.sectionId);
                  }
                }}
              >
                <SelectTrigger className="bg-paper">
                  <SelectValue placeholder="选择任务" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={TASK_SCOPE}>不指定任务</SelectItem>
                  {taskOptions.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {TASK_TYPE_LABELS[task.taskType] ?? task.taskType}
                      {task.slot ? ` · ${SLOT_LABELS[task.slot] ?? task.slot}` : ""} · {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-line bg-paper-alt p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                  <Upload className="size-4 text-brand" />
                  上传到当前范围
                </div>
                <p className="mt-1 text-xs text-ink-4">{scopeLabel}</p>
              </div>
              <Input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf,.docx,text/plain,text/markdown,.txt,.md,.zip,image/png,image/jpeg,image/webp"
                className="w-full max-w-[320px] bg-surface text-xs"
                disabled={uploading}
                onChange={(event) => handleUpload(event.target.files?.[0] || null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-line bg-surface shadow-fs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-[16px] text-ink">当前范围素材</CardTitle>
              <p className="mt-1 text-xs text-ink-4">
                学习伙伴会自动读取课程级、章节级和小节级 ready 素材。
              </p>
            </div>
            {loading && <Loader2 className="size-4 animate-spin text-ink-4" />}
          </div>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-paper-alt py-10 text-center">
              <BookOpen className="mb-2 size-8 text-ink-5" />
              <p className="text-sm font-medium text-ink-3">当前范围暂无素材</p>
              <p className="mt-1 text-xs text-ink-5">上传 PDF、Word、TXT、ZIP 或图片后，系统会抽取文本、摘要和概念标签。</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sources.map((source) => (
                <div key={source.id} className="rounded-lg border border-line bg-paper p-3">
                  <div className="flex items-start gap-2">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="truncate text-sm font-semibold text-ink">{source.fileName}</div>
                        <Badge
                          variant="secondary"
                          className={
                            source.status === "ready" || source.status === "ai_summary_failed"
                              ? "bg-success-soft text-success"
                              : source.status === "ocr_required"
                                ? "bg-warn-soft text-warn"
                                : "bg-paper-alt text-ink-4"
                          }
                        >
                          {statusLabel(source.status)}
                        </Badge>
                      </div>
                      {source.summary && (
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-3">
                          {source.summary}
                        </p>
                      )}
                      {source.error && (
                        <p className="mt-2 text-xs text-warn">{source.error}</p>
                      )}
                      {source.conceptTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {source.conceptTags.slice(0, 6).map((tag) => (
                            <Badge key={tag} variant="outline" className="bg-surface text-[10.5px] text-ink-3">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-line bg-paper-alt p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                <Layers className="size-3.5 text-brand" />
                上下文边界
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-4">
                课程级素材适合课程大纲；章节/小节素材适合知识点、教案和例题；按任务定位上传时会挂到任务所在小节。
              </p>
            </div>
            <div className="rounded-lg border border-line bg-paper-alt p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                <ListChecks className="size-3.5 text-brand" />
                使用位置
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-4">
                任务向导的 AI 草稿和学生学习伙伴都会读取这些素材；确定性统计与成绩不会由素材直接改写。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
