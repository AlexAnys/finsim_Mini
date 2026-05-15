"use client";

import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ActionItemsAndCautions,
  FileReportsBlock,
  GradingTableBlock,
  SectionEditor,
  type ToolResultProps,
} from "./result-atoms";

// examCheck: gradingTable 置顶 + 总评简要 + sections 默认折叠
export function ExamCheckResult({
  result,
  patchResult,
  patchSection,
}: ToolResultProps) {
  return (
    <div data-tool="examCheck" className="space-y-5">
      <div className="space-y-2">
        <Label>标题</Label>
        <Input
          value={result.title}
          onChange={(event) => patchResult({ title: event.target.value })}
        />
      </div>

      {/* gradingTable 置顶 */}
      {result.gradingTable.length > 0 ? (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-ink-3">逐题批改结果</div>
          <GradingTableBlock rows={result.gradingTable} />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-line bg-paper-alt px-3 py-4 text-center text-xs text-ink-4">
          AI 未输出逐题批改表，请检查输入是否包含答案 / 评分规则。
        </div>
      )}

      <div className="space-y-2">
        <Label>总评（简要）</Label>
        <Textarea
          value={result.summary}
          onChange={(event) => patchResult({ summary: event.target.value })}
          rows={3}
        />
      </div>

      <FileReportsBlock files={result.fileReports} />

      {/* sections 默认折起 */}
      {result.sections.length > 0 && (
        <details className="group rounded-lg border border-line bg-paper p-3">
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-ink-2">
            <span>逐题详细分析（共 {result.sections.length} 段）</span>
            <ChevronDown className="size-4 text-ink-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">
            {result.sections.map((section, index) => (
              <SectionEditor
                key={`${section.heading}-${index}`}
                section={section}
                index={index}
                patchSection={patchSection}
                labels={{
                  heading: "题号 / 概要",
                  diagnosis: "诊断",
                  suggestions: "改进建议（一行一条）",
                  examples: "典型答错示例（一行一条）",
                }}
              />
            ))}
          </div>
        </details>
      )}

      <ActionItemsAndCautions
        result={result}
        patchResult={patchResult}
        actionLabel="下一步操作（一行一条）"
      />
    </div>
  );
}
