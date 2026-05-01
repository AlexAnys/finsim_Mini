"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  HelpCircle,
  FileText,
  CalendarDays,
  Sparkles,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatRelativeDue } from "@/lib/utils/dashboard-formatters";
import {
  type CourseFilterOption,
  type TaskTimelineFilters,
  type TaskTimelineGroup,
  type TaskTimelineItem,
  type TeacherTaskType,
  TASK_TIMELINE_GROUP_LABEL,
  TASK_SLOT_POSITION_LABEL,
} from "@/lib/utils/teacher-dashboard-transforms";

const TYPE_CONFIG: Record<
  TeacherTaskType,
  {
    label: string;
    icon: typeof MessageSquare;
    soft: string;
    fg: string;
    chip: string;
  }
> = {
  simulation: {
    label: "模拟对话",
    icon: MessageSquare,
    soft: "bg-sim-soft",
    fg: "text-sim",
    chip: "bg-sim-soft text-sim border-sim/20",
  },
  quiz: {
    label: "测验",
    icon: HelpCircle,
    soft: "bg-quiz-soft",
    fg: "text-quiz",
    chip: "bg-quiz-soft text-quiz border-quiz/20",
  },
  subjective: {
    label: "主观题",
    icon: FileText,
    soft: "bg-subj-soft",
    fg: "text-subj",
    chip: "bg-subj-soft text-subj border-subj/20",
  },
};

const TYPE_FILTERS: Array<{ value: TeacherTaskType | null; label: string }> = [
  { value: null, label: "全部" },
  { value: "quiz", label: "测验" },
  { value: "simulation", label: "模拟" },
  { value: "subjective", label: "主观" },
];

interface AttentionListProps {
  items: TaskTimelineItem[];
  courseOptions: CourseFilterOption[];
  filters: TaskTimelineFilters;
  onFiltersChange: (next: TaskTimelineFilters) => void;
}

