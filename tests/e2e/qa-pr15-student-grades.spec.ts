/**
 * PR-15 builder-student-fixes 真浏览器 E2E
 *
 * 覆盖:
 * - bug 6 (P0): 学生 /grades 评分页
 *   (a) 评价维度显示中文 name (criterionId CUID 不外漏)
 *   (b) 模拟对话历史时间轴气泡 (transcript section)
 *   (c) 移动端 375x667 viewport 完整显示无横向溢出
 * - bug 5: 学生 dashboard 任务区可滚动 (max-h-[60vh]/[500px] + overflow-y-auto)
 *
 * 使用 alex@qq.com (有真实评过的 sim 提交 #25cf3504...
 *   含 5 个评分标准 + 1 transcript 消息 — 满足 bug 6a/b 的"真浏览器看到 name 而非 CUID")
 *
 * 不破坏 DB: 纯读 + 截图; 不创建/删除任何记录
 */
import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/pr15-student-fixes";

async function login(page: Page, email: string, password: string) {
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
}

test.setTimeout(180_000);

test.describe("PR-15 bug 6 · 学生 /grades 评分页 (P0)", () => {
  test("桌面: 维度显示 name (非 CUID) + transcript 气泡 + 分数完整", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 250));
    });

    await login(page, "alex@qq.com", "11");
    // 点击 alex 评过的 simulation 提交 — id 25cf3504... (releasedAt 非 null, 5 criteria + 1 transcript msg)
    await page.goto(`${BASE}/grades`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // 切到模拟 tab 优先 (确保选中行是 sim)
    const simTab = page.locator("button:has-text('模拟')").first();
    if (await simTab.isVisible()) {
      await simTab.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SS}/desktop-01-grades-list.png`, fullPage: true });

    const bodyText = await page.locator("body").innerText();

    // bug 6a 断言: 至少一个真实 criterion name 出现 (alex@qq.com 评分有: 开场与建立信任, 需求识别, 风险偏好评估, 沟通技巧, 初步建议合理性)
    const expectedNames = [
      "开场与建立信任",
      "需求识别",
      "风险偏好评估",
      "沟通技巧",
      "初步建议合理性",
    ];
    const matchedNames = expectedNames.filter((n) => bodyText.includes(n));
    console.log("[bug6a desktop] 命中 criterion 中文名:", matchedNames);
    expect(matchedNames.length, "至少一个 ScoringCriterion.name 应该真的渲染出来 (CUID 不再外漏)").toBeGreaterThanOrEqual(1);

    // bug 6a 断言反向: criterionId CUID 不再外漏成可见文本 (alex sim 第一个 criterion = 872e174b-f683-4f08-a2b0-9e6ddf79f461)
    const knownCuidLeak = "872e174b-f683-4f08-a2b0-9e6ddf79f461";
    expect(bodyText, "CUID 字符串不应作为维度名出现在页面文本中").not.toContain(knownCuidLeak);

    // bug 6b 断言: 完整对话记录 section 标题 (transcript 至少有 1 条)
    const transcriptHeader = await page.locator("text=/完整对话记录/").count();
    console.log("[bug6b desktop] 完整对话记录 section 命中:", transcriptHeader);
    expect(transcriptHeader, "transcript section 应在 released simulation 出现").toBeGreaterThan(0);

    // 评分明细 header 也应出现
    const rubricHeader = await page.locator("text=/评分明细/").count();
    expect(rubricHeader, "评分明细 header 应渲染").toBeGreaterThan(0);

    // 截图维度区域细节
    const panel = page.locator("text=/评分明细/").first().locator("..").locator("..");
    if (await panel.isVisible()) {
      await panel.screenshot({ path: `${SS}/desktop-02-rubric-detail.png` });
    }

    console.log("[bug6 desktop] CONSOLE ERRORS:", consoleErrors.slice(0, 8));
    expect(
      consoleErrors.filter(
        (e) =>
          !e.includes("Failed to load resource") &&
          !e.includes("favicon") &&
          !e.includes("ChunkLoadError"),
      ).length,
      "页面真实运行不应有 pageerror / runtime error",
    ).toBeLessThanOrEqual(0);
  });

  test("移动端 375x667: 完整显示 + 无横向溢出 + 维度 + 对话可读", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const consoleErrors: string[] = [];
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 250)}`));

    await login(page, "alex@qq.com", "11");
    await page.goto(`${BASE}/grades`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    // 切到模拟 tab
    const simTab = page.locator("button:has-text('模拟')").first();
    if (await simTab.isVisible()) {
      await simTab.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: `${SS}/mobile-01-grades-top.png`, fullPage: true });

    // bug 6c 断言: 无横向溢出 — body scrollWidth ≤ window.innerWidth (允许 1px 误差)
    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        innerWidth: window.innerWidth,
      };
    });
    console.log("[bug6c mobile] viewport 宽度检查:", overflow);
    expect(
      overflow.scrollWidth - overflow.innerWidth,
      "375px viewport 下页面不应横向溢出 (scrollWidth > innerWidth)",
    ).toBeLessThanOrEqual(1);

    const bodyText = await page.locator("body").innerText();

    // bug 6a 移动端: criterion 中文名仍可见
    const expectedNames = ["开场与建立信任", "需求识别"];
    const matchedNames = expectedNames.filter((n) => bodyText.includes(n));
    console.log("[bug6a mobile] 命中 criterion 中文名:", matchedNames);
    expect(matchedNames.length, "移动端维度 name 应渲染").toBeGreaterThanOrEqual(1);

    // bug 6b 移动端: transcript section 标题可见
    const transcriptHeader = await page.locator("text=/完整对话记录/").count();
    expect(transcriptHeader, "移动端 transcript section 应可见").toBeGreaterThan(0);

    // 滚动到 transcript 截图
    await page.locator("text=/完整对话记录/").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SS}/mobile-02-transcript.png`, fullPage: true });

    console.log("[bug6 mobile] CONSOLE ERRORS:", consoleErrors);
    expect(consoleErrors.length, "移动端不应有 pageerror").toBe(0);
  });
});

test.describe("PR-15 bug 5 · 学生 dashboard 任务区可滚动", () => {
  test("桌面: priority-tasks 区有 overflow-y-auto + max-height 限制", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, "alex@qq.com", "11");
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${SS}/desktop-03-dashboard.png`, fullPage: true });

    // 验证滚动容器存在
    const scroller = page.locator('[data-testid="priority-tasks-scroll"]');
    await expect(scroller, "priority-tasks 滚动容器应存在").toBeVisible();

    const style = await scroller.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflowY: cs.overflowY, maxHeight: cs.maxHeight };
    });
    console.log("[bug5 desktop] 滚动容器 computed style:", style);
    expect(style.overflowY, "overflowY 应为 auto").toBe("auto");
    // max-height 应是一个 px 数值 (500px 桌面)
    expect(style.maxHeight, "max-height 应设置").toMatch(/\dpx$/);

    // 不再有"查看全部 N 项 →"链接 (Unit 14 折叠已撤)
    const viewAllLink = await page.locator("text=/查看全部 \\d+ 项/").count();
    console.log("[bug5 desktop] '查看全部' 链接命中:", viewAllLink);
    expect(viewAllLink, "Unit 14 '查看全部' 链接已被滚动容器替换").toBe(0);
  });

  test("移动端 375x667: priority-tasks 滚动容器仍有 max-height", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, "alex@qq.com", "11");
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);

    await page.screenshot({ path: `${SS}/mobile-03-dashboard.png`, fullPage: true });

    const scroller = page.locator('[data-testid="priority-tasks-scroll"]');
    await expect(scroller).toBeVisible();

    const style = await scroller.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflowY: cs.overflowY, maxHeight: cs.maxHeight };
    });
    console.log("[bug5 mobile] 滚动容器 computed style:", style);
    expect(style.overflowY).toBe("auto");
    expect(style.maxHeight).toMatch(/\dpx$/);

    // 不破坏 dashboard 其它模块 — KPI 卡 + AiBuddyCallout (compact 在 hero accessory 内)
    const kpiVisible = await page.locator("text=/本周待办|本周完成|平均得分/").count();
    expect(kpiVisible, "KPI 卡片应仍可见 (PriorityTasks 滚动不破坏 dashboard 整体布局)").toBeGreaterThan(0);
  });
});
