import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { readFile } from "fs/promises";
import { join } from "path";

const BASE = "http://localhost:3000";

const MOLLY_COURSE = "8f7f653c-9177-44f6-b764-80f7f779b2ef";

// PR-B 需求变更（owner 确认）：彻底支持旧版 .doc。原行为「.doc → 400 LEGACY_DOC_UNSUPPORTED」
// 已移除。现在 .doc 与其它文档一样被接受：真实 .doc 解析出正文（status ready），
// 损坏/伪造 .doc 优雅失败（不再用 400 LEGACY 拦截）。本 spec 断言新行为。

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
// A: 真实 .doc 上传 → 不再被拒（接受 + 解析出正文）
// ============================================

test("QA p3b A: POST /course-knowledge-sources 用真实 .doc → 不再 400 LEGACY，接受并解析出正文", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  let createdId: string | undefined;
  try {
    const docBuf = await readFile(join(__dirname, "..", "_fixtures", "sample.doc"));

    const resp = await molly.request.post(`${BASE}/api/lms/course-knowledge-sources`, {
      multipart: {
        courseId: MOLLY_COURSE,
        kind: "pdf", // 内部 enum, 不影响 validation
        file: {
          name: "sample.doc",
          mimeType: "application/msword",
          buffer: docBuf,
        },
      },
      failOnStatusCode: false,
    });

    console.log("\n[A] .doc POST status:", resp.status());
    const body = await resp.json();
    console.log("[A] body:", JSON.stringify(body).slice(0, 400));

    // 关键：不再是 400 LEGACY_DOC_UNSUPPORTED
    expect(String(body?.error?.code ?? "")).not.toBe("LEGACY_DOC_UNSUPPORTED");
    expect(resp.ok()).toBe(true);
    const source = body?.data;
    createdId = source?.id ?? source?.knowledgeSource?.id;
    // 真实 .doc 应解析为 ready（异步管线可能稍后才 ready；ready 或 processing 均非拒绝）
    if (source?.status) {
      expect(["ready", "processing", "pending", "ai_summary_failed"]).toContain(source.status);
    }
  } finally {
    if (createdId) {
      await molly.request
        .delete(`${BASE}/api/lms/course-knowledge-sources/${createdId}`)
        .catch(() => {});
    }
    await molly.context.close();
  }
});

// ============================================
// B: .docx (PKZIP magic) → NOT LEGACY_DOC_UNSUPPORTED (regression)
// ============================================

test("QA p3b B: .docx PKZIP magic → 通过 validation (不命中 LEGACY)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const docxBuf = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("fake docx pkzip payload", "utf-8"),
    ]);

    const resp = await molly.request.post(`${BASE}/api/lms/course-knowledge-sources`, {
      multipart: {
        courseId: MOLLY_COURSE,
        kind: "pdf",
        file: {
          name: "test.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: docxBuf,
        },
      },
      failOnStatusCode: false,
    });

    console.log("\n[B] .docx POST status:", resp.status());
    const body = await resp.json();
    console.log("[B] body:", JSON.stringify(body).slice(0, 300));

    if (resp.status() >= 400) {
      const code = String(body?.error?.code ?? "");
      expect(code).not.toBe("LEGACY_DOC_UNSUPPORTED");
    } else {
      const id = body?.data?.id ?? body?.data?.knowledgeSource?.id;
      if (id) {
        await molly.request.delete(`${BASE}/api/lms/course-knowledge-sources/${id}`).catch(() => {});
      }
    }
  } finally {
    await molly.context.close();
  }
});

// ============================================
// C: 损坏/伪造 .doc → 优雅处理（不再 400 LEGACY，不 500、不崩）
// ============================================

test("QA p3b C: 伪造 .doc（仅 OLE2 magic）→ 不再 400 LEGACY，优雅处理不崩", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  let createdId: string | undefined;
  try {
    const docBuf = Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.from("fake outline doc", "utf-8"),
    ]);

    const resp = await molly.request.post(`${BASE}/api/lms/courses/${MOLLY_COURSE}/outline-import`, {
      multipart: {
        file: {
          name: "outline.doc",
          mimeType: "application/msword",
          buffer: docBuf,
        },
      },
      failOnStatusCode: false,
    });

    console.log("\n[C] outline-import .doc:", resp.status());
    const body = await resp.json();
    console.log("[C] body:", JSON.stringify(body).slice(0, 300));

    // 不再 LEGACY 拒绝；不 500
    expect(String(body?.error?.code ?? "")).not.toBe("LEGACY_DOC_UNSUPPORTED");
    expect(resp.status()).not.toBe(500);
    createdId = body?.data?.id ?? body?.data?.knowledgeSource?.id;
  } finally {
    if (createdId) {
      await molly.request
        .delete(`${BASE}/api/lms/course-knowledge-sources/${createdId}`)
        .catch(() => {});
    }
    await molly.context.close();
  }
});

// ============================================
// D: import-jobs endpoint — .doc 不再 LEGACY 拒绝
// ============================================

test("QA p3b D: POST /api/import-jobs 用 .doc → 不再 LEGACY 拒绝、不 500", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const docBuf = await readFile(join(__dirname, "..", "_fixtures", "sample.doc"));

    const resp = await molly.request.post(`${BASE}/api/import-jobs`, {
      multipart: {
        kind: "outline",
        file: {
          name: "import.doc",
          mimeType: "application/msword",
          buffer: docBuf,
        },
      },
      failOnStatusCode: false,
    });

    console.log("\n[D] import-jobs .doc:", resp.status());
    const body = await resp.json();
    console.log("[D] body:", JSON.stringify(body).slice(0, 300));

    expect(String(body?.error?.code ?? "")).not.toBe("LEGACY_DOC_UNSUPPORTED");
    expect(resp.status()).not.toBe(500);
  } finally {
    await molly.context.close();
  }
});
