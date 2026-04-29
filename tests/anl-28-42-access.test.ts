import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/resource-access", () => ({
  assertTaskInstanceReadable: vi.fn(),
  assertTaskReadable: vi.fn(),
  assertClassAccessForTeacher: vi.fn(),
  assertSubmissionReadable: vi.fn(),
  assertFileReadable: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn(),
}));

vi.mock("@/lib/services/ai.service", () => ({
  aiGenerateText: vi.fn(),
  aiGenerateJSON: vi.fn(),
}));

vi.mock("@/lib/services/task-instance.service", () => ({
  createTaskInstance: vi.fn(),
  getTaskInstances: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => {
  const tx = {
    user: { findMany: vi.fn() },
    studentGroup: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    studentGroupMember: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    prisma: {
      __tx: tx,
      $transaction: vi.fn(async (cb: (arg: typeof tx) => unknown) => cb(tx)),
      taskInstance: { findUnique: vi.fn() },
      taskPost: { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn() },
      studyBuddyPost: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      task: { findUnique: vi.fn() },
      class: { findMany: vi.fn() },
      studentGroup: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
      submission: { findMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
      scheduleSlot: { findUnique: vi.fn(), delete: vi.fn() },
    },
  };
});

import { requireAuth, requireRole } from "@/lib/auth/guards";
import {
  assertTaskInstanceReadable,
  assertClassAccessForTeacher,
  assertSubmissionReadable,
} from "@/lib/auth/resource-access";
import { assertCourseAccess } from "@/lib/auth/course-access";
import { prisma } from "@/lib/db/prisma";
import { getTaskInstances } from "@/lib/services/task-instance.service";
import { GET as taskInstancesGET } from "@/app/api/lms/task-instances/route";
import { GET as studyBuddyGET } from "@/app/api/study-buddy/posts/route";
import { DELETE as scheduleSlotDELETE } from "@/app/api/lms/schedule-slots/[id]/route";
import { GET as publicClassesGET } from "@/app/api/classes/route";
import { createTaskPost, listTaskPosts } from "@/lib/services/task-post.service";
import { createGroup } from "@/lib/services/group.service";
import { batchDeleteSubmissions } from "@/lib/services/submission.service";
import { createSubmissionSchema } from "@/lib/validators/submission.schema";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const prismaWithTx = prisma as typeof prisma & {
  __tx: {
    user: { findMany: ReturnType<typeof vi.fn> };
    studentGroup: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    studentGroupMember: {
      createMany: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };
};

function jsonRequest(url: string, init: RequestInit = {}) {
  return new Request(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mk(prisma.$transaction).mockImplementation(
    async (cb: (arg: typeof prismaWithTx.__tx) => unknown) => cb(prismaWithTx.__tx),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ANL-29 task instance list access", () => {
  it("forces student list scope to own class and published status", async () => {
    mk(requireAuth).mockResolvedValue({
      session: { user: { id: "student-1", role: "student", classId: "class-A" } },
      error: null,
    });
    mk(getTaskInstances).mockResolvedValue([]);

    const res = await taskInstancesGET(
      jsonRequest("http://localhost/api/lms/task-instances?classId=class-B&status=draft&courseId=course-1") as Parameters<typeof taskInstancesGET>[0],
    );

    expect(res.status).toBe(200);
    expect(getTaskInstances).toHaveBeenCalledWith({
      courseId: "course-1",
      classId: "class-A",
      status: "published",
      take: 100,
    });
  });

  it("keeps teacher list scoped to created/collaborating courses", async () => {
    mk(requireAuth).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });
    mk(getTaskInstances).mockResolvedValue([]);

    await taskInstancesGET(
      jsonRequest("http://localhost/api/lms/task-instances?status=published") as Parameters<typeof taskInstancesGET>[0],
    );

    expect(getTaskInstances).toHaveBeenCalledWith({
      courseId: undefined,
      classId: undefined,
      status: "published",
      take: 100,
      createdBy: "teacher-1",
    });
  });
});

describe("ANL-30 task discussion access", () => {
  it("rejects replies to posts from another task instance", async () => {
    mk(assertTaskInstanceReadable).mockResolvedValue(undefined);
    mk(prisma.taskInstance.findUnique).mockResolvedValue({ status: "published" });
    mk(prisma.taskPost.findUnique).mockResolvedValue({ taskInstanceId: "other-instance" });

    await expect(
      createTaskPost(
        {
          taskInstanceId: "instance-1",
          content: "同学们怎么看？",
          replyToPostId: "post-1",
        },
        { id: "student-1", role: "student", classId: "class-A" },
      ),
    ).rejects.toThrow("FORBIDDEN");
    expect(prisma.taskPost.create).not.toHaveBeenCalled();
  });

  it("lists only after readable guard and clamps page size", async () => {
    mk(assertTaskInstanceReadable).mockResolvedValue(undefined);
    mk(prisma.taskPost.findMany).mockResolvedValue([]);

    await listTaskPosts(
      "instance-1",
      { id: "teacher-1", role: "teacher", classId: null },
      { take: 500 },
    );

    expect(assertTaskInstanceReadable).toHaveBeenCalledWith("instance-1", {
      id: "teacher-1",
      role: "teacher",
      classId: null,
    });
    expect(prisma.taskPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});

describe("ANL-31 Study Buddy access", () => {
  it("rejects teacher broad reads without task scope", async () => {
    mk(requireAuth).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });

    const res = await studyBuddyGET(
      jsonRequest("http://localhost/api/study-buddy/posts") as Parameters<typeof studyBuddyGET>[0],
    );

    expect(res.status).toBe(403);
    expect(prisma.studyBuddyPost.findMany).not.toHaveBeenCalled();
  });

  it("scopes student reads to own posts and validates task instance access", async () => {
    mk(requireAuth).mockResolvedValue({
      session: { user: { id: "student-1", role: "student", classId: "class-A" } },
      error: null,
    });
    mk(assertTaskInstanceReadable).mockResolvedValue(undefined);
    mk(prisma.studyBuddyPost.findMany).mockResolvedValue([]);

    await studyBuddyGET(
      jsonRequest("http://localhost/api/study-buddy/posts?taskInstanceId=00000000-0000-0000-0000-000000000001") as Parameters<typeof studyBuddyGET>[0],
    );

    expect(assertTaskInstanceReadable).toHaveBeenCalled();
    expect(prisma.studyBuddyPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "student-1",
          taskInstanceId: "00000000-0000-0000-0000-000000000001",
        }),
      }),
    );
  });
});

