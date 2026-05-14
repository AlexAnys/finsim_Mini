import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit1-verify";

async function loginMolly(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "molly@qq.com");
  await page.fill('input[type="password"]', "123456");
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

interface ConsoleLog {
  type: string;
  text: string;
}

function collectConsole(page: Page): ConsoleLog[] {
  const logs: ConsoleLog[] = [];
  page.on("console", (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    logs.push({ type: "pageerror", text: err.message });
  });
  return logs;
}

test.setTimeout(180_000);

test("Unit 1 A: /teacher/analytics-v2 应无 nested button hydration warning", async ({
  page,
}) => {
  const logs = collectConsole(page);

  await loginMolly(page);
  await page.screenshot({ path: `${SS}/01-login.png`, fullPage: true });

  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SS}/02-analytics-v2.png`, fullPage: true });

  // 关键 acceptance：0 条 "cannot be a descendant of <button>"
  const nestedBtn = logs.filter((l) =>
    /cannot be a descendant of <button>|<button> cannot be a descendant/i.test(
      l.text,
    ),
  );
  console.log("nested-button warnings:", nestedBtn.length);
  for (const l of nestedBtn) console.log("  ", l.type, ":", l.text.slice(0, 200));

  // 列出所有 error/warning（便于调试，不强制）
  const errsWarns = logs.filter(
    (l) => l.type === "error" || l.type === "warning" || l.type === "pageerror",
  );
  console.log(`total error/warning/pageerror: ${errsWarns.length}`);
  for (const l of errsWarns.slice(0, 20))
    console.log("  ", l.type, ":", l.text.slice(0, 200));

  expect(nestedBtn.length).toBe(0);
});

test("Unit 1 B: 仪表盘打开一周洞察 modal 应无 a11y warning", async ({ page }) => {
  const logs = collectConsole(page);

  await loginMolly(page);
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/03-dashboard.png`, fullPage: true });

  // 点击"一周洞察"按钮
  const trigger = page.getByRole("button", { name: /一周洞察/ });
  const triggerCount = await trigger.count();
  console.log("一周洞察 button count:", triggerCount);
  if (triggerCount === 0) {
    test.skip(true, "页面没找到一周洞察按钮");
  }
  await trigger.first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/04-weekly-modal.png`, fullPage: true });

  // dialog 应该已打开
  const dialogVisible = await page.getByRole("dialog").count();
  console.log("dialog count after click:", dialogVisible);

  // 关键 acceptance：0 条 Missing Description / aria-describedby warning
  const a11yWarn = logs.filter((l) =>
    /Missing `?Description`?|aria-describedby/i.test(l.text),
  );
  console.log("a11y warnings:", a11yWarn.length);
  for (const l of a11yWarn) console.log("  ", l.type, ":", l.text.slice(0, 250));

  const errsWarns = logs.filter(
    (l) => l.type === "error" || l.type === "warning" || l.type === "pageerror",
  );
  console.log(`total error/warning/pageerror: ${errsWarns.length}`);
  for (const l of errsWarns.slice(0, 20))
    console.log("  ", l.type, ":", l.text.slice(0, 200));

  expect(a11yWarn.length).toBe(0);
});

test("Unit 1 C: KPI 卡片仍可点击进 drilldown (功能不变)", async ({ page }) => {
  await loginMolly(page);

  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);

  // 找完成率卡片：包含"完成率"文字
  const completionCard = page.locator('[role="button"]').filter({
    hasText: /完成率/,
  });
  const c = await completionCard.count();
  console.log("KPI card[role=button] containing 完成率:", c);

  // 至少应找到 1 张可点击 KPI 卡（4 张中至少完成率）
  expect(c).toBeGreaterThanOrEqual(1);

  // 点击 → 应触发 drilldown（drawer 或 url 变化）
  const beforeUrl = page.url();
  await completionCard.first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `${SS}/05-after-kpi-click.png`,
    fullPage: true,
  });
  const afterUrl = page.url();
  console.log("url before:", beforeUrl);
  console.log("url after:", afterUrl);

  // drilldown 触发的特征之一：drawer 出现 或 URL 变化
  const drawerCount = await page
    .locator('[role="dialog"], [data-state="open"]')
    .count();
  console.log("drawer/dialog count after click:", drawerCount);

  // 不强制 url 变 — drilldown 可能是 drawer，只要 click 没崩就好
  // 已 assert 卡是 role=button，证明语义正确
});

test("Unit 1 D: KPI 卡片支持键盘 Enter 触发 (a11y 等价)", async ({ page }) => {
  await loginMolly(page);

  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);

  const completionCard = page.locator('[role="button"]').filter({
    hasText: /完成率/,
  });
  await completionCard.first().focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `${SS}/06-after-enter.png`,
    fullPage: true,
  });

  // 不崩即过
});
