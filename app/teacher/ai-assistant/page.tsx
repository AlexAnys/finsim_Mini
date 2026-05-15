"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Copy,
  FileCheck2,
  Loader2,
  RotateCcw,
  SearchCheck,
  Settings2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LessonPolishResult } from "@/components/ai-assistant/lesson-polish-result";
import { IdeologyMiningResult } from "@/components/ai-assistant/ideology-mining-result";
import { QuestionAnalysisResult } from "@/components/ai-assistant/question-analysis-result";
import { ExamCheckResult } from "@/components/ai-assistant/exam-check-result";
import {
  usePersistedJob,
  readActiveTool,
  writeActiveTool,
  clearPersistedJob,
  type AiToolKey,
  type PersistedAiResult,
  type PersistedAsyncJob,
} from "@/lib/hooks/use-persisted-job";

type ToolKey = AiToolKey;

type AiResult = PersistedAiResult;
type AsyncJobSnapshot = PersistedAsyncJob;

const TOOLS: Array<{
  key: ToolKey;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
}> = [
  {
    key: "lessonPolish",
    label: "教案完善",
    desc: "完善目标、活动、评价和课堂话术",
    icon: BookOpenCheck,
    placeholder: "粘贴教案片段，或说明希望完善的课程主题、课时、学生基础...",
  },
  {
    key: "ideologyMining",
    label: "思政挖掘",
    desc: "自然提炼专业课里的育人融合点",
    icon: Sparkles,
    placeholder: "粘贴课堂内容，说明专业方向和希望避免的表达边界...",
  },
  {
    key: "questionAnalysis",
    label: "搜题与解析",
    desc: "识别题型、知识点、步骤和易错点",
    icon: SearchCheck,
    placeholder: "粘贴题目，或上传题目图片/试卷片段...",
  },
  {
    key: "examCheck",
    label: "试卷检查",
    desc: "按答案和评分规则辅助批改试卷",
    icon: FileCheck2,
    placeholder: "粘贴标准答案、评分规则和学生作答说明，也可以上传多个文件...",
  },
];

