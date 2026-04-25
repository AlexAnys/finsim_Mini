"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Save, SkipForward, ChevronRight, Paperclip } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { NormalizedSubmission } from "./submissions-utils";

interface ScoringCriterion {
  id: string;
  name: string;
  description?: string | null;
  maxPoints: number;
}

interface SubmissionDetail {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  taskType: string;
  student: { id: string; name: string };
  task: {
    id: string;
    taskName: string;
    taskType: string;
    scoringCriteria?: ScoringCriterion[];
    simulationConfig?: { customerProfile?: string | null } | null;
    quizConfig?: unknown;
    subjectiveConfig?: { prompt?: string | null } | null;
  };
  simulationSubmission?: {
    transcript?: Array<{ role: string; text: string; timestamp?: string }> | null;
    evaluation?: GradeEvaluation | null;
  } | null;
  quizSubmission?: {
    answers?: Array<{ questionId: string; answer: string | string[]; isCorrect?: boolean }> | null;
    evaluation?: GradeEvaluation | null;
  } | null;
  subjectiveSubmission?: {
    textAnswer?: string | null;
    evaluation?: GradeEvaluation | null;
    attachments?: Array<{ id: string; fileName: string; filePath: string; fileSize: number; contentType: string }>;
  } | null;
}

interface GradeEvaluation {
  totalScore?: number;
  maxScore?: number;
  feedback?: string;
  rubricBreakdown?: Array<{ criterionId: string; score: number; maxScore: number; comment?: string }>;
  confidence?: number;
}

export interface GradingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
  showAiSuggestion: boolean;
  onSaved: (submissionId: string) => void;
  onNext?: (currentId: string) => void;
}

