"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { SimulationRunner } from "@/components/simulation/simulation-runner";

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
  const taskInstanceId = params.id as string;
  const isPreview = searchParams.get("preview") === "true";

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

        // If not simulation, redirect back to student task page
        if (data.task.taskType !== "simulation") {
          router.replace(`/tasks/${taskInstanceId}`);
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
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">加载模拟任务...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!instance) return null;

  const { task } = instance;
  const simConfig = task.simulationConfig;
  if (!simConfig) return null;

  return (
    <SimulationRunner
      taskName={task.taskName}
      evaluatorPersona={simConfig.evaluatorPersona || undefined}
      strictnessLevel={simConfig.strictnessLevel || "MODERATE"}
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
