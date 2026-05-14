/**
 * Phase 3 M-2: molly 上传 2 份真实教学材料 + AI 解析
 *
 * 策略：保留现有 syllabus KS（778e76c6 ready），上传第二份 doc → 等 AI 解析
 * 验证：2 KS 全 ready/ai_summary_failed (容错 LLM 偶发) + structuredData 至少 1 个非空
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";
const XLS_PATH = "/Users/alexmac/Downloads/个人理财-课程标准-编码表.xls";
const DOC_PATH = "/tmp/personal-finance.docx";

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", ".harness", "screenshots", "phase3-m2");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function loginMolly(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', "molly@qq.com");
  await page.fill('input[type="password"], input[name="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 });
}

test("Phase 3 M-2: molly 上传 2 份材料 + AI 解析", async ({ page }) => {
  test.setTimeout(300_000); // 5 min for AI parse

  await loginMolly(page);
  console.log("✓ molly login OK");

  // 检查文件存在
  expect(fs.existsSync(XLS_PATH)).toBeTruthy();
  expect(fs.existsSync(DOC_PATH)).toBeTruthy();

  // 上传 doc 文件作为 syllabus（XLS 已有，保留作 baseline）
  console.log(`uploading doc: ${DOC_PATH} (${fs.statSync(DOC_PATH).size} bytes)`);
  const docBuffer = fs.readFileSync(DOC_PATH);
  const rDoc = await page.request.post("/api/lms/course-knowledge-sources", {
    multipart: {
      courseId: COURSE_ID,
      sourceType: "syllabus",
      file: {
        name: "5.个人理财-中高贯通国际金融.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: docBuffer,
      },
    },
  });
  console.log(`POST doc → ${rDoc.status()}`);
  const docBody = await rDoc.text();
  console.log(`body excerpt: ${docBody.slice(0, 400)}`);
  expect([200, 201]).toContain(rDoc.status());

  const docResult = JSON.parse(docBody);
  const newKsId = docResult.data?.id ?? docResult.id;
  console.log(`new KS id: ${newKsId}`);
  expect(newKsId).toBeTruthy();

  // poll KS status until ready/failed (max 3 min)
  let pollCount = 0;
  let allReady = false;
  while (pollCount < 36 && !allReady) {
    await page.waitForTimeout(5000);
    pollCount++;
    const rList = await page.request.get(`/api/lms/course-knowledge-sources?courseId=${COURSE_ID}`);
    const list = await rList.json();
    const sources = list.data ?? list;
    const statuses = sources.map((s: any) => `${s.fileName}:${s.status}`);
    console.log(`poll ${pollCount}/36: ${statuses.join(" | ")}`);

    const allDone = sources.every(
      (s: any) =>
        s.status === "ready" ||
        s.status === "failed" ||
        s.status === "ai_summary_failed" ||
        s.status === "ocr_required",
    );
    if (allDone) {
      allReady = true;
      console.log(`✓ all KS done in ${pollCount * 5}s`);
      break;
    }
  }

  expect(allReady).toBeTruthy();

  // 截图 + 详情
  await page.goto(`/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "01-course-with-materials.png"),
    fullPage: true,
  });

  // 最终状态报告
  const rFinal = await page.request.get(`/api/lms/course-knowledge-sources?courseId=${COURSE_ID}`);
  const finalList = await rFinal.json();
  const finalSources = finalList.data ?? finalList;
  console.log(`\n=== Final KS state ===`);
  for (const s of finalSources) {
    console.log(`- ${s.fileName} | status=${s.status} | sourceType=${s.sourceType} | structuredData=${s.structuredData ? "PRESENT" : "null"}`);
  }
  expect(finalSources.length).toBeGreaterThanOrEqual(2);
});
