import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/probe-m4";

async function loginTeacher(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "teacher1@finsim.edu.cn");
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function loginAdmin(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', "admin@finsim.edu.cn");
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(240_000);

test("M4-1: 数据洞察 entry + load default scope", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 250));
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message.slice(0, 250)}`));

  await loginTeacher(page);

  // 检查 dashboard / sidebar 是否有"数据洞察"入口
  await page.goto(`${BASE}/teacher/dashboard`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const navInsightLinkCount = await page.getByRole("link", { name: /数据洞察|洞察/ }).count();
  const buttonInsightCount = await page.getByRole("button", { name: /数据洞察|洞察/ }).count();
  console.log("dashboard nav 数据洞察 link count:", navInsightLinkCount, "button:", buttonInsightCount);

  // 直接打开 analytics-v2
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SS}/01-default-scope.png`, fullPage: true });
  console.log("analytics-v2 url:", page.url());

  // 检查页面标题
  const title = await page.getByText("数据洞察").first().isVisible().catch(() => false);
  console.log("有「数据洞断」标题:", title);

  // 检查 4 个区块
  const sections = [
    "学生成绩分布",
    "任务表现",
    "Study Buddy",
    "AI 教学建议",
    "知识目标",
    "技能目标",
    "关注群体",
    "教学方式",
    "接下来怎么教",
  ];
  for (const s of sections) {
    const visible = await page.getByText(s).first().isVisible().catch(() => false);
    console.log(`  「${s}」可见:`, visible);
  }

  // 检查 filter bar
  const courseSel = await page.getByText(/课程：/).first().isVisible().catch(() => false);
  const chapterSel = await page.getByText(/章节：/).first().isVisible().catch(() => false);
  const classSel = await page.getByText(/班级：/).first().isVisible().catch(() => false);
  const taskTypeSel = await page.getByText(/模式：/).first().isVisible().catch(() => false);
  const instanceSel = await page.getByText(/实例：/).first().isVisible().catch(() => false);
  console.log(
    "scope tags - 课程:", courseSel,
    "章节:", chapterSel,
    "班级:", classSel,
    "模式:", taskTypeSel,
    "实例:", instanceSel,
  );

  console.log("console errors:", consoleErrors.length);
  for (const e of consoleErrors.slice(0, 8)) console.log("  ERR:", e);
});

test("M4-2: filter bar 数据真随筛选变（不是硬编码）", async ({ page }) => {
  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);

  // 调用 diagnosis API 直接两次，不同 scope
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // 列课程
  const cRes = await page.request.get(`${BASE}/api/lms/courses?take=10`, {
    headers: { cookie: cookieHeader },
  });
  const cJson = await cRes.json();
  const courses = cJson?.data ?? [];
  console.log("课程数:", courses.length);
  if (courses.length === 0) {
    console.log("无课程，跳过");
    return;
  }
  const cid = courses[0].id;

  // 默认 diagnosis
  const d1 = await page.request.get(`${BASE}/api/lms/analytics-v2/diagnosis?courseId=${cid}`, {
    headers: { cookie: cookieHeader },
  });
  const d1j = await d1.json();
  console.log("diagnosis r1 OK:", d1j.success, "filter cls:", d1j.data?.filterOptions?.classes?.length, "instCount:", d1j.data?.kpis?.instanceCount, "submC:", d1j.data?.kpis?.submissionCount);

  // 带某个 chapter (如果有)
  const ch = d1j.data?.filterOptions?.chapters?.[0]?.id;
  if (ch) {
    const d2 = await page.request.get(`${BASE}/api/lms/analytics-v2/diagnosis?courseId=${cid}&chapterId=${ch}`, {
      headers: { cookie: cookieHeader },
    });
    const d2j = await d2.json();
    console.log("diagnosis r2 (chapter) OK:", d2j.success, "instCount:", d2j.data?.kpis?.instanceCount, "submC:", d2j.data?.kpis?.submissionCount);
    console.log("scope.chapterId echo:", d2j.data?.scope?.chapterId, "vs requested:", ch);
  }

  // 改 range
  const d3 = await page.request.get(`${BASE}/api/lms/analytics-v2/diagnosis?courseId=${cid}&range=7d`, {
    headers: { cookie: cookieHeader },
  });
  const d3j = await d3.json();
  console.log("diagnosis r3 (range=7d) OK:", d3j.success, "instCount:", d3j.data?.kpis?.instanceCount, "echo range:", d3j.data?.scope?.range);
});

