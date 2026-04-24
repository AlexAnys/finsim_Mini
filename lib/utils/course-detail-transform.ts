import type { ChapterStatus } from "@/components/course-detail/chapter-nav";
import type {
  SectionState,
  SectionTimelineSlot,
  SectionContentBlock,
  SectionTimelineTask,
} from "@/components/course-detail/section-timeline";
import type {
  ContentBlockRowKind,
} from "@/components/course-detail/content-block-row";
import type {
  TaskRowStatus,
  TaskRowType,
} from "@/components/course-detail/section-task-row";

const TASK_TYPES: readonly TaskRowType[] = ["simulation", "quiz", "subjective"];
const BLOCK_KINDS: readonly ContentBlockRowKind[] = [
  "markdown",
  "resource",
  "simulation_config",
  "quiz",
  "subjective",
  "custom",
];

export interface RawContentBlock {
  id: string;
  blockType: string;
  slot: string;
  order: number;
  data?: Record<string, unknown> | null;
}

export interface RawTaskInstance {
  id: string;
  title?: string | null;
  taskName?: string | null;
  taskType: string;
  status: string;
  dueAt: string;
  slot: string | null;
  attemptsAllowed?: number | null;
}

export interface RawSection {
  id: string;
  title: string;
  order: number;
  contentBlocks: RawContentBlock[];
  taskInstances: RawTaskInstance[];
}

export interface RawChapter {
  id: string;
  title: string;
  order: number;
  sections: RawSection[];
}

export interface DashboardTaskState {
  id: string;
  studentStatus: string;
  canSubmit: boolean;
  latestScore?: number | null;
  latestMaxScore?: number | null;
}

function normalizeBlockKind(raw: string): ContentBlockRowKind {
  return (BLOCK_KINDS as readonly string[]).includes(raw)
    ? (raw as ContentBlockRowKind)
    : "custom";
}

function normalizeTaskType(raw: string): TaskRowType {
  return (TASK_TYPES as readonly string[]).includes(raw)
    ? (raw as TaskRowType)
    : "subjective";
}

function normalizeSlot(raw: string | null | undefined): SectionTimelineSlot {
  if (raw === "pre" || raw === "in" || raw === "post") return raw;
  return "post";
}

