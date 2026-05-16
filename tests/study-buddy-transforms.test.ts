import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  formatMessageTime,
  joinStudyBuddyPosts,
  sortPostsByCreatedDesc,
  type DashboardTaskLite,
  type RawStudyBuddyPost,
} from "@/lib/utils/study-buddy-transforms";

/**
 * study-buddy-transforms 纯 utils 测试 (拆自 pr-stu-2-study-buddy.test.ts).
 *
 * 覆盖:
 * 1. formatRelativeTime: 5 档相对时间分级
 * 2. formatMessageTime: HH:MM 格式
 * 3. joinStudyBuddyPosts: 客户端 join task → course 派生 + messages 计数
 * 4. sortPostsByCreatedDesc: 按 createdAt 降序
 *
 * 拆分动机: review-test F-3 — 原文件混 4 个真 utils unit + 10 个 UI readFileSync grep 守护，
 * grep 守护已删 (锁字符串不锁行为)，pure utils 保留是真信号.
 */

describe("PR-STU-2 · formatRelativeTime", () => {
  const now = new Date("2026-04-27T12:00:00Z");

  it("<1 分钟 → 刚刚", () => {
    const iso = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe("刚刚");
  });

  it("5 分钟前 → 5 分钟前", () => {
    const iso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe("5 分钟前");
  });

  it("3 小时前同一天 → 3 小时前", () => {
    const iso = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, now)).toBe("3 小时前");
  });

  it("昨天 22:10 → 昨天 HH:MM", () => {
    // now=2026-04-27 12:00 UTC；昨天 22:10 应是 2026-04-26 22:10 本地
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(22, 10, 0, 0);
    const result = formatRelativeTime(yesterday.toISOString(), now);
    expect(result).toMatch(/^昨天 \d{2}:\d{2}$/);
  });

  it("3 天前 → 3 天前", () => {
    const iso = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, now)).toMatch(/^[23] 天前$/);
  });

  it(">7 天 → YYYY-MM-DD", () => {
    const iso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("非法 ISO → 原样返回（不 crash）", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("not-a-date");
  });
});

describe("PR-STU-2 · formatMessageTime", () => {
  it("ISO → HH:MM 本地时间", () => {
    const iso = "2026-04-27T08:30:00Z";
    expect(formatMessageTime(iso)).toMatch(/^\d{2}:\d{2}$/);
  });

  it("非法 ISO → 空串", () => {
    expect(formatMessageTime("invalid")).toBe("");
  });
});

describe("PR-STU-2 · joinStudyBuddyPosts", () => {
  const now = new Date("2026-04-27T12:00:00Z");

  const rawPosts: RawStudyBuddyPost[] = [
    {
      id: "p1",
      taskId: "t-1",
      taskInstanceId: "ti-1",
      title: "WACC 税率问题",
      question: "边际还是有效税率？",
      mode: "socratic",
      anonymous: false,
      status: "answered",
      aiReply: "看公式…",
      messages: [
        {
          role: "student",
          content: "边际还是有效税率？",
          createdAt: "2026-04-27T11:50:00Z",
        },
        {
          role: "ai",
          content: "看公式…",
          createdAt: "2026-04-27T11:51:00Z",
        },
      ],
      createdAt: "2026-04-27T11:50:00Z",
    },
    {
      id: "p2",
      taskId: "t-2",
      taskInstanceId: null,
      title: "无关联任务",
      question: "?",
      mode: "direct",
      anonymous: true,
      status: "pending",
      aiReply: null,
      messages: [],
      createdAt: "2026-04-26T10:00:00Z",
    },
  ];

  const dashboardTasks: DashboardTaskLite[] = [
    {
      id: "ti-1",
      title: "客户访谈",
      taskName: "客户访谈任务",
      course: { id: "c-1", courseTitle: "公司金融基础" },
    },
  ];

  it("命中 join：courseName/courseId/taskName 落到 row", () => {
    const rows = joinStudyBuddyPosts(rawPosts, dashboardTasks, now);
    const r1 = rows.find((r) => r.id === "p1");
    expect(r1?.courseName).toBe("公司金融基础");
    expect(r1?.courseId).toBe("c-1");
    expect(r1?.taskName).toBe("客户访谈任务");
    expect(r1?.messageCount).toBe(2);
  });

  it("未命中（taskInstanceId=null）→ courseName/courseId/taskName 全 null", () => {
    const rows = joinStudyBuddyPosts(rawPosts, dashboardTasks, now);
    const r2 = rows.find((r) => r.id === "p2");
    expect(r2?.courseName).toBeNull();
    expect(r2?.courseId).toBeNull();
    expect(r2?.taskName).toBeNull();
    expect(r2?.messageCount).toBe(0);
  });

  it("messages null → 空数组兜底（不 crash）", () => {
    const posts: RawStudyBuddyPost[] = [
      {
        ...rawPosts[0],
        messages: null,
      },
    ];
    const rows = joinStudyBuddyPosts(posts, dashboardTasks, now);
    expect(rows[0].messages).toEqual([]);
    expect(rows[0].messageCount).toBe(0);
  });

  it("dashboard 全空也不 crash", () => {
    const rows = joinStudyBuddyPosts(rawPosts, [], now);
    expect(rows).toHaveLength(2);
    expect(rows[0].courseName).toBeNull();
  });

  it("relativeTime 字段被填充", () => {
    const rows = joinStudyBuddyPosts(rawPosts, dashboardTasks, now);
    expect(typeof rows[0].relativeTime).toBe("string");
    expect(rows[0].relativeTime.length).toBeGreaterThan(0);
  });
});

describe("PR-STU-2 · sortPostsByCreatedDesc", () => {
  const now = new Date("2026-04-27T12:00:00Z");
  const rows = joinStudyBuddyPosts(
    [
      {
        id: "old",
        taskId: "t",
        taskInstanceId: null,
        title: "旧",
        question: "",
        mode: "socratic",
        anonymous: false,
        status: "answered",
        aiReply: null,
        messages: [],
        createdAt: "2026-04-20T00:00:00Z",
      },
      {
        id: "new",
        taskId: "t",
        taskInstanceId: null,
        title: "新",
        question: "",
        mode: "socratic",
        anonymous: false,
        status: "answered",
        aiReply: null,
        messages: [],
        createdAt: "2026-04-26T00:00:00Z",
      },
    ],
    [],
    now,
  );

  it("最新在前", () => {
    const sorted = sortPostsByCreatedDesc(rows);
    expect(sorted[0].id).toBe("new");
    expect(sorted[1].id).toBe("old");
  });
});
