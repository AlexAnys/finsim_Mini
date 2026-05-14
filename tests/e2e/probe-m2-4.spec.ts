import { test, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3000";
const OUT = path.resolve(process.cwd(), ".harness/screenshots/probe-m2");

function log(line: string) {
  const stamp = new Date().toISOString().slice(11, 23);
  console.log(`[${stamp}] ${line}`);
  fs.appendFileSync(path.join(OUT, "trace.log"), `[${stamp}] ${line}\n`);
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
}

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

test("16 — SB create post with correct schema", async ({ page }) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  const dashRes = await page.request.get(`${BASE}/api/lms/dashboard/summary`);
  const dash = await dashRes.json();
  const tasks = (dash.data?.tasks || []) as Array<{
    id: string;
    title?: string;
    taskName?: string;
    taskId?: string;
    course?: { id: string; courseTitle: string };
  }>;
  log(`tasks fields sample: ${JSON.stringify(tasks[0])}`);

  // 选关联到 940bbe23 课程的任务
  const target =
    tasks.find((t) => t.course?.id === "940bbe23-6172-40bf-bc7f-b22a1840a1de") ||
    tasks[0];
  if (!target.taskId) {
    log(`no taskId field on task instance — abort`);
    return;
  }

  const createRes = await page.request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskId: target.taskId,
      taskInstanceId: target.id,
      title: "probe-m2 测试 知识源",
      question: "本课程的教学资料中关于复利公式说了什么？请引用具体素材内容。",
      mode: "direct",
      anonymous: false,
    },
  });
  const createJson = await createRes.json();
  log(`create status: ${createRes.status()} ok: ${createJson.success}`);
  if (!createJson.success) {
    log(`err: ${JSON.stringify(createJson.error)}`);
    return;
  }
  const post = createJson.data;
  log(
    `post id=${post.id} status=${post.status} refSources(initial)=${JSON.stringify(
      post.referencedSources || [],
    )}`,
  );

  // 轮询等 AI 回答
  let last = post;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const r = await page.request.get(
      `${BASE}/api/study-buddy/posts/${post.id}`,
    );
    const j = await r.json();
    if (!j.success) {
      log(`poll err: ${JSON.stringify(j.error)}`);
      break;
    }
    last = j.data;
    log(
      `poll${i} status=${last.status} msgCount=${(last.messages || []).length} refSources=${(last.referencedSources || []).length}`,
    );
    if (last.status === "answered" || last.status === "error") break;
  }
  if (last.referencedSources) {
    log(
      `final referencedSources: ${JSON.stringify(last.referencedSources)}`,
    );
  }
  if (last.messages) {
    const msgs = last.messages as Array<{ role: string; content: string }>;
    for (const m of msgs) {
      log(`  msg ${m.role}: ${(m.content || "").slice(0, 250)}`);
    }
  }
});
