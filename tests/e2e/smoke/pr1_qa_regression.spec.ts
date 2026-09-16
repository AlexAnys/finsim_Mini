/**
 * PR-1 QA-regression — 4 候选每个的核心路径真浏览器抽样.
 *
 * Scope (per `.harness/spec.md` § "QA 阶段段 - qa-pr1-regression"):
 *   A → CI 红绿验证 (本 spec 只 sanity check seed account login + pages 200)
 *   D → 审计 default-on (改 instance title → /admin/audit 看 `task_instance.update` 行)
 *   E → AI prompt registry (/teacher/ai-settings preview ↔ builder.systemPrompt 单源)
 *   I+J → schema 死字段死表读路径不挂 (/teacher/dashboard / /courses / /instances + removeCourseClass guard)
 *
 * 用本地 dev server (http://localhost:3000, postgres :5432, schema migrated to drop_dead_schema_pr1).
 * Test side-effect on AuditLog 表 (D 步): 在测试内 patch → restore (title 还原 baseline);
 * audit 行追加是 append-only design (D 要点), 不需要回滚 - QA brief 提到 hard-delete 还原, 但
 * D builder 的 acceptance 是「audit 表 append-only」, 删 audit row 反而违背设计 — 保留.
 */
import { randomUUID } from "node:crypto";
import { test, expect, type Browser, type Page, type APIRequestContext } from "@playwright/test";
import { loginAs } from "./_setup";

test.describe.configure({ mode: "serial" });

const AUDIT_PROBE_PREFIX = "[QA-REG-AUDIT-PROBE] ";

// 内联 molly 登录 helper — 不动 _setup.ts (cross-builder scope, QA review-only)
async function loginMolly(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "molly@qq.com");
  await page.fill('input[type="password"]', "123456");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
  const path = new URL(page.url()).pathname;
  if (path.startsWith("/login")) throw new Error(`molly login failed (still at ${path})`);
  return page;
}