test("M4-3: 4 维度建议(知识/技能/关注/教学/下一步) 非占位", async ({ page }) => {
  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3000);

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const cRes = await page.request.get(`${BASE}/api/lms/courses?take=10`, {
    headers: { cookie: cookieHeader },
  });
  const courses = (await cRes.json()).data ?? [];
  if (courses.length === 0) {
    console.log("无课程，跳过");
    return;
  }
  const cid = courses[0].id;

  const insightsRes = await page.request.get(
    `${BASE}/api/lms/analytics-v2/scope-insights?courseId=${cid}`,
    { headers: { cookie: cookieHeader } },
  );
  const insights = await insightsRes.json();
  console.log("scope-insights OK:", insights.success);
  if (!insights.success) {
    console.log("失败:", JSON.stringify(insights.error));
    return;
  }
  const adv = insights.data?.teachingAdvice;
  console.log("teachingAdvice exists:", !!adv);
  if (adv) {
    console.log("  source:", adv.source);
    console.log("  notice:", adv.notice);
    console.log("  knowledgeGoals count:", adv.knowledgeGoals?.length, "first:", adv.knowledgeGoals?.[0]?.point?.slice(0, 80));
    console.log("  skillGoals count:", adv.skillGoals?.length, "first:", adv.skillGoals?.[0]?.point?.slice(0, 80));
    console.log("  pedagogyAdvice count:", adv.pedagogyAdvice?.length, "first:", adv.pedagogyAdvice?.[0]?.method?.slice(0, 80));
    console.log("  focusGroups count:", adv.focusGroups?.length, "first:", adv.focusGroups?.[0]?.group?.slice(0, 80));
    console.log("  nextSteps count:", adv.nextSteps?.length, "first:", adv.nextSteps?.[0]?.step?.slice(0, 80));
  }
  const sim = insights.data?.simulation;
  console.log("simulation.highlights:", sim?.highlights?.length, "commonIssues:", sim?.commonIssues?.length, "source:", sim?.source);
  const sb = insights.data?.studyBuddy;
  console.log("studyBuddy.bySection:", sb?.bySection?.length);
});

test("M4-4: score-distribution chart + bin click", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 250));
  });
  await loginTeacher(page);
  await page.goto(`${BASE}/teacher/analytics-v2`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SS}/04-score-dist.png`, fullPage: true });

  const distLabel = await page.getByText(/学生成绩分布|分数分布/).first().isVisible().catch(() => false);
  console.log("score dist label visible:", distLabel);

  // 测试 bin
  const bins = await page.locator("[data-testid='score-bin'], [data-bin], button:has-text('%')").count();
  console.log("score bin button count:", bins);

  console.log("console errors:", consoleErrors.length);
  for (const e of consoleErrors.slice(0, 5)) console.log("  ERR:", e);
});

test("M4-5: 教师主导 - submission release 流程", async ({ page }) => {
  await loginTeacher(page);
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // 拿教师的 instance + 任意 graded but unreleased submission
  const instRes = await page.request.get(`${BASE}/api/lms/task-instances?take=20`, {
    headers: { cookie: cookieHeader },
  });
  const insts = await instRes.json();
  console.log("instances OK:", insts.success, "count:", insts.data?.length);

  // 看 task-instances 页面看是否有"公布"按钮
  await page.goto(`${BASE}/teacher/instances`);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SS}/05-instances.png`, fullPage: true });
  const releaseLabel = await page.getByText(/公布|发布|审核|待审/).count();
  console.log("instances 页面有 '公布/发布/审核' 字样:", releaseLabel);
});

test("M4-6: 任务草稿审核流程 - AI 生成的 build draft 状态", async ({ page }) => {
  await loginTeacher(page);
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // 直接拉 course list 再列 build drafts
  const cRes = await page.request.get(`${BASE}/api/lms/courses?take=10`, {
    headers: { cookie: cookieHeader },
  });
  const courses = (await cRes.json()).data ?? [];
  console.log("课程数:", courses.length);
  for (const c of courses.slice(0, 2)) {
    const dRes = await page.request.get(`${BASE}/api/lms/courses/${c.id}/task-build-drafts`, {
      headers: { cookie: cookieHeader },
    });
    const dJson = await dRes.json();
    console.log(`课程 ${c.courseTitle}:`, dRes.status(), dJson?.success, "drafts count:", dJson?.data?.length);
    if (dJson?.success && dJson.data && dJson.data.length > 0) {
      const d = dJson.data[0];
      console.log("  first draft status:", d.status, "type:", d.taskType, "title:", d.title?.slice(0, 60));
    }
  }
});

test("M4-7: AI 调用留痕 - AiRun 表是否被写入 + 教师能否查看", async ({ page }) => {
  await loginTeacher(page);
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  // 看有没有 ai-run 查询接口
  for (const url of [
    `${BASE}/api/lms/ai-runs`,
    `${BASE}/api/lms/ai-tool/runs`,
    `${BASE}/api/admin/ai-runs`,
    `${BASE}/api/lms/admin/ai-runs`,
  ]) {
    const r = await page.request.get(url, { headers: { cookie: cookieHeader } });
    console.log(`GET ${url} -> ${r.status()}`);
  }

  // 触发一次 AI 生成（refresh scope insights），看是否产生新的 AiRun 日志（间接验证）
  const cRes = await page.request.get(`${BASE}/api/lms/courses?take=5`, {
    headers: { cookie: cookieHeader },
  });
  const courses = (await cRes.json()).data ?? [];
  if (courses.length > 0) {
    const before = Date.now();
    const r = await page.request.post(
      `${BASE}/api/lms/analytics-v2/scope-insights?courseId=${courses[0].id}`,
      { headers: { cookie: cookieHeader } },
    );
    console.log("scope-insights POST:", r.status(), "took ms:", Date.now() - before);
  }
});

test("M4-8: admin 视角 - 看 audit / ai-run 列表", async ({ page }) => {
  await loginAdmin(page);
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  for (const url of [
    `${BASE}/api/admin/ai-runs`,
    `${BASE}/api/admin/audit-logs`,
    `${BASE}/api/audit-logs`,
    `${BASE}/api/lms/audit-logs`,
    `${BASE}/admin`,
    `${BASE}/admin/audit`,
  ]) {
    const r = await page.request.get(url, { headers: { cookie: cookieHeader } });
    console.log(`GET ${url} -> ${r.status()}`);
  }
});
