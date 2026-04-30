"use client";

import { Check, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { WizardCard } from "./wizard-card";
import { WizardReviewBlock } from "./wizard-review-block";
import { TASK_TYPE_META, type TaskType } from "./wizard-types";

type QuizQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

const QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

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

interface ReviewProps {
  taskType: TaskType;
  taskName: string;
  description: string;
  totalPoints: number;
  timeLimitMinutes: string;
  // sim
  scenario: string;
  openingLine: string;
  requirements: string[];
  scoringCriteria: ScoringCriterion[];
  allocationSections: AllocationSection[];
  // quiz
  quizMode: "fixed" | "adaptive";
  shuffleQuestions: boolean;
  showResult: boolean;
  questions: QuizQuestion[];
  // subjective
  prompt: string;
  wordLimit: string;
  allowAttachment: boolean;
  maxAttachments: string;
  draftSourceLabel?: string;
}

export function WizardStepReview(props: ReviewProps) {
  const {
    taskType,
    taskName,
    description,
    totalPoints,
    timeLimitMinutes,
    draftSourceLabel,
  } = props;
  const meta = TASK_TYPE_META[taskType];

  return (
    <WizardCard
      title="预览并创建"
      subtitle='确认下方信息无误。点击"创建任务"后，会保存为草稿（尚未发布）。'
    >
      {draftSourceLabel && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11.5px] leading-relaxed text-blue-900">
          {draftSourceLabel}
        </div>
      )}

      {/* Hero preview card — 深色渐变（类型色） */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl p-5 text-white",
          meta.bgClass
        )}
      >
        <div className="absolute -right-5 -top-5 size-36 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-2">
          <span className="rounded bg-white/20 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-widest text-white">
            {meta.en}
          </span>
          <span className="rounded bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold text-white">
            {meta.label}
          </span>
        </div>
        <div className="relative mt-3 text-[22px] font-semibold tracking-tight">
          {taskName || "未命名任务"}
        </div>
        {description && (
          <div className="relative mt-1.5 max-w-3xl text-[13px] leading-relaxed text-white/85">
            {description}
          </div>
        )}
        <div className="relative mt-4 flex flex-wrap gap-4 text-xs text-white/90">
          <div className="inline-flex items-center gap-1.5">
            <Clock className="size-3" />
            <span>
              时长 <b className="tabular-nums">{timeLimitMinutes || "不限"}</b>
              {timeLimitMinutes && " 分钟"}
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Trophy className="size-3" />
            <span>
              总分 <b className="tabular-nums">{totalPoints}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {taskType === "simulation" && (
          <SimReviewBody {...props} />
        )}
        {taskType === "quiz" && (
          <QuizReviewBody {...props} />
        )}
        {taskType === "subjective" && (
          <SubjectiveReviewBody {...props} />
        )}
      </div>

      {/* Ready panel */}
      <div className="flex items-center justify-between gap-3.5 rounded-[10px] border border-brand/25 bg-brand-soft px-3.5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-brand text-white">
            <Check className="size-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">准备就绪</div>
            <p className="m-0 mt-0.5 text-[11.5px] text-ink-3">
              点击底部「创建任务」保存为草稿；发布给班级需要在任务列表中另行操作。
            </p>
          </div>
        </div>
      </div>
    </WizardCard>
  );
}

function SimReviewBody(props: ReviewProps) {
  const { scenario, openingLine, requirements, scoringCriteria, allocationSections } = props;
  const validRequirements = requirements.filter((r) => r.trim());
  const validCriteria = scoringCriteria.filter((c) => c.name.trim());
  const firstSection = allocationSections.find((s) => s.label.trim());
  const validItems = firstSection?.items.filter((i) => i.label.trim()) ?? [];

  return (
    <>
      <WizardReviewBlock title="场景" wide>
        {scenario || "（未填写）"}
      </WizardReviewBlock>
      <WizardReviewBlock title="AI 开场白" mono wide>
        {openingLine || "（未填写）"}
      </WizardReviewBlock>
      {validRequirements.length > 0 && (
        <WizardReviewBlock title={`对话要求 · ${validRequirements.length} 条`}>
          <ul className="m-0 list-none space-y-1 p-0">
            {validRequirements.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed"
              >
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-sim-soft text-[9px] font-bold tabular-nums text-sim">
                  {i + 1}
                </span>
                <span className="text-ink-2">{r}</span>
              </li>
            ))}
          </ul>
        </WizardReviewBlock>
      )}
      {validCriteria.length > 0 && (
        <WizardReviewBlock title={`评分标准 · ${validCriteria.length} 项`}>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {validCriteria.map((c, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2.5 text-xs"
              >
                <span className="text-ink-2">{c.name}</span>
                <span className="font-semibold tabular-nums text-ink-4">
                  {c.maxPoints} 分
                </span>
              </li>
            ))}
          </ul>
        </WizardReviewBlock>
      )}
      {validItems.length > 0 && firstSection && (
        <WizardReviewBlock
          title={`资产配置 · ${firstSection.label || "分区"} · ${validItems.length} 项`}
          wide
        >
          <div className="flex flex-wrap gap-1.5">
            {validItems.map((item, i) => (
              <span
                key={i}
                className="rounded-md bg-sim-soft px-2.5 py-1 text-[11.5px] font-medium text-sim"
              >
                {item.label}
                {item.defaultValue > 0 && (
                  <>
                    {" "}
                    <b className="tabular-nums">{item.defaultValue}%</b>
                  </>
                )}
              </span>
            ))}
          </div>
        </WizardReviewBlock>
      )}
    </>
  );
}

