"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  PersistedAiResult,
  PersistedJobState,
} from "@/lib/hooks/use-persisted-job";

export type AiResult = PersistedAiResult;
export type AiSection = AiResult["sections"][number];

export interface ToolResultProps {
  result: AiResult;
  patchResult: (patch: Partial<AiResult>) => void;
  patchSection: (index: number, patch: Partial<AiSection>) => void;
}

export interface ToolResultViewProps extends ToolResultProps {
  jobState: PersistedJobState;
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
  summaryRows = 4,
}: {
  result: AiResult;
  patchResult: (patch: Partial<AiResult>) => void;
  summaryRows?: number;
}) {
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
        <Label>总体判断</Label>
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
  labels = DEFAULT_LABELS,
  examplesHighlight = false,
}: {
  section: AiSection;
  index: number;
  patchSection: (index: number, patch: Partial<AiSection>) => void;
  labels?: SectionEditorLabels;
  examplesHighlight?: boolean;
}) {
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
  actionLabel = "下一步动作（一行一条）",
  showActionItems = true,
}: {
  result: AiResult;
  patchResult: (patch: Partial<AiResult>) => void;
  actionLabel?: string;
  showActionItems?: boolean;
}) {
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
