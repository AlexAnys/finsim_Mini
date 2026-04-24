"use client";

import Link from "next/link";
import { Plus, Users, CalendarDays, BookOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CourseSummaryCounts } from "@/lib/utils/course-editor-transforms";

export interface EditorHeroClass {
  id: string;
  classId: string;
  class: { id: string; name: string };
}

export interface EditorHeroTeacher {
  id: string;
  teacherId: string;
  teacher: { id: string; name: string; email: string };
}

interface EditorHeroProps {
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  primaryClassId: string;
  courseClasses: EditorHeroClass[];
  fallbackClassName: string | null;
  teachers: EditorHeroTeacher[];
  semesterStartIso: string | null;
  counts: CourseSummaryCounts;
  onAddChapter: () => void;
  onAddTeacher: () => void;
  onEditCourse: () => void;
  onAddClass: () => void;
  onEditSemester: () => void;
  onRemoveClass: (classId: string) => void;
  onRemoveTeacher: (teacherId: string) => void;
  semesterBadge: React.ReactNode;
}

export function EditorHero({
  courseTitle,
  courseCode,
  description,
  primaryClassId,
  courseClasses,
  fallbackClassName,
  teachers,
  counts,
  onAddChapter,
  onAddTeacher,
  onEditCourse,
  onAddClass,
  onRemoveClass,
  onRemoveTeacher,
  semesterBadge,
}: EditorHeroProps) {
  return (
    <div
      className="relative -mx-6 -mt-6 overflow-hidden px-6 pt-7 pb-9 text-white md:px-10"
      style={{
        background:
          "linear-gradient(135deg, var(--fs-primary) 0%, var(--fs-primary-deep) 100%)",
      }}
    >
      {/* Decorative SVG */}
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

      {/* Breadcrumb */}
      <div className="mb-2 text-xs" style={{ color: "var(--fs-accent-soft)" }}>
        <Link href="/teacher/courses" className="opacity-70 hover:opacity-100">
          课程管理
        </Link>{" "}
        / <span className="opacity-90">{courseTitle}</span>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10">
              <BookOpen className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold tracking-[-0.02em] md:text-[28px]">
                {courseTitle}
              </h1>
              {(courseCode || description) && (
                <p className="mt-1 max-w-[620px] text-[13px] leading-[1.55] text-white/75">
                  {courseCode && (
                    <span className="fs-num mr-2 font-medium text-white/90">
                      {courseCode}
                    </span>
                  )}
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Class + semester badges */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {courseClasses.length === 0 && fallbackClassName && (
              <Badge>
                <Users className="size-3" />
                {fallbackClassName}
              </Badge>
            )}
            {courseClasses.map((cc) => {
              const isPrimary = cc.classId === primaryClassId;
              return (
                <Badge key={cc.id}>
                  <Users className="size-3" />
                  {cc.class.name}
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => onRemoveClass(cc.classId)}
                      className="ml-1 text-white/60 hover:text-white"
                      aria-label="移除班级"
                    >
                      ×
                    </button>
                  )}
                </Badge>
              );
            })}
            <button
              type="button"
              onClick={onAddClass}
              className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-[3px] text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Plus className="size-3" />
              添加班级
            </button>
            <span className="mx-1 text-white/30">·</span>
            {semesterBadge}
          </div>

          {/* Teachers */}
          {teachers.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <CalendarDays className="size-[11px] text-white/50" />
              <span className="text-[11.5px] text-white/60">协作教师：</span>
              {teachers.map((t) => (
                <Badge key={t.id}>
                  {t.teacher.name}
                  <button
                    type="button"
                    onClick={() => onRemoveTeacher(t.teacherId)}
                    className="ml-1 text-white/60 hover:text-white"
                    aria-label="移除协作教师"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div
            className="mb-1.5 text-[11px] uppercase tracking-[0.1em]"
            style={{ color: "var(--fs-accent-soft)" }}
          >
            课程概览
          </div>
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="fs-num text-[32px] font-semibold tracking-[-0.03em]">
              {counts.chapterCount}
            </span>
            <span className="text-sm text-white/60">章</span>
            <span className="fs-num ml-3 text-[22px] font-medium text-white/80">
              {counts.sectionCount}
            </span>
            <span className="text-xs text-white/50">节</span>
          </div>
          <div className="mt-1 text-[11.5px] text-white/70">
            {counts.totalTasks} 项任务
            {counts.publishedTasks > 0 && (
              <> · 已发布 {counts.publishedTasks}</>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              onClick={onEditCourse}
            >
              <Pencil className="size-[12px]" />
              编辑课程
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              onClick={onAddTeacher}
            >
              <Users className="size-[12px]" />
              协作教师
            </Button>
            <Button
              size="sm"
              className="bg-[var(--fs-accent)] text-[var(--fs-primary-fg)] hover:bg-[var(--fs-accent)]/90"
              onClick={onAddChapter}
            >
              <Plus className="size-[12px]" />
              添加章节
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-[3px] text-[11px] text-white/90">
      {children}
    </span>
  );
}
