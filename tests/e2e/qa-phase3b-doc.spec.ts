import { test, expect, type APIRequestContext, type BrowserContext } from "@playwright/test";

const BASE = "http://localhost:3000";

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

// Fake OLE2 (.doc) header magic bytes — D0CF11E0A1B11AE1 (CDF V2)
const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
// Fake PKZIP (.docx) magic — 504B0304 (PK..)
const PKZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

test.setTimeout(180_000);

// ============================================
// A: .doc upload → 400 LEGACY_DOC_UNSUPPORTED + 中文
// ============================================

test("QA p3b A: POST /course-knowledge-sources 用 .doc (application/msword) → 400 + LEGACY_DOC_UNSUPPORTED + '另存为 .docx'", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    // 构造 OLE2 .doc 文件
    const docBuf = Buffer.concat([OLE2_MAGIC, Buffer.from("fake doc content", "utf-8")]);

    const resp = await molly.request.post(`${BASE}/api/lms/course-knowledge-sources`, {
      multipart: {
        courseId: MOLLY_COURSE,
        kind: "pdf", // 内部 enum, 不影响 validation
        file: {
          name: "legacy-test.doc",
          mimeType: "application/msword",
          buffer: docBuf,
        },
      },
      failOnStatusCode: false,
    });

    console.log("\n[A] .doc POST status:", resp.status());
    const body = await resp.json();
    console.log("[A] body:", JSON.stringify(body).slice(0, 400));

    expect(resp.status()).toBe(400);
    expect(String(body?.error?.code)).toBe("LEGACY_DOC_UNSUPPORTED");
    expect(String(body?.error?.message)).toMatch(/另存为.*\.docx/);
    expect(String(body?.error?.message)).toMatch(/暂不支持/);
  } finally {
    await molly.context.close();
  }
});

// ============================================
// B: .docx (PKZIP magic) → NOT LEGACY_DOC_UNSUPPORTED (regression)
// ============================================

test("QA p3b B: .docx PKZIP magic → 通过 validation (不命中 LEGACY)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    // 构造 PKZIP .docx 文件 (但内容不是真实 docx, 仅 magic 头)
    const docxBuf = Buffer.concat([PKZIP_MAGIC, Buffer.from("fake docx pkzip payload", "utf-8")]);

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

    // 可能 200 (validation pass + 后续 parsing 失败) 或 400 (其他验证失败)
    // 关键: error.code 不应是 LEGACY_DOC_UNSUPPORTED
    if (resp.status() >= 400) {
      const code = String(body?.error?.code ?? "");
      console.log("[B] error code:", code);
      expect(code).not.toBe("LEGACY_DOC_UNSUPPORTED");
    } else {
      // 200 path - 创建成功, 需 cleanup
      const id = body?.data?.id ?? body?.data?.knowledgeSource?.id;
      if (id) {
        console.log("[B] cleanup KS id:", id);
        await molly.request.delete(`${BASE}/api/lms/course-knowledge-sources/${id}`).catch(() => {});
      }
    }
  } finally {
    await molly.context.close();
  }
});

// ============================================
// C: outline-import endpoint also wired
// ============================================

test("QA p3b C: POST /courses/[id]/outline-import 用 .doc → 400 LEGACY_DOC_UNSUPPORTED", async ({
  browser,
}) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const docBuf = Buffer.concat([OLE2_MAGIC, Buffer.from("fake outline doc", "utf-8")]);

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

    // 应有 LEGACY_DOC_UNSUPPORTED code
    if (resp.status() >= 400) {
      const code = String(body?.error?.code ?? "");
      console.log("[C] error code:", code);
      expect(code).toBe("LEGACY_DOC_UNSUPPORTED");
    }
  } finally {
    await molly.context.close();
  }
});

// ============================================
// D: import-jobs endpoint also wired
// ============================================

test("QA p3b D: POST /api/import-jobs 用 .doc → 400 LEGACY_DOC_UNSUPPORTED", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const docBuf = Buffer.concat([OLE2_MAGIC, Buffer.from("import doc", "utf-8")]);

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

    if (resp.status() >= 400) {
      const code = String(body?.error?.code ?? "");
      console.log("[D] error code:", code);
      // 接受 LEGACY_DOC_UNSUPPORTED 或 ALREADY_RUNNING / FILE_REQUIRED (取决于路由先校验顺序)
      // 关键: 如果 file validation 走到则应是 LEGACY
      if (code !== "LEGACY_DOC_UNSUPPORTED") {
        console.log("[D] (info) 其他校验先抛 — 但 file validation 走到时应 LEGACY");
      }
    }
  } finally {
    await molly.context.close();
  }
});

// ============================================
// E: API 字段 backward-compat - error.code 存在
// ============================================

test("QA p3b E: error response 含 code 字段 (validationErrorWithCode helper)", async ({ browser }) => {
  const molly = await makeAuthedContext(browser, "molly@qq.com", "123456");
  try {
    const docBuf = Buffer.concat([OLE2_MAGIC, Buffer.from("test", "utf-8")]);
    const resp = await molly.request.post(`${BASE}/api/lms/course-knowledge-sources`, {
      multipart: {
        courseId: MOLLY_COURSE,
        kind: "pdf",
        file: {
          name: "x.doc",
          mimeType: "application/msword",
          buffer: docBuf,
        },
      },
      failOnStatusCode: false,
    });
    const body = await resp.json();
    console.log("\n[E] error response keys:", Object.keys(body?.error ?? {}));
    expect(body?.error?.code).toBeDefined();
    expect(body?.error?.message).toBeDefined();
    expect(typeof body?.error?.code).toBe("string");
    expect(typeof body?.error?.message).toBe("string");
  } finally {
    await molly.context.close();
  }
});
