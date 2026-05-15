import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/qa-unit4-r2";

const SIM_TASK = "a308c7ba-2713-4c2d-9441-c92927e3f9f4"; // teacher1 sim, 0 graded, has 1 alloc section + 5 items
const SUB_TASK = "aff902a3-a669-4181-91ea-613519b9f4d2"; // teacher1 sub, 0 graded, no alloc
const QUIZ_TASK_HAS_GRADED = "3e26c6d2-fdf2-42d4-81d4-6f399b1b2dd9"; // molly's r1 fixture — spot-check

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
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

// helper: deep copy + sanitize a simulationConfig payload for PATCH
function sanitizeSimConfig(simCfg: Record<string, unknown>): Record<string, unknown> {
  const p: Record<string, unknown> = {
    scenario: simCfg.scenario,
    openingLine: simCfg.openingLine,
    strictnessLevel: simCfg.strictnessLevel,
  };
  if (simCfg.dialogueRequirements != null) p.dialogueRequirements = simCfg.dialogueRequirements;
  if (simCfg.systemPrompt != null) p.systemPrompt = simCfg.systemPrompt;
  return p;
}

function sanitizeSubConfig(subCfg: Record<string, unknown>): Record<string, unknown> {
  return {
    prompt: subCfg.prompt,
    allowTextAnswer: subCfg.allowTextAnswer,
    allowedAttachmentTypes: subCfg.allowedAttachmentTypes,
    strictnessLevel: subCfg.strictnessLevel,
  };
}

// helper: sanitize allocationSections for PATCH payload
type AllocItem = { id?: string; label: string; defaultValue?: number | null; order?: number };
type AllocSection = { id?: string; label: string; order?: number; items?: AllocItem[] };
function sanitizeAllocSections(secs: AllocSection[]): Array<Record<string, unknown>> {
  return secs.map((s, sIdx) => ({
    label: s.label,
    order: sIdx,
    items: (s.items ?? []).map((it, iIdx) => {
      const item: Record<string, unknown> = {
        label: it.label,
        order: iIdx,
      };
      if (it.defaultValue != null) item.defaultValue = it.defaultValue;
      return item;
    }),
  }));
}

