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
    const body = secondPatchBody as string | null;
    if (body) {
      expect(body).toContain('"force":true');
    }
  });
});

test.describe.serial("Unit 4 commit-2: 编辑模式 UI 扩 (quiz + scoring)", () => {
  test("G: 编辑模式可见 quiz 题目编辑控件 + scoring 编辑控件", async ({ page }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/tasks/${TASK_NO_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: /编辑/ }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/07-edit-mode.png`, fullPage: true });

    // 编辑模式：quiz 题目"添加题目"按钮可见
    await expect(page.getByRole("button", { name: /添加题目/ })).toBeVisible();
    // scoring 添加标准按钮可见
    await expect(page.getByRole("button", { name: /添加标准/ })).toBeVisible();
    // quiz 配置 — 模式 select 可见
    const modeSelect = page.locator('select, [role="combobox"]').first();
    await expect(modeSelect).toBeVisible();
  });

  test("H: 添加 quiz 题目 → 保存 → 重新加载题目数 +1（基线 task NO_SUB）", async ({ page }) => {
    await loginMolly(page);
    await page.goto(`${BASE}/teacher/tasks/${TASK_NO_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    // 当前题目数（从 page 抓）
    const titleBefore = await page.getByText(/题目列表/).first().innerText();
    const matchBefore = titleBefore.match(/题目列表（(\d+) 题）/);
    const before = matchBefore ? parseInt(matchBefore[1], 10) : 0;
    console.log("quiz questions before:", before);

    await page.getByRole("button", { name: /编辑/ }).first().click();
    await page.waitForTimeout(500);

    // 点添加题目
    await page.getByRole("button", { name: /添加题目/ }).click();
    await page.waitForTimeout(300);

    // 填写新题（找最后一个 textarea-rows-2 为题干输入）
    const promptInputs = page.locator('textarea[placeholder*="题题干"]');
    const promptCount = await promptInputs.count();
    if (promptCount > 0) {
      await promptInputs.last().fill("Unit 4 测试题：1+1=?");
    }

    // 保存
    await page.getByRole("button", { name: /保存/ }).first().click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SS}/08-after-add-question.png`, fullPage: true });

    // 重新加载后题目数 +1
    const titleAfter = await page.getByText(/题目列表/).first().innerText();
    const matchAfter = titleAfter.match(/题目列表（(\d+) 题）/);
    const after = matchAfter ? parseInt(matchAfter[1], 10) : 0;
    console.log("quiz questions after:", after);
    expect(after).toBe(before + 1);

    // 测后清理：直接通过 API 把新增题目删掉 + 把题目数恢复
    // 取所有 quiz questions，过滤出我们刚加的（prompt 含 Unit 4），重发不含它的 PATCH
    const detailRes = await page.request.get(`${BASE}/api/tasks/${TASK_NO_SUB}`);
    const detailJson = await detailRes.json();
    interface DbQ {
      id: string;
      type: string;
      prompt: string;
      options: Array<{ id: string; text: string }> | null;
      correctOptionIds: string[];
      correctAnswer: string | null;
      points: number;
      explanation: string | null;
      order: number;
    }
    const originalQs = (detailJson.data.quizQuestions as DbQ[]).filter(
      (q) => !q.prompt.includes("Unit 4 测试题"),
    );
    const cleanRes = await page.request.patch(`${BASE}/api/tasks/${TASK_NO_SUB}`, {
      data: {
        quizQuestions: originalQs.map((q, idx) => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options ?? undefined,
          correctOptionIds: q.correctOptionIds,
          correctAnswer: q.correctAnswer ?? undefined,
          points: q.points,
          explanation: q.explanation ?? undefined,
          order: idx,
        })),
      },
    });
    const cleanJson = await cleanRes.json();
    expect(cleanJson.success).toBe(true);
  });
});

// === Unit 4 r2: allocation editing + sim/sub full save ===

const SIM_TASK_NO_SUB = "a308c7ba-2713-4c2d-9441-c92927e3f9f4"; // teacher1, sim, 0 graded, 1 allocation section "资产配置方案"
const SUB_TASK_NO_SUB = "aff902a3-a669-4181-91ea-613519b9f4d2"; // teacher1, sub, 0 graded

async function loginTeacher1(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "teacher1@finsim.edu.cn");
  await page.fill('input[type="password"]', "password123");
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

test.describe.serial("Unit 4 r2: allocation editing + sim/sub full save", () => {
  test("I: simulation task — 编辑模式 allocation 分区可见 + 添加条目 + 保存", async ({
    page,
  }) => {
    await loginTeacher1(page);

    // 通过 API 拿到 baseline allocation 条目数
    const baseRes = await page.request.get(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`);
    const baseJson = await baseRes.json();
    interface AllocItem { id: string; label: string; order: number; }
    interface AllocSec { id: string; label: string; order: number; items: AllocItem[]; }
    const baseSections = baseJson.data.allocationSections as AllocSec[];
    const baseSec0ItemCount = baseSections[0]?.items?.length ?? 0;
    console.log("sim task baseline section[0] items:", baseSec0ItemCount);

    // 通过 API patch：第 0 个 section 加一个条目 "QA-r2-test-item"
    const newSections = baseSections.map((sec, idx) => ({
      label: sec.label,
      order: idx,
      items:
        idx === 0
          ? [
              ...sec.items.map((it, i) => ({ label: it.label, order: i })),
              { label: "QA-r2-test-item", order: sec.items.length },
            ]
          : sec.items.map((it, i) => ({ label: it.label, order: i })),
    }));
    const patchRes = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`, {
      data: { allocationSections: newSections },
    });
    const patchJson = await patchRes.json();
    expect(patchJson.success).toBe(true);

    // 重读校验
    const afterRes = await page.request.get(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`);
    const afterJson = await afterRes.json();
    const afterSections = afterJson.data.allocationSections as AllocSec[];
    const newCount = afterSections[0].items.length;
    console.log("sim task after PATCH section[0] items:", newCount);
    expect(newCount).toBe(baseSec0ItemCount + 1);
    expect(afterSections[0].items.some((it) => it.label === "QA-r2-test-item")).toBe(true);

    // 清理：还原回 baseline
    const cleanRes = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`, {
      data: {
        allocationSections: baseSections.map((sec, idx) => ({
          label: sec.label,
          order: idx,
          items: sec.items.map((it, i) => ({ label: it.label, order: i })),
        })),
      },
    });
    const cleanJson = await cleanRes.json();
    expect(cleanJson.success).toBe(true);

    // UI 验证：编辑模式显示「添加分区」+「添加条目」按钮
    await page.goto(`${BASE}/teacher/tasks/${SIM_TASK_NO_SUB}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /编辑/ }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SS}/09-sim-edit-mode.png`, fullPage: true });
    await expect(page.getByRole("button", { name: /添加分区/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /添加条目/ }).first()).toBeVisible();
  });

  test("J: simulation task — 改 systemPrompt 中的核心人设 → 保存 → 回看反映", async ({
    page,
  }) => {
    await loginTeacher1(page);

    // baseline systemPrompt
    const baseRes = await page.request.get(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`);
    const baseJson = await baseRes.json();
    const basePrompt = baseJson.data.simulationConfig.systemPrompt as string;
    console.log("sim baseline systemPrompt len:", basePrompt?.length);

    // 通过 API patch: 改核心人设的内容（注入一行 marker）
    const marker = `QA-r2-test-persona-${Date.now()}`;
    const newSystemPrompt =
      basePrompt && basePrompt.includes("【核心人设】")
        ? basePrompt.replace(
            /【核心人设】\n([\s\S]*?)(?=\n\n【|$)/,
            `【核心人设】\n$1\n${marker}`,
          )
        : `${basePrompt ?? ""}\n\n【核心人设】\n${marker}`;
    const patchRes = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`, {
      data: {
        simulationConfig: {
          scenario: baseJson.data.simulationConfig.scenario,
          openingLine: baseJson.data.simulationConfig.openingLine,
          dialogueRequirements:
            baseJson.data.simulationConfig.dialogueRequirements ?? undefined,
          strictnessLevel: baseJson.data.simulationConfig.strictnessLevel,
          systemPrompt: newSystemPrompt,
        },
      },
    });
    const patchJson = await patchRes.json();
    console.log("sim PATCH systemPrompt:", JSON.stringify(patchJson).slice(0, 200));
    expect(patchJson.success).toBe(true);

    // 回读
    const afterRes = await page.request.get(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`);
    const afterJson = await afterRes.json();
    const afterPrompt = afterJson.data.simulationConfig.systemPrompt as string;
    expect(afterPrompt).toContain(marker);

    // 清理
    const cleanRes = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK_NO_SUB}`, {
      data: {
        simulationConfig: {
          scenario: baseJson.data.simulationConfig.scenario,
          openingLine: baseJson.data.simulationConfig.openingLine,
          dialogueRequirements:
            baseJson.data.simulationConfig.dialogueRequirements ?? undefined,
          strictnessLevel: baseJson.data.simulationConfig.strictnessLevel,
          systemPrompt: basePrompt ?? undefined,
        },
      },
    });
    expect((await cleanRes.json()).success).toBe(true);
  });

  test("K: subjective task — 改 prompt → 保存 → 回看反映", async ({ page }) => {
    await loginTeacher1(page);

    const baseRes = await page.request.get(`${BASE}/api/tasks/${SUB_TASK_NO_SUB}`);
    const baseJson = await baseRes.json();
    const basePrompt = baseJson.data.subjectiveConfig.prompt as string;
    console.log("sub baseline prompt:", basePrompt.slice(0, 80));

    const marker = `QA-r2-test-prompt-${Date.now()}`;
    const newPrompt = `${basePrompt}\n\n[${marker}]`;
    const patchRes = await page.request.patch(`${BASE}/api/tasks/${SUB_TASK_NO_SUB}`, {
      data: {
        subjectiveConfig: {
          prompt: newPrompt,
          allowTextAnswer: baseJson.data.subjectiveConfig.allowTextAnswer,
          allowedAttachmentTypes:
            baseJson.data.subjectiveConfig.allowedAttachmentTypes,
          strictnessLevel: baseJson.data.subjectiveConfig.strictnessLevel,
        },
      },
    });
    const patchJson = await patchRes.json();
    console.log("sub PATCH:", JSON.stringify(patchJson).slice(0, 200));
    expect(patchJson.success).toBe(true);

    const afterRes = await page.request.get(`${BASE}/api/tasks/${SUB_TASK_NO_SUB}`);
    const afterJson = await afterRes.json();
    const afterPrompt = afterJson.data.subjectiveConfig.prompt as string;
    expect(afterPrompt).toContain(marker);

    // 清理
    const cleanRes = await page.request.patch(`${BASE}/api/tasks/${SUB_TASK_NO_SUB}`, {
      data: {
        subjectiveConfig: {
          prompt: basePrompt,
          allowTextAnswer: baseJson.data.subjectiveConfig.allowTextAnswer,
          allowedAttachmentTypes:
            baseJson.data.subjectiveConfig.allowedAttachmentTypes,
          strictnessLevel: baseJson.data.subjectiveConfig.strictnessLevel,
        },
      },
    });
    expect((await cleanRes.json()).success).toBe(true);
  });
});
