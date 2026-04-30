"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { courseColorForId, tagColors } from "@/lib/design/tokens";
import {
  displayInitial,
  type TeacherInfo,
} from "@/lib/utils/teacher-courses-transforms";

export interface TeacherCourseCardData {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  classNames: string[];
  teachers: TeacherInfo[];
  metrics: {
    taskCount: number;
    publishedCount: number;
    studentCount: number;
    avgScore: number | null;
    pendingCount: number;
  };
  semesterStartIso: string | null;
}

interface TeacherCourseCardProps {
  data: TeacherCourseCardData;
}

const AVATAR_TOKENS = ["tagA", "tagB", "tagC", "tagD", "tagE", "tagF"] as const;

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const key = AVATAR_TOKENS[hash % AVATAR_TOKENS.length];
  return tagColors[key];
}

export function TeacherCourseCard({ data: c }: TeacherCourseCardProps) {
  const tc = tagColors[courseColorForId(c.id)];

  const visibleTeachers = c.teachers.slice(0, 3);
  const overflow = Math.max(0, c.teachers.length - 3);

  return (
    <div className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-fs transition-shadow hover:shadow-fs-lg">
      {/* Top color bar */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ backgroundColor: tc.fg, opacity: 0.9 }}
      />

      {/* Header */}
      <div className="border-b border-line-2 px-5 pt-[18px] pb-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {c.courseCode && (
                <span
                  className="fs-num rounded px-2 py-[2px] text-[11px] font-semibold"
                  style={{ backgroundColor: tc.bg, color: tc.fg }}
                >
                  {c.courseCode}
                </span>
              )}
              {c.classNames.length > 0 &&
                c.classNames.map((n, i) => (
                  <span
                    key={`${n}-${i}`}
                    className="inline-flex items-center gap-1 rounded bg-paper-alt px-2 py-[2px] text-[11px] text-ink-3"
                  >
                    <Users className="size-[10px]" />
                    {n}
                  </span>
                ))}
            </div>
            <h3 className="text-[17px] font-bold leading-tight tracking-[-0.01em] text-ink">
              {c.courseTitle}
            </h3>
            {c.description && (
              <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.5] text-ink-4">
                {c.description}
              </p>
            )}
          </div>
          {/* Teacher avatar stack */}
          {visibleTeachers.length > 0 && (
            <div className="flex shrink-0 -space-x-1.5">
              {visibleTeachers.map((t) => {
                const ac = avatarColor(t.id);
                return (
                  <div
                    key={t.id}
                    title={
                      t.isCreator
                        ? `${t.name}（主讲）`
                        : `${t.name}（协讲）`
                    }
                    className={cn(
                      "grid size-7 place-items-center rounded-full border text-[11px] font-semibold ring-2 ring-surface",
                      t.isCreator
                        ? "border-brand/30"
                        : "border-line",
                    )}
                    style={{ backgroundColor: ac.bg, color: ac.fg }}
                  >
                    {displayInitial(t.name)}
                  </div>
                );
              })}
              {overflow > 0 && (
                <div className="grid size-7 place-items-center rounded-full border border-line bg-paper-alt text-[10.5px] font-medium text-ink-4 ring-2 ring-surface">
                  +{overflow}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-line-2 border-b border-line-2 bg-surface-tint">
        <Stat
          label="任务"
          value={c.metrics.taskCount}
          sub={
            c.metrics.publishedCount > 0
              ? `已发布 ${c.metrics.publishedCount}`
              : "全部草稿"
          }
        />
        <Stat
          label="学生"
          value={c.metrics.studentCount || "—"}
          sub={c.metrics.studentCount > 0 ? "在读人数" : "未关联班级"}
        />
        <Stat
          label="均分"
          value={c.metrics.avgScore != null ? c.metrics.avgScore.toFixed(1) : "—"}
          sub={
            c.metrics.avgScore != null
              ? c.metrics.avgScore >= 80
                ? "表现良好"
                : "需关注"
              : "暂无批改"
          }
          tone={
            c.metrics.avgScore != null && c.metrics.avgScore >= 80
              ? "success"
              : "default"
          }
        />
      </div>

      {/* Footer CTA */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          {c.metrics.pendingCount > 0 ? (
            <div className="text-[12px]">
              <span className="font-medium text-warn">
                {c.metrics.pendingCount} 份待批改
              </span>
              <span className="ml-1 text-ink-4">· 进入课程处理</span>
            </div>
          ) : (
            <div className="text-[12px] text-ink-4">
              {c.semesterStartIso ? formatSemester(c.semesterStartIso) : "未设置学期"}
            </div>
          )}
        </div>
        <Button size="sm" asChild>
          <Link href={`/teacher/courses/${c.id}`}>
            进入
            <ArrowRight className="size-[12px]" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-5">
        {label}
      </div>
      <div
        className={cn(
          "fs-num mt-0.5 text-[17px] font-semibold tracking-[-0.02em]",
          tone === "success" ? "text-success" : "text-ink",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10.5px] text-ink-4">{sub}</div>
    </div>
  );
}

function formatSemester(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "未设置学期";
  return `学期始 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
