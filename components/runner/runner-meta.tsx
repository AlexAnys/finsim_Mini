"use client";

import * as React from "react";
import { Clock, MessageSquare, FileText } from "lucide-react";

export function RunnerMetaPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn" | "good";
}) {
  const bg =
    tone === "warn"
      ? "rgba(230, 179, 76, 0.15)"
      : tone === "good"
        ? "rgba(81, 192, 142, 0.15)"
        : "rgba(255,255,255,0.08)";
  const border =
    tone === "warn"
      ? "1px solid rgba(230, 179, 76, 0.35)"
      : tone === "good"
        ? "1px solid rgba(81, 192, 142, 0.35)"
        : "1px solid transparent";
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px]"
      style={{ background: bg, border, color: "rgba(255,255,255,0.85)" }}
    >
      {children}
    </div>
  );
}

export function RunnerMetaTurns({ count }: { count: number }) {
  return (
    <RunnerMetaPill>
      <MessageSquare size={11} />
      <span className="fs-num font-semibold text-white">{count}</span>
      <span className="text-white/60">轮</span>
    </RunnerMetaPill>
  );
}

export function RunnerMetaTimer({
  seconds,
  warningBelow = 60,
}: {
  seconds: number;
  warningBelow?: number;
}) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const display = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  const tone = seconds <= warningBelow ? "warn" : "neutral";
  return (
    <RunnerMetaPill tone={tone}>
      <Clock size={11} className={tone === "warn" ? "text-[#E6B34C]" : ""} />
      <span
        className="fs-num font-semibold"
        style={{ color: tone === "warn" ? "#E6B34C" : "#fff" }}
      >
        {display}
      </span>
      <span className="text-white/60">剩余</span>
    </RunnerMetaPill>
  );
}

export function RunnerMetaProgress({
  current,
  total,
  totalPoints,
}: {
  current: number;
  total: number;
  totalPoints?: number;
}) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="flex max-w-[280px] flex-1 flex-col gap-1">
      <div
        className="h-1 overflow-hidden rounded"
        style={{ background: "rgba(255,255,255,0.15)" }}
      >
        <div
          className="h-full rounded transition-all"
          style={{ width: `${pct}%`, background: "var(--fs-quiz)" }}
        />
      </div>
      <div className="flex items-center justify-between text-[10.5px] text-white/60">
        <span>
          已作答{" "}
          <span className="fs-num font-semibold text-white">{current}</span> /{" "}
          {total}
        </span>
        {typeof totalPoints === "number" && (
          <span className="fs-num">总分 {totalPoints}</span>
        )}
      </div>
    </div>
  );
}

export function RunnerMetaWordCount({
  count,
  limit,
}: {
  count: number;
  limit?: number | null;
}) {
  const isOver = typeof limit === "number" && count > limit;
  return (
    <RunnerMetaPill tone={isOver ? "warn" : "neutral"}>
      <FileText size={11} />
      <span
        className="fs-num font-semibold"
        style={{ color: isOver ? "#E6B34C" : "#fff" }}
      >
        {count}
      </span>
      {typeof limit === "number" && (
        <span className="text-white/60">/ {limit} 字</span>
      )}
      {typeof limit !== "number" && <span className="text-white/60">字</span>}
    </RunnerMetaPill>
  );
}

export function RunnerMetaSavedChip({ saving }: { saving: boolean }) {
  return (
    <RunnerMetaPill tone="good">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "#51C08E" }}
      />
      <span className="text-white/85">{saving ? "保存中..." : "已自动保存"}</span>
    </RunnerMetaPill>
  );
}
