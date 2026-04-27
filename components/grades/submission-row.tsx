"use client";

// PR-STU-1 · 学生 /grades 提交记录列表项
// - 单行：左 type chip + 课程 tag + 实例标题 + 提交时间；中 分数；右 trend chip + chevron
// - 选中态：bg-paper-alt + 左 3px 深靛条 + 减少 paddingLeft 视觉对齐
// - D1 防作弊三态：
//     pending          → "等待 AI 分析"
//     analyzed_unreleased → "已分析 · 等待教师公布"
//     released         → 显示真实分数 + trend
// - 课程 tag 色：courseId 不存在则用 taskInstanceId hash（保持可视稳定）

import { ChevronRight, Clock3, FileText, HelpCircle, MessageSquare } from "lucide-react";
import type { GradeRow, GradesTaskType } from "@/lib/utils/grades-transforms";
import { computePercent, scoreTone } from "@/lib/utils/grades-transforms";
import { courseColorForId } from "@/lib/design/tokens";

interface SubmissionRowProps {
  row: GradeRow;
  selected: boolean;
  onSelect: (rowId: string) => void;
  trendDelta: number | null;
}

const TYPE_TONE: Record<
  GradesTaskType,
  { label: string; chip: string; icon: React.ComponentType<{ className?: string }> }
> = {
  simulation: {
    label: "模拟",
    chip: "bg-sim-soft text-sim border-sim/20",
    icon: MessageSquare,
  },
  quiz: {
    label: "测验",
    chip: "bg-quiz-soft text-quiz border-quiz/20",
    icon: HelpCircle,
  },
  subjective: {
    label: "主观",
    chip: "bg-subj-soft text-subj border-subj/20",
    icon: FileText,
  },
};

const TAG_CLASS_MAP: Record<string, string> = {
  tagA: "bg-tag-a text-tag-a-fg",
  tagB: "bg-tag-b text-tag-b-fg",
  tagC: "bg-tag-c text-tag-c-fg",
  tagD: "bg-tag-d text-tag-d-fg",
  tagE: "bg-tag-e text-tag-e-fg",
  tagF: "bg-tag-f text-tag-f-fg",
};

const SCORE_TONE_CLASS = {
  success: "text-success",
  primary: "text-brand",
  warn: "text-warn",
  danger: "text-danger",
  muted: "text-ink-5",
} as const;

function formatSubmittedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day} ${hh}:${mm}`;
}

export function SubmissionRow({ row, selected, onSelect, trendDelta }: SubmissionRowProps) {
  const taskType = (row.taskType as GradesTaskType) in TYPE_TONE
    ? (row.taskType as GradesTaskType)
    : "simulation";
  const tone = TYPE_TONE[taskType];
  const TypeIcon = tone.icon;

  // 课程 tag 色：courseId 不存在时退化用 taskInstanceId 保稳定
  const courseSeed = row.courseId ?? row.taskInstanceId;
  const courseTagKey = courseColorForId(courseSeed);
  const tagClass = TAG_CLASS_MAP[courseTagKey] ?? TAG_CLASS_MAP.tagA;

  const isReleased = row.analysisStatus === "released" && row.score !== null;
  const percent = computePercent(row.score, row.maxScore);
  const toneKey = scoreTone(percent);
  const scoreColor = SCORE_TONE_CLASS[toneKey];

  // trend chip：仅当 released 且有上一次同类型对比
  const showTrend = isReleased && trendDelta != null && trendDelta !== 0;
  const trendUp = (trendDelta ?? 0) > 0;
  const trendLabel = trendDelta == null
    ? null
    : `${trendDelta > 0 ? "+" : ""}${trendDelta}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(row.id)}
      aria-pressed={selected}
      className={`grid w-full grid-cols-[1fr_70px_90px] items-center gap-3 border-b border-line-2 py-3.5 text-left transition-colors hover:bg-paper-alt/60 ${
        selected
          ? "border-l-[3px] border-l-brand bg-paper-alt pl-[15px] pr-[18px]"
          : "border-l-[3px] border-l-transparent px-[18px]"
      }`}
    >
      {/* 左：chip + course + title + 时间 */}
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${tone.chip}`}
          >
            <TypeIcon className="size-3" aria-hidden="true" />
            {tone.label}
          </span>
          {row.courseName && (
            <span
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[10.5px] font-medium ${tagClass}`}
            >
              {row.courseName}
            </span>
          )}
        </div>
        <div className="truncate text-[13.5px] font-medium text-ink">
          {row.instanceTitle || row.taskName || "未命名任务"}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-5">
          <Clock3 className="size-3" aria-hidden="true" />
          {formatSubmittedAt(row.submittedAt)}
        </div>
      </div>

      {/* 中：分数 / 状态 chip */}
      <div className="text-right">
        {isReleased ? (
          <>
            <div
              className={`font-mono text-xl font-bold leading-none tracking-tight ${scoreColor}`}
            >
              {row.score}
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-5">
              / {row.maxScore}
            </div>
          </>
        ) : row.analysisStatus === "analyzed_unreleased" ? (
          <span className="inline-block rounded-md border border-ochre/20 bg-ochre/10 px-2 py-0.5 text-[10.5px] font-medium text-ochre">
            已分析 · 等待教师公布
          </span>
        ) : (
          <span className="inline-block rounded-md border border-line bg-paper-alt px-2 py-0.5 text-[10.5px] font-medium text-ink-4">
            等待 AI 分析
          </span>
        )}
      </div>

      {/* 右：trend + chevron */}
      <div className="flex items-center justify-end gap-1.5">
        {showTrend && trendLabel && (
          <span
            className={`font-mono text-[11.5px] font-semibold ${trendUp ? "text-success" : "text-danger"}`}
          >
            {trendLabel}
          </span>
        )}
        <ChevronRight className="size-3.5 text-ink-5" aria-hidden="true" />
      </div>
    </button>
  );
}
