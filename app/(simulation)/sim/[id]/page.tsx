"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { SimulationRunner } from "@/components/simulation/simulation-runner";
import { NotFoundState, ForbiddenState } from "@/components/states";

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
      systemPrompt: string | null;
    } | null;
    scoringCriteria: ScoringCriterion[];
    allocationSections: AllocationSection[];
  };
  class: {
    id: string;
    name: string;
  };
}

export default function SimulationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const taskInstanceId = params.id as string;
  const isPreview = searchParams.get("preview") === "true";
  const userId = session?.user?.id;

  const [instance, setInstance] = useState<TaskInstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string | null; message: string } | null>(null);

  useEffect(() => {
    async function fetchTask() {
      try {
        const res = await fetch(`/api/lms/task-instances/${taskInstanceId}`);
        const json = await res.json();
        if (!json.success) {
          setError({
            code: json.error?.code ?? null,
            message: json.error?.message || "加载失败",
          });
          return;
        }

        const data = json.data as TaskInstanceDetail;

        // If not simulation, redirect back to student task page
        if (data.task.taskType !== "simulation") {
          router.replace(`/tasks/${taskInstanceId}`);
          return;
        }

        setInstance(data);
      } catch {
        setError({ code: "NETWORK_ERROR", message: "网络错误，请稍后重试" });
      } finally {
        setLoading(false);
      }
    }
    fetchTask();
  }, [taskInstanceId, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载模拟任务...</span>
      </div>
    );
  }

  // 模拟全屏页无 sidebar，出错时必须给用户中文返回 CTA，否则陷入死路。
  if (error) {
    if (error.code === "FORBIDDEN") {
      return (
        <ForbiddenState
          title="你还不能进入这个模拟"
          description={error.message || "这个模拟任务可能不属于你所在的班级。"}
          primaryAction={{ label: "退出模拟，返回作业列表", href: "/dashboard" }}
          secondaryAction={{ label: "查看课程", href: "/courses" }}
          fullPage
        />
      );
    }
    return (
      <NotFoundState
        title="模拟任务不存在"
        description={error.message || "你访问的模拟任务不存在或已被删除。"}
        primaryAction={{ label: "退出模拟，返回作业列表", href: "/dashboard" }}
        secondaryAction={{ label: "查看课程", href: "/courses" }}
        fullPage
      />
    );
  }

  if (!instance) return null;
  // 等待 session 解析完成才挂 runner — runner 的 localStorage draft key 必须含 userId
  // 才能避免同浏览器多账号串数据（详见 runner 内 buildDraftKey 注释）。
  if (!userId) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">正在加载用户...</span>
      </div>
    );
  }

  const { task } = instance;
  const simConfig = task.simulationConfig;
  if (!simConfig) return null;

  return (
    <SimulationRunner
      taskName={task.taskName}
      userId={userId}
      evaluatorPersona={simConfig.evaluatorPersona || undefined}
      strictnessLevel={simConfig.strictnessLevel || "MODERATE"}
      systemPrompt={simConfig.systemPrompt || undefined}
      isPreview={isPreview}
      taskId={task.id}
      taskInstanceId={instance.id}
      taskConfig={{
        scenario: simConfig.scenario,
        openingLine: simConfig.openingLine,
        scoringCriteria: task.scoringCriteria.map((c) => ({
          id: c.id,
          label: c.name,
          maxScore: c.maxPoints,
          description: c.description,
        })),
        allocationSections: task.allocationSections.map((s) => ({
          label: s.label,
          items: s.items.map((item) => ({
            label: item.label,
            defaultValue: 0,
          })),
        })),
        requirements: task.requirements
          ? task.requirements.split("\n").filter(Boolean)
          : undefined,
      }}
    />
  );
}
