/**
 * Phase 3 M-6: 验证演示视频脚本能从 0 到 6'13" 自然演绎
 *
 * 按逐字稿路径：
 * 1'53"-2'06"  教师登录 → 进入主页
 * 2'06"-2'49"  仪表盘 + 生成一周洞察
 * 2'49"-3'55"  课程管理 + 教案识别
 * 3'55"-5'19"  3 类任务建设
 * 5'19"-6'13"  数据洞察 4 维度
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";
const CLASS_ID_A = "deedd844-e302-4b20-903d-d9b1d0e12439";

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", ".harness", "screenshots", "phase3-m6");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function loginMolly(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', "molly@qq.com");
  await page.fill('input[type="password"], input[name="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30000 });
}

test("Phase 3 M-6: 演示视频脚本路径验证", async ({ page }) => {
  test.setTimeout(420_000);

  await loginMolly(page);
  console.log("✓ molly login OK");

  const checklist: Record<string, boolean> = {};
  const errors: string[] = [];

  // 监控 console error
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // 忽略已知的 finsim 非 blocker (如 React DevTools / HMR)
      if (text.includes("cannot be a descendant") || text.includes("Missing Description")) {
        errors.push(`console.error: ${text.slice(0, 200)}`);
      }
    }
  });

  // === 1'53"-2'06" 登录进入主页 ===
  console.log("\n=== 1. 教师登录 + 主页 ===");
  await page.goto("/teacher/dashboard");
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-dashboard.png"), fullPage: true });

  const dashText = await page.locator("body").innerText();
  checklist["dashboard_loaded"] = dashText.includes("仪表盘") || dashText.includes("教师工作台");
  checklist["dashboard_has_tasks"] = dashText.includes("任务") || dashText.includes("学生");
  console.log(`  dashboard loaded: ${checklist["dashboard_loaded"]}`);

  // === 2'06"-2'49" 一周洞察 ===
  console.log("\n=== 2. 一周洞察 ===");
  const weeklyBtn = page.locator('text=/一周洞察|生成一周洞察/').first();
  const weeklyBtnCount = await weeklyBtn.count();
  console.log(`  weekly button count: ${weeklyBtnCount}`);
  checklist["weekly_button_visible"] = weeklyBtnCount > 0;

  if (weeklyBtnCount > 0) {
    await weeklyBtn.click();
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-weekly-modal.png"), fullPage: true });
    const modalText = await page.locator("body").innerText();
    checklist["weekly_modal_has_model"] = /mimo|qwen|deepseek|gemini|openai/i.test(modalText);
    checklist["weekly_modal_has_duration"] = modalText.includes("耗时") || /\d+s/.test(modalText);
    checklist["weekly_modal_has_advice"] = modalText.includes("建议") || modalText.includes("章节") || modalText.includes("学生");
    console.log(`  weekly modal has model meta: ${checklist["weekly_modal_has_model"]}`);
    console.log(`  weekly modal has duration: ${checklist["weekly_modal_has_duration"]}`);
    // 关闭 modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
  }

  // === 2'49"-3'55" 课程管理 + 教案识别 ===
  console.log("\n=== 3. 课程管理 ===");
  await page.goto(`/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-course-detail.png"), fullPage: true });

  const courseText = await page.locator("body").innerText();
  checklist["course_title_renamed"] = courseText.includes("个人理财规划");
  checklist["course_has_chapters"] =
    courseText.includes("理财基础") &&
    courseText.includes("现金与债务") &&
    courseText.includes("保险");
  checklist["course_has_materials"] =
    courseText.includes("个人理财-课程标准") || courseText.includes("国际金融");
  console.log(`  course title: ${checklist["course_title_renamed"]}`);
  console.log(`  course chapters: ${checklist["course_has_chapters"]}`);
  console.log(`  course materials: ${checklist["course_has_materials"]}`);

  // === 3'55"-5'19" 任务建设 ===
  console.log("\n=== 4. 任务列表 ===");
  await page.goto("/teacher/tasks");
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04-tasks.png"), fullPage: true });

  const tasksText = await page.locator("body").innerText();
  checklist["tasks_has_sim"] = tasksText.includes("客户风险评估模拟对话");
  checklist["tasks_has_quiz"] = tasksText.includes("理财基础自适应测验");
  checklist["tasks_has_sub"] = tasksText.includes("为李志华撰写资产配置建议书");
  console.log(`  sim task: ${checklist["tasks_has_sim"]}`);
  console.log(`  quiz task: ${checklist["tasks_has_quiz"]}`);
  console.log(`  sub task: ${checklist["tasks_has_sub"]}`);

  // === 5'19"-6'13" 数据洞察 ===
  console.log("\n=== 5. 数据洞察 v2 ===");
  await page.goto(`/teacher/analytics-v2?courseId=${COURSE_ID}&classIds=${CLASS_ID_A}`);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(20000); // give scope-insights AI time to generate
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05-analytics-v2.png"), fullPage: true });

  const insightsText = await page.locator("body").innerText();
  checklist["analytics_loaded"] = insightsText.includes("洞察") || insightsText.includes("分析");
  checklist["analytics_has_kpi"] = insightsText.includes("完成率") || insightsText.includes("均分");
  checklist["analytics_has_advice"] = insightsText.includes("建议") || insightsText.includes("教学");
  console.log(`  analytics loaded: ${checklist["analytics_loaded"]}`);
  console.log(`  analytics has KPI: ${checklist["analytics_has_kpi"]}`);
  console.log(`  analytics has advice: ${checklist["analytics_has_advice"]}`);

  // === Study Buddy 管理页 ===
  console.log("\n=== 6. 学生提问页 ===");
  await page.goto("/teacher/study-buddy");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06-study-buddy.png"), fullPage: true });
  const sbText = await page.locator("body").innerText();
  checklist["sb_loaded"] = sbText.includes("学生提问") || sbText.includes("Study") || sbText.includes("问答");
  checklist["sb_has_posts"] = sbText.includes("复利") || sbText.includes("权益") || sbText.includes("charlie") || sbText.includes("dexter");
  console.log(`  sb posts visible: ${checklist["sb_has_posts"]}`);

  // === AI 用量页 ===
  console.log("\n=== 7. AI 用量页 (留痕) ===");
  await page.goto("/teacher/ai-usage");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07-ai-usage.png"), fullPage: true });
  const aiText = await page.locator("body").innerText();
  checklist["ai_usage_loaded"] = aiText.includes("AI 用量") || aiText.includes("用量") || aiText.includes("token");
  checklist["ai_usage_has_runs"] = /\d+\s*(次|条|tokens?)/i.test(aiText);
  console.log(`  ai-usage has runs: ${checklist["ai_usage_has_runs"]}`);

  // === 总结 ===
  console.log("\n\n=== M-6 Checklist ===");
  for (const [k, v] of Object.entries(checklist)) {
    console.log(`  ${v ? "✓" : "✘"} ${k}`);
  }
  console.log(`\n  console errors caught: ${errors.length}`);
  for (const e of errors.slice(0, 5)) console.log(`    - ${e}`);

  const passed = Object.values(checklist).filter(Boolean).length;
  const total = Object.keys(checklist).length;
  console.log(`\n  M-6 score: ${passed}/${total}`);
  expect(passed).toBeGreaterThanOrEqual(Math.ceil(total * 0.7)); // 70% 阈值
});
