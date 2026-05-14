/**
 * Probe M2 part 3 — 验证 Study Buddy 是否引用课程素材
 */
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

async function shot(page: Page, name: string) {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  await page
    .screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
    .catch((e) => log(`shot fail ${name}: ${e.message}`));
}

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

test("13 — Study Buddy 引用素材 referencedSources（API）", async ({ page }) => {
  await loginAs(page, "student1@finsim.edu.cn", "password123");
  // 1. 拉学生的 task-instance 列表（student dashboard）
  const dashRes = await page.request.get(
    `${BASE}/api/lms/dashboard/summary`,
  );
  const dash = await dashRes.json();
  const tasks = (dash.data?.tasks || []) as Array<{
    id: string;
    title?: string;
    taskName?: string;
    taskId?: string;
    course?: { id: string; courseTitle: string };
  }>;
  log(`student tasks: ${tasks.length}`);
  for (const t of tasks.slice(0, 5)) {
    log(`  task "${t.title || t.taskName}" id=${t.id} course=${t.course?.courseTitle} courseId=${t.course?.id}`);
  }

  if (tasks.length === 0) {
    log("NO TASKS — skipping");
    test.skip();
    return;
  }

  // 找一个属于有素材的课程的 task：course id 940bbe23-6172-40bf-bc7f-b22a1840a1de
  const target = tasks.find(
    (t) => t.course?.id === "940bbe23-6172-40bf-bc7f-b22a1840a1de" || t.course?.id === "ec619c34-99ed-4e45-9f97-2bcd43c1bcb1",
  );
  const taskInstance = target || tasks[0];
  log(
    `chosen task "${taskInstance.title}" id=${taskInstance.id} course=${taskInstance.course?.courseTitle}`,
  );

  // 2. 创建 post
  const createRes = await page.request.post(`${BASE}/api/study-buddy/posts`, {
    data: {
      taskInstanceId: taskInstance.id,
      title: "probe-m2 测试",
      content: "请用上传的教学材料举例解释复利",
      mode: "direct",
      isAnonymous: false,
    },
  });
  const createJson = await createRes.json();
  log(`create post status: ${createRes.status()} success: ${createJson.success}`);
  if (!createJson.success) {
    log(`create err: ${JSON.stringify(createJson.error)}`);
    return;
  }
  const post = createJson.data;
  log(
    `post id=${post.id} status=${post.status} referencedSources=${JSON.stringify(post.referencedSources || [])}`,
  );

  // 3. 等异步处理（用户已显式启动后端 SSE 回复，post.status 应在几秒后变 answered）
  let last = post;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(2000);
    const r = await page.request.get(`${BASE}/api/study-buddy/posts/${post.id}`);
    const j = await r.json();
    if (!j.success) {
      log(`poll err: ${JSON.stringify(j.error)}`);
      break;
    }
    last = j.data;
    log(
      `poll ${i}: status=${last.status} msgCount=${(last.messages || []).length} refSources=${(last.referencedSources || []).length}`,
    );
    if (last.status === "answered" || last.status === "error") break;
  }
  if (last.referencedSources) {
    log(
      `final referencedSources: ${JSON.stringify(last.referencedSources)}`,
    );
  }
  if (last.messages) {
    const assistantMsg = (last.messages as Array<{ role: string; content: string }>).find(
      (m) => m.role === "assistant",
    );
    log(`AI reply excerpt: ${(assistantMsg?.content || "").slice(0, 400)}`);
  }
});

test("14 — 删除带任务的章节（API 行为）", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  // 找一个有任务的章节，看 DELETE 行为
  const cRes = await page.request.get(`${BASE}/api/lms/courses`);
  const courses = (await cRes.json()).data || [];
  for (const c of courses) {
    const dRes = await page.request.get(`${BASE}/api/lms/courses/${c.id}`);
    const d = (await dRes.json()).data;
    if (!d) continue;
    for (const ch of d.chapters || []) {
      let total = 0;
      for (const s of ch.sections || []) total += s.taskInstances?.length || 0;
      if (total > 0) {
        log(`trying DELETE chapter ${ch.id} with ${total} tasks (course ${c.id})`);
        // 只做 dry run via OPTIONS, 不真删
        const url = `${BASE}/api/lms/chapters/${ch.id}`;
        // 真的尝试 DELETE — 但 demo 数据不应被弄坏。我们改为只 GET 接口看错误。
        // 用 OPTIONS 探测
        const opt = await page.request.fetch(url, { method: "OPTIONS" });
        log(`OPTIONS ${url} → ${opt.status()}`);
        return;
      }
    }
  }
  log("no chapter with tasks found in any course");
});

test("15 — 检查上传 PDF/DOCX/XLSX 接受类型 + 大小", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const res = await page.request.get(`${BASE}/api/lms/courses`);
  const firstId = (await res.json()).data?.[0]?.id;
  if (!firstId) return;
  await page.goto(`${BASE}/teacher/courses/${firstId}`, {
    waitUntil: "networkidle",
  });
  // 教学上下文 tab
  await page.getByRole("tab", { name: /教学上下文/ }).first().click();
  await page.waitForTimeout(500);

  // 看文件 input accept 属性
  const fileInputs = await page.locator('input[type="file"]').all();
  log(`file inputs in context tab: ${fileInputs.length}`);
  for (const inp of fileInputs) {
    const accept = await inp.getAttribute("accept");
    const multiple = await inp.getAttribute("multiple");
    log(`  accept="${accept}" multiple=${multiple}`);
  }

  // 看 upload-outline 对话框里的 accept
  // 关闭 tab 切回结构，打开上传大纲
  await page.getByRole("tab", { name: /课程结构/ }).first().click();
  await page.getByRole("button", { name: /上传大纲/ }).first().click();
  await page.waitForTimeout(500);
  const fi2 = await page.locator('input[type="file"]').all();
  for (const inp of fi2) {
    const accept = await inp.getAttribute("accept");
    if (accept) log(`  outline-dialog accept="${accept}"`);
  }
});
