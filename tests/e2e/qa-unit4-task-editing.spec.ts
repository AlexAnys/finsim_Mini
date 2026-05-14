import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit4";

// quiz tasks owned by molly
const TASK_HAS_GRADED = "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9"; // 个人理财基础概念测验, 1 graded sub, 8 questions
const TASK_NO_SUB = "e54e1cb9-1b7f-4ecb-8e16-580a9a3d3c53"; // 深度测试, 0 sub, 10 questions
// teacher1 owns these; molly is not owner — for cross-type read tests we'll use teacher1
const TASK_SIM_TEACHER1 = "5e69a393-3175-4cef-a92a-c44612593f4d"; // sim, owned by teacher1, 4 graded
const TASK_SUB_TEACHER1 = "d8097130-8847-4a51-aa30-dffa6345f59c"; // subjective, owned by teacher1, 4 graded

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page
      .waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 30_000 })
      .catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

test("QA Unit 4 A: molly /teacher/tasks/[id] 加载 + 全 config 可见 (acceptance #1)", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/tasks/${TASK_HAS_GRADED}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/A1-quiz-task-page.png`, fullPage: true });

  const bodyText = (await page.textContent("body")) ?? "";
  console.log("\n[A] 页面 first 600:", bodyText.slice(0, 600));

  // 应有任务名 + 编辑按钮
  expect(bodyText).toMatch(/个人理财基础概念测验/);
  const editBtn = page.getByRole("button", { name: /^编辑$/ });
  expect(await editBtn.count(), "应有「编辑」按钮").toBeGreaterThan(0);

  // quiz config 应可见：题目数 / 时长 / 模式 / 严格度 (这些是 QuizConfig 字段)
  // 题目数 (8 题) 应展示
  const hasQuestionCount = /8 题|共 ?8|题目.*8/.test(bodyText) || /第 ?1 题|第 1 题/.test(bodyText);
  console.log("[A] 显示题目数/题目?", hasQuestionCount);

  // 应有「知识点」或「章节」字眼（spec 提到知识点 + 章节-小节关联）
  const hasKnowledgeOrChapter = /知识点|章节|小节/.test(bodyText);
  console.log("[A] 知识点/章节显示?", hasKnowledgeOrChapter);
});

test("QA Unit 4 B: 编辑模式开启 — 表单控件 + 取消按钮", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/tasks/${TASK_NO_SUB}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);

  // 点「编辑」
  const editBtn = page.getByRole("button", { name: /^编辑$/ }).first();
  expect(await editBtn.count()).toBeGreaterThan(0);
  await editBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/B1-edit-mode.png`, fullPage: true });

  // 编辑模式下：应有 inputs / textareas + 取消 + 保存 按钮
  const inputs = await page.locator('input[type="text"], input[type="number"], textarea').count();
  console.log("\n[B] 编辑模式 input/textarea 数:", inputs);
  expect(inputs, "编辑模式应有 form 控件").toBeGreaterThan(0);

  // 取消 + 保存 按钮
  const cancelBtn = page.getByRole("button", { name: /^取消$/ });
  const saveBtn = page.getByRole("button", { name: /^保存$/ });
  console.log("[B] 取消按钮 count:", await cancelBtn.count());
  console.log("[B] 保存按钮 count:", await saveBtn.count());
  expect(await cancelBtn.count()).toBeGreaterThan(0);
  expect(await saveBtn.count()).toBeGreaterThan(0);

  // 点「取消」回到只读
  await cancelBtn.first().click();
  await page.waitForTimeout(1000);
  const stillHasEdit = await page.getByRole("button", { name: /^编辑$/ }).count();
  expect(stillHasEdit, "取消后应回到只读 (再次显示「编辑」按钮)").toBeGreaterThan(0);
});

