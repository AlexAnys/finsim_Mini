"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PersistedAiResult } from "@/lib/hooks/use-persisted-job";

export type AiResult = PersistedAiResult;
export type AiSection = AiResult["sections"][number];
export type ViewMode = "read" | "edit";

export interface ToolResultProps {
  result: AiResult;
  patchResult: (patch: Partial<AiResult>) => void;
  patchSection: (index: number, patch: Partial<AiSection>) => void;
  viewMode: ViewMode;
}

export function linesFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function fileStatusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "文本可用";
    case "ocr_required":
      return "需要 OCR";
    case "failed":
      return "识别失败";
    default:
      return status;
  }
}

// ============================================================================
// 阅读视图原子（read mode）
// ============================================================================

export function ReadHeading({
  level = 2,
  children,
}: {
  level?: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  const cls =
    level === 2
      ? "text-base font-semibold text-ink-2"
      : level === 3
        ? "text-sm font-semibold text-ink-2"
        : "text-xs font-semibold text-ink-3";
  const Tag = (`h${level}` as unknown) as keyof React.JSX.IntrinsicElements;
  return <Tag className={cls}>{children}</Tag>;
}

export function ReadParagraph({ text }: { text: string }) {
  if (!text) return <p className="text-sm text-ink-5 italic">（暂无）</p>;
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
      {text}
    </p>
  );
}

