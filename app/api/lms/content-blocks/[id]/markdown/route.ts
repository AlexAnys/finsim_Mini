import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { assertSectionWritable } from "@/lib/auth/resource-access";
import { upsertMarkdownBlock } from "@/lib/services/course.service";
import { prisma } from "@/lib/db/prisma";
import { success, validationError, handleServiceError } from "@/lib/api-utils";
import { z } from "zod";

const markdownSchema = z.object({
  courseId: z.string().uuid(),
  chapterId: z.string().uuid(),
  sectionId: z.string().uuid(),
  slot: z.enum(["pre", "in", "post"]),
  content: z.string(),
});

export async function PUT(request: NextRequest) {
  const result = await requireRole(["teacher", "admin"]);
  if (result.error) return result.error;

  try {
    const body = await request.json();
    const parsed = markdownSchema.safeParse(body);
    if (!parsed.success) {
      return validationError("请求参数错误", parsed.error.flatten());
    }

    const { user } = result.session;
    // PR-FIX-1 A3: 按 sectionId 反查真实 courseId/chapterId（防 body 伪造跨课写）
    await assertSectionWritable(parsed.data.sectionId, {
      id: user.id,
      role: user.role,
      classId: user.classId,
    });
    const sec = await prisma.section.findUnique({
      where: { id: parsed.data.sectionId },
      select: { courseId: true, chapterId: true },
    });
    if (!sec) throw new Error("SECTION_NOT_FOUND");
    if (sec.courseId !== parsed.data.courseId) throw new Error("FORBIDDEN");
    if (sec.chapterId !== parsed.data.chapterId) throw new Error("FORBIDDEN");

    const block = await upsertMarkdownBlock(parsed.data);
    return success(block);
  } catch (err) {
    return handleServiceError(err);
  }
}
