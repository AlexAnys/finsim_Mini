"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
import { toast } from "sonner";

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
  const searchParams = useSearchParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get("edit") === "true");
  const [saving, setSaving] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editScenario, setEditScenario] = useState("");
  const [editOpeningLine, setEditOpeningLine] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editSimPersona, setEditSimPersona] = useState("");
  const [editSimDialogueStyle, setEditSimDialogueStyle] = useState("");
  const [editSimConstraints, setEditSimConstraints] = useState("");

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
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  async function handleSave() {
    if (!editName.trim()) {
      toast.error("任务名称不能为空");
      return;
    }
    setSaving(true);
    try {
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

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success("保存成功");
      setEditing(false);
      setLoading(true);
      fetchTask();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportPDF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

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
        toast.error(json.error?.message || "导入失败");
        setImporting(false);
        return;
      }

      const jobId = json.data.id;
      toast.info("PDF 正在解析中，请稍候...");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/import-jobs/${jobId}`);
          const statusJson = await statusRes.json();
          if (!statusJson.success) {
            clearInterval(pollInterval);
            setImporting(false);
            toast.error("查询导入状态失败");
            return;
          }
          const job = statusJson.data;
          if (job.status === "completed") {
            clearInterval(pollInterval);
            setImporting(false);
            toast.success(`成功导入 ${job.totalQuestions} 道题目`);
            fetchTask();
          } else if (job.status === "failed") {
            clearInterval(pollInterval);
            setImporting(false);
            toast.error(`导入失败: ${job.error || "未知错误"}`);
          }
        } catch {
          clearInterval(pollInterval);
          setImporting(false);
          toast.error("查询导入状态失败");
        }
      }, 2000);

      // Timeout after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        setImporting(false);
      }, 60000);
    } catch {
      toast.error("导入失败，请重试");
      setImporting(false);
    }
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
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="size-4 mr-1" />
              编辑
            </Button>
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
      {task.scoringCriteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>评分标准</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Allocation Sections */}
      {task.allocationSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>资产配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {task.allocationSections
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
              ))}
          </CardContent>
        </Card>
      )}

      {/* Quiz Questions */}
      {task.taskType === "quiz" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>题目列表（{task.quizQuestions.length} 题）</CardTitle>
              <div className="flex items-center gap-2">
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
            {task.quizQuestions
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
              ))}
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
    </div>
  );
}
