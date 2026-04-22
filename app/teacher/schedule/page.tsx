"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle } from "lucide-react";
import {
  SemesterHeader,
  type SemesterHeaderCourse,
} from "@/components/schedule/semester-header";
import { ThisWeekTab } from "@/components/schedule/this-week-tab";
import { ScheduleGridTab } from "@/components/schedule/schedule-grid-tab";
import { CourseCalendarTab } from "@/components/schedule/course-calendar-tab";

export default function TeacherSchedulePage() {
  const [courses, setCourses] = useState<SemesterHeaderCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch("/api/lms/courses");
      const json = await res.json();
      if (json.success) {
        setCourses(json.data || []);
        setError(null);
      } else {
        setError(json.error?.message || "加载课程失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  function handleSemesterUpdated() {
    fetchCourses();
    setReloadKey((k) => k + 1);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">课表管理</h1>
      </div>

      <SemesterHeader
        courses={courses}
        canEdit={true}
        onUpdated={handleSemesterUpdated}
      />

      <Tabs defaultValue="this-week" className="w-full">
        <TabsList>
          <TabsTrigger value="this-week">本周</TabsTrigger>
          <TabsTrigger value="grid">周课表</TabsTrigger>
          <TabsTrigger value="calendar">日历</TabsTrigger>
        </TabsList>
        <TabsContent value="this-week">
          <ThisWeekTab key={`tw-${reloadKey}`} role="teacher" />
        </TabsContent>
        <TabsContent value="grid">
          <ScheduleGridTab key={`grid-${reloadKey}`} role="teacher" />
        </TabsContent>
        <TabsContent value="calendar">
          <CourseCalendarTab key={`cal-${reloadKey}`} role="teacher" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