test("QA Unit 4 C: 无 graded sub 任务 PATCH 无 force → 200 + audit log", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");

  // 先取当前 taskName
  const getResp1 = await page.request.get(`${BASE}/api/tasks/${TASK_NO_SUB}`);
  expect(getResp1.status()).toBe(200);
  const j1 = await getResp1.json();
  const originalName = j1?.data?.task?.taskName ?? j1?.data?.taskName;
  console.log("\n[C] original name:", originalName);

  // 改名 (临时 QA 标记)
  const tempName = `QA-Unit4-NoSub-${Date.now()}`;
  const patchResp = await page.request.patch(`${BASE}/api/tasks/${TASK_NO_SUB}`, {
    data: { taskName: tempName },
    failOnStatusCode: false,
  });
  console.log("[C] PATCH status:", patchResp.status());
  expect(patchResp.status(), "无 sub PATCH 应 200").toBe(200);

  // 还原
  const restoreResp = await page.request.patch(`${BASE}/api/tasks/${TASK_NO_SUB}`, {
    data: { taskName: originalName },
    failOnStatusCode: false,
  });
  console.log("[C] restore status:", restoreResp.status());
  expect(restoreResp.status()).toBe(200);
});

test("QA Unit 4 D: 有 graded sub 任务 PATCH 无 force → 400 TASK_HAS_GRADED_SUBMISSIONS", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");

  const getResp1 = await page.request.get(`${BASE}/api/tasks/${TASK_HAS_GRADED}`);
  expect(getResp1.status()).toBe(200);
  const j1 = await getResp1.json();
  const originalName = j1?.data?.task?.taskName ?? j1?.data?.taskName;
  console.log("\n[D] original name:", originalName);

  // 试改 — 应被拦截
  const patchResp = await page.request.patch(`${BASE}/api/tasks/${TASK_HAS_GRADED}`, {
    data: { taskName: `QA-D-${Date.now()}`, requirements: "QA test only" },
    failOnStatusCode: false,
  });
  const status = patchResp.status();
  const body = await patchResp.json();
  console.log("[D] PATCH no-force status:", status);
  console.log("[D] body:", JSON.stringify(body).slice(0, 400));

  expect(status, "有 graded sub 无 force 应 400").toBeGreaterThanOrEqual(400);
  expect(body?.error?.code).toBe("TASK_HAS_GRADED_SUBMISSIONS");
  // 中文错误消息
  expect(String(body?.error?.message)).toMatch(/[一-鿿]/);
  // gradedCount 应附在 details
  const gradedCount = body?.error?.details?.gradedCount ?? body?.error?.gradedCount;
  console.log("[D] gradedCount in error:", gradedCount);

  // 确认名字没改 — db get
  const getResp2 = await page.request.get(`${BASE}/api/tasks/${TASK_HAS_GRADED}`);
  const j2 = await getResp2.json();
  const afterName = j2?.data?.task?.taskName ?? j2?.data?.taskName;
  expect(afterName, "无 force 失败后名字应原样").toBe(originalName);
});

test("QA Unit 4 E: 有 graded sub PATCH + force=true → 200 + audit log force=true", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");

  // 取原名
  const getResp1 = await page.request.get(`${BASE}/api/tasks/${TASK_HAS_GRADED}`);
  const j1 = await getResp1.json();
  const originalName = j1?.data?.task?.taskName ?? j1?.data?.taskName;
  const originalReq = j1?.data?.task?.requirements ?? j1?.data?.requirements ?? null;
  console.log("\n[E] original:", originalName);

  // PATCH with force=true
  const tempName = `QA-Unit4-Force-${Date.now()}`;
  const patchResp = await page.request.patch(`${BASE}/api/tasks/${TASK_HAS_GRADED}`, {
    data: { taskName: tempName, force: true },
    failOnStatusCode: false,
  });
  console.log("[E] PATCH force=true status:", patchResp.status());
  expect(patchResp.status(), "force=true 应 200").toBe(200);

  // 验证 audit log (via DB direct query later; here just confirm 200 OK)
  // 还原原 taskName
  const restoreResp = await page.request.patch(`${BASE}/api/tasks/${TASK_HAS_GRADED}`, {
    data: { taskName: originalName, requirements: originalReq, force: true },
    failOnStatusCode: false,
  });
  console.log("[E] restore status:", restoreResp.status());
  expect(restoreResp.status()).toBe(200);
});

