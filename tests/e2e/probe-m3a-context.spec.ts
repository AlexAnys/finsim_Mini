/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
import { test, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const SS = ".harness/screenshots/probe-m3a";

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "password123");
  await Promise.all([
    page.waitForURL((u) => !/\/login(\?|$)/.test(u.pathname + u.search), { timeout: 25_000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState("networkidle").catch(() => {});
}

test.setTimeout(300_000);

test("M3a-CTX: AI context awareness — 直接打 /api/ai/chat 验证多轮记忆", async ({ page }) => {
  await login(page, "student1@finsim.edu.cn");

  // 找一个学生有权限访问的 sim 任务
  const r1 = await page.request.get(`${BASE}/api/lms/task-instances?role=student`);
  const j1 = await r1.json();
  const inst = (j1.data || []).find((i: any) => i.taskType === "simulation");
  if (!inst) {
    console.log("NO SIM INSTANCE");
    return;
  }
  console.log("INSTANCE:", inst.id);

  const taskRes = await page.request.get(`${BASE}/api/lms/task-instances/${inst.id}`);
  const taskJson = await taskRes.json();
  const sim = taskJson.data.task.simulationConfig;
  console.log("SCENARIO:", sim?.scenario?.slice(0, 80));
  console.log("OPENING:", sim?.openingLine?.slice(0, 80));

  // Turn 1: student introduces 一个非常具体的信息 ("我儿子今年15岁")
  const turn1 = await page.request.post(`${BASE}/api/ai/chat`, {
    data: {
      taskInstanceId: inst.id,
      transcript: [
        { role: "ai", text: sim.openingLine },
        { role: "student", text: "您好！为了帮您做规划，我先了解一下您的家庭情况。请问您有几个孩子？多大年纪？" }
      ],
      scenario: sim.scenario,
      openingLine: sim.openingLine,
      objectives: ["需求澄清", "风险收益解释", "行动建议"],
    },
    headers: { "Content-Type": "application/json" },
  });
  console.log("TURN1 STATUS:", turn1.status());
  const t1Json = await turn1.json();
  const t1Reply = t1Json?.data?.reply || "";
  console.log("TURN1 AI REPLY:", t1Reply.slice(0, 300));

  // Turn 2: student asks "您说您有 N 个孩子，N 岁，对吗？" 验证 AI 记不记得自己上一轮说过的内容
  const turn2 = await page.request.post(`${BASE}/api/ai/chat`, {
    data: {
      taskInstanceId: inst.id,
      transcript: [
        { role: "ai", text: sim.openingLine },
        { role: "student", text: "您好！为了帮您做规划，我先了解一下您的家庭情况。请问您有几个孩子？多大年纪？" },
        { role: "ai", text: t1Reply },
        { role: "student", text: "好的，那您能再说一遍刚才提到的孩子数量和年龄吗？我做下记录。" },
      ],
      scenario: sim.scenario,
      openingLine: sim.openingLine,
      objectives: ["需求澄清", "风险收益解释", "行动建议"],
    },
    headers: { "Content-Type": "application/json" },
  });
  console.log("TURN2 STATUS:", turn2.status());
  const t2Json = await turn2.json();
  const t2Reply = t2Json?.data?.reply || "";
  console.log("TURN2 AI REPLY:", t2Reply.slice(0, 300));
  console.log("TURN2 MOOD:", JSON.stringify(t2Json?.data?.mood));
  console.log("TURN2 STUDENT_PERF:", t2Json?.data?.studentPerf);

  // Turn 3: 测意图偏离 → AI 应该 push back
  const turn3 = await page.request.post(`${BASE}/api/ai/chat`, {
    data: {
      taskInstanceId: inst.id,
      transcript: [
        { role: "ai", text: sim.openingLine },
        { role: "student", text: "你今天感觉怎么样？看场球赛吧。" },
      ],
      scenario: sim.scenario,
      openingLine: sim.openingLine,
      objectives: ["需求澄清", "风险收益解释", "行动建议"],
    },
    headers: { "Content-Type": "application/json" },
  });
  console.log("TURN3 STATUS:", turn3.status());
  const t3Json = await turn3.json();
  console.log("TURN3 AI REPLY:", t3Json?.data?.reply?.slice(0, 300));
  console.log("TURN3 MOOD:", JSON.stringify(t3Json?.data?.mood));
  console.log("TURN3 STUDENT_PERF:", t3Json?.data?.studentPerf);
  console.log("TURN3 DEVIATED:", JSON.stringify(t3Json?.data?.deviatedDimensions));
});

test("M3a-XCLASS: 跨班级权限验证 — A 班学生能否访问 B 班 sim instance", async ({ browser }) => {
  // 用 teacher 列出所有 sim instances，找一个不在 student1 班里的
  const tctx = await browser.newContext();
  const tp = await tctx.newPage();
  await login(tp, "teacher1@finsim.edu.cn");
  const allRes = await tp.request.get(`${BASE}/api/lms/task-instances?role=teacher`);
  const allJson = await allRes.json();
  console.log("TEACHER total:", (allJson.data || []).length);

  // student1 classId from session
  const sctx = await browser.newContext();
  const sp = await sctx.newPage();
  await login(sp, "student1@finsim.edu.cn");
  const meRes = await sp.request.get(`${BASE}/api/auth/session`);
  const me = await meRes.json();
  const myClass = me.user.classId;
  console.log("STUDENT1 class:", myClass);

  const sims = (allJson.data || []).filter((i: any) => i.taskType === "simulation");
  const myClassSims = sims.filter((i: any) => i.classId === myClass);
  const otherClassSims = sims.filter((i: any) => i.classId !== myClass);
  console.log("MY CLASS SIMS:", myClassSims.length, "OTHER CLASS SIMS:", otherClassSims.length);

  if (otherClassSims.length === 0) {
    console.log("NO other-class sim — skip");
    return;
  }
  const otherInst = otherClassSims[0];
  console.log("TRYING OTHER CLASS INSTANCE:", otherInst.id, "(classId:", otherInst.classId, ")");

  const probeRes = await sp.request.get(`${BASE}/api/lms/task-instances/${otherInst.id}`);
  console.log("PROBE STATUS:", probeRes.status());
  const probeJson = await probeRes.json();
  console.log("PROBE BODY:", JSON.stringify(probeJson).slice(0, 200));

  await sp.goto(`${BASE}/sim/${otherInst.id}`);
  await sp.waitForLoadState("networkidle").catch(() => {});
  await sp.waitForTimeout(2000);
  await sp.screenshot({ path: `${SS}/40-cross-class.png`, fullPage: true });
  const text = await sp.locator("body").innerText();
  console.log("SIM PAGE TEXT (cross-class attempt):", text.slice(0, 500));

  await tctx.close();
  await sctx.close();
});

test("M3a-RECOVER: 学生重进任务 — localStorage draft 恢复对话进度", async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await login(p, "student1@finsim.edu.cn");
  const r1 = await p.request.get(`${BASE}/api/lms/task-instances?role=student`);
  const j1 = await r1.json();
  const inst = (j1.data || []).find((i: any) => i.taskType === "simulation");
  if (!inst) { console.log("NO SIM"); return; }
  console.log("INSTANCE:", inst.id);
  await p.goto(`${BASE}/sim/${inst.id}`);
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1500);

  const ta = p.locator('textarea').first();
  await ta.fill("这是一条进度测试消息，应该能在重新打开后恢复。");
  await ta.press('Enter');
  await p.waitForTimeout(5500);
  await p.screenshot({ path: `${SS}/50-before-reload.png`, fullPage: true });

  // 拿 localStorage 内容
  const ls1 = await p.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.includes("finsim_sim_draft"));
    return keys.map((k) => ({ key: k, val: localStorage.getItem(k)?.slice(0, 200) }));
  });
  console.log("LOCALSTORAGE BEFORE RELOAD:", JSON.stringify(ls1).slice(0, 400));

  // reload
  await p.reload();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${SS}/51-after-reload.png`, fullPage: true });
  const text2 = await p.locator("body").innerText();
  console.log("AFTER RELOAD contains my msg:", text2.includes("这是一条进度测试消息"));

  await ctx.close();
});
