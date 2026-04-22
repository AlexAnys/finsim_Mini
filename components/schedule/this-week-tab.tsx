"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertCircle,
  CalendarDays,
  Clock,
  FileText,
  Megaphone,
} from "lucide-react";
import {
  filterThisWeekSlots,
  isInThisWeek,
  type ThisWeekSlot,
} from "@/lib/utils/this-week-schedule";

const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

interface TaskInstance {
  id: string;
  title?: string;
  dueAt: string;
  course?: { id: string; courseTitle: string } | null;
  task?: { taskName: string } | null;
}

interface Announcement {
  id: string;
  title: string;
  createdAt: string;
  course?: { courseTitle: string } | null;
}

interface ThisWeekTabProps {
  role: "teacher" | "student";
}

export function ThisWeekTab({ role }: ThisWeekTabProps) {
  const [slots, setSlots] = useState<ThisWeekSlot[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [slotsRes, tasksRes, annRes] = await Promise.all([
          fetch("/api/lms/schedule-slots"),
          fetch("/api/lms/task-instances?status=published"),
          fetch("/api/lms/announcements"),
        ]);
        const [slotsJson, tasksJson, annJson] = await Promise.all([
          slotsRes.json(),
          tasksRes.json(),
          annRes.json(),
        ]);
        if (cancelled) return;
        if (slotsJson.success) setSlots(slotsJson.data || []);
        else throw new Error(slotsJson.error?.message || "加载课表失败");
        if (tasksJson.success) setTasks(tasksJson.data || []);
        if (annJson.success) setAnnouncements(annJson.data || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = useMemo(() => new Date(), []);
  const jsDay = now.getDay();
  const todayDayOfWeek = jsDay === 0 ? 7 : jsDay;

  const thisWeekSlots = useMemo(
    () => filterThisWeekSlots(slots, now),
    [slots, now]
  );

  const slotsByDay = useMemo(() => {
    const map: Record<number, ThisWeekSlot[]> = {};
    for (const s of thisWeekSlots) {
      (map[s.dayOfWeek] ??= []).push(s);
    }
    for (const k of Object.keys(map)) {
      map[Number(k)].sort((a, b) => a.slotIndex - b.slotIndex);
    }
    return map;
  }, [thisWeekSlots]);

  const thisWeekTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueAt && isInThisWeek(t.dueAt, now))
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
    [tasks, now]
  );

  const thisWeekAnnouncements = useMemo(
    () =>
      announcements
        .filter((a) => a.createdAt && isInThisWeek(a.createdAt, now))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [announcements, now]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const hasContent =
    thisWeekSlots.length > 0 ||
    thisWeekTasks.length > 0 ||
    thisWeekAnnouncements.length > 0;

  if (!hasContent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="size-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">本周没有课程</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 本周课程按天分组 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-5" />
            本周课程
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {thisWeekSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">本周无课</p>
          ) : (
            DAY_LABELS.map((label, idx) => {
              const dayOfWeek = idx + 1;
              const list = slotsByDay[dayOfWeek] || [];
              if (list.length === 0) return null;
              const isToday = dayOfWeek === todayDayOfWeek;
              return (
                <div key={dayOfWeek}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium">{label}</h3>
                    {isToday && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        今日
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    {list.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-start gap-3 rounded-md border p-2.5 bg-blue-50/50 dark:bg-blue-950/30"
                      >
                        <Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                            {slot.course.courseTitle}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            第{slot.slotIndex}节 · {slot.timeLabel}
                            {slot.classroom && <> · {slot.classroom}</>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* 本周任务截止 */}
      {thisWeekTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-5" />
              本周任务截止
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {thisWeekTasks.map((t) => {
              const href =
                role === "teacher"
                  ? `/teacher/instances/${t.id}`
                  : `/tasks/${t.id}`;
              return (
                <Link
                  key={t.id}
                  href={href}
                  className="flex items-center gap-3 rounded-md border p-2.5 hover:bg-muted/50 transition-colors"
                >
                  <AlertCircle className="size-4 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {t.title || t.task?.taskName || "未命名任务"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.course?.courseTitle && <>{t.course.courseTitle} · </>}
                      截止 {new Date(t.dueAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 本周公告 */}
      {thisWeekAnnouncements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-5" />
              本周公告
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {thisWeekAnnouncements.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-md border p-2.5"
              >
                <Megaphone className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.course?.courseTitle && <>{a.course.courseTitle} · </>}
                    {new Date(a.createdAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