export function formatDueLabel(
  dueAtIso: string,
  now: Date = new Date(),
): string {
  const due = new Date(dueAtIso);
  const msDiff = due.getTime() - now.getTime();
  if (msDiff < 0) return "已过期";
  const hoursDiff = msDiff / (1000 * 60 * 60);
  if (hoursDiff <= 24) {
    const sameDay = due.toDateString() === now.toDateString();
    const hh = String(due.getHours()).padStart(2, "0");
    const mm = String(due.getMinutes()).padStart(2, "0");
    return sameDay ? `今晚 ${hh}:${mm}` : `明天 ${hh}:${mm}`;
  }
  const daysDiff = Math.ceil(hoursDiff / 24);
  if (daysDiff <= 7) return `${daysDiff} 天后`;
  return due.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function transformSectionTasks(
  rawTasks: RawTaskInstance[],
  studentStateById: Map<string, DashboardTaskState>,
  now: Date = new Date(),
): SectionTimelineTask[] {
  const published = rawTasks.filter((t) => t.status === "published");
  return published.map((t) => {
    const state = studentStateById.get(t.id);
    const studentStatus = (state?.studentStatus ?? "todo") as TaskRowStatus;
    const score = state?.latestScore;
    const maxScore = state?.latestMaxScore;
    const scoreLabel =
      studentStatus === "graded" && score != null && maxScore != null
        ? `${score}/${maxScore}`
        : null;
    const dueLabel = studentStatus === "todo" ? formatDueLabel(t.dueAt, now) : null;

    return {
      id: t.id,
      type: normalizeTaskType(t.taskType),
      title: t.taskName ?? t.title ?? "未命名任务",
      status: studentStatus,
      dueLabel,
      scoreLabel,
      canSubmit: state?.canSubmit ?? false,
      slot: normalizeSlot(t.slot),
    };
  });
}

function blockTitle(b: RawContentBlock): string {
  const d = b.data ?? {};
  if (typeof d.title === "string" && d.title.trim()) return d.title.trim();
  if (typeof d.label === "string" && d.label.trim()) return d.label.trim();
  if (typeof d.name === "string" && d.name.trim()) return d.name.trim();
  const labels: Record<ContentBlockRowKind, string> = {
    markdown: "讲义",
    resource: "学习资源",
    simulation_config: "模拟配置",
    quiz: "测验题",
    subjective: "主观题",
    custom: "自定义内容",
  };
  return labels[normalizeBlockKind(b.blockType)];
}

function blockMeta(b: RawContentBlock): string | null {
  const d = b.data ?? {};
  if (typeof d.duration === "string") return d.duration;
  if (typeof d.duration === "number") return `${d.duration} 分钟`;
  if (typeof d.url === "string") return "链接";
  return null;
}

export function transformSectionBlocks(
  rawBlocks: RawContentBlock[],
): SectionContentBlock[] {
  return rawBlocks.map((b) => ({
    id: b.id,
    kind: normalizeBlockKind(b.blockType),
    slot: normalizeSlot(b.slot),
    title: blockTitle(b),
    meta: blockMeta(b),
  }));
}

export interface SectionAggregate {
  id: string;
  number: string;
  title: string;
  state: SectionState;
  taskCount: number;
  completedTaskCount: number;
  hasGraded: boolean;
  firstGradedScore: { score: number; maxScore: number } | null;
}

export function computeSectionState(
  chapterOrder: number,
  section: RawSection,
  studentStateById: Map<string, DashboardTaskState>,
  semesterStart: Date | null,
  now: Date = new Date(),
): SectionAggregate {
  const published = section.taskInstances.filter((t) => t.status === "published");
  const taskCount = published.length;
  const completedTaskCount = published.filter((t) => {
    const s = studentStateById.get(t.id)?.studentStatus;
    return s === "submitted" || s === "graded";
  }).length;

  const graded = published.flatMap((t) => {
    const st = studentStateById.get(t.id);
    if (
      st?.studentStatus === "graded" &&
      st.latestScore != null &&
      st.latestMaxScore != null
    ) {
      return [{ score: Number(st.latestScore), maxScore: Number(st.latestMaxScore) }];
    }
    return [];
  });
  const firstGradedScore = graded[0] ?? null;

  let state: SectionState;
  if (taskCount > 0 && completedTaskCount === taskCount) {
    state = "done";
  } else if (completedTaskCount > 0) {
    state = "active";
  } else {
    // Heuristic lock: any section belonging to a chapter far ahead with no ready tasks
    // — fall back to "upcoming" instead of "locked" unless every published task has
    //   a future dueAt beyond the current week.
    const anyUpcoming = published.some((t) => {
      const due = new Date(t.dueAt);
      return due.getTime() - now.getTime() > 0;
    });
    if (taskCount === 0) {
      state = semesterStart && now < semesterStart ? "locked" : "upcoming";
    } else if (anyUpcoming) {
      state = "upcoming";
    } else {
      state = "upcoming";
    }
  }

  return {
    id: section.id,
    number: `${chapterOrder + 1}.${section.order + 1}`,
    title: section.title,
    state,
    taskCount,
    completedTaskCount,
    hasGraded: graded.length > 0,
    firstGradedScore,
  };
}

export function computeSectionStatusLine(agg: SectionAggregate): string {
  if (agg.state === "locked") return "暂未解锁";
  if (agg.state === "done") {
    if (agg.firstGradedScore) {
      return `已完成 · 得分 ${agg.firstGradedScore.score}/${agg.firstGradedScore.maxScore}`;
    }
    return "已完成";
  }
  if (agg.state === "active") {
    const pending = agg.taskCount - agg.completedTaskCount;
    if (pending > 0) return `本节进行中 · ${pending} 项未完成`;
    return "本节进行中";
  }
  if (agg.taskCount === 0) return "暂无任务";
  return `${agg.taskCount} 项任务`;
}

export function computeChapterStatus(
  sections: SectionAggregate[],
): ChapterStatus {
  if (sections.length === 0) return "upcoming";
  if (sections.every((s) => s.state === "done")) return "done";
  if (sections.some((s) => s.state === "active" || s.state === "done")) {
    return "active";
  }
  return "upcoming";
}
