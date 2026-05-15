import { prisma } from "@/lib/db/prisma";
import * as aiService from "./ai.service";
import { z } from "zod";
import {
  assertTaskInstanceReadable,
  assertTaskReadable,
} from "@/lib/auth/resource-access";
import { logAuditForced } from "@/lib/services/audit.service";
import { getKnowledgeSourcesForStudyBuddy } from "@/lib/services/course-knowledge-source.service";

type UserLike = { id: string; role: string; classId?: string | null };
type StudyBuddyMessageRecord = {
  role: string;
  content: string;
  createdAt: string;
  contextSources?: Array<{
    id: string;
    fileName: string;
    scopeLevel: string;
    scopeLabel: string;
    /** Unit 6: 持久化素材摘录（300 字截断），UI hover popover 用 */
    excerpt?: string;
  }>;
};

export async function createPost(data: {
  user: UserLike;
  // Unit 6: 自由问支持 — taskId optional
  taskId?: string;
  taskInstanceId?: string;
  courseId?: string;
  title: string;
  question: string;
  mode: "socratic" | "direct";
  anonymous: boolean;
  isPreview?: boolean;
}) {
  const isPreview = Boolean(data.isPreview);
  if (data.user.role !== "student" && !isPreview) throw new Error("FORBIDDEN");
  if (data.user.role === "student" && isPreview) throw new Error("FORBIDDEN");

  // Unit 6: 三种模式
  //   1. taskInstanceId 提供 → 任务实例相关；从 instance.courseId 反推
  //   2. taskId 提供 → 任务模板相关；从 task 反推任意一个实例的 courseId
  //   3. 都没有 → 自由问；可选 courseId（学生选课程或留空）
  let resolvedCourseId: string | undefined = data.courseId;

  if (data.taskInstanceId) {
    await assertTaskInstanceReadable(data.taskInstanceId, data.user);
    const instance = await prisma.taskInstance.findUnique({
      where: { id: data.taskInstanceId },
      select: { taskId: true, courseId: true },
    });
    if (!instance) throw new Error("INSTANCE_NOT_FOUND");
    if (data.taskId && instance.taskId !== data.taskId) {
      throw new Error("FORBIDDEN");
    }
    resolvedCourseId = instance.courseId ?? resolvedCourseId;
    if (!data.taskId) data = { ...data, taskId: instance.taskId };
  } else if (data.taskId) {
    await assertTaskReadable(data.taskId, data.user);
    if (!resolvedCourseId) {
      // 从该 task 任何一个 instance 反推 courseId（学生通过此 task 能看到的实例）
      const anyInst = await prisma.taskInstance.findFirst({
        where: { taskId: data.taskId },
        select: { courseId: true },
      });
      resolvedCourseId = anyInst?.courseId ?? undefined;
    }
  } else if (data.courseId) {
    // Codex-P1-2: 自由问 + courseId → 校验学生属于该 course 的某 class（防跨课程 KS 泄漏）
    // 学生 classId 必须 = Course.classId OR ∈ CourseClass.classId (CourseClasses 多班级关联)
    const userClassId = data.user.classId;
    if (!userClassId) throw new Error("FORBIDDEN");
    const course = await prisma.course.findFirst({
      where: {
        id: data.courseId,
        OR: [
          { classId: userClassId },
          { classes: { some: { classId: userClassId } } },
        ],
      },
      select: { id: true },
    });
    if (!course) {
      throw new Error("COURSE_ACCESS_DENIED");
    }
  }
  // 自由问（taskId / taskInstanceId 都没 + courseId 未传）：仅学生角色可发；courseId=null 持久化（admin-bin 兜底场景）

  const post = await prisma.studyBuddyPost.create({
    data: {
      studentId: data.user.id,
      taskId: data.taskId ?? null,
      courseId: resolvedCourseId ?? null,
      taskInstanceId: data.taskInstanceId,
      title: data.title,
      question: data.question,
      mode: data.mode,
      anonymous: data.anonymous,
      isPreview,
      messages: [{ role: "student", content: data.question, createdAt: new Date().toISOString() }],
    },
  });

  // 异步生成 AI 回复
  generateReply(post.id, data.user.id).catch(console.error);

  return post;
}

