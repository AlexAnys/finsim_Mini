import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ============================================
  // 1. 创建用户（先于班级，因为班级需要 createdBy）
  // ============================================
  const passwordHash = await bcrypt.hash("password123", 12);

  await prisma.user.upsert({
    where: { email: "admin@finsim.edu.cn" },
    update: {},
    create: {
      email: "admin@finsim.edu.cn",
      name: "系统管理员",
      passwordHash,
      role: "admin",
    },
  });

  const teacher1 = await prisma.user.upsert({
    where: { email: "teacher1@finsim.edu.cn" },
    update: {},
    create: {
      email: "teacher1@finsim.edu.cn",
      name: "王教授",
      passwordHash,
      role: "teacher",
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: "teacher2@finsim.edu.cn" },
    update: {},
    create: {
      email: "teacher2@finsim.edu.cn",
      name: "李教授",
      passwordHash,
      role: "teacher",
    },
  });

  console.log("  Users (admin + 2 teachers) created");

  // ============================================
  // 2. 创建班级
  // ============================================
  const class1 = await prisma.class.upsert({
    where: { name: "金融2024A班" },
    update: {},
    create: {
      name: "金融2024A班",
      code: "FIN-2024-A",
      academicYear: "2024",
      departmentName: "金融学院",
      createdBy: teacher1.id,
    },
  });

  const class2 = await prisma.class.upsert({
    where: { name: "金融2024B班" },
    update: {},
    create: {
      name: "金融2024B班",
      code: "FIN-2024-B",
      academicYear: "2024",
      departmentName: "金融学院",
      createdBy: teacher2.id,
    },
  });

  console.log("  Classes created");

  // ============================================
  // 3. 创建学生
  // ============================================
  const students = [];
  const studentData = [
    { email: "student1@finsim.edu.cn", name: "张三", classId: class1.id },
    { email: "student2@finsim.edu.cn", name: "李四", classId: class1.id },
    { email: "student3@finsim.edu.cn", name: "王五", classId: class1.id },
    { email: "student4@finsim.edu.cn", name: "赵六", classId: class1.id },
    { email: "student5@finsim.edu.cn", name: "陈七", classId: class2.id },
    { email: "student6@finsim.edu.cn", name: "周八", classId: class2.id },
  ];

  for (const s of studentData) {
    const student = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        name: s.name,
        passwordHash,
        role: "student",
        classId: s.classId,
      },
    });
    students.push(student);
  }

  console.log("  Students (6) created");

  // ============================================
  // 4. 创建课程
  // ============================================
  const course1 = await prisma.course.create({
    data: {
      courseTitle: "个人理财规划",
      courseCode: "FIN301",
      description: "本课程涵盖个人理财的基本概念、投资策略、风险管理和财务规划。",
      classId: class1.id,
      createdBy: teacher1.id,
    },
  });

  await prisma.course.create({
    data: {
      courseTitle: "投资分析基础",
      courseCode: "FIN302",
      description: "学习股票、债券、基金等金融产品的分析方法和投资决策框架。",
      classId: class2.id,
      createdBy: teacher2.id,
    },
  });

  console.log("  Courses created");

  // ============================================
  // 5. 创建章节和小节
  // ============================================
  const chaptersData = [
    {
      courseId: course1.id,
      title: "理财基础概念",
      order: 0,
      sections: [
        { title: "什么是个人理财", order: 0 },
        { title: "财务目标设定", order: 1 },
        { title: "收支管理", order: 2 },
      ],
    },
    {
      courseId: course1.id,
      title: "投资工具入门",
      order: 1,
      sections: [
        { title: "银行存款与理财", order: 0 },
        { title: "基金投资基础", order: 1 },
        { title: "股票投资入门", order: 2 },
      ],
    },
    {
      courseId: course1.id,
      title: "风险与资产配置",
      order: 2,
      sections: [
        { title: "风险认知与评估", order: 0 },
        { title: "资产配置策略", order: 1 },
      ],
    },
  ];

  const createdSections: Array<{
    id: string;
    chapterOrder: number;
    sectionOrder: number;
    chapterId: string;
  }> = [];

  for (const ch of chaptersData) {
    const chapter = await prisma.chapter.create({
      data: {
        courseId: ch.courseId,
        title: ch.title,
        order: ch.order,
        createdBy: teacher1.id,
      },
    });

    for (const sec of ch.sections) {
      const section = await prisma.section.create({
        data: {
          courseId: ch.courseId,
          chapterId: chapter.id,
          title: sec.title,
          order: sec.order,
          createdBy: teacher1.id,
        },
      });
      createdSections.push({
        id: section.id,
        chapterOrder: ch.order,
        sectionOrder: sec.order,
        chapterId: chapter.id,
      });
    }
  }

  console.log("  Chapters and sections created");

  // ============================================
  // 6. 创建任务 - 模拟对话
  // ============================================
  const simTask = await prisma.task.create({
    data: {
      taskName: "客户理财咨询模拟",
      taskType: "simulation",
      creatorId: teacher1.id,
      requirements:
        "1. 了解客户的财务状况\n2. 评估客户的风险承受能力\n3. 推荐合适的理财产品\n4. 解释投资风险",
      simulationConfig: {
        create: {
          scenario:
            "你是王女士，45岁，公司中层管理人员。你有100万存款想要理财。你的月收入2万，月支出1万。你有一个读高中的孩子，计划3年后出国留学。你对投资比较保守，之前只买过银行理财产品。",
          openingLine:
            "你好，我是王女士。我听朋友说可以来这里做理财咨询，我有一些积蓄想做些投资，但不太懂金融产品。",
          evaluatorPersona:
            "你是一位资深理财教育评估专家，关注学生的沟通技巧和专业建议质量。",
          strictnessLevel: "MODERATE",
          studyBuddyContext:
            "理财咨询模拟场景：中年女性客户，保守型投资偏好，有子女教育需求。",
        },
      },
      scoringCriteria: {
        create: [
          {
            name: "需求分析",
            maxPoints: 25,
            description: "是否充分了解客户的财务状况和理财目标",
            order: 0,
          },
          {
            name: "风险评估",
            maxPoints: 20,
            description: "是否合理评估客户的风险承受能力",
            order: 1,
          },
          {
            name: "方案推荐",
            maxPoints: 25,
            description: "推荐的理财方案是否合理、多样化",
            order: 2,
          },
          {
            name: "沟通技巧",
            maxPoints: 15,
            description: "沟通是否专业、耐心、通俗易懂",
            order: 3,
          },
          {
            name: "合规意识",
            maxPoints: 15,
            description: "是否充分披露风险、遵守合规要求",
            order: 4,
          },
        ],
      },
      allocationSections: {
        create: [
          {
            label: "资产配置方案",
            order: 0,
            items: {
              create: [
                { label: "银行存款/货币基金", order: 0 },
                { label: "债券/债券基金", order: 1 },
                { label: "混合基金", order: 2 },
                { label: "股票/股票基金", order: 3 },
                { label: "保险产品", order: 4 },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("  Simulation task created");

  // ============================================
  // 7. 创建任务 - 测验
  // ============================================
  const quizTask = await prisma.task.create({
    data: {
      taskName: "理财基础知识测验",
      taskType: "quiz",
      creatorId: teacher1.id,
      quizConfig: {
        create: {
          timeLimitMinutes: 30,
          mode: "fixed",
          showCorrectAnswer: true,
        },
      },
      quizQuestions: {
        create: [
          {
            type: "single_choice",
            prompt: "以下哪项不属于个人理财的基本步骤？",
            options: [
              { label: "A", content: "设定财务目标" },
              { label: "B", content: "评估财务状况" },
              { label: "C", content: "股票内幕交易" },
              { label: "D", content: "制定理财计划" },
            ],
            correctOptionIds: ["C"],
            points: 10,
            explanation:
              "股票内幕交易是违法行为，不属于合法的个人理财步骤。",
            order: 0,
          },
          {
            type: "single_choice",
            prompt: "货币基金的主要特点不包括？",
            options: [
              { label: "A", content: "流动性好" },
              { label: "B", content: "收益稳定" },
              { label: "C", content: "高风险高收益" },
              { label: "D", content: "门槛低" },
            ],
            correctOptionIds: ["C"],
            points: 10,
            explanation:
              "货币基金是低风险低收益产品，不属于高风险高收益类型。",
            order: 1,
          },
          {
            type: "multiple_choice",
            prompt: "以下哪些属于固定收益类投资产品？（多选）",
            options: [
              { label: "A", content: "国债" },
              { label: "B", content: "股票" },
              { label: "C", content: "企业债券" },
              { label: "D", content: "定期存款" },
            ],
            correctOptionIds: ["A", "C", "D"],
            points: 15,
            explanation:
              "国债、企业债券和定期存款都属于固定收益类产品，股票属于权益类产品。",
            order: 2,
          },
          {
            type: "true_false",
            prompt: "分散投资可以完全消除所有投资风险。",
            options: [
              { label: "正确", content: "正确" },
              { label: "错误", content: "错误" },
            ],
            correctOptionIds: ["错误"],
            points: 10,
            explanation:
              "分散投资可以降低非系统性风险，但无法消除系统性风险（市场风险）。",
            order: 3,
          },
          {
            type: "short_answer",
            prompt: "请简要说明什么是'72法则'，以及如何使用它？",
            options: [],
            correctAnswer:
              "72法则是一个快速估算投资翻倍时间的方法。用72除以年化收益率（百分比），得出资金翻倍所需的大约年数。例如，年化收益率为8%，则资金翻倍大约需要72÷8=9年。",
            points: 15,
            explanation: "72法则是理财规划中常用的快速估算工具。",
            order: 4,
          },
          {
            type: "single_choice",
            prompt: "以下哪种投资策略最适合风险厌恶型投资者？",
            options: [
              { label: "A", content: "全仓买入成长股" },
              { label: "B", content: "60%债券 + 40%股票的均衡配置" },
              { label: "C", content: "杠杆炒期货" },
              { label: "D", content: "追涨杀跌" },
            ],
            correctOptionIds: ["B"],
            points: 10,
            explanation:
              "均衡配置兼顾收益和风险控制，最适合风险厌恶型投资者。",
            order: 5,
          },
        ],
      },
    },
  });

  console.log("  Quiz task created");

  // ============================================
  // 8. 创建任务 - 主观题
  // ============================================
  const subjectiveTask = await prisma.task.create({
    data: {
      taskName: "个人投资组合分析报告",
      taskType: "subjective",
      creatorId: teacher1.id,
      requirements:
        "1. 分析至少3种不同类型的金融产品\n2. 说明选择理由和风险评估\n3. 给出具体的配置比例建议",
      subjectiveConfig: {
        create: {
          prompt:
            "假设你是一名刚入职的理财顾问，你的第一个客户是一位30岁的IT工程师，年薪40万，单身，风险承受能力中等偏高。请为他设计一份投资组合方案，并写一篇分析报告。报告需要包含：1）客户画像分析；2）投资目标设定；3）具体产品推荐和配置比例；4）风险提示。",
          allowTextAnswer: true,
          allowedAttachmentTypes: ["pdf", "docx", "xlsx"],
          evaluatorPersona:
            "你是一位严谨的金融教育评审，关注分析深度和实操性。",
          strictnessLevel: "MODERATE",
          referenceAnswer:
            "优秀答案应包含：全面的客户画像（年龄、收入、风险偏好）、明确的投资目标（短中长期）、多元化的产品推荐（含配置比例和理由）、详细的风险提示和应对策略。",
        },
      },
      scoringCriteria: {
        create: [
          {
            name: "客户分析",
            maxPoints: 20,
            description: "对客户财务状况和需求的分析是否全面",
            order: 0,
          },
          {
            name: "方案设计",
            maxPoints: 30,
            description: "投资方案是否合理、具体、可操作",
            order: 1,
          },
          {
            name: "风险分析",
            maxPoints: 25,
            description: "对各类风险的分析是否深入",
            order: 2,
          },
          {
            name: "文字表达",
            maxPoints: 15,
            description: "报告的结构、逻辑和语言表达",
            order: 3,
          },
          {
            name: "创新性",
            maxPoints: 10,
            description: "是否有独到见解或创新方案",
            order: 4,
          },
        ],
      },
    },
  });

  console.log("  Subjective task created");

  // ============================================
  // 9. 创建任务实例（发布到班级）
  // ============================================
  const section1 = createdSections.find(
    (s) => s.chapterOrder === 0 && s.sectionOrder === 2
  );
  const section2 = createdSections.find(
    (s) => s.chapterOrder === 1 && s.sectionOrder === 1
  );
  const section3 = createdSections.find(
    (s) => s.chapterOrder === 2 && s.sectionOrder === 1
  );

  const dueDate1 = new Date();
  dueDate1.setDate(dueDate1.getDate() + 14);

  const dueDate2 = new Date();
  dueDate2.setDate(dueDate2.getDate() + 7);

  const dueDate3 = new Date();
  dueDate3.setDate(dueDate3.getDate() + 21);

  await prisma.taskInstance.create({
    data: {
      taskId: simTask.id,
      courseId: course1.id,
      classId: class1.id,
      chapterId: section3?.chapterId,
      sectionId: section3?.id,
      title: "客户理财咨询模拟练习",
      description: "模拟与保守型客户的理财咨询对话",
      taskType: "simulation",
      status: "published",
      dueAt: dueDate1,
      publishedAt: new Date(),
      attemptsAllowed: 3,
      slot: "post",
      createdBy: teacher1.id,
    },
  });

  await prisma.taskInstance.create({
    data: {
      taskId: quizTask.id,
      courseId: course1.id,
      classId: class1.id,
      chapterId: section1?.chapterId,
      sectionId: section1?.id,
      title: "理财基础知识随堂测验",
      description: "测试对理财基本概念的掌握程度",
      taskType: "quiz",
      status: "published",
      dueAt: dueDate2,
      publishedAt: new Date(),
      attemptsAllowed: 2,
      slot: "in",
      createdBy: teacher1.id,
    },
  });

  await prisma.taskInstance.create({
    data: {
      taskId: subjectiveTask.id,
      courseId: course1.id,
      classId: class1.id,
      chapterId: section2?.chapterId,
      sectionId: section2?.id,
      title: "个人投资组合分析报告",
      description: "为模拟客户设计投资方案并撰写分析报告",
      taskType: "subjective",
      status: "published",
      dueAt: dueDate3,
      publishedAt: new Date(),
      attemptsAllowed: 1,
      slot: "post",
      createdBy: teacher1.id,
    },
  });

  console.log("  Task instances created (published to class A)");

  // ============================================
  // 10. 创建公告
  // ============================================
  await prisma.announcement.create({
    data: {
      courseId: course1.id,
      createdBy: teacher1.id,
      title: "欢迎来到个人理财规划课程",
      body: "同学们好！本学期我们将系统学习个人理财规划的相关知识。课程包含模拟对话、测验和报告写作三种任务类型，请按时完成各项作业。如有问题请随时在学习伙伴中提问。",
      status: "published",
    },
  });

  await prisma.announcement.create({
    data: {
      courseId: course1.id,
      createdBy: teacher1.id,
      title: "第一周作业提醒",
      body: "请大家本周完成理财基础知识随堂测验，测验时间为30分钟，可以尝试两次。",
      status: "published",
    },
  });

  console.log("  Announcements created");

  // ============================================
  // 11. 创建课表
  // ============================================
  await prisma.scheduleSlot.create({
    data: {
      courseId: course1.id,
      dayOfWeek: 1,
      slotIndex: 2,
      startWeek: 1,
      endWeek: 16,
      timeLabel: "10:00-11:40",
      classroom: "金融楼 301",
      createdBy: teacher1.id,
    },
  });

  await prisma.scheduleSlot.create({
    data: {
      courseId: course1.id,
      dayOfWeek: 3,
      slotIndex: 4,
      startWeek: 1,
      endWeek: 16,
      timeLabel: "14:00-15:40",
      classroom: "金融楼 301",
      createdBy: teacher1.id,
    },
  });

  console.log("  Schedule slots created");
  console.log("");
  console.log("Seed complete!");
  console.log("");
  console.log("Test accounts:");
  console.log("  Admin:    admin@finsim.edu.cn / password123");
  console.log("  Teacher1: teacher1@finsim.edu.cn / password123");
  console.log("  Teacher2: teacher2@finsim.edu.cn / password123");
  console.log("  Student1: student1@finsim.edu.cn / password123 (A)");
  console.log("  Student2: student2@finsim.edu.cn / password123 (A)");
  console.log("  Student3: student3@finsim.edu.cn / password123 (A)");
  console.log("  Student4: student4@finsim.edu.cn / password123 (A)");
  console.log("  Student5: student5@finsim.edu.cn / password123 (B)");
  console.log("  Student6: student6@finsim.edu.cn / password123 (B)");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
