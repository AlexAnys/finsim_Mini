import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/guards", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/auth/course-access", () => ({
  assertCourseAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/storage.service", () => ({
  getStorage: () => ({
    save: vi.fn().mockResolvedValue({ filePath: "uploads/x.pdf" }),
  }),
  validateFile: vi.fn().mockReturnValue({ valid: true }),
}));

vi.mock("@/lib/services/course-knowledge-source.service", () => ({
  createAndProcessCourseKnowledgeSource: vi.fn().mockImplementation(async (input) => ({
    id: "src-1",
    ...input,
    asyncJob: { id: "job-1" },
  })),
}));

import { requireRole } from "@/lib/auth/guards";
import { createAndProcessCourseKnowledgeSource } from "@/lib/services/course-knowledge-source.service";
import { POST } from "@/app/api/lms/courses/[id]/outline-import/route";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mk(requireRole).mockResolvedValue({
    session: { user: { id: "teacher-1", role: "teacher" } },
    error: null,
  });
});

function makeRequest(formData: FormData) {
  return new Request("http://localhost/api/lms/courses/course-1/outline-import", {
    method: "POST",
    body: formData,
  }) as never;
}

describe("outline-import route — sourceType param", () => {
  it("defaults sourceType to 'syllabus' when not provided (back-compat)", async () => {
    const formData = new FormData();
    formData.append("file", new File(["abc"], "syllabus.pdf", { type: "application/pdf" }));

    const res = await POST(makeRequest(formData), {
      params: Promise.resolve({ id: "course-1" }),
    });
    expect(res.status).toBe(201);
    const callArg = mk(createAndProcessCourseKnowledgeSource).mock.calls[0][0];
    expect(callArg.sourceType).toBe("syllabus");
    expect(callArg.tags).toEqual(expect.arrayContaining(["课程大纲", "课程结构"]));
  });

  it("accepts sourceType='question_bank' and tags the source accordingly", async () => {
    const formData = new FormData();
    formData.append("file", new File(["abc"], "bank.docx", { type: "application/pdf" }));
    formData.append("sourceType", "question_bank");

    const res = await POST(makeRequest(formData), {
      params: Promise.resolve({ id: "course-1" }),
    });
    expect(res.status).toBe(201);
    const callArg = mk(createAndProcessCourseKnowledgeSource).mock.calls[0][0];
    expect(callArg.sourceType).toBe("question_bank");
    expect(callArg.tags).toEqual(expect.arrayContaining(["课程题库"]));
    expect(callArg.tags).not.toEqual(expect.arrayContaining(["课程大纲"]));
  });

  it("rejects unsupported sourceType values", async () => {
    const formData = new FormData();
    formData.append("file", new File(["abc"], "x.pdf", { type: "application/pdf" }));
    formData.append("sourceType", "random_type");

    const res = await POST(makeRequest(formData), {
      params: Promise.resolve({ id: "course-1" }),
    });
    expect(res.status).toBe(400);
    expect(createAndProcessCourseKnowledgeSource).not.toHaveBeenCalled();
  });

  it("validates missing file with question_bank-specific message", async () => {
    const formData = new FormData();
    formData.append("sourceType", "question_bank");

    const res = await POST(makeRequest(formData), {
      params: Promise.resolve({ id: "course-1" }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("题库");
  });
});
