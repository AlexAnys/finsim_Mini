import { test, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const SHOTS = path.resolve(
  __dirname,
  "../../.harness/screenshots/review-2026-05-13/automation",
);

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/(dashboard|teacher|grades)/, {
    timeout: 20_000,
  });
  await page.waitForFunction(() => !location.pathname.includes("/login"), null, { timeout: 15_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
}

async function fetchFirstCourseId(page: Page): Promise<string | null> {
  // Use page.evaluate so the request comes from the browser context (cookies attached)
  const result = (await page.evaluate(async (base) => {
    const res = await fetch(`${base}/api/lms/courses`, { credentials: "include" });
    const body = await res.text();
    return { status: res.status, body };
  }, BASE)) as { status: number; body: string };
  console.log(JSON.stringify({ helper: "fetchFirstCourseId", status: result.status, preview: result.body.slice(0, 250) }));
  try {
    const json = JSON.parse(result.body) as { data?: Array<{ id?: string }> };
    const list = (json?.data || []) as Array<{ id?: string }>;
    return list[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function postFormData(page: Page, url: string, filePath: string, fileName: string, mimeType: string, tags: string) {
  const body = fs.readFileSync(filePath).toString("base64");
  return (await page.evaluate(
    async ({ url, body, fileName, mimeType, tags }) => {
      const bin = atob(body);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const fd = new FormData();
      fd.append("file", new Blob([arr], { type: mimeType }), fileName);
      fd.append("tags", tags);
      const res = await fetch(url, { method: "POST", body: fd, credentials: "include" });
      const t = await res.text();
      return { status: res.status, body: t };
    },
    { url, body, fileName, mimeType, tags },
  )) as { status: number; body: string };
}

async function postJson(page: Page, url: string, data: unknown) {
  return (await page.evaluate(
    async ({ url, data }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      const t = await res.text();
      return { status: res.status, body: t };
    },
    { url, data },
  )) as { status: number; body: string };
}

async function getJson(page: Page, url: string) {
  return (await page.evaluate(async (u) => {
    const res = await fetch(u, { credentials: "include" });
    const t = await res.text();
    return { status: res.status, body: t };
  }, url)) as { status: number; body: string };
}

test.setTimeout(180_000);

test("AUTO-01 课程列表 + 教师课程编辑器入口", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/courses`);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/01-teacher-courses.png`, fullPage: true });

  const courseId = await fetchFirstCourseId(page);
  console.log(JSON.stringify({ test: "AUTO-01", courseId }));
  if (!courseId) return;

  await page.goto(`${BASE}/teacher/courses/${courseId}`);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/01b-course-edit.png`, fullPage: true });

  // Check for "上传大纲" button
  const buttons = await page.locator("button, a").allTextContents();
  const matches = buttons.filter((t) => /大纲|上传/.test(t)).slice(0, 12);
  console.log(JSON.stringify({ test: "AUTO-01-buttons", matches }));
});

test("AUTO-02 上传大纲 + 看 AI 识别", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  const courseId = await fetchFirstCourseId(page);
  if (!courseId) {
    console.log(JSON.stringify({ test: "AUTO-02", err: "no course" }));
    return;
  }

  const t0 = Date.now();
  const up = await postFormData(
    page,
    `${BASE}/api/lms/courses/${courseId}/outline-import`,
    "/tmp/finsim-test-syllabus.md",
    "finsim-test-syllabus.md",
    "text/markdown",
    "测试,课程大纲",
  );
  console.log(
    JSON.stringify({
      test: "AUTO-02-upload",
      latencyMs: Date.now() - t0,
      status: up.status,
      preview: up.body.slice(0, 350),
    }),
  );

  const sourceId = up.body.match(/"id"\s*:\s*"([\w-]+)"/)?.[1];
  console.log(JSON.stringify({ test: "AUTO-02-source-id", sourceId }));
  if (!sourceId) return;

  for (let i = 0; i < 60; i++) {
    const list = await getJson(page, `${BASE}/api/lms/course-knowledge-sources?courseId=${courseId}&sourceType=syllabus`);
    let me: { id?: string; status?: string; structuredData?: { chapters?: Array<{ title?: string; sections?: unknown[] }> }; summary?: string; error?: string } | undefined;
    try {
      const data = JSON.parse(list.body) as { data?: { sources?: unknown[] } | unknown[] };
      const items = (((data?.data as { sources?: unknown[] })?.sources) || (data?.data as unknown[]) || []) as Array<{ id?: string; status?: string; structuredData?: { chapters?: Array<{ title?: string; sections?: unknown[] }> }; summary?: string; error?: string }>;
      me = items.find((s) => s.id === sourceId);
    } catch {
      /* noop */
    }
    if (i % 5 === 0) console.log(JSON.stringify({ test: "AUTO-02-tick", iter: i, status: me?.status }));
    if (me?.status && ["ready", "ai_summary_failed", "failed", "ocr_required"].includes(me.status)) {
      const ch = me.structuredData?.chapters || [];
      console.log(
        JSON.stringify({
          test: "AUTO-02-poll",
          iter: i,
          status: me.status,
          chapterCount: ch.length,
          chapterTitles: ch.map((c) => c.title).slice(0, 6),
          sectionCounts: ch.map((c) => c.sections?.length ?? 0).slice(0, 6),
          summary: (me.summary || "").slice(0, 200),
          error: me.error,
        }),
      );
      break;
    }
    await page.waitForTimeout(3000);
  }

  await page.goto(`${BASE}/teacher/courses/${courseId}`);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/02-syllabus-recognized.png`, fullPage: true });
});

