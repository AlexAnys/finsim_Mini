"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

// ---------- Types ----------

type TaskType = "simulation" | "quiz" | "subjective";
type QuizQuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

interface ScoringCriterion {
  name: string;
  maxPoints: number;
  description: string;
}

interface AllocationItem {
  label: string;
  defaultValue: number;
}

interface AllocationSection {
  label: string;
  items: AllocationItem[];
}

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

interface FormData {
  // Step 1
  taskName: string;
  taskType: TaskType;
  description: string;
  // Simulation config
  scenario: string;
  openingLine: string;
  requirements: string[];
  scoringCriteria: ScoringCriterion[];
  allocationSections: AllocationSection[];
  simPersona: string;
  simDialogueStyle: string;
  simConstraints: string;
  // Quiz config
  timeLimitMinutes: string;
  quizMode: "fixed" | "adaptive";
  shuffleQuestions: boolean;
  showResult: boolean;
  questions: QuizQuestion[];
  // Subjective config
  prompt: string;
  wordLimit: string;
  allowAttachment: boolean;
  maxAttachments: string;
}

const DEFAULT_SIM_PERSONA = `你是一个普通人，对理财知识了解不多，但愿意学习和听取专业建议。
你有自己的顾虑和偏好，但你不是一个"油盐不进"的人。当理财经理给出合理解释时，你会逐渐理解和接受。
你会主动提出与对话目标相关的问题，推动对话朝有意义的方向发展。`;

const DEFAULT_SIM_DIALOGUE_STYLE = `用中文回复，语气自然，像真实客户聊天一样。不要使用 Markdown 符号或列表格式。
每条回复 2-4 句话。可以分享自己的想法、提出疑问、或回应理财经理的建议。
当理财经理解释得好时，表示认可并追问更深入的问题。
当理财经理说得不清楚时，礼貌地请求进一步解释，而不是直接拒绝。
不要一味表达不信任或完全拒绝风险。你是来寻求帮助的，不是来刁难人的。`;

const DEFAULT_SIM_CONSTRAINTS = `不要暴露你是 AI 或模拟角色。
不要重复理财经理刚说过的话。
不要无端制造对抗或拒绝所有建议。`;

const initialFormData: FormData = {
  taskName: "",
  taskType: "simulation",
  description: "",
  scenario: "",
  openingLine: "",
  requirements: [""],
  scoringCriteria: [{ name: "", maxPoints: 10, description: "" }],
  allocationSections: [{ label: "", items: [{ label: "", defaultValue: 0 }] }],
  simPersona: DEFAULT_SIM_PERSONA,
  simDialogueStyle: DEFAULT_SIM_DIALOGUE_STYLE,
  simConstraints: DEFAULT_SIM_CONSTRAINTS,
  timeLimitMinutes: "",
  quizMode: "fixed",
  shuffleQuestions: false,
  showResult: false,
  questions: [
    {
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
    },
  ],
  prompt: "",
  wordLimit: "",
  allowAttachment: false,
  maxAttachments: "3",
};

const taskTypeLabels: Record<TaskType, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const questionTypeLabels: Record<QuizQuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

const stepLabels = ["基本信息", "任务配置", "预览并创建"];

