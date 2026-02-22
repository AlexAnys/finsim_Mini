"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  ChevronRight,
  MessageSquare,
  HelpCircle,
  FileText,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QuizRunner } from "@/components/quiz/quiz-runner";
import { SubjectiveRunner } from "@/components/subjective/subjective-runner";

interface ScoringCriterion {
  id: string;
  name: string;
  maxPoints: number;
  description?: string;
  order: number;
}

interface AllocationSection {
  id: string;
  label: string;
  items: Array<{ id: string; label: string; order: number }>;
}

interface QuizQuestion {
  id: string;
  type: string;
  prompt: string;
  options: Array<{ label: string; content: string }> | null;
  points: number;
  explanation: string | null;
  order: number;
}

interface TaskInstanceDetail {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  slot: string | null;
  attemptsAllowed: number | null;
  taskSnapshot: unknown;
  task: {
    id: string;
    taskName: string;
    taskType: string;
    requirements: string | null;
    simulationConfig: {
      scenario: string;
      openingLine: string;
      evaluatorPersona: string | null;
      strictnessLevel: string;
      studyBuddyContext: string | null;
    } | null;
    quizConfig: {
      timeLimitMinutes: number | null;
      mode: string;
      showCorrectAnswer: boolean;
      maxQuestions: number | null;
    } | null;
    subjectiveConfig: {
      prompt: string;
      allowTextAnswer: boolean;
      allowedAttachmentTypes: string[];
      evaluatorPersona: string | null;
      strictnessLevel: string;
      referenceAnswer: string | null;
    } | null;
    scoringCriteria: ScoringCriterion[];
    allocationSections: AllocationSection[];
    quizQuestions: QuizQuestion[];
  };
  class: {
    id: string;
    name: string;
  };
}

const taskTypeLabels: Record<string, string> = {
  simulation: "模拟对话",
  quiz: "测验",
  subjective: "主观题",
};

const taskTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  simulation: MessageSquare,
  quiz: HelpCircle,
  subjective: FileText,
};

function renderRunner(instance: TaskInstanceDetail) {
  const { task } = instance;

  // Simulation tasks are handled by the full-page /sim/[id] route
  // The redirect happens in the useEffect below
  if (task.taskType === "simulation") {
    return null;
  }

  if (task.taskType === "quiz" && task.quizConfig) {
    return (
      <QuizRunner
        taskId={task.id}
        taskInstanceId={instance.id}
        taskConfig={{
          timeLimit: task.quizConfig.timeLimitMinutes,
          mode: task.quizConfig.mode === "adaptive" ? "practice" : "exam",
          shuffleQuestions: false,
          showResult: task.quizConfig.showCorrectAnswer,
          questions: task.quizQuestions
            .sort((a, b) => a.order - b.order)
            .map((q) => ({
              id: q.id,
              type: q.type as "single_choice" | "multiple_choice" | "true_false" | "short_answer",
              stem: q.prompt,
              options: q.options,
              points: q.points,
              explanation: q.explanation,
            })),
        }}
      />
    );
  }

  if (task.taskType === "subjective" && task.subjectiveConfig) {
    return (
      <SubjectiveRunner
        taskId={task.id}
        taskInstanceId={instance.id}
        taskConfig={{
          prompt: task.subjectiveConfig.prompt,
          wordLimit: null,
          allowAttachment: task.subjectiveConfig.allowedAttachmentTypes.length > 0,
          maxAttachments: 5,
          scoringCriteria: task.scoringCriteria.map((c) => ({
            id: c.id,
            label: c.name,
            maxScore: c.maxPoints,
            description: c.description,
          })),
          requirements: task.requirements
            ? task.requirements.split("\n").filter(Boolean)
            : undefined,
          rubricVisible: true,
        }}
      />
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <AlertCircle className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">任务配置异常，请联系教师</p>
      </CardContent>
    </Card>
  );
}

export default function StudentTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskInstanceId = params.id as string;

  const [instance, setInstance] = useState<TaskInstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(`/api/lms/task-instances/${taskInstanceId}`);
        const json = await res.json();
        if (!json.success) {
          setError(json.error?.message || "加载失败");
          return;
        }

        const data = json.data as TaskInstanceDetail;

        // Redirect simulation tasks to full-page experience
        if (data.task.taskType === "simulation") {
          router.replace(`/sim/${data.id}`);
          return;
        }

        setInstance(data);
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
    }
    fetchTask();
  }, [taskInstanceId, router]);

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

  if (!instance) return null;

  const Icon = taskTypeIcons[instance.task.taskType] || FileText;
  const isOverdue = new Date() > new Date(instance.dueAt);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">
          仪表盘
        </Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground">{instance.title || instance.task.taskName}</span>
      </div>

      {/* Task Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Icon className="size-6" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">
                {instance.title || instance.task.taskName}
              </CardTitle>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">
                  {taskTypeLabels[instance.task.taskType] || instance.task.taskType}
                </Badge>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="size-3" />
                  截止: {new Date(instance.dueAt).toLocaleString("zh-CN")}
                </span>
                {isOverdue && (
                  <Badge variant="destructive">已过期</Badge>
                )}
                {instance.attemptsAllowed && (
                  <span className="text-sm text-muted-foreground">
                    最多 {instance.attemptsAllowed} 次提交
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        {instance.description && (
          <>
            <Separator />
            <CardContent>
              <p className="text-sm text-muted-foreground">{instance.description}</p>
            </CardContent>
          </>
        )}
      </Card>

      {/* Runner */}
      {renderRunner(instance)}
    </div>
  );
}
