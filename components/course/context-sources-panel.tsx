"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface KnowledgeSourceItem {
  id: string;
  fileName: string;
  status: "uploaded" | "extracting" | "ocr_required" | "ocr_processing" | "processing" | "ai_summary_failed" | "ready" | "failed";
  summary: string | null;
  conceptTags: string[];
  error: string | null;
  excerpt: string;
}

interface KnowledgeSourceDetail extends KnowledgeSourceItem {
  extractedText: string | null;
}

interface ContextSourcesPanelProps {
  courseId: string;
  chapterId?: string | null;
  sectionId?: string | null;
  taskId?: string | null;
  taskInstanceId?: string | null;
  title?: string;
  description?: string;
}

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

function statusClass(status: KnowledgeSourceItem["status"]) {
  if (status === "ready" || status === "ai_summary_failed") return "bg-success-soft text-success";
  if (status === "failed") return "bg-danger-soft text-danger";
  if (status === "ocr_required") return "bg-warn-soft text-warn";
  return "bg-paper-alt text-ink-4";
}

export function ContextSourcesPanel({
  courseId,
  chapterId,
  sectionId,
  taskId,
  taskInstanceId,
  title = "任务额外上下文",
  description = "上传本任务专用 PDF、教案、讲义或案例。学习伙伴会优先使用这些材料，再回退到小节、章节和课程级上下文。",
}: ContextSourcesPanelProps) {
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [detail, setDetail] = useState<KnowledgeSourceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ courseId });
    if (chapterId) params.set("chapterId", chapterId);
    if (sectionId) params.set("sectionId", sectionId);
    if (taskId) params.set("taskId", taskId);
    if (taskInstanceId) params.set("taskInstanceId", taskInstanceId);
    return params;
  }, [chapterId, courseId, sectionId, taskId, taskInstanceId]);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lms/course-knowledge-sources?${buildParams()}`);
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
  }, [buildParams]);

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
      if (chapterId) formData.set("chapterId", chapterId);
      if (sectionId) formData.set("sectionId", sectionId);
      if (taskId) formData.set("taskId", taskId);
      if (taskInstanceId) formData.set("taskInstanceId", taskInstanceId);

      const res = await fetch("/api/lms/course-knowledge-sources", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "素材上传失败");
        return;
      }
      toast.success("素材已保存，后台正在识别");
      await fetchSources();
    } catch {
      toast.error("素材上传失败");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleLoadDetail(sourceId: string) {
    setDetailLoadingId(sourceId);
    try {
      const res = await fetch(`/api/lms/course-knowledge-sources/${sourceId}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "素材详情加载失败");
        return;
      }
      setDetail(json.data);
    } catch {
      toast.error("素材详情加载失败");
    } finally {
      setDetailLoadingId(null);
    }
  }

  async function handleDelete(sourceId: string) {
    setDeletingId(sourceId);
    try {
      const res = await fetch(`/api/lms/course-knowledge-sources/${sourceId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "素材删除失败");
        return;
      }
      if (detail?.id === sourceId) setDetail(null);
      toast.success("素材已删除");
      await fetchSources();
    } catch {
      toast.error("素材删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-line bg-surface shadow-fs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-[18px] text-ink">
                <BookOpen className="size-4 text-brand" />
                {title}
              </CardTitle>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-4">{description}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={fetchSources} disabled={loading || uploading}>
              <RefreshCw className="mr-1.5 size-3.5" />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-line bg-paper-alt p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                <Upload className="size-4 text-brand" />
                上传材料
              </div>
              <Input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf,.docx,text/plain,text/markdown,.txt,.md,.zip,image/png,image/jpeg,image/webp"
                className="w-full max-w-[360px] bg-surface text-xs"
                disabled={uploading}
                onChange={(event) => handleUpload(event.target.files?.[0] || null)}
              />
            </div>
          </div>

          {loading && sources.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-ink-4">
              <Loader2 className="mr-2 size-4 animate-spin" />
              加载上下文素材...
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-lg border border-line bg-paper-alt py-12 text-center">
              <FileText className="mx-auto mb-2 size-8 text-ink-5" />
              <p className="text-sm font-medium text-ink-3">当前范围暂无额外上下文</p>
              <p className="mt-1 text-xs text-ink-5">上传后会异步抽取文本、摘要和概念标签。</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div key={source.id} className="rounded-lg border border-line bg-paper p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-ink">{source.fileName}</div>
                        <Badge variant="secondary" className={statusClass(source.status)}>
                          {statusLabel(source.status)}
                        </Badge>
                      </div>
                      {source.summary && (
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-3">{source.summary}</p>
                      )}
                      {source.error && (
                        <p className="mt-2 text-xs leading-relaxed text-warn">{source.error}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoadDetail(source.id)}
                          disabled={detailLoadingId === source.id}
                        >
                          {detailLoadingId === source.id && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                          查看文本
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(source.id)}
                          disabled={deletingId === source.id}
                          className="text-danger hover:text-danger"
                        >
                          {deletingId === source.id ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-1.5 size-3.5" />
                          )}
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-line bg-surface shadow-fs">
        <CardHeader className="pb-3">
          <CardTitle className="text-[16px] text-ink">识别文本与摘要</CardTitle>
        </CardHeader>
        <CardContent>
          {!detail ? (
            <div className="rounded-lg border border-line bg-paper-alt px-4 py-10 text-center text-sm text-ink-4">
              选择左侧素材后查看摘要、概念标签和抽取文本。
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-ink">{detail.fileName}</div>
                <Badge className={statusClass(detail.status)} variant="secondary">
                  {statusLabel(detail.status)}
                </Badge>
              </div>
              {detail.summary && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-ink-3">摘要</div>
                  <p className="rounded-lg border border-line bg-paper-alt p-3 text-xs leading-relaxed text-ink-3">
                    {detail.summary}
                  </p>
                </div>
              )}
              {detail.conceptTags.length > 0 && (
                <div>
                  <div className="mb-1 text-xs font-semibold text-ink-3">概念标签</div>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.conceptTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="bg-paper text-ink-3">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-1 text-xs font-semibold text-ink-3">抽取文本</div>
                <pre className="max-h-[420px] overflow-auto rounded-lg border border-line bg-paper-alt p-3 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-4">
                  {detail.extractedText || detail.excerpt || "暂无可查看文本"}
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
