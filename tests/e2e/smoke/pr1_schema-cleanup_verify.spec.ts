import { test } from "@playwright/test";
import { loginAs } from "./_setup";

const SCREENSHOT_DIR = ".harness/screenshots/pr1_schema-cleanup";

test("teacher dashboard loads after schema cleanup", async ({ browser }) => {
  const page = await loginAs(browser, "teacher1");
  await page.goto("/teacher/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/teacher-dashboard.png`,
    fullPage: true,
  });
});

test("teacher courses page loads", async ({ browser }) => {
  const page = await loginAs(browser, "teacher1");
  await page.goto("/teacher/courses");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/teacher-courses.png`,
    fullPage: true,
  });
});

test("teacher instances page loads", async ({ browser }) => {
  const page = await loginAs(browser, "teacher1");
  await page.goto("/teacher/instances");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/teacher-instances.png`,
    fullPage: true,
  });
});

test("teacher tasks page loads", async ({ browser }) => {
  const page = await loginAs(browser, "teacher1");
  await page.goto("/teacher/tasks");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/teacher-tasks.png`,
    fullPage: true,
  });
});

test("student dashboard loads (CourseClass-only collapse)", async ({ browser }) => {
  const page = await loginAs(browser, "student1");
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/student-dashboard.png`,
    fullPage: true,
  });
});

test("register page renders Class.code in dropdown (still alive)", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/register");
  await page.click('button:has-text("学生注册")');
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/register.png`,
    fullPage: true,
  });
});
