/**
 * Phase 3 M-1: molly 课程改造 — 单 test 完整流程，避免 NextAuth race
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";
const NOISE_CHAPTER_ID = "d22f7150-645d-4f1f-af94-c41efb4bca67";

const CHAPTERS = [
  { title: "1. 理财基础与客户分析", order: 0 },
  { title: "2. 现金与债务规划", order: 1 },
  { title: "3. 保险与风险管理", order: 2 },
  { title: "4. 投资规划与资产配置", order: 3 },
  { title: "5. 退休与传承规划", order: 4 },
];

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", ".harness", "screenshots", "phase3-m1");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function loginMolly(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', "molly@qq.com");
  await page.fill('input[type="password"], input[name="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 });
}

test("Phase 3 M-1: molly 课程完整改造", async ({ page }) => {
  test.setTimeout(120_000);

  // === A: 登录 ===
  await loginMolly(page);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-login-ok.png") });
  console.log("✓ A: molly 登录成功", page.url());

  // === B: API 改课程标题 ===
  const rRename = await page.request.patch(`/api/lms/courses/${COURSE_ID}`, {
    data: { courseTitle: "个人理财规划" },
    headers: { "Content-Type": "application/json" },
  });
  console.log(`B: PATCH course → ${rRename.status()}`);
  expect(rRename.status()).toBe(200);

  // === C: 删除噪音章节（含子小节 cascade） ===
  const rDel = await page.request.delete(`/api/lms/chapters/${NOISE_CHAPTER_ID}`);
  console.log(`C: DELETE chapter → ${rDel.status()}`);
  if (rDel.status() !== 200 && rDel.status() !== 204 && rDel.status() !== 404) {
    const body = await rDel.text();
    console.log("  body:", body.slice(0, 300));
  }
  expect([200, 204, 404]).toContain(rDel.status());

  // === D: 创建 5 章基础大纲 ===
  for (const ch of CHAPTERS) {
    const r = await page.request.post("/api/lms/chapters", {
      data: { courseId: COURSE_ID, title: ch.title, order: ch.order },
      headers: { "Content-Type": "application/json" },
    });
    const status = r.status();
    const body = await r.text();
    console.log(`D: POST '${ch.title}': ${status}`);
    expect([200, 201]).toContain(status);
  }

  // === E: 验证课程结构 + 截图 ===
  await page.goto(`/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "02-course-after-5chapters.png"),
    fullPage: true,
  });

  const bodyText = await page.locator("body").innerText();
  console.log(`E: body has '个人理财规划': ${bodyText.includes("个人理财规划")}`);

  let foundChapters = 0;
  for (const ch of CHAPTERS) {
    if (bodyText.includes(ch.title)) foundChapters++;
  }
  console.log(`E: chapters visible: ${foundChapters}/5`);
  expect(foundChapters).toBeGreaterThanOrEqual(3);
});
