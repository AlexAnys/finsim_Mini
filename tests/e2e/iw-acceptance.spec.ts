/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3001";
const SS = ".harness/screenshots/iw-acceptance";

async function login(page: Page, email: string, pwd: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pwd);
  await Promise.all([
    page
      .waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), {
        timeout: 25_000,
      })
      .catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function pickInstanceId(page: Page): Promise<string> {
  // 通过 teacher API 列出 molly 可访问的 instance
  const res = await page.request.get(`${BASE}/api/lms/task-instances?take=20`);
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.success).toBeTruthy();
  const items: Array<{
    id: string;
    title: string;
    taskType: string;
    status: string;
  }> = json.data.items ?? json.data ?? [];
  expect(items.length).toBeGreaterThan(0);
  // 优先选 published 的实例，避免 draft 没 UI 入口
  const published = items.find((i) => i.status === "published") ?? items[0];
  console.log(
    `[pickInstanceId] using ${published.id} (${published.title}, ${published.taskType}, ${published.status})`,
  );
  return published.id;
}

test.setTimeout(180_000);

test("A2: instance title inline edit + persist", async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error")
      console.log(`[browser error]`, msg.text().slice(0, 300));
  });
  page.on("pageerror", (err) =>
    console.log("[pageerror]", err.message.slice(0, 300)),
  );

  await login(page, "molly@qq.com", "123456");
  const instanceId = await pickInstanceId(page);

  await page.goto(`${BASE}/teacher/instances/${instanceId}`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/a2-01-overview.png`, fullPage: true });

  // 找原标题
  const h1 = page.locator("h1").first();
  const originalTitle = (await h1.textContent()) ?? "";
  console.log(`[A2] original title: ${originalTitle}`);

  // 点 pen icon
  const penBtn = page.locator('button[aria-label="编辑标题"]').first();
  await expect(penBtn).toBeVisible({ timeout: 10_000 });
  await penBtn.click();

  // 输入新标题
  const input = page.locator('input[maxlength="200"]').first();
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  const newTitle = `${originalTitle.trim()}_e2e_iw`;
  await input.fill(newTitle);
  await page.screenshot({ path: `${SS}/a2-02-editing.png`, fullPage: true });

  // 保存（Enter 触发）
  await input.press("Enter");
  await page.waitForLoadState("networkidle").catch(() => {});

  // 验标题已切回 readonly + 显示新值
  await expect(page.locator("h1").first()).toHaveText(newTitle, {
    timeout: 10_000,
  });
  await page.screenshot({ path: `${SS}/a2-03-saved.png`, fullPage: true });

  // 刷新页面验持久化
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1").first()).toHaveText(newTitle, {
    timeout: 10_000,
  });

  // 进 /teacher/instances 列表，应能找到新标题
  await page.goto(`${BASE}/teacher/instances`);
  await page.waitForLoadState("networkidle");
  const listHas = await page.getByText(newTitle).count();
  expect(listHas).toBeGreaterThan(0);
  await page.screenshot({ path: `${SS}/a2-04-list.png`, fullPage: true });

  // 还原标题
  await page.goto(`${BASE}/teacher/instances/${instanceId}`);
  await page.waitForLoadState("networkidle");
  await page.locator('button[aria-label="编辑标题"]').first().click();
  const restoreInput = page.locator('input[maxlength="200"]').first();
  await restoreInput.fill(originalTitle);
  await restoreInput.press("Enter");
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator("h1").first()).toHaveText(originalTitle, {
    timeout: 10_000,
  });
  console.log(`[A2] restored title: ${originalTitle}`);
});

test("A1: instance config Sheet open/render by taskType", async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error")
      console.log(`[browser error]`, msg.text().slice(0, 300));
  });

  await login(page, "molly@qq.com", "123456");
  const instanceId = await pickInstanceId(page);

  await page.goto(`${BASE}/teacher/instances/${instanceId}`);
  await page.waitForLoadState("networkidle");

  // 找 "编辑配置" 按钮（data-action）
  const editBtn = page.locator('button[data-action="edit-snapshot"]');
  await expect(editBtn).toBeVisible({ timeout: 10_000 });
  await editBtn.click();

  // Sheet 应该开
  await expect(page.getByText("编辑实例配置")).toBeVisible({
    timeout: 10_000,
  });
  await page.screenshot({ path: `${SS}/a1-01-sheet-open.png`, fullPage: true });

  // 检测哪个 form 渲染（按 data-form）
  const simForm = page.locator('div[data-form="simulation"]');
  const quizForm = page.locator('div[data-form="quiz"]');
  const subForm = page.locator('div[data-form="subjective"]');
  const simVisible = await simForm.isVisible().catch(() => false);
  const quizVisible = await quizForm.isVisible().catch(() => false);
  const subVisible = await subForm.isVisible().catch(() => false);
  const visibleForms = [simVisible, quizVisible, subVisible].filter(Boolean);
  expect(visibleForms.length).toBe(1); // 严格 1 个 form 渲染

  console.log(
    `[A1] form rendered: ${simVisible ? "simulation" : quizVisible ? "quiz" : "subjective"}`,
  );

  // 点取消（不改任何字段，避免污染数据）
  const cancelBtn = page.getByRole("button", { name: "取消" }).first();
  await cancelBtn.click();
  // Sheet 应关
  await expect(page.getByText("编辑实例配置")).toBeHidden({ timeout: 5_000 });
  await page.screenshot({
    path: `${SS}/a1-02-sheet-closed.png`,
    fullPage: true,
  });
});

test("C1-B: AI assistant state persists across page navigation", async ({
  page,
}) => {
  page.on("console", (msg) => {
    if (msg.type() === "error")
      console.log(`[browser error]`, msg.text().slice(0, 300));
  });

  await login(page, "molly@qq.com", "123456");

  // 进 AI 助手
  await page.goto(`${BASE}/teacher/ai-assistant`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${SS}/c1-01-initial.png`, fullPage: true });

  // 选 lessonPolish（默认即是，确认）
  await page.getByRole("button", { name: /教案完善/ }).click();

  // 填 text（用 placeholder + textarea selector）
  const textarea = page
    .locator('textarea[placeholder*="教案片段"]')
    .first();
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  const lessonPolishText = "E2E test sample lesson content for lessonPolish";
  await textarea.fill(lessonPolishText);
  await page.screenshot({ path: `${SS}/c1-02-text-filled.png`, fullPage: true });

  // 切到 dashboard
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle");

  // 切回 ai-assistant - text 应该恢复
  await page.goto(`${BASE}/teacher/ai-assistant`);
  await page.waitForLoadState("networkidle");
  const restoredText = await page
    .locator('textarea[placeholder*="教案片段"]')
    .first()
    .inputValue();
  expect(restoredText).toBe(lessonPolishText);
  await page.screenshot({ path: `${SS}/c1-03-restored.png`, fullPage: true });

  // 切 examCheck - text 应该为空（per-tool 隔离）
  await page.getByRole("button", { name: /试卷检查/ }).click();
  await page.waitForTimeout(500);
  const examTextarea = page
    .locator('textarea[placeholder*="标准答案"]')
    .first();
  const examText = await examTextarea.inputValue();
  expect(examText).toBe(""); // examCheck 独立 cache，初始空
  console.log(`[C1-B] examCheck initial text = "${examText}" (expected empty)`);

  // 填 examCheck 内容
  const examFillText = "E2E test exam check sample content";
  await examTextarea.fill(examFillText);
  await page.screenshot({ path: `${SS}/c1-04-examcheck.png`, fullPage: true });

  // 切回 lessonPolish - text 应该仍是原 lessonPolish 内容
  await page.getByRole("button", { name: /教案完善/ }).click();
  await page.waitForTimeout(500);
  const lpText = await page
    .locator('textarea[placeholder*="教案片段"]')
    .first()
    .inputValue();
  expect(lpText).toBe(lessonPolishText);
  console.log(`[C1-B] lessonPolish text after re-select = "${lpText}"`);

  // 验 read/edit toggle 按钮存在（无 job 不会有 result，但切换按钮在结果区无 result 时不显示）
  // 改测：刷新 page 时 lessonPolish text 应仍持久（reload test）
  await page.reload();
  await page.waitForLoadState("networkidle");
  const afterReload = await page
    .locator('textarea[placeholder*="教案片段"]')
    .first()
    .inputValue();
  expect(afterReload).toBe(lessonPolishText);
  console.log(`[C1-B] after reload text = "${afterReload}"`);
  await page.screenshot({ path: `${SS}/c1-05-after-reload.png`, fullPage: true });

  // Cleanup: 清空两 tool 的 text，避免污染
  await page
    .locator('textarea[placeholder*="教案片段"]')
    .first()
    .fill("");
  await page.getByRole("button", { name: /试卷检查/ }).click();
  await page.waitForTimeout(300);
  await page.locator('textarea[placeholder*="标准答案"]').first().fill("");
});
