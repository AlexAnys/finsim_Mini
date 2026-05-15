import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit2-verify";

// 来自当前 dev DB 状态（molly 的 3 个实例）
const CLOSED_INSTANCE_WITH_SUB = "449ae28c-8913-43f5-adda-dc296885071b"; // closed + 1 graded submission
const PUBLISHED_INSTANCE_NO_SUB = "a7d9b380-49fd-4ce2-9d95-000935ac0c5a"; // published, 0 sub

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

test.describe.serial("Unit 2: 任务实例状态机", () => {
  test("A: 已关闭实例详情页有「重新开放」+「删除实例」（删除 disabled，因有提交）", async ({
    page,
  }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/instances/${CLOSED_INSTANCE_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/01-closed-detail.png`, fullPage: true });

    const reopen = page.getByRole("button", { name: /重新开放/ });
    await expect(reopen).toBeVisible();

    // 删除按钮（有提交时 disabled，tooltip 提示）
    const deleteBtn = page.getByRole("button", { name: /删除实例/ });
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toBeDisabled();

    // hover 出 tooltip "已有学生提交，无法删除"
    // disabled button 不能直接 hover（pointer-events:none），需 hover 外层 tooltip-trigger span
    const tipTrigger = page.locator('[data-slot="tooltip-trigger"]').filter({
      has: page.getByRole("button", { name: /删除实例/ }),
    });
    await tipTrigger.first().hover();
    await page.waitForTimeout(500);
    const tip = page.getByText(/已有学生提交，无法删除/);
    await expect(tip).toBeVisible();
  });

  test("B: 已关闭实例 → 点重新开放 → 状态回 published；UI 切换回 [关闭实例]/[开始批改]", async ({
    page,
  }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/instances/${CLOSED_INSTANCE_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /重新开放/ }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/02-after-reopen.png`, fullPage: true });

    // 按钮组应切换为 published 的：关闭实例 + 开始批改
    await expect(page.getByRole("button", { name: /关闭实例/ })).toBeVisible();
    // 状态 chip 应该是「已发布」
    const statusBadge = page.getByText("已发布").first();
    await expect(statusBadge).toBeVisible();
  });

  test("C: 已发布实例 → 点关闭实例 → 弹 confirm dialog 含「答卷仍可在「成绩」中回看」", async ({
    page,
  }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/instances/${CLOSED_INSTANCE_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /关闭实例/ }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SS}/03-close-confirm.png`, fullPage: true });

    // confirm dialog 出现
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/关闭后学生无法继续答题/);
    await expect(dialog).toContainText(/答卷仍可在「成绩」中回看/);

    // 点取消 → dialog 关，状态不变
    await page.getByRole("button", { name: /取消/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    // 再点关闭 → 弹 → 确认 → 状态变 closed
    await page.getByRole("button", { name: /关闭实例/ }).click();
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /确认关闭/ }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/04-after-close.png`, fullPage: true });

    await expect(page.getByRole("button", { name: /重新开放/ })).toBeVisible();
  });

  test("D: 学生 alex 视角 — closed 状态访问 /tasks/<id> 应 403；reopen 后能可见", async ({
    page,
  }) => {
    // 先让实例处于 closed（C 测完后已 closed）
    // alex 直接进 /tasks/<id> 看是否 403
    await loginAlex(page);
    await page.goto(`${BASE}/tasks/${CLOSED_INSTANCE_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/05-alex-closed.png`, fullPage: true });

    // 应看到 ForbiddenState 或类似 403 提示
    const bodyText = await page.locator("body").innerText();
    const isForbidden =
      /没有权限|无权限|没有访问权|不能访问|FORBIDDEN|403|任务尚未开放|任务已结束/i.test(
        bodyText,
      );
    console.log("alex closed body text snippet:", bodyText.slice(0, 300));
    expect(isForbidden).toBe(true);

    // logout alex, login molly, reopen
    await page.context().clearCookies();
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/instances/${CLOSED_INSTANCE_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /重新开放/ }).click();
    await page.waitForTimeout(2000);

    // logout molly, login alex 再进
    await page.context().clearCookies();
    await loginAlex(page);
    await page.goto(`${BASE}/tasks/${CLOSED_INSTANCE_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/06-alex-reopened.png`, fullPage: true });

    const bodyText2 = await page.locator("body").innerText();
    const isAccessible =
      !/没有权限|无权限|没有访问权|不能访问|FORBIDDEN|403|任务尚未开放/i.test(
        bodyText2,
      );
    console.log("alex reopened body text snippet:", bodyText2.slice(0, 300));
    expect(isAccessible).toBe(true);
  });

  test("E: 列表页 closed tab 行尾有重新开放 + 删除（按提交数判断 disabled）", async ({
    page,
  }) => {
    // 准备 — 先把 449ae28c 关回 closed（因为 D 测试 reopen 了它）
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/instances/${CLOSED_INSTANCE_WITH_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    // 若当前是 published，关掉
    const closeBtn = page.getByRole("button", { name: /关闭实例/ });
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: /确认关闭/ }).click();
      await page.waitForTimeout(1500);
    }

    // 进列表 → 已关闭 tab
    await page.goto(`${BASE}/teacher/instances`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole("tab", { name: /已关闭/ }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${SS}/07-list-closed.png`, fullPage: true });

    // 应看到至少 1 行 + 「重新开放」按钮
    const reopen = page.getByRole("button", { name: /重新开放/ });
    await expect(reopen.first()).toBeVisible();
  });

  test("F: API 错误码 — 有 submission 的实例 DELETE 应返回 INSTANCE_HAS_SUBMISSIONS", async ({
    page,
  }) => {
    await loginMolly(page);
    // 直接 fetch DELETE 看响应
    const res = await page.request.delete(
      `${BASE}/api/lms/task-instances/${CLOSED_INSTANCE_WITH_SUB}`,
    );
    const json = await res.json();
    console.log("DELETE response:", JSON.stringify(json));
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("INSTANCE_HAS_SUBMISSIONS");
  });

  test("G: API 错误码 — published 实例 DELETE 应返回 TASK_INSTANCE_NOT_DELETABLE", async ({
    page,
  }) => {
    await loginMolly(page);
    // 确保 PUBLISHED_INSTANCE_NO_SUB 是 published 状态（fixture 应该是的）
    const res = await page.request.delete(
      `${BASE}/api/lms/task-instances/${PUBLISHED_INSTANCE_NO_SUB}`,
    );
    const json = await res.json();
    console.log("DELETE response:", JSON.stringify(json));
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("TASK_INSTANCE_NOT_DELETABLE");
  });

  test("H: API 错误码 — published 实例 reopen 应返回 TASK_INSTANCE_NOT_REOPENABLE", async ({
    page,
  }) => {
    await loginMolly(page);
    const res = await page.request.post(
      `${BASE}/api/lms/task-instances/${PUBLISHED_INSTANCE_NO_SUB}/reopen`,
    );
    const json = await res.json();
    console.log("reopen published response:", JSON.stringify(json));
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("TASK_INSTANCE_NOT_REOPENABLE");
  });
});
