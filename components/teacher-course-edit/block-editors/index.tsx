"use client";

import { MarkdownEditor } from "./markdown-editor";
import { LinkOrResourceEditor } from "./link-or-resource-editor";
import { TaskRefEditor } from "./task-ref-editor";
import { CustomEditor } from "./custom-editor";
import type { BlockEditorBlock, BlockEditorHandlers } from "./types";

interface Props {
  block: BlockEditorBlock;
  handlers: BlockEditorHandlers;
}

/**
 * Dispatches to the correct block editor based on blockType.
 * Schema enum values: markdown / resource / simulation_config / quiz / subjective / custom.
 * Unknown types fall back to CustomEditor (raw JSON).
 */
export function BlockEditorDispatch({ block, handlers }: Props) {
  switch (block.blockType) {
    case "markdown":
      return <MarkdownEditor block={block} handlers={handlers} />;
    case "resource":
      return <LinkOrResourceEditor block={block} handlers={handlers} variant="resource" />;
    // "link" is not in current enum, but mockup mentions it separately; resource + link share editor.
    case "link":
      return <LinkOrResourceEditor block={block} handlers={handlers} variant="link" />;
    case "simulation_config":
      return <TaskRefEditor block={block} handlers={handlers} variant="simulation" />;
    case "quiz":
      return <TaskRefEditor block={block} handlers={handlers} variant="quiz" />;
    case "subjective":
      return <TaskRefEditor block={block} handlers={handlers} variant="subjective" />;
    case "custom":
    default:
      return <CustomEditor block={block} handlers={handlers} />;
  }
}

export { MarkdownEditor, LinkOrResourceEditor, TaskRefEditor, CustomEditor };
export type { BlockEditorBlock, BlockEditorHandlers } from "./types";