async function generateReply(postId: string, userId: string) {
  const post = await prisma.studyBuddyPost.findUnique({
    where: { id: postId },
    include: {
      task: { include: { simulationConfig: true } },
      taskInstance: {
        select: {
          title: true,
          taskId: true,
          courseId: true,
          chapterId: true,
          sectionId: true,
          course: { select: { courseTitle: true } },
          chapter: { select: { title: true } },
          section: { select: { title: true } },
          createdBy: true,
        },
      },
      course: { select: { id: true, courseTitle: true } },
    },
  });
  if (!post) return;

  const messages = (post.messages as StudyBuddyMessageRecord[]) || [];
  const modePrompt = post.mode === "socratic"
    ? "使用苏格拉底式教学法：不直接给出答案，而是每次提 1-2 个引导性问题帮助学生自己发现答案。先肯定学生思考中正确的部分，再通过提问引导其完善。"
    : "以清晰、分步骤的方式直接回答学生的问题。";

  const task = post.task;
  const taskInstance = post.taskInstance;
  // Unit 6: courseId 优先级 — taskInstance > post.courseId（自由问）
  const effectiveCourseId = taskInstance?.courseId ?? post.courseId ?? null;
  const materialSources = await getKnowledgeSourcesForStudyBuddy({
    courseId: effectiveCourseId,
    chapterId: taskInstance?.chapterId,
    sectionId: taskInstance?.sectionId,
    taskId: taskInstance?.taskId ?? post.taskId,
    taskInstanceId: post.taskInstanceId,
  });
  // Unit 6: referencedSources 持久化 excerpt（300 字截断），UI hover popover 用
  const referencedSources = materialSources.map((source) => ({
    id: source.id,
    fileName: source.fileName,
    scopeLevel: source.scopeLevel,
    scopeLabel: source.scopeLabel,
    excerpt: (source.excerpt ?? "").slice(0, 300),
  }));
  const taskContext = task?.simulationConfig?.studyBuddyContext || "";
  const materialContext = materialSources
    .map((source, index) => {
      const tags = source.conceptTags.length > 0
        ? `概念标签: ${source.conceptTags.join(" / ")}\n`
        : "";
      const summary = source.summary ? `摘要: ${source.summary}\n` : "";
      return `素材 ${index + 1}（${source.scopeLabel}）: ${source.fileName}\n${tags}${summary}摘录: ${source.excerpt}`;
    })
    .join("\n\n");
  const courseTitle = taskInstance?.course?.courseTitle ?? post.course?.courseTitle ?? null;
  const scopeLine = [
    courseTitle,
    taskInstance?.chapter?.title,
    taskInstance?.section?.title,
    taskInstance?.title,
  ].filter(Boolean).join(" / ");
  const isFreeForm = !post.taskId && !post.taskInstanceId;
  const hasMaterial = materialContext.length > 0;

  try {
    // Unit 6: AI 绝不拒答 — 无素材时明示 fallback 策略
    const fallbackInstructions = isFreeForm
      ? `这是一个自由提问（不绑定具体任务）。${courseTitle ? `学生选择了关联课程: ${courseTitle}。` : ""}请基于课程概要或通用金融常识回答；如有疑问范围超出课程，可解释相关基础概念。`
      : `这是一个任务相关提问。${scopeLine ? `范围: ${scopeLine}。` : ""}请围绕该任务或课程内容回答。`;
    const materialInstructions = hasMaterial
      ? `优先使用下方教师补充课程素材；如素材不直接覆盖问题，再用通用金融知识补充并明确推断边界。`
      : `未引用具体素材：当前问题范围内未匹配到教师上传的素材。请基于课程概要 / 章节名 / 通用金融常识回答，并在回复开头明确标注"未引用具体素材，以下基于通用知识"。`;

    const reply = await aiService.aiGenerateText(
      "studyBuddyReply",
      userId,
      `你是一位耐心的金融课程学习辅导助手。
${modePrompt}
${fallbackInstructions}
${taskContext ? `任务背景资料:\n${taskContext}` : ""}
${hasMaterial ? `教师补充课程素材:\n${materialContext}` : ""}
${task?.taskName ? `任务: ${task.taskName}` : ""}

规则：
1. 不要使用 Markdown 符号（如 **、#、-、*），如需列点请每条独立换行并用数字编号（如 1. 2. 3.）。
2. 注意上下文连贯，回答追问时参考之前的对话内容。
3. ${materialInstructions}
4. 绝不拒答 — 任何金融教学相关问题都应给出有教育价值的回答；只在问题完全偏离学习范畴时温和引导回到学习主题。
5. 围绕课程内容展开，不要发散到无关话题。`,
      `对话历史:\n${messages.map((m) => `${m.role === "student" ? "学生" : "助手"}: ${m.content}`).join("\n")}\n\n请回复：`,
      {
        settingsUserId: taskInstance?.createdBy || task?.creatorId || userId,
        metadata: {
          studyBuddyPostId: postId,
          taskId: post.taskId,
          taskInstanceId: post.taskInstanceId,
          courseId: effectiveCourseId,
          isFreeForm,
          hasMaterial,
          preview: post.isPreview,
        },
      },
    );

    const updatedMessages = [
      ...messages,
      {
        role: "ai",
        content: reply,
        createdAt: new Date().toISOString(),
        contextSources: referencedSources,
      },
    ];

    await prisma.studyBuddyPost.update({
      where: { id: postId },
      data: {
        aiReply: reply,
        replyGeneratedAt: new Date(),
        status: "answered",
        messages: updatedMessages,
      },
    });
  } catch (error) {
    await prisma.studyBuddyPost.update({
      where: { id: postId },
      data: { status: "error" },
    });
    console.error("学习伙伴回复失败:", error);
  }
}

