"use client";

/**
 * PR-COURSE-1+2 · C2 任务向导 Modal
 *
 * 复用既有 4 步向导组件（components/task-wizard/*），由原 /teacher/tasks/new 路由
 * 整合到课程编辑器。本 Modal 不直接持有路由，由父组件控制开闭并传入 onSuccess 回调
 * （父组件用回调把任务直接挂到指定章节小节并发布）。
 *
 * 输入：context = { chapterId, sectionId, slot, classId, courseId }
 * 行为：4 步走完后 POST /api/lms/task-instances/with-task 原子创建任务模板、
 *      挂入课程节点并发布。成功后 onSuccess 触发（父组件 fetchCourse 刷新）。
 */

import { useState } from "react";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mergeGeneratedQuestions } from "@/lib/utils/quiz-merge";
import { WizardStepper } from "@/components/task-wizard/wizard-stepper";
import { WizardStepType } from "@/components/task-wizard/wizard-step-type";
import { WizardStepBasic } from "@/components/task-wizard/wizard-step-basic";
import { WizardStepSim } from "@/components/task-wizard/wizard-step-sim";
import { WizardStepQuiz } from "@/components/task-wizard/wizard-step-quiz";
import { WizardStepSubjective } from "@/components/task-wizard/wizard-step-subjective";
import { WizardStepReview } from "@/components/task-wizard/wizard-step-review";
import { KnowledgeSourceAssistant } from "@/components/task-wizard/knowledge-source-assistant";
import {
  AIQuizDialog,
  type GeneratedQuestion,
} from "@/components/task-wizard/ai-quiz-dialog";
import {
  TASK_TYPE_META,
  WIZARD_STEPS,
  type TaskType,
} from "@/components/task-wizard/wizard-types";

// ---------- Types ----------

type QuizQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

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
  taskName: string;
  taskType: TaskType;
  description: string;
  totalPoints: number;
  // Simulation
  scenario: string;
  openingLine: string;
  requirements: string[];
  scoringCriteria: ScoringCriterion[];
  allocationSections: AllocationSection[];
  simPersona: string;
  simDialogueStyle: string;
  simConstraints: string;
  // Quiz
  timeLimitMinutes: string;
  quizMode: "fixed" | "adaptive";
  shuffleQuestions: boolean;
  showResult: boolean;
  questions: QuizQuestion[];
  // Subjective
  prompt: string;
  wordLimit: string;
  allowAttachment: boolean;
  maxAttachments: string;
  // Instance
  dueAt: string;
}

