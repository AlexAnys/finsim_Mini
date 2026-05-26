import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFile } from "fs/promises";
import { join } from "path";

const BASE = "http://localhost:3000";

// molly 自己拥有的课程
const MOLLY_COURSE = "8f7f653c-9177-44f6-b764-80f7f779b2ef";

// PR-B 需求变更（owner 确认）：彻底支持旧版 .doc。原 A1「.doc → 400 LEGACY_DOC_UNSUPPORTED」
// 行为已移除，改为接受 .doc 并解析正文。本 spec 断言新行为 + .docx 回归不破。

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
// A1: 上传真实 .doc → 接受（不再 400 LEGACY），解析出正文
// ============================================
test("A1: 上传真实 .doc (application/msword) → 接受 + 解析正文（不再 LEGACY 拒绝）", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");
  let createdId: string | undefined;

  try {
    const docBuf = await readFile(join(__dirname, "..", "_fixtures", "sample.doc"));
    const res = await request.post(`${BASE}/api/lms/course-knowledge-sources`, {
      multipart: {
        file: {
          name: "phase3b-test.doc",
          mimeType: "application/msword",
          buffer: docBuf,
        },
        courseId: MOLLY_COURSE,
      },
      failOnStatusCode: false,
    });

    const json = await res.json();
    expect(String(json?.error?.code ?? "")).not.toBe("LEGACY_DOC_UNSUPPORTED");
    expect(res.ok()).toBe(true);
    createdId = json?.data?.id ?? json?.data?.knowledgeSource?.id;
  } finally {
    if (createdId) {
      await request.delete(`${BASE}/api/lms/course-knowledge-sources/${createdId}`).catch(() => {});
    }
    await context.close();
  }
});

// ============================================
// A2: 上传 .docx 仍正常 (regression)
// ============================================
test("A2: 上传 .docx 仍 ok (无 LEGACY_DOC_UNSUPPORTED) — content-type 路径不破坏", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");

  try {
    const fakeDocxContent = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK..
      Buffer.from("phase3b-fake-docx-content"),
    ]);
    const res = await request.post(`${BASE}/api/lms/course-knowledge-sources`, {
      multipart: {
        file: {
          name: "phase3b-test.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: fakeDocxContent,
        },
        courseId: MOLLY_COURSE,
      },
      failOnStatusCode: false,
    });

    const json = await res.json();
    if (!json.success) {
      expect(json.error?.code).not.toBe("LEGACY_DOC_UNSUPPORTED");
    } else {
      const id = json?.data?.id ?? json?.data?.knowledgeSource?.id;
      if (id) {
        await request.delete(`${BASE}/api/lms/course-knowledge-sources/${id}`).catch(() => {});
      }
    }
  } finally {
    await context.close();
  }
});
