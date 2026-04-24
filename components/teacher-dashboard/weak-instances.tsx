"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { courseColorForId, tagColors } from "@/lib/design/tokens";
import type { WeakInstance } from "@/lib/utils/teacher-dashboard-transforms";

interface WeakInstancesProps {
  items: WeakInstance[];
}

export function WeakInstances({ items }: WeakInstancesProps) {
  return (
    <section>
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-2">待分析实例</h2>
        <span className="text-xs text-ink-4">按错误率排序 · 前 3</span>
      </header>
      {items.length === 0 ? (
        <Card className="py-6">
          <p className="text-center text-sm text-ink-4">
            暂无低分实例，等待更多批改数据
          </p>
        </Card>
      ) : (
        <Card className="py-0 gap-0 overflow-hidden">
          {items.map((w, i) => {
            const tc = tagColors[courseColorForId(w.courseId ?? "")];
            return (
              <div
                key={w.id}
                className={cn(
                  "flex items-center gap-3.5 px-4 py-3.5",
                  i < items.length - 1 && "border-b border-line-2",
                )}
              >
                <div
                  aria-hidden="true"
                  className="w-[3px] self-stretch rounded-sm bg-danger"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-ink-2">
                    {w.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-ink-4">
                    <span
                      className="font-medium"
                      style={{ color: tc.fg }}
                    >
                      {w.courseTitle || "未关联课程"}
                    </span>
                    <span className="mx-1.5 text-ink-5">·</span>
                    {w.wrongStudentCount} 名学生错答
                  </div>
                </div>
                <div className="fs-num w-[50px] text-right text-[13px] font-semibold text-danger">
                  {w.errorRate}%
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={w.href}>
                    <Sparkles className="size-[11px]" />
                    查看洞察
                  </Link>
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
