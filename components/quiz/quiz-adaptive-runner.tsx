"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RunnerTopbar } from "@/components/runner/runner-topbar";
import {
  SubmissionProcessingCard,
  type AsyncJobSnapshot,
} from "@/components/runner/submission-processing-card";
import { QuizMasteryReport, type MasteryReport } from "./quiz-mastery-report";

// ---------- Types ----------

interface QuizOption {
  label: string;
  content: string;
}

interface AdaptiveQuestion {
  id: string;
  type: "single_choice" | "multiple_choice" | "true_false" | "short_answer";
  prompt: string;
  options: QuizOption[] | null;
  points: number;
}

interface AdaptiveProgress {
  answered: number;
  maxQuestions: number;
  coveredKnowledgePoints: number;
}

interface AdaptiveRunnerProps {
  taskId: string;
  taskInstanceId: string;
  taskName: string;
  userId: string;
  taskSubtitle?: string;
  isPreview?: boolean;
}

type AnswerValue = string | string[];

interface AnsweredQuestion {
  questionId: string;
  type: AdaptiveQuestion["type"];
  prompt: string;
  options: QuizOption[] | null;
  answer: AnswerValue;
  correct: boolean;
  correctOptionIds: string[];
}

function normalizeOptions(raw: unknown): QuizOption[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map(
    (
      o: { id?: string; label?: string; text?: string; content?: string },
      idx: number,
    ) => ({
      label: (o.label ?? o.id ?? "").trim() || String.fromCharCode(65 + idx),
      content: (o.content ?? o.text ?? "").toString(),
    }),
  );
}

