import { describe, it, expect } from "vitest";
import {
  computeChapterStatus,
  computeSectionState,
  computeSectionStatusLine,
  formatDueLabel,
  transformSectionBlocks,
  transformSectionTasks,
  type DashboardTaskState,
  type RawSection,
  type RawContentBlock,
} from "@/lib/utils/course-detail-transform";

function makeSection(override: Partial<RawSection> = {}): RawSection {
  return {
    id: "sec-1",
    title: "小节 A",
    order: 0,
    contentBlocks: [],
    taskInstances: [],
    ...override,
  };
}

function makeBlock(override: Partial<RawContentBlock> = {}): RawContentBlock {
  return {
    id: `b-${Math.random().toString(36).slice(2, 8)}`,
    blockType: "markdown",
    slot: "pre",
    order: 0,
    data: null,
    ...override,
  };
}

describe("formatDueLabel", () => {
  const now = new Date("2026-04-23T10:00:00");
  it("marks overdue", () => {
    expect(formatDueLabel("2026-04-20T10:00:00", now)).toBe("已过期");
  });
  it("same-day under 24h shows '今晚 HH:MM'", () => {
    expect(formatDueLabel("2026-04-23T22:30:00", now)).toBe("今晚 22:30");
  });
  it("next-day within 24h shows '明天 HH:MM'", () => {
    expect(formatDueLabel("2026-04-24T09:00:00", now)).toBe("明天 09:00");
  });
  it("2-7 days shows 'N 天后'", () => {
    expect(formatDueLabel("2026-04-26T10:00:00", now)).toBe("3 天后");
  });
});

describe("transformSectionBlocks", () => {
  it("maps 6 ContentBlockType values + fallbacks custom for unknown", () => {
    const blocks = [
      makeBlock({ blockType: "markdown" }),
      makeBlock({ blockType: "resource" }),
      makeBlock({ blockType: "simulation_config" }),
      makeBlock({ blockType: "quiz" }),
      makeBlock({ blockType: "subjective" }),
      makeBlock({ blockType: "custom" }),
      makeBlock({ blockType: "unknown-type" }),
    ];
    const r = transformSectionBlocks(blocks);
    expect(r.map((b) => b.kind)).toEqual([
      "markdown",
      "resource",
      "simulation_config",
      "quiz",
      "subjective",
      "custom",
      "custom",
    ]);
  });

  it("extracts title from data.title/label/name with fallback label", () => {
    const blocks = [
      makeBlock({ blockType: "markdown", data: { title: "讲义一" } }),
      makeBlock({ blockType: "resource", data: { label: "PDF 链接" } }),
      makeBlock({ blockType: "quiz", data: {} }),
    ];
    const r = transformSectionBlocks(blocks);
    expect(r[0].title).toBe("讲义一");
    expect(r[1].title).toBe("PDF 链接");
    expect(r[2].title).toBe("测验题");
  });

  it("normalizes slot to 'post' if missing/invalid", () => {
    const blocks = [
      makeBlock({ slot: "" as unknown as string }),
      makeBlock({ slot: "pre" }),
      makeBlock({ slot: "in" }),
      makeBlock({ slot: "post" }),
    ];
    const r = transformSectionBlocks(blocks);
    expect(r[0].slot).toBe("post");
    expect(r[1].slot).toBe("pre");
    expect(r[2].slot).toBe("in");
    expect(r[3].slot).toBe("post");
  });
});

describe("transformSectionTasks", () => {
  const now = new Date("2026-04-23T10:00:00");
  const mkT = (id: string, status: string, due: string) => ({
    id,
    taskName: `任务 ${id}`,
    taskType: "quiz",
    status,
    dueAt: due,
    slot: "post",
  });

  it("filters out non-published tasks", () => {
    const tasks = [
      mkT("a", "draft", "2026-05-01T00:00:00"),
      mkT("b", "published", "2026-05-01T00:00:00"),
    ];
    const r = transformSectionTasks(tasks, new Map(), now);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("b");
  });

  it("uses student state for status + score label", () => {
    const tasks = [mkT("a", "published", "2026-04-20T00:00:00")];
    const state: DashboardTaskState = {
      id: "a",
      studentStatus: "graded",
      canSubmit: false,
      latestScore: 85,
      latestMaxScore: 100,
    };
    const r = transformSectionTasks(tasks, new Map([["a", state]]), now);
    expect(r[0].status).toBe("graded");
    expect(r[0].scoreLabel).toBe("85/100");
    expect(r[0].dueLabel).toBeNull();
  });

  it("shows dueLabel only for todo tasks", () => {
    const tasks = [mkT("a", "published", "2026-04-24T09:00:00")];
    const state: DashboardTaskState = {
      id: "a",
      studentStatus: "todo",
      canSubmit: true,
    };
    const r = transformSectionTasks(tasks, new Map([["a", state]]), now);
    expect(r[0].status).toBe("todo");
    expect(r[0].dueLabel).toBe("明天 09:00");
  });
});

