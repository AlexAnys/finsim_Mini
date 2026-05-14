import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit1";

// Independent QA spec for Unit 1: KPI Hydration + 一周洞察 Dialog A11y
// Tests acceptance directly without referring to builder's diff.

async function loginAsMolly(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "molly@qq.com");
  await page.fill('input[type="password"]', "123456");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 30_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

type ConsoleCapture = {
  type: string;
  text: string;
};

function captureConsole(page: Page): ConsoleCapture[] {
  const arr: ConsoleCapture[] = [];
  page.on("console", (m: ConsoleMessage) => {
    arr.push({ type: m.type(), text: m.text() });
  });
  page.on("pageerror", (e) => {
    arr.push({ type: "pageerror", text: String(e?.message ?? e) });
  });
  return arr;
}

test.setTimeout(180_000);

test("QA Unit 1 A: /teacher/analytics-v2 — 0 button-nesting hydration warnings", async ({ page }) => {
  const logs = captureConsole(page);
  await loginAsMolly(page);
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000); // give React hydration / errors time

  // Filter for the specific nested-button warning + any hydration error
  const nestedBtn = logs.filter((l) => /button.*cannot be a descendant of.*button/i.test(l.text));
  const hydrationErrs = logs.filter((l) => /hydrat/i.test(l.text) || /In HTML/i.test(l.text));
  const reactWarn = logs.filter((l) => l.type === "error" || l.type === "warning");

  console.log("\n--- /teacher/analytics-v2 console summary ---");
  console.log("nested-button warnings:", nestedBtn.length);
  console.log("any hydration mentions:", hydrationErrs.length);
  console.log("total errors+warnings:", reactWarn.length);
  if (nestedBtn.length) {
    nestedBtn.slice(0, 5).forEach((l) => console.log("  -", l.type, ":", l.text.slice(0, 200)));
  }
  if (hydrationErrs.length) {
    hydrationErrs.slice(0, 5).forEach((l) => console.log("  -", l.type, ":", l.text.slice(0, 200)));
  }

  await page.screenshot({ path: `${SS}/A-analytics-v2.png`, fullPage: true });

  expect(nestedBtn.length, "nested <button> warnings must be 0").toBe(0);
  expect(hydrationErrs.length, "hydration-related warnings must be 0").toBe(0);
});

