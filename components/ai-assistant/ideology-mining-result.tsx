"use client";

import { Lightbulb } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileReportsBlock,
  SectionEditor,
  TitleAndSummary,
  linesFromText,
  type ToolResultProps,
} from "./result-atoms";

// ideologyMining: 育人目标 callout（actionItems）+ sections（examples 高亮为「案例表达」）
// 不显示 gradingTable
export function IdeologyMiningResult({
  result,
  patchResult,
  patchSection,
}: ToolResultProps) {
  return (
    <div data-tool="ideologyMining" className="space-y-5">
      <TitleAndSummary result={result} patchResult={patchResult} />

      <div className="rounded-lg border border-brand/40 bg-brand-soft/50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand">
          <Lightbulb className="size-4" />
          育人目标（一行一条）
        </div>
        <Textarea
          value={result.actionItems.join("\n")}
          onChange={(event) =>
            patchResult({ actionItems: linesFromText(event.target.value) })
          }
          rows={4}
          placeholder="例如：引导学生在风险评估中保持理性与审慎；强调诚信与合规的边界。"
        />
        <p className="mt-1 text-[11px] text-ink-5">
          来自 AI 提取，可手动微调；复制时会包含此条。
        </p>
      </div>

      <FileReportsBlock files={result.fileReports} />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-ink-3">
          融合点（案例表达高亮，便于直接放入课堂）
        </div>
        {result.sections.map((section, index) => (
          <SectionEditor
            key={`${section.heading}-${index}`}
            section={section}
            index={index}
            patchSection={patchSection}
            labels={{
              heading: "融合点",
              diagnosis: "切入说明",
              suggestions: "引导话术（一行一条）",
              examples: "案例表达（一行一条）",
            }}
            examplesHighlight
          />
        ))}
      </div>

      <div className="space-y-2">
        <Label>需复核事项（一行一条）</Label>
        <Textarea
          value={result.cautions.join("\n")}
          onChange={(event) =>
            patchResult({ cautions: linesFromText(event.target.value) })
          }
          rows={5}
          placeholder="例如：避免生硬口号；某段案例数据需核实。"
        />
      </div>
    </div>
  );
}
