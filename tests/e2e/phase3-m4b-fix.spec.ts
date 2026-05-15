/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
/**
 * Phase 3 M-4b fix: belle 答 simulation（chat 带完整 scenario）+ dexter SB mode=socratic
 */
import { test, expect, type Browser } from "@playwright/test";
import path from "path";
import fs from "fs";

const SIM_INSTANCE_ID = "341231af-8c5a-44af-9f41-aecdc9ff50a8";
const SIM_TASK_ID = "bead381b-fc71-4d69-8114-7575b1e47c5f";
const QUIZ_INSTANCE_ID = "d288859e-f2e9-4ceb-96d4-127295444ccb";
const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";

const SIM_SCENARIO =
  "潜在客户走进网点咨询理财方案。客户对投资了解有限，对收益期望高但表现出风险厌恶迹象，需要顾问通过沟通识别真实需求。";
const SIM_OPENING = "您好，我最近在考虑做点理财，但市场行情让我有些担心，想听听专业的建议。";
const SIM_SYSTEM = `你是李志华，38 岁深圳互联网公司高级产品经理，离婚带两个孩子（一个小学三年级，一个幼儿园中班），月税后收入 5 万。比较谨慎，最在意孩子教育金和家庭医疗应急。

回答顾问问题时表现：
- 对市场波动焦虑（最近 A 股下跌让你紧张）
- 对收益期望年化 8% 以上（不切实际）
- 不愿过多透露家庭存款（约 80 万）
- 不要在 reply 里附加 [MOOD: XXX] 标签 — mood 通过 JSON 字段传递。`;

async function makeStudentContext(browser: Browser, email: string) {
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.fill('input[type="email"], input[name="email"]', email);
      await page.fill('input[type="password"], input[name="password"]', "11");
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30000 });
      return { ctx, page };
    } catch (e) {
      console.log(`  retry ${attempts} for ${email}`);
      await new Promise((r) => setTimeout(r, 5000));
      if (attempts >= 3) throw e;
    }
  }
  throw new Error("unreachable");
}

test("M-4b fix: belle simulation + dexter SB socratic", async ({ browser }) => {
  test.setTimeout(300_000);

  // === belle simulation 3 轮 ===
  {
    const { ctx, page } = await makeStudentContext(browser, "belle@qq.com");
    console.log("✓ belle (sim) login OK");

    const transcript: Array<{ id: string; role: "student" | "ai"; text: string; timestamp: string }> = [];

    const STUDENT_MESSAGES = [
      "您好李先生，欢迎咨询。在给您具体建议前，我想先了解一下您的家庭情况和理财目标。您家里目前有几口人？孩子上学了吗？月度收支结构大概什么样？",
      "了解到您 38 岁单亲家庭核心劳动力，月入 5 万，两个孩子还在上学，最关注教育金和医疗保障。再请问您过往有没有理财投资经验？对市场波动的接受程度大概什么样？比如最近 A 股下跌时您有什么感受？",
      "好的，了解了。基于您的情况，我建议先把家庭保障底盘做扎实 — 重疾险加意外险保护好家庭收入来源，再保留 6 个月支出做应急金。然后中长期可以考虑稳健配置：教育金专项定投 + 部分宽基指数基金长期持有，整体权益占比建议先控制在 30% 左右。这样既能让资产稳健增值，又不会因短期波动影响家庭计划。您觉得这个方向能接受吗？",
    ];

    for (let i = 0; i < STUDENT_MESSAGES.length; i++) {
      const userMsg = STUDENT_MESSAGES[i];
      transcript.push({
        id: `s${i + 1}-${Date.now()}`,
        role: "student",
        text: userMsg,
        timestamp: new Date().toISOString(),
      });
      console.log(`  Round ${i + 1}: student → ${userMsg.slice(0, 40)}...`);

      const r = await page.request.post("/api/ai/chat", {
        data: {
          taskInstanceId: SIM_INSTANCE_ID,
          transcript: transcript.map((m) => ({ role: m.role, text: m.text })),
          scenario: SIM_SCENARIO,
          openingLine: SIM_OPENING,
          systemPrompt: SIM_SYSTEM,
        },
        headers: { "Content-Type": "application/json" },
      });
      console.log(`    AI chat: ${r.status()}`);
      if (r.status() !== 200) {
        console.log("    body:", (await r.text()).slice(0, 400));
        break;
      }
      const body = await r.json();
      const data = body.data ?? body;
      const reply = data.reply ?? "";
      console.log(`    AI reply (李志华): ${reply.slice(0, 80)}...`);
      transcript.push({
        id: `a${i + 1}-${Date.now()}`,
        role: "ai",
        text: reply,
        timestamp: new Date().toISOString(),
        // mood dropped: AI 可能返回 non-enum 值 (WORRIED 等)，schema 限 8 种
        // moodScore 同理
        // hint 同理
      } as any);
      await page.waitForTimeout(1500);
    }

    console.log(`  transcript final: ${transcript.length} messages`);
    expect(transcript.length).toBeGreaterThanOrEqual(4);

    // 提交（schema 要 transcript.length ≥1 + max 120）
    const rSubmit = await page.request.post("/api/submissions", {
      data: {
        taskType: "simulation",
        taskId: SIM_TASK_ID,
        taskInstanceId: SIM_INSTANCE_ID,
        transcript,
      },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`belle POST simulation: ${rSubmit.status()}`);
    if (rSubmit.status() >= 400) console.log("  body:", (await rSubmit.text()).slice(0, 500));
    expect([200, 201]).toContain(rSubmit.status());
    const submitBody = await rSubmit.json();
    console.log(`  → submission id: ${submitBody.data?.id ?? submitBody.id}`);
    await ctx.close();
  }

  // === dexter task-bound SB with mode=socratic ===
  {
    const { ctx, page } = await makeStudentContext(browser, "dexter@qq.com");
    console.log("✓ dexter login OK");

    const r = await page.request.post("/api/study-buddy/posts", {
      data: {
        taskInstanceId: QUIZ_INSTANCE_ID,
        courseId: COURSE_ID,
        title: "权益类资产具体包括什么",
        question:
          "测验里问到「权益类资产」时我没把握。权益类、固收类、现金类、另类怎么具体区分？股票型基金为什么算权益不算另类？",
        mode: "socratic",
      },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`dexter task-bound SB: ${r.status()}`);
    if (r.status() >= 400) console.log("  body:", (await r.text()).slice(0, 400));
    expect([200, 201]).toContain(r.status());
    await ctx.close();
  }
});
