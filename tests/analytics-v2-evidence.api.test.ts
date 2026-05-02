import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/resource-access", () => ({
  assertTaskInstanceReadableTeacherOnly: vi.fn(),
  assertTaskReadable: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    submission: { findUnique: vi.fn() },
  },
}));

import { requireRole } from "@/lib/auth/guards";
import {
  assertTaskInstanceReadableTeacherOnly,
  assertTaskReadable,
} from "@/lib/auth/resource-access";
import { prisma } from "@/lib/db/prisma";
import { GET } from "@/app/api/lms/analytics-v2/evidence/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function request(url: string) {
  return new Request(url, { headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/lms/analytics-v2/evidence", () => {
  it("requires a submission id before querying the database", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });

    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/evidence") as Parameters<typeof GET>[0],
    );

    expect(res.status).toBe(400);
    expect(prisma.submission.findUnique).not.toHaveBeenCalled();
  });

  it("returns drawer evidence and strips private attachment paths", async () => {
    mk(requireRole).mockResolvedValue({
      session: { user: { id: "teacher-1", role: "teacher", classId: null } },
      error: null,
    });
    mk(assertTaskInstanceReadableTeacherOnly).mockResolvedValue(undefined);
    mk(prisma.submission.findUnique).mockResolvedValue({
      id: "sub-1",
      taskId: "task-1",
      taskInstanceId: "inst-1",
      taskType: "subjective",
      status: "graded",
      score: 8,
      maxScore: 10,
      submittedAt: new Date("2026-01-02T00:00:00Z"),
      gradedAt: new Date("2026-01-03T00:00:00Z"),
      releasedAt: null,
      student: { id: "s1", name: "S1", email: "s1@example.com" },
      task: {
        id: "task-1",
        taskName: "主观题",
        taskType: "subjective",
        scoringCriteria: [],
        quizQuestions: [],
      },
      taskInstance: {
        id: "inst-1",
        title: "主观题实例",
        taskType: "subjective",
        class: { id: "class-A", name: "A 班" },
        course: { id: "course-1", courseTitle: "金融模拟" },
        chapter: { id: "chapter-1", title: "资产配置" },
        section: { id: "section-1", title: "风险预算" },
      },
      simulationSubmission: null,
      quizSubmission: null,
      subjectiveSubmission: {
        textAnswer: "学生原始回答",
        extractedText: "提取文本",
        evaluation: { feedback: "推理完整" },
        conceptTags: ["风险预算"],
        attachments: [
          {
            id: "att-1",
            fileName: "answer.pdf",
            fileSize: 1234,
            contentType: "application/pdf",
            filePath: "/private/path/answer.pdf",
          },
        ],
      },
    });

    const res = await GET(
      request("http://localhost/api/lms/analytics-v2/evidence?submissionId=sub-1") as Parameters<typeof GET>[0],
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(assertTaskInstanceReadableTeacherOnly).toHaveBeenCalledWith("inst-1", {
      id: "teacher-1",
      role: "teacher",
      classId: null,
    });
    expect(assertTaskReadable).not.toHaveBeenCalled();
    expect(body.data.subjective.attachments).toEqual([
      {
        id: "att-1",
        fileName: "answer.pdf",
        fileSize: 1234,
        contentType: "application/pdf",
      },
    ]);
    expect(JSON.stringify(body.data)).not.toContain("/private/path/answer.pdf");
  });
});
