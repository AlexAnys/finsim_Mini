"use client";

import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComingSoon } from "@/components/analytics-v2/coming-soon";

export function TeachingAdviceBlock() {
  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-brand" />
          AI 教学建议
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ComingSoon
          icon={Lightbulb}
          title="AI 教学建议 · 即将推出"
          description="下一阶段将基于上述统计 + 风险信号生成 4 类教学建议（知识目标 / 教学方式 / 关注群体 / 接下来怎么教），每条带依据。"
        />
      </CardContent>
    </Card>
  );
}