test("QA r2 A: allocation 编辑 UI 可见 + 按钮可点 (acceptance: 全 config 可改)", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  await page.goto(`${BASE}/teacher/tasks/${SIM_TASK}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SS}/A1-sim-read.png`, fullPage: true });

  // 读模式下，allocation 应该有显示
  const bodyText = (await page.textContent("body")) ?? "";
  const hasAlloc = /资产配置|allocation|分区/i.test(bodyText);
  console.log("\n[A] 读模式有 allocation 字眼?", hasAlloc);

  // 进编辑
  const editBtn = page.getByRole("button", { name: /^编辑$/ }).first();
  expect(await editBtn.count()).toBeGreaterThan(0);
  await editBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/A2-sim-edit.png`, fullPage: true });

  // 编辑模式下应有「添加分区」+「添加条目」按钮 (per build report decision)
  const addSectionBtn = page.getByRole("button", { name: /添加分区/ });
  const addItemBtn = page.getByRole("button", { name: /添加条目/ });
  const addSectionCount = await addSectionBtn.count();
  const addItemCount = await addItemBtn.count();
  console.log("[A] 添加分区 count:", addSectionCount, " 添加条目 count:", addItemCount);
  expect(addSectionCount, "应有「添加分区」按钮").toBeGreaterThan(0);
  expect(addItemCount, "应有「添加条目」按钮").toBeGreaterThan(0);
});

test("QA r2 B: allocation API CRUD (add section + item / edit label / restore)", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");

  // 1. Baseline GET
  const r1 = await page.request.get(`${BASE}/api/tasks/${SIM_TASK}`);
  const j1 = await r1.json();
  const baselineSecs = (j1.data.allocationSections ?? []) as AllocSection[];
  console.log("\n[B] baseline sections:", baselineSecs.length, " items:",
    baselineSecs.reduce((s, sec) => s + (sec.items?.length ?? 0), 0));
  expect(baselineSecs.length).toBe(1);
  expect(baselineSecs[0].items?.length).toBe(5);

  // 2. ADD section + add item to first section
  const addedSecs: Array<Record<string, unknown>> = [
    ...sanitizeAllocSections(baselineSecs),
    {
      label: "QA-r2-new-section",
      order: 1,
      items: [{ label: "QA-r2-new-item-in-new-section", order: 0 }],
    },
  ];
  // also append to the first section
  (addedSecs[0].items as Array<Record<string, unknown>>).push({
    label: "QA-r2-extra-item-in-orig-section",
    order: 5,
  });

  const addResp = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK}`, {
    data: { allocationSections: addedSecs },
    failOnStatusCode: false,
  });
  console.log("[B] ADD PATCH status:", addResp.status());
  const addBody = await addResp.json();
  if (addResp.status() !== 200) console.log("[B] err:", JSON.stringify(addBody).slice(0, 500));
  expect(addResp.status(), "0-sub PATCH 应直通 200").toBe(200);

  // 3. Verify via GET
  const r2 = await page.request.get(`${BASE}/api/tasks/${SIM_TASK}`);
  const j2 = await r2.json();
  const afterSecs = (j2.data.allocationSections ?? []) as AllocSection[];
  console.log("[B] after sections:", afterSecs.length, " sec0 items:",
    afterSecs[0]?.items?.length, " sec1 items:", afterSecs[1]?.items?.length);
  expect(afterSecs.length, "应增加到 2 分区").toBe(2);
  expect(afterSecs[0].items?.length, "原 sec 应增加到 6 items").toBe(6);
  expect(afterSecs[1].items?.length, "新 sec 应有 1 item").toBe(1);
  // 验证 label 真实写入
  expect(afterSecs[1].label).toBe("QA-r2-new-section");
  expect(afterSecs[0].items?.[5].label).toBe("QA-r2-extra-item-in-orig-section");

  // 4. EDIT — 改新 section 的 label
  const editedSecs = sanitizeAllocSections(afterSecs).map((s, idx) =>
    idx === 1 ? { ...s, label: "QA-r2-EDITED-section" } : s,
  );
  const editResp = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK}`, {
    data: { allocationSections: editedSecs },
    failOnStatusCode: false,
  });
  console.log("[B] EDIT PATCH status:", editResp.status());
  expect(editResp.status()).toBe(200);
  const r3 = await page.request.get(`${BASE}/api/tasks/${SIM_TASK}`);
  const j3 = await r3.json();
  const r3Secs = (j3.data.allocationSections ?? []) as AllocSection[];
  expect(r3Secs[1].label, "section label 应已更新").toBe("QA-r2-EDITED-section");

  // 5. RESTORE — 删除新增 section + 新增 item，回到 baseline (1 sec, 5 items)
  const restoredSecs = sanitizeAllocSections(baselineSecs);
  const restoreResp = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK}`, {
    data: { allocationSections: restoredSecs },
    failOnStatusCode: false,
  });
  console.log("[B] RESTORE status:", restoreResp.status());
  expect(restoreResp.status()).toBe(200);

  const rFinal = await page.request.get(`${BASE}/api/tasks/${SIM_TASK}`);
  const jFinal = await rFinal.json();
  const finalSecs = (jFinal.data.allocationSections ?? []) as AllocSection[];
  console.log("[B] final sections:", finalSecs.length, " items:",
    finalSecs[0]?.items?.length);
  expect(finalSecs.length, "回 1 sec").toBe(1);
  expect(finalSecs[0].items?.length, "回 5 items").toBe(5);
  // 验证 baseline 数据保留
  expect(finalSecs[0].items?.[0].label).toBe(baselineSecs[0].items?.[0].label);
});

