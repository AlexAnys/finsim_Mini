import type { BlockType, SlotType } from "@/lib/utils/course-editor-transforms";

export interface BlockEditorBlock {
  id: string;
  blockType: BlockType | string;
  slot: SlotType | string;
  order: number;
  data: Record<string, unknown> | null;
}

export interface BlockEditorContext {
  courseId: string;
  chapterId: string;
  sectionId: string;
  block: BlockEditorBlock;
}

export interface BlockEditorHandlers {
  onSave: (blockId: string, payload: Record<string, unknown>) => Promise<void>;
  onDelete: (blockId: string) => Promise<void>;
}

export type BlockTypeDataShape = {
  markdown: { content: string };
  resource: { url: string; title: string; description?: string };
  link: { url: string; title: string; description?: string };
  simulation_config: { taskId?: string; note?: string };
  quiz: { taskId?: string; note?: string };
  subjective: { taskId?: string; note?: string };
  custom: Record<string, unknown>;
};