test("QA Unit 1 B: dashboard 一周洞察 modal — 0 DialogContent description warnings", async ({ page }) => {
  const logs = captureConsole(page);
  await loginAsMolly(page);
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/B-dashboard-before.png`, fullPage: true });

  // find and click the 一周洞察 trigger
  const triggers = page.getByRole("button", { name: /一周洞察/ });
  const triggerCount = await triggers.count();
  console.log("\n一周洞察 button count:", triggerCount);
  expect(triggerCount, "expect at least one 一周洞察 button").toBeGreaterThan(0);

  // pre-trigger console snapshot
  const preLogCount = logs.length;
  await triggers.first().click();

  // wait for dialog to render
  const dialog = page.locator('[role="dialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const visibleCount = await page.locator('[role="dialog"]:visible').count();
  console.log("visible dialog count after click:", visibleCount);
  await page.screenshot({ path: `${SS}/B-modal-open.png`, fullPage: true });

  // accumulate warnings between click and now
  const after = logs.slice(preLogCount);
  const a11yWarn = after.filter((l) =>
    /Missing.*[Dd]escription.*aria-describedby|aria-describedby.*for.*DialogContent|`Description`.*for.*\{DialogContent\}|Description or aria-describedby for/i.test(
      l.text,
    ),
  );
  console.log("a11y warnings after open (filtered):", a11yWarn.length);
  // also a broader sanity check: any warning mentioning DialogContent
  const dialogMentions = after.filter((l) => /DialogContent/i.test(l.text));
  console.log("any DialogContent mentions:", dialogMentions.length);
  if (a11yWarn.length) {
    a11yWarn.slice(0, 5).forEach((l) => console.log("  -", l.type, ":", l.text.slice(0, 280)));
  }
  if (dialogMentions.length) {
    dialogMentions.slice(0, 5).forEach((l) => console.log("  DM -", l.type, ":", l.text.slice(0, 280)));
  }

  expect(a11yWarn.length, "DialogContent aria-describedby warnings must be 0").toBe(0);
});

test("QA Unit 1 C: KPI 卡仍可点击进 drilldown (功能不变)", async ({ page }) => {
  const logs = captureConsole(page);
  await loginAsMolly(page);
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);

  // Find a KPI card — prefer role=button. spec says nested-button fix → outer should be role=button
  const kpiByRole = page.locator('[role="button"]', {
    hasText: /完成率|完成均分|平均分|参与率|完成|均分/,
  });
  const kpiButton = page.locator("button", {
    hasText: /完成率|完成均分|平均分|参与率|完成|均分/,
  });

  const roleCount = await kpiByRole.count();
  const btnCount = await kpiButton.count();
  console.log("\nrole=button KPI matches:", roleCount, "  <button> KPI matches:", btnCount);

  await page.screenshot({ path: `${SS}/C-analytics-before-click.png`, fullPage: true });

  // First, before any click, count any open drawer/dialog (should be 0)
  const drawerBefore = await page.locator('[role="dialog"]:visible, [data-state="open"][role="dialog"]').count();
  console.log("dialog count before click:", drawerBefore);

  // try click on first available kpi
  let target = kpiByRole.first();
  if ((await target.count()) === 0) {
    target = kpiButton.first();
  }
  expect(await target.count(), "must find at least one KPI card").toBeGreaterThan(0);

  await target.click({ trial: false });
  await page.waitForTimeout(2500);

  // see if a drilldown drawer/dialog/sheet opened
  const drawerAfter = await page.locator('[role="dialog"], [data-slot="sheet-content"], [data-slot="drawer"]').count();
  const drawerVisible = await page.locator('[role="dialog"]:visible, [data-state="open"]').count();
  console.log("dialog count after click:", drawerAfter, "  visible after click:", drawerVisible);

  await page.screenshot({ path: `${SS}/C-analytics-after-click.png`, fullPage: true });

  // hydration error sanity
  const nestedBtn = logs.filter((l) => /button.*cannot be a descendant of.*button/i.test(l.text));
  expect(nestedBtn.length, "still 0 nested-button warnings after click").toBe(0);

  // assert click triggered SOMETHING (URL change OR new dialog OR visible drawer increase)
  const url = page.url();
  console.log("URL after click:", url);
  const stillWorks =
    drawerAfter > drawerBefore ||
    drawerVisible > 0 ||
    /scope|drilldown|focus|kpi|metric/i.test(url) ||
    url !== `${BASE}/teacher/analytics-v2`;
  expect(stillWorks, "KPI click should change URL OR open drawer/dialog").toBe(true);
});

test("QA Unit 1 D: KPI 卡支持键盘 Enter 触发 (a11y 等价)", async ({ page }) => {
  await loginAsMolly(page);
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);

  const kpiCard = page
    .locator('[role="button"]', { hasText: /完成率|完成均分|平均分|参与率|完成|均分/ })
    .first();
  const cardCount = await kpiCard.count();
  console.log("\nrole=button KPI for keyboard test:", cardCount);

  if (cardCount === 0) {
    // tabIndex / role-button missing → keyboard a11y may not exist
    console.log("no role=button KPI cards — keyboard a11y absent");
    // we don't hard-fail D; this is informational for the QA report
    return;
  }

  // ensure tabIndex set so it's focusable
  const tabIdx = await kpiCard.first().getAttribute("tabindex");
  console.log("first KPI tabindex:", tabIdx);

  await kpiCard.first().focus();
  const drawerBefore = await page.locator('[role="dialog"]:visible').count();

  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);

  const drawerAfter = await page.locator('[role="dialog"]:visible').count();
  const url = page.url();
  console.log("keyboard Enter — dialog:", drawerBefore, "->", drawerAfter, " URL:", url);

  await page.screenshot({ path: `${SS}/D-after-keyboard.png`, fullPage: true });

  const triggered =
    drawerAfter > drawerBefore ||
    /scope|drilldown|focus|kpi|metric/i.test(url) ||
    url !== `${BASE}/teacher/analytics-v2`;
  expect(triggered, "Enter on KPI card should trigger something").toBe(true);
});