export function QuizAdaptiveRunner({
  taskId,
  taskInstanceId,
  taskName,
  userId,
  taskSubtitle,
  isPreview,
}: AdaptiveRunnerProps) {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestion | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerValue>("");
  const [history, setHistory] = useState<Array<{ questionId: string; correct: boolean }>>([]);
  const [answeredHistory, setAnsweredHistory] = useState<AnsweredQuestion[]>([]);
  const [progress, setProgress] = useState<AdaptiveProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [masteryReport, setMasteryReport] = useState<MasteryReport | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [gradingJob, setGradingJob] = useState<AsyncJobSnapshot | null>(null);
  const startTimeRef = useRef(Date.now());

  /** 拉下一题（或终态） */
  const fetchNext = useCallback(
    async (currentHistory: typeof history) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/lms/tasks/${taskId}/adaptive-quiz/next`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Codex-P1-1: taskInstanceId 必填，服务端校验学生班级 access
            body: JSON.stringify({ history: currentHistory, taskInstanceId }),
          },
        );
        const data = await res.json();
        if (!data.success) {
          setErrorMsg(data.error?.message ?? "获取下一题失败");
          return;
        }
        if (data.data.fallback === "fixed") {
          setFallbackReason(data.data.reason);
          return;
        }
        if (data.data.done) {
          setMasteryReport(data.data.masteryReport as MasteryReport);
          return;
        }
        setCurrentQuestion({
          id: data.data.nextQuestion.id,
          type: data.data.nextQuestion.type,
          prompt: data.data.nextQuestion.prompt,
          options: normalizeOptions(data.data.nextQuestion.options),
          points: data.data.nextQuestion.points,
        });
        setProgress(data.data.progress);
        setCurrentAnswer(
          data.data.nextQuestion.type === "multiple_choice" ? [] : "",
        );
      } catch {
        setErrorMsg("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    void fetchNext([]);
  }, [fetchNext]);

  /**
   * 答完一题：先调 /next 服务端判定 correct（其实服务端没判，本端先 fake 一个 placeholder：用题型推断）
   * 实际：本端没有 correctOptionIds，因此先用 placeholder（让 server 算）
   * 折中方案：每题答完先 POST submit-answer 拿 correct，再调 /next
   *
   * v1 简化：本端通过额外 API 拉 correct（暂用 client-side guess 不靠谱）
   * 改方案：扩 /next API：携带最后一道题的 selectedOptionIds + textAnswer 让服务端判定 correct
   *
   * 实际 v1 实现：next API 在 v1 仍只读 history（已 evaluated）→ 我们调一个 lightweight check API
   * 简化：直接通过 /api/quiz-questions/check-answer endpoint（新建一个最小 API）
   *
   * （implementation simplification: this runner records what student selected and
   * sends to /api/submissions at completion; for adaptive routing we need
   * per-answer correctness — use an inline judge endpoint.）
   */
  async function submitAnswer() {
    if (!currentQuestion) return;
    const answerEmpty =
      currentQuestion.type === "multiple_choice"
        ? !Array.isArray(currentAnswer) || currentAnswer.length === 0
        : !currentAnswer ||
          (typeof currentAnswer === "string" && currentAnswer.trim().length === 0);
    if (answerEmpty) {
      toast.error("请先作答");
      return;
    }

    // 调 /check-answer 拿 correct
    try {
      // Codex-P1-3 r2: 服务端要求 taskInstanceId 校验班级 access
      const checkBody =
        currentQuestion.type === "short_answer"
          ? { taskInstanceId, textAnswer: currentAnswer }
          : {
              taskInstanceId,
              selectedOptionIds: Array.isArray(currentAnswer)
                ? currentAnswer
                : [currentAnswer as string],
            };
      const checkRes = await fetch(
        `/api/lms/quiz-questions/${currentQuestion.id}/check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(checkBody),
        },
      );
      const checkData = await checkRes.json();
      if (!checkData.success) {
        toast.error(checkData.error?.message ?? "判定失败");
        return;
      }
      const correct = Boolean(checkData.data.correct);
      const correctOptionIds: string[] = checkData.data.correctOptionIds ?? [];

      const newAnsweredEntry: AnsweredQuestion = {
        questionId: currentQuestion.id,
        type: currentQuestion.type,
        prompt: currentQuestion.prompt,
        options: currentQuestion.options,
        answer: currentAnswer,
        correct,
        correctOptionIds,
      };
      const newHistory = [
        ...history,
        { questionId: currentQuestion.id, correct },
      ];
      const newAnswered = [...answeredHistory, newAnsweredEntry];
      setHistory(newHistory);
      setAnsweredHistory(newAnswered);
      setCurrentQuestion(null); // 阻止 double-click
      await fetchNext(newHistory);
    } catch {
      toast.error("网络错误，请稍后重试");
    }
  }

  /** 完成测验时提交全部答案到 /api/submissions（兼容原 quiz 评分流程） */
  async function finalSubmit() {
    if (isPreview) {
      setSubmitted(true);
      toast.success("预览完成：未生成学生提交记录");
      return;
    }
    setIsSubmitting(true);
    const timeSpent = Math.floor((Date.now() - startTimeRef.current) / 1000);
    try {
      const payload = {
        taskType: "quiz" as const,
        taskId,
        taskInstanceId,
        answers: answeredHistory.map((a) => ({
          questionId: a.questionId,
          ...(a.type === "short_answer"
            ? { textAnswer: typeof a.answer === "string" ? a.answer : "" }
            : {
                selectedOptionIds: Array.isArray(a.answer)
                  ? a.answer
                  : a.answer
                    ? [a.answer as string]
                    : [],
              }),
        })),
        durationSeconds: timeSpent,
        // Unit 8: 把 masteryReport 透传给后端（grading.service 写入 evaluation.masteryReport）
        masteryReport,
      };
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? "提交失败");
      }
      const data = await res.json();
      setSubmitted(true);
      setGradingJob(data.data?.gradingJob ?? null);
      toast.success("提交成功，系统正在后台批改");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "提交失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  // -------- Render: fallback (旧任务无 tag) --------
  if (fallbackReason) {
    return (
      <div className="flex h-full flex-col gap-4">
        <RunnerTopbar
          title={taskName}
          subtitle={taskSubtitle ?? "测验"}
          onBack={() => router.push("/tasks")}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-warn">
              <AlertCircle className="size-4" /> 知识点诊断暂未启用
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-ink-3">{fallbackReason}</p>
            <Button onClick={() => router.push(`/tasks/${taskInstanceId}`)}>
              返回任务详情
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- Render: 完成（成绩+雷达） --------
  if (masteryReport) {
    if (submitted) {
      return (
        <div className="flex h-full flex-col gap-4">
          <RunnerTopbar
            title={taskName}
            subtitle={taskSubtitle ?? "测验"}
            onBack={() => router.push("/tasks")}
          />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="size-4 text-success" />
                测验已提交
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SubmissionProcessingCard
                title="测验提交"
                job={gradingJob}
                onBack={() => router.push("/tasks")}
                onViewGrades={() => router.push("/grades")}
              />
            </CardContent>
          </Card>
          <QuizMasteryReport report={masteryReport} />
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col gap-4">
        <RunnerTopbar
          title={taskName}
          subtitle={taskSubtitle ?? "测验"}
          onBack={() => router.push("/tasks")}
        />
        <QuizMasteryReport report={masteryReport} />
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <p className="text-sm text-ink-3">
              查看上方诊断报告后，点击&ldquo;提交答卷&rdquo;完成本次测验。
            </p>
            <Button onClick={finalSubmit} disabled={isSubmitting}>
              {isSubmitting ? "提交中..." : "提交答卷"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- Render: 答题中 --------
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-ink-4">
        正在挑选下一题...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-danger">
        {errorMsg}
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <RunnerTopbar
        title={taskName}
        subtitle={taskSubtitle ?? "测验 · 自适应"}
        onBack={() => router.push("/tasks")}
      />
      {progress && (
        <Card className="py-2">
          <CardContent className="flex items-center justify-between py-2 text-[12px] text-ink-4">
            <span>
              第 {progress.answered + 1} 题（最多 {progress.maxQuestions} 题）
            </span>
            <span>已诊断 {progress.coveredKnowledgePoints} 个知识点</span>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px] leading-snug">
              {currentQuestion.prompt}
            </CardTitle>
            <Badge variant="outline" className="shrink-0">
              {currentQuestion.points} 分
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-ink-5">
            <BookOpen className="size-3" />
            {currentQuestion.type === "single_choice" && "单选题"}
            {currentQuestion.type === "multiple_choice" && "多选题"}
            {currentQuestion.type === "true_false" && "判断题"}
            {currentQuestion.type === "short_answer" && "简答题"}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(currentQuestion.type === "single_choice" ||
            currentQuestion.type === "true_false") && currentQuestion.options && (
            <RadioGroup
              value={typeof currentAnswer === "string" ? currentAnswer : ""}
              onValueChange={(v) => setCurrentAnswer(v)}
            >
              {currentQuestion.options.map((o) => (
                <div key={o.label} className="flex items-center gap-2">
                  <RadioGroupItem value={o.label} id={`opt-${o.label}`} />
                  <Label htmlFor={`opt-${o.label}`} className="cursor-pointer">
                    {o.label}. {o.content}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
          {currentQuestion.type === "multiple_choice" && currentQuestion.options && (
            <div className="space-y-2">
              {currentQuestion.options.map((o) => {
                const arr = Array.isArray(currentAnswer) ? currentAnswer : [];
                const checked = arr.includes(o.label);
                return (
                  <div key={o.label} className="flex items-center gap-2">
                    <Checkbox
                      id={`mc-${o.label}`}
                      checked={checked}
                      onCheckedChange={(c) => {
                        if (c) setCurrentAnswer([...arr, o.label]);
                        else setCurrentAnswer(arr.filter((a) => a !== o.label));
                      }}
                    />
                    <Label htmlFor={`mc-${o.label}`} className="cursor-pointer">
                      {o.label}. {o.content}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
          {currentQuestion.type === "short_answer" && (
            <Textarea
              rows={4}
              value={typeof currentAnswer === "string" ? currentAnswer : ""}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="请输入你的答案..."
            />
          )}
          <div className="flex justify-end">
            <Button onClick={submitAnswer}>提交本题</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