export default function CreateTaskPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [aiGenerating, setAIGenerating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---------- Helpers ----------

  function updateForm<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ---------- Requirements (dynamic list) ----------

  function addRequirement() {
    updateForm("requirements", [...form.requirements, ""]);
  }

  function removeRequirement(idx: number) {
    updateForm(
      "requirements",
      form.requirements.filter((_, i) => i !== idx)
    );
  }

  function setRequirement(idx: number, value: string) {
    const next = [...form.requirements];
    next[idx] = value;
    updateForm("requirements", next);
  }

  // ---------- Scoring criteria ----------

  function addCriterion() {
    updateForm("scoringCriteria", [
      ...form.scoringCriteria,
      { name: "", maxPoints: 10, description: "" },
    ]);
  }

  function removeCriterion(idx: number) {
    updateForm(
      "scoringCriteria",
      form.scoringCriteria.filter((_, i) => i !== idx)
    );
  }

  function setCriterion(idx: number, field: keyof ScoringCriterion, value: string | number) {
    const next = [...form.scoringCriteria];
    next[idx] = { ...next[idx], [field]: value };
    updateForm("scoringCriteria", next);
  }

  // ---------- Allocation sections ----------

  function addAllocationSection() {
    updateForm("allocationSections", [
      ...form.allocationSections,
      { label: "", items: [{ label: "", defaultValue: 0 }] },
    ]);
  }

  function removeAllocationSection(idx: number) {
    updateForm(
      "allocationSections",
      form.allocationSections.filter((_, i) => i !== idx)
    );
  }

  function setAllocationSectionLabel(idx: number, label: string) {
    const next = [...form.allocationSections];
    next[idx] = { ...next[idx], label };
    updateForm("allocationSections", next);
  }

  function addAllocationItem(sectionIdx: number) {
    const next = [...form.allocationSections];
    next[sectionIdx] = {
      ...next[sectionIdx],
      items: [...next[sectionIdx].items, { label: "", defaultValue: 0 }],
    };
    updateForm("allocationSections", next);
  }

  function removeAllocationItem(sectionIdx: number, itemIdx: number) {
    const next = [...form.allocationSections];
    next[sectionIdx] = {
      ...next[sectionIdx],
      items: next[sectionIdx].items.filter((_, i) => i !== itemIdx),
    };
    updateForm("allocationSections", next);
  }

  function setAllocationItem(
    sectionIdx: number,
    itemIdx: number,
    field: keyof AllocationItem,
    value: string | number
  ) {
    const next = [...form.allocationSections];
    next[sectionIdx] = {
      ...next[sectionIdx],
      items: next[sectionIdx].items.map((item, i) =>
        i === itemIdx ? { ...item, [field]: value } : item
      ),
    };
    updateForm("allocationSections", next);
  }

  // ---------- Quiz questions ----------

  function addQuestion() {
    updateForm("questions", [
      ...form.questions,
      {
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
      },
    ]);
  }

  function removeQuestion(idx: number) {
    updateForm(
      "questions",
      form.questions.filter((_, i) => i !== idx)
    );
  }

  function setQuestion(idx: number, field: keyof QuizQuestion, value: unknown) {
    const next = [...form.questions];
    next[idx] = { ...next[idx], [field]: value };
    updateForm("questions", next);
  }

  function setQuestionOption(qIdx: number, oIdx: number, text: string) {
    const next = [...form.questions];
    const opts = [...next[qIdx].options];
    opts[oIdx] = { ...opts[oIdx], text };
    next[qIdx] = { ...next[qIdx], options: opts };
    updateForm("questions", next);
  }

  // ---------- AI Generation ----------

  async function handleAIGenerateQuiz() {
    if (!form.taskName.trim()) {
      toast.error("请先输入任务名称");
      return;
    }
    setAIGenerating(true);
    try {
      const res = await fetch("/api/ai/task-draft/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: form.taskName,
          chapterName: form.description || form.taskName,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "AI 出题失败");
        return;
      }
      const generated = json.data.questions;
      const mapped = generated.map((q: Record<string, unknown>) => ({
        type: q.type as QuizQuestionType,
        stem: q.prompt as string,
        options: (q.options as QuizOption[]) || [
          { id: "A", text: "" },
          { id: "B", text: "" },
          { id: "C", text: "" },
          { id: "D", text: "" },
        ],
        correctOptionIds: (q.correctOptionIds as string[]) || [],
        correctAnswer: (q.correctAnswer as string) || "",
        points: (q.points as number) || 1,
        explanation: (q.explanation as string) || "",
      }));
      updateForm("questions", mapped);
      toast.success(`AI 已生成 ${mapped.length} 道题目`);
    } catch {
      toast.error("AI 出题失败，请重试");
    } finally {
      setAIGenerating(false);
    }
  }

  async function handleAIGenerateSubjective() {
    if (!form.taskName.trim()) {
      toast.error("请先输入任务名称");
      return;
    }
    setAIGenerating(true);
    try {
      const res = await fetch("/api/ai/task-draft/subjective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: form.taskName,
          chapterName: form.description || form.taskName,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "AI 出题失败");
        return;
      }
      const data = json.data;
      updateForm("prompt", data.prompt);
      if (data.scoringCriteria) {
        updateForm("scoringCriteria", data.scoringCriteria.map((c: Record<string, unknown>) => ({
          name: c.name as string,
          maxPoints: c.maxPoints as number,
          description: (c.description as string) || "",
        })));
      }
      if (data.requirements) {
        updateForm("requirements", (data.requirements as string).split("\n").filter(Boolean));
      }
      toast.success("AI 已生成主观题配置");
    } catch {
      toast.error("AI 出题失败，请重试");
    } finally {
      setAIGenerating(false);
    }
  }

  // ---------- Validation ----------

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!form.taskName.trim()) errs.taskName = "请输入任务名称";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: Record<string, string> = {};
    if (form.taskType === "simulation") {
      if (!form.scenario.trim()) errs.scenario = "请输入场景描述";
      if (!form.openingLine.trim()) errs.openingLine = "请输入开场白";
    } else if (form.taskType === "quiz") {
      if (form.questions.length === 0) errs.questions = "请至少添加一道题目";
      form.questions.forEach((q, i) => {
        if (!q.stem.trim()) errs[`q_${i}_stem`] = `第 ${i + 1} 题题干不能为空`;
      });
    } else if (form.taskType === "subjective") {
      if (!form.prompt.trim()) errs.prompt = "请输入题目提示";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ---------- Submit ----------

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        taskType: form.taskType,
        taskName: form.taskName.trim(),
        requirements: form.description.trim() || undefined,
      };

      if (form.taskType === "simulation") {
        // Build systemPrompt from the 3 prompt sections
        const promptParts = [
          form.simPersona.trim() ? `【核心人设】\n${form.simPersona.trim()}` : "",
          form.simDialogueStyle.trim() ? `【对话风格】\n${form.simDialogueStyle.trim()}` : "",
          form.simConstraints.trim() ? `【禁止行为】\n${form.simConstraints.trim()}` : "",
        ].filter(Boolean);
        const systemPrompt = promptParts.length > 0
          ? `你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：\n\n{scenario}\n\n${promptParts.join("\n\n")}\n\n【情绪标签】\n在每条回复末尾附加：[MOOD: HAPPY|NEUTRAL|CONFUSED|SKEPTICAL|ANGRY]\n- HAPPY: 理财经理的建议让你觉得有道理、有帮助\n- NEUTRAL: 正常交流、信息确认\n- CONFUSED: 理财经理用了太多术语或解释不够清楚\n- SKEPTICAL: 理财经理的建议明显不符合你的实际情况\n- ANGRY: 仅在理财经理反复推销明显不适合的产品时才使用（极少出现）`
          : undefined;

        body.simulationConfig = {
          scenario: form.scenario.trim(),
          openingLine: form.openingLine.trim(),
          dialogueRequirements: form.requirements.filter((r) => r.trim()).join("\n") || undefined,
          strictnessLevel: "MODERATE",
          systemPrompt,
        };
        const validCriteria = form.scoringCriteria.filter((c) => c.name.trim());
        if (validCriteria.length > 0) {
          body.scoringCriteria = validCriteria.map((c, i) => ({
            name: c.name.trim(),
            description: c.description.trim() || undefined,
            maxPoints: c.maxPoints,
            order: i,
          }));
        }
        const validSections = form.allocationSections.filter((s) => s.label.trim());
        if (validSections.length > 0) {
          body.allocationSections = validSections.map((s, i) => ({
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
      } else if (form.taskType === "quiz") {
        body.quizConfig = {
          mode: form.quizMode,
          timeLimitMinutes: form.timeLimitMinutes ? parseInt(form.timeLimitMinutes) : undefined,
          showCorrectAnswer: form.showResult,
        };
        body.quizQuestions = form.questions.map((q, i) => {
          const base: Record<string, unknown> = {
            type: q.type,
            prompt: q.stem.trim(),
            points: q.points,
            order: i,
            explanation: q.explanation.trim() || undefined,
          };
          if (q.type === "short_answer") {
            base.correctAnswer = q.correctAnswer.trim() || undefined;
          } else {
            base.options = q.options.map((o) => ({ id: o.id, text: o.text.trim() }));
            base.correctOptionIds = q.correctOptionIds;
          }
          return base;
        });
      } else if (form.taskType === "subjective") {
        body.subjectiveConfig = {
          prompt: form.prompt.trim(),
          allowTextAnswer: true,
          allowedAttachmentTypes: form.allowAttachment ? ["pdf", "docx", "png", "jpg"] : [],
          strictnessLevel: "MODERATE",
        };
        const validCriteria = form.scoringCriteria.filter((c) => c.name.trim());
        if (validCriteria.length > 0) {
          body.scoringCriteria = validCriteria.map((c, i) => ({
            name: c.name.trim(),
            description: c.description.trim() || undefined,
            maxPoints: c.maxPoints,
            order: i,
          }));
        }
        if (form.requirements.filter((r) => r.trim()).length > 0) {
          body.requirements = form.requirements.filter((r) => r.trim()).join("\n");
        }
      }

      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "创建失败");
        return;
      }
      toast.success("任务创建成功");
      router.push(`/teacher/tasks/${json.data.id}`);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Navigation ----------

  function nextStep() {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, 2));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // ---------- Render ----------

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push("/teacher/tasks")}>
          <ChevronLeft className="size-4 mr-1" />
          返回
        </Button>
        <h1 className="text-2xl font-bold">创建任务</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-8 bg-border" />}
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                i === step
                  ? "bg-blue-100 text-blue-700"
                  : i < step
                  ? "bg-green-100 text-green-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>}
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Basic Info */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taskName">任务名称 *</Label>
              <Input
                id="taskName"
                placeholder="例如：客户理财咨询模拟"
                value={form.taskName}
                onChange={(e) => updateForm("taskName", e.target.value)}
              />
              {errors.taskName && (
                <p className="text-sm text-destructive">{errors.taskName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>任务类型 *</Label>
              <Select
                value={form.taskType}
                onValueChange={(v) => updateForm("taskType", v as TaskType)}
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

            <div className="space-y-2">
              <Label htmlFor="description">任务描述</Label>
              <Textarea
                id="description"
                placeholder="简要描述任务的目的和要求..."
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Task Configuration */}
      {step === 1 && form.taskType === "simulation" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>模拟对话配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scenario">角色扮演场景 *</Label>
                <Textarea
                  id="scenario"
                  placeholder="描述 AI 扮演的角色和对话场景..."
                  value={form.scenario}
                  onChange={(e) => updateForm("scenario", e.target.value)}
                  rows={4}
                />
                {errors.scenario && (
                  <p className="text-sm text-destructive">{errors.scenario}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingLine">AI 开场白 *</Label>
                <Input
                  id="openingLine"
                  placeholder="AI 角色说的第一句话"
                  value={form.openingLine}
                  onChange={(e) => updateForm("openingLine", e.target.value)}
                />
                {errors.openingLine && (
                  <p className="text-sm text-destructive">{errors.openingLine}</p>
                )}
              </div>

              <Separator />
              <p className="text-sm text-muted-foreground">
                以下提示词控制 AI 客户的行为方式，已预填默认值，可根据需要自定义。
              </p>

              <div className="space-y-2">
                <Label htmlFor="simPersona">核心人设</Label>
                <Textarea
                  id="simPersona"
                  placeholder="描述 AI 客户的性格、背景和态度..."
                  value={form.simPersona}
                  onChange={(e) => updateForm("simPersona", e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="simDialogueStyle">对话风格</Label>
                <Textarea
                  id="simDialogueStyle"
                  placeholder="描述 AI 客户的说话方式和回复规则..."
                  value={form.simDialogueStyle}
                  onChange={(e) => updateForm("simDialogueStyle", e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="simConstraints">禁止行为</Label>
                <Textarea
                  id="simConstraints"
                  placeholder="列出 AI 客户不应做的事情..."
                  value={form.simConstraints}
                  onChange={(e) => updateForm("simConstraints", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>对话要求</CardTitle>
                <Button variant="outline" size="sm" onClick={addRequirement}>
                  <Plus className="size-3 mr-1" />
                  添加要求
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.requirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-6">{i + 1}.</span>
                  <Input
                    placeholder="例如：需要了解客户的风险偏好"
                    value={req}
                    onChange={(e) => setRequirement(i, e.target.value)}
                  />
                  {form.requirements.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRequirement(i)}
                      className="shrink-0 text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>评分标准</CardTitle>
                <Button variant="outline" size="sm" onClick={addCriterion}>
                  <Plus className="size-3 mr-1" />
                  添加标准
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.scoringCriteria.map((c, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">标准 {i + 1}</span>
                    {form.scoringCriteria.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCriterion(i)}
                        className="size-7 text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">名称</Label>
                      <Input
                        placeholder="例如：需求分析"
                        value={c.name}
                        onChange={(e) => setCriterion(i, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">最高分</Label>
                      <Input
                        type="number"
                        min={1}
                        value={c.maxPoints}
                        onChange={(e) =>
                          setCriterion(i, "maxPoints", parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">描述</Label>
                    <Textarea
                      placeholder="该评分标准的详细说明..."
                      value={c.description}
                      onChange={(e) => setCriterion(i, "description", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>资产配置</CardTitle>
                <Button variant="outline" size="sm" onClick={addAllocationSection}>
                  <Plus className="size-3 mr-1" />
                  添加分区
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.allocationSections.map((section, si) => (
                <div key={si} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">分区 {si + 1}</span>
                    {form.allocationSections.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAllocationSection(si)}
                        className="size-7 text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">分区名称</Label>
                    <Input
                      placeholder="例如：股票"
                      value={section.label}
                      onChange={(e) => setAllocationSectionLabel(si, e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">配置项</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addAllocationItem(si)}
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
                            setAllocationItem(si, ii, "label", e.target.value)
                          }
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="默认值"
                          value={item.defaultValue}
                          onChange={(e) =>
                            setAllocationItem(
                              si,
                              ii,
                              "defaultValue",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24"
                        />
                        {section.items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAllocationItem(si, ii)}
                            className="size-7 shrink-0 text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && form.taskType === "quiz" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>测验配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>时间限制（分钟）</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="不限时请留空"
                    value={form.timeLimitMinutes}
                    onChange={(e) => updateForm("timeLimitMinutes", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>测验模式</Label>
                  <Select
                    value={form.quizMode}
                    onValueChange={(v) => updateForm("quizMode", v as "fixed" | "adaptive")}
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
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showResult"
                    checked={form.showResult}
                    onCheckedChange={(v) => updateForm("showResult", !!v)}
                  />
                  <Label htmlFor="showResult" className="cursor-pointer">
                    显示正确答案
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>题目列表</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAIGenerateQuiz}
                    disabled={aiGenerating}
                  >
                    {aiGenerating ? (
                      <Loader2 className="size-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="size-3 mr-1" />
                    )}
                    AI 出题
                  </Button>
                  <Button variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="size-3 mr-1" />
                    添加题目
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors.questions && (
                <p className="text-sm text-destructive">{errors.questions}</p>
              )}
              {form.questions.map((q, qi) => (
                <div key={qi} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      第 {qi + 1} 题
                    </span>
                    {form.questions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeQuestion(qi)}
                        className="size-7 text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">题目类型</Label>
                      <Select
                        value={q.type}
                        onValueChange={(v) =>
                          setQuestion(qi, "type", v as QuizQuestionType)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_choice">单选题</SelectItem>
                          <SelectItem value="multiple_choice">多选题</SelectItem>
                          <SelectItem value="true_false">判断题</SelectItem>
                          <SelectItem value="short_answer">简答题</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">分值</Label>
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        value={q.points}
                        onChange={(e) =>
                          setQuestion(qi, "points", parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">题干 *</Label>
                    <Textarea
                      placeholder="请输入题目内容..."
                      value={q.stem}
                      onChange={(e) => setQuestion(qi, "stem", e.target.value)}
                      rows={2}
                    />
                    {errors[`q_${qi}_stem`] && (
                      <p className="text-sm text-destructive">
                        {errors[`q_${qi}_stem`]}
                      </p>
                    )}
                  </div>

                  {(q.type === "single_choice" ||
                    q.type === "multiple_choice" ||
                    q.type === "true_false") && (
                    <div className="space-y-2">
                      <Label className="text-xs">选项</Label>
                      {(q.type === "true_false"
                        ? [
                            { id: "A", text: "正确" },
                            { id: "B", text: "错误" },
                          ]
                        : q.options
                      ).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <Badge variant="outline" className="w-7 justify-center shrink-0">
                            {opt.id}
                          </Badge>
                          {q.type === "true_false" ? (
                            <span className="text-sm">{opt.text}</span>
                          ) : (
                            <Input
                              placeholder={`选项 ${opt.id}`}
                              value={opt.text}
                              onChange={(e) =>
                                setQuestionOption(qi, oi, e.target.value)
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.type === "short_answer" ? (
                    <div className="space-y-1">
                      <Label className="text-xs">参考答案</Label>
                      <Input
                        placeholder="参考答案..."
                        value={q.correctAnswer}
                        onChange={(e) =>
                          setQuestion(qi, "correctAnswer", e.target.value)
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">正确答案</Label>
                      <Select
                        value={q.correctOptionIds[0] || ""}
                        onValueChange={(v) =>
                          setQuestion(qi, "correctOptionIds", [v])
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择正确答案" />
                        </SelectTrigger>
                        <SelectContent>
                          {(q.type === "true_false"
                            ? [{ id: "A" }, { id: "B" }]
                            : q.options
                          ).map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">解析</Label>
                    <Textarea
                      placeholder="题目解析（选填）..."
                      value={q.explanation}
                      onChange={(e) =>
                        setQuestion(qi, "explanation", e.target.value)
                      }
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 1 && form.taskType === "subjective" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>主观题配置</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAIGenerateSubjective}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="size-3 mr-1" />
                  )}
                  AI 出题
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">题目提示 *</Label>
                <Textarea
                  id="prompt"
                  placeholder="请详细描述学生需要回答的问题..."
                  value={form.prompt}
                  onChange={(e) => updateForm("prompt", e.target.value)}
                  rows={4}
                />
                {errors.prompt && (
                  <p className="text-sm text-destructive">{errors.prompt}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>字数限制</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="不限制请留空"
                  value={form.wordLimit}
                  onChange={(e) => updateForm("wordLimit", e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allowAttachment"
                    checked={form.allowAttachment}
                    onCheckedChange={(v) => updateForm("allowAttachment", !!v)}
                  />
                  <Label htmlFor="allowAttachment" className="cursor-pointer">
                    允许上传附件
                  </Label>
                </div>
                {form.allowAttachment && (
                  <div className="space-y-2 pl-6">
                    <Label>最大附件数</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.maxAttachments}
                      onChange={(e) =>
                        updateForm("maxAttachments", e.target.value)
                      }
                      className="w-32"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>作答要求</CardTitle>
                <Button variant="outline" size="sm" onClick={addRequirement}>
                  <Plus className="size-3 mr-1" />
                  添加要求
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.requirements.map((req, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-6">{i + 1}.</span>
                  <Input
                    placeholder="例如：需要引用至少两个经济学理论"
                    value={req}
                    onChange={(e) => setRequirement(i, e.target.value)}
                  />
                  {form.requirements.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRequirement(i)}
                      className="shrink-0 text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>评分标准</CardTitle>
                <Button variant="outline" size="sm" onClick={addCriterion}>
                  <Plus className="size-3 mr-1" />
                  添加标准
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.scoringCriteria.map((c, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">标准 {i + 1}</span>
                    {form.scoringCriteria.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCriterion(i)}
                        className="size-7 text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">名称</Label>
                      <Input
                        placeholder="例如：论述逻辑"
                        value={c.name}
                        onChange={(e) => setCriterion(i, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">最高分</Label>
                      <Input
                        type="number"
                        min={1}
                        value={c.maxPoints}
                        onChange={(e) =>
                          setCriterion(i, "maxPoints", parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">描述</Label>
                    <Textarea
                      placeholder="该评分标准的详细说明..."
                      value={c.description}
                      onChange={(e) => setCriterion(i, "description", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>确认信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-sm text-muted-foreground">任务名称</span>
                <p className="font-medium">{form.taskName}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">任务类型</span>
                <p>
                  <Badge variant="secondary">
                    {taskTypeLabels[form.taskType]}
                  </Badge>
                </p>
              </div>
            </div>

            {form.description && (
              <div>
                <span className="text-sm text-muted-foreground">描述</span>
                <p className="text-sm">{form.description}</p>
              </div>
            )}

            <Separator />

            {form.taskType === "simulation" && (
              <div className="space-y-3">
                <h3 className="font-medium">模拟对话配置</h3>
                <div>
                  <span className="text-sm text-muted-foreground">场景描述</span>
                  <p className="text-sm whitespace-pre-wrap">{form.scenario}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">开场白</span>
                  <p className="text-sm">{form.openingLine}</p>
                </div>
                {form.requirements.filter((r) => r.trim()).length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">对话要求</span>
                    <ul className="list-disc list-inside text-sm">
                      {form.requirements
                        .filter((r) => r.trim())
                        .map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                    </ul>
                  </div>
                )}
                {form.scoringCriteria.filter((c) => c.name.trim()).length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">评分标准</span>
                    <div className="mt-1 space-y-1">
                      {form.scoringCriteria
                        .filter((c) => c.name.trim())
                        .map((c, i) => (
                          <p key={i} className="text-sm">
                            {c.name}（{c.maxPoints} 分）
                            {c.description && ` - ${c.description}`}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
                {form.allocationSections.filter((s) => s.label.trim()).length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">资产配置</span>
                    <div className="mt-1 space-y-1">
                      {form.allocationSections
                        .filter((s) => s.label.trim())
                        .map((s, i) => (
                          <p key={i} className="text-sm">
                            {s.label}:
                            {s.items
                              .filter((item) => item.label.trim())
                              .map((item) => ` ${item.label}`)
                              .join(",")}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {form.taskType === "quiz" && (
              <div className="space-y-3">
                <h3 className="font-medium">测验配置</h3>
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">时间限制: </span>
                    {form.timeLimitMinutes
                      ? `${form.timeLimitMinutes} 分钟`
                      : "不限时"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">模式: </span>
                    {form.quizMode === "fixed" ? "固定题目" : "自适应"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">显示答案: </span>
                    {form.showResult ? "是" : "否"}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">
                    共 {form.questions.length} 道题目
                  </span>
                  <div className="mt-1 space-y-1">
                    {form.questions.map((q, i) => (
                      <p key={i} className="text-sm">
                        {i + 1}. [{questionTypeLabels[q.type]}] {q.stem || "(空)"}{" "}
                        ({q.points} 分)
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {form.taskType === "subjective" && (
              <div className="space-y-3">
                <h3 className="font-medium">主观题配置</h3>
                <div>
                  <span className="text-sm text-muted-foreground">题目提示</span>
                  <p className="text-sm whitespace-pre-wrap">{form.prompt}</p>
                </div>
                {form.wordLimit && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">字数限制: </span>
                    {form.wordLimit} 字
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-muted-foreground">允许附件: </span>
                  {form.allowAttachment
                    ? `是（最多 ${form.maxAttachments} 个）`
                    : "否"}
                </p>
                {form.scoringCriteria.filter((c) => c.name.trim()).length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">评分标准</span>
                    <div className="mt-1 space-y-1">
                      {form.scoringCriteria
                        .filter((c) => c.name.trim())
                        .map((c, i) => (
                          <p key={i} className="text-sm">
                            {c.name}（{c.maxPoints} 分）
                            {c.description && ` - ${c.description}`}
                          </p>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 0}
        >
          <ChevronLeft className="size-4 mr-1" />
          上一步
        </Button>
        {step < 2 ? (
          <Button onClick={nextStep}>
            下一步
            <ChevronRight className="size-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Check className="size-4 mr-1" />
                创建任务
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
