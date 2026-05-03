"use client";

import { MessageCircleQuestionMark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComingSoon } from "@/components/analytics-v2/coming-soon";

export function StudyBuddyBlock() {
  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircleQuestionMark className="size-4 text-brand" />
          Study Buddy 共性问题
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ComingSoon
          icon={MessageCircleQuestionMark}
          title="Study Buddy · 即将推出"
          description="下一阶段将按节聚合学生在学习过程中提出的共性问题（top-5 排序 + 提问学生列表）。"
        />
      </CardContent>
    </Card>
  );
}
