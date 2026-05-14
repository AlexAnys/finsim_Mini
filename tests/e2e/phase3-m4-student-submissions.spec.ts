/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const */
/**
 * Phase 3 M-4: 4 学生真实提交 — 合并单 test，避免 NextAuth race
 */
import { test, expect, type Browser } from "@playwright/test";
import path from "path";
import fs from "fs";

const SIM_INSTANCE_ID = "341231af-8c5a-44af-9f41-aecdc9ff50a8";
const SIM_TASK_ID = "bead381b-fc71-4d69-8114-7575b1e47c5f";
const QUIZ_INSTANCE_ID = "d288859e-f2e9-4ceb-96d4-127295444ccb";
const QUIZ_TASK_ID = "9cd29095-7131-4a93-8395-69283666859d";
const SUB_INSTANCE_ID = "1eed59f9-3a70-4b30-9755-30a485e52b07";
const SUB_TASK_ID = "30a5aa1a-c64a-4461-95c2-c37c6ff00b91";
const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", ".harness", "screenshots", "phase3-m4");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

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
      console.log(`  login attempt ${attempts} failed for ${email}, retrying after 5s...`);
      await new Promise((r) => setTimeout(r, 5000));
      if (attempts >= 3) throw e;
    }
  }
  throw new Error("unreachable");
}

