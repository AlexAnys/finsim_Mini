"use client";

import {
  ActionItemsAndCautions,
  FileReportsBlock,
  GradingTableBlock,
  SectionEditor,
  TitleAndSummary,
  type ToolResultProps,
} from "./result-atoms";

export function LessonPolishResult({
  result,
  patchResult,
  patchSection,
}: ToolResultProps) {
  return (
    <div data-tool="lessonPolish" className="space-y-5">
      <TitleAndSummary result={result} patchResult={patchResult} />
      <FileReportsBlock files={result.fileReports} />
      <div className="space-y-3">
        {result.sections.map((section, index) => (
          <SectionEditor
            key={`${section.heading}-${index}`}
            section={section}
            index={index}
            patchSection={patchSection}
          />
        ))}
      </div>
      <GradingTableBlock rows={result.gradingTable} />
      <ActionItemsAndCautions result={result} patchResult={patchResult} />
    </div>
  );
}
