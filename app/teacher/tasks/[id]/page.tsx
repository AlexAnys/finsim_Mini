"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  Pencil,
  Save,
  X,
  Plus,
  MessageSquare,
  HelpCircle,
  FileText,
  ExternalLink,
  Upload,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImportProgressDialog } from "@/components/task-edit/import-progress-dialog";

interface ScoringCriterion {
  id: string;
  name: string;
  description: string | null;
  maxPoints: number;
  order: number;
}

interface AllocationItem {
  id: string;
  label: string;
  order: number;
}

interface AllocationSection {
  id: string;
  label: string;
  order: number;
  items: AllocationItem[];
}

interface QuizQuestion {
  id: string;
  type: string;
  prompt: string;
  options: Array<{ id: string; text: string }> | null;
  correctOptionIds: string[];
  correctAnswer: string | null;
  points: number;
  explanation: string | null;
  order: number;
}

interface TaskInstance {
  id: string;
  title: string;
  status: string;
  dueAt: string;
  class: { id: string; name: string };
  _count?: { submissions: number };
}

interface TaskDetail {
  id: string;
  taskName: string;
  taskType: string;
  requirements: string | null;
  visibility: string;
  practiceEnabled: boolean;
  createdAt: string;
  simulationConfig?: {
    scenario: string;
    openingLine: string;
    dialogueRequirements: string | null;
    strictnessLevel: string;
    systemPrompt: string | null;
  } | null;
  quizConfig?: {
    mode: string;
    timeLimitMinutes: number | null;
    showCorrectAnswer: boolean;
  } | null;
  subjectiveConfig?: {
    prompt: string;
    allowTextAnswer: boolean;
    allowedAttachmentTypes: string[];
    strictnessLevel: string;
  } | null;
  scoringCriteria: ScoringCriterion[];
  allocationSections: AllocationSection[];
  quizQuestions: QuizQuestion[];
  taskInstances: TaskInstance[];
}

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

const questionTypeLabels: Record<string, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

