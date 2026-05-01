"use client";

import { BarChart3, BookOpen, Users, Sparkles } from "lucide-react";

export type InstanceTabKey = "overview" | "submissions" | "contexts" | "insights" | "analytics";

interface TabDef {
  key: InstanceTabKey;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  count?: number | null;
  badge?: string | null;
}

export interface InstanceTabsNavProps {
  value: InstanceTabKey;
  onChange: (key: InstanceTabKey) => void;
  submittedCount: number;
}

export function InstanceTabsNav({ value, onChange, submittedCount }: InstanceTabsNavProps) {
  const tabs: TabDef[] = [
    { key: "overview", label: "总览", Icon: BarChart3 },
    { key: "submissions", label: "提交列表", Icon: Users, count: submittedCount },
    { key: "contexts", label: "上下文", Icon: BookOpen },
    { key: "insights", label: "AI 洞察", Icon: Sparkles, badge: "AI" },
    { key: "analytics", label: "数据分析", Icon: BarChart3 },
  ];

  return (
    <div
      className="-mb-px flex flex-wrap border-b border-line"
      role="tablist"
      aria-label="实例详情 tabs"
    >
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`tabpanel-${tab.key}`}
            id={`tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-[13px]",
              "border-b-2 -mb-px cursor-pointer bg-transparent",
              active
                ? "border-brand text-brand font-semibold"
                : "border-transparent text-ink-4 font-medium hover:text-ink-3",
            ].join(" ")}
          >
            <tab.Icon className="size-[13px]" />
            {tab.label}
            {tab.count != null && (
              <span
                className={[
                  "rounded px-1.5 py-0 text-[10.5px] font-semibold tabular-nums",
                  active ? "bg-brand text-brand-fg" : "bg-paper-alt text-ink-5",
                ].join(" ")}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span
                className={[
                  "rounded px-1.5 py-0 text-[9.5px] font-bold tracking-[0.5px]",
                  active ? "bg-brand text-brand-fg" : "bg-sim-soft text-sim",
                ].join(" ")}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
