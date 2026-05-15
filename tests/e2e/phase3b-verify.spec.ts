import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";

// molly 自己拥有的课程
const MOLLY_COURSE = "8f7f653c-9177-44f6-b764-80f7f779b2ef";

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
// A1: POST .doc → 400 + error.code=LEGACY_DOC_UNSUPPORTED + 精确中文
// ============================================
test("A1: 上传 .doc (application/msword) → 400 LEGACY_DOC_UNSUPPORTED 友好中文", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");

  // 构造 FormData with .doc Content-Type
  const fakeDocContent = Buffer.from("fake .doc OLE2 content");
  const res = await request.post(
    `${BASE}/api/lms/course-knowledge-sources`,
    {
      multipart: {
        file: {
          name: "phase3b-test.doc",
          mimeType: "application/msword",
          buffer: fakeDocContent,
        },
        courseId: MOLLY_COURSE,
      },
    },
  );

  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json.success).toBe(false);
  expect(json.error?.code).toBe("LEGACY_DOC_UNSUPPORTED");
  expect(json.error?.message).toContain("暂不支持旧版 .doc 格式");
  expect(json.error?.message).toContain("另存为 .docx");

  await context.close();
});

// ============================================
// A2: 上传 .docx 仍正常 (regression)
// ============================================
test("A2: 上传 .docx 仍 ok (无 LEGACY_DOC_UNSUPPORTED) — content-type 路径不破坏", async ({ browser }) => {
  const { context, request } = await makeAuthedContext(browser, "molly@qq.com", "123456");

  // 构造一个 minimal docx (PKZIP magic)；服务端只校验 contentType + size
  const fakeDocxContent = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]), // PK..
    Buffer.from("phase3b-fake-docx-content"),
  ]);
  const res = await request.post(
    `${BASE}/api/lms/course-knowledge-sources`,
    {
      multipart: {
        file: {
          name: "phase3b-test.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: fakeDocxContent,
        },
        courseId: MOLLY_COURSE,
      },
    },
  );

  // 应通过 validateFile（status != 400 LEGACY_DOC_UNSUPPORTED）。
  // 后续 AI 解析失败是另一回事，不在本 unit 验证。
  const json = await res.json();
  if (!json.success) {
    expect(json.error?.code).not.toBe("LEGACY_DOC_UNSUPPORTED");
  }
  // status 200/400 都接受 — 关键是 code 不是 LEGACY_DOC_UNSUPPORTED

  await context.close();
});