const statusLabels: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  closed: "已关闭",
  archived: "已归档",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  published: "default",
  closed: "secondary",
  archived: "destructive",
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  // Unit 4: 高危改动拦截 dialog state
  const [highRiskOpen, setHighRiskOpen] = useState(false);
  const [highRiskGradedCount, setHighRiskGradedCount] = useState(0);
  const [pendingPatchBody, setPendingPatchBody] = useState<Record<string, unknown> | null>(null);
  const [copying, setCopying] = useState(false);
  // Unit 5a: 删除任务 confirm dialog
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get("edit") === "true");
  const [saving, setSaving] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editScenario, setEditScenario] = useState("");
  const [editOpeningLine, setEditOpeningLine] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editSimPersona, setEditSimPersona] = useState("");
  const [editSimDialogueStyle, setEditSimDialogueStyle] = useState("");
  const [editSimConstraints, setEditSimConstraints] = useState("");
  // Unit 4 commit-2: quiz config + questions
  const [editQuizMode, setEditQuizMode] = useState<"fixed" | "adaptive">("fixed");
  const [editQuizTimeLimit, setEditQuizTimeLimit] = useState<string>("");
  const [editQuizShowAnswer, setEditQuizShowAnswer] = useState(false);
  const [editQuestions, setEditQuestions] = useState<QuizQuestion[]>([]);
  // Unit 4 commit-2: scoring criteria
  const [editCriteria, setEditCriteria] = useState<ScoringCriterion[]>([]);
  // Unit 4 commit-3 r2: allocation sections
  const [editAllocations, setEditAllocations] = useState<AllocationSection[]>([]);

  const fetchTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载失败");
        return;
      }
      setTask(json.data);
      // Initialize edit form
      setEditName(json.data.taskName);
      setEditRequirements(json.data.requirements || "");
      if (json.data.simulationConfig) {
        setEditScenario(json.data.simulationConfig.scenario);
        setEditOpeningLine(json.data.simulationConfig.openingLine);
        // Parse systemPrompt back into sections
        const sp = json.data.simulationConfig.systemPrompt || "";
        if (sp) {
          const personaMatch = sp.match(/【核心人设】\n([\s\S]*?)(?=\n\n【|$)/);
          const styleMatch = sp.match(/【对话风格】\n([\s\S]*?)(?=\n\n【|$)/);
          const constraintMatch = sp.match(/【禁止行为】\n([\s\S]*?)(?=\n\n【|$)/);
          setEditSimPersona(personaMatch?.[1]?.trim() || "");
          setEditSimDialogueStyle(styleMatch?.[1]?.trim() || "");
          setEditSimConstraints(constraintMatch?.[1]?.trim() || "");
        }
      }
      if (json.data.subjectiveConfig) {
        setEditPrompt(json.data.subjectiveConfig.prompt);
      }
      if (json.data.quizConfig) {
        setEditQuizMode(json.data.quizConfig.mode === "adaptive" ? "adaptive" : "fixed");
        setEditQuizTimeLimit(
          json.data.quizConfig.timeLimitMinutes != null
            ? String(json.data.quizConfig.timeLimitMinutes)
            : "",
        );
        setEditQuizShowAnswer(!!json.data.quizConfig.showCorrectAnswer);
      }
      if (Array.isArray(json.data.quizQuestions)) {
        setEditQuestions(
          json.data.quizQuestions
            .slice()
            .sort((a: QuizQuestion, b: QuizQuestion) => a.order - b.order)
            .map((q: QuizQuestion) => ({ ...q })),
        );
      }
      if (Array.isArray(json.data.scoringCriteria)) {
        setEditCriteria(
          json.data.scoringCriteria
            .slice()
            .sort((a: ScoringCriterion, b: ScoringCriterion) => a.order - b.order)
            .map((c: ScoringCriterion) => ({ ...c })),
        );
      }
      if (Array.isArray(json.data.allocationSections)) {
        setEditAllocations(
          json.data.allocationSections
            .slice()
            .sort((a: AllocationSection, b: AllocationSection) => a.order - b.order)
            .map((sec: AllocationSection) => ({
              ...sec,
              items: sec.items
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((it) => ({ ...it })),
            })),
        );
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  function buildPatchBody(): Record<string, unknown> | null {
    if (!editName.trim()) {
      toast.error("任务名称不能为空");
      return null;
    }
    const body: Record<string, unknown> = {
      taskName: editName.trim(),
      requirements: editRequirements.trim() || undefined,
    };

    if (task?.taskType === "simulation" && task.simulationConfig) {
      // Build systemPrompt from the 3 prompt sections
      const promptParts = [
        editSimPersona.trim() ? `【核心人设】\n${editSimPersona.trim()}` : "",
        editSimDialogueStyle.trim() ? `【对话风格】\n${editSimDialogueStyle.trim()}` : "",
        editSimConstraints.trim() ? `【禁止行为】\n${editSimConstraints.trim()}` : "",
      ].filter(Boolean);
      // PR-FIX-4 D1: 同 new/page.tsx — 清掉旧 5 档 [MOOD:] 指令
      // (PR-7B 已切到 8 档 JSON 协议，运行时由 ai.service.chatReply 注入)
      const systemPrompt = promptParts.length > 0
        ? `你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：\n\n{scenario}\n\n${promptParts.join("\n\n")}`
        : undefined;

      body.simulationConfig = {
        scenario: editScenario.trim(),
        openingLine: editOpeningLine.trim(),
        dialogueRequirements: task.simulationConfig.dialogueRequirements,
        strictnessLevel: task.simulationConfig.strictnessLevel,
        systemPrompt,
      };
    }
    if (task?.taskType === "subjective" && task.subjectiveConfig) {
      body.subjectiveConfig = {
        prompt: editPrompt.trim(),
        allowTextAnswer: task.subjectiveConfig.allowTextAnswer,
        allowedAttachmentTypes: task.subjectiveConfig.allowedAttachmentTypes,
        strictnessLevel: task.subjectiveConfig.strictnessLevel,
      };
    }
    // Unit 4 commit-2: quiz config + questions
    if (task?.taskType === "quiz" && task.quizConfig) {
      const timeLimitNum = parseInt(editQuizTimeLimit.trim() || "0", 10);
      body.quizConfig = {
        mode: editQuizMode,
        timeLimitMinutes: timeLimitNum > 0 ? timeLimitNum : undefined,
        showCorrectAnswer: editQuizShowAnswer,
      };
      body.quizQuestions = editQuestions.map((q, idx) => ({
        type: q.type as
          | "single_choice"
          | "multiple_choice"
          | "true_false"
          | "short_answer",
        prompt: q.prompt.trim(),
        options: q.options ?? undefined,
        correctOptionIds: q.correctOptionIds,
        correctAnswer: q.correctAnswer?.trim() || undefined,
        points: q.points,
        explanation: q.explanation?.trim() || undefined,
        order: idx,
      }));
    }
    // Unit 4 commit-2: scoring criteria
    if (editCriteria.length > 0 || (task?.scoringCriteria.length ?? 0) > 0) {
      body.scoringCriteria = editCriteria.map((c, idx) => ({
        name: c.name.trim(),
        description: c.description?.trim() || undefined,
        maxPoints: c.maxPoints,
        order: idx,
      }));
    }
    // Unit 4 commit-3 r2: allocation sections (仅 simulation 任务在 wizard 创建时填）
    if (
      editAllocations.length > 0 ||
      (task?.allocationSections.length ?? 0) > 0
    ) {
      body.allocationSections = editAllocations.map((sec, idx) => ({
        label: sec.label.trim(),
        order: idx,
        items: sec.items.map((it, iidx) => ({
          label: it.label.trim(),
          order: iidx,
        })),
      }));
    }
    return body;
  }

  async function performPatch(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      // Unit 4 高危拦截：服务端返回 TASK_HAS_GRADED_SUBMISSIONS → 弹 dialog
      if (!json.success && json.error?.code === "TASK_HAS_GRADED_SUBMISSIONS") {
        // 拉一次最新的 graded 计数（服务端 details 没透传，简单查 task instances 列表估算）
        const count = task?.taskInstances.reduce(
          (acc, ti) => acc + (ti._count?.submissions ?? 0),
          0,
        ) ?? 0;
        setHighRiskGradedCount(count);
        setPendingPatchBody(body);
        setHighRiskOpen(true);
        return;
      }
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("保存成功");
      setEditing(false);
      setLoading(true);
      fetchTask();
      // Unit-FB1: 闭环 — 若来自 instance 页（returnTo 参数），保存后自动回去
      const returnTo = searchParams.get("returnTo");
      if (returnTo && returnTo.startsWith("/teacher/")) {
        router.push(returnTo);
      }
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const body = buildPatchBody();
    if (!body) return;
    await performPatch(body);
  }

  async function handleForceSave() {
    if (!pendingPatchBody) return;
    setHighRiskOpen(false);
    await performPatch({ ...pendingPatchBody, force: true });
    setPendingPatchBody(null);
  }

  async function handleCopyAsNew() {
    if (!task) return;
    setCopying(true);
    setHighRiskOpen(false);
    try {
      // 复制任务：拷全字段 + 改名为 "{原名} (副本)"。creatorId 由后端从 session 推断。
      const body: Record<string, unknown> = {
        taskType: task.taskType,
        taskName: `${editName.trim() || task.taskName} (副本)`,
        requirements: editRequirements.trim() || undefined,
        visibility: task.visibility,
        practiceEnabled: task.practiceEnabled,
      };

      if (task.taskType === "simulation" && task.simulationConfig) {
        const promptParts = [
          editSimPersona.trim() ? `【核心人设】\n${editSimPersona.trim()}` : "",
          editSimDialogueStyle.trim() ? `【对话风格】\n${editSimDialogueStyle.trim()}` : "",
          editSimConstraints.trim() ? `【禁止行为】\n${editSimConstraints.trim()}` : "",
        ].filter(Boolean);
        const systemPrompt = promptParts.length > 0
          ? `你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：\n\n{scenario}\n\n${promptParts.join("\n\n")}`
          : undefined;
        body.simulationConfig = {
          scenario: editScenario.trim(),
          openingLine: editOpeningLine.trim(),
          dialogueRequirements: task.simulationConfig.dialogueRequirements,
          strictnessLevel: task.simulationConfig.strictnessLevel,
          systemPrompt,
        };
      }
      if (task.taskType === "quiz" && task.quizConfig) {
        body.quizConfig = {
          mode: task.quizConfig.mode,
          timeLimitMinutes: task.quizConfig.timeLimitMinutes ?? undefined,
          showCorrectAnswer: task.quizConfig.showCorrectAnswer,
        };
        body.quizQuestions = task.quizQuestions.map((q, idx) => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options ?? undefined,
          correctOptionIds: q.correctOptionIds,
          correctAnswer: q.correctAnswer ?? undefined,
          points: q.points,
          explanation: q.explanation ?? undefined,
          order: idx,
        }));
      }
      if (task.taskType === "subjective" && task.subjectiveConfig) {
        body.subjectiveConfig = {
          prompt: editPrompt.trim(),
          allowTextAnswer: task.subjectiveConfig.allowTextAnswer,
          allowedAttachmentTypes: task.subjectiveConfig.allowedAttachmentTypes,
          strictnessLevel: task.subjectiveConfig.strictnessLevel,
        };
      }
      if (task.scoringCriteria.length > 0) {
        body.scoringCriteria = task.scoringCriteria.map((c, idx) => ({
          name: c.name,
          description: c.description ?? undefined,
          maxPoints: c.maxPoints,
          order: idx,
        }));
      }
      if (task.allocationSections.length > 0) {
        body.allocationSections = task.allocationSections.map((sec, idx) => ({
          label: sec.label,
          order: idx,
          items: sec.items.map((it, iidx) => ({
            label: it.label,
            order: iidx,
          })),
        }));
      }

      const res = await fetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "复制失败");
        return;
      }
      toast.success("已复制为新任务");
      router.push(`/teacher/tasks/${json.data.id}?edit=true`);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setCopying(false);
      setPendingPatchBody(null);
    }
  }

  async function handleConfirmedDeleteTask() {
    setDeletingTask(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "删除失败");
        return;
      }
      toast.success("任务已删除");
      router.push("/teacher/tasks");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setDeletingTask(false);
      setDeleteTaskOpen(false);
    }
  }

  async function handleImportPDF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Open dialog immediately with "uploading" state
    setImportFileName(file.name);
    setImportJobId(null);
    setImportDialogOpen(true);
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", taskId);

      const res = await fetch("/api/import-jobs", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "上传失败");
        setImportDialogOpen(false);
        setImporting(false);
        return;
      }

      // Hand off to dialog — it will poll status until completion / failure
      setImportJobId(json.data.id);
    } catch {
      toast.error("上传失败，请重试");
      setImportDialogOpen(false);
      setImporting(false);
    }
  }

  function handleImportComplete(totalQuestions: number) {
    toast.success(`成功导入 ${totalQuestions} 道题目`);
    fetchTask();
  }

  function handleImportClose() {
    setImportDialogOpen(false);
    setImportJobId(null);
    setImportFileName(null);
    setImporting(false);
  }

  function handleImportRetry() {
    setImportDialogOpen(false);
    setImportJobId(null);
    setImportFileName(null);
    setImporting(false);
    // Re-open file picker
    setTimeout(() => importFileRef.current?.click(), 50);
  }

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

  if (!task) return null;

  const Icon = taskTypeIcons[task.taskType] || FileText;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/teacher/tasks" className="hover:text-foreground">
          任务管理
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">{task.taskName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
            <Icon className="size-6" />
          </div>
          <div>
            {editing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xl font-bold h-auto py-1"
              />
            ) : (
              <h1 className="text-2xl font-bold">{task.taskName}</h1>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">
                {taskTypeLabels[task.taskType] || task.taskType}
              </Badge>
              <span className="text-sm text-muted-foreground">
                创建于 {new Date(task.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  // Unit-FB1: 闭环 — 取消编辑时若来自 instance 页自动回去
                  const returnTo = searchParams.get("returnTo");
                  if (returnTo && returnTo.startsWith("/teacher/")) {
                    router.push(returnTo);
                    return;
                  }
                  // Reset edit values
                  setEditName(task.taskName);
                  setEditRequirements(task.requirements || "");
                  if (task.simulationConfig) {
                    setEditScenario(task.simulationConfig.scenario);
                    setEditOpeningLine(task.simulationConfig.openingLine);
                    const sp = task.simulationConfig.systemPrompt || "";
                    const pm = sp.match(/【核心人设】\n([\s\S]*?)(?=\n\n【|$)/);
                    const sm = sp.match(/【对话风格】\n([\s\S]*?)(?=\n\n【|$)/);
                    const cm = sp.match(/【禁止行为】\n([\s\S]*?)(?=\n\n【|$)/);
                    setEditSimPersona(pm?.[1]?.trim() || "");
                    setEditSimDialogueStyle(sm?.[1]?.trim() || "");
                    setEditSimConstraints(cm?.[1]?.trim() || "");
                  }
                }}
              >
                <X className="size-4 mr-1" />
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Save className="size-4 mr-1" />
                )}
                保存
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4 mr-1" />
                编辑
              </Button>
              {task.taskInstances.length === 0 ? (
                <Button
                  variant="outline"
                  onClick={() => setDeleteTaskOpen(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4 mr-1" />
                  删除任务
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        variant="outline"
                        disabled
                        className="text-destructive opacity-50"
                      >
                        <Trash2 className="size-4 mr-1" />
                        删除任务
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    该任务已发布 {task.taskInstances.length} 个实例，请先删除实例再删任务
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* Description / Requirements */}
      {(task.requirements || editing) && (
        <Card>
          <CardHeader>
            <CardTitle>任务描述</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <Textarea
                value={editRequirements}
                onChange={(e) => setEditRequirements(e.target.value)}
                placeholder="任务描述..."
                rows={3}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{task.requirements}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Simulation Config */}
      {task.taskType === "simulation" && task.simulationConfig && (
        <Card>
          <CardHeader>
            <CardTitle>模拟对话配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">角色扮演场景</Label>
              {editing ? (
                <Textarea
                  value={editScenario}
                  onChange={(e) => setEditScenario(e.target.value)}
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {task.simulationConfig.scenario}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">AI 开场白</Label>
              {editing ? (
                <Input
                  value={editOpeningLine}
                  onChange={(e) => setEditOpeningLine(e.target.value)}
                />
              ) : (
                <p className="text-sm">{task.simulationConfig.openingLine}</p>
              )}
            </div>
            {task.simulationConfig.dialogueRequirements && (
              <div className="space-y-1">
                <Label className="text-muted-foreground">对话要求</Label>
                <p className="text-sm whitespace-pre-wrap">
                  {task.simulationConfig.dialogueRequirements}
                </p>
              </div>
            )}

            <Separator />
            <p className="text-xs text-muted-foreground">
              以下提示词控制 AI 客户的行为方式。{!editing && "点击「编辑」可修改。"}
            </p>

            <div className="space-y-1">
              <Label className="text-muted-foreground">核心人设</Label>
              {editing ? (
                <Textarea
                  value={editSimPersona}
                  onChange={(e) => setEditSimPersona(e.target.value)}
                  placeholder="描述 AI 客户的性格、背景和态度..."
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {(() => {
                    const sp = task.simulationConfig!.systemPrompt || "";
                    const m = sp.match(/【核心人设】\n([\s\S]*?)(?=\n\n【|$)/);
                    return m?.[1]?.trim() || "（使用默认值）";
                  })()}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">对话风格</Label>
              {editing ? (
                <Textarea
                  value={editSimDialogueStyle}
                  onChange={(e) => setEditSimDialogueStyle(e.target.value)}
                  placeholder="描述 AI 客户的说话方式和回复规则..."
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {(() => {
                    const sp = task.simulationConfig!.systemPrompt || "";
                    const m = sp.match(/【对话风格】\n([\s\S]*?)(?=\n\n【|$)/);
                    return m?.[1]?.trim() || "（使用默认值）";
                  })()}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-muted-foreground">禁止行为</Label>
              {editing ? (
                <Textarea
                  value={editSimConstraints}
                  onChange={(e) => setEditSimConstraints(e.target.value)}
                  placeholder="列出 AI 客户不应做的事情..."
                  rows={3}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {(() => {
                    const sp = task.simulationConfig!.systemPrompt || "";
                    const m = sp.match(/【禁止行为】\n([\s\S]*?)(?=\n\n【|$)/);
                    return m?.[1]?.trim() || "（使用默认值）";
                  })()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quiz Config */}
      {task.taskType === "quiz" && task.quizConfig && (
        <Card>
          <CardHeader>
            <CardTitle>测验配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">模式</Label>
                  <Select
                    value={editQuizMode}
                    onValueChange={(v: "fixed" | "adaptive") => setEditQuizMode(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">固定题目</SelectItem>
                      <SelectItem value="adaptive">自适应</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">时间限制（分钟，0 不限）</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editQuizTimeLimit}
                    onChange={(e) => setEditQuizTimeLimit(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">显示答案</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Switch
                      checked={editQuizShowAnswer}
                      onCheckedChange={setEditQuizShowAnswer}
                    />
                    <span className="text-xs text-muted-foreground">
                      {editQuizShowAnswer ? "是" : "否"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <span className="text-muted-foreground">模式: </span>
                  {task.quizConfig.mode === "fixed" ? "固定题目" : "自适应"}
                </div>
                <div>
                  <span className="text-muted-foreground">时间限制: </span>
                  {task.quizConfig.timeLimitMinutes
                    ? `${task.quizConfig.timeLimitMinutes} 分钟`
                    : "不限时"}
                </div>
                <div>
                  <span className="text-muted-foreground">显示答案: </span>
                  {task.quizConfig.showCorrectAnswer ? "是" : "否"}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subjective Config */}
      {task.taskType === "subjective" && task.subjectiveConfig && (
        <Card>
          <CardHeader>
            <CardTitle>主观题配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground">题目提示</Label>
              {editing ? (
                <Textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={4}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {task.subjectiveConfig.prompt}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <span className="text-muted-foreground">允许文本回答: </span>
                {task.subjectiveConfig.allowTextAnswer ? "是" : "否"}
              </div>
              <div>
                <span className="text-muted-foreground">附件类型: </span>
                {(task.subjectiveConfig.allowedAttachmentTypes?.length ?? 0) > 0
                  ? task.subjectiveConfig.allowedAttachmentTypes!.join(", ")
                  : "不允许附件"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scoring Criteria */}
      {(task.scoringCriteria.length > 0 || editing) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>评分标准</CardTitle>
              {editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditCriteria((arr) => [
                      ...arr,
                      {
                        id: `new-${Date.now()}`,
                        name: "",
                        description: "",
                        maxPoints: 10,
                        order: arr.length,
                      },
                    ])
                  }
                >
                  <Plus className="size-3 mr-1" />
                  添加标准
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                {editCriteria.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无评分标准，点「添加标准」开始。</p>
                ) : (
                  editCriteria.map((c, idx) => (
                    <div key={c.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="标准名称"
                          value={c.name}
                          onChange={(e) =>
                            setEditCriteria((arr) =>
                              arr.map((it, i) =>
                                i === idx ? { ...it, name: e.target.value } : it,
                              ),
                            )
                          }
                        />
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={c.maxPoints}
                          onChange={(e) =>
                            setEditCriteria((arr) =>
                              arr.map((it, i) =>
                                i === idx
                                  ? { ...it, maxPoints: parseInt(e.target.value, 10) || 0 }
                                  : it,
                              ),
                            )
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setEditCriteria((arr) => arr.filter((_, i) => i !== idx))
                          }
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="描述（可选）"
                        rows={2}
                        value={c.description ?? ""}
                        onChange={(e) =>
                          setEditCriteria((arr) =>
                            arr.map((it, i) =>
                              i === idx ? { ...it, description: e.target.value } : it,
                            ),
                          )
                        }
                      />
                    </div>
                  ))
                )}
                <p className="text-sm text-muted-foreground">
                  总分: {editCriteria.reduce((s, c) => s + (c.maxPoints || 0), 0)} 分
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>最高分</TableHead>
                      <TableHead>描述</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {task.scoringCriteria
                      .sort((a, b) => a.order - b.order)
                      .map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.maxPoints}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {c.description || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-sm text-muted-foreground">
                  总分:{" "}
                  {task.scoringCriteria.reduce((sum, c) => sum + c.maxPoints, 0)} 分
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Allocation Sections */}
      {(task.allocationSections.length > 0 ||
        (editing && task.taskType === "simulation")) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>资产配置</CardTitle>
              {editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditAllocations((arr) => [
                      ...arr,
                      {
                        id: `new-sec-${Date.now()}`,
                        label: "",
                        order: arr.length,
                        items: [],
                      },
                    ])
                  }
                >
                  <Plus className="size-3 mr-1" />
                  添加分区
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {editing ? (
              editAllocations.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无资产配置分区，点「添加分区」开始。</p>
              ) : (
                editAllocations.map((sec, secIdx) => (
                  <div key={sec.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="分区名称（如：资产配置方案 / 资金安排）"
                        value={sec.label}
                        onChange={(e) =>
                          setEditAllocations((arr) =>
                            arr.map((it, i) =>
                              i === secIdx ? { ...it, label: e.target.value } : it,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditAllocations((arr) =>
                            arr.filter((_, i) => i !== secIdx),
                          )
                        }
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <div className="space-y-1 pl-2">
                      {sec.items.length === 0 && (
                        <p className="text-xs text-muted-foreground">该分区暂无条目。</p>
                      )}
                      {sec.items.map((item, itIdx) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <Input
                            placeholder={`条目 ${itIdx + 1}`}
                            value={item.label}
                            onChange={(e) =>
                              setEditAllocations((arr) =>
                                arr.map((s, i) => {
                                  if (i !== secIdx) return s;
                                  return {
                                    ...s,
                                    items: s.items.map((it, j) =>
                                      j === itIdx ? { ...it, label: e.target.value } : it,
                                    ),
                                  };
                                }),
                              )
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setEditAllocations((arr) =>
                                arr.map((s, i) => {
                                  if (i !== secIdx) return s;
                                  return {
                                    ...s,
                                    items: s.items.filter((_, j) => j !== itIdx),
                                  };
                                }),
                              )
                            }
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditAllocations((arr) =>
                            arr.map((s, i) => {
                              if (i !== secIdx) return s;
                              return {
                                ...s,
                                items: [
                                  ...s.items,
                                  {
                                    id: `new-item-${Date.now()}`,
                                    label: "",
                                    order: s.items.length,
                                  },
                                ],
                              };
                            }),
                          )
                        }
                      >
                        <Plus className="size-3 mr-1" />
                        添加条目
                      </Button>
                    </div>
                  </div>
                ))
              )
            ) : (
              task.allocationSections
                .sort((a, b) => a.order - b.order)
                .map((section) => (
                  <div key={section.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{section.label}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {section.items
                        .sort((a, b) => a.order - b.order)
                        .map((item) => (
                          <Badge key={item.id} variant="outline">
                            {item.label}
                          </Badge>
                        ))}
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Quiz Questions */}
      {task.taskType === "quiz" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                题目列表（{editing ? editQuestions.length : task.quizQuestions.length} 题）
              </CardTitle>
              <div className="flex items-center gap-2">
                {editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setEditQuestions((arr) => [
                        ...arr,
                        {
                          id: `new-${Date.now()}`,
                          type: "single_choice",
                          prompt: "",
                          options: [
                            { id: "A", text: "" },
                            { id: "B", text: "" },
                            { id: "C", text: "" },
                            { id: "D", text: "" },
                          ],
                          correctOptionIds: [],
                          correctAnswer: null,
                          points: 1,
                          explanation: null,
                          order: arr.length,
                        },
                      ])
                    }
                  >
                    <Plus className="size-3 mr-1" />
                    添加题目
                  </Button>
                )}
                <input
                  ref={importFileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleImportPDF}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <Upload className="size-3 mr-1" />
                  )}
                  从 PDF 导入题目
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              editQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无题目，点「添加题目」或「从 PDF 导入」开始。</p>
              ) : (
                editQuestions.map((q, i) => (
                  <div key={q.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={q.type}
                        onValueChange={(v) =>
                          setEditQuestions((arr) =>
                            arr.map((it, idx) => (idx === i ? { ...it, type: v } : it)),
                          )
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_choice">单选题</SelectItem>
                          <SelectItem value="multiple_choice">多选题</SelectItem>
                          <SelectItem value="true_false">判断题</SelectItem>
                          <SelectItem value="short_answer">简答题</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        className="w-20"
                        value={q.points}
                        onChange={(e) =>
                          setEditQuestions((arr) =>
                            arr.map((it, idx) =>
                              idx === i
                                ? { ...it, points: parseInt(e.target.value, 10) || 1 }
                                : it,
                            ),
                          )
                        }
                      />
                      <span className="text-xs text-muted-foreground">分</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditQuestions((arr) => arr.filter((_, idx) => idx !== i))
                        }
                        className="ml-auto text-destructive hover:text-destructive"
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder={`第 ${i + 1} 题题干`}
                      value={q.prompt}
                      onChange={(e) =>
                        setEditQuestions((arr) =>
                          arr.map((it, idx) =>
                            idx === i ? { ...it, prompt: e.target.value } : it,
                          ),
                        )
                      }
                      rows={2}
                    />
                    {(q.type === "single_choice" ||
                      q.type === "multiple_choice" ||
                      q.type === "true_false") && (
                      <div className="space-y-1 pl-4">
                        {(q.options ?? []).map((opt, oIdx) => {
                          const isCorrect = q.correctOptionIds.includes(opt.id);
                          return (
                            <div key={opt.id} className="flex items-center gap-2">
                              <input
                                type={q.type === "multiple_choice" ? "checkbox" : "radio"}
                                name={`q-${q.id}-correct`}
                                checked={isCorrect}
                                onChange={(e) =>
                                  setEditQuestions((arr) =>
                                    arr.map((it, idx) => {
                                      if (idx !== i) return it;
                                      const next = q.type === "multiple_choice"
                                        ? e.target.checked
                                          ? [...it.correctOptionIds, opt.id]
                                          : it.correctOptionIds.filter((x) => x !== opt.id)
                                        : [opt.id];
                                      return { ...it, correctOptionIds: next };
                                    }),
                                  )
                                }
                              />
                              <span className="text-sm font-medium w-6">{opt.id}.</span>
                              <Input
                                value={opt.text}
                                onChange={(e) =>
                                  setEditQuestions((arr) =>
                                    arr.map((it, idx) => {
                                      if (idx !== i) return it;
                                      const options = (it.options ?? []).map((o, j) =>
                                        j === oIdx ? { ...o, text: e.target.value } : o,
                                      );
                                      return { ...it, options };
                                    }),
                                  )
                                }
                                placeholder={`选项 ${opt.id}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {q.type === "short_answer" && (
                      <Textarea
                        placeholder="参考答案"
                        value={q.correctAnswer ?? ""}
                        onChange={(e) =>
                          setEditQuestions((arr) =>
                            arr.map((it, idx) =>
                              idx === i ? { ...it, correctAnswer: e.target.value } : it,
                            ),
                          )
                        }
                        rows={2}
                      />
                    )}
                    <Textarea
                      placeholder="解析（可选）"
                      value={q.explanation ?? ""}
                      onChange={(e) =>
                        setEditQuestions((arr) =>
                          arr.map((it, idx) =>
                            idx === i ? { ...it, explanation: e.target.value } : it,
                          ),
                        )
                      }
                      rows={2}
                    />
                  </div>
                ))
              )
            ) : (
              task.quizQuestions
                .sort((a, b) => a.order - b.order)
                .map((q, i) => (
                  <div key={q.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {questionTypeLabels[q.type] || q.type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {q.points} 分
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {i + 1}. {q.prompt}
                    </p>
                    {q.options && Array.isArray(q.options) && (
                      <div className="pl-4 space-y-1">
                        {q.options.map((opt: { id: string; text: string }) => (
                          <p
                            key={opt.id}
                            className={`text-sm ${
                              q.correctOptionIds.includes(opt.id)
                                ? "text-green-600 font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {opt.id}. {opt.text}
                            {q.correctOptionIds.includes(opt.id) && " (正确)"}
                          </p>
                        ))}
                      </div>
                    )}
                    {q.correctAnswer && (
                      <p className="text-sm text-green-600">
                        参考答案: {q.correctAnswer}
                      </p>
                    )}
                    {q.explanation && (
                      <p className="text-xs text-muted-foreground">
                        解析: {q.explanation}
                      </p>
                    )}
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Task Instances */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>已发布的任务实例</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/teacher/instances">
                <Plus className="size-3 mr-1" />
                查看全部实例
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {task.taskInstances.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无已发布的实例</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>班级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>截止日期</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {task.taskInstances.map((ti) => (
                  <TableRow key={ti.id}>
                    <TableCell className="font-medium">{ti.title}</TableCell>
                    <TableCell>{ti.class.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[ti.status] || "outline"}>
                        {statusLabels[ti.status] || ti.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(ti.dueAt).toLocaleDateString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/teacher/instances/${ti.id}`}>
                          <ExternalLink className="size-3 mr-1" />
                          查看
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PDF 导入进度对话框 */}
      <ImportProgressDialog
        open={importDialogOpen}
        onClose={handleImportClose}
        jobId={importJobId}
        fileName={importFileName}
        onComplete={handleImportComplete}
        onRetry={handleImportRetry}
      />

      {/* Unit 5a: 删除任务 confirm dialog */}
      <AlertDialog
        open={deleteTaskOpen}
        onOpenChange={(open) => !open && !deletingTask && setDeleteTaskOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除任务模板</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{task.taskName}」？此操作不可恢复。如果任务已发布过实例，将被服务端拒绝。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTask}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedDeleteTask}
              disabled={deletingTask}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingTask ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  删除中...
                </>
              ) : (
                "确认删除"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unit 4: 高危改动拦截 dialog */}
      <AlertDialog
        open={highRiskOpen}
        onOpenChange={(open) => {
          if (!open) {
            setHighRiskOpen(false);
            setPendingPatchBody(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              该任务已有 {highRiskGradedCount} 条已批改提交
            </AlertDialogTitle>
            <AlertDialogDescription>
              直接修改可能影响这些学生的分数解读。<span className="font-medium">推荐复制为新任务再修改</span>。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving || copying}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCopyAsNew}
              disabled={saving || copying}
            >
              {copying ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  复制中...
                </>
              ) : (
                "复制为新任务"
              )}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleForceSave}
              disabled={saving || copying}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "直接保存"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
