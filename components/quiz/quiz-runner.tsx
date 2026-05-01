"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  BookOpen,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RunnerTopbar } from "@/components/runner/runner-topbar";
import { RunnerMetaProgress, RunnerMetaTimer } from "@/components/runner/runner-meta";
import {
  SubmissionProcessingCard,
  type AsyncJobSnapshot,
} from "@/components/runner/submission-processing-card";

// ---------- Types ----------

interface QuizOption {
  label: string;
  content: string;
}

interface QuizQuestion {
  id: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "short_answer";
  stem: string;
  options: QuizOption[] | null;
  points: number;
  explanation: string | null;
}

interface QuizTaskConfig {
  timeLimit: number | null;
  mode: "practice" | "exam";
  shuffleQuestions: boolean;
  showResult: boolean;
  questions: QuizQuestion[];
}

interface QuizRunnerProps {
  taskConfig: QuizTaskConfig;
  taskId: string;
  taskInstanceId: string;
  taskName: string;
  taskSubtitle?: string;
  isPreview?: boolean;
}

type AnswerValue = string | string[];

interface QuestionResult {
  questionId: string;
  correct: boolean;
  score: number;
  maxScore: number;
  comment: string;
}

interface QuizResult {
  totalScore: number;
  maxScore: number;
  feedback: string;
  breakdown: QuestionResult[];
}

// ---------- Constants ----------

const DRAFT_KEY_PREFIX = "finsim_quiz_draft_";

// ---------- Helpers ----------

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ---------- Component ----------

