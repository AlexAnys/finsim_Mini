"use client";

// PR-STU-1 · 学生 /grades 右侧详情面板
// - Header：type chip + 实例标题 + 课程·任务 + 分数 + progress bar + 批改时间
// - Body：AI 评语（暖赭软底 + 左 3px accent 条）+ Rubric 明细 / Quiz 明细
// - D1 防作弊：未公布（!isReleased）只显示 chip + 文案，不展示分数/feedback/rubric

import { Check, Clock3, FileText, HelpCircle, MessageSquare, X } from "lucide-react";
import type { GradeRow, GradesTaskType } from "@/lib/utils/grades-transforms";
import { computePercent, scoreTone } from "@/lib/utils/grades-transforms";

interface EvaluationPanelProps {
  row: GradeRow | null;
}

interface RubricEntry {
  criterionId: string;
  score: number;
  maxScore: number;
  comment?: string;
}

interface QuizEntry {
  questionId?: string;
  score: number;
  maxScore: number;
  correct?: boolean;
  comment?: string;
}

interface EvaluationShape {
  feedback?: string;
  rubricBreakdown?: RubricEntry[];
  quizBreakdown?: QuizEntry[];
}

const TYPE_TONE: Record<
  GradesTaskType,
  { label: string; chip: string; icon: React.ComponentType<{ className?: string }> }
> = {
  simulation: {
    label: "模拟对话",
    chip: "bg-sim-soft text-sim border-sim/20",
    icon: MessageSquare,
  },
  quiz: {
    label: "测验",
    chip: "bg-quiz-soft text-quiz border-quiz/20",
    icon: HelpCircle,
  },
  subjective: {
    label: "主观题",
    chip: "bg-subj-soft text-subj border-subj/20",
    icon: FileText,
  },
};

const SCORE_TONE_CLASS = {
  success: "text-success",
  primary: "text-brand",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-ink-5",
} as const;

const SCORE_TONE_BG = {
  success: "bg-success",
  primary: "bg-brand",
  warn: "bg-warn",
  danger: "bg-danger",
  muted: "bg-line",
} as const;

function formatGradedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day} ${hh}:${mm} 批改`;
}

export function EvaluationPanel({ row }: EvaluationPanelProps) {
  if (!row) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-[14px] border border-line bg-paper p-6 text-sm text-ink-4 shadow-fs">
        暂无可查看的提交
      </div>
    );
  }

  const taskType = (row.taskType as GradesTaskType) in TYPE_TONE
    ? (row.taskType as GradesTaskType)
    : "simulation";
  const tone = TYPE_TONE[taskType];
  const TypeIcon = tone.icon;

  const isReleased = row.analysisStatus === "released" && row.score !== null;
  const percent = computePercent(row.score, row.maxScore);
  const toneKey = scoreTone(percent);
  const scoreColor = SCORE_TONE_CLASS[toneKey];
  const scoreBar = SCORE_TONE_BG[toneKey];

  const evaluation = (row.evaluation ?? null) as EvaluationShape | null;
  const rubric = isReleased ? evaluation?.rubricBreakdown ?? null : null;
  const quizBreak = isReleased ? evaluation?.quizBreakdown ?? null : null;
  const feedback = isReleased ? evaluation?.feedback : undefined;

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-paper shadow-fs">
      {/* Header */}
      <div className="border-b border-line px-5 pb-4 pt-5">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${tone.chip}`}
        >
          <TypeIcon className="size-3" aria-hidden="true" />
          {tone.label}
        </span>
        <div className="mt-2 text-[15px] font-bold leading-snug tracking-tight text-ink">
          {row.instanceTitle || row.taskName}
        </div>
        <div className="mt-0.5 text-xs text-ink-4">
          {row.courseName ? `${row.courseName} · ` : ""}
          {row.taskName}
        </div>

        {/* 分数显示区 / 防作弊 chip */}
        {isReleased ? (
          <div className="mt-4 flex items-end gap-3.5 border-t border-dashed border-line pt-3.5">
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.05em] text-ink-5">
                本次得分
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={`font-mono text-[42px] font-bold leading-none tracking-[-0.04em] ${scoreColor}`}
                >
                  {row.score}
                </span>
                <span className="font-mono text-sm text-ink-4">
                  / {row.maxScore}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="mb-1 h-1.5 overflow-hidden rounded-sm bg-line-2">
                <div
                  className={`h-full rounded-sm ${scoreBar}`}
                  style={{ width: `${percent ?? 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-ink-4">
                <span>{percent}%</span>
                <span>{formatGradedAt(row.gradedAt)}</span>
              </div>
            </div>
          </div>
        ) : row.analysisStatus === "analyzed_unreleased" ? (
          <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-ochre/20 bg-ochre-soft px-3.5 py-3 text-[12.5px] text-ochre">
            <Clock3 className="size-3.5" aria-hidden="true" />
            <span>AI 已分析完毕 · 等待教师公布后即可查看分数与评语。</span>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-2 rounded-lg border border-warn/20 bg-warn-soft px-3.5 py-3 text-[12.5px] text-warn">
            <Clock3 className="size-3.5" aria-hidden="true" />
            <span>AI 分析中 · 一般 2-5 分钟内完成，刷新即可看到最新进度。</span>
          </div>
        )}
      </div>

      {/* Body */}
      {isReleased && (
        <div className="flex-1 overflow-auto px-5 pb-5 pt-4 text-[13px]">
          {/* AI 评语 */}
          {feedback && (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-5">
                AI 评语
              </div>
              <div
                className="rounded-lg border-l-[3px] bg-ochre-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink-2"
                style={{ borderLeftColor: "var(--fs-accent)" }}
              >
                {feedback}
              </div>
            </>
          )}

          {/* Rubric 明细 */}
          {rubric && rubric.length > 0 && (
            <div className="mt-5">
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-5">
                评分明细（{rubric.length} 维度）
              </div>
              {rubric.map((r, i) => {
                const ratio = r.maxScore > 0 ? r.score / r.maxScore : 0;
                const barClass =
                  ratio >= 0.9
                    ? "bg-success"
                    : ratio >= 0.7
                      ? "bg-brand"
                      : "bg-warn";
                return (
                  <div key={`${r.criterionId}-${i}`} className="mb-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-ink-2">
                        {r.criterionId}
                      </span>
                      <span className="font-mono text-xs text-ink">
                        <b>{r.score}</b>
                        <span className="text-ink-5">/{r.maxScore}</span>
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-sm bg-line-2">
                      <div
                        className={`h-full rounded-sm ${barClass}`}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                    {r.comment && (
                      <div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-4">
                        {r.comment}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Quiz 明细 */}
          {quizBreak && quizBreak.length > 0 && (
            <div className="mt-5">
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-5">
                题目明细（{quizBreak.length} 题）
              </div>
              {quizBreak.map((q, i) => {
                const correct = q.correct === true || q.score === q.maxScore;
                return (
                  <div
                    key={`${q.questionId ?? i}`}
                    className={`mb-1.5 flex gap-2.5 rounded-lg px-3 py-2.5 ${
                      correct ? "bg-success-soft" : "bg-danger-soft"
                    }`}
                  >
                    <div
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                        correct ? "bg-success" : "bg-danger"
                      } text-white`}
                    >
                      {correct ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        <X className="size-3" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between">
                        <span className="text-[12.5px] font-medium text-ink-2">
                          第 {i + 1} 题
                        </span>
                        <span className="font-mono text-xs text-ink">
                          {q.score}/{q.maxScore}
                        </span>
                      </div>
                      {q.comment && (
                        <div className="mt-1 text-[11.5px] leading-relaxed text-ink-4">
                          {q.comment}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* feedback/rubric/quiz 全空时 */}
          {!feedback &&
            (!rubric || rubric.length === 0) &&
            (!quizBreak || quizBreak.length === 0) && (
              <div className="rounded-lg border border-line bg-paper-alt px-3.5 py-6 text-center text-xs text-ink-4">
                暂无评分明细
              </div>
            )}
        </div>
      )}
    </div>
  );
}
