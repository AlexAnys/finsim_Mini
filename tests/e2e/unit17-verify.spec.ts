import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/unit17-verify";

const ADAPTIVE_INSTANCE_ID = "a7d9b380-49fd-4ce2-9d95-000935ac0c5a";

function runSql(sql: string): string {
  return execSync(
    `docker exec -i acc4fef29d82_finsim-postgres psql -U finsim -d finsim -t -A`,
    { encoding: "utf8", input: sql },
  ).trim();
}

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

test.setTimeout(180_000);

// ============================================
// A1: API 返回 taskSnapshot 字段（resolveTaskForRunner 消费源）
// ============================================
test("A1: GET /api/lms/task-instances/<id> 返回 taskSnapshot 字段", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "alex@qq.com", "11");

  const res = await request.get(`${BASE}/api/lms/task-instances/${ADAPTIVE_INSTANCE_ID}`);
  expect(res.ok()).toBe(true);
  const json = await res.json();
  expect(json.success).toBe(true);
  expect(json.data).toHaveProperty("taskSnapshot");
  expect(json.data).toHaveProperty("task");

  if (json.data.taskSnapshot) {
    expect(typeof json.data.taskSnapshot).toBe("object");
    expect(json.data.taskSnapshot).toHaveProperty("taskName");
  }

  await context.close();
});

// ============================================
// A2: 注入 divergent snapshot.taskName → 学生页面仍正常加载 0 console error
// ============================================
test("A2: 注入 divergent snapshot.taskName 后学生页面不崩 0 console error", async ({ browser }) => {
  const original = runSql(
    `SELECT "taskSnapshot"->>'taskName' FROM "TaskInstance" WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
  );
  const injectSql = `UPDATE "TaskInstance" SET "taskSnapshot" = jsonb_set("taskSnapshot"::jsonb, '{taskName}', to_jsonb('Unit17-DIVERGED'::text)) WHERE id='${ADAPTIVE_INSTANCE_ID}'`;
  runSql(injectSql);

  try {
    const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.goto(`${BASE}/tasks/${ADAPTIVE_INSTANCE_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    const fatalErrors = consoleErrors.filter(
      (e) =>
        e.includes("Cannot read properties") ||
        e.includes("is not a function") ||
        e.includes("TypeError"),
    );
    expect(fatalErrors).toHaveLength(0);

    await page.screenshot({ path: `${SS}/A2-diverged.png`, fullPage: true });
    await context.close();
  } finally {
    runSql(
      `UPDATE "TaskInstance" SET "taskSnapshot" = jsonb_set("taskSnapshot"::jsonb, '{taskName}', to_jsonb('${original}'::text)) WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
    );
  }
});

// ============================================
// B1: snapshot=null 时学生页面 fallback live 不崩
// ============================================
test("B1: snapshot=null 时学生页面正常加载（fallback live）", async ({ browser }) => {
  const beforeSnap = runSql(
    `SELECT "taskSnapshot"::text FROM "TaskInstance" WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
  );

  runSql(
    `UPDATE "TaskInstance" SET "taskSnapshot"=NULL WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
  );

  try {
    const { context } = await makeAuthedContext(browser, "alex@qq.com", "11");
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    await page.goto(`${BASE}/tasks/${ADAPTIVE_INSTANCE_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    const fatalErrors = consoleErrors.filter(
      (e) =>
        e.includes("Cannot read properties") ||
        e.includes("is not a function") ||
        e.includes("TypeError"),
    );
    expect(fatalErrors).toHaveLength(0);

    await page.screenshot({ path: `${SS}/B1-snapshot-null.png`, fullPage: true });
    await context.close();
  } finally {
    runSql(
      `UPDATE "TaskInstance" SET "taskSnapshot"='${beforeSnap.replace(/'/g, "''")}'::jsonb WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
    );
  }
});

// ============================================
// C1: 教师视图保留 live —— snapshot 文案不出现在 instance 详情
// ============================================
test("C1: 教师 /teacher/instances/[id] 不渲染 snapshot 文案（保留 live）", async ({ browser }) => {
  const original = runSql(
    `SELECT "taskSnapshot"->>'taskName' FROM "TaskInstance" WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
  );
  runSql(
    `UPDATE "TaskInstance" SET "taskSnapshot" = jsonb_set("taskSnapshot"::jsonb, '{taskName}', to_jsonb('Unit17-TEACHER-SHOULD-NOT-SEE'::text)) WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
  );

  try {
    const { context } = await makeAuthedContext(browser, "molly@qq.com", "123456");
    const page = await context.newPage();
    await page.goto(`${BASE}/teacher/instances/${ADAPTIVE_INSTANCE_ID}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);

    const body = await page.textContent("body");
    expect(body).toBeTruthy();
    expect(body ?? "").not.toContain("Unit17-TEACHER-SHOULD-NOT-SEE");

    await context.close();
  } finally {
    runSql(
      `UPDATE "TaskInstance" SET "taskSnapshot" = jsonb_set("taskSnapshot"::jsonb, '{taskName}', to_jsonb('${original}'::text)) WHERE id='${ADAPTIVE_INSTANCE_ID}'`,
    );
  }
});