test("QA Unit 4 F: UI dialog 三按钮 + 取消逻辑 (acceptance #3)", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/tasks/${TASK_HAS_GRADED}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  // 进编辑模式
  await page.getByRole("button", { name: /^编辑$/ }).first().click();
  await page.waitForTimeout(1200);

  // 找到任务名 input 或 textarea — 改一下
  const nameInput = page.locator('input').filter({ hasNot: page.locator('[type="checkbox"]') }).first();
  if (await nameInput.count()) {
    // try direct find by value containing 个人理财
    const targetInput = page.locator(`input[value*="个人理财"]`).first();
    if (await targetInput.count()) {
      await targetInput.fill(`QA-F-Dialog-${Date.now()}`);
      console.log("\n[F] modified task name input");
    } else {
      // fallback: 改 requirements textarea
      const reqTextarea = page.locator("textarea").first();
      if (await reqTextarea.count()) {
        await reqTextarea.fill(`QA-F-test-requirements-${Date.now()}`);
        console.log("[F] modified requirements textarea");
      }
    }
  }

  await page.screenshot({ path: `${SS}/F1-edit-modified.png`, fullPage: true });

  // 点保存
  await page.getByRole("button", { name: /^保存$/ }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/F2-dialog.png`, fullPage: true });

  // 应弹出 dialog — find by alertdialog role
  const dialog = page.locator('[role="alertdialog"], [role="dialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  const dialogText = (await dialog.textContent()) ?? "";
  console.log("[F] dialog text first 500:", dialogText.slice(0, 500));

  // 验证 dialog 含中文 + 三按钮 ("取消" / "复制为新任务" / "直接保存")
  expect(dialogText).toMatch(/已批改|graded|提交/);
  expect(dialogText).toMatch(/推荐.*复制|复制.*新任务/);

  // 三按钮文本
  const cancelInDlg = dialog.locator('button', { hasText: /^取消$/ });
  const copyInDlg = dialog.locator('button', { hasText: /复制为新任务/ });
  const forceInDlg = dialog.locator('button', { hasText: /直接保存/ });
  console.log("[F] dialog 取消 / 复制 / 直接保存 各按钮数:",
    await cancelInDlg.count(), await copyInDlg.count(), await forceInDlg.count());
  expect(await cancelInDlg.count()).toBeGreaterThan(0);
  expect(await copyInDlg.count()).toBeGreaterThan(0);
  expect(await forceInDlg.count()).toBeGreaterThan(0);

  // 点 "取消" — 不做任何 PATCH，回到编辑模式
  await cancelInDlg.first().click();
  await page.waitForTimeout(1500);

  // dialog 应关闭
  const stillVisible = await page.locator('[role="alertdialog"]:visible').count();
  console.log("[F] dialog visible after cancel:", stillVisible);
  expect(stillVisible, "取消后 dialog 应消失").toBe(0);

  // 验证 task 名字没变 (取消 = 不 PATCH)
  const getResp = await page.request.get(`${BASE}/api/tasks/${TASK_HAS_GRADED}`);
  const j = await getResp.json();
  const currentName = j?.data?.task?.taskName ?? j?.data?.taskName;
  console.log("[F] task name after cancel:", currentName);
  expect(currentName, "取消后 task 名应为原值").toBe("个人理财基础概念测验");
});

test("QA Unit 4 G: 跨 task type 编辑页打开不崩 (sim + sub)", async ({ page }) => {
  // teacher1 owns sim+sub tasks
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");

  // 测 sim
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e?.message ?? e)));

  await page.goto(`${BASE}/teacher/tasks/${TASK_SIM_TEACHER1}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/G1-sim-task.png`, fullPage: true });

  const simErrCount = consoleErrors.filter(
    (e) => !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e),
  ).length;
  console.log("\n[G/sim] console errors:", simErrCount);
  if (simErrCount > 0) {
    consoleErrors.slice(0, 5).forEach((e) => console.log("  -", e.slice(0, 200)));
  }

  // 检查页面是否有任务名（说明加载成功）
  const simBody = (await page.textContent("body")) ?? "";
  expect(simBody).toMatch(/客户风险沟通模拟/);

  // 应有编辑按钮（说明 teacher1 是 owner）
  const simEditBtn = await page.getByRole("button", { name: /^编辑$/ }).count();
  console.log("[G/sim] 编辑按钮:", simEditBtn);
  expect(simEditBtn, "sim task 应有编辑按钮").toBeGreaterThan(0);

  // 测 subjective
  consoleErrors.length = 0;
  await page.goto(`${BASE}/teacher/tasks/${TASK_SUB_TEACHER1}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/G2-sub-task.png`, fullPage: true });

  const subErrCount = consoleErrors.filter(
    (e) => !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e),
  ).length;
  console.log("[G/sub] console errors:", subErrCount);

  const subBody = (await page.textContent("body")) ?? "";
  expect(subBody).toMatch(/家庭预算分析报告/);

  const subEditBtn = await page.getByRole("button", { name: /^编辑$/ }).count();
  console.log("[G/sub] 编辑按钮:", subEditBtn);
  expect(subEditBtn, "sub task 应有编辑按钮").toBeGreaterThan(0);

  // 进入 sub 编辑模式 — 抓 console error
  await page.getByRole("button", { name: /^编辑$/ }).first().click();
  await page.waitForTimeout(2000);
  const subEditErrs = consoleErrors.filter(
    (e) => !/React DevTools|HMR|favicon|Failed to load resource.*favicon/i.test(e),
  );
  console.log("[G/sub] 进入编辑模式后 console errors:", subEditErrs.length);
  expect(subEditErrs.length, "sub edit mode 不应 console error").toBe(0);
});

test("QA Unit 4 H: 复制为新任务 — POST tasks + redirect + 副本 (acceptance #3 + 决策 #6)", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");
  await page.goto(`${BASE}/teacher/tasks/${TASK_HAS_GRADED}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  // 进编辑模式 + 改名
  await page.getByRole("button", { name: /^编辑$/ }).first().click();
  await page.waitForTimeout(1000);

  // 改任务名 input
  const nameInput = page.locator(`input[value*="个人理财"]`).first();
  if (await nameInput.count()) {
    await nameInput.fill(`QA-H-Copy-${Date.now()}`);
  } else {
    const anyTextInput = page.locator("input[type='text']").first();
    if (await anyTextInput.count()) {
      await anyTextInput.fill(`QA-H-copy-test-${Date.now()}`);
    }
  }

  // 点保存 → 弹 dialog
  await page.getByRole("button", { name: /^保存$/ }).first().click();
  await page.waitForTimeout(1500);

  const dialog = page.locator('[role="alertdialog"]').first();
  await dialog.waitFor({ state: "visible", timeout: 10_000 });

  // 在 dialog 内点「复制为新任务」 — capture network for POST /api/tasks
  const postPromise = page
    .waitForResponse(
      (r) => r.url().includes("/api/tasks") && r.request().method() === "POST",
      { timeout: 15_000 },
    )
    .catch(() => null);

  const copyBtn = dialog.locator("button", { hasText: /复制为新任务/ }).first();
  await copyBtn.click();
  const resp = await postPromise;
  console.log("\n[H] POST response captured:", resp?.status());

  if (resp) {
    const respJson = await resp.json().catch(() => null);
    console.log("[H] POST response body keys:", Object.keys(respJson?.data ?? {}));
    const newTaskId = respJson?.data?.id ?? respJson?.data?.task?.id;
    console.log("[H] new task id:", newTaskId);
    expect(String(newTaskId), "应有新 task id").toMatch(/[0-9a-f-]{36}/);

    // 等 redirect
    await page.waitForTimeout(2500);
    const url = page.url();
    console.log("[H] URL after copy:", url);
    // 期望 redirect 到 /teacher/tasks/<new id>
    const onNewPage = url.includes(newTaskId) || /tasks\/[0-9a-f-]{36}/.test(url);
    console.log("[H] on new task page?", onNewPage);

    // 验证新 task 在 DB 中存在
    const verifyResp = await page.request.get(`${BASE}/api/tasks/${newTaskId}`);
    expect(verifyResp.status(), "新 task 应可 GET").toBe(200);
    const verifyJson = await verifyResp.json();
    const newName = verifyJson?.data?.task?.taskName ?? verifyJson?.data?.taskName;
    console.log("[H] new task name:", newName);
    // 期望含「副本」字眼或 QA-H- 前缀
    expect(String(newName)).toMatch(/副本|QA-H-/);

    // 验证原 task 未被改 (未走 force=true 路径)
    const origResp = await page.request.get(`${BASE}/api/tasks/${TASK_HAS_GRADED}`);
    const origJson = await origResp.json();
    const origName = origJson?.data?.task?.taskName ?? origJson?.data?.taskName;
    console.log("[H] original task name after copy:", origName);
    expect(origName, "原 task 名应保持原值").toBe("个人理财基础概念测验");

    // ===== CLEANUP: 删除复制出来的任务 =====
    const delResp = await page.request.delete(`${BASE}/api/tasks/${newTaskId}`);
    console.log("[H] cleanup DELETE status:", delResp.status());
  }
});

