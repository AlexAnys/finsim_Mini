import { describe, it, expect } from "vitest";
import {
  buildKpiSummary,
  buildAttentionItems,
  buildWeakInstances,
  buildTodaySchedule,
  buildUpcomingSchedule,
  buildActivityFeed,
  buildClassPerformance,
  buildWeeklyTrend,
  startOfWeek,
} from "@/lib/utils/teacher-dashboard-transforms";

const NOW = new Date("2026-04-23T10:00:00Z"); // Thursday

describe("startOfWeek", () => {
  it("normalizes to Monday 00:00", () => {
    const s = startOfWeek(NOW);
    expect(s.getDay()).toBe(1); // Monday
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
  });
});

describe("buildKpiSummary", () => {
  it("unique class count across courses + CourseClass relations", () => {
    const kpi = buildKpiSummary({
      courses: [
        { class: { id: "C1" }, classes: [] },
        {
          class: { id: "C2" },
          classes: [{ class: { id: "C3" } }, { class: { id: "C1" } }],
        },
      ],
      taskInstances: [],
      recentSubmissions: [],
      statsPendingCount: 0,
      now: NOW,
    });
    expect(kpi.classCount).toBe(3);
  });

  it("studentCount = max students across instances (indicative)", () => {
    const kpi = buildKpiSummary({
      courses: [],
      taskInstances: [
        { class: { _count: { students: 40 } } },
        { class: { _count: { students: 45 } } },
      ],
      recentSubmissions: [],
      statsPendingCount: 0,
      now: NOW,
    });
    expect(kpi.studentCount).toBe(45);
  });

  it("submittedThisWeek counts submissions in the Mon-start window", () => {
    const weekStart = startOfWeek(NOW);
    const inWeek = new Date(weekStart.getTime() + 3600 * 1000).toISOString();
    const beforeWeek = new Date(
      weekStart.getTime() - 3600 * 1000,
    ).toISOString();
    const kpi = buildKpiSummary({
      courses: [],
      taskInstances: [],
      recentSubmissions: [
        { submittedAt: inWeek, status: "submitted" },
        { submittedAt: inWeek, status: "graded" },
        { submittedAt: beforeWeek, status: "submitted" },
      ],
      statsPendingCount: 0,
      now: NOW,
    });
    expect(kpi.submittedThisWeek).toBe(2);
  });

  it("avgScore averages analytics.avgScore across published instances", () => {
    const kpi = buildKpiSummary({
      courses: [],
      taskInstances: [
        { analytics: { avgScore: 80 } },
        { analytics: { avgScore: 90 } },
        { analytics: { avgScore: null } },
      ],
      recentSubmissions: [],
      statsPendingCount: 0,
      now: NOW,
    });
    expect(kpi.avgScore).toBe(85);
  });

  it("weakInstanceCount counts analytics with avg < 60", () => {
    const kpi = buildKpiSummary({
      courses: [],
      taskInstances: [
        { analytics: { avgScore: 45 } },
        { analytics: { avgScore: 55 } },
        { analytics: { avgScore: 75 } },
      ],
      recentSubmissions: [],
      statsPendingCount: 0,
      now: NOW,
    });
    expect(kpi.weakInstanceCount).toBe(2);
  });

  it("completionRate = sum submissions / sum class sizes across published", () => {
    const kpi = buildKpiSummary({
      courses: [],
      taskInstances: [
        {
          status: "published",
          _count: { submissions: 30 },
          class: { _count: { students: 40 } },
        },
        {
          status: "published",
          _count: { submissions: 20 },
          class: { _count: { students: 40 } },
        },
      ],
      recentSubmissions: [],
      statsPendingCount: 0,
      now: NOW,
    });
    expect(kpi.completionRate).toBe(63);
  });
});

