import { describe, it, expect } from "vitest";
import {
  buildTocTree,
  buildCourseCounts,
  getSectionSlotTasks,
  semesterDateDisplay,
  BLOCK_TYPE_LABEL,
  BLOCK_TYPE_HINT,
  SLOT_LABEL,
} from "@/lib/utils/course-editor-transforms";

describe("buildTocTree", () => {
  it("flattens chapters + sections with anchor ids and task counts", () => {
    const toc = buildTocTree([
      {
        id: "c1",
        title: "第一章",
        order: 0,
        sections: [
          {
            id: "s1",
            title: "小节1.1",
            order: 0,
            taskInstances: [
              { id: "ti1", status: "published" },
              { id: "ti2", status: "draft" },
            ],
          },
          {
            id: "s2",
            title: "小节1.2",
            order: 1,
            taskInstances: [],
          },
        ],
      },
    ]);
    expect(toc).toHaveLength(1);
    expect(toc[0].anchorId).toBe("chapter-c1");
    expect(toc[0].sections).toHaveLength(2);
    expect(toc[0].sections[0].taskCount).toBe(2);
    expect(toc[0].sections[0].anchorId).toBe("section-s1");
  });

  it("handles missing sections array gracefully", () => {
    const toc = buildTocTree([{ id: "c1", title: "chap", order: 0 }]);
    expect(toc[0].sections).toEqual([]);
  });
});

describe("buildCourseCounts", () => {
  it("sums chapters / sections / tasks by status", () => {
    const counts = buildCourseCounts([
      {
        sections: [
          {
            taskInstances: [
              { status: "published" },
              { status: "published" },
              { status: "draft" },
            ],
          },
          { taskInstances: [{ status: "draft" }] },
        ],
      },
      {
        sections: [
          { taskInstances: [{ status: "archived" }] },
        ],
      },
    ]);
    expect(counts.chapterCount).toBe(2);
    expect(counts.sectionCount).toBe(3);
    expect(counts.totalTasks).toBe(5);
    expect(counts.publishedTasks).toBe(2);
    expect(counts.draftTasks).toBe(2);
  });

  it("handles empty chapters array", () => {
    const counts = buildCourseCounts([]);
    expect(counts.chapterCount).toBe(0);
    expect(counts.sectionCount).toBe(0);
    expect(counts.totalTasks).toBe(0);
  });
});

describe("getSectionSlotTasks", () => {
  it("filters by slot and sorts by createdAt asc", () => {
    const section = {
      taskInstances: [
        {
          id: "b",
          slot: "pre",
          createdAt: "2026-04-21T10:00:00Z",
        },
        {
          id: "a",
          slot: "pre",
          createdAt: "2026-04-20T10:00:00Z",
        },
        {
          id: "c",
          slot: "post",
          createdAt: "2026-04-22T10:00:00Z",
        },
      ],
    };
    const pre = getSectionSlotTasks(section, "pre");
    expect(pre.map((t) => t.id)).toEqual(["a", "b"]);
    const post = getSectionSlotTasks(section, "post");
    expect(post).toHaveLength(1);
  });

  it("returns empty when no taskInstances", () => {
    expect(getSectionSlotTasks({}, "pre")).toEqual([]);
  });
});

describe("semesterDateDisplay", () => {
  it("formats ISO as YYYY-MM-DD", () => {
    expect(semesterDateDisplay("2026-02-16T00:00:00Z")).toMatch(/2026-\d{2}-\d{2}/);
  });

  it("returns fallback for null/undefined/invalid", () => {
    expect(semesterDateDisplay(null)).toBe("未设置学期");
    expect(semesterDateDisplay(undefined)).toBe("未设置学期");
    expect(semesterDateDisplay("not a date")).toBe("未设置学期");
  });
});

describe("constants", () => {
  it("has 6 block type labels", () => {
    expect(Object.keys(BLOCK_TYPE_LABEL)).toHaveLength(6);
    expect(BLOCK_TYPE_LABEL.markdown).toBe("图文");
    expect(BLOCK_TYPE_LABEL.resource).toBe("资源");
    expect(BLOCK_TYPE_LABEL.simulation_config).toBe("模拟配置");
    expect(BLOCK_TYPE_LABEL.quiz).toBe("测验");
    expect(BLOCK_TYPE_LABEL.subjective).toBe("主观题");
    expect(BLOCK_TYPE_LABEL.custom).toBe("自定义");
  });

  it("has 3 slot labels", () => {
    expect(SLOT_LABEL).toEqual({
      pre: "课前",
      in: "课中",
      post: "课后",
    });
  });

  it("block hints align with labels", () => {
    for (const key of Object.keys(BLOCK_TYPE_LABEL)) {
      expect(typeof BLOCK_TYPE_HINT[key as keyof typeof BLOCK_TYPE_HINT]).toBe(
        "string",
      );
    }
  });
});