export async function continueConversation(postId: string, userId: string, content: string) {
  const post = await prisma.studyBuddyPost.findUnique({
    where: { id: postId },
    include: { task: { include: { simulationConfig: true } } },
  });

  if (!post || post.studentId !== userId) {
    throw new Error("FORBIDDEN");
  }

  const messages = (post.messages as StudyBuddyMessageRecord[]) || [];
  messages.push({ role: "student", content, createdAt: new Date().toISOString() });

  await prisma.studyBuddyPost.update({
    where: { id: postId },
    data: { messages, status: "pending" },
  });

  // 异步生成回复
  generateReply(postId, userId).catch(console.error);

  return { success: true };
}

export async function listStudyBuddyPosts(
  user: UserLike,
  filters: { taskId?: string; taskInstanceId?: string; take?: number; preview?: boolean },
) {
  if (filters.taskInstanceId) {
    await assertTaskInstanceReadable(filters.taskInstanceId, user);
  }
  if (filters.taskId) {
    await assertTaskReadable(filters.taskId, user);
  }
  if (user.role !== "student" && !filters.taskId && !filters.taskInstanceId) {
    throw new Error("FORBIDDEN");
  }

  const take = Math.min(Math.max(filters.take ?? 100, 1), 100);
  return prisma.studyBuddyPost.findMany({
    where: {
      ...(filters.taskId && { taskId: filters.taskId }),
      ...(filters.taskInstanceId && { taskInstanceId: filters.taskInstanceId }),
      isPreview: Boolean(filters.preview),
      // Unit 5b: 默认过滤隐藏的 post（hidePost 软删）
      hiddenAt: null,
      ...(user.role === "student" && { studentId: user.id, isPreview: false }),
      ...(user.role !== "student" && filters.preview && { studentId: user.id }),
    },
    include: {
      student: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/**
 * Unit 5b: 软删 Study Buddy post（隐藏）
 * - 学生：仅能 hide 自己的 post
 * - 老师：仅能 hide 自己创建的 task 下的 post（Unit 5c 协作上扬不含 SB hide）
 * - admin：任意
 * 已 hidden 的 post 重复调用是 idempotent（不写第二条 audit）
 */
export async function hideStudyBuddyPost(postId: string, user: UserLike) {
  const post = await prisma.studyBuddyPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      studentId: true,
      taskId: true,
      hiddenAt: true,
      task: { select: { creatorId: true } },
    },
  });
  if (!post) throw new Error("STUDY_BUDDY_POST_NOT_FOUND");
  if (post.hiddenAt) return; // idempotent

  if (user.role === "student") {
    if (post.studentId !== user.id) throw new Error("FORBIDDEN");
  } else if (user.role === "teacher") {
    // Unit 6: 自由问 (post.task null) 仅 admin 可 hide；非自由问按 task.creatorId 判断
    if (!post.task || post.task.creatorId !== user.id) {
      throw new Error("FORBIDDEN");
    }
  } // admin: pass through

  await prisma.studyBuddyPost.update({
    where: { id: postId },
    data: { hiddenAt: new Date(), hiddenBy: user.id },
  });
  await logAuditForced({
    action: "study_buddy_post.hide",
    actorId: user.id,
    targetId: postId,
    targetType: "StudyBuddyPost",
    metadata: {
      studentId: post.studentId,
      byOwner: user.id === post.studentId,
    },
  });
}

export async function generateSummary(taskId: string, user: UserLike) {
  await assertTaskReadable(taskId, user);

  const posts = await prisma.studyBuddyPost.findMany({
    where: { taskId, status: "answered", isPreview: false },
    select: { question: true, aiReply: true, messages: true },
    take: 100,
  });

  if (posts.length === 0) {
    throw new Error("NO_POSTS_TO_SUMMARIZE");
  }

  const summarySchema = z.object({
    topQuestions: z.array(z.object({
      question: z.string(),
      count: z.number(),
      examples: z.array(z.string()),
    })),
    knowledgeGaps: z.array(z.object({
      topic: z.string(),
      description: z.string(),
      frequency: z.number(),
    })),
  });

  const questionsText = posts.map((p) => p.question).join("\n---\n");

  const result = await aiService.aiGenerateJSON(
    "studyBuddySummary",
    user.id,
    "你是一位教育数据分析专家。请分析学生们在学习伙伴中提出的问题，找出高频问题和知识盲区。注意识别模式：相似的问题即使措辞不同也应归为同一类。",
    `以下是 ${posts.length} 个学生提问:\n\n${questionsText}\n\n请返回 JSON:
{
  "topQuestions": [{"question": "高频问题", "count": 出现次数, "examples": ["原始问题示例"]}],
  "knowledgeGaps": [{"topic": "知识盲区主题", "description": "描述", "frequency": 出现频率}]
}`,
    summarySchema
  );

  return prisma.studyBuddySummary.create({
    data: {
      taskId,
      generatedAt: new Date(),
      topQuestions: result.topQuestions,
      knowledgeGaps: result.knowledgeGaps,
    },
  });
}