describe("buildAttentionItems", () => {
  it("returns up to 4 items sorted by urgency", () => {
    const items = buildAttentionItems(
      [
        {
          id: "TI-OVERDUE",
          status: "published",
          dueAt: new Date("2026-04-20T10:00:00Z"),
          task: { taskType: "quiz", taskName: "T1" },
          class: { name: "金融 22-1", _count: { students: 40 } },
          course: { id: "c1", courseTitle: "课" },
          title: "T1",
          _count: { submissions: 10 },
        },
        {
          id: "TI-SOON",
          status: "published",
          dueAt: new Date(NOW.getTime() + 3_600_000 * 12), // 12h
          task: { taskType: "simulation", taskName: "T2" },
          class: { name: "金融 22-2", _count: { students: 40 } },
          course: { id: "c1", courseTitle: "课" },
          title: "T2",
          _count: { submissions: 0 },
        },
        {
          id: "TI-FAR",
          status: "published",
          dueAt: new Date(NOW.getTime() + 3_600_000 * 24 * 10), // 10d
          task: { taskType: "subjective", taskName: "T3" },
          class: { name: "金融 22-3", _count: { students: 40 } },
          course: { id: "c1", courseTitle: "课" },
          title: "T3",
          _count: { submissions: 20 },
        },
        {
          id: "TI-DRAFT",
          status: "draft",
          dueAt: new Date(NOW.getTime() + 3_600_000 * 2),
          task: { taskType: "quiz", taskName: "draft" },
          class: { name: "金融 22-3", _count: { students: 40 } },
          course: { id: "c1", courseTitle: "课" },
          title: "draft",
          _count: { submissions: 0 },
        },
      ],
      NOW,
    );
    // Drafts are filtered out; overdue + soon should be top two
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("TI-DRAFT");
    expect(ids[0]).toBe("TI-OVERDUE");
    expect(ids[1]).toBe("TI-SOON");
  });

  it("urgent=true for overdue or <=24h", () => {
    const items = buildAttentionItems(
      [
        {
          id: "A",
          status: "published",
          dueAt: new Date(NOW.getTime() + 3_600_000 * 2),
          task: { taskType: "quiz", taskName: "A" },
          class: { name: "C", _count: { students: 10 } },
          course: { id: "c", courseTitle: "C" },
          title: "A",
          _count: { submissions: 0 },
        },
      ],
      NOW,
    );
    expect(items[0].urgent).toBe(true);
  });
});