function QuizReviewBody(props: ReviewProps) {
  const { quizMode, timeLimitMinutes, shuffleQuestions, showResult, questions } = props;
  const totalQuestionPoints = questions.reduce(
    (s, q) => s + (q.points || 0),
    0
  );

  return (
    <>
      <WizardReviewBlock title={`题目 · ${questions.length} 题 · 合计 ${totalQuestionPoints} 分`}>
        {questions.length === 0 ? (
          <span className="text-ink-4">（无题目）</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            {questions.map((q, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 text-xs leading-relaxed"
              >
                <span className="font-semibold tabular-nums text-ink-5">
                  {i + 1}.
                </span>
                <span className="flex-1 truncate text-ink-2">
                  <span className="mr-1 rounded bg-quiz-soft px-1 py-px text-[10px] font-semibold text-quiz">
                    {QUESTION_TYPE_LABELS[q.type]}
                  </span>
                  {q.stem || "（空）"}
                </span>
                <span className="tabular-nums text-ink-4">{q.points}分</span>
              </div>
            ))}
          </div>
        )}
      </WizardReviewBlock>
      <WizardReviewBlock title="设置">
        <div className="flex flex-col gap-1 text-xs text-ink-3">
          <div>
            <span className="text-ink-5">模式：</span>
            <b className="text-ink-2">
              {quizMode === "fixed" ? "固定题目" : "自适应"}
            </b>
          </div>
          <div>
            <span className="text-ink-5">时长：</span>
            <b className="text-ink-2">
              {timeLimitMinutes ? `${timeLimitMinutes} 分钟` : "不限"}
            </b>
          </div>
          <div>
            <span className="text-ink-5">随机题序：</span>
            <b className="text-ink-2">{shuffleQuestions ? "是" : "否"}</b>
          </div>
          <div>
            <span className="text-ink-5">提交后显示答案：</span>
            <b className="text-ink-2">{showResult ? "是" : "否"}</b>
          </div>
        </div>
      </WizardReviewBlock>
    </>
  );
}

function SubjectiveReviewBody(props: ReviewProps) {
  const {
    prompt,
    wordLimit,
    allowAttachment,
    maxAttachments,
    requirements,
    scoringCriteria,
  } = props;
  const validRequirements = requirements.filter((r) => r.trim());
  const validCriteria = scoringCriteria.filter((c) => c.name.trim());

  return (
    <>
      <WizardReviewBlock title="题干" wide>
        {prompt || "（未填写）"}
      </WizardReviewBlock>
      <WizardReviewBlock title="提交要求">
        <div className="flex flex-col gap-1 text-xs text-ink-3">
          <div>
            <span className="text-ink-5">字数上限：</span>
            <b className="text-ink-2">{wordLimit ? `${wordLimit} 字` : "不限"}</b>
          </div>
          <div>
            <span className="text-ink-5">附件：</span>
            <b className="text-ink-2">
              {allowAttachment ? `最多 ${maxAttachments} 个` : "不允许"}
            </b>
          </div>
        </div>
      </WizardReviewBlock>
      {validCriteria.length > 0 && (
        <WizardReviewBlock title={`评分标准 · ${validCriteria.length} 项`}>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {validCriteria.map((c, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2.5 text-xs"
              >
                <span className="text-ink-2">{c.name}</span>
                <span className="font-semibold tabular-nums text-ink-4">
                  {c.maxPoints} 分
                </span>
              </li>
            ))}
          </ul>
        </WizardReviewBlock>
      )}
      {validRequirements.length > 0 && (
        <WizardReviewBlock title={`作答要求 · ${validRequirements.length} 条`} wide>
          <ul className="m-0 list-none space-y-1 p-0">
            {validRequirements.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs leading-relaxed"
              >
                <span className="grid size-4 shrink-0 place-items-center rounded-full bg-subj-soft text-[9px] font-bold tabular-nums text-subj">
                  {i + 1}
                </span>
                <span className="text-ink-2">{r}</span>
              </li>
            ))}
          </ul>
        </WizardReviewBlock>
      )}
    </>
  );
}
