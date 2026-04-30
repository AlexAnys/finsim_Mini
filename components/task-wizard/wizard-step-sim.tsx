"use client";

import { Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { WizardCard } from "./wizard-card";

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

interface SimStepProps {
  scenario: string;
  openingLine: string;
  requirements: string[];
  scoringCriteria: ScoringCriterion[];
  allocationSections: AllocationSection[];
  simPersona: string;
  simDialogueStyle: string;
  simConstraints: string;
  totalPoints: number;
  errors: Record<string, string>;
  onScenario: (v: string) => void;
  onOpeningLine: (v: string) => void;
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
  onAllocSectionAdd: () => void;
  onAllocSectionRemove: (idx: number) => void;
  onAllocSectionLabel: (idx: number, label: string) => void;
  onAllocItemAdd: (sectionIdx: number) => void;
  onAllocItemRemove: (sectionIdx: number, itemIdx: number) => void;
  onAllocItemChange: (
    sectionIdx: number,
    itemIdx: number,
    field: keyof AllocationItem,
    value: string | number
  ) => void;
  onSimPersona: (v: string) => void;
  onSimDialogueStyle: (v: string) => void;
  onSimConstraints: (v: string) => void;
  onGenerateFromContext?: () => void;
  contextGenerating?: boolean;
}

export function WizardStepSim(props: SimStepProps) {
  const {
    scenario,
    openingLine,
    requirements,
    scoringCriteria,
    allocationSections,
    simPersona,
    simDialogueStyle,
    simConstraints,
    totalPoints,
    errors,
    onScenario,
    onOpeningLine,
    onRequirementAdd,
    onRequirementRemove,
    onRequirementChange,
    onCriterionAdd,
    onCriterionRemove,
    onCriterionChange,
    onAllocSectionAdd,
    onAllocSectionRemove,
    onAllocSectionLabel,
    onAllocItemAdd,
    onAllocItemRemove,
    onAllocItemChange,
    onSimPersona,
    onSimDialogueStyle,
    onSimConstraints,
    onGenerateFromContext,
    contextGenerating = false,
  } = props;

  const rubricTotal = scoringCriteria.reduce((s, c) => s + (c.maxPoints || 0), 0);
  const rubricMismatch = rubricTotal > 0 && rubricTotal !== totalPoints;

  return (
    <>
      <WizardCard
        title="模拟对话配置"
        subtitle="场景脚本 · 评分标准 · 配套资产配置表 · AI 客户人设。"
        extra={
          onGenerateFromContext ? (
            <Button
              type="button"
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
              AI 生成配置
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sim-soft px-2.5 py-1 text-[11px] font-semibold text-sim">
              <Sparkles className="size-3" /> AI 客户驱动
            </span>
          )
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scenario" className="text-xs font-semibold text-ink-2">
            角色扮演场景 <span className="text-danger">*</span>
          </Label>
          <Textarea
            id="scenario"
            placeholder="学生扮演理财顾问，AI 扮演什么角色 / 带着什么背景和诉求…"
            value={scenario}
            onChange={(e) => onScenario(e.target.value)}
            rows={4}
          />
          {errors.scenario && (
            <p className="text-xs text-danger">{errors.scenario}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="openingLine" className="text-xs font-semibold text-ink-2">
            AI 开场白 <span className="text-danger">*</span>
          </Label>
          <Input
            id="openingLine"
            placeholder="学生进入对话后看到的第一句话"
            value={openingLine}
            onChange={(e) => onOpeningLine(e.target.value)}
          />
          {errors.openingLine && (
            <p className="text-xs text-danger">{errors.openingLine}</p>
          )}
        </div>

        <Separator />
        <p className="text-xs text-ink-4">
          以下提示词控制 AI 客户的行为方式，已预填默认值，可根据需要自定义。
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="simPersona" className="text-xs font-semibold text-ink-2">
            核心人设
          </Label>
          <Textarea
            id="simPersona"
            value={simPersona}
            onChange={(e) => onSimPersona(e.target.value)}
            rows={4}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="simDialogueStyle"
            className="text-xs font-semibold text-ink-2"
          >
            对话风格
          </Label>
          <Textarea
            id="simDialogueStyle"
            value={simDialogueStyle}
            onChange={(e) => onSimDialogueStyle(e.target.value)}
            rows={4}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="simConstraints"
            className="text-xs font-semibold text-ink-2"
          >
            禁止行为
          </Label>
          <Textarea
            id="simConstraints"
            value={simConstraints}
            onChange={(e) => onSimConstraints(e.target.value)}
            rows={3}
          />
        </div>
      </WizardCard>

      <WizardCard
        title="对话要求"
        subtitle="学生需要在对话里达成的目标（同时用作评分对照）。"
        extra={
          <Button variant="outline" size="sm" onClick={onRequirementAdd}>
            <Plus className="size-3 mr-1" />
            添加要求
          </Button>
        }
      >
        {requirements.map((req, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sim-soft text-[10px] font-bold tabular-nums text-sim">
              {i + 1}
            </span>
            <Input
              placeholder="例如：需要了解客户的风险偏好"
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
        title="评分标准"
        subtitle={
          <>
            已配置 <b className="text-ink">{scoringCriteria.length}</b> 项 · 合计{" "}
            <b className="tabular-nums text-ink">{rubricTotal}</b> 分
            {rubricMismatch && (
              <span className="ml-1.5 text-warn">
                · 与任务总分（{totalPoints}）不一致
              </span>
            )}
          </>
        }
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
                <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-sim-soft text-[11px] font-bold tabular-nums text-sim">
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
                  placeholder="例如：需求分析"
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
                onChange={(e) =>
                  onCriterionChange(i, "description", e.target.value)
                }
                rows={2}
              />
            </div>
          </div>
        ))}
      </WizardCard>

      <WizardCard
        title="资产配置"
        subtitle="学生作答时可以编辑的资产组合；留空则不启用。"
        extra={
          <Button variant="outline" size="sm" onClick={onAllocSectionAdd}>
            <Plus className="size-3 mr-1" />
            添加分区
          </Button>
        }
      >
        {allocationSections.map((section, si) => (
          <div
            key={si}
            className="space-y-3 rounded-lg border border-line bg-surface p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-2">分区 {si + 1}</span>
              {allocationSections.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onAllocSectionRemove(si)}
                  className="size-7 text-danger"
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
            <div>
              <Label className="text-xs">分区名称</Label>
              <Input
                placeholder="例如：大类资产（%）"
                value={section.label}
                onChange={(e) => onAllocSectionLabel(si, e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">配置项</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAllocItemAdd(si)}
                  className="h-6 text-xs"
                >
                  <Plus className="size-3 mr-1" />
                  添加项
                </Button>
              </div>
              {section.items.map((item, ii) => (
                <div key={ii} className="flex items-center gap-2">
                  <Input
                    placeholder="名称"
                    value={item.label}
                    onChange={(e) =>
                      onAllocItemChange(si, ii, "label", e.target.value)
                    }
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="默认值"
                    value={item.defaultValue}
                    onChange={(e) =>
                      onAllocItemChange(
                        si,
                        ii,
                        "defaultValue",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className={cn("w-24 text-right tabular-nums")}
                  />
                  {section.items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAllocItemRemove(si, ii)}
                      className="size-7 shrink-0 text-danger"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </WizardCard>
    </>
  );
}
