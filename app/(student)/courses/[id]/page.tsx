"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronRight,
  Clock,
  FileText,
  MessageSquare,
  HelpCircle,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface TaskInstance {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  slot: string | null;
  attemptsAllowed: number | null;
  createdAt: string;
}

interface ContentBlock {
  id: string;
  blockType: string;
  slot: string;
  order: number;
}

interface Section {
  id: string;
  title: string;
  order: number;
  contentBlocks: ContentBlock[];
  taskInstances: TaskInstance[];
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  sections: Section[];
}

interface CourseClassItem {
  id: string;
  classId: string;
  class: { id: string; name: string };
}

interface CourseDetail {
  id: string;
  courseTitle: string;
  courseCode: string | null;
  description: string | null;
  class: { id: string; name: string };
  classes?: CourseClassItem[];
  chapters: Chapter[];
}

const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const slotLabels: Record<string, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "草稿", variant: "outline" },
  published: { label: "已发布", variant: "default" },
  closed: { label: "已关闭", variant: "secondary" },
  archived: { label: "已归档", variant: "secondary" },
};

export default function StudentCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const res = await fetch(`/api/lms/courses/${courseId}`);
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || "加载失败");
          return;
        }
        setCourse(json.data);
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

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

  if (!course) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/courses" className="hover:text-foreground">
          我的课程
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">{course.courseTitle}</span>
      </div>

      {/* Course Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          <BookOpen className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{course.courseTitle}</h1>
          {course.courseCode && (
            <p className="text-sm text-muted-foreground">{course.courseCode}</p>
          )}
          {course.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {course.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {course.classes && course.classes.length > 0 ? (
              course.classes.map((cc) => (
                <Badge key={cc.id} variant="secondary">
                  {cc.class.name}
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">
                {course.class.name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Chapters & Sections */}
      {course.chapters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="size-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">暂无课程内容</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {course.chapters.map((chapter) => (
            <Card key={chapter.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  第 {chapter.order + 1} 章：{chapter.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {chapter.sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无小节</p>
                ) : (
                  chapter.sections.map((section) => (
                    <div
                      key={section.id}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <h3 className="font-medium">
                        {chapter.order + 1}.{section.order + 1} {section.title}
                      </h3>

                      {/* Task instances under this section */}
                      {section.taskInstances.filter((ti) => ti.status === "published").length === 0 ? (
                        <p className="text-xs text-muted-foreground">暂无任务</p>
                      ) : (
                        <div className="space-y-2">
                          {section.taskInstances
                            .filter((ti) => ti.status === "published")
                            .map((ti) => {
                              const Icon = taskTypeIcons[ti.taskType] || FileText;
                              const sCfg = statusConfig[ti.status] || statusConfig.published;
                              const isOverdue = new Date() > new Date(ti.dueAt);

                              return (
                                <div
                                  key={ti.id}
                                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <Icon className="size-4 text-muted-foreground" />
                                    <div>
                                      <p className="text-sm font-medium">
                                        {ti.title}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs">
                                          {taskTypeLabels[ti.taskType] || ti.taskType}
                                        </Badge>
                                        {ti.slot && (
                                          <Badge variant="secondary" className="text-xs">
                                            {slotLabels[ti.slot] || ti.slot}
                                          </Badge>
                                        )}
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Clock className="size-3" />
                                          截止: {new Date(ti.dueAt).toLocaleDateString("zh-CN")}
                                        </span>
                                        {isOverdue && (
                                          <Badge variant="destructive" className="text-xs">
                                            已过期
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={sCfg.variant}>{sCfg.label}</Badge>
                                    {!isOverdue && (
                                      <Button size="sm" asChild>
                                        <Link href={`/tasks/${ti.id}`}>
                                          <Play className="size-3 mr-1" />
                                          开始
                                        </Link>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