export function QuizRunner({
  taskConfig,
  taskId,
  taskInstanceId,
  taskName,
  taskSubtitle,
  isPreview = false,
}: QuizRunnerProps) {
  const router = useRouter();
  const {
    timeLimit,
    mode,
    shuffleQuestions,
    showResult,
    questions: rawQuestions,
  } = taskConfig;

  // Shuffle questions on mount if needed (stable across re-renders)
  const questions = useMemo(() => {
    return shuffleQuestions ? shuffleArray(rawQuestions) : rawQuestions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation state
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers state: questionId -> answer value
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>(() => {
    if (typeof window === "undefined") return {};
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.answers || {};
      } catch {
        return {};
      }
    }
    return {};
  });

  // Practice mode: per-question confirmed state
  const [confirmedQuestions, setConfirmedQuestions] = useState<Set<string>>(
    () => new Set()
  );

  // Timer state (timeLimit is in minutes, convert to seconds)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(() => {
    if (!timeLimit) return null;
    if (typeof window === "undefined") return timeLimit * 60;
    const saved = localStorage.getItem(DRAFT_KEY_PREFIX + taskInstanceId);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed.timeRemaining === "number") return parsed.timeRemaining;
      } catch {
        // fall through
      }
    }
    return timeLimit * 60;
  });
  const startTimeRef = useRef(Date.now());

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [gradingJob, setGradingJob] = useState<AsyncJobSnapshot | null>(null);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || submitted) return;
    if (timeRemaining <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining !== null, submitted, timeRemaining === 0]);

  // Save draft
  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      DRAFT_KEY_PREFIX + taskInstanceId,
      JSON.stringify({ answers, timeRemaining })
    );
  }, [answers, timeRemaining, taskInstanceId]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  // Current question
  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (!a) return false;
    if (Array.isArray(a)) return a.length > 0;
    return typeof a === "string" && a.trim().length > 0;
  }).length;

  // Answer handlers
  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function toggleMultipleChoice(questionId: string, option: string) {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) || [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [questionId]: next };
    });
  }

  // Practice mode: confirm single question
  function handleConfirmQuestion() {
    if (!currentQuestion) return;
    const answer = answers[currentQuestion.id];
    if (
      !answer ||
      (Array.isArray(answer) && answer.length === 0) ||
      (typeof answer === "string" && !answer.trim())
    ) {
      toast.error("请先作答再确认");
      return;
    }
    setConfirmedQuestions((prev) => new Set(prev).add(currentQuestion.id));
  }

  // Submit all answers
  async function handleSubmit() {
    if (submitted || isSubmitting) return;

    const unanswered = questions.filter((q) => {
      const a = answers[q.id];
      return (
        !a ||
        (Array.isArray(a) && a.length === 0) ||
        (typeof a === "string" && !a.trim())
      );
    });

    if (unanswered.length > 0 && timeRemaining !== 0) {
      toast.error(`还有 ${unanswered.length} 题未作答，请完成后再提交`);
      return;
    }

    setIsSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);

    try {
      if (isPreview) {
        setSubmitted(true);
        toast.success("预览完成：未生成学生提交记录");
        return;
      }

      const payload = {
        taskType: "quiz" as const,
        taskId,
        taskInstanceId,
        answers: questions.map((q) => {
          const raw = answers[q.id];
          if (q.type === "short_answer") {
            return { questionId: q.id, textAnswer: typeof raw === "string" ? raw : "" };
          }
          // single_choice, multiple_choice, true_false
          const ids = Array.isArray(raw) ? raw : raw ? [raw] : [];
          return { questionId: q.id, selectedOptionIds: ids };
        }),
        durationSeconds: timeSpent,
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

      if (showResult && data.data?.evaluation) {
        setQuizResult(data.data.evaluation);
      }

      toast.success("提交成功，系统正在后台批改");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Navigation
  function goToQuestion(index: number) {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  }

  // ---------- Render: submitted result ----------
  if (submitted && showResult) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="size-4 text-green-600" />
              {isPreview ? "预览完成" : "测验完成"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {quizResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">总分</span>
                  <Badge variant="secondary" className="text-base">
                    {quizResult.totalScore} / {quizResult.maxScore} 分
                  </Badge>
                </div>
                {quizResult.feedback && (
                  <p className="text-muted-foreground text-sm">
                    {quizResult.feedback}
                  </p>
                )}
                <Separator />
                <div className="space-y-3">
                  {questions.map((q, idx) => {
                    const result = quizResult.breakdown?.find(
                      (r) => r.questionId === q.id
                    );
                    return (
                      <div key={q.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-sm font-medium">
                              第 {idx + 1} 题
                            </span>
                            <p className="text-muted-foreground mt-1 text-sm">
                              {q.stem}
                            </p>
                          </div>
                          <Badge
                            variant={result?.correct ? "default" : "destructive"}
                          >
                            {result
                              ? `${result.score}/${result.maxScore}`
                              : "-"}
                          </Badge>
                        </div>
                        {result?.comment && (
                          <p className="text-muted-foreground mt-2 text-xs">
                            {result.comment}
                          </p>
                        )}
                        {q.explanation && (
                          <div className="mt-2 rounded bg-blue-50 p-2 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            <span className="font-medium">解析：</span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                {isPreview
                  ? "教师预览已完成，未生成学生提交记录。"
                  : "已成功提交"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <SubmissionProcessingCard
        title={taskName}
        job={gradingJob}
        pendingLabel={isPreview ? "预览已完成" : undefined}
        pendingDescription={
          isPreview ? "这是教师预览，不会生成学生提交或批改记录。" : undefined
        }
        onBack={() => router.back()}
        onViewGrades={() => router.push("/grades")}
      />
    );
  }

  // ---------- Render: quiz in progress ----------

  // 防御：questions 空 / currentIndex 越界时 currentQuestion 为 undefined
  // （pre-existing bug：原直接 access .id 会 crash 被 ErrorBoundary 接住）
  if (!currentQuestion) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-ink-4">
        暂无题目可作答，请联系教师确认题库已配置。
      </div>
    );
  }

  const isConfirmed = confirmedQuestions.has(currentQuestion.id);
  const currentAnswer = answers[currentQuestion.id];

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Top bar */}
      <RunnerTopbar
        onBack={() => router.back()}
        title={taskName}
        subtitle={
          taskSubtitle ?? (mode === "practice" ? "测验 · 练习模式" : "测验 · 考试模式")
        }
        metaSlots={
          <>
            <RunnerMetaProgress
              current={answeredCount}
              total={questions.length}
              totalPoints={totalPoints}
            />
            {timeRemaining !== null && (
              <RunnerMetaTimer seconds={timeRemaining} />
            )}
          </>
        }
        actions={[
          {
            label: isPreview ? "完成预览" : "提交答卷",
            onClick: handleSubmit,
            icon: Check,
            variant: "primary",
            loading: isSubmitting,
            loadingLabel: isPreview ? "处理中..." : "提交中...",
            disabled: isSubmitting,
          },
        ]}
      />

      {/* Main area */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Question panel */}
        <div className="flex flex-1 flex-col">
          <Card className="flex flex-1 flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="size-4" />
                  第 {currentIndex + 1} 题
                  <Badge variant="outline" className="ml-1">
                    {currentQuestion.points} 分
                  </Badge>
                </CardTitle>
                <Badge variant="secondary">
                  {currentQuestion.type === "single_choice" && "单选题"}
                  {currentQuestion.type === "multiple_choice" && "多选题"}
                  {currentQuestion.type === "true_false" && "判断题"}
                  {currentQuestion.type === "short_answer" && "简答题"}
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-6 p-6">
                  {/* Stem */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {currentQuestion.stem}
                  </p>

                  {/* Single choice */}
                  {currentQuestion.type === "single_choice" &&
                    currentQuestion.options && (
                      <RadioGroup
                        value={(currentAnswer as string) || ""}
                        onValueChange={(val) =>
                          setAnswer(currentQuestion.id, val)
                        }
                        disabled={isConfirmed}
                      >
                        {currentQuestion.options.map((opt, idx) => {
                          const optionDomId = `${currentQuestion.id}-${opt.label}-${idx}`;
                          return (
                            <div
                              key={`${opt.label}-${idx}`}
                              className="flex items-center gap-3 rounded-md border p-3"
                            >
                              <RadioGroupItem
                                value={opt.label}
                                id={optionDomId}
                              />
                              <Label
                                htmlFor={optionDomId}
                                className="flex-1 cursor-pointer text-sm"
                              >
                                <span className="font-medium">
                                  {opt.label}.
                                </span>{" "}
                                {opt.content}
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    )}

                  {/* Multiple choice */}
                  {currentQuestion.type === "multiple_choice" &&
                    currentQuestion.options && (
                      <div className="space-y-2">
                        {currentQuestion.options.map((opt, idx) => {
                          const selected = (
                            (currentAnswer as string[]) || []
                          ).includes(opt.label);
                          const optionDomId = `${currentQuestion.id}-${opt.label}-${idx}`;
                          return (
                            <div
                              key={`${opt.label}-${idx}`}
                              className="flex items-center gap-3 rounded-md border p-3"
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() =>
                                  toggleMultipleChoice(
                                    currentQuestion.id,
                                    opt.label
                                  )
                                }
                                id={optionDomId}
                                disabled={isConfirmed}
                              />
                              <Label
                                htmlFor={optionDomId}
                                className="flex-1 cursor-pointer text-sm"
                              >
                                <span className="font-medium">
                                  {opt.label}.
                                </span>{" "}
                                {opt.content}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  {/* True/False */}
                  {currentQuestion.type === "true_false" && (
                    <RadioGroup
                      value={(currentAnswer as string) || ""}
                      onValueChange={(val) =>
                        setAnswer(currentQuestion.id, val)
                      }
                      disabled={isConfirmed}
                    >
                      <div className="flex items-center gap-3 rounded-md border p-3">
                        <RadioGroupItem
                          value="true"
                          id={`${currentQuestion.id}-true`}
                        />
                        <Label
                          htmlFor={`${currentQuestion.id}-true`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          正确
                        </Label>
                      </div>
                      <div className="flex items-center gap-3 rounded-md border p-3">
                        <RadioGroupItem
                          value="false"
                          id={`${currentQuestion.id}-false`}
                        />
                        <Label
                          htmlFor={`${currentQuestion.id}-false`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          错误
                        </Label>
                      </div>
                    </RadioGroup>
                  )}

                  {/* Short answer */}
                  {currentQuestion.type === "short_answer" && (
                    <Textarea
                      value={(currentAnswer as string) || ""}
                      onChange={(e) =>
                        setAnswer(currentQuestion.id, e.target.value)
                      }
                      placeholder="请输入你的答案..."
                      rows={5}
                      disabled={isConfirmed}
                      className="resize-none"
                    />
                  )}

                  {/* Practice mode: confirm & explanation */}
                  {mode === "practice" && (
                    <div className="space-y-3">
                      {!isConfirmed && (
                        <Button
                          variant="outline"
                          onClick={handleConfirmQuestion}
                          disabled={
                            !currentAnswer ||
                            (Array.isArray(currentAnswer) &&
                              currentAnswer.length === 0) ||
                            (typeof currentAnswer === "string" &&
                              !currentAnswer.trim())
                          }
                        >
                          确认答案
                        </Button>
                      )}
                      {isConfirmed && currentQuestion.explanation && (
                        <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          <div className="mb-1 flex items-center gap-1.5 font-medium">
                            <AlertCircle className="size-4" />
                            解析
                          </div>
                          <p className="whitespace-pre-wrap">
                            {currentQuestion.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Question map sidebar */}
        <div className="w-48 shrink-0">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">题目导航</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = (() => {
                    const a = answers[q.id];
                    if (!a) return false;
                    if (Array.isArray(a)) return a.length > 0;
                    return typeof a === "string" && a.trim().length > 0;
                  })();
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={q.id}
                      onClick={() => goToQuestion(idx)}
                      className={`flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : isAnswered
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom navigation (prev/next only — submit moved to topbar) */}
      <Card className="py-3">
        <CardContent className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="size-4" />
            上一题
          </Button>

          <Button
            variant="outline"
            onClick={() => goToQuestion(currentIndex + 1)}
            disabled={currentIndex === questions.length - 1}
          >
            下一题
            <ChevronRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
