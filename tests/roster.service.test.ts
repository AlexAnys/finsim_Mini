import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({ prisma: {
  $transaction: vi.fn(), $queryRaw: vi.fn(),
  class: { findUnique: vi.fn() }, course: { findMany: vi.fn() },
  user: { findMany: vi.fn(), updateMany: vi.fn() },
  studentGroup: { findFirst: vi.fn(), create: vi.fn() },
  studentGroupMember: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  submission: { count: vi.fn() }, quizAttempt: { count: vi.fn() },
  taskInstance: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
} }));
vi.mock("@/lib/auth/resource-access", () => ({ assertClassAccessForTeacher: vi.fn() }));

import { prisma } from "@/lib/db/prisma";
import { assertClassAccessForTeacher } from "@/lib/auth/resource-access";
import { manageClassRoster } from "@/lib/services/roster.service";
import { rosterSchema } from "@/lib/validators/roster.schema";

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const teacher = { id: "teacher", role: "teacher" };
const transfer = { mode: "transfer" as const, studentIds: ["s1", "s2"], targetClassId: "to", groupMode: "add" as const, preview: true };
const students = [{ id: "s1", name: "张三", classId: "from" }, { id: "s2", name: "李四", classId: "from" }];

beforeEach(() => {
  vi.resetAllMocks();
  mock(prisma.$transaction).mockImplementation((callback) => callback(prisma));
  mock(prisma.$queryRaw).mockResolvedValue([]);
  mock(prisma.class.findUnique).mockImplementation(({ where }) => ({ id: where.id, name: where.id === "from" ? "原班" : "目标班" }));
  mock(prisma.user.findMany).mockResolvedValue(students);
  mock(prisma.user.updateMany).mockResolvedValue({ count: 2 });
  mock(prisma.studentGroup.findFirst).mockResolvedValue(null);
  mock(prisma.studentGroupMember.findMany).mockResolvedValue([]);
  mock(prisma.studentGroupMember.deleteMany).mockResolvedValue({ count: 0 });
  mock(prisma.studentGroupMember.createMany).mockResolvedValue({ count: 2 });
  mock(prisma.submission.count).mockResolvedValue(3);
  mock(prisma.quizAttempt.count).mockResolvedValue(0);
  mock(prisma.taskInstance.findMany).mockResolvedValue([]);
  mock(prisma.course.findMany).mockResolvedValue([]);
});

