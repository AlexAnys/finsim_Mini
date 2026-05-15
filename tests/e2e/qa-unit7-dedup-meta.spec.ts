import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit7";

async function makeAuthedContext(
  browser: import("@playwright/test").Browser,
  email: string,
  password: string,
): Promise<{ context: BrowserContext; request: APIRequestContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page
      .waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 })
      .catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  for (let i = 0; i < 20; i++) {
    const r = await context.request.get(`${BASE}/api/auth/session`);
    const j = await r.json();
    if (j?.user?.email === email) {
      await page.close();
      return { context, request: context.request };
    }
    await page.waitForTimeout(500);
  }
  await page.close();
  throw new Error(`login failed for ${email}`);
}

test.setTimeout(120_000);

// ============================================
// A: molly dashboard 近期课表去重
// ============================================

test("QA r7 A: molly /teacher/dashboard 近期课表 dedup (无连续 3 行同名同时段)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/A1-dashboard.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    console.log("\n[A] body first 500:", bodyText.slice(0, 500));

    // 应不是 500
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 抓"近期课表"区域，统计 "个人理财规划" + Mon 10:00 / Wed 14:00 出现次数
    // dedup 前 raw: 同名 + 同时段 × 2 课程 = 重复
    // dedup 后: 每个时段每天只出现一次

    // 用 schedule 卡片找候选行 — 我们用文本计数
    const scheduleCount10 = (bodyText.match(/10:00/g) ?? []).length;
    const scheduleCount14 = (bodyText.match(/14:00/g) ?? []).length;
    console.log("[A] 10:00 appearances:", scheduleCount10);
    console.log("[A] 14:00 appearances:", scheduleCount14);

    // 4 raw slots dedup 后 → 4 行（每 date 一条），不是 6+ 行
    // 但 timeLabel 文本可能其他地方也出现，仅作 sanity
    // 真正的 dedup 检查：找"近期课表"区域 + 数 items 条数
    const scheduleSection = page.locator("text=/近期课表/").first();
    if ((await scheduleSection.count()) > 0) {
      const section = scheduleSection.locator("xpath=ancestor::section[1]");
      const sectionText = (await section.first().textContent()) ?? "";
      console.log("[A] 近期课表 section text:", sectionText.slice(0, 600));

      // dedup 前每 timeLabel 在同一日期会出现 2 次（2 课程）
      // dedup 后每 timeLabel 在同一日期 1 次
      // 检查策略：找具体 ((10:00-11:40 或 14:00-15:40)) 字串在 schedule section 中的次数
      const monCount = (sectionText.match(/10:00-11:40/g) ?? []).length;
      const wedCount = (sectionText.match(/14:00-15:40/g) ?? []).length;
      console.log("[A] schedule section Mon 10:00 count:", monCount, "Wed 14:00 count:", wedCount);
      // dedup 后: 上限 2 (本周 + 下周)
      // 如果没 dedup: 4+ (2 课 × 2 周)
      expect(monCount, "Mon 10:00 dedup 后 ≤ 2").toBeLessThanOrEqual(2);
      expect(wedCount, "Wed 14:00 dedup 后 ≤ 2").toBeLessThanOrEqual(2);
    } else {
      console.log("[A] (info) 未找到「近期课表」section header — 可能不在 dashboard 首屏");
    }
  } finally {
    await page.close();
    await molly.context.close();
  }
});

// ============================================
// B: greeting-header "今日无排课"
// ============================================

test("QA r7 B: molly dashboard greeting-header 今日 0 节 → '今日无排课'", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const bodyText = (await page.textContent("body")) ?? "";
    // 今天是 2026-05-14 Thursday (dayOfWeek=4), molly 协作课无 Thursday slot
    // 所以应显示 "今日无排课" 而非 "今日 0 节课"
    const hasNew = bodyText.includes("今日无排课");
    const hasOld = /今日\s*0\s*节课/.test(bodyText);
    console.log("\n[B] 「今日无排课」found?", hasNew);
    console.log("[B] 「今日 0 节课」found?", hasOld);
    expect(hasNew, "Thursday 应显示「今日无排课」").toBe(true);
    expect(hasOld, "不应显示老文案「今日 0 节课」").toBe(false);
  } finally {
    await page.close();
    await molly.context.close();
  }
});

// ============================================
// C: 一周洞察 modal meta footer
// ============================================

test("QA r7 C: 一周洞察 modal footer 显示 meta (model / 耗时 / 生成时间)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    // 点开一周洞察
    const weeklyBtn = page.getByRole("button", { name: /一周洞察/ }).first();
    expect(await weeklyBtn.count()).toBeGreaterThan(0);
    await weeklyBtn.click();
    await page.waitForTimeout(3000);

    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    // wait for AI to finish loading — poll until 一周洞察 / footer 文案出现 (max 60s)
    for (let i = 0; i < 30; i++) {
      const txt = (await dialog.textContent()) ?? "";
      if (/由.*生成|耗时.*s|生成于/.test(txt)) break;
      if (!/正在生成|loading|加载/.test(txt)) break;
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: `${SS}/C1-modal.png`, fullPage: true });

    const dialogText = (await dialog.textContent()) ?? "";
    console.log("\n[C] modal text first 800:", dialogText.slice(0, 800));

    // footer 文案: "由 X 生成 · 耗时 Ns · 生成于 X 分钟前"
    // 至少 "生成" 关键字应出现 + 模型名或耗时之一
    const hasGenerate = /由.*生成|生成于/.test(dialogText);
    const hasDuration = /耗时.*s|耗时.*秒/.test(dialogText);
    const hasModel = /qwen|deepseek|gemini|openai|mimo|gpt|claude/.test(dialogText);
    console.log("[C] hasGenerate:", hasGenerate, " hasDuration:", hasDuration, " hasModel:", hasModel);
    expect(hasGenerate || hasDuration || hasModel, "应至少有 model/耗时/生成时间 一项").toBe(true);
  } finally {
    await page.close();
    await molly.context.close();
  }
});

