"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StudyBuddyAnalyticsTabProps {
  courseId: string;
}

interface StudyBuddyGroup {
  chapterTitle: string;
  sectionTitle: string;
  taskTitle: string;
  taskType: string;
  questionCount: number;
  pendingCount: number;
  students: Array<{ id: string; name: string; count: number }>;
  examples: string[];
}

interface StudyBuddyAnalyticsData {
  totalQuestions: number;
  pendingQuestions: number;
  activeStudents: number;
  groups: StudyBuddyGroup[];
  aiSummary: {
    keyQuestions: string[];
    knowledgeGaps: string[];
    teachingSuggestions: string[];
  } | null;
  aiError: string | null;
}

export function CourseStudyBuddyAnalyticsTab({ courseId }: StudyBuddyAnalyticsTabProps) {
  const [data, setData] = useState<StudyBuddyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);

  const load = useCallback(async (summarize = false) => {
    if (summarize) setSummarizing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/lms/study-buddy/analytics?courseId=${courseId}${summarize ? "&summarize=true" : ""}`);
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message || "加载 Study Buddy 统计失败");
        return;
      }
      setData(json.data);
      if (summarize && json.data.aiError) {
        toast.error(`AI 总结失败：${json.data.aiError}`);
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
      setSummarizing(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        加载 Study Buddy 统计...
      </div>
    );
  }

  if (!data || data.totalQuestions === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Bot className="mb-3 size-8 text-muted-foreground" />
          <h3 className="text-base font-semibold">暂无学生提问</h3>
          <p className="mt-1 text-sm text-muted-foreground">学生在学习伙伴中提问后，这里会按章节和任务汇总。</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="学生提问" value={data.totalQuestions} />
        <Metric label="未完成回复" value={data.pendingQuestions} />
        <Metric label="参与学生" value={data.activeStudents} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">AI 问题总结</CardTitle>
          <Button size="sm" onClick={() => load(true)} disabled={summarizing}>
            {summarizing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            生成总结
          </Button>
        </CardHeader>
        <CardContent>
          {data.aiSummary ? (
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryBlock title="主要问题" items={data.aiSummary.keyQuestions} />
              <SummaryBlock title="知识盲区" items={data.aiSummary.knowledgeGaps} />
              <SummaryBlock title="补讲建议" items={data.aiSummary.teachingSuggestions} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">先展示确定性统计；需要时可生成 AI 聚类总结。</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {data.groups.map((group, index) => (
          <Card key={`${group.taskTitle}-${index}`}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{group.taskType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {group.chapterTitle} / {group.sectionTitle}
                    </span>
                  </div>
                  <h4 className="mt-1 truncate text-sm font-semibold">{group.taskTitle}</h4>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span>{group.questionCount} 问</span>
                  {group.pendingCount > 0 && <Badge variant="secondary">{group.pendingCount} 未回复</Badge>}
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Users className="size-3" />
                    {group.students.length}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="space-y-1">
                  {group.examples.slice(0, 3).map((question, i) => (
                    <p key={i} className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                      {question}
                    </p>
                  ))}
                </div>
                <div className="space-y-1">
                  {group.students.slice(0, 4).map((student) => (
                    <div key={student.id} className="flex justify-between rounded-md border px-2 py-1 text-xs">
                      <span className="truncate">{student.name}</span>
                      <span>{student.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function SummaryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无</p>
      ) : (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={index}>{index + 1}. {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
