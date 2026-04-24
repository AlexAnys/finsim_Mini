"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WizardCard } from "./wizard-card";

interface WizardStepBasicProps {
  taskName: string;
  description: string;
  totalPoints: number;
  timeLimitMinutes: string;
  errors: Record<string, string>;
  onTaskName: (v: string) => void;
  onDescription: (v: string) => void;
  onTotalPoints: (v: number) => void;
  onTimeLimitMinutes: (v: string) => void;
}

export function WizardStepBasic({
  taskName,
  description,
  totalPoints,
  timeLimitMinutes,
  errors,
  onTaskName,
  onDescription,
  onTotalPoints,
  onTimeLimitMinutes,
}: WizardStepBasicProps) {
  return (
    <WizardCard title="基本信息" subtitle="任务标题 · 说明 · 时长。">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="taskName" className="text-xs font-semibold text-ink-2">
          任务名称 <span className="ml-0.5 text-danger">*</span>
        </Label>
        <Input
          id="taskName"
          placeholder="例如：家庭财务诊断对话"
          value={taskName}
          onChange={(e) => onTaskName(e.target.value)}
        />
        {errors.taskName && (
          <p className="text-xs text-danger">{errors.taskName}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="text-xs font-semibold text-ink-2">
          任务描述
        </Label>
        <Textarea
          id="description"
          placeholder="简要描述任务目的、预期产出…"
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          rows={3}
        />
        <p className="text-[10.5px] leading-[1.5] text-ink-5">
          学生在列表和任务详情页会看到这段文本。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="totalPoints" className="text-xs font-semibold text-ink-2">
            总分
          </Label>
          <Input
            id="totalPoints"
            type="number"
            min={1}
            value={totalPoints}
            onChange={(e) => onTotalPoints(parseInt(e.target.value) || 0)}
          />
          <p className="text-[10.5px] leading-[1.5] text-ink-5">
            用于在卡片和预览中展示（提交时按评分细则累计）。
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Label
            htmlFor="timeLimitMinutes"
            className="text-xs font-semibold text-ink-2"
          >
            建议时长（分钟）
          </Label>
          <Input
            id="timeLimitMinutes"
            type="number"
            min={1}
            placeholder="留空 = 不限时"
            value={timeLimitMinutes}
            onChange={(e) => onTimeLimitMinutes(e.target.value)}
          />
          <p className="text-[10.5px] leading-[1.5] text-ink-5">
            对测验生效；其它类型仅做展示建议。
          </p>
        </div>
      </div>
    </WizardCard>
  );
}
