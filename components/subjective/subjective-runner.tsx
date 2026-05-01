"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  Save,
  Upload,
  X,
  FileText,
  Target,
  AlertCircle,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RunnerTopbar } from "@/components/runner/runner-topbar";
import { RunnerMetaWordCount, RunnerMetaSavedChip } from "@/components/runner/runner-meta";
import {
  SubmissionProcessingCard,
  type AsyncJobSnapshot,
} from "@/components/runner/submission-processing-card";

// ---------- Helpers ----------

/** generateId() requires Secure Context (HTTPS) in Safari/Firefox. */
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- Types ----------

interface ScoringCriterion {
  id: string;
  label: string;
  maxScore: number;
  description?: string;
}

interface SubjectiveTaskConfig {
  prompt: string;
  wordLimit?: number | null;
  allowAttachment?: boolean;
  maxAttachments?: number;
  scoringCriteria?: ScoringCriterion[];
  requirements?: string[];
  rubricVisible?: boolean;
  // Compat: accept wrapped format from page
  description?: string;
  allowTextAnswer?: boolean;
  allowFileUpload?: boolean;
  maxFiles?: number;
  maxFileSizeMB?: number;
}

interface SubjectiveRunnerProps {
  taskConfig: SubjectiveTaskConfig | { subjectiveConfig: SubjectiveTaskConfig };
  taskId: string;
  taskInstanceId: string;
  taskName: string;
  taskSubtitle?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  filePath?: string;
  contentType?: string;
}

// ---------- Constants ----------

const DRAFT_KEY_PREFIX = "finsim_subj_draft_";
const AUTO_SAVE_INTERVAL = 30_000;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["pdf", "doc", "docx", "jpg", "jpeg", "png", "xlsx"];

// ---------- Helpers ----------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countWords(text: string): number {
  const chineseChars = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || [];
  const otherWords = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return chineseChars.length + otherWords.length;
}

function unwrapConfig(
  taskConfig: SubjectiveRunnerProps["taskConfig"]
): SubjectiveTaskConfig {
  if ("subjectiveConfig" in taskConfig) {
    return taskConfig.subjectiveConfig;
  }
  return taskConfig;
}

// ---------- Component ----------

