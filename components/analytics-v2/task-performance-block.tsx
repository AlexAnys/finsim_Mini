"use client";

import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComingSoon } from "@/components/analytics-v2/coming-soon";

export function TaskPerformanceBlock() {
  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-brand" />
          任务表现典型例子
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ComingSoon
          icon={Sparkles}
          title="任务表现 · 即将推出"
          description="下一阶段将基于学生真实回答抽取高分典型 3-4 例 + 低分常见问题 + 证据抽屉。"
        />
      </CardContent>
    </Card>
  );
}
