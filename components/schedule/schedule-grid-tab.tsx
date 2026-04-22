"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertCircle, Plus, Trash2, CalendarDays } from "lucide-react";

interface Course {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  class: { id: string; name: string };
}

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

interface ScheduleGridTabProps {
  role: "teacher" | "student";
}

const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const DEFAULT_TIME_LABELS: Record<number, string> = {
  1: "08:30-10:05",
  2: "10:25-12:00",
  3: "14:00-15:35",
  4: "15:55-17:30",
};

export function ScheduleGridTab({ role }: ScheduleGridTabProps) {
  const isTeacher = role === "teacher";
  const [courses, setCourses] = useState<Course[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teacher-only create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createCourseId, setCreateCourseId] = useState("");
  const [createDayOfWeek, setCreateDayOfWeek] = useState(1);
  const [createSlotIndex, setCreateSlotIndex] = useState(1);
  const [createTimeLabel, setCreateTimeLabel] = useState("");
  const [createClassroom, setCreateClassroom] = useState("");
  const [createStartWeek, setCreateStartWeek] = useState(1);
  const [createEndWeek, setCreateEndWeek] = useState(16);
  const [createWeekType, setCreateWeekType] = useState("all");
  const [creating, setCreating] = useState(false);

  // Teacher-only delete dialog state
  const [deleteSlot, setDeleteSlot] = useState<ScheduleSlot | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchCourses() {
      if (!isTeacher) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/lms/courses");
        const json = await res.json();
        if (json.success) {
          setCourses(json.data || []);
        } else {
          setError(json.error?.message || "加载课程失败");
        }
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, [isTeacher]);

  const fetchSlots = useCallback(async () => {
    setSlotsLoading(true);
    try {
      const res = await fetch("/api/lms/schedule-slots");
      const json = await res.json();
      if (json.success) {
        setSlots(json.data || []);
      } else {
        toast.error(json.error?.message || "加载课表失败");
      }
    } catch {
      toast.error("加载课表失败，请重试");
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  function getSlotsForCell(dayOfWeek: number, slotIndex: number): ScheduleSlot[] {
    return slots.filter((s) => s.dayOfWeek === dayOfWeek && s.slotIndex === slotIndex);
  }

  function handleCellClick(dayOfWeek: number, slotIndex: number) {
    if (!isTeacher) return;
    const cellSlots = getSlotsForCell(dayOfWeek, slotIndex);
    if (cellSlots.length === 0) {
      openCreateDialog(dayOfWeek, slotIndex);
    }
  }

  function openCreateDialog(dayOfWeek: number, slotIndex: number) {
    setCreateDayOfWeek(dayOfWeek);
    setCreateSlotIndex(slotIndex);
    setCreateTimeLabel(DEFAULT_TIME_LABELS[slotIndex] || "");
    setCreateClassroom("");
    setCreateCourseId(courses.length === 1 ? courses[0].id : "");
    setCreateStartWeek(1);
    setCreateEndWeek(16);
    setCreateWeekType("all");
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!createCourseId) {
      toast.error("请选择课程");
      return;
    }
    if (!createTimeLabel.trim()) {
      toast.error("请填写时间标签");
      return;
    }
    if (createStartWeek > createEndWeek) {
      toast.error("起始周不能大于结束周");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/lms/schedule-slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: createCourseId,
          dayOfWeek: createDayOfWeek,
          slotIndex: createSlotIndex,
          startWeek: createStartWeek,
          endWeek: createEndWeek,
          timeLabel: createTimeLabel.trim(),
          classroom: createClassroom.trim() || undefined,
          weekType: createWeekType,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "创建失败");
        return;
      }
      toast.success("课表时段已添加");
      setCreateOpen(false);
      fetchSlots();
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteSlot) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/lms/schedule-slots/${deleteSlot.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "删除失败");
        return;
      }
      toast.success("课表时段已删除");
      setDeleteSlot(null);
      fetchSlots();
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setDeleting(false);
    }
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

  if (slotsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载课表...</span>
      </div>
    );
  }

  // Student: empty state
  if (!isTeacher && slots.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <CalendarDays className="size-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">暂无课表信息</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Desktop: grid table (teacher + student shared) */}
      <Card className={isTeacher ? "" : "hidden sm:block"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-5" />
            {isTeacher ? "全部课程周课表" : "周课表"}
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
                      className={`border p-2 bg-muted text-muted-foreground ${
                        isTeacher ? "min-w-[120px]" : "min-w-[110px]"
                      }`}
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
                          className={`border p-1 text-center transition-colors ${
                            cellSlots.length > 0
                              ? "bg-blue-50 dark:bg-blue-950"
                              : isTeacher
                              ? "hover:bg-muted/50 cursor-pointer"
                              : ""
                          }`}
                          onClick={() => {
                            if (cellSlots.length === 0) handleCellClick(dayOfWeek, slotIndex);
                          }}
                        >
                          {cellSlots.length > 0 ? (
                            <div className="space-y-1.5 p-1">
                              {cellSlots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className={`rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-900/50 p-1.5 ${
                                    isTeacher
                                      ? "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                                      : ""
                                  }`}
                                  onClick={
                                    isTeacher
                                      ? (e) => {
                                          e.stopPropagation();
                                          setDeleteSlot(slot);
                                        }
                                      : undefined
                                  }
                                >
                                  <div className="font-medium text-xs text-blue-700 dark:text-blue-300">
                                    {slot.course.courseTitle}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {isTeacher ? slot.course.class.name : slot.timeLabel}
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
                              {isTeacher && (
                                <button
                                  className="w-full py-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCreateDialog(dayOfWeek, slotIndex);
                                  }}
                                >
                                  <Plus className="size-3 mx-auto" />
                                </button>
                              )}
                            </div>
                          ) : (
                            isTeacher && (
                              <div className="py-4 text-muted-foreground/40">
                                <Plus className="size-4 mx-auto" />
                              </div>
                            )
                          )}
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

      {/* Mobile: list view (student only — teacher grid is scrollable) */}
      {!isTeacher && (
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
      )}

      {/* Teacher-only dialogs */}
      {isTeacher && (
        <>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加课表时段</DialogTitle>
                <DialogDescription>
                  {DAY_LABELS[createDayOfWeek - 1]} 第{createSlotIndex}节
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>课程</Label>
                  <Select value={createCourseId} onValueChange={setCreateCourseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择课程" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.courseTitle} - {c.class.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>时间</Label>
                  <Input
                    value={createTimeLabel}
                    onChange={(e) => setCreateTimeLabel(e.target.value)}
                    placeholder="例如：08:30-10:05"
                  />
                </div>
                <div className="space-y-2">
                  <Label>教室（选填）</Label>
                  <Input
                    value={createClassroom}
                    onChange={(e) => setCreateClassroom(e.target.value)}
                    placeholder="例如：A301"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>起始周</Label>
                    <Input
                      type="number"
                      min={1}
                      value={createStartWeek}
                      onChange={(e) => setCreateStartWeek(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>结束周</Label>
                    <Input
                      type="number"
                      min={1}
                      value={createEndWeek}
                      onChange={(e) => setCreateEndWeek(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>周类型</Label>
                  <Select value={createWeekType} onValueChange={setCreateWeekType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部周</SelectItem>
                      <SelectItem value="odd">单周</SelectItem>
                      <SelectItem value="even">双周</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  取消
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      添加中...
                    </>
                  ) : (
                    "确认添加"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!deleteSlot} onOpenChange={() => setDeleteSlot(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定删除{" "}
                  {deleteSlot && (
                    <>
                      {deleteSlot.course.courseTitle}（{deleteSlot.course.class.name}）
                      {DAY_LABELS[deleteSlot.dayOfWeek - 1]} 第{deleteSlot.slotIndex}节
                      （{deleteSlot.timeLabel}）
                    </>
                  )}
                  的课表时段？此操作不可恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      删除中...
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4 mr-1" />
                      确认删除
                    </>
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
