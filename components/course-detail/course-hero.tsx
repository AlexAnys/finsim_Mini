"use client";

import Link from "next/link";

export type CourseDetailTabKey =
  | "content"
  | "tasks"
  | "grades"
  | "announcements"
  | "discussion"
  | "resources";

interface CourseHeroProps {
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  teacherName: string | null;
  className: string | null;
  progressPct: number;
  completedChapters: number;
  totalChapters: number;
  avgScore: number | null;
  activeTab: CourseDetailTabKey;
  onTabChange: (tab: CourseDetailTabKey) => void;
  taskBadgeCount?: number;
}

const TABS: Array<{ key: CourseDetailTabKey; label: string }> = [
  { key: "content", label: "内容" },
  { key: "tasks", label: "任务" },
  { key: "grades", label: "成绩" },
  { key: "announcements", label: "公告" },
  { key: "discussion", label: "讨论" },
  { key: "resources", label: "资源" },
];

export function CourseHero({
  courseTitle,
  courseCode,
  description,
  teacherName,
  className,
  progressPct,
  completedChapters,
  totalChapters,
  avgScore,
  activeTab,
  onTabChange,
  taskBadgeCount,
}: CourseHeroProps) {
  return (
    <div
      className="relative -mx-6 -mt-6 overflow-hidden px-6 pt-7 pb-9 text-white md:-mx-6 md:px-10"
      style={{
        background:
          "linear-gradient(135deg, var(--fs-primary) 0%, var(--fs-primary-deep) 100%)",
      }}
    >
      {/* Decorative SVG background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-10 opacity-[0.08]"
      >
        <svg width="340" height="280" viewBox="0 0 340 280" fill="none">
          <path
            d="M0 220 L60 180 L120 200 L180 140 L240 160 L300 80 L340 40"
            stroke="#fff"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M0 240 L60 210 L120 220 L180 180 L240 190 L300 140 L340 110"
            stroke="var(--fs-accent)"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="300" cy="80" r="5" fill="var(--fs-accent)" />
        </svg>
      </div>

      {/* Breadcrumb inside hero */}
      <div className="mb-2 text-xs" style={{ color: "var(--fs-accent-soft)" }}>
        <Link href="/courses" className="opacity-70 hover:opacity-100">
          我的课程
        </Link>{" "}
        / <span className="opacity-90">{courseTitle}</span>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="mb-2 text-[26px] font-semibold tracking-[-0.02em] md:text-[30px]">
            {courseTitle}
          </h1>
          {description && (
            <p className="max-w-[560px] text-[13px] leading-[1.55] text-white/75 md:text-[13.5px]">
              {description}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
            {courseCode && (
              <span className="text-white/80">{courseCode}</span>
            )}
            {teacherName && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-white/80">{teacherName} 老师</span>
              </>
            )}
            {className && (
              <>
                <span className="text-white/40">·</span>
                <span className="text-white/80">{className}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div
            className="mb-1.5 text-[11px] uppercase tracking-[0.1em]"
            style={{ color: "var(--fs-accent-soft)" }}
          >
            你的进度
          </div>
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="fs-num text-[38px] font-semibold tracking-[-0.03em]">
              {progressPct}
            </span>
            <span className="text-lg text-white/60">%</span>
          </div>
          <div className="mt-1 text-[11.5px] text-white/70">
            {completedChapters} / {totalChapters} 章
            {avgScore != null && <> · 均分 {avgScore}</>}
          </div>
          <div className="mt-2.5 h-1 w-[220px] overflow-hidden rounded-sm bg-white/15">
            <div
              className="h-full"
              style={{
                width: `${Math.max(0, Math.min(100, progressPct))}%`,
                backgroundColor: "var(--fs-accent)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        className="mt-6 flex gap-0.5 overflow-x-auto border-b border-white/10 -mx-6 pl-6 md:-mx-10 md:pl-10"
      >
        {TABS.map((t) => {
          const isActive = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(t.key)}
              className="relative -mb-px whitespace-nowrap px-4 py-2.5 text-[13px] transition-colors"
              style={{
                color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive
                  ? "2px solid var(--fs-accent)"
                  : "2px solid transparent",
              }}
            >
              {t.label}
              {t.key === "tasks" && taskBadgeCount != null && taskBadgeCount > 0 && (
                <span
                  className="ml-1.5 text-[10px] font-semibold"
                  style={{ color: "var(--fs-accent)" }}
                >
                  {taskBadgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