export function GradingDrawer({
  open,
  onOpenChange,
  submissionId,
  showAiSuggestion,
  onSaved,
  onNext,
}: GradingDrawerProps) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAi, setShowAi] = useState(showAiSuggestion);

  useEffect(() => {
    setShowAi(showAiSuggestion);
  }, [showAiSuggestion]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !submissionId) {
      setDetail(null);
      setError(null);
      setCriteriaScores({});
      setFeedback("");
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/submissions/${submissionId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) {
          setError(j.error?.message || "加载失败");
          return;
        }
        const d = j.data as SubmissionDetail;
        setDetail(d);
        const evaluation = pickEvaluation(d);
        const initialScores: Record<string, number> = {};
        const criteria = d.task.scoringCriteria || [];
        for (const c of criteria) {
          const fromAi = evaluation?.rubricBreakdown?.find(
            (b) => b.criterionId === c.id
          );
          initialScores[c.id] = typeof fromAi?.score === "number" ? fromAi.score : 0;
        }
        setCriteriaScores(initialScores);
        setFeedback(evaluation?.feedback || "");
      })
      .catch(() => {
        if (!cancelled) setError("网络错误，请稍后重试");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, submissionId]);

  const criteria = detail?.task.scoringCriteria || [];
  const totalMax = useMemo(
    () => criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0) || 100,
    [criteria]
  );
  const totalScore = useMemo(
    () =>
      criteria.reduce((sum, c) => sum + (criteriaScores[c.id] ?? 0), 0),
    [criteria, criteriaScores]
  );

  const evaluation = useMemo(() => (detail ? pickEvaluation(detail) : null), [detail]);

  const handleScoreChange = (criterionId: string, value: number, max: number) => {
    setCriteriaScores((prev) => ({
      ...prev,
      [criterionId]: Math.max(0, Math.min(max, value)),
    }));
  };

  const handleSave = async (afterSave?: "next" | "close") => {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/submissions/${detail.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: totalScore,
          maxScore: totalMax,
          feedback: feedback.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "保存失败");
        return;
      }
      onSaved(detail.id);
      if (afterSave === "next" && onNext) {
        onNext(detail.id);
      } else {
        onOpenChange(false);
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[1000px] sm:max-w-[1000px] p-0 gap-0"
      >
        <SheetHeader className="border-b border-line p-4">
          <SheetTitle className="text-base">
            {detail
              ? `批改：${detail.student.name}`
              : submissionId
              ? "加载中..."
              : "批改面板"}
          </SheetTitle>
          <SheetDescription className="text-xs text-ink-4">
            {detail?.task.taskName} · {taskTypeLabel(detail?.task.taskType)}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-ink-5" />
            <span className="ml-2 text-sm text-ink-4">加载中...</span>
          </div>
        ) : error && !detail ? (
          <div className="flex flex-1 items-center justify-center text-sm text-danger">
            {error}
          </div>
        ) : !detail ? (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-4">
            未选择提交
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            {/* Left: answer */}
            <section className="flex min-h-0 flex-col overflow-y-auto border-r border-line bg-paper-alt p-4">
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.6px] text-ink-5">
                学生答卷
              </h3>
              <AnswerPanel detail={detail} />
            </section>

            {/* Right: scoring */}
            <section className="flex min-h-0 flex-col overflow-y-auto bg-surface">
              <div className="space-y-4 p-4">
                {evaluation && showAiSuggestion && (
                  <div className="rounded-lg border border-line bg-sim-soft/40 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-sim">
                        <Sparkles className="size-3" />
                        AI 评分建议
                        {typeof evaluation.confidence === "number" && (
                          <span
                            className="ml-1 rounded bg-sim/10 px-1.5 py-0.5 text-[10px] font-medium tabular-nums"
                            title="AI 置信度"
                          >
                            置信度 {Math.round(evaluation.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-[10px] text-ink-5 hover:underline"
                        onClick={() => setShowAi((s) => !s)}
                      >
                        {showAi ? "折叠" : "展开"}
                      </button>
                    </div>
                    {showAi && (
                      <div>
                        <div className="text-[12px] text-ink-3">
                          AI 总分{" "}
                          <b className="tabular-nums text-ink">
                            {evaluation.totalScore ?? "-"}
                          </b>
                          {evaluation.maxScore != null && (
                            <span className="text-ink-5">
                              {" "}
                              /{evaluation.maxScore}
                            </span>
                          )}
                        </div>
                        {evaluation.feedback && (
                          <p className="mt-1.5 line-clamp-3 text-[11.5px] leading-relaxed text-ink-4">
                            {evaluation.feedback}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.6px] text-ink-5">
                    <span>评分维度</span>
                    <span className="text-ink-3 normal-case tracking-normal">
                      合计 <b className="tabular-nums text-ink">{totalScore}</b>
                      <span className="text-ink-5"> / {totalMax}</span>
                    </span>
                  </div>
                  {criteria.length === 0 ? (
                    <div className="rounded-md border border-dashed border-line p-3 text-center text-[12px] text-ink-5">
                      该任务未配置评分维度
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {criteria.map((c) => {
                        const aiScore = evaluation?.rubricBreakdown?.find(
                          (b) => b.criterionId === c.id
                        );
                        return (
                          <div
                            key={c.id}
                            className="rounded-md border border-line p-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[12.5px] font-medium text-ink-2">
                                  {c.name}
                                </div>
                                {c.description && (
                                  <div className="mt-0.5 text-[10.5px] leading-relaxed text-ink-5">
                                    {c.description}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={c.maxPoints}
                                  step={0.5}
                                  value={criteriaScores[c.id] ?? 0}
                                  onChange={(e) =>
                                    handleScoreChange(
                                      c.id,
                                      parseFloat(e.target.value) || 0,
                                      c.maxPoints
                                    )
                                  }
                                  className="h-8 w-16 text-right text-sm tabular-nums"
                                />
                                <span className="text-[11px] text-ink-5">
                                  / {c.maxPoints}
                                </span>
                              </div>
                            </div>
                            {aiScore && showAiSuggestion && showAi && (
                              <div className="mt-1.5 text-[10.5px] text-sim">
                                AI 建议 {aiScore.score}/{aiScore.maxScore}
                                {aiScore.comment && ` · ${aiScore.comment}`}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.6px] text-ink-5">
                    教师评语
                  </label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                    placeholder="可选：写给学生的评语"
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-danger/40 bg-danger-soft px-3 py-2 text-xs text-danger">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-auto flex items-center justify-end gap-2 border-t border-line bg-paper-alt p-3">
                {onNext && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNext(detail.id)}
                    disabled={saving}
                  >
                    <SkipForward className="size-3" />
                    跳过
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave("close")}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Save className="size-3" />
                  )}
                  保存
                </Button>
                {onNext && (
                  <Button
                    size="sm"
                    onClick={() => handleSave("next")}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    保存 & 下一份
                  </Button>
                )}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function pickEvaluation(d: SubmissionDetail): GradeEvaluation | null {
  return (
    (d.simulationSubmission?.evaluation as GradeEvaluation | undefined) ||
    (d.quizSubmission?.evaluation as GradeEvaluation | undefined) ||
    (d.subjectiveSubmission?.evaluation as GradeEvaluation | undefined) ||
    null
  );
}

function taskTypeLabel(t?: string): string {
  if (!t) return "";
  if (t === "simulation") return "模拟对话";
  if (t === "quiz") return "测验";
  if (t === "subjective") return "主观题";
  return t;
}

function AnswerPanel({ detail }: { detail: SubmissionDetail }) {
  const t = detail.task.taskType;

  if (t === "simulation") {
    const transcript =
      detail.simulationSubmission?.transcript &&
      Array.isArray(detail.simulationSubmission.transcript)
        ? detail.simulationSubmission.transcript
        : [];
    if (transcript.length === 0) {
      return <EmptyAnswer label="暂无对话记录" />;
    }
    return (
      <div className="space-y-2.5">
        {transcript.map((m, i) => {
          const isStudent = m.role === "student";
          return (
            <div
              key={i}
              className={`flex ${isStudent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${
                  isStudent
                    ? "bg-brand text-brand-fg"
                    : "bg-surface text-ink-2 border border-line"
                }`}
              >
                <div
                  className={`mb-0.5 text-[10.5px] font-medium ${
                    isStudent ? "text-brand-fg/70" : "text-ink-5"
                  }`}
                >
                  {isStudent ? "学生" : "AI 客户"}
                </div>
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (t === "quiz") {
    const answers =
      detail.quizSubmission?.answers && Array.isArray(detail.quizSubmission.answers)
        ? detail.quizSubmission.answers
        : [];
    if (answers.length === 0) {
      return <EmptyAnswer label="暂无答题记录" />;
    }
    return (
      <ol className="space-y-2.5">
        {answers.map((a, i) => (
          <li
            key={i}
            className="rounded-md border border-line bg-surface p-2.5"
          >
            <div className="mb-1 flex items-center justify-between text-[10.5px]">
              <span className="text-ink-5">第 {i + 1} 题</span>
              {typeof a.isCorrect === "boolean" && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    a.isCorrect
                      ? "bg-success-soft text-success-deep"
                      : "bg-danger-soft text-danger"
                  }`}
                >
                  {a.isCorrect ? "正确" : "错误"}
                </span>
              )}
            </div>
            <div className="text-[12.5px] text-ink-2">
              答：
              <span className="whitespace-pre-wrap font-medium">
                {Array.isArray(a.answer) ? a.answer.join(", ") : a.answer || "（未作答）"}
              </span>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  if (t === "subjective") {
    const text = detail.subjectiveSubmission?.textAnswer || "";
    const attachments = detail.subjectiveSubmission?.attachments || [];
    return (
      <div className="space-y-3">
        {detail.task.subjectiveConfig?.prompt && (
          <div className="rounded-md border border-line bg-surface p-3">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-ink-5">
              题目
            </div>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-3">
              {detail.task.subjectiveConfig.prompt}
            </p>
          </div>
        )}
        {text && (
          <div className="rounded-md border border-line bg-surface p-3">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-ink-5">
              文本作答
            </div>
            <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">
              {text}
            </p>
          </div>
        )}
        {attachments.length > 0 && (
          <div className="rounded-md border border-line bg-surface p-3">
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-ink-5">
              附件（{attachments.length}）
            </div>
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 text-[12px] text-ink-3"
                >
                  <Paperclip className="size-3 text-ink-5" />
                  <a
                    href={a.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline truncate"
                  >
                    {a.fileName}
                  </a>
                  <span className="text-ink-5 tabular-nums shrink-0">
                    {formatBytes(a.fileSize)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!text && attachments.length === 0 && <EmptyAnswer label="暂无作答" />}
      </div>
    );
  }

  return <EmptyAnswer label="未知任务类型" />;
}

function EmptyAnswer({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-line bg-surface py-8 text-center text-[12px] text-ink-5">
      {label}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
