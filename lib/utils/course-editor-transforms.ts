// Pure data transforms for the teacher /courses/[id] editor.

export type SlotType = "pre" | "in" | "post";
export type BlockType =
  | "markdown"
  | "resource"
  | "simulation_config"
  | "quiz"
  | "subjective"
  | "custom";

export const SLOT_LABEL: Record<SlotType, string> = {
  pre: "课前",
  in: "课中",
  post: "课后",
};

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  markdown: "图文",
  resource: "资源",
  simulation_config: "模拟配置",
  quiz: "测验",
  subjective: "主观题",
  custom: "自定义",
};

export const BLOCK_TYPE_HINT: Record<BlockType, string> = {
  markdown: "Markdown 图文内容，支持富文本编辑",
  resource: "链接 / PDF / 视频资源",
  simulation_config: "模拟对话脚本配置",
  quiz: "选择/判断/简答多题型",
  subjective: "主观题 + 评分量表",
  custom: "自定义扩展内容",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type RawChapter = Record<string, any>;
type RawSection = Record<string, any>;
type RawTaskInstance = Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TocSection {
  id: string;
  title: string;
  order: number;
  taskCount: number;
  anchorId: string;
}

export interface TocChapter {
  id: string;
  title: string;
  order: number;
  anchorId: string;
  sections: TocSection[];
}

export function buildTocTree(chapters: RawChapter[]): TocChapter[] {
  return chapters.map((ch) => ({
    id: String(ch.id),
    title: ch.title ?? "",
    order: Number(ch.order ?? 0),
    anchorId: `chapter-${ch.id}`,
    sections: Array.isArray(ch.sections)
      ? ch.sections.map((s: RawSection) => ({
          id: String(s.id),
          title: s.title ?? "",
          order: Number(s.order ?? 0),
          taskCount: Array.isArray(s.taskInstances)
            ? s.taskInstances.length
            : 0,
          anchorId: `section-${s.id}`,
        }))
      : [],
  }));
}

export interface CourseSummaryCounts {
  chapterCount: number;
  sectionCount: number;
  totalTasks: number;
  publishedTasks: number;
  draftTasks: number;
}

export function buildCourseCounts(chapters: RawChapter[]): CourseSummaryCounts {
  let sectionCount = 0;
  let totalTasks = 0;
  let publishedTasks = 0;
  let draftTasks = 0;
  for (const ch of chapters) {
    const sections = Array.isArray(ch.sections) ? ch.sections : [];
    sectionCount += sections.length;
    for (const s of sections as RawSection[]) {
      const tis = Array.isArray(s.taskInstances) ? s.taskInstances : [];
      for (const ti of tis as RawTaskInstance[]) {
        totalTasks += 1;
        if (ti.status === "published") publishedTasks += 1;
        else if (ti.status === "draft") draftTasks += 1;
      }
    }
  }
  return {
    chapterCount: chapters.length,
    sectionCount,
    totalTasks,
    publishedTasks,
    draftTasks,
  };
}

/**
 * Return the tasks for a given section and slot, filtered & sorted.
 */
export function getSectionSlotTasks(
  section: RawSection,
  slot: SlotType,
): RawTaskInstance[] {
  const tis = Array.isArray(section.taskInstances) ? section.taskInstances : [];
  return (tis as RawTaskInstance[])
    .filter((ti) => ti.slot === slot)
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });
}

export function semesterDateDisplay(iso: string | null | undefined): string {
  if (!iso) return "未设置学期";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "未设置学期";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