test.describe("PR-1 QA regression · 4 candidate sampling", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // D — 审计 default-on (改 instance title → /admin/audit 看到 task_instance.update + actorRole)
  // ─────────────────────────────────────────────────────────────────────────
  test("D · molly 改 instance title → admin /admin/audit 见 task_instance.update + actorRole=owner", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    // 1. molly 登录, 找她可改的 instance (createdBy === me 才能 PATCH)
    const mollyPage = await loginMolly(browser);
    const meRes = await mollyPage.request.get("/api/auth/session");
    const meJson = await meRes.json();
    const myId: string | undefined = meJson?.user?.id;
    expect(myId, "should have molly session.user.id").toBeTruthy();

    const tList = await mollyPage.request.get("/api/lms/task-instances?take=50");
    expect(tList.ok()).toBe(true);
    const tListJson = await tList.json();
    expect(tListJson.success).toBe(true);
    type InstanceItem = { id: string; title: string; createdBy?: string };
    const items: InstanceItem[] = tListJson.data?.items ?? tListJson.data ?? [];

    // 优先选 createdBy === me (PATCH 一定 200); 退回 list[0] 也无妨, 但 collaborator owner-not-match 会 401
    const owned = items.find((i) => i.createdBy === myId) ?? items[0];
    test.skip(!owned, "no task instance available for molly to probe");

    const target = owned!;
    const newTitle = `${AUDIT_PROBE_PREFIX}${Date.now()}`;
    const originalTitle = target.title;

    // 2. PATCH title (mutation → 触发 logAuditEvent)
    const patch = await mollyPage.request.patch(`/api/lms/task-instances/${target.id}`, {
      data: { title: newTitle },
    });
    const patchBody = await patch.json();
    expect(patch.ok(), `patch body: ${JSON.stringify(patchBody)}`).toBe(true);
    expect(patchBody.success).toBe(true);

    // 3. admin 登录 → 查 audit
    const adminPage = await loginAs(browser, "admin");
    await adminPage.goto("/admin/audit");
    await adminPage.waitForLoadState("networkidle");

    const auditRes = await adminPage.request.get("/api/admin/audit?tab=audit&take=20");
    expect(auditRes.ok(), "GET /api/admin/audit must be reachable").toBe(true);
    const auditJson = await auditRes.json();
    expect(auditJson.success).toBe(true);

    type AuditRow = {
      action: string;
      actorId?: string;
      targetId?: string;
      metadata?: { actorRole?: string; title?: string; changedFields?: string[] };
      createdAt?: string;
    };
    // API shape: { rows: [...], total } or { items } or array
    const rows: AuditRow[] =
      auditJson.data?.rows ?? auditJson.data?.items ?? (Array.isArray(auditJson.data) ? auditJson.data : []);

    // 找最近 5 分钟内的 task_instance.update + actorRole=owner + targetId 匹配
    const since = Date.now() - 5 * 60 * 1000;
    const hit = rows.find(
      (r) =>
        r.action === "task_instance.update" &&
        r.metadata?.actorRole === "owner" &&
        r.targetId === target.id &&
        (!r.createdAt || new Date(r.createdAt).getTime() >= since),
    );
    expect(
      hit,
      `expected audit row {action:task_instance.update, actorRole:owner, targetId:${target.id}} — got ${rows.length} rows, first: ${JSON.stringify(rows[0] ?? null)}`,
    ).toBeTruthy();

    // 4. 截图作为 evidence
    await adminPage.screenshot({
      path: ".harness/screenshots/pr1-qa-regression/D-audit-page.png",
      fullPage: true,
    });

    // 5. 还原 title (baseline cleanup, 不删 audit 行 — append-only by design)
    const restore = await mollyPage.request.patch(`/api/lms/task-instances/${target.id}`, {
      data: { title: originalTitle },
    });
    expect(restore.ok()).toBe(true);

    await mollyPage.context().close();
    await adminPage.context().close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // E — AI prompt registry (preview ↔ builder.systemPrompt 单源对照)
  // ─────────────────────────────────────────────────────────────────────────
  test("E · /teacher/ai-settings preview 与 simulation-chat builder 首段一致", async ({
    browser,
  }) => {
    test.setTimeout(60_000);

    const page = await loginMolly(browser);

    // 1. GET 真接口拿 basePromptPreview
    const res = await page.request.get("/api/ai/tool-settings");
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.success).toBe(true);
    type Definition = { key: string; basePromptPreview: string };
    const defs: Definition[] = json.data?.definitions ?? [];
    const simChat = defs.find((d) => d.key === "simulationChat");
    expect(simChat, "simulationChat definition must exist").toBeTruthy();
    const preview = simChat!.basePromptPreview;
    expect(preview.length).toBeGreaterThan(10);

    // 2. 单源对照: preview 首段应该包含 builder 的 persona 第一句
    //    源: lib/ai/prompts/simulation-chat.ts buildPersonaPrompt 第一行
    const expectedFirstLine = "你是一个金融理财场景中的模拟客户";
    expect(
      preview,
      `preview should contain builder persona — full preview:\n${preview}`,
    ).toContain(expectedFirstLine);

    // 3. 真浏览器加载 /teacher/ai-settings → 截图 evidence
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/teacher/ai-settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await page.screenshot({
      path: ".harness/screenshots/pr1-qa-regression/E-ai-settings.png",
      fullPage: true,
    });

    // 4. 不应该有运行时 fatal 报错
    const fatals = errors.filter((e) => /Cannot read|undefined is not|prisma.*unknown/i.test(e));
    expect(fatals, `fatal errors:\n${fatals.join("\n")}`).toEqual([]);

    await page.context().close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // I+J — schema 清理 (3 teacher 页面 200 + removeCourseClass guard 双路径)
  // ─────────────────────────────────────────────────────────────────────────
  test("I+J · molly /teacher/dashboard / /courses / /instances 加载 200", async ({ browser }) => {
    test.setTimeout(60_000);

    const page = await loginMolly(browser);

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`[console.error] ${msg.text()}`);
    });

    // 1. dashboard
    const dashResp = await page.goto("/teacher/dashboard");
    expect(dashResp?.status() ?? 0, "/teacher/dashboard").toBeLessThan(400);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: ".harness/screenshots/pr1-qa-regression/IJ-teacher-dashboard.png",
      fullPage: true,
    });

    // 2. courses
    const coursesResp = await page.goto("/teacher/courses");
    expect(coursesResp?.status() ?? 0, "/teacher/courses").toBeLessThan(400);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: ".harness/screenshots/pr1-qa-regression/IJ-teacher-courses.png",
      fullPage: true,
    });

    // 3. instances
    const instResp = await page.goto("/teacher/instances");
    expect(instResp?.status() ?? 0, "/teacher/instances").toBeLessThan(400);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: ".harness/screenshots/pr1-qa-regression/IJ-teacher-instances.png",
      fullPage: true,
    });

    // 4. 死字段 / 死表相关 runtime fatal
    const schemaFatals = errors.filter((e) =>
      /Cannot read|undefined is not|prisma.*unknown|TaskInstanceAnalytics|visibility|courseName.*not exist|chapterName.*not exist/i.test(
        e,
      ),
    );
    expect(schemaFatals, `schema fatal errors:\n${schemaFatals.join("\n")}`).toEqual([]);

    await page.context().close();
  });

  test("I+J · removeCourseClass guard 双路径: 仅 1 班级时拒 / ≥2 班级时允许", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const page = await loginAs(browser, "teacher1");
    let admin: Page | undefined;
    let courseId: string | undefined;
    let teacherId: string | undefined;
    const courseTitle = `[QA-REG-CLASS-GUARD] ${randomUUID()}`;
    async function classIds(request: APIRequestContext) {
      const ids: string[] = [];
      for (let current = 1; ; current++) {
        const response = await request.get(`/api/lms/classes?take=200&page=${current}`);
        expect(response.ok()).toBe(true);
        const json = await response.json();
        expect(json.success).toBe(true);
        const rows: Array<{ id: string }> = json.data;
        ids.push(...rows.map(row => row.id));
        if (rows.length < 200) return ids;
      }
    }
    async function linkedIds() {
      const response = await page.request.get(`/api/lms/courses/${courseId}/classes`);
      expect(response.ok()).toBe(true);
      const json = await response.json();
      expect(json.success).toBe(true);
      return (json.data as Array<{ classId: string }>).map(row => row.classId).sort();
    }
    try {
      admin = await loginAs(browser, "admin");
      const me = await page.request.get("/api/users/me");
      expect(me.ok()).toBe(true);
      teacherId = (await me.json()).data.id;
      const managedIds = await classIds(page.request);
      expect(managedIds.length, "seed teacher1 must manage a class").toBeGreaterThan(0);
      const ownClassId = managedIds[0];
      const allClassIds = await classIds(admin.request);
      const foreignClassId = allClassIds.find(id => !managedIds.includes(id));
      const otherClassId = foreignClassId ?? allClassIds.find(id => id !== ownClassId);
      expect(otherClassId, "two seeded classes are required to verify both guard paths").toBeTruthy();
      if (foreignClassId) expect((await page.request.get(`/api/lms/classes/${otherClassId}/members`)).status()).toBe(403);

      // Every changed CourseClass belongs to this new empty course; no existing course is touched.
      const created = await page.request.post("/api/lms/courses", { data: { courseTitle, classId: ownClassId } });
      const createdJson = await created.json();
      expect(created.ok(), JSON.stringify(createdJson)).toBe(true);
      courseId = createdJson.data.id;
      await test.info().attach("owned-course-fixture", {
        body: JSON.stringify({ courseId, courseTitle, teacherId, ownClassId, otherClassId }), contentType: "application/json",
      });
      expect(await linkedIds()).toEqual([ownClassId]);
      const only = await page.request.delete(`/api/lms/courses/${courseId}/classes`, { data: { classId: ownClassId } });
      const onlyJson = await only.json();
      expect(only.status(), JSON.stringify(onlyJson)).toBe(400);
      expect(onlyJson.error?.code).toBe("MUST_KEEP_AT_LEAST_ONE_CLASS");
      expect(onlyJson.error?.message).toContain("至少保留");
      expect(await linkedIds()).toEqual([ownClassId]);

      // Admin grants the fixture its second class; teacher access exists only while this link exists.
      const added = await admin.request.post(`/api/lms/courses/${courseId}/classes`, { data: { classId: otherClassId } });
      expect(added.ok(), await added.text()).toBe(true);
      expect(await linkedIds()).toEqual([ownClassId, otherClassId!].sort());
      const removed = await page.request.delete(`/api/lms/courses/${courseId}/classes`, { data: { classId: otherClassId } });
      expect(removed.ok(), await removed.text()).toBe(true);
      expect(await linkedIds()).toEqual([ownClassId]);
      if (foreignClassId) {
        const selfRestore = await page.request.post(`/api/lms/courses/${courseId}/classes`, { data: { classId: otherClassId } });
        expect(selfRestore.status()).toBe(403);
        expect((await selfRestore.json()).error?.code).toBe("FORBIDDEN");
      } else {
        test.info().annotations.push({ type: "note", description: "教师已管理所有班级；本case全测删除/管理员恢复，跨班403由teacher-roster pilot独立fixture覆盖" });
      }
      expect(await linkedIds()).toEqual([ownClassId]);
      const restored = await admin.request.post(`/api/lms/courses/${courseId}/classes`, { data: { classId: otherClassId } });
      expect(restored.ok(), await restored.text()).toBe(true);
      expect(await linkedIds()).toEqual([ownClassId, otherClassId!].sort());
    } finally {
      try {
        if (courseId) {
          const detail = await page.request.get(`/api/lms/courses/${courseId}`);
          expect(detail.ok(), "owned fixture must remain readable for cleanup").toBe(true);
          const course = (await detail.json()).data;
          expect(course.courseTitle).toBe(courseTitle);
          expect(course.createdBy).toBe(teacherId);
          const purged = await page.request.delete(`/api/lms/courses/${courseId}/purge`, { data: { confirmTitle: courseTitle } });
          expect(purged.ok(), await purged.text()).toBe(true);
          expect((await page.request.get(`/api/lms/courses/${courseId}`)).status()).toBe(404);
        }
      } finally {
        await page.context().close();
        await admin?.context().close();
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // A — CI 测试基础: 本地 sanity (CI playwright 跑通是 CI 自己的事)
  // ─────────────────────────────────────────────────────────────────────────
  test("A · 5 smoke spec 文件 + playwright config 存在 (本地 sanity)", async () => {
    const { existsSync } = await import("node:fs");
    expect(existsSync("playwright.config.ts")).toBe(true);
    expect(existsSync("tests/e2e/smoke/01-teacher-create-publish.spec.ts")).toBe(true);
    expect(existsSync("tests/e2e/smoke/02-student-submit-simulation.spec.ts")).toBe(true);
    expect(existsSync("tests/e2e/smoke/03-ai-grade-release.spec.ts")).toBe(true);
    expect(existsSync("tests/e2e/smoke/04-sb-free-question.spec.ts")).toBe(true);
    expect(existsSync("tests/e2e/smoke/05-weekly-insight.spec.ts")).toBe(true);
  });
});
