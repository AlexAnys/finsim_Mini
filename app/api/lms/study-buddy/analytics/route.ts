import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { prisma } from "@/lib/db/prisma";
import { aiGenerateJSON } from "@/lib/services/ai.service";

const summarySchema = z.object({
  keyQuestions: z.array(z.string()).default([]),
  knowledgeGaps: z.array(z.string()).default([]),
  teachingSuggestions: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const summarize = searchParams.get("summarize") === "true";
    if (!courseId) return validationError("缺少 courseId");

    const { user } = result.session;
    await assertCourseAccess(courseId, user.id, user.role);

    const posts = await prisma.studyBuddyPost.findMany({
      where: {
        isPreview: false,
        OR: [
          { taskInstance: { courseId } },
          { task: { taskInstances: { some: { courseId } } } },
        ],
      },
      include: {
        student: { select: { id: true, name: true, email: true } },
        task: { select: { id: true, taskName: true, taskType: true } },
        taskInstance: {
          select: {
            id: true,
            title: true,
            chapter: { select: { id: true, title: true, order: true } },
            section: { select: { id: true, title: true, order: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const grouped = new Map<string, {
      chapterId: string;
      chapterTitle: string;
      sectionId: string;
      sectionTitle: string;
      taskId: string;
      taskTitle: string;
      taskType: string;
      questionCount: number;
      pendingCount: number;
      students: Map<string, { id: string; name: string; count: number }>;
      examples: string[];
    }>();

    for (const post of posts) {
      const chapter = post.taskInstance?.chapter;
      const section = post.taskInstance?.section;
      const key = [
        chapter?.id || "no-chapter",
        section?.id || "no-section",
        post.taskId,
      ].join(":");
      const current = grouped.get(key) ?? {
        chapterId: chapter?.id || "",
        chapterTitle: chapter?.title || "未绑定章节",
        sectionId: section?.id || "",
        sectionTitle: section?.title || "未绑定小节",
        taskId: post.taskId,
        taskTitle: post.taskInstance?.title || post.task.taskName,
        taskType: post.task.taskType,
        questionCount: 0,
        pendingCount: 0,
        students: new Map<string, { id: string; name: string; count: number }>(),
        examples: [],
      };
      current.questionCount += 1;
      if (post.status !== "answered") current.pendingCount += 1;
      const student = current.students.get(post.studentId) ?? {
        id: post.studentId,
        name: post.anonymous ? "匿名学生" : (post.student.name || post.student.email),
        count: 0,
      };
      student.count += 1;
      current.students.set(post.studentId, student);
      if (current.examples.length < 5) {
        current.examples.push(post.question);
      }
      grouped.set(key, current);
    }

    const groups = Array.from(grouped.values()).map((group) => ({
      ...group,
      students: Array.from(group.students.values()).sort((a, b) => b.count - a.count),
    }));

    let aiSummary: z.infer<typeof summarySchema> | null = null;
    let aiError: string | null = null;
    if (summarize && posts.length > 0) {
      try {
        aiSummary = await aiGenerateJSON(
          "studyBuddySummary",
          user.id,
          "你是一位教学诊断助手。请基于学生 Study Buddy 提问做聚类总结，不要编造未出现的问题。",
          `课程 Study Buddy 提问如下：\n${posts
            .slice(0, 120)
            .map((post, index) => `${index + 1}. ${post.taskInstance?.chapter?.title || "未绑定章节"} / ${post.taskInstance?.section?.title || "未绑定小节"} / ${post.taskInstance?.title || post.task.taskName}: ${post.question}`)
            .join("\n")}\n\n请输出 JSON：{"keyQuestions":[],"knowledgeGaps":[],"teachingSuggestions":[]}`,
          summarySchema,
          1,
          { settingsUserId: user.id, metadata: { courseId, source: "study_buddy_course_analytics" } },
        );
      } catch (err) {
        aiError = err instanceof Error ? err.message : String(err);
      }
    }

    return success({
      totalQuestions: posts.length,
      pendingQuestions: posts.filter((post) => post.status !== "answered").length,
      activeStudents: new Set(posts.map((post) => post.studentId)).size,
      groups,
      aiSummary,
      aiError,
    });
  } catch (err) {
    return handleServiceError(err);
  }
}