describe("computeSectionState + statusLine", () => {
  const now = new Date("2026-04-23T10:00:00");

  it("'done' when all published tasks are submitted or graded", () => {
    const sec = makeSection({
      taskInstances: [
        {
          id: "t1",
          taskType: "quiz",
          status: "published",
          dueAt: "2026-04-20T10:00:00",
          slot: "post",
        },
      ],
    });
    const state = new Map<string, DashboardTaskState>([
      [
        "t1",
        { id: "t1", studentStatus: "graded", canSubmit: false, latestScore: 9, latestMaxScore: 10 },
      ],
    ]);
    const agg = computeSectionState(4, sec, state, null, now);
    expect(agg.state).toBe("done");
    expect(agg.number).toBe("5.1");
    expect(computeSectionStatusLine(agg)).toBe("已完成 · 得分 9/10");
  });

  it("'active' when some but not all tasks are completed", () => {
    const sec = makeSection({
      taskInstances: [
        {
          id: "t1",
          taskType: "quiz",
          status: "published",
          dueAt: "2026-05-01T10:00:00",
          slot: "post",
        },
        {
          id: "t2",
          taskType: "subjective",
          status: "published",
          dueAt: "2026-05-01T10:00:00",
          slot: "post",
        },
      ],
    });
    const state = new Map<string, DashboardTaskState>([
      ["t1", { id: "t1", studentStatus: "submitted", canSubmit: false }],
      ["t2", { id: "t2", studentStatus: "todo", canSubmit: true }],
    ]);
    const agg = computeSectionState(4, sec, state, null, now);
    expect(agg.state).toBe("active");
    expect(computeSectionStatusLine(agg)).toBe("本节进行中 · 1 项未完成");
  });

  it("'upcoming' when no task progress yet", () => {
    const sec = makeSection({
      taskInstances: [
        {
          id: "t1",
          taskType: "quiz",
          status: "published",
          dueAt: "2026-05-01T10:00:00",
          slot: "post",
        },
      ],
    });
    const agg = computeSectionState(4, sec, new Map(), null, now);
    expect(agg.state).toBe("upcoming");
  });

  it("'locked' when section has no tasks and semester not started yet", () => {
    const sec = makeSection({ taskInstances: [] });
    const agg = computeSectionState(4, sec, new Map(), new Date("2026-05-01"), now);
    expect(agg.state).toBe("locked");
    expect(computeSectionStatusLine(agg)).toBe("暂未解锁");
  });
});

describe("computeChapterStatus", () => {
  it("returns 'done' only when all sections are done", () => {
    expect(
      computeChapterStatus([
        {
          id: "1", number: "1.1", title: "a", state: "done",
          taskCount: 1, completedTaskCount: 1, hasGraded: true,
          firstGradedScore: { score: 10, maxScore: 10 },
        },
        {
          id: "2", number: "1.2", title: "b", state: "done",
          taskCount: 1, completedTaskCount: 1, hasGraded: false,
          firstGradedScore: null,
        },
      ]),
    ).toBe("done");
  });

  it("returns 'active' when some section is active or done but not all", () => {
    expect(
      computeChapterStatus([
        {
          id: "1", number: "1.1", title: "a", state: "active",
          taskCount: 2, completedTaskCount: 1, hasGraded: false,
          firstGradedScore: null,
        },
        {
          id: "2", number: "1.2", title: "b", state: "upcoming",
          taskCount: 1, completedTaskCount: 0, hasGraded: false,
          firstGradedScore: null,
        },
      ]),
    ).toBe("active");
  });

  it("returns 'upcoming' when no sections started", () => {
    expect(
      computeChapterStatus([
        {
          id: "1", number: "1.1", title: "a", state: "upcoming",
          taskCount: 1, completedTaskCount: 0, hasGraded: false,
          firstGradedScore: null,
        },
      ]),
    ).toBe("upcoming");
  });

  it("returns 'upcoming' for empty chapter", () => {
    expect(computeChapterStatus([])).toBe("upcoming");
  });
});