test("Phase 3 M-4: 4 学生真实提交", async ({ browser }) => {
  test.setTimeout(600_000); // 10 min

  // === belle 主观题 ===
  {
    const { ctx, page } = await makeStudentContext(browser, "belle@qq.com");
    console.log("✓ belle login OK");

    const textAnswer = `客户画像：李志华先生 38 岁，深圳互联网公司高级产品经理，离婚带两个学龄子女（小学三年级 + 幼儿园），月税后收入 5 万元，估家庭存款约 80 万。心理画像谨慎，对市场波动焦虑，最优先关注教育金和家庭医疗应急。

风险评估：客户自述偏谨慎，但口头期望年化 8% 以上脱离实际承受力。综合家庭单一收入来源、学龄子女抚养压力，实际风险承受能力评级为 C2-C3 (中等偏低)。

配置策略建议：
1. 底层保障先行 (15%)：先为客户本人配置重疾险 (50 万保额) + 意外险 + 定期寿险，再为孩子配置少儿重疾。
2. 现金应急储备 (15%)：保留 6 个月家庭支出约 12 万元，配置货币基金或高流动性银行理财。
3. 权益类资产 (30%)：以宽基指数基金为主 (沪深300、中证500)，避免单一行业基金，分批建仓减少择时风险。
4. 固收类资产 (25%)：国债 + 高评级债基组合。
5. 教育金专项 (15%)：每月定投教育金保险或长期偏债型基金，目标 18 年后子女上大学时使用。

风控提示：客户对波动敏感，建议权益占比从 20% 缓步上调到 30%，每季度检视市场反应。同时单一基金仓位不超过 8%，避免过度集中。教育金账户应锁定专款专用，不可挪作短期投资。`;

    const r = await page.request.post("/api/submissions", {
      data: {
        taskType: "subjective",
        taskId: SUB_TASK_ID,
        taskInstanceId: SUB_INSTANCE_ID,
        textAnswer,
        attachments: [],
      },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`belle POST subjective: ${r.status()}`);
    if (r.status() >= 400) console.log("  body:", (await r.text()).slice(0, 500));
    expect([200, 201]).toContain(r.status());
    const body = await r.json();
    console.log(`  → submission id: ${body.data?.id ?? body.id}`);
    await ctx.close();
  }

  // === alex simulation 3 轮 ===
  {
    const { ctx, page } = await makeStudentContext(browser, "alex@qq.com");
    console.log("✓ alex (sim) login OK");

    const transcript: Array<{ id: string; role: "student" | "ai"; text: string; timestamp: string }> = [];

    const STUDENT_MESSAGES = [
      "您好李先生，欢迎咨询。在给您具体建议前，我想先了解一下您的家庭情况和理财目标。您家里目前有几口人？孩子上学了吗？月度收支结构大概什么样？",
      "了解到您 38 岁单亲家庭核心劳动力，月入 5 万，两个孩子还在上学，最关注教育金和医疗保障。再请问您过往有没有理财投资经验？对市场波动的接受程度大概什么样？比如最近 A 股下跌时您有什么感受？",
      "好的，了解了。基于您的情况，我建议先把家庭保障底盘做扎实 — 重疾险加意外险保护好家庭收入来源，再保留 6 个月支出做应急金。然后中长期可以考虑稳健配置：教育金专项定投 + 部分宽基指数基金长期持有，整体权益占比建议先控制在 30% 左右。这样既能让资产稳健增值，又不会因短期波动影响家庭计划。您觉得这个方向能接受吗？",
    ];

    for (let i = 0; i < STUDENT_MESSAGES.length; i++) {
      const userMsg = STUDENT_MESSAGES[i];
      const tsBase = new Date();
      transcript.push({
        id: `s${i + 1}-${Date.now()}`,
        role: "student",
        text: userMsg,
        timestamp: tsBase.toISOString(),
      });
      console.log(`  Round ${i + 1}: student → ${userMsg.slice(0, 40)}...`);

      const r = await page.request.post("/api/ai/chat", {
        data: {
          taskInstanceId: SIM_INSTANCE_ID,
          transcript: transcript.map((m) => ({ role: m.role, text: m.text })),
        },
        headers: { "Content-Type": "application/json" },
      });
      console.log(`    AI chat status: ${r.status()}`);
      if (r.status() !== 200) {
        console.log("    body:", (await r.text()).slice(0, 400));
        break;
      }
      const body = await r.json();
      const data = body.data ?? body;
      const reply = data.reply ?? "";
      console.log(`    AI reply: ${reply.slice(0, 60)}...`);
      transcript.push({
        id: `a${i + 1}-${Date.now()}`,
        role: "ai",
        text: reply,
        timestamp: new Date().toISOString(),
        ...(data.mood ? { mood: data.mood } : {}),
        ...(data.moodScore != null ? { moodScore: data.moodScore } : {}),
        ...(data.hint ? { hint: data.hint } : {}),
      } as any);
      await page.waitForTimeout(1500);
    }

    // 提交
    const rSubmit = await page.request.post("/api/submissions", {
      data: {
        taskType: "simulation",
        taskId: SIM_TASK_ID,
        taskInstanceId: SIM_INSTANCE_ID,
        transcript,
      },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`alex POST simulation: ${rSubmit.status()}`);
    if (rSubmit.status() >= 400) console.log("  body:", (await rSubmit.text()).slice(0, 500));
    expect([200, 201]).toContain(rSubmit.status());
    const submitBody = await rSubmit.json();
    console.log(`  → submission id: ${submitBody.data?.id ?? submitBody.id}`);
    await ctx.close();
  }

  // === alex quiz adaptive ===
  {
    const { ctx, page } = await makeStudentContext(browser, "alex@qq.com");
    console.log("✓ alex (quiz) login OK");

    const history: Array<{ questionId: string; answer: any; correct: boolean; timeMs: number }> = [];
    let masteryReport: any = null;
    let stepCount = 0;

    while (stepCount < 10) {
      stepCount++;
      const r = await page.request.post(`/api/lms/tasks/${QUIZ_TASK_ID}/adaptive-quiz/next`, {
        data: {
          taskInstanceId: QUIZ_INSTANCE_ID,
          history,
        },
        headers: { "Content-Type": "application/json" },
      });
      console.log(`  Q${stepCount}: next status ${r.status()}`);
      if (r.status() !== 200) {
        console.log("    body:", (await r.text()).slice(0, 400));
        break;
      }
      const body = await r.json();
      const data = body.data ?? body;
      if (data.done) {
        console.log(`  ✓ adaptive done at Q${stepCount - 1}`);
        masteryReport = data.masteryReport;
        console.log(`  mastery KP count: ${masteryReport?.knowledgePoints?.length ?? 0}`);
        console.log(`  weakest: ${(masteryReport?.weakestTopics ?? []).slice(0, 3).join(", ")}`);
        break;
      }
      const nextQ = data.nextQuestion;
      if (!nextQ) {
        console.log("    no nextQuestion");
        break;
      }
      console.log(`    Q: ${nextQ.prompt?.slice(0, 40)}... type=${nextQ.type}`);

      const correctChance = Math.random() < 0.75;
      let answer: any;
      let correct = correctChance;
      if (nextQ.type === "true_false" || nextQ.type === "single_choice") {
        if (correctChance && nextQ.correctOptionIds?.length > 0) answer = nextQ.correctOptionIds[0];
        else {
          const wrong = nextQ.options?.find((o: any) => !nextQ.correctOptionIds?.includes(o.id));
          answer = wrong?.id ?? nextQ.options?.[0]?.id ?? "A";
        }
      } else if (nextQ.type === "multiple_choice") {
        if (correctChance && nextQ.correctOptionIds?.length > 0) answer = [...nextQ.correctOptionIds];
        else answer = [nextQ.options?.[0]?.id ?? "A"];
      } else if (nextQ.type === "short_answer") {
        answer = "我认为先建立保险保障是关键，避免家庭因突发风险陷入财务困境，之后再追求增值。";
      }
      history.push({ questionId: nextQ.id, answer, correct, timeMs: 15000 });
    }

    // 提交（带 masteryReport，schema 必填）
    if (masteryReport) {
      const rSubmit = await page.request.post("/api/submissions", {
        data: {
          taskType: "quiz",
          taskId: QUIZ_TASK_ID,
          taskInstanceId: QUIZ_INSTANCE_ID,
          answers: history.map((h) => ({
            questionId: h.questionId,
            answer: typeof h.answer === "string" ? h.answer : JSON.stringify(h.answer),
          })),
          durationSeconds: stepCount * 15,
          masteryReport,
        },
        headers: { "Content-Type": "application/json" },
      });
      console.log(`alex POST quiz: ${rSubmit.status()}`);
      if (rSubmit.status() >= 400) console.log("  body:", (await rSubmit.text()).slice(0, 600));
      expect([200, 201]).toContain(rSubmit.status());
    } else {
      console.log("  ⚠️ no masteryReport, skipping submission");
    }

    await ctx.close();
  }

  // === charlie 自由问 SB ===
  {
    const { ctx, page } = await makeStudentContext(browser, "charlie@qq.com");
    console.log("✓ charlie login OK");

    const r = await page.request.post("/api/study-buddy/posts", {
      data: {
        courseId: COURSE_ID,
        title: "复利效应到底有多重要",
        question:
          "老师在课程里提到了复利对长期理财很重要，能具体讲讲为什么时间这么关键吗？如果我从 25 岁开始每月存 2000 元，和 35 岁开始存的差距大概有多大？",
        mode: "direct",
      },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`charlie free SB: ${r.status()}`);
    if (r.status() >= 400) console.log("  body:", (await r.text()).slice(0, 400));
    await ctx.close();
  }

  // === dexter 任务相关 SB ===
  {
    const { ctx, page } = await makeStudentContext(browser, "dexter@qq.com");
    console.log("✓ dexter login OK");

    const r = await page.request.post("/api/study-buddy/posts", {
      data: {
        taskId: QUIZ_INSTANCE_ID,
        courseId: COURSE_ID,
        title: "权益类资产具体包括什么",
        question:
          "测验里问到「权益类资产」时我没把握。权益类、固收类、现金类、另类怎么具体区分？股票型基金为什么算权益不算另类？",
        mode: "guided",
      },
      headers: { "Content-Type": "application/json" },
    });
    console.log(`dexter task-bound SB: ${r.status()}`);
    if (r.status() >= 400) console.log("  body:", (await r.text()).slice(0, 400));
    await ctx.close();
  }

  console.log("\n=== M-4 Summary ===");
  console.log("- belle: subjective submitted");
  console.log("- alex: simulation 3 rounds + quiz adaptive");
  console.log("- charlie: free question SB");
  console.log("- dexter: task-bound SB");
});
