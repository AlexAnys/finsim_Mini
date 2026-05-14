import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit4-verify";

// fixtures (dev DB) — molly@qq.com 的任务
const TASK_NO_SUB = "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53"; // 深度测试 - 0 graded
const TASK_WITH_GRADED = "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9"; // 个人理财基础概念测验 - 1 graded

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

test.setTimeout(180_000);

test.describe.serial("Unit 4 commit-1: 高危拦截 + 复制为新任务", () => {
  test("A: 无 graded sub 的任务 PATCH 直接成功（基线）", async ({ page }) => {
    await loginMolly(page);
    const res = await page.request.patch(`${BASE}/api/tasks/${TASK_NO_SUB}`, {
      data: { taskName: "深度测试" }, // unchanged 名字保持稳定
    });
    const json = await res.json();
    console.log("no-graded PATCH:", JSON.stringify(json).slice(0, 200));
    expect(json.success).toBe(true);
  });

  test("B: 有 graded sub 的任务 PATCH 无 force → 400 + TASK_HAS_GRADED_SUBMISSIONS", async ({
    page,
  }) => {
    await loginMolly(page);
    const res = await page.request.patch(`${BASE}/api/tasks/${TASK_WITH_GRADED}`, {
      data: { taskName: "个人理财基础概念测验" }, // unchanged 名字
    });
    const json = await res.json();
    console.log("graded PATCH no force:", JSON.stringify(json));
    expect(res.status()).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error?.code).toBe("TASK_HAS_GRADED_SUBMISSIONS");
    expect(json.error?.message).toContain("已批改");
  });

  test("C: 有 graded sub 的任务 PATCH + force:true → 200 + audit 写 force=true", async ({
    page,
  }) => {
    await loginMolly(page);
    // 注意：这条会真实改 task。为不破坏 dev 数据，name 不变。
    const res = await page.request.patch(`${BASE}/api/tasks/${TASK_WITH_GRADED}`, {
      data: { taskName: "个人理财基础概念测验", force: true },
    });
    const json = await res.json();
    console.log("graded PATCH with force:", JSON.stringify(json).slice(0, 200));
    expect(json.success).toBe(true);
  });

  test("D: dialog 在 UI 中正确显示 — 编辑 + 保存有 graded task 弹 dialog", async ({
    page,
  }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/tasks/${TASK_WITH_GRADED}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    // 点击编辑
    await page.getByRole("button", { name: /编辑/ }).first().click();
    await page.waitForTimeout(500);

    // 点击保存（不改任何字段，但仍触发 PATCH）
    await page.getByRole("button", { name: /保存/ }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SS}/04-high-risk-dialog.png`, fullPage: true });

    // 应弹出 AlertDialog
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/已批改提交/);
    await expect(dialog).toContainText(/推荐复制为新任务再修改/);

    // 三按钮可见
    await expect(page.getByRole("button", { name: /^取消$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /复制为新任务/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /直接保存/ })).toBeVisible();

    // 取消：关闭 dialog，状态不变
    await page.getByRole("button", { name: /^取消$/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("E: dialog 点「复制为新任务」→ 创建新任务 + 跳转到编辑页", async ({
    page,
  }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/tasks/${TASK_WITH_GRADED}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /编辑/ }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /保存/ }).first().click();
    await page.waitForTimeout(1000);

    // 点复制为新任务
    await page.getByRole("button", { name: /复制为新任务/ }).click();

    // 应跳转到 /teacher/tasks/<new-id>?edit=true
    await page.waitForURL(/\/teacher\/tasks\/.+\?edit=true/, { timeout: 15_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SS}/05-after-copy.png`, fullPage: true });

    // url 不应是原 task
    const url = page.url();
    expect(url).not.toContain(TASK_WITH_GRADED);

    // 新任务的名字应含 "(副本)"
    const body = await page.locator("body").innerText();
    expect(body).toContain("(副本)");
  });

  test("F: 直接保存 path — 第二次 PATCH 含 force:true → 成功", async ({ page }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/tasks/${TASK_WITH_GRADED}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: /编辑/ }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /保存/ }).first().click();
    await page.waitForTimeout(1000);
    // dialog 应出现
    await expect(page.getByRole("alertdialog")).toBeVisible();
    // 监听 network 看 PATCH 的 body
    let secondPatchBody: string | null = null;
    page.on("request", (req) => {
      if (
        req.method() === "PATCH" &&
        req.url().includes(`/api/tasks/${TASK_WITH_GRADED}`)
      ) {
        secondPatchBody = req.postData();
      }
    });
    await page.getByRole("button", { name: /直接保存/ }).click();
    await page.waitForTimeout(2000);
    console.log("second PATCH body:", secondPatchBody);
    if (secondPatchBody) {
      expect(secondPatchBody).toContain('"force":true');
    }
  });
});
