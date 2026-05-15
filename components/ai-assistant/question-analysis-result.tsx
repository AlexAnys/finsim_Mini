"use client";

import {
  ActionItemsAndCautions,
  FileReportsBlock,
  SectionEditor,
  TitleAndSummary,
  type ToolResultProps,
} from "./result-atoms";

// questionAnalysis: sections 字段重 label 为 题型/知识点/解题步骤/易错点
// 不显示 gradingTable
export function QuestionAnalysisResult({
  result,
  patchResult,
  patchSection,
}: ToolResultProps) {
  return (
    <div data-tool="questionAnalysis" className="space-y-5">
      <TitleAndSummary result={result} patchResult={patchResult} />
      <FileReportsBlock files={result.fileReports} />

      <div className="space-y-3">
        <div className="text-xs font-semibold text-ink-3">
          逐题结构化（每题：题型 / 知识点 / 解题步骤 / 易错点）
        </div>
        {result.sections.map((section, index) => (
          <SectionEditor
            key={`${section.heading}-${index}`}
            section={section}
            index={index}
            patchSection={patchSection}
            labels={{
              heading: "题目摘要 / 题型",
              diagnosis: "知识点定位",
              suggestions: "解题步骤（一行一条）",
              examples: "易错点 / 提示（一行一条）",
            }}
          />
        ))}
      </div>

      {/* 不显示 gradingTable */}
      <ActionItemsAndCautions
        result={result}
        patchResult={patchResult}
        actionLabel="给学生的复盘建议（一行一条）"
      />
    </div>
  );
}
