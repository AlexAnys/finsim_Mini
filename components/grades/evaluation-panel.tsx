"use client";

// PR-STU-1 · 学生 /grades 右侧详情面板
// - Header：type chip + 实例标题 + 课程·任务 + 分数 + progress bar + 批改时间
// - Body：AI 评语（暖赭软底 + 左 3px accent 条）+ Rubric 明细 / Quiz 明细 + Transcript 对话
// - D1 防作弊：未公布（!isReleased）只显示 chip + 文案，不展示分数/feedback/rubric/transcript
// - PR-15 bug 6a: rubric criterionId 改用 row.scoringCriteria 的 name 映射 (CUID → 中文)
// - PR-15 bug 6b: 新增 transcript 时间轴气泡 (simulation only, isReleased)
// - PR-15 bug 6c: 移动端响应式 (px / 分数 flex 方向)
// - S1 (P1): 迟交扣分归因行 — applied=true 时显示「原始 X → 迟交扣分 −Y(Z%) → 最终 W」

import { AlertCircle, Check, Clock3, FileText, HelpCircle, MessageSquare, TimerOff, X } from "lucide-react";
import type { GradeRow, GradesTaskType } from "@/lib/utils/grades-transforms";
import { computePercent, scoreTone } from "@/lib/utils/grades-transforms";
import { buildLatePenaltyDisplay, type LatePenalty } from "@/lib/utils/late-penalty";

interface EvaluationPanelProps {
  row: GradeRow | null;
}

