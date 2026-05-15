import { test, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE = "http://localhost:3000";
const OUT = path.resolve(process.cwd(), ".harness/screenshots/probe-m2");

function log(line: string) {
  const stamp = new Date().toISOString().slice(11, 23);
  console.log(`[${stamp}] ${line}`);
  fs.appendFileSync(path.join(OUT, "trace.log"), `[${stamp}] ${line}\n`);
}

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: 15000,
  });
}

test.use({ viewport: { width: 1440, height: 900 } });

test("19 — dump knowledge sources with scope", async ({ page }) => {
  await loginAs(page, "teacher1@finsim.edu.cn", "password123");
  // courses to check
  const cIds = [
    "940bbe23-6172-40bf-bc7f-b22a1840a1de",
    "ec619c34-99ed-4e45-9f97-2bcd43c1bcb1",
    "00000000-0000-4000-8000-00000000a201",
  ];
  for (const cid of cIds) {
    const r = await page.request.get(
      `${BASE}/api/lms/course-knowledge-sources?courseId=${cid}`,
    );
    const j = await r.json();
    const items = j.data || [];
    log(`course ${cid}: ${items.length} sources`);
    for (const s of items) {
      log(
        `  source ${s.id.slice(0, 8)} fn="${s.fileName}" status=${s.status} sourceType=${s.sourceType} chapterId=${s.chapterId} sectionId=${s.sectionId} taskId=${s.taskId} taskInstanceId=${s.taskInstanceId} summary="${(s.summary || "").slice(0, 80)}"`,
      );
    }
  }
});