export function SubjectiveRunner({
  taskConfig: rawTaskConfig,
  taskId,
  taskInstanceId,
  taskName,
  taskSubtitle,
}: SubjectiveRunnerProps) {
  const router = useRouter();
  const config = useMemo(() => unwrapConfig(rawTaskConfig), [rawTaskConfig]);

  const prompt = config.prompt;
  const wordLimit = config.wordLimit ?? null;
  const allowAttachment = config.allowAttachment ?? config.allowFileUpload ?? true;
  const maxAttachments = config.maxAttachments ?? config.maxFiles ?? 5;
  const scoringCriteria = config.scoringCriteria ?? [];
  const requirements = config.requirements
    ?? (config.description ? config.description.split("\n").filter(Boolean) : undefined);
  const rubricVisible = config.rubricVisible ?? (scoringCriteria.length > 0);

  // Content state
  const [content, setContent] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.content || "";
      } catch {
        return "";
      }
    }
    return "";
  });

  // File state
  const [files, setFiles] = useState<UploadedFile[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.files || [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // UI state
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [gradingJob, setGradingJob] = useState<AsyncJobSnapshot | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = countWords(content);
  const isOverLimit = wordLimit !== null && wordCount > wordLimit;
  const totalMaxScore = scoringCriteria.reduce(
    (sum, c) => sum + c.maxScore,
    0
  );

  // Save draft to localStorage
  const saveDraftToStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      DRAFT_KEY_PREFIX + taskInstanceId,
      JSON.stringify({ content, files })
    );
  }, [content, files, taskInstanceId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (submitted) return;
    const timer = setInterval(() => {
      saveDraftToStorage();
      setIsSavingDraft(true);
      setTimeout(() => setIsSavingDraft(false), 1500);
    }, AUTO_SAVE_INTERVAL);
    return () => clearInterval(timer);
  }, [saveDraftToStorage, submitted]);

  // Save on content/files change
  useEffect(() => {
    saveDraftToStorage();
  }, [saveDraftToStorage]);

  // Manual save
  function handleSaveDraft() {
    saveDraftToStorage();
    setIsSavingDraft(true);
    toast.success("草稿已保存");
    setTimeout(() => setIsSavingDraft(false), 1500);
  }

  // File validation
  function validateFile(file: File): string | null {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `不支持的文件类型：${file.name}。允许的类型：${ALLOWED_EXTENSIONS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件过大：${file.name}（${formatFileSize(file.size)}）。最大允许 20MB`;
    }
    return null;
  }

  // Add files — upload to server
  async function handleAddFiles(fileList: FileList | null) {
    if (!fileList || !allowAttachment) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (files.length >= maxAttachments) {
        toast.error(`最多允许上传 ${maxAttachments} 个附件`);
        break;
      }
      const error = validateFile(file);
      if (error) {
        toast.error(error);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          toast.error(errData?.error?.message || `上传 ${file.name} 失败`);
          continue;
        }
        const data = await res.json();
        const uploaded = data.data;
        setFiles((prev) => [...prev, {
          id: generateId(),
          name: uploaded.fileName,
          size: uploaded.fileSize,
          type: uploaded.contentType,
          filePath: uploaded.filePath,
          contentType: uploaded.contentType,
        }]);
        toast.success(`已上传 ${file.name}`);
      } catch {
        toast.error(`上传 ${file.name} 失败`);
      }
    }
  }

  // Remove file
  function handleRemoveFile(fileId: string) {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  // Drag & drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleAddFiles(e.dataTransfer.files);
  }

  // Submit
  async function handleSubmit() {
    if (submitted || isSubmitting) return;

    if (!content.trim()) {
      toast.error("请输入答案内容");
      return;
    }

    if (isOverLimit) {
      toast.error(`字数超出限制（${wordCount}/${wordLimit}）`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        taskType: "subjective" as const,
        taskId,
        taskInstanceId,
        textAnswer: content.trim(),
        attachments: files.filter(f => f.filePath).map(f => ({
          fileName: f.name,
          filePath: f.filePath!,
          fileSize: f.size,
          contentType: f.contentType || f.type,
        })),
      };

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || "提交失败");
      }

      const data = await res.json();
      setSubmitted(true);
      setGradingJob(data.data?.gradingJob ?? null);
      localStorage.removeItem(DRAFT_KEY_PREFIX + taskInstanceId);
      toast.success("提交成功，系统正在后台批改");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------- Render: submitted ----------
  if (submitted) {
    return (
      <SubmissionProcessingCard
        title={taskName}
        job={gradingJob}
        onBack={() => router.back()}
        onViewGrades={() => router.push("/grades")}
      />
    );
  }

  // ---------- Render: in progress ----------
  return (
    <div className="flex h-full flex-col gap-4">
      {/* Top bar */}
      <RunnerTopbar
        onBack={() => router.back()}
        title={taskName}
        subtitle={taskSubtitle ?? "主观题"}
        metaSlots={
          <>
            <RunnerMetaSavedChip saving={isSavingDraft} />
            <RunnerMetaWordCount count={wordCount} limit={wordLimit} />
          </>
        }
        actions={[
          {
            label: "存草稿",
            onClick: handleSaveDraft,
            icon: Save,
            variant: "secondary",
          },
          {
            label: "提交",
            onClick: handleSubmit,
            icon: Check,
            variant: "primary",
            loading: isSubmitting,
            loadingLabel: "提交中...",
            disabled: isSubmitting || isOverLimit,
          },
        ]}
      />

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left panel - Task info (1/3) */}
        <div className="w-1/3 min-w-[280px]">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4" />
                任务信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-4">
                  {/* Prompt */}
                  <div>
                    <h4 className="mb-2 text-sm font-medium">题目要求</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap text-sm">
                      {prompt}
                    </p>
                  </div>

                  {/* Requirements */}
                  {requirements && requirements.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">作答要求</h4>
                      <ul className="text-muted-foreground space-y-1 text-sm">
                        {requirements.map((req, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary mt-1 shrink-0">
                              -
                            </span>
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Word limit info */}
                  {wordLimit !== null && (
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="text-muted-foreground size-4" />
                      <span className="text-muted-foreground">
                        字数限制：{wordLimit} 字
                      </span>
                    </div>
                  )}

                  {/* Scoring criteria */}
                  {rubricVisible && scoringCriteria.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="mb-2 text-sm font-medium">
                          评分标准（满分 {totalMaxScore} 分）
                        </h4>
                        <div className="space-y-2">
                          {scoringCriteria.map((c) => (
                            <div
                              key={c.id}
                              className="rounded-md border p-2 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{c.label}</span>
                                <Badge variant="secondary">
                                  {c.maxScore} 分
                                </Badge>
                              </div>
                              {c.description && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                  {c.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right panel - Editor (2/3) */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Text editor */}
          <Card className="flex flex-1 flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  作答区域
                </CardTitle>
                <div className="flex items-center gap-2">
                  {isSavingDraft && (
                    <span className="text-muted-foreground text-xs">
                      已自动保存
                    </span>
                  )}
                  <Badge variant={isOverLimit ? "destructive" : "secondary"}>
                    {wordCount}
                    {wordLimit !== null && ` / ${wordLimit}`} 字
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 p-4">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请在此输入你的答案..."
                className="h-full min-h-[300px] resize-none"
              />
            </CardContent>
          </Card>

          {/* File upload area */}
          {allowAttachment && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="size-4" />
                    附件上传
                  </CardTitle>
                  <span className="text-muted-foreground text-xs">
                    {files.length}/{maxAttachments} 个文件 | 支持：
                    {ALLOWED_EXTENSIONS.join(", ")} | 单文件最大 20MB
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Drop zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                    } ${files.length >= maxAttachments ? "pointer-events-none opacity-50" : ""}`}
                  >
                    <Upload className="text-muted-foreground mb-2 size-8" />
                    <p className="text-muted-foreground text-sm">
                      拖拽文件至此处，或点击选择文件
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
                      onChange={(e) => {
                        handleAddFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  {/* File list */}
                  {files.length > 0 && (
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between rounded-md border p-2"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="text-muted-foreground size-4" />
                            <span className="text-sm">{file.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => handleRemoveFile(file.id)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}
