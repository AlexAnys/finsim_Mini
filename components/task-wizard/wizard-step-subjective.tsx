"use client";

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WizardCard } from "./wizard-card";

interface ScoringCriterion {
  name: string;
  maxPoints: number;
  description: string;
}

interface SubjectiveStepProps {
  prompt: string;
  wordLimit: string;
  allowAttachment: boolean;
  maxAttachments: string;
  requirements: string[];
  scoringCriteria: ScoringCriterion[];
  aiGenerating: boolean;
  errors: Record<string, string>;
  onPrompt: (v: string) => void;
  onWordLimit: (v: string) => void;
  onAllowAttachment: (v: boolean) => void;
  onMaxAttachments: (v: string) => void;
  onRequirementAdd: () => void;
  onRequirementRemove: (idx: number) => void;
  onRequirementChange: (idx: number, v: string) => void;
  onCriterionAdd: () => void;
  onCriterionRemove: (idx: number) => void;
  onCriterionChange: (
    idx: number,
    field: keyof ScoringCriterion,
    value: string | number
  ) => void;
  onAIGenerate: () => void;
}

export function WizardStepSubjective({
  prompt,
  wordLimit,
  allowAttachment,
  maxAttachments,
  requirements,
  scoringCriteria,
  aiGenerating,
  errors,
  onPrompt,
  onWordLimit,
  onAllowAttachment,
  onMaxAttachments,
  onRequirementAdd,
  onRequirementRemove,
  onRequirementChange,
  onCriterionAdd,
  onCriterionRemove,
  onCriterionChange,
  onAIGenerate,
}: SubjectiveStepProps) {
  return (
    <>
      <WizardCard
        title="主观题设置"
        subtitle="开放式问答或报告。学生提交文字 + 可选附件，教师人工评分（可启用 AI 辅助）。"
        extra={
          <Button
            variant="outline"
            size="sm"
            onClick={onAIGenerate}
            disabled={aiGenerating}
          >
            {aiGenerating ? (
              <Loader2 className="size-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="size-3 mr-1" />
            )}
            AI 出题
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompt" className="text-xs font-semibold text-ink-2">
            题目内容 <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="prompt"
            placeholder="请详细描述学生需要回答的问题..."
            value={prompt}
            onChange={(e) => onPrompt(e.target.value)}
            rows={6}
            className="leading-relaxed"
          />
          {errors.prompt && (
            <p className="text-xs text-danger">{errors.prompt}</p>
          )}
          <p className="text-[10.5px] leading-[1.5] text-ink-5">
            支持 Markdown。学生会看到完整题干。
          </p>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-ink-2">字数上限</Label>
            <Input
              type="number"
              min={0}
              placeholder="留空 = 不限"
              value={wordLimit}
              onChange={(e) => onWordLimit(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-ink-2">允许附件</Label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => onAllowAttachment(true)}
                className={
                  allowAttachment
                    ? "flex-1 rounded-md border border-brand bg-brand px-3 py-2 text-xs font-medium text-white"
                    : "flex-1 rounded-md border border-line bg-paper-alt px-3 py-2 text-xs font-medium text-ink-4"
                }
              >
                开启
              </button>
              <button
                type="button"
                onClick={() => onAllowAttachment(false)}
                className={
                  !allowAttachment
                    ? "flex-1 rounded-md border border-brand bg-brand px-3 py-2 text-xs font-medium text-white"
                    : "flex-1 rounded-md border border-line bg-paper-alt px-3 py-2 text-xs font-medium text-ink-4"
                }
              >
                关闭
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-ink-2">最多附件数</Label>
            <Input
              type="number"
              min={1}
              value={maxAttachments}
              onChange={(e) => onMaxAttachments(e.target.value)}
              disabled={!allowAttachment}
              className="disabled:opacity-50"
            />
          </div>
        </div>

        <div className="rounded-lg border-l-[3px] border-subj bg-subj-soft px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-ink-2">AI 辅助</div>
              <p className="mt-0.5 text-[11px] text-ink-4">
                题干生成 · 评分标准 · 作答要求。生成后会覆盖现有内容。
              </p>
            </div>
          </div>
        </div>
      </WizardCard>

      <WizardCard
        title="作答要求（可选）"
        subtitle="学生端会看到；作为 AI 辅助批改的参考。"
        extra={
          <Button variant="outline" size="sm" onClick={onRequirementAdd}>
            <Plus className="size-3 mr-1" />
            添加要求
          </Button>
        }
      >
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-subj-soft text-[10px] font-bold tabular-nums text-subj">
              {i + 1}
            </span>
            <Input
              placeholder="例如：需要引用至少两个经济学理论"
              value={req}
              onChange={(e) => onRequirementChange(i, e.target.value)}
            />
            {requirements.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRequirementRemove(i)}
                className="shrink-0 text-danger"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </WizardCard>

      <WizardCard
        title="评分标准（可选）"
        subtitle="如果有结构化评分项，学生端能看到；也会被 AI 辅助批改参考。"
        extra={
          <Button variant="outline" size="sm" onClick={onCriterionAdd}>
            <Plus className="size-3 mr-1" />
            添加标准
          </Button>
        }
      >
        {scoringCriteria.map((c, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-line bg-surface p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-subj-soft text-[11px] font-bold tabular-nums text-subj">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm font-medium text-ink-2">标准 {i + 1}</span>
              </div>
              {scoringCriteria.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onCriterionRemove(i)}
                  className="size-7 text-danger"
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
                  onChange={(e) => onCriterionChange(i, "name", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">最高分</Label>
                <Input
                  type="number"
                  min={1}
                  value={c.maxPoints}
                  onChange={(e) =>
                    onCriterionChange(
                      i,
                      "maxPoints",
                      parseInt(e.target.value) || 1
                    )
                  }
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">描述</Label>
              <Textarea
                placeholder="该评分标准的详细说明…"
                value={c.description}
                onChange={(e) => onCriterionChange(i, "description", e.target.value)}
                rows={2}
              />
            </div>
          </div>
        ))}
      </WizardCard>
    </>
  );
}
