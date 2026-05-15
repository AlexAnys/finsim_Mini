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

test("18 — SB full messages dump", async ({ page }) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  const dashRes = await page.request.get(`${BASE}/api/lms/dashboard/summary`);
  const tasks = (await dashRes.json()).data.tasks as Array<{
    id: string;
    taskId: string;
    course?: { id: string };
  }>;
  const target =
    tasks.find((t) => t.course?.id === "940bbe23-6172-40bf-bc7f-b22a1840a1de") ||
    tasks[0];

  const c = await page.request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskId: target.taskId,
      taskInstanceId: target.id,
      title: "probe-m2 测试3",
      question: "用上传材料说一下复利计算公式",
      mode: "direct",
      anonymous: false,
    },
  });
  const cJ = await c.json();
  if (!cJ.success) {
    log(JSON.stringify(cJ.error));
    return;
  }
  const pid = cJ.data.id;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2500);
    const r = await page.request.get(`${BASE}/api/study-buddy/posts`);
    const j = await r.json();
    const me = (j.data as Array<{ id: string; status: string; messages: unknown[]; aiReply: string | null }>).find(
      (p) => p.id === pid,
    );
    if (!me) continue;
    log(`poll${i} status=${me.status}`);
    if (me.status === "answered" || me.status === "error") {
      log(`aiReply: ${(me.aiReply || "").slice(0, 800)}`);
      log(`messages: ${JSON.stringify(me.messages, null, 2).slice(0, 2000)}`);
      break;
    }
  }
});
