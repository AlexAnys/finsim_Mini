"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, CalendarDays, Pencil } from "lucide-react";
import { getCurrentWeekNumber } from "@/lib/utils/schedule-dates";

export interface SemesterHeaderCourse {
  id: string;
  courseTitle: string;
  semesterStartDate: string | null;
}

interface SemesterHeaderProps {
  courses: SemesterHeaderCourse[];
  /** 老师可编辑学期；学生只读。 */
  canEdit: boolean;
  /** 批量保存成功后回调（通常触发页面重取数据）。 */
  onUpdated?: () => void;
}

function earliestSemesterStart(courses: SemesterHeaderCourse[]): Date | null {
  let earliest: Date | null = null;
  for (const c of courses) {
    if (!c.semesterStartDate) continue;
    const d = new Date(c.semesterStartDate);
    if (!earliest || d.getTime() < earliest.getTime()) earliest = d;
  }
  return earliest;
}

export function SemesterHeader({ courses, canEdit, onUpdated }: SemesterHeaderProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dateValue, setDateValue] = useState("");
  const [saving, setSaving] = useState(false);

  const earliest = useMemo(() => earliestSemesterStart(courses), [courses]);
  const currentWeek = earliest ? getCurrentWeekNumber(earliest) : 0;

  function openDialog() {
    // Default: select all courses, use earliest existing date (if any)
    setSelectedIds(new Set(courses.map((c) => c.id)));
    setDateValue(earliest ? earliest.toISOString().slice(0, 10) : "");
    setOpen(true);
  }

  function toggleCourse(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error("请至少选择一门课程");
      return;
    }
    if (!dateValue) {
      toast.error("请选择学期开始日期");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/lms/courses/batch-semester", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseIds: ids,
          semesterStartDate: new Date(dateValue).toISOString(),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "保存失败");
        return;
      }
      toast.success(`已更新 ${json.data?.updatedCount ?? ids.length} 门课程`);
      setOpen(false);
      onUpdated?.();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  const noSemesterSet = !earliest;

  return (
    <>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <CalendarDays className="size-4 text-muted-foreground shrink-0" />
        {noSemesterSet ? (
          <span className="text-muted-foreground">
            请先设置学期开始日期
          </span>
        ) : (
          <span>
            <span className="font-medium">第 {currentWeek || 1} 周</span>
            <span className="text-muted-foreground">
              {" · "}学期从 {earliest!.toLocaleDateString("zh-CN")} 开始
            </span>
          </span>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-xs"
            onClick={openDialog}
            disabled={courses.length === 0}
          >
            <Pencil className="size-3 mr-1" />
            {noSemesterSet ? "设置" : "编辑"}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量设置学期开始日期</DialogTitle>
            <DialogDescription>
              选中的课程将同步更新学期开始日期。系统按该日期计算教学周。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>学期开始日期</Label>
              <Input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>应用到以下课程</Label>
              <div className="max-h-60 overflow-y-auto rounded-md border divide-y">
                {courses.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.has(c.id)}
                      onCheckedChange={() => toggleCourse(c.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.courseTitle}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.semesterStartDate
                          ? `当前：${new Date(c.semesterStartDate).toLocaleDateString("zh-CN")}`
                          : "当前：未设置"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
