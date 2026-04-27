"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle } from "lucide-react";
import {
  SemesterHeader,
  type SemesterHeaderCourse,
} from "@/components/schedule/semester-header";
import { ScheduleHero } from "@/components/schedule/schedule-hero";
import { ThisWeekTab } from "@/components/schedule/this-week-tab";
import { ScheduleGridTab } from "@/components/schedule/schedule-grid-tab";
import { CourseCalendarTab } from "@/components/schedule/course-calendar-tab";
import type { ThisWeekSlot } from "@/lib/utils/this-week-schedule";

const SEMESTER_LABEL = "本学期 · 2026 春";

export default function StudentSchedulePage() {
  const [courses, setCourses] = useState<SemesterHeaderCourse[]>([]);
  const [slots, setSlots] = useState<ThisWeekSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHeroData() {
      try {
        const [coursesRes, slotsRes] = await Promise.all([
          fetch("/api/lms/courses"),
          fetch("/api/lms/schedule-slots"),
        ]);
        const [coursesJson, slotsJson] = await Promise.all([
          coursesRes.json(),
          slotsRes.json(),
        ]);
        if (cancelled) return;
        if (coursesJson.success) {
          setCourses(coursesJson.data || []);
        } else {
          setError(coursesJson.error?.message || "加载课程失败");
          return;
        }
        if (slotsJson.success) {
          setSlots(slotsJson.data || []);
        }
      } catch {
        if (!cancelled) setError("网络错误，请稍后重试");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadHeroData();
    return () => {
      cancelled = true;
    };
  }, []);

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
    <div className="space-y-5">
      <ScheduleHero
        semesterLabel={SEMESTER_LABEL}
        courses={courses}
        slots={slots}
      />

      <SemesterHeader courses={courses} canEdit={false} />

      <Tabs defaultValue="this-week" className="w-full">
        <TabsList>
          <TabsTrigger value="this-week">本周</TabsTrigger>
          <TabsTrigger value="grid">周课表</TabsTrigger>
          <TabsTrigger value="calendar">日历</TabsTrigger>
        </TabsList>
        <TabsContent value="this-week">
          <ThisWeekTab role="student" />
        </TabsContent>
        <TabsContent value="grid">
          <ScheduleGridTab role="student" />
        </TabsContent>
        <TabsContent value="calendar">
          <CourseCalendarTab role="student" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