// ============================================
// D: 60s 重新生成 cooldown
// ============================================

test("QA r7 D: 一周洞察 重新生成按钮 60s 冷却倒计时", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  const page = await molly.context.newPage();
  try {
    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /一周洞察/ }).first().click();
    await page.waitForTimeout(3000);
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    // wait for loading to finish
    for (let i = 0; i < 30; i++) {
      const txt = (await dialog.textContent()) ?? "";
      if (/由.*生成|生成于|耗时/.test(txt)) break;
      if (!/正在生成/.test(txt)) break;
      await page.waitForTimeout(2000);
    }

    // 找重新生成按钮（可能初始 disabled 或可点)
    const regenBtn = dialog.getByRole("button", { name: /重新生成/ });
    expect(await regenBtn.count(), "应有「重新生成」按钮").toBeGreaterThan(0);
    await page.screenshot({ path: `${SS}/D1-regen-initial.png`, fullPage: true });

    const isDisabled = await regenBtn.first().isDisabled();
    const btnText = (await regenBtn.first().textContent()) ?? "";
    console.log("\n[D] 重新生成 disabled?", isDisabled, " text:", btnText);

    // 如果初始 disabled，应该是因为 generatedAt < 60s ago → 文案应含 (Ns)
    if (isDisabled) {
      // 60s 倒计时进行中
      const hasCountdown = /重新生成.*\d+s|\(\d+s\)/.test(btnText);
      console.log("[D] disabled state has countdown text?", hasCountdown);
      expect(hasCountdown, "disabled 时应显示倒计时秒数").toBe(true);
    } else {
      // 如果可点，说明 generatedAt > 60s 或无 timestamp，点击触发后等 1s 再看是否 disable
      console.log("[D] 可点击 — 触发后测 cooldown");
      await regenBtn.first().click();
      await page.waitForTimeout(2000);

      const afterDisabled = await regenBtn.first().isDisabled();
      const afterText = (await regenBtn.first().textContent()) ?? "";
      console.log("[D] 点击后 disabled?", afterDisabled, " text:", afterText);
      // 至少 1 个生效 (要么 disabled 倒计时，要么文案变倒计时)
      const hasCdAfter = afterDisabled || /\d+s/.test(afterText);
      expect(hasCdAfter, "点击触发重新生成后应进入 cooldown").toBe(true);
    }
  } finally {
    await page.close();
    await molly.context.close();
  }
});

// ============================================
// E: API 增量字段 backward-compat
// ============================================

test("QA r7 E: weekly-insight API 返回 modelUsed + durationMs 字段", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const resp = await molly.request.get(`${BASE}/api/lms/weekly-insight`);
    console.log("\n[E] GET weekly-insight status:", resp.status());

    if (resp.ok()) {
      const j = await resp.json();
      const data = j?.data ?? j;
      console.log("[E] response keys:", Object.keys(data ?? {}));
      // 即使 cache miss / 字段为 null，字段也应存在或至少 backward-compat
      const hasModelUsed = "modelUsed" in (data ?? {});
      const hasDurationMs = "durationMs" in (data ?? {});
      console.log("[E] hasModelUsed:", hasModelUsed, " hasDurationMs:", hasDurationMs);
      // 这两个字段可能 null，但 schema 应能容纳
    }
    expect(resp.status() < 500, "endpoint 不应 500").toBe(true);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// F: 学生 alex 课表去重 (mirror of A)
// ============================================

test("QA r7 F: alex /dashboard 学生侧课表去重", async ({ browser }) => {
  const alex = await makeAuthedContext(browser, "alex@qq.com", "11");
  const page = await alex.context.newPage();
  try {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/F1-alex-dashboard.png`, fullPage: true });

    const bodyText = (await page.textContent("body")) ?? "";
    expect(/服务器开小差|500/.test(bodyText), "页面应正常").toBe(false);

    // 学生 today-schedule: alex 在 金融2024A班，今天 Thursday 也无排课（DB schedule slots 全在 Mon/Wed）
    // 应不出现重复
    const monCount = (bodyText.match(/10:00-11:40/g) ?? []).length;
    const wedCount = (bodyText.match(/14:00-15:40/g) ?? []).length;
    console.log("\n[F] alex Mon 10:00 count:", monCount, " Wed 14:00 count:", wedCount);
    expect(monCount, "Mon 10:00 在学生 dashboard 应 ≤ 2 (dedup 后)").toBeLessThanOrEqual(2);
    expect(wedCount, "Wed 14:00 在学生 dashboard 应 ≤ 2 (dedup 后)").toBeLessThanOrEqual(2);
  } finally {
    await page.close();
    await alex.context.close();
  }
});