test("QA r2 C: sim systemPrompt PATCH 改+回读+restore", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");

  // baseline (note: builder r2 测试残留 — 当前 baseline 已是 "【核心人设】 QA-r2-test-persona-1778751095550")
  const r1 = await page.request.get(`${BASE}/api/tasks/${SIM_TASK}`);
  const j1 = await r1.json();
  const baseSimCfg = j1.data.simulationConfig as Record<string, unknown>;
  const basePrompt = baseSimCfg.systemPrompt as string | null;
  console.log("\n[C] sim baseline systemPrompt:", JSON.stringify(basePrompt));
  console.log("[C] sim baseline systemPrompt len:", basePrompt?.length ?? 0);

  // mark + check restore precision
  const marker = `QA-r2-MYTEST-${Date.now()}`;
  const newPrompt = basePrompt ? `${basePrompt}\n\n${marker}` : `【核心人设】\n${marker}`;

  const patchResp = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK}`, {
    data: { simulationConfig: { ...sanitizeSimConfig(baseSimCfg), systemPrompt: newPrompt } },
    failOnStatusCode: false,
  });
  console.log("[C] PATCH status:", patchResp.status());
  expect(patchResp.status()).toBe(200);

  // verify marker present
  const r2 = await page.request.get(`${BASE}/api/tasks/${SIM_TASK}`);
  const j2 = await r2.json();
  const afterPrompt = (j2.data.simulationConfig as { systemPrompt: string }).systemPrompt;
  console.log("[C] after systemPrompt len:", afterPrompt?.length);
  expect(afterPrompt).toContain(marker);

  // RESTORE — write back baseline (which may be the polluted r2 marker, but at least we don't worsen it)
  const restoreResp = await page.request.patch(`${BASE}/api/tasks/${SIM_TASK}`, {
    data: { simulationConfig: sanitizeSimConfig(baseSimCfg) },
    failOnStatusCode: false,
  });
  console.log("[C] RESTORE status:", restoreResp.status());
  expect(restoreResp.status()).toBe(200);

  // confirm
  const rFinal = await page.request.get(`${BASE}/api/tasks/${SIM_TASK}`);
  const jFinal = await rFinal.json();
  const finalPrompt = (jFinal.data.simulationConfig as { systemPrompt: string | null }).systemPrompt;
  console.log("[C] final systemPrompt:", JSON.stringify(finalPrompt));
  expect(finalPrompt).toBe(basePrompt);
});

test("QA r2 D: sub prompt PATCH 改+回读+restore", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");

  const r1 = await page.request.get(`${BASE}/api/tasks/${SUB_TASK}`);
  const j1 = await r1.json();
  const baseSubCfg = j1.data.subjectiveConfig as Record<string, unknown>;
  const basePrompt = baseSubCfg.prompt as string;
  console.log("\n[D] sub baseline prompt len:", basePrompt.length);

  const marker = `QA-r2-MYTEST-SUB-${Date.now()}`;
  const newPrompt = `${basePrompt}\n\n[${marker}]`;
  const patchResp = await page.request.patch(`${BASE}/api/tasks/${SUB_TASK}`, {
    data: { subjectiveConfig: { ...sanitizeSubConfig(baseSubCfg), prompt: newPrompt } },
    failOnStatusCode: false,
  });
  console.log("[D] PATCH status:", patchResp.status());
  expect(patchResp.status()).toBe(200);

  const r2 = await page.request.get(`${BASE}/api/tasks/${SUB_TASK}`);
  const j2 = await r2.json();
  const afterPrompt = (j2.data.subjectiveConfig as { prompt: string }).prompt;
  expect(afterPrompt).toContain(marker);

  // RESTORE
  const restoreResp = await page.request.patch(`${BASE}/api/tasks/${SUB_TASK}`, {
    data: { subjectiveConfig: sanitizeSubConfig(baseSubCfg) },
    failOnStatusCode: false,
  });
  console.log("[D] RESTORE status:", restoreResp.status());
  expect(restoreResp.status()).toBe(200);

  // verify
  const rFinal = await page.request.get(`${BASE}/api/tasks/${SUB_TASK}`);
  const jFinal = await rFinal.json();
  const finalPrompt = (jFinal.data.subjectiveConfig as { prompt: string }).prompt;
  console.log("[D] final prompt len:", finalPrompt.length);
  expect(finalPrompt, "应精确还原").toBe(basePrompt);
});

test("QA r2 E: spot-check r1 quiz force PATCH 仍 OK (回归)", async ({ page }) => {
  await loginAs(page, "molly@qq.com", "123456");

  const r1 = await page.request.get(`${BASE}/api/tasks/${QUIZ_TASK_HAS_GRADED}`);
  const j1 = await r1.json();
  const originalName = j1?.data?.task?.taskName ?? j1?.data?.taskName;
  console.log("\n[E] quiz baseline name:", originalName);
  expect(originalName).toBe("个人理财基础概念测验");

  // No force → 400 expected
  const r2 = await page.request.patch(`${BASE}/api/tasks/${QUIZ_TASK_HAS_GRADED}`, {
    data: { taskName: `QA-r2-spotcheck-${Date.now()}` },
    failOnStatusCode: false,
  });
  console.log("[E] no-force PATCH:", r2.status());
  expect(r2.status()).toBe(400);
  const b2 = await r2.json();
  expect(b2.error.code).toBe("TASK_HAS_GRADED_SUBMISSIONS");

  // With force → 200
  const r3 = await page.request.patch(`${BASE}/api/tasks/${QUIZ_TASK_HAS_GRADED}`, {
    data: { taskName: `QA-r2-spotcheck-${Date.now()}`, force: true },
    failOnStatusCode: false,
  });
  console.log("[E] force PATCH:", r3.status());
  expect(r3.status()).toBe(200);

  // Restore
  const r4 = await page.request.patch(`${BASE}/api/tasks/${QUIZ_TASK_HAS_GRADED}`, {
    data: { taskName: originalName, force: true },
    failOnStatusCode: false,
  });
  console.log("[E] restore:", r4.status());
  expect(r4.status()).toBe(200);
});

test("QA r2 F: 验证 audit log r2 期间写入 (fieldsChanged 含 allocation/sim/sub)", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");

  // 取最近 task.update audit (我们自己跑产生的)
  // Note: 这是 indirect — 我们通过实测 PATCH 触发了 audit，DB 中应有 fresh entries from this QA run
  // 由于 progress.tsv 没有 admin audit API 访问，只能通过 DB direct query 在 outer shell 做。
  console.log("\n[F] audit log 验证将由 outer DB query 在 spec 结束后做");
});