export function AttentionList({
  items,
  courseOptions,
  filters,
  onFiltersChange,
}: AttentionListProps) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const todayAnchorRef = useRef<HTMLDivElement>(null);
  const [pulseToday, setPulseToday] = useState(false);

  // 按 group 分组（保留顺序）
  const grouped = useMemo(() => {
    const groups: Array<{ group: TaskTimelineGroup; items: TaskTimelineItem[] }> = [];
    const map = new Map<TaskTimelineGroup, TaskTimelineItem[]>();
    for (const item of items) {
      const arr = map.get(item.group);
      if (arr) {
        arr.push(item);
      } else {
        const fresh: TaskTimelineItem[] = [item];
        map.set(item.group, fresh);
        groups.push({ group: item.group, items: fresh });
      }
    }
    return groups;
  }, [items]);

  const handleCourseChange = (value: string) => {
    onFiltersChange({
      ...filters,
      courseId: value === "__all__" ? null : value,
    });
  };

  const handleTypeChange = (next: TeacherTaskType | null) => {
    onFiltersChange({ ...filters, taskType: next });
  };

  const handleScrollToToday = () => {
    const list = listRef.current;
    const anchor = todayAnchorRef.current;
    if (!list || !anchor) {
      toast.info("当前无今天到期的任务");
      return;
    }
    list.scrollTo({
      top: Math.max(0, anchor.offsetTop - 4),
      behavior: "smooth",
    });
    setPulseToday(true);
    window.setTimeout(() => setPulseToday(false), 900);
  };

  const hasTodayGroup = useMemo(
    () => grouped.some((g) => g.group === "today"),
    [grouped],
  );

  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-ink-2">任务列表</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleScrollToToday}
          disabled={!hasTodayGroup}
          className="h-7 gap-1 px-2 text-xs"
        >
          <CalendarDays className="size-[13px]" />
          回到当天
        </Button>
      </header>

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Select
          value={filters.courseId ?? "__all__"}
          onValueChange={handleCourseChange}
        >
          <SelectTrigger
            size="sm"
            className="h-8 min-w-[160px] text-xs"
            aria-label="按课程筛选"
          >
            <SelectValue placeholder="全部课程" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部课程</SelectItem>
            {courseOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div
          role="radiogroup"
          aria-label="按任务类型筛选"
          className="flex items-center gap-1"
        >
          {TYPE_FILTERS.map((f) => {
            const active = (filters.taskType ?? null) === f.value;
            return (
              <button
                key={f.value ?? "__all__"}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleTypeChange(f.value)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-[11.5px] font-medium transition-colors",
                  active
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line bg-surface text-ink-3 hover:border-brand/40 hover:text-brand",
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface py-6 text-center text-sm text-ink-4">
          暂无符合条件的任务
        </div>
      ) : (
        <div
          ref={listRef}
          className="flex max-h-[500px] flex-col gap-3 overflow-y-auto pr-1"
        >
          {grouped.map(({ group, items: groupItems }) => {
            const isToday = group === "today";
            return (
              <div
                key={group}
                ref={isToday ? todayAnchorRef : undefined}
                className="flex flex-col gap-2"
              >
                <div className="sticky top-0 z-10 -mx-1 bg-paper px-1 pb-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-4 transition-colors",
                      isToday && pulseToday && "text-brand",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        group === "overdue"
                          ? "bg-warn"
                          : group === "today"
                            ? "bg-brand"
                            : group === "thisWeek"
                              ? "bg-sim"
                              : "bg-ink-5",
                      )}
                    />
                    {TASK_TIMELINE_GROUP_LABEL[group]} · {groupItems.length}
                  </span>
                </div>
                {groupItems.map((t) => (
                  <TaskCard
                    key={t.id}
                    item={t}
                    onNavigate={() => router.push(t.hrefInstance)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface TaskCardProps {
  item: TaskTimelineItem;
  onNavigate: () => void;
}

function TaskCard({ item: t, onNavigate }: TaskCardProps) {
  const router = useRouter();
  const cfg = TYPE_CONFIG[t.taskType];
  const Icon = cfg.icon;
  const dueInfo = t.dueAt ? formatRelativeDue(t.dueAt) : null;
  const completion = t.completionRate;
  const barTone =
    completion >= 80
      ? "bg-success"
      : completion >= 50
        ? "bg-brand"
        : "bg-warn";

  const handleSimulate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const href = t.taskType === "simulation"
      ? `/sim/${t.id}?preview=true`
      : `/tasks/${t.id}?preview=true`;
    router.push(href);
  };

  const handleManage = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate();
  };

  const handleCardKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNavigate();
    }
  };

  const sectionLine = [t.chapterTitle, t.sectionTitle].filter(Boolean).join(" · ");
  const slotLabel = t.slot ? TASK_SLOT_POSITION_LABEL[t.slot] : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onNavigate}
      onKeyDown={handleCardKey}
      className={cn(
        "cursor-pointer rounded-xl border bg-surface px-4 py-3.5 shadow-fs transition-all",
        "hover:border-brand/40 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        t.isOverdue
          ? "border-warn-soft border-l-[3px] border-l-warn"
          : "border-line",
      )}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            cfg.soft,
          )}
          aria-hidden
        >
          <Icon className={cn("size-[15px]", cfg.fg)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cfg.chip}>
              {cfg.label}
            </Badge>
            {dueInfo && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[11px]",
                  dueInfo.isUrgent
                    ? "bg-warn-soft text-warn"
                    : "bg-paper-alt text-ink-3",
                )}
              >
                {dueInfo.label}
              </Badge>
            )}
          </div>
          <div className="truncate text-[14px] font-medium text-ink">
            {t.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-ink-4">
            {t.courseTitle && (
              <span className="font-medium text-brand">{t.courseTitle}</span>
            )}
            {t.className && (
              <>
                <span className="text-ink-5">·</span>
                <span>{t.className}</span>
              </>
            )}
            {sectionLine && (
              <>
                <span className="text-ink-5">·</span>
                <span className="truncate">{sectionLine}</span>
              </>
            )}
            {slotLabel && (
              <Badge
                variant="secondary"
                className="bg-paper-alt px-1.5 py-0 text-[10px] font-normal text-ink-3"
              >
                {slotLabel}
              </Badge>
            )}
          </div>

          <div className="mt-2 grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-2"
                role="progressbar"
                aria-valuenow={completion}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="完成度"
              >
                <div
                  className={cn("h-full rounded-full transition-all", barTone)}
                  style={{ width: `${completion}%` }}
                />
              </div>
              <span className="fs-num shrink-0 text-[11px] font-medium text-ink-3">
                完成度 {completion}%
              </span>
              <span className="fs-num shrink-0 text-[11px] text-ink-4">
                ({t.submissionCount}/{t.classSize || "?"})
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11.5px]">
              <span className="text-ink-4">
                {t.avgScore != null ? (
                  <>
                    均分{" "}
                    <span className="fs-num font-semibold text-ink-2">
                      {t.avgScore}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-5">暂无均分</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-stretch gap-1.5 sm:flex">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSimulate}
            className="h-7 gap-1 px-2 text-[11.5px]"
          >
            <Sparkles className="size-[12px]" />
            测试
          </Button>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={handleManage}
            className="h-7 gap-1 px-2 text-[11.5px]"
          >
            <Settings className="size-[12px]" />
            管理
          </Button>
        </div>
      </div>
    </div>
  );
}
