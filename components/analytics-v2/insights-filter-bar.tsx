"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TaskType = "simulation" | "quiz" | "subjective";
type RangeValue = "7d" | "30d" | "term";

interface CourseOption {
  id: string;
  courseTitle: string;
  class?: { id: string; name: string } | null;
}

interface FilterOptionsClass {
  id: string;
  name: string;
}

interface FilterOptionsChapter {
  id: string;
  title: string;
  order: number;
}

interface FilterOptionsSection {
  id: string;
  title: string;
  chapterId: string;
  order: number;
}

interface AnalyticsV2DiagnosisShape {
  filterOptions: {
    classes: FilterOptionsClass[];
    chapters: FilterOptionsChapter[];
    sections: FilterOptionsSection[];
    taskTypes: Array<{ value: TaskType; label: string; count: number }>;
    taskInstances: Array<{
      id: string;
      title: string;
      taskType: TaskType;
      classId: string;
      className: string;
      chapterId: string | null;
      sectionId: string | null;
    }>;
  };
}

interface AsyncJobSnapshot {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  progress: number;
}

export interface InsightsFilterBarProps {
  courses: CourseOption[];
  diagnosis: AnalyticsV2DiagnosisShape | null;
  coursesLoading: boolean;
  searchParams: URLSearchParams;
  recomputeJob: AsyncJobSnapshot | null;
  recomputeStarting: boolean;
  scopeTags: string[];
  onReplaceQuery: (updates: Record<string, string | string[] | null>) => void;
  onReset: () => void;
  onStartRecompute: () => void;
}

const ALL = "__all__";

const RANGE_LABELS: Record<RangeValue, string> = {
  term: "本学期",
  "30d": "近 30 天",
  "7d": "近 7 天",
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  simulation: "模拟练习",
  quiz: "测验",
  subjective: "主观题",
};