describe("buildWeakInstances", () => {
  it("returns top-N by errorRate=100-avg, excludes zero-submission", () => {
    const items = buildWeakInstances([
      {
        id: "A",
        analytics: { avgScore: 60, submissionCount: 20 },
        course: { id: "c1", courseTitle: "课1" },
        title: "A",
      },
      {
        id: "B",
        analytics: { avgScore: 40, submissionCount: 15 },
        course: { id: "c2", courseTitle: "课2" },
        title: "B",
      },
      {
        id: "C",
        analytics: { avgScore: 50, submissionCount: 0 }, // excluded
        course: { id: "c2", courseTitle: "课2" },
        title: "C",
      },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("B"); // higher errorRate
    expect(items[0].errorRate).toBe(60);
    expect(items[0].wrongStudentCount).toBe(9);
    expect(items[0].href).toBe("/teacher/instances/B/insights");
  });

  it("respects limit", () => {
    const items = buildWeakInstances(
      [
        { id: "A", analytics: { avgScore: 40, submissionCount: 10 }, course: {}, title: "A" },
        { id: "B", analytics: { avgScore: 45, submissionCount: 10 }, course: {}, title: "B" },
        { id: "C", analytics: { avgScore: 50, submissionCount: 10 }, course: {}, title: "C" },
        { id: "D", analytics: { avgScore: 55, submissionCount: 10 }, course: {}, title: "D" },
      ],
      3,
    );
    expect(items).toHaveLength(3);
  });
});

describe("buildTodaySchedule", () => {
  it("filters by today's day-of-week and active-for-week callback", () => {
    // NOW = 2026-04-23 UTC Thursday. getDay() respects local tz.
    const localDay = NOW.getDay() === 0 ? 7 : NOW.getDay();
    const slots = buildTodaySchedule(
      [
        {
          id: "s1",
          dayOfWeek: localDay,
          timeLabel: "08:00-09:40",
          classroom: "A301",
          course: { id: "c1", courseTitle: "理财" },
        },
        {
          id: "s2",
          dayOfWeek: localDay === 7 ? 1 : localDay + 1, // not today
          timeLabel: "14:00-15:40",
          course: { id: "c1", courseTitle: "理财" },
        },
      ],
      () => true,
      NOW,
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe("s1");
  });

  it("inProgress=true when now is inside timeLabel window", () => {
    const localDay = NOW.getDay() === 0 ? 7 : NOW.getDay();
    const hh = String(NOW.getHours()).padStart(2, "0");
    const mm = String(NOW.getMinutes()).padStart(2, "0");
    const endH = String(NOW.getHours() + 1).padStart(2, "0");
    const slots = buildTodaySchedule(
      [
        {
          id: "s",
          dayOfWeek: localDay,
          timeLabel: `${hh}:${mm}-${endH}:${mm}`,
          course: { id: "c", courseTitle: "课" },
        },
      ],
      () => true,
      NOW,
    );
    expect(slots[0].inProgress).toBe(true);
  });
});

describe("buildUpcomingSchedule", () => {
  // Helper: anchor "now" at Sun 2026-04-26 09:00 local (week of teaching depends on
  // semesterStart). Use a concrete date for stable assertions.
  const NOW_UPCOMING = new Date(2026, 3, 26, 9, 0, 0); // Sun 4/26 09:00 local
  const SEM_START = "2026-02-16T00:00:00.000Z"; // Mon 2/16

  it("returns up to N upcoming slots ordered by date+startTime", () => {
    const slots = buildUpcomingSchedule(
      [
        // Sun (today) 14:00-15:40 — should still be in the future at 9am
        {
          id: "s-sun",
          dayOfWeek: 7,
          startWeek: 1,
          endWeek: 16,
          weekType: "all",
          timeLabel: "14:00-15:40",
          classroom: "A302",
          course: {
            id: "c1",
            courseTitle: "理财基础",
            class: { name: "金融2024A" },
            semesterStartDate: SEM_START,
          },
        },
        // Mon (next day) 08:00-09:40
        {
          id: "s-mon",
          dayOfWeek: 1,
          startWeek: 1,
          endWeek: 16,
          weekType: "all",
          timeLabel: "08:00-09:40",
          classroom: "A301",
          course: {
            id: "c1",
            courseTitle: "理财基础",
            class: { name: "金融2024A" },
            semesterStartDate: SEM_START,
          },
        },
        // Wed 14:00-15:40
        {
          id: "s-wed",
          dayOfWeek: 3,
          startWeek: 1,
          endWeek: 16,
          weekType: "all",
          timeLabel: "14:00-15:40",
          classroom: "B201",
          course: {
            id: "c2",
            courseTitle: "投资学",
            class: { name: "金融2024B" },
            semesterStartDate: SEM_START,
          },
        },
      ],
      4,
      NOW_UPCOMING,
    );
    expect(slots.length).toBe(3);
    expect(slots[0].id).toBe("s-sun");
    expect(slots[0].isToday).toBe(true);
    expect(slots[0].dateLabel).toBe("4/26");
    expect(slots[0].weekdayLabel).toBe("周日");
    expect(slots[0].startTime).toBe("14:00");
    expect(slots[0].className).toBe("金融2024A");
    expect(slots[0].classroom).toBe("A302");

    expect(slots[1].id).toBe("s-mon");
    expect(slots[1].isToday).toBe(false);
    expect(slots[1].dateLabel).toBe("4/27");
    expect(slots[1].weekdayLabel).toBe("周一");
    expect(slots[1].startTime).toBe("08:00");

    expect(slots[2].id).toBe("s-wed");
    expect(slots[2].dateLabel).toBe("4/29");
    expect(slots[2].weekdayLabel).toBe("周三");
  });

  it("excludes today's slot when end time has already passed", () => {
    const lateMorning = new Date(2026, 3, 26, 11, 0, 0); // Sun 11am
    const slots = buildUpcomingSchedule(
      [
        // Past: 08:00-09:40 (already ended)
        {
          id: "past",
          dayOfWeek: 7,
          startWeek: 1,
          endWeek: 16,
          weekType: "all",
          timeLabel: "08:00-09:40",
          course: {
            id: "c1",
            courseTitle: "C",
            semesterStartDate: SEM_START,
          },
        },
        // Future today: 14:00-15:40
        {
          id: "future",
          dayOfWeek: 7,
          startWeek: 1,
          endWeek: 16,
          weekType: "all",
          timeLabel: "14:00-15:40",
          course: {
            id: "c1",
            courseTitle: "C",
            semesterStartDate: SEM_START,
          },
        },
      ],
      4,
      lateMorning,
    );
    // past slot should pick its NEXT-week occurrence (Sun 5/3), not today
    const ids = slots.map((s) => s.id);
    expect(ids).toContain("future");
    const past = slots.find((s) => s.id === "past");
    if (past) {
      expect(past.date).not.toBe("2026-04-26");
      expect(past.isToday).toBe(false);
    }
  });

  it("respects weekType=odd / even", () => {
    // 2026-04-26 is week 11 (Mon 2/16 = week 1) — odd
    // weekType=even should skip until next even week
    const slots = buildUpcomingSchedule(
      [
        {
          id: "even-only",
          dayOfWeek: 7, // Sunday
          startWeek: 1,
          endWeek: 16,
          weekType: "even",
          timeLabel: "14:00-15:40",
          course: {
            id: "c1",
            courseTitle: "C",
            semesterStartDate: SEM_START,
          },
        },
      ],
      4,
      NOW_UPCOMING,
    );
    if (slots.length > 0) {
      // Whatever it picks must be a Sunday in even week
      expect(slots[0].weekdayLabel).toBe("周日");
      expect(slots[0].date).not.toBe("2026-04-26"); // 4/26 is odd week
    }
  });

  it("falls back to course.classes[0].name when course.class is absent", () => {
    const slots = buildUpcomingSchedule(
      [
        {
          id: "s",
          dayOfWeek: 1,
          startWeek: 1,
          endWeek: 16,
          weekType: "all",
          timeLabel: "08:00-09:40",
          course: {
            id: "c",
            courseTitle: "C",
            classes: [{ class: { id: "x" }, name: "金融2024C" }],
            semesterStartDate: SEM_START,
          },
        },
      ],
      4,
      NOW_UPCOMING,
    );
    expect(slots[0].className).toBe("金融2024C");
  });

  it("returns empty array when no slots in horizon", () => {
    const slots = buildUpcomingSchedule([], 4, NOW_UPCOMING);
    expect(slots).toEqual([]);
  });

  it("limits result count even with many candidates", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      dayOfWeek: ((i % 7) + 1) as number,
      startWeek: 1,
      endWeek: 16,
      weekType: "all",
      timeLabel: "10:00-11:40",
      course: {
        id: "c",
        courseTitle: "C",
        semesterStartDate: SEM_START,
      },
    }));
    const slots = buildUpcomingSchedule(many, 4, NOW_UPCOMING);
    expect(slots).toHaveLength(4);
  });
});

