"use client";

import {
  ActionItemsAndCautions,
  FileReportsBlock,
  SectionEditor,
  TitleAndSummary,
  type ToolResultProps,
} from "./result-atoms";

export function LessonPolishResult({
  result,
  patchResult,
  patchSection,
  viewMode,
}: ToolResultProps) {
  return (
    <div data-tool="lessonPolish" className="space-y-5">
      <TitleAndSummary
        result={result}
        patchResult={patchResult}
        viewMode={viewMode}
      />
      <FileReportsBlock files={result.fileReports} />
      <div className="space-y-3">
        {result.sections.map((section, index) => (
          <SectionEditor
            key={`${section.heading}-${index}`}
            section={section}
            index={index}
            patchSection={patchSection}
            viewMode={viewMode}
          />
        ))}
      </div>
      <ActionItemsAndCautions
        result={result}
        patchResult={patchResult}
        viewMode={viewMode}
      />
    </div>
  );
}
