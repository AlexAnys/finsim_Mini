/**
 * Phase 3 M-3: molly 创建 3 类演示任务并发布到金融2024A班
 * - Simulation: 客户风险评估对话
 * - Quiz: 理财基础自适应测验（mode=adaptive maxQuestions=8）
 * - Subjective: 为客户写资产配置建议书
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const COURSE_ID = "8f7f653c-9177-44f6-b764-80f7f779b2ef";
const CLASS_ID_A = "deedd844-e302-4b20-903d-d9b1d0e12439";

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", ".harness", "screenshots", "phase3-m3");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function loginMolly(page: Page) {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.fill('input[type="email"], input[name="email"]', "molly@qq.com");
  await page.fill('input[type="password"], input[name="password"]', "123456");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 });
}

function inHours(h: number): string {
  return new Date(Date.now() + h * 3600 * 1000).toISOString();
}

test("Phase 3 M-3: molly 创建 3 类演示任务", async ({ page }) => {
  test.setTimeout(120_000);

  await loginMolly(page);
  console.log("✓ molly login OK");

  // 拿到 5 章 ID 用于挂任务到对应章节
  const rChapters = await page.request.get(
    `/api/lms/courses/${COURSE_ID}`,
  );
  const cBody = await rChapters.json();
  const chapters = cBody.data?.chapters ?? cBody.chapters ?? [];
  console.log(`got ${chapters.length} chapters`);
  expect(chapters.length).toBeGreaterThanOrEqual(5);
  const chFinance = chapters[0]; // 1. 理财基础与客户分析
  const chRisk = chapters[2];    // 3. 保险与风险管理
  const chInvest = chapters[3];  // 4. 投资规划与资产配置

  // === Task 1: Simulation 客户风险评估对话 ===
  const simPayload = {
    task: {
      taskType: "simulation",
      taskName: "客户风险评估模拟对话",
      requirements:
        "你将作为理财顾问，与潜在客户进行风险评估对话。请通过提问了解客户的家庭情况、收入支出、风险偏好与理财目标，最终给出初步资产配置建议方向。",
      simulationConfig: {
        scenario:
          "潜在客户走进网点咨询理财方案。客户对投资了解有限，对收益期望高但表现出风险厌恶迹象，需要顾问通过沟通识别真实需求。",
        openingLine:
          "您好，我最近在考虑做点理财，但市场行情让我有些担心，想听听专业的建议。",
        dialogueRequirements:
          "围绕家庭背景、现金流、风险承受、理财目标四个维度提问；避免一上来推产品；最后给出初步配置思路。",
        evaluatorPersona: "金融机构资深合规审核员",
        strictnessLevel: "MODERATE",
        systemPrompt:
          "你是李志华，38 岁深圳互联网公司高级产品经理，离婚带两个孩子（一个小学三年级，一个幼儿园中班），月税后收入 5 万。比较谨慎，最在意孩子教育金和家庭医疗应急。\n\n回答顾问问题时表现：\n- 对市场波动焦虑（最近 A 股下跌让你紧张）\n- 对收益期望年化 8% 以上（不切实际）\n- 不愿过多透露家庭存款（约 80 万）\n- 不要在 reply 里附加 [MOOD: XXX] 标签 — mood 通过 JSON 字段传递。",
      },
      scoringCriteria: [
        { name: "开场与建立信任", description: "顾问开场是否专业、有同理心地建立沟通氛围", maxPoints: 15, order: 0 },
        { name: "需求识别", description: "是否系统了解客户家庭、收入、目标", maxPoints: 25, order: 1 },
        { name: "风险偏好评估", description: "是否准确识别客户真实风险承受能力（非客户自述）", maxPoints: 20, order: 2 },
        { name: "沟通技巧", description: "提问是否开放式、逻辑递进、避免推销", maxPoints: 20, order: 3 },
        { name: "初步建议合理性", description: "最后给出的配置方向是否符合客户实际情况", maxPoints: 20, order: 4 },
      ],
    },
    instance: {
      title: "客户风险评估模拟对话",
      description: "模拟与潜在客户的首次理财咨询沟通，覆盖需求识别与风险评估。",
      classId: CLASS_ID_A,
      groupIds: [],
      courseId: COURSE_ID,
      chapterId: chFinance.id,
      slot: "in",
      dueAt: inHours(72),
      attemptsAllowed: 2,
    },
  };

  const rSim = await page.request.post("/api/lms/task-instances/with-task", {
    data: simPayload,
    headers: { "Content-Type": "application/json" },
  });
  console.log(`Task 1 simulation: ${rSim.status()}`);
  if (rSim.status() >= 400) {
    console.log("body:", (await rSim.text()).slice(0, 500));
  }
  expect([200, 201]).toContain(rSim.status());
  const simBody = await rSim.json();
  const simInstanceId = simBody.data?.instance?.id ?? simBody.data?.id;
  console.log(`  → instance id: ${simInstanceId}`);

  // === Task 2: Quiz 理财基础自适应测验 ===
  const quizQuestions = [
    {
      type: "true_false",
      prompt: "现金及现金等价物属于流动性最高的资产，应当作为应急储备的首选。",
      options: [
        { id: "A", text: "正确" },
        { id: "B", text: "错误" },
      ],
      correctOptionIds: ["A"],
      points: 1,
      difficulty: 2,
      explanation: "正确。现金及活期类资产流动性最高，是应急储备金的标准选择。",
      order: 0,
    },
    {
      type: "single_choice",
      prompt: "通常应急储备金建议覆盖几个月的家庭基本支出？",
      options: [
        { id: "A", text: "1-2 个月" },
        { id: "B", text: "3-6 个月" },
        { id: "C", text: "12 个月以上" },
        { id: "D", text: "无需储备" },
      ],
      correctOptionIds: ["B"],
      points: 1,
      difficulty: 2,
      explanation: "3-6 个月是行业普遍建议，平衡流动性与机会成本。",
      order: 1,
    },
    {
      type: "single_choice",
      prompt: "下列哪种保险通常被认为是家庭风险保障的「基础底盘」？",
      options: [
        { id: "A", text: "万能险" },
        { id: "B", text: "重大疾病保险" },
        { id: "C", text: "终身寿险" },
        { id: "D", text: "投连险" },
      ],
      correctOptionIds: ["B"],
      points: 2,
      difficulty: 3,
      explanation: "重疾险覆盖核心健康风险，是家庭保障第一道防线。",
      order: 2,
    },
    {
      type: "multiple_choice",
      prompt: "影响个人风险承受能力的主要因素有哪些？(多选)",
      options: [
        { id: "A", text: "年龄" },
        { id: "B", text: "家庭负担" },
        { id: "C", text: "投资经验" },
        { id: "D", text: "家庭收入与净资产" },
      ],
      correctOptionIds: ["A", "B", "C", "D"],
      points: 2,
      difficulty: 3,
      explanation: "客户实际承受力受多维度影响，需要综合评估。",
      order: 3,
    },
    {
      type: "multiple_choice",
      prompt: "以下哪些属于「权益类」资产？(多选)",
      options: [
        { id: "A", text: "股票" },
        { id: "B", text: "国债" },
        { id: "C", text: "股票型基金" },
        { id: "D", text: "货币基金" },
      ],
      correctOptionIds: ["A", "C"],
      points: 2,
      difficulty: 4,
      explanation: "权益类资产代表对企业的所有权。股票与股票型基金属于权益类；国债是固收，货币基金是现金类。",
      order: 4,
    },
    {
      type: "true_false",
      prompt: "复利的效应随时间延长会显著放大，对长期理财目标至关重要。",
      options: [
        { id: "A", text: "正确" },
        { id: "B", text: "错误" },
      ],
      correctOptionIds: ["A"],
      points: 1,
      difficulty: 2,
      explanation: "复利效应使时间成为最重要的杠杆变量。",
      order: 5,
    },
    {
      type: "single_choice",
      prompt: "对于退休距离 30 年以上的年轻投资者，相对合理的权益类资产占比通常是：",
      options: [
        { id: "A", text: "0-20%" },
        { id: "B", text: "20-40%" },
        { id: "C", text: "60-80%" },
        { id: "D", text: "100%" },
      ],
      correctOptionIds: ["C"],
      points: 2,
      difficulty: 4,
      explanation: "长投资期可承受波动以换取长期增值，60-80% 权益占比常见。",
      order: 6,
    },
    {
      type: "short_answer",
      prompt:
        "简述「先保障后理财」的含义，以及为何在年轻家庭中尤为重要（30-100 字）。",
      points: 3,
      difficulty: 4,
      correctAnswer:
        "先保障指通过保险等工具覆盖收入中断 / 重疾 / 意外等风险，避免家庭因突发事件陷入财务困境；后理财指在风险底盘搭建后再追求增值。年轻家庭一旦主要劳动力发生意外，家庭现金流断裂的风险极高，因此保障优先。",
      explanation:
        "考察风险管理优先于投资增值的核心理念。",
      order: 7,
    },
  ];

  const quizPayload = {
    task: {
      taskType: "quiz",
      taskName: "理财基础自适应测验",
      requirements: "本测验为自适应模式，系统将根据答题情况动态调整题目难度，最多 8 题。完成后获得知识点掌握诊断报告。",
      quizConfig: {
        mode: "adaptive",
        timeLimitMinutes: 30,
        showCorrectAnswer: true,
        maxQuestions: 8,
        startDifficulty: 3,
        difficultyStep: 1,
      },
      quizQuestions,
    },
    instance: {
      title: "理财基础自适应测验",
      description: "覆盖现金管理 / 风险保障 / 投资规划三大模块基础概念。",
      classId: CLASS_ID_A,
      groupIds: [],
      courseId: COURSE_ID,
      chapterId: chFinance.id,
      slot: "in",
      dueAt: inHours(96),
      attemptsAllowed: 1,
    },
  };

  const rQuiz = await page.request.post("/api/lms/task-instances/with-task", {
    data: quizPayload,
    headers: { "Content-Type": "application/json" },
  });
  console.log(`Task 2 quiz: ${rQuiz.status()}`);
  if (rQuiz.status() >= 400) {
    console.log("body:", (await rQuiz.text()).slice(0, 500));
  }
  expect([200, 201]).toContain(rQuiz.status());
  const quizBody = await rQuiz.json();
  const quizInstanceId = quizBody.data?.instance?.id ?? quizBody.data?.id;
  const quizTaskId = quizBody.data?.task?.id;
  console.log(`  → instance id: ${quizInstanceId}, task id: ${quizTaskId}`);

  // === Task 3: Subjective 资产配置建议书 ===
  const subPayload = {
    task: {
      taskType: "subjective",
      taskName: "为李志华客户撰写资产配置建议书",
      requirements:
        "基于本课程「客户风险评估模拟对话」中李志华客户的情况（38 岁，离婚带 2 娃，月入 5 万，关注教育金和医疗保障），为他撰写一份初步资产配置建议书。建议书应包含：客户画像、风险评估、配置策略、产品类别建议、风控提示。",
      subjectiveConfig: {
        prompt:
          "字数不少于 300 字，建议结构化分点表达。可上传 PDF/DOCX 作为附件。",
        allowTextAnswer: true,
        allowedAttachmentTypes: ["pdf", "docx"],
        referenceAnswer:
          "客户画像：38 岁单亲家庭核心劳动力，2 个学龄子女，月入 5 万但谨慎厌恶风险，最优先关注教育金与医疗应急。\n\n风险评估：客户自述谨慎，但期望年化 8% 以上脱离现实；实际风险承受能力中等偏低（C2-C3）。\n\n配置策略：底层保障先行（重疾 + 意外险），现金应急保留 6 个月支出，权益类 30-40%（指数基金为主），固收类 30-40%（债基/银行理财），教育金专项 20%（教育金保险 + 长期定投）。\n\n风控提示：避免单一产品集中、关注客户对市场波动的实际反应、动态调整权益比例。",
        evaluatorPersona: "理财机构高级合规导师",
        strictnessLevel: "MODERATE",
      },
      scoringCriteria: [
        { name: "客户画像准确性", description: "是否准确刻画客户家庭、收入、心理状态", maxPoints: 20, order: 0 },
        { name: "风险评估专业度", description: "是否区分客户自述与真实承受力，分级合理", maxPoints: 20, order: 1 },
        { name: "配置策略合理性", description: "资产配置比例与客户情况匹配", maxPoints: 25, order: 2 },
        { name: "产品类别建议", description: "推荐的产品类别是否符合保障优先原则", maxPoints: 20, order: 3 },
        { name: "风控提示完整性", description: "是否覆盖动态调整、单一风险等要点", maxPoints: 15, order: 4 },
      ],
    },
    instance: {
      title: "为李志华撰写资产配置建议书",
      description: "实操作业：基于模拟对话客户情况撰写专业建议书。",
      classId: CLASS_ID_A,
      groupIds: [],
      courseId: COURSE_ID,
      chapterId: chInvest.id,
      slot: "post",
      dueAt: inHours(168),
      attemptsAllowed: 2,
    },
  };

  const rSub = await page.request.post("/api/lms/task-instances/with-task", {
    data: subPayload,
    headers: { "Content-Type": "application/json" },
  });
  console.log(`Task 3 subjective: ${rSub.status()}`);
  if (rSub.status() >= 400) {
    console.log("body:", (await rSub.text()).slice(0, 500));
  }
  expect([200, 201]).toContain(rSub.status());
  const subBody = await rSub.json();
  const subInstanceId = subBody.data?.instance?.id ?? subBody.data?.id;
  console.log(`  → instance id: ${subInstanceId}`);

  // 截图教师任务列表
  await page.goto(`/teacher/courses/${COURSE_ID}`);
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "01-course-with-3-tasks.png"),
    fullPage: true,
  });

  console.log("\n=== M-3 Summary ===");
  console.log(`Simulation instance: ${simInstanceId}`);
  console.log(`Quiz instance: ${quizInstanceId}`);
  console.log(`Subjective instance: ${subInstanceId}`);
  console.log(`Quiz task id (for tag-questions later): ${quizTaskId}`);
});