export function InsightsFilterBar({
  courses,
  diagnosis,
  coursesLoading,
  searchParams,
  recomputeJob,
  recomputeStarting,
  scopeTags,
  onReplaceQuery,
  onReset,
  onStartRecompute,
}: InsightsFilterBarProps) {
  const courseId = searchParams.get("courseId") ?? "";
  const chapterId = searchParams.get("chapterId") ?? "";
  const sectionId = searchParams.get("sectionId") ?? "";
  const taskInstanceId = searchParams.get("taskInstanceId") ?? "";
  const range = (searchParams.get("range") ?? "term") as RangeValue;
  const classIds = useMemo(() => {
    const multi = searchParams.getAll("classIds");
    if (multi.length > 0) return multi;
    const legacy = searchParams.get("classId");
    return legacy ? [legacy] : [];
  }, [searchParams]);

  const filteredSections = useMemo(() => {
    const sections = diagnosis?.filterOptions.sections ?? [];
    return chapterId
      ? sections.filter((section) => section.chapterId === chapterId)
      : sections;
  }, [chapterId, diagnosis]);

  const filteredInstances = useMemo(() => {
    return (diagnosis?.filterOptions.taskInstances ?? []).filter((instance) => {
      if (chapterId && instance.chapterId !== chapterId) return false;
      if (sectionId && instance.sectionId !== sectionId) return false;
      if (classIds.length > 0 && !classIds.includes(instance.classId)) return false;
      return true;
    });
  }, [chapterId, classIds, diagnosis, sectionId]);

  const recomputeRunning =
    recomputeJob?.status === "queued" || recomputeJob?.status === "running";

  return (
    <section
      aria-label="数据洞察筛选"
      className="space-y-3 rounded-lg border bg-card px-4 py-3"
    >
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="课程" minWidth={180}>
          <Select
            value={courseId || ALL}
            onValueChange={(value) =>
              onReplaceQuery({
                courseId: value === ALL ? null : value,
                chapterId: null,
                sectionId: null,
                classIds: null,
                taskType: null,
                taskInstanceId: null,
              })
            }
            disabled={coursesLoading}
          >
            <SelectTrigger className="h-9 w-full rounded-md">
              <SelectValue placeholder="选择课程" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>选择课程</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.class?.name
                    ? `${course.courseTitle} · ${course.class.name}`
                    : course.courseTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="章节" minWidth={160}>
          <Select
            value={chapterId || ALL}
            onValueChange={(value) =>
              onReplaceQuery({
                chapterId: value === ALL ? null : value,
                sectionId: null,
                taskInstanceId: null,
              })
            }
            disabled={!diagnosis}
          >
            <SelectTrigger className="h-9 w-full rounded-md">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部章节</SelectItem>
              {(diagnosis?.filterOptions.chapters ?? []).map((chapter) => (
                <SelectItem key={chapter.id} value={chapter.id}>
                  {chapter.order}. {chapter.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="小节" minWidth={160}>
          <Select
            value={sectionId || ALL}
            onValueChange={(value) =>
              onReplaceQuery({
                sectionId: value === ALL ? null : value,
                taskInstanceId: null,
              })
            }
            disabled={!diagnosis}
          >
            <SelectTrigger className="h-9 w-full rounded-md">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部小节</SelectItem>
              {filteredSections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.order}. {section.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="任务" minWidth={200}>
          <Select
            value={taskInstanceId || ALL}
            onValueChange={(value) =>
              onReplaceQuery({
                taskInstanceId: value === ALL ? null : value,
              })
            }
            disabled={!diagnosis}
          >
            <SelectTrigger className="h-9 w-full rounded-md">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部任务</SelectItem>
              {filteredInstances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id}>
                  {instance.title} · {TASK_TYPE_LABELS[instance.taskType]} · {instance.className}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="班级" minWidth={180}>
          <ClassMultiSelect
            classes={diagnosis?.filterOptions.classes ?? []}
            selected={classIds}
            disabled={!diagnosis}
            onChange={(next) =>
              onReplaceQuery({ classIds: next.length === 0 ? null : next })
            }
          />
        </FilterField>

        <FilterField label="时间" minWidth={140}>
          <Select
            value={range}
            onValueChange={(value) => onReplaceQuery({ range: value })}
          >
            <SelectTrigger className="h-9 w-full rounded-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="term">{RANGE_LABELS.term}</SelectItem>
              <SelectItem value="30d">{RANGE_LABELS["30d"]}</SelectItem>
              <SelectItem value="7d">{RANGE_LABELS["7d"]}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onStartRecompute}
            disabled={!courseId || recomputeStarting || recomputeRunning}
          >
            <RefreshCw
              className={cn("mr-2 size-3.5", recomputeRunning && "animate-spin")}
            />
            {recomputeRunning
              ? `重算中 ${recomputeJob?.progress ?? 0}%`
              : "后台重算"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!courseId}
          >
            重置筛选
          </Button>
        </div>
      </div>

      {scopeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs font-medium text-muted-foreground">
            当前范围
          </span>
          {scopeTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-md">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

function FilterField({
  label,
  minWidth,
  children,
}: {
  label: string;
  minWidth: number;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5" style={{ minWidth, flex: "1 1 0" }}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ClassMultiSelect({
  classes,
  selected,
  disabled,
  onChange,
}: {
  classes: FilterOptionsClass[];
  selected: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allIds = useMemo(() => classes.map((c) => c.id), [classes]);
  const isAllSelected =
    allIds.length > 0 &&
    selected.length > 0 &&
    allIds.every((id) => selected.includes(id));
  const triggerLabel = useMemo(() => {
    if (classes.length === 0) return "全部班级";
    if (selected.length === 0 || isAllSelected) return "全部班级";
    if (selected.length === 1) {
      const klass = classes.find((c) => c.id === selected[0]);
      return klass?.name ?? "1 个班级";
    }
    return `${selected.length} 个班级`;
  }, [classes, isAllSelected, selected]);

  function toggle(id: string) {
    if (selected.includes(id)) {
      const next = selected.filter((cid) => cid !== id);
      onChange(next);
    } else {
      onChange([...selected, id]);
    }
  }

  function toggleAll() {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([...allIds]);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-9 w-full justify-between rounded-md font-normal"
          aria-haspopup="listbox"
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-2 size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[260px] p-0"
      >
        {classes.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground">
            暂无可选班级
          </div>
        ) : (
          <>
            <div className="border-b px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleAll}
                  aria-label="全选"
                />
                <span>{isAllSelected ? "取消全选" : "全选"}</span>
              </label>
            </div>
            <div className="max-h-[260px] overflow-y-auto py-1">
              {classes.map((klass) => {
                const checked = selected.includes(klass.id);
                return (
                  <label
                    key={klass.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(klass.id)}
                      aria-label={klass.name}
                    />
                    <span className="truncate">{klass.name}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