interface ContextDraftResponse {
  taskName: string;
  description: string;
  totalPoints?: number;
  timeLimitMinutes?: number | null;
  draftNotes?: string;
  sourceSummary?: Array<{ id: string; fileName: string; conceptTags: string[] }>;
  quiz?: {
    questions: Array<{
      type: QuizQuestionType;
      prompt: string;
      options?: QuizOption[];
      correctOptionIds?: string[];
      correctAnswer?: string;
      points?: number;
      explanation?: string;
    }>;
    quizMode?: "fixed" | "adaptive";
    showResult?: boolean;
  };
  subjective?: {
    prompt: string;
    requirements?: string[];
    referenceAnswer?: string;
    scoringCriteria?: ScoringCriterion[];
  };
  simulation?: {
    scenario: string;
    openingLine: string;
    requirements?: string[];
    scoringCriteria?: ScoringCriterion[];
    allocationSections?: AllocationSection[];
    simPersona: string;
    simDialogueStyle: string;
    simConstraints: string;
  };
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

function makeInitialForm(): FormData {
  return {
    taskName: "",
    taskType: "simulation",
    description: "",
    totalPoints: 100,
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
    dueAt: "",
  };
}

function collectMissingFields(form: FormData): string[] {
  const missing: string[] = [];
  if (!form.taskName.trim()) missing.push("任务名称");
  if (!form.description.trim()) missing.push("任务描述");

  if (form.taskType === "simulation") {
    if (!form.scenario.trim()) missing.push("模拟场景");
    if (!form.openingLine.trim()) missing.push("客户开场白");
    if (!form.requirements.some((item) => item.trim())) missing.push("对话要求");
    if (!form.scoringCriteria.some((item) => item.name.trim())) missing.push("评分维度");
  } else if (form.taskType === "quiz") {
    const hasUsableQuestion = form.questions.some((question) => question.stem.trim());
    if (!hasUsableQuestion) missing.push("题目");
    if (
      form.questions.some((question) => {
        if (!question.stem.trim()) return true;
        if (question.type === "short_answer") return !question.correctAnswer.trim();
        return question.options.some((option) => !option.text.trim()) ||
          question.correctOptionIds.length === 0;
      })
    ) {
      missing.push("答案与选项");
    }
  } else if (form.taskType === "subjective") {
    if (!form.prompt.trim()) missing.push("主观题题干");
    if (!form.scoringCriteria.some((item) => item.name.trim())) missing.push("评分标准");
  }

  return Array.from(new Set(missing));
}

// ---------- Component ----------

export interface WizardModalContext {
  courseId: string;
  classId: string;
  chapterId: string;
  sectionId: string;
  slot: "pre" | "in" | "post";
  chapterTitle?: string;
  sectionTitle?: string;
}

interface WizardModalProps {
  open: boolean;
  context: WizardModalContext | null;
  onClose: () => void;
  onSuccess: () => void;
}

const SLOT_LABEL: Record<"pre" | "in" | "post", string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

export function TaskWizardModal({
  open,
  context,
  onClose,
  onSuccess,
}: WizardModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(() => makeInitialForm());
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [contextGenerating, setContextGenerating] = useState(false);
  const [aiDialogOpen, setAIDialogOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [teacherBrief, setTeacherBrief] = useState("");
  const [draftSourceLabel, setDraftSourceLabel] = useState("");

  function resetState() {
    setStep(0);
    setForm(makeInitialForm());
    setErrors({});
    setSubmitting(false);
    setSavingDraft(false);
    setContextGenerating(false);
    setAIDialogOpen(false);
    setSelectedSourceIds([]);
    setTeacherBrief("");
    setDraftSourceLabel("");
  }

  function handleClose() {
    if (submitting) return;
    resetState();
    onClose();
  }

  function updateForm<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ---------- Requirements ----------

  function addRequirement() {
    updateForm("requirements", [...form.requirements, ""]);
  }
  function removeRequirement(idx: number) {
    updateForm(
      "requirements",
      form.requirements.filter((_, i) => i !== idx),
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
      form.scoringCriteria.filter((_, i) => i !== idx),
    );
  }
  function setCriterion(
    idx: number,
    field: keyof ScoringCriterion,
    value: string | number,
  ) {
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
      form.allocationSections.filter((_, i) => i !== idx),
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
    value: string | number,
  ) {
    const next = [...form.allocationSections];
    next[sectionIdx] = {
      ...next[sectionIdx],
      items: next[sectionIdx].items.map((item, i) =>
        i === itemIdx ? { ...item, [field]: value } : item,
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
      form.questions.filter((_, i) => i !== idx),
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

  // ---------- AI handlers ----------

  function handleAIQuizAccept(generated: GeneratedQuestion[]) {
    const next = mergeGeneratedQuestions(form.questions, generated);
    updateForm("questions", next);
    toast.success(`已加入 ${generated.length} 道题目`);
  }

  async function handleGenerateFromContext() {
    if (!context) return;
    if (!teacherBrief.trim() && selectedSourceIds.length === 0 && !form.taskName.trim()) {
      toast.error("请先填写教师需求、任务名称，或上传/选择课程素材");
      return;
    }

    setContextGenerating(true);
    try {
      const res = await fetch("/api/ai/task-draft/from-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: form.taskType,
          courseId: context.courseId,
          chapterId: context.chapterId,
          sectionId: context.sectionId,
          taskName: form.taskName,
          description: form.description,
          teacherBrief,
          sourceIds: selectedSourceIds,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "AI 草稿生成失败");
        return;
      }

      const draft = json.data as ContextDraftResponse;
      applyContextDraft(draft);
      const sourceNames = draft.sourceSummary?.map((source) => source.fileName).join("、");
      setDraftSourceLabel(
        `AI 草稿来源：${sourceNames || "教师需求 / 课程上下文"}。${
          draft.draftNotes || "请在创建前复核所有字段。"
        }`,
      );
      if (step < 2) setStep(2);
      toast.success("AI 已生成任务草稿，请继续复核");
    } catch {
      toast.error("AI 草稿生成失败，请重试");
    } finally {
      setContextGenerating(false);
    }
  }

  function applyContextDraft(draft: ContextDraftResponse) {
    setForm((prev) => {
      const next: FormData = {
        ...prev,
        taskName: draft.taskName || prev.taskName,
        description: draft.description || prev.description,
        totalPoints: draft.totalPoints || prev.totalPoints,
        timeLimitMinutes:
          draft.timeLimitMinutes != null ? String(draft.timeLimitMinutes) : prev.timeLimitMinutes,
      };

      if (prev.taskType === "quiz" && draft.quiz) {
        next.quizMode = draft.quiz.quizMode || prev.quizMode;
        next.showResult = draft.quiz.showResult ?? prev.showResult;
        next.questions = draft.quiz.questions.map(normalizeDraftQuestion);
      }

      if (prev.taskType === "subjective" && draft.subjective) {
        next.prompt = draft.subjective.prompt || prev.prompt;
        next.requirements = normalizeTextList(draft.subjective.requirements, prev.requirements);
        next.scoringCriteria = normalizeCriteria(
          draft.subjective.scoringCriteria,
          prev.scoringCriteria,
        );
      }

      if (prev.taskType === "simulation" && draft.simulation) {
        next.scenario = draft.simulation.scenario || prev.scenario;
        next.openingLine = draft.simulation.openingLine || prev.openingLine;
        next.requirements = normalizeTextList(draft.simulation.requirements, prev.requirements);
        next.scoringCriteria = normalizeCriteria(
          draft.simulation.scoringCriteria,
          prev.scoringCriteria,
        );
        next.allocationSections = normalizeAllocationSections(
          draft.simulation.allocationSections,
          prev.allocationSections,
        );
        next.simPersona = draft.simulation.simPersona || prev.simPersona;
        next.simDialogueStyle = draft.simulation.simDialogueStyle || prev.simDialogueStyle;
        next.simConstraints = draft.simulation.simConstraints || prev.simConstraints;
      }

      return next;
    });
    setErrors({});
  }

  function normalizeDraftQuestion(
    question: NonNullable<ContextDraftResponse["quiz"]>["questions"][number],
  ): QuizQuestion {
    const options =
      question.type === "true_false"
        ? [
            { id: "T", text: "对" },
            { id: "F", text: "错" },
          ]
        : question.options?.length
          ? question.options
          : [
              { id: "A", text: "" },
              { id: "B", text: "" },
              { id: "C", text: "" },
              { id: "D", text: "" },
            ];

    return {
      type: question.type,
      stem: question.prompt,
      options,
      correctOptionIds: question.correctOptionIds || [],
      correctAnswer: question.correctAnswer || "",
      points: Math.min(3, Math.max(1, Number(question.points || 1))),
      explanation: question.explanation || "",
    };
  }

  function normalizeTextList(input: string[] | undefined, fallback: string[]) {
    const values = (input || []).map((item) => item.trim()).filter(Boolean);
    return values.length > 0 ? values : fallback;
  }

  function normalizeCriteria(
    input: ScoringCriterion[] | undefined,
    fallback: ScoringCriterion[],
  ) {
    const values = (input || [])
      .map((item) => ({
        name: item.name?.trim() || "",
        maxPoints: Math.max(1, Number(item.maxPoints || 10)),
        description: item.description?.trim() || "",
      }))
      .filter((item) => item.name);
    return values.length > 0 ? values : fallback;
  }

  function normalizeAllocationSections(
    input: AllocationSection[] | undefined,
    fallback: AllocationSection[],
  ) {
    const values = (input || [])
      .map((section) => ({
        label: section.label?.trim() || "",
        items: (section.items || [])
          .map((item) => ({
            label: item.label?.trim() || "",
            defaultValue: Number(item.defaultValue || 0),
          }))
          .filter((item) => item.label),
      }))
      .filter((section) => section.label && section.items.length > 0);
    return values.length > 0 ? values : fallback;
  }

  // ---------- Validation ----------

  function validateStep0(): boolean {
    return true;
  }
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

  async function handleSaveDraft() {
    if (!context) return;
    setSavingDraft(true);
    try {
      const missingFields = collectMissingFields(form);
      const res = await fetch("/api/lms/task-build-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: context.courseId,
          chapterId: context.chapterId,
          sectionId: context.sectionId,
          slot: context.slot,
          taskType: form.taskType,
          title: form.taskName.trim() || "未命名任务草稿",
          description: form.description.trim() || undefined,
          sourceIds: selectedSourceIds,
          missingFields,
          draftPayload: {
            form,
            teacherBrief,
            draftSourceLabel,
            context: {
              chapterTitle: context.chapterTitle,
              sectionTitle: context.sectionTitle,
              slot: context.slot,
            },
          },
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存草稿失败");
        return;
      }
      toast.success(missingFields.length > 0 ? "草稿已保存，可稍后补全" : "草稿已保存，待审核发布");
      resetState();
      onSuccess();
      onClose();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSubmit() {
    if (!context) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        taskType: form.taskType,
        taskName: form.taskName.trim(),
        requirements: form.description.trim() || undefined,
      };

      if (form.taskType === "simulation") {
        const promptParts = [
          form.simPersona.trim()
            ? `【核心人设】\n${form.simPersona.trim()}`
            : "",
          form.simDialogueStyle.trim()
            ? `【对话风格】\n${form.simDialogueStyle.trim()}`
            : "",
          form.simConstraints.trim()
            ? `【禁止行为】\n${form.simConstraints.trim()}`
            : "",
        ].filter(Boolean);
        // PR-FIX-4 D1: 8 档 mood 协议运行时由 ai.service.chatReply 注入。
        // 单行 systemPrompt 写法与 app/teacher/tasks/[id]/page.tsx 保持一致（pr-fix-4-d1.test.ts 守护）。
        const systemPrompt = promptParts.length > 0
          ? `你是一个金融理财场景中的模拟客户。请按照以下角色设定进行对话：\n\n{scenario}\n\n${promptParts.join("\n\n")}`
          : undefined;

        body.simulationConfig = {
          scenario: form.scenario.trim(),
          openingLine: form.openingLine.trim(),
          dialogueRequirements:
            form.requirements.filter((r) => r.trim()).join("\n") || undefined,
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
        const validSections = form.allocationSections.filter((s) =>
          s.label.trim(),
        );
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
          timeLimitMinutes: form.timeLimitMinutes
            ? parseInt(form.timeLimitMinutes)
            : undefined,
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
            base.options = q.options.map((o) => ({
              id: o.id,
              text: o.text.trim(),
            }));
            base.correctOptionIds = q.correctOptionIds;
          }
          return base;
        });
      } else if (form.taskType === "subjective") {
        body.subjectiveConfig = {
          prompt: form.prompt.trim(),
          allowTextAnswer: true,
          allowedAttachmentTypes: form.allowAttachment
            ? ["pdf", "docx", "png", "jpg"]
            : [],
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
          body.requirements = form.requirements
            .filter((r) => r.trim())
            .join("\n");
        }
      }

      const res = await fetch("/api/lms/task-instances/with-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: body,
          instance: {
            title: form.taskName.trim(),
            description: form.description.trim() || undefined,
            classId: context.classId,
            courseId: context.courseId,
            chapterId: context.chapterId,
            sectionId: context.sectionId,
            slot: context.slot,
            dueAt: form.dueAt
              ? new Date(form.dueAt).toISOString()
              : new Date(Date.now() + 14 * 86400000).toISOString(),
          },
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "创建并发布失败");
        return;
      }
      toast.success("任务已创建并发布");

      resetState();
      onSuccess();
      onClose();
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Navigation ----------

  function nextStep() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }
  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }
  function jumpTo(idx: number) {
    if (idx <= step) setStep(idx);
  }

  // ---------- Render ----------

  if (!context) return null;
  const typeMeta = TASK_TYPE_META[form.taskType];
  const slotLabel = SLOT_LABEL[context.slot];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[1180px] flex-col gap-0 overflow-hidden bg-paper p-0 sm:max-w-[1180px]"
      >
        {/* Top header */}
        <div className="flex items-end justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
          <div className="min-w-0">
            <div className="mb-1 text-[11.5px] text-ink-5">
              <span className="text-ink-5">课程编辑器</span>
              <span className="mx-1.5 opacity-50">/</span>
              {context.chapterTitle && (
                <>
                  <span className="text-ink-4">{context.chapterTitle}</span>
                  <span className="mx-1.5 opacity-50">/</span>
                </>
              )}
              {context.sectionTitle && (
                <>
                  <span className="text-ink-4">{context.sectionTitle}</span>
                  <span className="mx-1.5 opacity-50">/</span>
                </>
              )}
              <span className="text-ink-3">{slotLabel} · 添加任务</span>
            </div>
            <DialogTitle asChild>
              <h2 className="m-0 text-2xl font-semibold tracking-tight text-ink">
                添加任务
                <span
                  className={cn(
                    "ml-2.5 rounded px-2 py-0.5 align-middle text-xs font-semibold",
                    typeMeta.softClass,
                    typeMeta.textClass,
                  )}
                >
                  {typeMeta.label}
                </span>
              </h2>
            </DialogTitle>
            <DialogDescription className="sr-only">
              通过四步流程选择任务类型、填写基本信息、配置内容并确认发布。
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={submitting}
            aria-label="关闭"
          >
            <X className="size-3.5" />
            取消
          </Button>
        </div>

        {/* 2-column body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden px-6 pt-5 pb-4 md:grid-cols-[220px_1fr]">
          <div className="hidden md:block">
            <WizardStepper
              step={step}
              onJump={jumpTo}
              taskType={form.taskType}
              taskName={form.taskName}
              totalPoints={form.totalPoints}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pr-1">
            {step === 0 && (
              <WizardStepType
                taskType={form.taskType}
                onChange={(t) => updateForm("taskType", t)}
              />
            )}
            {step === 1 && (
              <>
                {context && (
                  <KnowledgeSourceAssistant
                    courseId={context.courseId}
                    chapterId={context.chapterId}
                    sectionId={context.sectionId}
                    taskType={form.taskType}
                    selectedSourceIds={selectedSourceIds}
                    teacherBrief={teacherBrief}
                    generating={contextGenerating}
                    onSelectedSourceIdsChange={setSelectedSourceIds}
                    onTeacherBriefChange={setTeacherBrief}
                    onGenerateDraft={handleGenerateFromContext}
                  />
                )}
                <WizardStepBasic
                  taskName={form.taskName}
                  description={form.description}
                  totalPoints={form.totalPoints}
                  timeLimitMinutes={form.timeLimitMinutes}
                  errors={errors}
                  onTaskName={(v) => updateForm("taskName", v)}
                  onDescription={(v) => updateForm("description", v)}
                  onTotalPoints={(v) => updateForm("totalPoints", v)}
                  onTimeLimitMinutes={(v) => updateForm("timeLimitMinutes", v)}
                />
                {/* Inline due-at field — only present in modal flow (instance scoped) */}
                <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-5">
                    截止时间
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={form.dueAt}
                      onChange={(e) => updateForm("dueAt", e.target.value)}
                      className="rounded-md border border-line bg-paper-alt px-2.5 py-1.5 text-xs text-ink"
                    />
                    <span className="text-[11px] text-ink-5">
                      留空则默认两周后
                    </span>
                  </div>
                </div>
              </>
            )}
            {step === 2 && form.taskType === "simulation" && (
              <WizardStepSim
                scenario={form.scenario}
                openingLine={form.openingLine}
                requirements={form.requirements}
                scoringCriteria={form.scoringCriteria}
                allocationSections={form.allocationSections}
                simPersona={form.simPersona}
                simDialogueStyle={form.simDialogueStyle}
                simConstraints={form.simConstraints}
                totalPoints={form.totalPoints}
                errors={errors}
                onScenario={(v) => updateForm("scenario", v)}
                onOpeningLine={(v) => updateForm("openingLine", v)}
                onRequirementAdd={addRequirement}
                onRequirementRemove={removeRequirement}
                onRequirementChange={setRequirement}
                onCriterionAdd={addCriterion}
                onCriterionRemove={removeCriterion}
                onCriterionChange={setCriterion}
                onAllocSectionAdd={addAllocationSection}
                onAllocSectionRemove={removeAllocationSection}
                onAllocSectionLabel={setAllocationSectionLabel}
                onAllocItemAdd={addAllocationItem}
                onAllocItemRemove={removeAllocationItem}
                onAllocItemChange={setAllocationItem}
                onSimPersona={(v) => updateForm("simPersona", v)}
                onSimDialogueStyle={(v) => updateForm("simDialogueStyle", v)}
                onSimConstraints={(v) => updateForm("simConstraints", v)}
                onGenerateFromContext={handleGenerateFromContext}
                contextGenerating={contextGenerating}
              />
            )}
            {step === 2 && form.taskType === "quiz" && (
              <WizardStepQuiz
                timeLimitMinutes={form.timeLimitMinutes}
                quizMode={form.quizMode}
                shuffleQuestions={form.shuffleQuestions}
                showResult={form.showResult}
                questions={form.questions}
                errors={errors}
                onTimeLimit={(v) => updateForm("timeLimitMinutes", v)}
                onQuizMode={(v) => updateForm("quizMode", v)}
                onShuffle={(v) => updateForm("shuffleQuestions", v)}
                onShowResult={(v) => updateForm("showResult", v)}
                onQuestionAdd={addQuestion}
                onQuestionRemove={removeQuestion}
                onQuestionChange={setQuestion}
                onQuestionOption={setQuestionOption}
                onOpenAIDialog={() => setAIDialogOpen(true)}
                onGenerateFromContext={handleGenerateFromContext}
                contextGenerating={contextGenerating}
              />
            )}
            {step === 2 && form.taskType === "subjective" && (
              <WizardStepSubjective
                prompt={form.prompt}
                wordLimit={form.wordLimit}
                allowAttachment={form.allowAttachment}
                maxAttachments={form.maxAttachments}
                requirements={form.requirements}
                scoringCriteria={form.scoringCriteria}
                aiGenerating={contextGenerating}
                aiButtonLabel="基于素材生成"
                errors={errors}
                onPrompt={(v) => updateForm("prompt", v)}
                onWordLimit={(v) => updateForm("wordLimit", v)}
                onAllowAttachment={(v) => updateForm("allowAttachment", v)}
                onMaxAttachments={(v) => updateForm("maxAttachments", v)}
                onRequirementAdd={addRequirement}
                onRequirementRemove={removeRequirement}
                onRequirementChange={setRequirement}
                onCriterionAdd={addCriterion}
                onCriterionRemove={removeCriterion}
                onCriterionChange={setCriterion}
                onAIGenerate={handleGenerateFromContext}
              />
            )}
            {step === 3 && (
              <WizardStepReview
                taskType={form.taskType}
                taskName={form.taskName}
                description={form.description}
                totalPoints={form.totalPoints}
                timeLimitMinutes={form.timeLimitMinutes}
                scenario={form.scenario}
                openingLine={form.openingLine}
                requirements={form.requirements}
                scoringCriteria={form.scoringCriteria}
                allocationSections={form.allocationSections}
                quizMode={form.quizMode}
                shuffleQuestions={form.shuffleQuestions}
                showResult={form.showResult}
                questions={form.questions}
                prompt={form.prompt}
                wordLimit={form.wordLimit}
                allowAttachment={form.allowAttachment}
                maxAttachments={form.maxAttachments}
                draftSourceLabel={draftSourceLabel}
              />
            )}

            {/* Footer nav */}
            <div className="flex items-center justify-between rounded-[10px] border border-line bg-surface px-4 py-3.5">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={step === 0 || submitting || savingDraft}
              >
                <ChevronLeft className="size-3.5 mr-1" />
                上一步
              </Button>
              <span className="text-xs text-ink-5 tabular-nums">
                {step + 1} / {WIZARD_STEPS.length} ·{" "}
                {WIZARD_STEPS[step].label}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={!context || submitting || savingDraft}
                >
                  {savingDraft ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存草稿"
                  )}
                </Button>
                {step < WIZARD_STEPS.length - 1 ? (
                  <Button onClick={nextStep} disabled={submitting || savingDraft}>
                    下一步
                    <ChevronRight className="size-3.5 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submitting || savingDraft}>
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      <>
                        <Check className="size-4 mr-1" />
                        创建并发布
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <AIQuizDialog
          open={aiDialogOpen}
          onClose={() => setAIDialogOpen(false)}
          taskName={form.taskName}
          description={form.description}
          onAccept={handleAIQuizAccept}
        />
      </DialogContent>
    </Dialog>
  );
}
