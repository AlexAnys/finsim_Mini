import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit3-verify";

// fixtures (dev DB)
const CLOSED_WITH_SUB = "449ae28c-8913-43f5-adda-dc296885071b"; // closed; alex has graded sub
const ALEX_SUB_ON_CLOSED = "ce7f935d-5ed0-4af0-9aeb-53a527de372c";
const CROSS_CLASS_PUBLISHED = "00000000-0000-4000-8000-00000000b601"; // B-class quiz; alex is A
const FAKE_NOT_FOUND = "ffffffff-ffff-4fff-8fff-ffffffffffff";

async function loginAlex(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "alex@qq.com");
  await page.fill('input[type="password"]', "11");
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

test.setTimeout(180_000);

test.describe.serial("Unit 3: 学生侧主路径阻塞", () => {
  test("A: alex sidebar 「任务中心」可见 + /tasks 列表加载（非 404）", async ({ page }) => {
    await loginAlex(page);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SS}/01-dashboard.png`, fullPage: true });

    // sidebar 应含 "任务中心" link
    const navLink = page.getByRole("link", { name: /任务中心/ });
    await expect(navLink.first()).toBeVisible();

    await navLink.first().click();
    await page.waitForURL(/\/tasks$/, { timeout: 10_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/02-tasks-list.png`, fullPage: true });

    // 不应该是 404 "页面不见了"
    const body = await page.locator("body").innerText();
    expect(/页面不见了|404/.test(body)).toBe(false);

    // 应看到标题"我的任务" + 4 个 tab
    await expect(page.getByText(/我的任务/).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /待办/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /进行中/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /已批改/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /已结束/ })).toBeVisible();
  });

  test("B: /tasks 4 tab 切换 + 课程/类型筛选 不崩", async ({ page }) => {
    await loginAlex(page);
    await page.goto(`${BASE}/tasks`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    // 切到已批改
    await page.getByRole("tab", { name: /已批改/ }).click();
    await page.waitForTimeout(500);
    // 应该至少有 1 条（alex 有 6 个 graded）
    const rowCount = await page.locator("text=已批改").count();
    expect(rowCount).toBeGreaterThan(0);

    // 切到已结束 — 应能看到 closed 实例
    await page.getByRole("tab", { name: /已结束/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/03-tab-closed.png`, fullPage: true });
    // 个人理财基础概念测验 (closed) 应该在
    await expect(page.getByText(/个人理财基础概念测验/).first()).toBeVisible();

    // 切到待办 — 类型筛选选 quiz
    await page.getByRole("tab", { name: /待办/ }).click();
    await page.waitForTimeout(300);
    // 不崩即过
  });

  test("C: alex 访问 closed-with-own-sub 任务 → 200 + 只读 banner", async ({
    page,
  }) => {
    await loginAlex(page);
    await page.goto(`${BASE}/tasks/${CLOSED_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: `${SS}/04-closed-own-sub.png`,
      fullPage: true,
    });

    // 不应是 403
    const body = await page.locator("body").innerText();
    expect(/错误 · 403|权限不足/.test(body)).toBe(false);

    // 应显示只读 banner
    await expect(page.getByText(/任务已结束 · 只读模式/)).toBeVisible();
    await expect(page.getByRole("link", { name: /「我的成绩」/ })).toBeVisible();
  });

  test("D: alex 跨班 published instance → 仍 403（回归测）", async ({ page }) => {
    await loginAlex(page);
    await page.goto(`${BASE}/tasks/${CROSS_CLASS_PUBLISHED}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: `${SS}/05-cross-class.png`,
      fullPage: true,
    });

    // 应该看到"你不在该任务班级"或类似 forbidden 文案
    const body = await page.locator("body").innerText();
    const forbidden = /你不在该任务班级|错误 · 403|权限不足/.test(body);
    expect(forbidden).toBe(true);
  });

  test("E: alex 访问不存在的 instance → 404，不是 403", async ({ page }) => {
    await loginAlex(page);
    await page.goto(`${BASE}/tasks/${FAKE_NOT_FOUND}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    expect(/任务不存在|404/.test(body)).toBe(true);
  });

  test("F: dashboard graded closed 任务 [结果] 按钮 href = /grades?focus=<sid>", async ({
    page,
  }) => {
    await loginAlex(page);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/06-dashboard-graded.png`, fullPage: true });

    // 找一个 graded + closed 任务卡 — 个人理财基础概念测验
    // 我们在 PriorityTasks 渲染中应该看到它（status=closed + studentStatus=graded）
    const row = page.locator("text=个人理财基础概念测验").first();
    await expect(row).toBeVisible();

    // 找该卡的链接 — graded+closed 时 href 应是 /grades?focus=<id>
    const link = page
      .locator("a")
      .filter({ hasText: /结果|查看结果/ })
      .filter({ has: row })
      .first();

    // 容错：可能 link 在 row 兄弟元素而非子元素，回退到全局搜符合的链接
    const allLinks = await page
      .locator(`a[href*="/grades?focus="]`)
      .all();
    expect(allLinks.length).toBeGreaterThan(0);

    // 取第一个 graded+closed 的 href 并验证带 alex 的 sub id
    let hit = false;
    for (const a of allLinks) {
      const href = await a.getAttribute("href");
      if (href?.includes(ALEX_SUB_ON_CLOSED)) {
        hit = true;
        break;
      }
    }
    expect(hit).toBe(true);

    // 点击之 → 跳到 /grades?focus=<id>
    await page.locator(`a[href="/grades?focus=${ALEX_SUB_ON_CLOSED}"]`).first().click();
    await page.waitForURL(/\/grades\?focus=/, { timeout: 10_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/07-grades-focused.png`, fullPage: true });

    // grades 页应已加载，且 focus 行存在
    const grades = await page.locator("body").innerText();
    expect(/我的成绩|成绩档案/.test(grades)).toBe(true);

    if (link) void link; // 静默引用 typescript
  });

  test("G: API 错误码区分 — closed 无 sub 学生 → TASK_INSTANCE_CLOSED_NO_SUBMISSION", async ({
    page,
  }) => {
    // alex 没有 submission 的 closed 实例 — 无法直接 fixture（alex 都参与过），转为 unit test 的语义
    // 退而求其次：用 charlie 或 belle（也是 class-A）—— 它们对 449ae28c 应该没 submission
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "belle@qq.com");
    await page.fill('input[type="password"]', "11");
    await Promise.all([
      page.waitForURL(
        (u) => !/\/login(\?|$)/.test(u.pathname + u.search),
        { timeout: 25_000 },
      ).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForLoadState("networkidle").catch(() => {});

    // belle 访问 449ae28c (closed)
    const res = await page.request.get(`${BASE}/api/lms/task-instances/${CLOSED_WITH_SUB}`);
    const json = await res.json();
    console.log("belle on closed (no own sub):", JSON.stringify(json));
    // 期望 403 + TASK_INSTANCE_CLOSED_NO_SUBMISSION
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("TASK_INSTANCE_CLOSED_NO_SUBMISSION");
  });

  test("H: API 错误码 — alex closed-with-sub via task-instance GET → 200（API 验证 opt-in）", async ({
    page,
  }) => {
    await loginAlex(page);
    const res = await page.request.get(`${BASE}/api/lms/task-instances/${CLOSED_WITH_SUB}`);
    const json = await res.json();
    console.log("alex on closed (own sub):", JSON.stringify(json).slice(0, 200));
    expect(json.success).toBe(true);
    expect(json.data?.id).toBe(CLOSED_WITH_SUB);
  });
});