describe("buildActivityFeed", () => {
  it("maps graded/submitted status and caps to limit", () => {
    const feed = buildActivityFeed(
      [
        {
          id: "s1",
          student: { name: "陈同学" },
          task: { taskName: "王女士教育金规划" },
          taskType: "simulation",
          status: "graded",
          score: 95,
          maxScore: 100,
          gradedAt: "2026-04-23T10:00:00Z",
          submittedAt: "2026-04-23T09:00:00Z",
        },
        {
          id: "s2",
          student: { name: "王同学" },
          task: { taskName: "沪深 300 波动分析" },
          taskType: "subjective",
          status: "submitted",
          submittedAt: "2026-04-23T09:45:00Z",
        },
        {
          id: "s3",
          student: { name: "李同学" },
          task: { taskName: "测验" },
          taskType: "quiz",
          status: "graded",
          score: 78,
          maxScore: 100,
          gradedAt: "2026-04-22T10:00:00Z",
          submittedAt: "2026-04-22T09:00:00Z",
        },
      ],
      2,
    );
    expect(feed).toHaveLength(2);
    expect(feed[0].action).toBe("graded");
    expect(feed[0].score).toBe(95);
    expect(feed[1].action).toBe("submitted");
    expect(feed[1].score).toBeNull();
  });
});

describe("buildClassPerformance", () => {
  it("averages avgScore per class and sorts desc", () => {
    const rows = buildClassPerformance([
      {
        class: { id: "C1", name: "金融 22-1", _count: { students: 40 } },
        analytics: { avgScore: 80 },
      },
      {
        class: { id: "C1", name: "金融 22-1", _count: { students: 40 } },
        analytics: { avgScore: 90 },
      },
      {
        class: { id: "C2", name: "金融 22-2", _count: { students: 38 } },
        analytics: { avgScore: 70 },
      },
      {
        class: { id: "C3", name: "C3", _count: { students: 20 } },
        analytics: { avgScore: null }, // excluded
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].classId).toBe("C1");
    expect(rows[0].avgScore).toBe(85);
    expect(rows[0].studentCount).toBe(40);
  });
});

describe("buildWeeklyTrend", () => {
  it("returns 8 buckets with correct labels", () => {
    const trend = buildWeeklyTrend([], NOW, 8);
    expect(trend).toHaveLength(8);
    expect(trend[0].weekLabel).toBe("W1");
    expect(trend[7].weekLabel).toBe("W8");
  });

  it("bucket-8 is the current week and counts graded/submitted submissions", () => {
    const weekStart = startOfWeek(NOW);
    const inCurrent = new Date(weekStart.getTime() + 3_600_000).toISOString();
    const last = new Date(weekStart.getTime() - 3_600_000).toISOString();
    const trend = buildWeeklyTrend(
      [
        {
          submittedAt: inCurrent,
          status: "graded",
          score: 90,
          maxScore: 100,
        },
        {
          submittedAt: last,
          status: "submitted",
        },
      ],
      NOW,
      8,
    );
    const current = trend[7];
    expect(current.submissionCount).toBe(1);
    expect(current.avgScore).toBe(90);
    const prev = trend[6];
    expect(prev.submissionCount).toBe(1);
    expect(prev.avgScore).toBeNull();
  });
});
