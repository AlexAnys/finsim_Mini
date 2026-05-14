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

test.use({ viewport: { width: 1440, height: 900 } });

test("17 — SB poll via list", async ({ page }) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  const dashRes = await page.request.get(`${BASE}/api/lms/dashboard/summary`);
  const dash = await dashRes.json();
  const tasks = (dash.data?.tasks || []) as Array<{
    id: string;
    taskId: string;
    course?: { id: string };
  }>;
  const target =
    tasks.find((t) => t.course?.id === "940bbe23-6172-40bf-bc7f-b22a1840a1de") ||
    tasks[0];

  const createRes = await page.request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskId: target.taskId,
      taskInstanceId: target.id,
      title: "probe-m2 测试2",
      question: "教学资料里有关于复利或者资产配置的内容吗？请引用资料并说明。",
      mode: "direct",
      anonymous: false,
    },
  });
  const cJson = await createRes.json();
  log(`create ok=${cJson.success} status=${createRes.status()}`);
  if (!cJson.success) {
    log(JSON.stringify(cJson.error));
    return;
  }
  const postId = cJson.data.id;
  log(`post ${postId} initial status=${cJson.data.status}`);

  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2500);
    const r = await page.request.get(`${BASE}/api/study-buddy/posts`);
    const j = await r.json();
    const posts = j.data as Array<{
      id: string;
      status: string;
      messages?: Array<{ role: string; content: string }>;
      referencedSources?: unknown[];
    }>;
    const me = posts.find((p) => p.id === postId);
    if (!me) {
      log(`poll${i}: NOT FOUND in list`);
      continue;
    }
    log(
      `poll${i}: status=${me.status} msgs=${(me.messages || []).length} ref=${(me.referencedSources || []).length}`,
    );
    if (me.status === "answered" || me.status === "error") {
      log(`referencedSources: ${JSON.stringify(me.referencedSources)}`);
      const a = (me.messages || []).find((m) => m.role === "assistant");
      log(`AI reply: ${(a?.content || "").slice(0, 600)}`);
      break;
    }
  }
});
