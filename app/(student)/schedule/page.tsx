"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CalendarDays } from "lucide-react";

interface ScheduleSlot {
  id: string;
  courseId: string;
  dayOfWeek: number;
  slotIndex: number;
  startWeek: number;
  endWeek: number;
  timeLabel: string;
  classroom: string | null;
  weekType: string;
  course: { courseTitle: string; classId: string; class: { name: string } };
}

const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const DEFAULT_TIME_LABELS: Record<number, string> = {
  1: "08:30-10:05",
  2: "10:25-12:00",
  3: "14:00-15:35",
  4: "15:55-17:30",
};

export default function StudentSchedulePage() {
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSlots() {
      try {
        const res = await fetch("/api/lms/schedule-slots");
        const json = await res.json();
        if (json.success) {
          setSlots(json.data || []);
        } else {
          setError(json.error?.message || "加载课表失败");
        }
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    fetchSlots();
  }, []);

  function getSlotsForCell(dayOfWeek: number, slotIndex: number): ScheduleSlot[] {
    return slots.filter((s) => s.dayOfWeek === dayOfWeek && s.slotIndex === slotIndex);
  }

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的课表</h1>
      </div>

      {slots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">暂无课表信息</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop: grid table */}
          <Card className="hidden sm:block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-5" />
                周课表
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-muted text-muted-foreground w-24">
                        时段
                      </th>
                      {DAY_LABELS.map((day, i) => (
                        <th
                          key={i}
                          className="border p-2 bg-muted text-muted-foreground min-w-[110px]"
                        >
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4].map((slotIndex) => (
                      <tr key={slotIndex}>
                        <td className="border p-2 text-center text-muted-foreground bg-muted/50">
                          <div className="font-medium">第{slotIndex}节</div>
                          <div className="text-xs">{DEFAULT_TIME_LABELS[slotIndex]}</div>
                        </td>
                        {[1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
                          const cellSlots = getSlotsForCell(dayOfWeek, slotIndex);
                          return (
                            <td
                              key={dayOfWeek}
                              className={`border p-1 text-center ${
                                cellSlots.length > 0
                                  ? "bg-blue-50 dark:bg-blue-950"
                                  : ""
                              }`}
                            >
                              {cellSlots.length > 0 ? (
                                <div className="space-y-1.5 p-1">
                                  {cellSlots.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className="rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-900/50 p-1.5"
                                    >
                                      <div className="font-medium text-xs text-blue-700 dark:text-blue-300">
                                        {slot.course.courseTitle}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {slot.timeLabel}
                                      </div>
                                      {slot.classroom && (
                                        <div className="text-[11px] text-muted-foreground">
                                          {slot.classroom}
                                        </div>
                                      )}
                                      <div className="flex items-center justify-center gap-1 mt-0.5">
                                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                          {slot.startWeek}-{slot.endWeek}周
                                        </Badge>
                                        {slot.weekType && slot.weekType !== "all" && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                                            {slot.weekType === "odd" ? "单周" : "双周"}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile: list view */}
          <div className="sm:hidden space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="size-5" />
                  周课表
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {DAY_LABELS.map((dayLabel, dayIdx) => {
                  const dayOfWeek = dayIdx + 1;
                  const daySlots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
                  if (daySlots.length === 0) return null;
                  return (
                    <div key={dayOfWeek}>
                      <h3 className="font-medium text-sm mb-2">{dayLabel}</h3>
                      <div className="space-y-2">
                        {daySlots
                          .sort((a, b) => a.slotIndex - b.slotIndex)
                          .map((slot) => (
                            <div
                              key={slot.id}
                              className="flex items-start gap-3 rounded-lg border p-3 bg-blue-50 dark:bg-blue-950"
                            >
                              <div className="text-xs text-muted-foreground shrink-0 pt-0.5">
                                第{slot.slotIndex}节
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-blue-700 dark:text-blue-300">
                                  {slot.course.courseTitle}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {slot.timeLabel}
                                  {slot.classroom && ` | ${slot.classroom}`}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                    {slot.startWeek}-{slot.endWeek}周
                                  </Badge>
                                  {slot.weekType && slot.weekType !== "all" && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                                      {slot.weekType === "odd" ? "单周" : "双周"}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
