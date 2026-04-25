"use client";

import * as React from "react";
import { ArrowLeft, Loader2, type LucideIcon } from "lucide-react";

export interface RunnerTopbarAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: LucideIcon;
  /** "primary" = white bg + ink text, "secondary" = transparent + white border */
  variant?: "primary" | "secondary";
}

export interface RunnerTopbarProps {
  onBack: () => void;
  backLabel?: string;
  title: string;
  subtitle?: string;
  /**
   * Slots between title and action buttons. Runner-specific meta:
   *   - simulation: <MoodPill /> + turns counter
   *   - quiz: progress bar + answered count + timer
   *   - subjective: "已自动保存" chip + word count
   * Topbar does not interpret content — it just lays them out.
   */
  metaSlots?: React.ReactNode;
  /** Right-side action buttons (rendered in order). */
  actions?: RunnerTopbarAction[];
}

function ActionButton({ action }: { action: RunnerTopbarAction }) {
  const { label, onClick, disabled, loading, loadingLabel, icon: Icon, variant = "secondary" } = action;
  const Spinner = loading ? Loader2 : Icon;

  const baseClass =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";

  const styleByVariant: React.CSSProperties =
    variant === "primary"
      ? { background: "#fff", color: "var(--fs-ink)" }
      : { background: "transparent", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.2)" };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={baseClass}
      style={styleByVariant}
    >
      {Spinner && <Spinner size={11} className={loading ? "animate-spin" : ""} />}
      <span>{loading && loadingLabel ? loadingLabel : label}</span>
    </button>
  );
}

export function RunnerTopbar({
  onBack,
  backLabel = "返回任务",
  title,
  subtitle,
  metaSlots,
  actions,
}: RunnerTopbarProps) {
  return (
    <div
      className="flex h-14 shrink-0 items-center gap-4 px-5"
      style={{ background: "var(--fs-ink)", color: "#fff" }}
      role="banner"
    >
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition hover:opacity-90"
        style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
      >
        <ArrowLeft size={12} />
        <span>{backLabel}</span>
      </button>

      <div className="min-w-0 flex-shrink-0 pl-1">
        <div className="truncate text-[13px] font-semibold leading-tight">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[10.5px] text-white/55">
            {subtitle}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center gap-3 overflow-hidden">
        {metaSlots}
      </div>

      {actions && actions.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {actions.map((a, i) => (
            <ActionButton key={`${a.label}-${i}`} action={a} />
          ))}
        </div>
      )}
    </div>
  );
}