test("AUTO-03 quiz + subjective + simulation 草稿", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  const courseId = await fetchFirstCourseId(page);
  if (!courseId) return;

  const ch = await getJson(page, `${BASE}/api/lms/courses/${courseId}`);
  let chapterId: string | null = null;
  let title: string | null = null;
  try {
    const json = JSON.parse(ch.body) as { data?: { chapters?: Array<{ id?: string; title?: string }> } };
    const first = json?.data?.chapters?.[0];
    chapterId = first?.id ?? null;
    title = first?.title ?? null;
  } catch {
    /* noop */
  }
  console.log(JSON.stringify({ test: "AUTO-03-chapter", chapterTitle: title }));
  if (!chapterId) return;

  for (const taskType of ["quiz", "subjective", "simulation"] as const) {
    const t = Date.now();
    const r = await postJson(page, `${BASE}/api/ai/task-draft/from-context`, {
      taskType,
      courseId,
      chapterId,
      sourceIds: [],
      teacherBrief: taskType === "quiz" ? "请生成 3 道关于 NPV 净现值的单选题" : taskType === "subjective" ? "请围绕 NPV/IRR 写一道主观题 + 评分量表" : "客户咨询投资决策的对话场景",
    });
    console.log(
      JSON.stringify({
        test: `AUTO-03-${taskType}`,
        status: r.status,
        latencyMs: Date.now() - t,
        preview: r.body.slice(0, 700),
      }),
    );
  }
});

test("AUTO-04 题库导入 + regex pipeline", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  const courseId = await fetchFirstCourseId(page);
  if (!courseId) return;

  const up = await postFormData(
    page,
    `${BASE}/api/lms/courses/${courseId}/outline-import`,
    "/tmp/finsim-test-questions.md",
    "finsim-test-questions.md",
    "text/markdown",
    "测试,题库",
  );
  const qSourceId = up.body.match(/"id"\s*:\s*"([\w-]+)"/)?.[1];
  console.log(JSON.stringify({ test: "AUTO-04-qbank-upload", status: up.status, sourceId: qSourceId }));
  if (!qSourceId) return;

  let ready = false;
  for (let i = 0; i < 25; i++) {
    const list = await getJson(page, `${BASE}/api/lms/course-knowledge-sources?courseId=${courseId}`);
    let me: { id?: string; status?: string; error?: string } | undefined;
    try {
      const data = JSON.parse(list.body) as { data?: { sources?: unknown[] } | unknown[] };
      const items = (((data?.data as { sources?: unknown[] })?.sources) || (data?.data as unknown[]) || []) as Array<{ id?: string; status?: string; error?: string }>;
      me = items.find((s) => s.id === qSourceId);
    } catch {
      /* noop */
    }
    if (me?.status === "ready" || me?.status === "ai_summary_failed") {
      ready = true;
      console.log(JSON.stringify({ test: "AUTO-04-source-ready", status: me.status, iter: i }));
      break;
    }
    if (me?.status === "failed") {
      console.log(JSON.stringify({ test: "AUTO-04-source-failed", error: me.error }));
      break;
    }
    await page.waitForTimeout(2500);
  }
  if (!ready) return;

  const t0 = Date.now();
  const q = await postJson(page, `${BASE}/api/ai/question-bank`, {
    action: "import",
    courseId,
    sourceIds: [qSourceId],
    questions: [],
  });
  console.log(
    JSON.stringify({
      test: "AUTO-04-qbank-import",
      status: q.status,
      latencyMs: Date.now() - t0,
      preview: q.body.slice(0, 800),
    }),
  );
});

test("AUTO-05 恶劣大纲 — 容错", async ({ page }) => {
  await login(page, "teacher1@finsim.edu.cn", "password123");
  const courseId = await fetchFirstCourseId(page);
  if (!courseId) return;

  const t0 = Date.now();
  const up = await postFormData(
    page,
    `${BASE}/api/lms/courses/${courseId}/outline-import`,
    "/tmp/finsim-test-syllabus-bad.md",
    "finsim-test-syllabus-bad.md",
    "text/markdown",
    "测试,容错",
  );
  const badSourceId = up.body.match(/"id"\s*:\s*"([\w-]+)"/)?.[1];
  console.log(
    JSON.stringify({
      test: "AUTO-05-upload",
      status: up.status,
      latencyMs: Date.now() - t0,
      sourceId: badSourceId,
    }),
  );
  if (!badSourceId) return;

  let auto05Logged = false;
  for (let i = 0; i < 60; i++) {
    const list = await getJson(page, `${BASE}/api/lms/course-knowledge-sources?courseId=${courseId}`);
    let me: { id?: string; status?: string; structuredData?: { chapters?: Array<{ title?: string }> }; summary?: string; error?: string } | undefined;
    try {
      const data = JSON.parse(list.body) as { data?: { sources?: unknown[] } | unknown[] };
      const items = (((data?.data as { sources?: unknown[] })?.sources) || (data?.data as unknown[]) || []) as Array<{ id?: string; status?: string; structuredData?: { chapters?: Array<{ title?: string }> }; summary?: string; error?: string }>;
      me = items.find((s) => s.id === badSourceId);
    } catch {
      /* noop */
    }
    if (i % 5 === 0) console.log(JSON.stringify({ test: "AUTO-05-tick", iter: i, status: me?.status }));
    if (me?.status && ["ready", "ai_summary_failed", "failed", "ocr_required"].includes(me.status)) {
      const ch = me.structuredData?.chapters || [];
      console.log(
        JSON.stringify({
          test: "AUTO-05-poll",
          iter: i,
          status: me.status,
          chapterCount: ch.length,
          chapterTitles: ch.map((c) => c.title).slice(0, 6),
          summary: (me.summary || "").slice(0, 200),
          error: me.error,
        }),
      );
      auto05Logged = true;
      break;
    }
    await page.waitForTimeout(2500);
  }
});