export function ReadBulletList({
  items,
  emptyText = "（暂无）",
}: {
  items: string[];
  emptyText?: string;
}) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-ink-5 italic">{emptyText}</p>;
  }
  return (
    <ul className="ml-5 list-disc space-y-1 text-sm leading-relaxed text-ink-2">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

// ============================================================================
// 编辑/阅读双模式原子
// ============================================================================

export function FileReportsBlock({ files }: { files: AiResult["fileReports"] }) {
  if (!files || files.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-paper-alt p-3">
      <div className="text-xs font-semibold text-ink-2">文件识别</div>
      <div className="mt-2 grid gap-1.5">
        {files.map((file) => (
          <div
            key={file.fileName}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="truncate text-ink-3">{file.fileName}</span>
            <span
              className={
                file.status === "ready"
                  ? "shrink-0 text-success"
                  : "shrink-0 text-warn"
              }
            >
              {fileStatusLabel(file.status)} · {file.textLength} 字
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TitleAndSummary({
  result,
  patchResult,
  viewMode,
  summaryRows = 4,
  summaryLabel = "总体判断",
}: {
  result: AiResult;
  patchResult: (patch: Partial<AiResult>) => void;
  viewMode: ViewMode;
  summaryRows?: number;
  summaryLabel?: string;
}) {
  if (viewMode === "read") {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">
          {result.title || "（未命名）"}
        </h2>
        <div className="space-y-1.5">
          <ReadHeading level={3}>{summaryLabel}</ReadHeading>
          <ReadParagraph text={result.summary} />
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="space-y-2">
        <Label>标题</Label>
        <Input
          value={result.title}
          onChange={(event) => patchResult({ title: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>{summaryLabel}</Label>
        <Textarea
          value={result.summary}
          onChange={(event) => patchResult({ summary: event.target.value })}
          rows={summaryRows}
        />
      </div>
    </>
  );
}

export interface SectionEditorLabels {
  heading: string;
  diagnosis: string;
  suggestions: string;
  examples: string;
}

const DEFAULT_LABELS: SectionEditorLabels = {
  heading: "分段标题",
  diagnosis: "诊断",
  suggestions: "建议（一行一条）",
  examples: "示例/表达（一行一条）",
};

export function SectionEditor({
  section,
  index,
  patchSection,
  viewMode,
  labels = DEFAULT_LABELS,
  examplesHighlight = false,
}: {
  section: AiSection;
  index: number;
  patchSection: (index: number, patch: Partial<AiSection>) => void;
  viewMode: ViewMode;
  labels?: SectionEditorLabels;
  examplesHighlight?: boolean;
}) {
  if (viewMode === "read") {
    return (
      <div className="rounded-lg border border-line bg-paper p-4 space-y-3">
        <ReadHeading level={3}>
          {section.heading || `${labels.heading}（未填）`}
        </ReadHeading>
        <div className="space-y-1.5">
          <ReadHeading level={4}>{stripTail(labels.diagnosis)}</ReadHeading>
          <ReadParagraph text={section.diagnosis} />
        </div>
        <div className="space-y-1.5">
          <ReadHeading level={4}>{stripTail(labels.suggestions)}</ReadHeading>
          <ReadBulletList items={section.suggestions} />
        </div>
        <div
          className={
            examplesHighlight
              ? "space-y-1.5 rounded-md border border-brand/30 bg-brand-soft/40 p-3"
              : "space-y-1.5"
          }
        >
          <ReadHeading level={4}>{stripTail(labels.examples)}</ReadHeading>
          <ReadBulletList items={section.examples} />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <div className="grid gap-3">
        <div className="space-y-2">
          <Label>{labels.heading}</Label>
          <Input
            value={section.heading}
            onChange={(event) =>
              patchSection(index, { heading: event.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>{labels.diagnosis}</Label>
          <Textarea
            value={section.diagnosis}
            onChange={(event) =>
              patchSection(index, { diagnosis: event.target.value })
            }
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>{labels.suggestions}</Label>
          <Textarea
            value={section.suggestions.join("\n")}
            onChange={(event) =>
              patchSection(index, {
                suggestions: linesFromText(event.target.value),
              })
            }
            rows={4}
          />
        </div>
        <div
          className={
            examplesHighlight
              ? "space-y-2 rounded-md border border-brand/30 bg-brand-soft/40 p-3"
              : "space-y-2"
          }
        >
          <Label>{labels.examples}</Label>
          <Textarea
            value={section.examples.join("\n")}
            onChange={(event) =>
              patchSection(index, {
                examples: linesFromText(event.target.value),
              })
            }
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}

function stripTail(label: string): string {
  // 把 "建议（一行一条）" 简化为 "建议"
  return label.replace(/（一行一条）/g, "").replace(/\(一行一条\)/g, "");
}

export function GradingTableBlock({
  rows,
}: {
  rows: AiResult["gradingTable"];
}) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-paper-alt text-left text-ink-4">
          <tr>
            <th className="px-3 py-2">学生</th>
            <th className="px-3 py-2">题号</th>
            <th className="px-3 py-2">得分</th>
            <th className="px-3 py-2">反馈</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-line">
              <td className="px-3 py-2">{row.student || "-"}</td>
              <td className="px-3 py-2">{row.question || "-"}</td>
              <td className="px-3 py-2">{row.score || "-"}</td>
              <td className="px-3 py-2">
                {row.feedback || row.uncertainty || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActionItemsAndCautions({
  result,
  patchResult,
  viewMode,
  actionLabel = "下一步动作（一行一条）",
  showActionItems = true,
}: {
  result: AiResult;
  patchResult: (patch: Partial<AiResult>) => void;
  viewMode: ViewMode;
  actionLabel?: string;
  showActionItems?: boolean;
}) {
  if (viewMode === "read") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {showActionItems && (
          <div className="space-y-1.5">
            <ReadHeading level={3}>{stripTail(actionLabel)}</ReadHeading>
            <ReadBulletList items={result.actionItems} />
          </div>
        )}
        <div className="space-y-1.5">
          <ReadHeading level={3}>需复核事项</ReadHeading>
          <ReadBulletList items={result.cautions} />
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {showActionItems && (
        <div className="space-y-2">
          <Label>{actionLabel}</Label>
          <Textarea
            value={result.actionItems.join("\n")}
            onChange={(event) =>
              patchResult({ actionItems: linesFromText(event.target.value) })
            }
            rows={5}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>需复核事项（一行一条）</Label>
        <Textarea
          value={result.cautions.join("\n")}
          onChange={(event) =>
            patchResult({ cautions: linesFromText(event.target.value) })
          }
          rows={5}
        />
      </div>
    </div>
  );
}