export default function AIAssistantPage() {
  const [activeTool, setActiveToolRaw] = useState<ToolKey>("lessonPolish");
  const [text, setText] = useState("");
  const [teacherRequest, setTeacherRequest] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [outputStyle, setOutputStyle] = useState("structured");
  const [strictness, setStrictness] = useState("balanced");
  const [enableSearch, setEnableSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<AsyncJobSnapshot | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [originalResult, setOriginalResult] = useState<AiResult | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { state: persisted, hydrated, update: persistPatch, reset: persistReset } =
    usePersistedJob(activeTool);

  // 切回工具时一次性同步 5 input + job + result + originalResult（hook hydrate 后）
  useEffect(() => {
    if (!hydrated) return;
    setText(persisted.text);
    setTeacherRequest(persisted.teacherRequest);
    setOutputStyle(persisted.outputStyle);
    setStrictness(persisted.strictness);
    setEnableSearch(persisted.enableSearch);
    setJob(persisted.job);
    setResult(persisted.result);
    setOriginalResult(persisted.originalResult);
    // files 不持久（File 无法序列化），切回需要重传
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, hydrated]);

  // 切工具时同步首选项
  const setActiveTool = useCallback((next: ToolKey) => {
    setActiveToolRaw(next);
    writeActiveTool(next);
  }, []);

  // 首次挂载：恢复 activeTool
  useEffect(() => {
    const saved = readActiveTool();
    if (saved && saved !== "lessonPolish") setActiveToolRaw(saved);
  }, []);

  // hydrate 后若 cache 里有未完成 job，立即拉一次最新状态（触发轮询接管）
  useEffect(() => {
    if (!hydrated || !persisted.job?.id) return;
    const cachedJob = persisted.job;
    if (cachedJob.status !== "queued" && cachedJob.status !== "running") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/async-jobs/${cachedJob.id}`);
        if (res.status === 403 || res.status === 404) {
          if (!cancelled) {
            persistReset();
            setJob(null);
            setResult(null);
            setOriginalResult(null);
          }
          return;
        }
        const json = await res.json();
        if (!json.success || cancelled) return;
        const next = json.data as AsyncJobSnapshot;
        setJob(next);
        if (next.status === "succeeded" && next.result) {
          setOriginalResult(next.result);
          setResult(next.result);
        }
      } catch {
        // 网络错误，保留 cache，下一轮轮询继续
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // 把当前 in-memory state 持续写回 cache（debounce 不必要，localStorage 同步快）
  useEffect(() => {
    if (!hydrated) return;
    persistPatch({
      text,
      teacherRequest,
      outputStyle,
      strictness,
      enableSearch,
      job,
      result,
      originalResult,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, teacherRequest, outputStyle, strictness, enableSearch, job, result, originalResult, hydrated]);

  const active = useMemo(() => TOOLS.find((tool) => tool.key === activeTool) ?? TOOLS[0], [activeTool]);
  const Icon = active.icon;
  const processing = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    if (!job?.id || !processing) return;

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/async-jobs/${job.id}`);
        if (res.status === 403 || res.status === 404) {
          if (cancelled) return;
          clearPersistedJob(activeTool);
          setJob(null);
          setResult(null);
          setOriginalResult(null);
          return;
        }
        const json = await res.json();
        if (!json.success || cancelled) return;
        const next = json.data as AsyncJobSnapshot;
        setJob(next);
        if (next.status === "succeeded" && next.result) {
          setOriginalResult(next.result);
          setResult(next.result);
        }
      } catch {
        // 后台轮询失败时保留当前状态，下一轮继续。
      }
    }, 1400);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [job?.id, processing, activeTool]);

  async function runTool() {
    if (!text.trim() && files.length === 0 && !teacherRequest.trim()) {
      toast.error("请粘贴内容、填写需求或上传文件");
      return;
    }
    setSubmitting(true);
    setJob(null);
    setResult(null);
    setOriginalResult(null);
    try {
      const form = new FormData();
      form.set("toolKey", activeTool);
      form.set("text", text);
      form.set("teacherRequest", teacherRequest);
      form.set("outputStyle", outputStyle);
      form.set("strictness", strictness);
      form.set("enableSearch", String(enableSearch));
      files.forEach((file) => form.append("files", file));

      const res = await fetch("/api/ai/work-assistant", { method: "POST", body: form });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "AI 工具运行失败");
        return;
      }
      setJob(json.data.job as AsyncJobSnapshot);
      toast.success("已提交后台分析，结果会自动刷新");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function retryJob() {
    if (!job?.id) return;
    try {
      const res = await fetch(`/api/async-jobs/${job.id}/retry`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "重试失败");
        return;
      }
      setJob(json.data as AsyncJobSnapshot);
      setResult(null);
      setOriginalResult(null);
      toast.success("已重新提交后台分析");
    } catch {
      toast.error("网络错误，请稍后重试");
    }
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatResultForCopy(result));
      toast.success("已复制当前编辑后的结果");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  }

  function resetResult() {
    if (!originalResult) return;
    setResult(originalResult);
    toast.success("已恢复 AI 原始结果");
  }

  function patchResult(patch: Partial<AiResult>) {
    setResult((current) => (current ? { ...current, ...patch } : current));
  }

  function patchSection(index: number, patch: Partial<AiResult["sections"][number]>) {
    setResult((current) => {
      if (!current) return current;
      const next = current.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section,
      );
      return { ...current, sections: next };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-brand">AI 工作助手</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.02em] text-ink">教师日常材料处理</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-4">
            上传或粘贴课堂材料，灵析会先识别文本，再生成可供教师审核的参考建议。
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/teacher/ai-settings">
            <Settings2 className="mr-2 size-4" />
            AI 设置
          </a>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map((tool) => {
          const ToolIcon = tool.icon;
          const selected = activeTool === tool.key;
          return (
            <button
              key={tool.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveTool(tool.key)}
              className={`flex min-h-[88px] w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                selected
                  ? "border-brand bg-brand-soft shadow-[0_0_0_1px_rgba(30,58,138,0.16)]"
                  : "border-line bg-surface hover:border-brand/40 hover:bg-paper-alt"
              }`}
            >
              <ToolIcon className="mt-0.5 size-4 shrink-0 text-brand" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{tool.label}</span>
                <span className="mt-1 block text-xs leading-5 text-ink-4">{tool.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="min-w-0 border-line bg-surface shadow-fs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Icon className="size-5 text-brand" />
              {active.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed border-line bg-paper-alt p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink-2">
                    <Upload className="size-4 text-brand" />
                    上传材料
                  </div>
                  <p className="mt-1 text-xs text-ink-4">支持 PDF、DOCX、TXT/MD、ZIP、图片；扫描件需 OCR provider。</p>
                </div>
                <Input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="application/pdf,.pdf,.docx,text/plain,text/markdown,.txt,.md,.zip,image/png,image/jpeg,image/webp"
                  className="w-full max-w-[360px] bg-surface text-xs"
                  disabled={submitting || processing}
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                />
              </div>
              {files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {files.map((file) => (
                    <Badge key={`${file.name}-${file.size}`} variant="outline" className="bg-surface">
                      {file.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>粘贴内容</Label>
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={active.placeholder}
                rows={8}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label>教师补充要求</Label>
              <Textarea
                value={teacherRequest}
                onChange={(event) => setTeacherRequest(event.target.value)}
                placeholder="例如：面向中职二年级，语言更口语化；试卷按 100 分制；思政点避免生硬口号。"
                rows={3}
                disabled={submitting}
              />
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="w-full">
                  <Settings2 className="mr-2 size-4" />
                  本次工具设置
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>本次输出设置</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label>输出风格</Label>
                    <Select value={outputStyle} onValueChange={setOutputStyle}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="structured">结构化清单</SelectItem>
                        <SelectItem value="lesson-ready">可直接放进教案</SelectItem>
                        <SelectItem value="brief">简洁摘要</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>严格度</Label>
                    <Select value={strictness} onValueChange={setStrictness}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lenient">宽松</SelectItem>
                        <SelectItem value="balanced">均衡</SelectItem>
                        <SelectItem value="strict">严格</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-line p-3">
                    <div>
                      <div className="text-sm font-medium text-ink-2">请求搜索增强</div>
                      <div className="text-xs text-ink-4">未配置搜索 provider 时不会伪造联网结果。</div>
                    </div>
                    <Switch checked={enableSearch} onCheckedChange={setEnableSearch} />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Button onClick={runTool} disabled={submitting || processing} className="w-full">
              {submitting || processing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              {processing ? "后台分析中" : "开始分析"}
            </Button>
          </CardContent>
        </Card>

        <Card className="min-h-[620px] min-w-0 border-line bg-surface shadow-fs">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">分析结果</CardTitle>
              <div className="flex items-center gap-2">
                {job && <Badge variant="outline">{jobStatusLabel(job.status)}</Badge>}
                {result?.fallback && <Badge className="bg-warn-soft text-warn">AI fallback</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-w-0">
            {!result ? (
              <div className="flex min-h-[480px] flex-col items-center justify-center rounded-lg border border-line bg-paper-alt p-6 text-center text-ink-4">
                {job ? (
                  <JobProgressPanel job={job} onRetry={retryJob} />
                ) : (
                  <>
                    <Sparkles className="mb-3 size-9 text-brand" />
                    <p className="text-sm font-medium text-ink-3">选择工具并输入材料后开始分析</p>
                    <p className="mt-1 text-xs">结果会按教师可审核的结构展示。</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-ink-4">
                    结果可直接编辑；复制时会使用当前编辑后的内容。
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={resetResult} disabled={!originalResult}>
                      <RotateCcw className="mr-1.5 size-3.5" />
                      复原
                    </Button>
                    <Button type="button" size="sm" onClick={copyResult}>
                      <Copy className="mr-1.5 size-3.5" />
                      复制结果
                    </Button>
                  </div>
                </div>

                {renderResultByTool(activeTool, result, patchResult, patchSection)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function JobProgressPanel({ job, onRetry }: { job: AsyncJobSnapshot; onRetry: () => void }) {
  const failed = job.status === "failed" || job.status === "canceled";
  const succeeded = job.status === "succeeded";
  const progress = Math.max(5, Math.min(100, job.progress || (succeeded ? 100 : 10)));
  const Icon = failed ? AlertCircle : succeeded ? CheckCircle2 : job.status === "running" ? Loader2 : Clock3;

  return (
    <div className="w-full max-w-md space-y-4">
      <div
        className={`mx-auto grid size-12 place-items-center rounded-full ${
          failed
            ? "bg-danger-soft text-danger"
            : succeeded
              ? "bg-success-soft text-success"
              : "bg-brand-soft text-brand"
        }`}
      >
        <Icon className={`size-6 ${job.status === "running" ? "animate-spin" : ""}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-2">{jobStatusLabel(job.status)}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-4">
          {failed ? "后台处理失败，材料仍保留，可查看原因后重试。" : "系统正在后台识别材料并生成可编辑建议。"}
        </p>
      </div>
      <div className="space-y-2 text-left">
        <div className="flex items-center justify-between text-xs text-ink-4">
          <span>后台任务</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div className={`h-full rounded-full ${failed ? "bg-danger" : "bg-brand"}`} style={{ width: `${progress}%` }} />
        </div>
        {job.error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
            {job.error}
          </p>
        )}
      </div>
      {failed && (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCcw className="mr-2 size-4" />
          重试后台分析
        </Button>
      )}
    </div>
  );
}

function jobStatusLabel(status: AsyncJobSnapshot["status"]) {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "处理中";
    case "succeeded":
      return "已完成";
    case "failed":
      return "处理失败";
    case "canceled":
      return "已取消";
  }
}

function renderResultByTool(
  toolKey: ToolKey,
  result: AiResult,
  patchResult: (patch: Partial<AiResult>) => void,
  patchSection: (index: number, patch: Partial<AiResult["sections"][number]>) => void,
) {
  const props = { result, patchResult, patchSection };
  switch (toolKey) {
    case "ideologyMining":
      return <IdeologyMiningResult {...props} />;
    case "questionAnalysis":
      return <QuestionAnalysisResult {...props} />;
    case "examCheck":
      return <ExamCheckResult {...props} />;
    case "lessonPolish":
    default:
      return <LessonPolishResult {...props} />;
  }
}

function formatResultForCopy(result: AiResult) {
  const sections = result.sections
    .map((section) => {
      const suggestions = section.suggestions.map((item) => `- ${item}`).join("\n");
      const examples = section.examples.map((item) => `- ${item}`).join("\n");
      return [
        `## ${section.heading}`,
        section.diagnosis,
        suggestions ? `建议：\n${suggestions}` : "",
        examples ? `示例：\n${examples}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");

  const actionItems = result.actionItems.length
    ? `## 下一步动作\n${result.actionItems.map((item) => `- ${item}`).join("\n")}`
    : "";
  const cautions = result.cautions.length
    ? `## 需复核事项\n${result.cautions.map((item) => `- ${item}`).join("\n")}`
    : "";

  return [`# ${result.title}`, result.summary, sections, actionItems, cautions].filter(Boolean).join("\n\n");
}
