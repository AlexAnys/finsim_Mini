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
 * PR-STU-2 · 学生 /study-buddy 重布局测试
 *
 * 覆盖：
 * 1. formatRelativeTime — 5 档相对时间分级
 * 2. formatMessageTime — HH:MM 格式
 * 3. joinStudyBuddyPosts — 客户端 join task → course 派生 + messages 计数
 * 4. sortPostsByCreatedDesc — 按 createdAt 降序
 * 5. UI 文件守护 grep（中文 / 子组件 import / token）
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

describe("PR-STU-2 · UI 文件守护（中文 / 子组件 import / token / mockup 视觉锚点）", () => {
  it("page.tsx 引用 3 子组件 + transforms util + 中文文案", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "app/(student)/study-buddy/page.tsx"),
      "utf-8",
    );
    expect(file).toContain("@/components/study-buddy/study-buddy-list");
    expect(file).toContain("@/components/study-buddy/study-buddy-conversation");
    expect(file).toContain(
      "@/components/study-buddy/study-buddy-new-post-dialog",
    );
    expect(file).toContain("@/lib/utils/study-buddy-transforms");
    // mockup 视觉锚点（标题在 list 子组件，page 主要协调；保留兼容验证）
    expect(file).toContain("/api/study-buddy/posts");
    expect(file).toContain("/api/ai/study-buddy/reply");
  });

  it("StudyBuddyList 渲染 mockup 顶部文案 + 新问题按钮", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "components/study-buddy/study-buddy-list.tsx"),
      "utf-8",
    );
    expect(file).toContain("学习伙伴");
    expect(file).toContain("遇到卡点时向 AI 发起对话");
    expect(file).toContain("新问题");
    expect(file).toContain("最近对话");
    // 深靛主按钮
    expect(file).toContain("bg-brand");
  });

  it("StudyBuddyListItem 渲染状态 chip + 6 tag class", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/study-buddy/study-buddy-list-item.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("等待回复");
    expect(file).toContain("回复失败");
    expect(file).toContain("匿名");
    expect(file).toContain("引导式");
    expect(file).toContain("直接");
    // 6 tag class 都有引用
    expect(file).toContain("bg-tag-a");
    expect(file).toContain("bg-tag-f");
    expect(file).toContain("courseColorForId");
  });

  it("StudyBuddyConversationHeader mockup 视觉锚点（mode chip + 课程·任务）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/study-buddy/study-buddy-conversation-header.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("引导式（Socratic）");
    expect(file).toContain("直接回答");
    // tag class 复用
    expect(file).toContain("bg-tag-a");
  });

  it("StudyBuddyMessageBubble 渲染角色 + Socratic chip + 灵析品牌名", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/study-buddy/study-buddy-message.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("灵析 AI");
    expect(file).toContain("引导式");
    // student 气泡 deep indigo
    expect(file).toContain("bg-brand");
    // ai 气泡 surface + ochre bot icon
    expect(file).toContain("bg-surface");
    expect(file).toContain("text-ochre");
  });

  it("StudyBuddyComposer 模式切换 + 匿名 + 中文 placeholder + AI 引导提示", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/study-buddy/study-buddy-composer.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("继续提问");
    expect(file).toContain("发送");
    expect(file).toContain("匿名");
    expect(file).toContain("引导式");
    expect(file).toContain("直接");
    expect(file).toContain("AI 回复仅作学习引导");
  });

  it("StudyBuddyNewPostDialog 5 字段 + 任务选择 + 双模式选择 + 中文文案", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/study-buddy/study-buddy-new-post-dialog.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("向学习伙伴提问");
    expect(file).toContain("关联任务");
    expect(file).toContain("选择要关联的任务");
    expect(file).toContain("标题");
    expect(file).toContain("问题详情");
    expect(file).toContain("回答模式");
    expect(file).toContain("匿名提问");
    expect(file).toContain("引导式");
    expect(file).toContain("直接回答");
    expect(file).toContain("发起对话");
  });

  it("StudyBuddyConversation 空状态 + pending typing dots + error 提示", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(
        process.cwd(),
        "components/study-buddy/study-buddy-conversation.tsx",
      ),
      "utf-8",
    );
    expect(file).toContain("选择左侧对话或发起新问题");
    expect(file).toContain("发起新问题");
    expect(file).toContain("灵析 AI 回复失败");
    // typing dots 占位
    expect(file).toContain("animate-pulse");
  });

  it("page.tsx 0 硬编码色（无 #xxx + 无 raw tailwind palette）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = fs.readFileSync(
      path.join(process.cwd(), "app/(student)/study-buddy/page.tsx"),
      "utf-8",
    );
    expect(file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(file).not.toMatch(
      /\bbg-(blue|red|green|gray|slate|zinc|emerald|cyan|yellow|orange|purple|pink)-\d/,
    );
    expect(file).not.toMatch(
      /\btext-(blue|red|green|gray|slate|zinc|emerald|cyan|yellow|orange|purple|pink)-\d/,
    );
  });

  it("子组件 0 硬编码色（含 conversation-header / list-item / message / composer / dialog / list / conversation）", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "components/study-buddy");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      const file = fs.readFileSync(path.join(dir, f), "utf-8");
      // 注释里允许 mockup 的 hex 引用，但代码里不能直接出现
      const codeOnly = file
        .replace(/\/\/.*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(codeOnly, `${f} contains hex color`).not.toMatch(
        /#[0-9a-fA-F]{6}\b/,
      );
      expect(
        codeOnly,
        `${f} uses raw tailwind palette`,
      ).not.toMatch(
        /\bbg-(blue|red|gray|slate|zinc|emerald|yellow|orange|purple|pink)-\d/,
      );
    }
  });
});
