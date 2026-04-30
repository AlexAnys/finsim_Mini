"use client";

import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WizardCard } from "./wizard-card";

type QuizQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

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

const QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

interface QuizStepProps {
  timeLimitMinutes: string;
  quizMode: "fixed" | "adaptive";
  shuffleQuestions: boolean;
  showResult: boolean;
  questions: QuizQuestion[];
  errors: Record<string, string>;
  onTimeLimit: (v: string) => void;
  onQuizMode: (v: "fixed" | "adaptive") => void;
  onShuffle: (v: boolean) => void;
  onShowResult: (v: boolean) => void;
  onQuestionAdd: () => void;
  onQuestionRemove: (idx: number) => void;
  onQuestionChange: (idx: number, field: keyof QuizQuestion, value: unknown) => void;
  onQuestionOption: (qIdx: number, oIdx: number, text: string) => void;
  onOpenAIDialog: () => void;
  onGenerateFromContext?: () => void;
  contextGenerating?: boolean;
}

export function WizardStepQuiz({
  timeLimitMinutes,
  quizMode,
  shuffleQuestions,
  showResult,
  questions,
  errors,
  onTimeLimit,
  onQuizMode,
  onShuffle,
  onShowResult,
  onQuestionAdd,
  onQuestionRemove,
  onQuestionChange,
  onQuestionOption,
  onOpenAIDialog,
  onGenerateFromContext,
  contextGenerating = false,
}: QuizStepProps) {
  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);

  return (
    <>
      <WizardCard
        title="测验设置"
        subtitle="时间限制 · 模式 · 题序随机 · 提交后显示答案。"
      >
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-ink-2">
              时间限制（分钟）
            </Label>
            <Input
              type="number"
              min={1}
              placeholder="留空 = 不限时"
              value={timeLimitMinutes}
              onChange={(e) => onTimeLimit(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-ink-2">测验模式</Label>
            <Select value={quizMode} onValueChange={(v) => onQuizMode(v as "fixed" | "adaptive")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">固定题目</SelectItem>
                <SelectItem value="adaptive">自适应（按答对率出题）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-ink-2">选项</Label>
            <div className="flex flex-col gap-1 pt-1">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-3">
                <Checkbox
                  checked={shuffleQuestions}
                  onCheckedChange={(v) => onShuffle(!!v)}
                />
                随机题目顺序
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-3">
                <Checkbox
                  checked={showResult}
                  onCheckedChange={(v) => onShowResult(!!v)}
                />
                提交后显示正确答案
              </label>
            </div>
          </div>
        </div>
      </WizardCard>

      <WizardCard
        title="题库"
        subtitle={
          <>
            共 <b className="text-ink tabular-nums">{questions.length}</b> 题 · 合计{" "}
            <b className="text-ink tabular-nums">{totalPoints}</b> 分 · 可用 AI 批量出题。
          </>
        }
        extra={
          <div className="flex items-center gap-1.5">
            {onGenerateFromContext && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateFromContext}
                disabled={contextGenerating}
              >
                {contextGenerating ? (
                  <Loader2 className="size-3 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="size-3 mr-1" />
                )}
                素材生成
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onOpenAIDialog}>
              <Sparkles className="size-3 mr-1" />
              AI 出题
            </Button>
            <Button variant="outline" size="sm" onClick={onQuestionAdd}>
              <Plus className="size-3 mr-1" />
              添加题目
            </Button>
          </div>
        }
      >
        {errors.questions && (
          <p className="text-xs text-danger">{errors.questions}</p>
        )}
        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-paper-alt px-4 py-6 text-center text-xs text-ink-4">
            暂无题目。点击右上角 <b>AI 出题</b> 让系统批量生成，或手动添加。
          </div>
        ) : (
          questions.map((q, qi) => (
            <div
              key={qi}
              className="space-y-2.5 rounded-lg border border-line bg-surface p-3"
            >
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded bg-ink text-[11px] font-bold tabular-nums text-white">
                  {qi + 1}
                </span>
                <Badge
                  variant="outline"
                  className="bg-quiz-soft text-quiz border-quiz/20"
                >
                  {QUESTION_TYPE_LABELS[q.type]}
                </Badge>
                <div className="flex-1" />
                <span className="text-[11px] text-ink-5">分值</span>
                <Input
                  type="number"
                  min={1}
                  max={3}
                  value={q.points}
                  onChange={(e) =>
                    onQuestionChange(qi, "points", parseInt(e.target.value) || 1)
                  }
                  className="w-16 text-right tabular-nums"
                />
                {questions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onQuestionRemove(qi)}
                    className="size-7 text-danger"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                <div className="space-y-1">
                  <Label className="text-xs">题干 <span className="text-danger">*</span></Label>
                  <Textarea
                    placeholder="请输入题目内容..."
                    value={q.stem}
                    onChange={(e) => onQuestionChange(qi, "stem", e.target.value)}
                    rows={2}
                    className="font-medium"
                  />
                  {errors[`q_${qi}_stem`] && (
                    <p className="text-xs text-danger">
                      {errors[`q_${qi}_stem`]}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">题目类型</Label>
                  <Select
                    value={q.type}
                    onValueChange={(v) =>
                      onQuestionChange(qi, "type", v as QuizQuestionType)
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
              </div>

              {(q.type === "single_choice" ||
                q.type === "multiple_choice") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">选项（点左侧圆点标记正确答案）</Label>
                  {q.options.map((opt, oi) => {
                    const correct = q.correctOptionIds.includes(opt.id);
                    return (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            let next: string[];
                            if (q.type === "single_choice") {
                              next = correct ? [] : [opt.id];
                            } else {
                              next = correct
                                ? q.correctOptionIds.filter((id) => id !== opt.id)
                                : [...q.correctOptionIds, opt.id];
                            }
                            onQuestionChange(qi, "correctOptionIds", next);
                          }}
                          className={
                            correct
                              ? "grid size-5 shrink-0 place-items-center rounded-full bg-success text-[10px] font-bold text-white"
                              : "grid size-5 shrink-0 place-items-center rounded-full border-2 border-line bg-surface text-[10px] font-bold text-ink-5"
                          }
                          aria-label={`标记 ${opt.id} 为正确答案`}
                        >
                          {opt.id}
                        </button>
                        <Input
                          placeholder={`选项 ${opt.id}`}
                          value={opt.text}
                          onChange={(e) => onQuestionOption(qi, oi, e.target.value)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">正确答案</Label>
                  <div className="flex gap-2">
                    {[
                      { id: "A", text: "正确" },
                      { id: "B", text: "错误" },
                    ].map((opt) => {
                      const correct = q.correctOptionIds.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onQuestionChange(qi, "correctOptionIds", [opt.id])
                          }
                          className={
                            correct
                              ? "flex-1 rounded-md border-2 border-success bg-success-soft px-3 py-2 text-sm font-semibold text-success"
                              : "flex-1 rounded-md border-2 border-line bg-surface px-3 py-2 text-sm font-medium text-ink-3"
                          }
                        >
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {q.type === "short_answer" && (
                <div className="space-y-1">
                  <Label className="text-xs">参考答案</Label>
                  <Input
                    placeholder="参考答案..."
                    value={q.correctAnswer}
                    onChange={(e) =>
                      onQuestionChange(qi, "correctAnswer", e.target.value)
                    }
                  />
                </div>
              )}

              <div className="rounded-md border border-dashed border-line bg-paper-alt px-2.5 py-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-5">
                  答案解析
                </div>
                <Textarea
                  placeholder="题目解析（选填）..."
                  value={q.explanation}
                  onChange={(e) =>
                    onQuestionChange(qi, "explanation", e.target.value)
                  }
                  rows={2}
                  className="mt-1 border-0 bg-transparent px-0 py-0 text-[11.5px] leading-[1.55] text-ink-3 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
          ))
        )}
      </WizardCard>
    </>
  );
}
