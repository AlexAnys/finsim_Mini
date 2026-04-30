"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, RefreshCw, Sparkles, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WizardCard } from "./wizard-card";
import type { TaskType } from "./wizard-types";
import { toast } from "sonner";

interface KnowledgeSourceItem {
  id: string;
  fileName: string;
  status: "uploaded" | "extracting" | "ocr_required" | "ocr_processing" | "processing" | "ai_summary_failed" | "ready" | "failed";
  summary: string | null;
  conceptTags: string[];
  error: string | null;
  excerpt: string;
}

interface KnowledgeSourceAssistantProps {
  courseId: string;
  chapterId: string;
  sectionId: string;
  taskType: TaskType;
  selectedSourceIds: string[];
  teacherBrief: string;
  generating: boolean;
  onSelectedSourceIdsChange: (ids: string[]) => void;
  onTeacherBriefChange: (value: string) => void;
  onGenerateDraft: () => void;
}

const TASK_LABELS: Record<TaskType, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
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

export function KnowledgeSourceAssistant({
  courseId,
  chapterId,
  sectionId,
  taskType,
  selectedSourceIds,
  teacherBrief,
  generating,
  onSelectedSourceIdsChange,
  onTeacherBriefChange,
  onGenerateDraft,
}: KnowledgeSourceAssistantProps) {
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ courseId });
      if (chapterId) params.set("chapterId", chapterId);
      if (sectionId) params.set("sectionId", sectionId);
      const res = await fetch(`/api/lms/course-knowledge-sources?${params}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "课程素材加载失败");
        return;
      }
      setSources(json.data || []);
    } catch {
      toast.error("课程素材加载失败");
    } finally {
      setLoading(false);
    }
  }, [chapterId, courseId, sectionId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("courseId", courseId);
      formData.set("chapterId", chapterId);
      formData.set("sectionId", sectionId);

      const res = await fetch("/api/lms/course-knowledge-sources", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "素材上传解析失败");
        return;
      }
      const source = json.data as { id: string; status: string; error?: string | null };
      await fetchSources();
      if (source.status === "ready" || source.status === "ai_summary_failed") {
        onSelectedSourceIdsChange(Array.from(new Set([...selectedSourceIds, source.id])));
        toast.success("素材已解析并加入本次草稿素材");
      } else {
        toast.warning(source.error || "素材解析未完成，请查看素材状态");
      }
    } catch {
      toast.error("素材上传解析失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function toggleSource(id: string, checked: boolean) {
    if (checked) {
      onSelectedSourceIdsChange(Array.from(new Set([...selectedSourceIds, id])));
      return;
    }
    onSelectedSourceIdsChange(selectedSourceIds.filter((sourceId) => sourceId !== id));
  }

  const readySources = sources.filter((source) => source.status === "ready" || source.status === "ai_summary_failed");

  return (
    <WizardCard
      title="课程素材 / AI 草稿助手"
      subtitle={`上传或选择课程素材，让 AI 生成 ${TASK_LABELS[taskType]} 草稿；教师审核后才会创建。`}
      extra={
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchSources}
            disabled={loading || uploading || generating}
          >
            <RefreshCw className="size-3 mr-1" />
            刷新
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onGenerateDraft}
            disabled={generating || uploading}
          >
            {generating ? (
              <Loader2 className="size-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="size-3 mr-1" />
            )}
            生成草稿
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <div className="rounded-lg border border-dashed border-line bg-paper-alt p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-2">
            <Upload className="size-3.5" />
            上传课程素材
          </div>
          <Input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf,.docx,text/plain,text/markdown,.txt,.md,.zip,image/png,image/jpeg,image/webp"
            className="mt-2 text-xs"
            disabled={uploading || generating}
            onChange={(event) => handleUpload(event.target.files?.[0] || null)}
          />
          <p className="mt-2 text-[10.5px] leading-[1.5] text-ink-5">
            素材会挂到当前课程小节，用于出题与模拟对话草稿，不直接发布给学生。
          </p>
          {uploading && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-4">
              <Loader2 className="size-3 animate-spin" />
              正在解析素材...
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs font-semibold text-ink-2">已选素材</Label>
            <span className="text-[11px] text-ink-5">
              {selectedSourceIds.length} / {readySources.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3 text-xs text-ink-4">
              <Loader2 className="size-3 animate-spin" />
              加载素材...
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface p-3 text-xs text-ink-4">
              当前小节暂无素材，可以先上传 PDF 或直接填写需求生成草稿。
            </div>
          ) : (
            <div className="grid gap-2">
              {sources.slice(0, 4).map((source) => {
                const ready = source.status === "ready" || source.status === "ai_summary_failed";
                return (
                  <label
                    key={source.id}
                    className="flex cursor-pointer gap-2 rounded-lg border border-line bg-surface p-3"
                  >
                    <Checkbox
                      checked={selectedSourceIds.includes(source.id)}
                      disabled={!ready || generating}
                      onCheckedChange={(checked) => toggleSource(source.id, !!checked)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <FileText className="size-3.5 text-ink-4" />
                        <span className="truncate text-xs font-semibold text-ink">
                          {source.fileName}
                        </span>
                        <Badge variant={ready ? "default" : "outline"} className="text-[10px]">
                          {statusLabel(source.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-[1.45] text-ink-4">
                        {source.summary || source.excerpt || source.error || "暂无摘要"}
                      </p>
                      {source.conceptTags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {source.conceptTags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-paper-alt px-1.5 py-0.5 text-[10px] text-ink-4"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-semibold text-ink-2">教师高维需求</Label>
        <Textarea
          value={teacherBrief}
          onChange={(event) => onTeacherBriefChange(event.target.value)}
          placeholder="例如：围绕本节核心概念出 6 道基础题 + 2 道应用题；模拟对话要覆盖学生追问、澄清需求、解释风险收益关系。"
          rows={3}
          disabled={generating}
        />
      </div>
    </WizardCard>
  );
}