describe("batch roster", () => {
  it("previews a single-class transfer without writing student or learning data", async () => {
    const result = await manageClassRoster("from", teacher, transfer);
    expect(result).toMatchObject({ preview: true, canApply: true, selectedCount: 2, changeCount: 2, impact: { preservedSubmissions: 3 } });
    expect(result.previewToken).toMatch(/^[a-f0-9]{64}$/);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(assertClassAccessForTeacher).toHaveBeenCalledWith("to", teacher, prisma);
  });

  it("transfers the entire selection atomically and removes all original-class memberships", async () => {
    const preview = await manageClassRoster("from", teacher, transfer);
    const result = await manageClassRoster("from", teacher, { ...transfer, preview: false, previewToken: preview.previewToken });
    expect(result.appliedCount).toBe(2);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s1", "s2"] }, classId: "from", role: "student" }, data: { classId: "to" } });
    expect(prisma.studentGroupMember.deleteMany).toHaveBeenCalledWith({ where: { studentId: { in: ["s1", "s2"] }, group: { classId: "from" } } });
  });

  it("rejects unauthorized access before returning roster information", async () => {
    mock(assertClassAccessForTeacher).mockRejectedValue(new Error("FORBIDDEN"));
    await expect(manageClassRoster("from", teacher, transfer)).rejects.toThrow("FORBIDDEN");
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("fails closed for a student outside both managed classes", async () => {
    mock(prisma.user.findMany).mockResolvedValue([students[0]]);
    await expect(manageClassRoster("from", teacher, transfer)).rejects.toThrow("ROSTER_STUDENT_MISMATCH");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("blocks active or finished-but-unsubmitted quizzes without a partial transfer", async () => {
    mock(prisma.quizAttempt.count).mockResolvedValue(1);
    const preview = await manageClassRoster("from", teacher, transfer);
    expect(preview.canApply).toBe(false);
    expect(preview.blockers[0]).toContain("测验");
    await expect(manageClassRoster("from", teacher, { ...transfer, preview: false, previewToken: preview.previewToken })).rejects.toThrow("ROSTER_BLOCKED");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("requires a new preview after enrollment changes", async () => {
    const preview = await manageClassRoster("from", teacher, transfer);
    mock(prisma.user.findMany).mockResolvedValue([students[0], { ...students[1], classId: "to" }]);
    await expect(manageClassRoster("from", teacher, { ...transfer, preview: false, previewToken: preview.previewToken })).rejects.toThrow("ROSTER_PREVIEW_STALE");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("retries safely when every student is already in the destination without changing their groups", async () => {
    mock(prisma.user.findMany).mockResolvedValue(students.map((s) => ({ ...s, classId: "to" })));
    const result = await manageClassRoster("from", teacher, { ...transfer, preview: false, previewToken: "old-confirmation" });
    expect(result).toMatchObject({ appliedCount: 0, skippedCount: 2 });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.studentGroupMember.createMany).not.toHaveBeenCalled();
  });
});

describe("groups and concurrency", () => {
  it("adds members to an existing group and skips duplicate memberships", async () => {
    mock(prisma.studentGroup.findFirst).mockResolvedValue({ id: "g1", name: "讨论组" });
    mock(prisma.studentGroupMember.findMany).mockResolvedValue([{ id: "m1", studentId: "s1", groupId: "g1" }]);
    const input = { ...transfer, mode: "group" as const, targetClassId: "from", targetGroupId: "g1" };
    const preview = await manageClassRoster("from", teacher, input);
    const result = await manageClassRoster("from", teacher, { ...input, preview: false, previewToken: preview.previewToken });
    expect(result).toMatchObject({ appliedCount: 1, skippedCount: 1 });
    expect(prisma.studentGroupMember.createMany).toHaveBeenCalledWith({ data: [{ studentId: "s2", groupId: "g1" }], skipDuplicates: true });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("replaces only groups managed by the acting teacher", async () => {
    mock(prisma.studentGroup.findFirst).mockResolvedValue({ id: "g1", name: "讨论组" });
    mock(prisma.studentGroupMember.findMany).mockResolvedValue([{ id: "m1", studentId: "s1", groupId: "g0" }]);
    const input = { ...transfer, mode: "group" as const, targetClassId: "from", targetGroupId: "g1", groupMode: "replace" as const };
    const preview = await manageClassRoster("from", teacher, input);
    await manageClassRoster("from", teacher, { ...input, preview: false, previewToken: preview.previewToken });
    expect(prisma.studentGroupMember.deleteMany).toHaveBeenCalledWith({ where: {
      studentId: { in: ["s1", "s2"] }, groupId: { not: "g1" }, group: { classId: "from", teacherId: "teacher" },
    } });
  });

  it("creates a group within the same transaction before continuing the transfer", async () => {
    mock(prisma.studentGroup.create).mockResolvedValue({ id: "new", name: "新组" });
    const input = { ...transfer, newGroupName: "新组" };
    const preview = await manageClassRoster("from", teacher, input);
    const result = await manageClassRoster("from", teacher, { ...input, preview: false, previewToken: preview.previewToken });
    expect(result).toMatchObject({ appliedCount: 2, targetGroup: { id: "new", name: "新组" } });
    expect(prisma.studentGroup.create).toHaveBeenCalledOnce();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "class.roster.transfer", actorId: "teacher" }) }));
  });

  it("reuses an existing same-name group without creating another account or group", async () => {
    mock(prisma.studentGroup.findFirst).mockResolvedValue({ id: "existing", name: "新组" });
    const input = { ...transfer, newGroupName: "新组" };
    const preview = await manageClassRoster("from", teacher, input);
    await manageClassRoster("from", teacher, { ...input, preview: false, previewToken: preview.previewToken });
    expect(prisma.studentGroup.create).not.toHaveBeenCalled();
    expect(prisma.studentGroupMember.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [
      { studentId: "s1", groupId: "existing" }, { studentId: "s2", groupId: "existing" },
    ] }));
  });

  it("counts only assigned students for group tasks and reports actual course access changes", async () => {
    mock(prisma.studentGroupMember.findMany).mockResolvedValue([{ id: "m1", studentId: "s1", groupId: "g0" }]);
    mock(prisma.taskInstance.findMany).mockResolvedValue([
      { id: "task-all", title: "全班任务", groupIds: [], submissions: [{ studentId: "s1" }] },
      { id: "task-group", title: "小组任务", groupIds: ["g0"], submissions: [] },
      { id: "task-other", title: "其他组任务", groupIds: ["other"], submissions: [] },
    ]);
    mock(prisma.course.findMany).mockResolvedValue([
      { id: "old", courseTitle: "原班课", classes: [{ classId: "from" }] },
      { id: "both", courseTitle: "共同课", classes: [{ classId: "from" }, { classId: "to" }] },
      { id: "new", courseTitle: "目标课", classes: [{ classId: "to" }] },
    ]);
    const preview = await manageClassRoster("from", teacher, transfer);
    expect(preview.impact).toMatchObject({ pendingAssignments: 2, removedMemberships: 1, preservedSubmissions: 3,
      lostCourses: [{ id: "old", name: "原班课" }], gainedCourses: [{ id: "new", name: "目标课" }],
      pendingTasks: [{ id: "task-all", name: "全班任务", studentCount: 1 }, { id: "task-group", name: "小组任务", studentCount: 1 }],
    });
  });

  it("rejects a target group not owned by this teacher or not in the target class", async () => {
    await expect(manageClassRoster("from", teacher, { ...transfer, targetGroupId: "foreign" })).rejects.toThrow("FORBIDDEN");
    expect(prisma.studentGroup.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign", classId: "to", teacherId: "teacher" } }));
  });

  it("retries serialization conflicts and fails safely when the conflicting write persists", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "test" });
    mock(prisma.$transaction).mockRejectedValueOnce(conflict).mockImplementation((callback) => callback(prisma));
    await expect(manageClassRoster("from", teacher, transfer)).resolves.toMatchObject({ changeCount: 2 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    mock(prisma.$transaction).mockRejectedValue(conflict);
    await expect(manageClassRoster("from", teacher, transfer)).rejects.toThrow("ROSTER_CONCURRENT_CHANGE");
  });

  it("does not continue after a partial row count, so the transaction can roll back", async () => {
    const preview = await manageClassRoster("from", teacher, transfer);
    mock(prisma.user.updateMany).mockResolvedValue({ count: 1 });
    await expect(manageClassRoster("from", teacher, { ...transfer, preview: false, previewToken: preview.previewToken })).rejects.toThrow("ROSTER_CONCURRENT_CHANGE");
    expect(prisma.studentGroupMember.deleteMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("roster input", () => {
  it("requires a confirmation token and limits a batch to 200", () => {
    expect(rosterSchema.safeParse({ ...transfer, preview: false }).success).toBe(false);
    expect(rosterSchema.safeParse({ ...transfer, studentIds: Array(201).fill("s1") }).success).toBe(false);
  });
  it("requires an unambiguous group selection", () => {
    expect(rosterSchema.safeParse({ ...transfer, mode: "group" }).success).toBe(false);
    expect(rosterSchema.safeParse({ ...transfer, targetGroupId: "g", newGroupName: "new" }).success).toBe(false);
  });
});