interface RubricEntry {
  criterionId: string;
  score: number;
  maxScore: number;
  comment?: string;
  // Unit 9: 评分依据 — 学生侧只显示通过校验（unverified !== true）的 evidence
  evidence?: Array<{ studentText: string; comment: string; unverified?: boolean }>;
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
  // S1 (P1): 迟交扣分明细（grading.service 写入；applied=false / 缺失 → 不展示）
  latePenalty?: LatePenalty;
  // Unit 8: adaptive 模式的薄弱知识点报告
  adaptiveMasteryReport?: {
    totalQuestions: number;
    correctCount: number;
    knowledgePoints: Array<{
      tag: string;
      ability: number;
      confidence: number;
      questionsAnswered: number;
      classification: "薄弱" | "一般" | "掌握";
    }>;
    weakestTopics: string[];
    recommendation: string;
  } | null;
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

function formatTranscriptTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
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
  const masteryReport = isReleased ? evaluation?.adaptiveMasteryReport ?? null : null;
  const feedback = isReleased ? evaluation?.feedback : undefined;
  // S1 (P1): 迟交扣分明细 — 仅 isReleased 且 applied=true 时展示（解释维度之和 ≠ 最终分）
  const latePenalty = isReleased ? buildLatePenaltyDisplay(evaluation) : null;
  // PR-15 bug 6a: criterion id → name 映射（任务发布时刻的 ScoringCriterion.name）
  // 缺失则 fallback 回原始 id 字串（防 schema 漂移）
  const criterionNameMap = new Map<string, string>();
  for (const c of row.scoringCriteria ?? []) {
    if (c?.id && c?.name) criterionNameMap.set(c.id, c.name);
  }
  // PR-15 bug 6b: simulation transcript（只读时间轴气泡）— 仅 isReleased 时展示
  const transcript =
    isReleased && taskType === "simulation" && row.transcript ? row.transcript : null;

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-paper shadow-fs">
      {/* Header */}
      <div className="border-b border-line px-3 pb-4 pt-5 sm:px-5">
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${tone.chip}`}
        >
          <TypeIcon className="size-3" aria-hidden="true" />
          {tone.label}
        </span>
        <div className="mt-2 text-[15px] font-bold leading-snug tracking-tight text-ink">
          {row.instanceTitle || row.taskName}
        </div>
        <div className="mt-0.5 break-words text-xs text-ink-4">
          {row.courseName ? `${row.courseName} · ` : ""}
          {row.taskName}
        </div>

        {/* 分数显示区 / 防作弊 chip */}
        {isReleased ? (
          <div className="mt-4 flex flex-col items-stretch gap-2 border-t border-dashed border-line pt-3.5 sm:flex-row sm:items-end sm:gap-3.5">
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
              <div className="flex flex-wrap justify-between gap-1 text-[11px] text-ink-4">
                <span>{percent}%</span>
                <span>{formatGradedAt(row.gradedAt)}</span>
              </div>
            </div>
          </div>
        ) : row.status === "failed" ? (
          /* Fix 6: AI 批改失败，向学生展示中文兜底提示 + 兜底来自 evaluation.feedback（stripSubmissionForStudent 已保留该字段）。 */
          <div className="mt-3.5 flex flex-col gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3.5 py-3 text-[12.5px] text-danger">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="size-3.5" aria-hidden="true" />
              <span>AI 批改未完成</span>
            </div>
            <p className="leading-relaxed">
              {(row.evaluation as { feedback?: string } | null)?.feedback || "AI 批改暂未完成，请联系老师手动批改。"}
            </p>
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

        {/* S1 (P1): 迟交扣分归因 — 解释「维度之和（原始分）」与「最终分」的差额来源 */}
        {isReleased && latePenalty && (
          <div className="mt-3 rounded-lg border border-warn/30 bg-warn-soft/60 px-3.5 py-2.5 text-[12px] text-ink-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-warn">
              <TimerOff className="size-3.5" aria-hidden="true" />
              {latePenalty.label}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
              <span>
                原始得分 <b className="text-ink">{latePenalty.originalScore}</b>
              </span>
              <span className="text-ink-5">→</span>
              <span className="text-danger">
                迟交扣分 −{latePenalty.penaltyAmount}（{latePenalty.ratePercent}%）
              </span>
              <span className="text-ink-5">→</span>
              <span>
                最终得分 <b className="text-ink">{latePenalty.adjustedScore}</b>
              </span>
            </div>
            <div className="mt-1 text-[10.5px] leading-relaxed text-ink-5">
              下方各维度明细为扣分前原始分，其合计 = 原始得分；最终得分已扣减迟交罚分。
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      {isReleased && (
        <div className="flex-1 overflow-auto px-3 pb-5 pt-4 text-[13px] sm:px-5">
          {/* AI 评语 */}
          {feedback && (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-5">
                AI 评语
              </div>
              <div
                className="whitespace-pre-wrap rounded-lg border-l-[3px] bg-ochre-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink-2"
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
                // PR-15 bug 6a: criterion.id → name；缺失时回落 id（不再显原 CUID 给学生）
                const label = criterionNameMap.get(r.criterionId) ?? r.criterionId;
                return (
                  <div key={`${r.criterionId}-${i}`} className="mb-3">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <span className="text-[12.5px] font-medium leading-snug text-ink-2">
                        {label}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-ink">
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
                      <div className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-4">
                        {r.comment}
                      </div>
                    )}
                    {/* Unit 9: 学生侧 evidence — 仅显示通过校验的引文（unverified !== true）；
                        老评分 evidence===undefined 时显示"无引用依据（历史评分）"。 */}
                    {r.evidence === undefined ? (
                      <div className="mt-1.5 text-[10.5px] italic text-ink-5">
                        无引用依据（历史评分）
                      </div>
                    ) : (
                      r.evidence.filter((ev) => !ev.unverified).length > 0 && (
                        <div className="mt-2 space-y-1.5 border-l-2 border-line pl-2.5">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-5">
                            评分依据
                          </div>
                          {r.evidence
                            .filter((ev) => !ev.unverified)
                            .map((ev, j) => (
                              <div key={j} className="text-[11px] leading-relaxed">
                                {ev.studentText && (
                                  <div>
                                    <span className="rounded bg-yellow-50 px-1 text-ink-2">
                                      「{ev.studentText}」
                                    </span>
                                  </div>
                                )}
                                {ev.comment && (
                                  <div className="mt-0.5 text-ink-5">{ev.comment}</div>
                                )}
                              </div>
                            ))}
                        </div>
                      )
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
                        <span className="shrink-0 font-mono text-xs text-ink">
                          {q.score}/{q.maxScore}
                        </span>
                      </div>
                      {q.comment && (
                        <div className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-4">
                          {q.comment}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Unit 8: 自适应测验的薄弱知识点报告 */}
          {masteryReport && (
            <div className="mt-5 rounded-lg border border-ochre/30 bg-ochre-soft/40 p-3.5">
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-5">
                自适应诊断
              </div>
              <div className="mb-2 text-[12px] text-ink-3">
                共答题 <b className="text-ink">{masteryReport.totalQuestions}</b> 题 · 答对{" "}
                <b className="text-ink">{masteryReport.correctCount}</b> 题 · 诊断{" "}
                <b className="text-ink">{masteryReport.knowledgePoints.length}</b> 个知识点
              </div>
              <ul className="mb-2 grid gap-1.5 sm:grid-cols-2">
                {masteryReport.knowledgePoints.map((kp) => (
                  <li
                    key={kp.tag}
                    className="flex items-center justify-between rounded-md border border-line bg-paper p-2 text-[12px]"
                  >
                    <span className="truncate text-ink-2">{kp.tag}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] ${
                        kp.classification === "薄弱"
                          ? "bg-danger-soft text-danger"
                          : kp.classification === "一般"
                            ? "bg-warn-soft text-warn"
                            : "bg-success-soft text-success"
                      }`}
                    >
                      {kp.classification}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="rounded-md bg-paper p-2 text-[11.5px] leading-relaxed text-ink-3">
                <b>学习建议：</b>
                {masteryReport.recommendation}
              </div>
            </div>
          )}

          {/* PR-15 bug 6b: 模拟对话历史时间轴气泡 — 仅 simulation + isReleased 显示 */}
          {transcript && transcript.length > 0 && (
            <div className="mt-5">
              <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-5">
                完整对话记录（{transcript.length} 条）
              </div>
              <div className="space-y-2.5">
                {transcript.map((msg, i) => {
                  const isStudent = msg.role === "student";
                  return (
                    <div
                      key={msg.id ?? `t-${i}`}
                      className={`flex ${isStudent ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                          isStudent
                            ? "rounded-br-md bg-brand text-brand-fg"
                            : "rounded-bl-md bg-paper-alt text-ink-2"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            isStudent ? "text-brand-fg/70" : "text-ink-5"
                          }`}
                        >
                          {isStudent ? "我" : "AI 客户"}
                          {msg.timestamp ? ` · ${formatTranscriptTime(msg.timestamp)}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* feedback/rubric/quiz/transcript 全空时 */}
          {!feedback &&
            (!rubric || rubric.length === 0) &&
            (!quizBreak || quizBreak.length === 0) &&
            !masteryReport &&
            (!transcript || transcript.length === 0) && (
              <div className="rounded-lg border border-line bg-paper-alt px-3.5 py-6 text-center text-xs text-ink-4">
                暂无评分明细
              </div>
            )}
        </div>
      )}
    </div>
  );
}
