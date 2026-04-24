"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WIZARD_STEPS,
  TASK_TYPE_META,
  type TaskType,
} from "./wizard-types";

interface WizardStepperProps {
  step: number;
  onJump: (idx: number) => void;
  taskType: TaskType;
  taskName: string;
  totalPoints: number;
}

export function WizardStepper({
  step,
  onJump,
  taskType,
  taskName,
  totalPoints,
}: WizardStepperProps) {
  const meta = TASK_TYPE_META[taskType];

  return (
    <aside className="sticky top-5 self-start rounded-xl border border-line bg-surface p-4">
      <div className="px-1 pb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink-5">
        创建流程
      </div>
      <ol className="relative m-0 list-none p-0">
        <div className="absolute left-[15px] top-2.5 bottom-2.5 w-0.5 rounded bg-line-2" />
        {WIZARD_STEPS.map((s, idx) => {
          const done = idx < step;
          const current = idx === step;
          const canClick = idx <= step;
          return (
            <li key={s.id} className="relative px-1 py-1.5">
              <button
                type="button"
                onClick={() => canClick && onJump(idx)}
                disabled={!canClick}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md border-none px-2 py-1.5 text-left transition-colors",
                  current ? "bg-brand-soft" : "bg-transparent",
                  canClick ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "relative z-10 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10.5px] font-bold tabular-nums",
                    done && "bg-success text-white",
                    current && !done && "bg-brand text-white",
                    !done && !current && "border border-line bg-paper-alt text-ink-5"
                  )}
                >
                  {done ? <Check className="size-3" /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-[12.5px]",
                      current && "font-semibold text-brand",
                      done && !current && "font-medium text-ink-2",
                      !done && !current && "font-medium text-ink-4"
                    )}
                  >
                    {s.label}
                  </div>
                  <div
                    className={cn(
                      "mt-px text-[11px] leading-[1.4]",
                      current ? "text-ink-3" : "text-ink-5"
                    )}
                  >
                    {s.desc}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <div
        className={cn(
          "mt-3.5 rounded-lg border-l-[3px] px-3 py-2.5",
          meta.softClass,
          meta.borderClass
        )}
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-4">
          当前草稿
        </div>
        <div className="mt-0.5 truncate text-[12.5px] font-semibold text-ink">
          {taskName || "未命名任务"}
        </div>
        <div className="text-[11px] text-ink-4">
          {meta.label} · 总分 {totalPoints}
        </div>
      </div>
    </aside>
  );
}
