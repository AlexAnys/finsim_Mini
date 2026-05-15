import { test, Page } from "@playwright/test";

const BASE = "http://localhost:3000";

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"));
}

test("19b — list all sources without filter", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  const cIds = [
    "940bbe23-6172-40bf-bc7f-b22a1840a1de",
    "ec619c34-99ed-4e45-9f97-2bcd43c1bcb1",
    "00000000-0000-4000-8000-00000000a201",
  ];
  for (const cid of cIds) {
    const all = await page.request.get(`${BASE}/api/lms/course-knowledge-sources?courseId=${cid}`);
    const allJ = await all.json();
    const sy = await page.request.get(`${BASE}/api/lms/course-knowledge-sources?courseId=${cid}&sourceType=syllabus`);
    const syJ = await sy.json();
    console.log(`course ${cid} all=${(allJ.data||[]).length} syllabus=${(syJ.data||[]).length}`);
    for (const s of (allJ.data||[]).slice(0,8)) {
      console.log(`  ${s.id.slice(0,8)} fn="${s.fileName}" status=${s.status} sourceType=${s.sourceType} chapter=${s.chapterId?.slice(0,8) || 'null'} section=${s.sectionId?.slice(0,8) || 'null'} task=${s.taskId?.slice(0,8) || 'null'} taskInst=${s.taskInstanceId?.slice(0,8) || 'null'}`);
    }
  }
});
