"use client";

import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { WizardCard } from "./wizard-card";
import { TASK_TYPE_META, type TaskType } from "./wizard-types";

interface WizardStepTypeProps {
  taskType: TaskType;
  onChange: (type: TaskType) => void;
}

export function WizardStepType({ taskType, onChange }: WizardStepTypeProps) {
  return (
    <WizardCard
      title="选择任务类型"
      subtitle="不同类型的任务学生端体验不同，创建流程也不同。"
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {(Object.keys(TASK_TYPE_META) as TaskType[]).map((k) => {
          const meta = TASK_TYPE_META[k];
          const selected = taskType === k;
          const Icon = meta.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              className={cn(
                "flex cursor-pointer flex-col gap-2.5 rounded-xl border-2 p-[18px] text-left transition-all",
                selected
                  ? cn(meta.softClass, meta.borderClass, "shadow-fs")
                  : "border-line bg-surface hover:border-line-2"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-[10px] text-white",
                    meta.bgClass
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {selected && (
                  <span
                    className={cn(
                      "grid h-[22px] w-[22px] place-items-center rounded-full text-white",
                      meta.bgClass
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                )}
              </div>
              <div>
                <div className="text-[15px] font-semibold text-ink">
                  {meta.label}
                  <span className="ml-1.5 text-[10.5px] font-medium tracking-[0.06em] text-ink-5">
                    {meta.en}
                  </span>
                </div>
                <div className="mt-1 text-xs leading-[1.55] text-ink-3">
                  {meta.desc}
                </div>
              </div>
              <ul className="m-0 list-none p-0">
                {meta.stats.map((s) => (
                  <li
                    key={s}
                    className="flex items-center gap-1.5 py-0.5 text-[11.5px] text-ink-3"
                  >
                    <span
                      className={cn(
                        "size-[3px] shrink-0 rounded-full",
                        meta.bgClass
                      )}
                    />
                    {s}
                  </li>
                ))}
              </ul>
              <div className="mt-auto inline-flex items-center gap-1 self-start rounded-md bg-paper-alt px-2.5 py-1.5 text-[11px] text-ink-4">
                <Clock className="size-3" /> {meta.time}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg bg-paper-alt px-3.5 py-3 text-[11.5px] leading-[1.5] text-ink-4">
        <b className="text-ink-3">提示</b>
        ：选中后可以在下一步开始填详情。类型确定后不建议再改（配置结构会重置）。
      </div>
    </WizardCard>
  );
}
