import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db/prisma", () => {
  const chapter = {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const section = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const courseKnowledgeSource = {
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const prisma = {
    chapter,
    section,
    courseKnowledgeSource,
    $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
  };
  return { prisma };
});

import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { POST } from "@/app/api/lms/courses/[id]/outline-apply/route";

const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const SOURCE_ID = "22222222-2222-4222-8222-222222222222";
const CHAPTER_KEEP_ID = "33333333-3333-4333-8333-333333333333";
const CHAPTER_DELETE_ID = "44444444-4444-4444-8444-444444444444";
const CHAPTER_LOCKED_ID = "55555555-5555-4555-8555-555555555555";

function buildRequest(body: unknown) {
  return new Request(`http://localhost/api/lms/courses/${COURSE_ID}/outline-apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setAuthOk() {
  (requireRole as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: { user: { id: "teacher-1", role: "teacher" } },
    error: null,
  });
}

function setKnowledgeSource(structuredData: unknown) {
  (prisma.courseKnowledgeSource.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: SOURCE_ID,
    fileName: "outline.docx",
    structuredData,
  });
}

describe("POST /api/lms/courses/[id]/outline-apply (mode=replace)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renames and reorders existing chapters by chapterId", async () => {
    setAuthOk();
    setKnowledgeSource({
      chapters: [
        {
          chapterId: CHAPTER_KEEP_ID,
          title: "新名字",
          sections: [],
        },
      ],
    });
    (prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: CHAPTER_KEEP_ID,
        title: "旧名字",
        order: 0,
        taskInstances: [],
        sections: [],
      },
    ]);

    const req = buildRequest({ sourceId: SOURCE_ID, mode: "replace" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: COURSE_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(prisma.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CHAPTER_KEEP_ID },
        data: expect.objectContaining({ title: "新名字", order: 0 }),
      }),
    );
    expect(prisma.chapter.delete).not.toHaveBeenCalled();
  });

  it("deletes chapters that are missing from the draft when no tasks reference them", async () => {
    setAuthOk();
    setKnowledgeSource({
      chapters: [{ chapterId: CHAPTER_KEEP_ID, title: "保留", sections: [] }],
    });
    (prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CHAPTER_KEEP_ID, title: "保留", order: 0, taskInstances: [], sections: [] },
      { id: CHAPTER_DELETE_ID, title: "删我", order: 1, taskInstances: [], sections: [] },
    ]);

    const req = buildRequest({ sourceId: SOURCE_ID, mode: "replace" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: COURSE_ID }),
    });
    expect(res.status).toBe(200);
    expect(prisma.chapter.delete).toHaveBeenCalledWith({ where: { id: CHAPTER_DELETE_ID } });
  });

  it("refuses to delete a chapter that has task instances and returns a Chinese message", async () => {
    setAuthOk();
    setKnowledgeSource({
      chapters: [{ chapterId: CHAPTER_KEEP_ID, title: "保留", sections: [] }],
    });
    (prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CHAPTER_KEEP_ID, title: "保留", order: 0, taskInstances: [], sections: [] },
      {
        id: CHAPTER_LOCKED_ID,
        title: "有任务的章节",
        order: 1,
        taskInstances: [{ id: "ti-1" }, { id: "ti-2" }],
        sections: [],
      },
    ]);

    const req = buildRequest({ sourceId: SOURCE_ID, mode: "replace" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: COURSE_ID }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("OUTLINE_REPLACE_BLOCKED");
    expect(json.error.message).toContain("有任务的章节");
    expect(json.error.message).toMatch(/任务/);
    expect(prisma.chapter.delete).not.toHaveBeenCalled();
  });

  it("save-draft mode persists structuredData without mutating chapters", async () => {
    setAuthOk();
    setKnowledgeSource({ chapters: [{ title: "草稿章" }] });
    (prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = buildRequest({
      sourceId: SOURCE_ID,
      mode: "save-draft",
      outline: { chapters: [{ title: "新草稿" }] },
    });
    const res = await POST(req as unknown as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: COURSE_ID }),
    });
    expect(res.status).toBe(200);
    expect(prisma.courseKnowledgeSource.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SOURCE_ID },
        data: expect.objectContaining({
          structuredData: expect.objectContaining({
            chapters: [expect.objectContaining({ title: "新草稿" })],
          }),
        }),
      }),
    );
    expect(prisma.chapter.create).not.toHaveBeenCalled();
    expect(prisma.chapter.update).not.toHaveBeenCalled();
    expect(prisma.chapter.delete).not.toHaveBeenCalled();
  });

  it("safe-merge mode still only adds missing chapters (backwards compat)", async () => {
    setAuthOk();
    setKnowledgeSource({ chapters: [{ title: "C1" }, { title: "C2" }] });
    (prisma.chapter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: CHAPTER_KEEP_ID, title: "C1", order: 0, taskInstances: [], sections: [] },
    ]);
    (prisma.chapter.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "new-chapter",
      title: "C2",
      order: 1,
      sections: [],
      taskInstances: [],
    });

    const req = buildRequest({ sourceId: SOURCE_ID, mode: "apply" });
    const res = await POST(req as unknown as Parameters<typeof POST>[0], {
      params: Promise.resolve({ id: COURSE_ID }),
    });
    expect(res.status).toBe(200);
    expect(prisma.chapter.create).toHaveBeenCalledTimes(1);
    expect(prisma.chapter.delete).not.toHaveBeenCalled();
  });
});