describe("ANL-32 group membership access", () => {
  it("rejects cross-class or non-student members on group creation", async () => {
    mk(assertClassAccessForTeacher).mockResolvedValue(undefined);
    mk(prismaWithTx.__tx.user.findMany).mockResolvedValue([{ id: "student-1" }]);

    await expect(
      createGroup({
        user: { id: "teacher-1", role: "teacher", classId: null },
        classId: "class-A",
        name: "第一组",
        type: "manual",
        studentIds: ["student-1", "student-from-B"],
      }),
    ).rejects.toThrow("GROUP_MEMBER_CLASS_MISMATCH");
    expect(prismaWithTx.__tx.studentGroup.create).not.toHaveBeenCalled();
  });
});

describe("ANL-36 batch submission delete", () => {
  it("authorizes every requested submission and returns actual deleted count", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([{ id: "sub-1" }, { id: "sub-2" }]);
    mk(assertSubmissionReadable).mockResolvedValue(undefined);
    mk(prisma.submission.deleteMany).mockResolvedValue({ count: 2 });

    const result = await batchDeleteSubmissions(["sub-1", "sub-2", "sub-2"], {
      id: "admin-1",
      role: "admin",
      classId: null,
    });

    expect(assertSubmissionReadable).toHaveBeenCalledTimes(2);
    expect(prisma.submission.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sub-1", "sub-2"] } },
    });
    expect(result.count).toBe(2);
  });

  it("rejects missing submission IDs before deleting", async () => {
    mk(prisma.submission.findMany).mockResolvedValue([{ id: "sub-1" }]);

    await expect(
      batchDeleteSubmissions(["sub-1", "missing"], {
        id: "teacher-1",
        role: "teacher",
        classId: null,
      }),
    ).rejects.toThrow("SUBMISSION_NOT_FOUND");
    expect(prisma.submission.deleteMany).not.toHaveBeenCalled();
  });
});

describe("ANL-37 schedule slot delete", () => {
  it("uses course access instead of createdBy-only ownership", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-collab", role: "teacher", classId: null } },
      error: null,
    });
    mk(prisma.scheduleSlot.findUnique).mockResolvedValue({
      id: "slot-1",
      courseId: "course-1",
      createdBy: "teacher-owner",
    });
    mk(assertCourseAccess).mockResolvedValue(undefined);
    mk(prisma.scheduleSlot.delete).mockResolvedValue({ id: "slot-1" });

    const res = await scheduleSlotDELETE(
      jsonRequest("http://localhost/api/lms/schedule-slots/slot-1", { method: "DELETE" }) as Parameters<typeof scheduleSlotDELETE>[0],
      { params: Promise.resolve({ id: "slot-1" }) },
    );

    expect(res.status).toBe(200);
    expect(assertCourseAccess).toHaveBeenCalledWith(
      "course-1",
      "teacher-collab",
      "teacher",
    );
    expect(prisma.scheduleSlot.delete).toHaveBeenCalledWith({ where: { id: "slot-1" } });
  });
});

describe("ANL-33 submission trust boundary", () => {
  const taskId = "11111111-1111-4111-8111-111111111111";
  const taskInstanceId = "22222222-2222-4222-8222-222222222222";

  it("strips client-supplied simulation evaluation", () => {
    const parsed = createSubmissionSchema.safeParse({
      taskType: "simulation",
      taskId,
      taskInstanceId,
      transcript: [
        {
          id: "m1",
          role: "student",
          text: "hello",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
      evaluation: {
        totalScore: 100,
        maxScore: 100,
        feedback: "client forged",
        rubricBreakdown: [],
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("evaluation" in parsed.data).toBe(false);
    }
  });

  it("rejects over-limit transcripts and unsafe attachment paths", () => {
    const tooManyMessages = createSubmissionSchema.safeParse({
      taskType: "simulation",
      taskId,
      taskInstanceId,
      transcript: Array.from({ length: 121 }, (_, index) => ({
        id: `m-${index}`,
        role: "student",
        text: "x",
        timestamp: "2026-01-01T00:00:00.000Z",
      })),
    });
    expect(tooManyMessages.success).toBe(false);

    const badAttachment = createSubmissionSchema.safeParse({
      taskType: "subjective",
      taskId,
      taskInstanceId,
      textAnswer: "answer",
      attachments: [
        {
          fileName: "a.pdf",
          filePath: "../private/a.pdf",
          fileSize: 100,
          contentType: "application/pdf",
        },
      ],
    });
    expect(badAttachment.success).toBe(false);
  });
});

describe("ANL-40 public class enumeration", () => {
  it("blocks the public class list when production self-registration is not enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_STUDENT_SELF_REGISTRATION", "false");

    const res = await publicClassesGET(
      jsonRequest("http://localhost/api/classes") as Parameters<typeof publicClassesGET>[0],
    );

    expect(res.status).toBe(403);
    expect(prisma.class.findMany).not.toHaveBeenCalled();
  });
});
