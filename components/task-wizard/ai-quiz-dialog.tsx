"use client";

import { useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type QuizQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "short_answer";

interface QuizOption {
  id: string;
  text: string;
}

export interface GeneratedQuestion {
  type: QuizQuestionType;
  stem: string;
  options: QuizOption[];
  correctOptionIds: string[];
  correctAnswer: string;
  points: number;
  explanation: string;
}

interface AIQuizDialogProps {
  open: boolean;
  onClose: () => void;
  taskName: string;
  description: string;
  onAccept: (questions: GeneratedQuestion[]) => void;
}

const QUESTION_TYPE_LABELS: Record<QuizQuestionType, string> = {
  single_choice: "单选题",
  multiple_choice: "多选题",
  true_false: "判断题",
  short_answer: "简答题",
};

export function AIQuizDialog({
  open,
  onClose,
  taskName,
  description,
  onAccept,
}: AIQuizDialogProps) {
  const [hint, setHint] = useState("");
  const [generating, setGenerating] = useState(false);
  const [drafts, setDrafts] = useState<GeneratedQuestion[]>([]);

  function resetAndClose() {
    setHint("");
    setDrafts([]);
    onClose();
  }

  async function handleGenerate() {
    if (!taskName.trim()) {
      toast.error("请先在基本信息中输入任务名称");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/task-draft/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: taskName,
          chapterName: description || taskName,
          prompt: hint.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "AI 出题失败");
        return;
      }
      const generated = json.data.questions;
      const mapped: GeneratedQuestion[] = generated.map(
        (q: Record<string, unknown>) => ({
          type: q.type as QuizQuestionType,
          stem: q.prompt as string,
          options:
            (q.options as QuizOption[]) ||
            [
              { id: "A", text: "" },
              { id: "B", text: "" },
              { id: "C", text: "" },
              { id: "D", text: "" },
            ],
          correctOptionIds: (q.correctOptionIds as string[]) || [],
          correctAnswer: (q.correctAnswer as string) || "",
          points: (q.points as number) || 1,
          explanation: (q.explanation as string) || "",
        })
      );
      setDrafts(mapped);
      toast.success(`AI 已生成 ${mapped.length} 道题目，请在下方确认`);
    } catch {
      toast.error("AI 出题失败，请重试");
    } finally {
      setGenerating(false);
    }
  }

  function removeDraft(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDraftStem(idx: number, stem: string) {
    setDrafts((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, stem } : q))
    );
  }

  function updateDraftExplanation(idx: number, explanation: string) {
    setDrafts((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, explanation } : q))
    );
  }

  function handleAccept() {
    if (drafts.length === 0) {
      toast.error("没有要添加的题目");
      return;
    }
    onAccept(drafts);
    resetAndClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetAndClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-quiz" />
            AI 批量出题
          </DialogTitle>
          <DialogDescription>
            根据任务名称 + 描述生成题目草稿。生成后可在下方预览、删除不合适的题，然后一次性加入题库。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border-l-[3px] border-quiz bg-quiz-soft px-3 py-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-3.5 text-quiz" />
              <div className="flex-1 text-xs">
                <div className="font-semibold text-ink-2">关联任务</div>
                <div className="mt-0.5 text-ink-4">
                  <b className="text-ink-3">{taskName || "（未命名任务）"}</b>
                  {description && (
                    <span className="ml-1.5">· {description.slice(0, 60)}{description.length > 60 ? "…" : ""}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-hint" className="text-xs font-semibold text-ink-2">
              补充提示（可选）
            </Label>
            <Textarea
              id="ai-hint"
              placeholder="例如：偏重资产配置概念 / 混合难度 / 必须包含货币基金题"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              rows={2}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                生成中（通常 10-20 秒）...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                {drafts.length > 0 ? "重新生成" : "生成题目"}
              </>
            )}
          </Button>

          {drafts.length > 0 && (
            <div className="space-y-3 border-t border-line pt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-ink-2">
                  生成结果 · {drafts.length} 题
                </div>
                <div className="text-[11px] text-ink-5">
                  可以删除不合适的题；题目进入题库后仍可编辑。
                </div>
              </div>
              {drafts.map((q, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded bg-ink text-[11px] font-bold tabular-nums text-white">
                      {i + 1}
                    </span>
                    <Badge
                      variant="outline"
                      className="bg-quiz-soft text-quiz border-quiz/20"
                    >
                      {QUESTION_TYPE_LABELS[q.type]}
                    </Badge>
                    <span className="text-[11px] text-ink-5 tabular-nums">
                      {q.points} 分
                    </span>
                    <div className="ml-auto">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeDraft(i)}
                        className="size-7 text-danger"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    value={q.stem}
                    onChange={(e) => updateDraftStem(i, e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                  {(q.type === "single_choice" ||
                    q.type === "multiple_choice" ||
                    q.type === "true_false") && (
                    <div className="space-y-1">
                      {q.options.map((o) => {
                        const correct = q.correctOptionIds.includes(o.id);
                        return (
                          <div
                            key={o.id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span
                              className={
                                correct
                                  ? "grid size-5 place-items-center rounded-full bg-success text-[10px] font-bold text-white"
                                  : "grid size-5 place-items-center rounded-full border border-line text-[10px] font-bold text-ink-5"
                              }
                            >
                              {o.id}
                            </span>
                            <span
                              className={
                                correct
                                  ? "flex-1 text-ink-2"
                                  : "flex-1 text-ink-3"
                              }
                            >
                              {o.text}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "short_answer" && q.correctAnswer && (
                    <div className="text-xs">
                      <span className="text-ink-5">参考答案：</span>
                      <span className="text-ink-2">{q.correctAnswer}</span>
                    </div>
                  )}
                  <div className="rounded border border-dashed border-line bg-paper-alt px-2.5 py-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-5">
                      解析
                    </div>
                    <Textarea
                      value={q.explanation}
                      onChange={(e) => updateDraftExplanation(i, e.target.value)}
                      rows={2}
                      className="mt-1 border-0 bg-transparent px-0 py-0 text-[11.5px] leading-[1.55] text-ink-3 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={resetAndClose}>
            取消
          </Button>
          <Button
            onClick={handleAccept}
            disabled={drafts.length === 0 || generating}
          >
            加入题库（{drafts.length} 题）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
