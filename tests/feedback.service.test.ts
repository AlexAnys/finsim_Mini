import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    feedback: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createFeedback,
  listFeedback,
  updateFeedbackStatus,
  FEEDBACK_RATE_WINDOW_MS,
} from "@/lib/services/feedback.service";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

const baseInput = {
  type: "issue" as const,
  content: "登录后仪表盘加载很慢",
  pageUrl: "https://app.example.com/dashboard",
};
const author = { id: "user-1", role: "student" };

describe("createFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.feedback.count).mockResolvedValue(0);
    asMock(prisma.feedback.create).mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "fb-1", status: "new", createdAt: new Date(), ...data }),
    );
  });

  it("happy path: persists feedback with author id + role and returns it", async () => {
    const result = await createFeedback(baseInput, author);
    expect(result.id).toBe("fb-1");
    const createArg = asMock(prisma.feedback.create).mock.calls[0][0];
    expect(createArg.data.userId).toBe("user-1");
    expect(createArg.data.userRole).toBe("student");
    expect(createArg.data.type).toBe("issue");
    expect(createArg.data.content).toBe("登录后仪表盘加载很慢");
  });

  it("rate limit: throws FEEDBACK_RATE_LIMITED when recent count >= limit", async () => {
    asMock(prisma.feedback.count).mockResolvedValue(5);
    await expect(createFeedback(baseInput, author)).rejects.toThrow("FEEDBACK_RATE_LIMITED");
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it("rate limit: counts only the author's own feedback within the window", async () => {
    await createFeedback(baseInput, author);
    const countArg = asMock(prisma.feedback.count).mock.calls[0][0];
    expect(countArg.where.userId).toBe("user-1");
    expect(countArg.where.createdAt.gte).toBeInstanceOf(Date);
    // window 起点应在 now 之前 FEEDBACK_RATE_WINDOW_MS 内
    const gte = countArg.where.createdAt.gte as Date;
    const delta = Date.now() - gte.getTime();
    expect(delta).toBeGreaterThanOrEqual(FEEDBACK_RATE_WINDOW_MS - 2000);
    expect(delta).toBeLessThanOrEqual(FEEDBACK_RATE_WINDOW_MS + 2000);
  });

  it("trims content and rejects empty/whitespace-only content", async () => {
    await expect(
      createFeedback({ ...baseInput, content: "   " }, author),
    ).rejects.toThrow("FEEDBACK_CONTENT_EMPTY");
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it("drops oversized screenshot gracefully instead of throwing (graceful degrade)", async () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(2_000_000);
    const result = await createFeedback({ ...baseInput, screenshot: huge }, author);
    expect(result.id).toBe("fb-1");
    const createArg = asMock(prisma.feedback.create).mock.calls[0][0];
    expect(createArg.data.screenshot).toBeNull();
  });

  it("keeps a reasonably sized screenshot", async () => {
    const ok = "data:image/jpeg;base64," + "A".repeat(1000);
    await createFeedback({ ...baseInput, screenshot: ok }, author);
    const createArg = asMock(prisma.feedback.create).mock.calls[0][0];
    expect(createArg.data.screenshot).toBe(ok);
  });
});

describe("updateFeedbackStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws FEEDBACK_NOT_FOUND when feedback does not exist", async () => {
    asMock(prisma.feedback.findUnique).mockResolvedValue(null);
    await expect(updateFeedbackStatus("missing", "handled")).rejects.toThrow(
      "FEEDBACK_NOT_FOUND",
    );
    expect(prisma.feedback.update).not.toHaveBeenCalled();
  });

  it("updates status to handled when feedback exists", async () => {
    asMock(prisma.feedback.findUnique).mockResolvedValue({ id: "fb-1" });
    asMock(prisma.feedback.update).mockResolvedValue({ id: "fb-1", status: "handled" });
    const result = await updateFeedbackStatus("fb-1", "handled");
    expect(result.status).toBe("handled");
    const updateArg = asMock(prisma.feedback.update).mock.calls[0][0];
    expect(updateArg.where.id).toBe("fb-1");
    expect(updateArg.data.status).toBe("handled");
  });
});

describe("listFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.feedback.findMany).mockResolvedValue([]);
    asMock(prisma.feedback.count).mockResolvedValue(0);
  });

  it("returns items + total, newest first, with author select", async () => {
    asMock(prisma.feedback.findMany).mockResolvedValue([
      {
        id: "fb-1",
        userId: "u1",
        userRole: "student",
        type: "issue",
        content: "x",
        pageUrl: "/p",
        screenshot: null,
        recentErrors: null,
        viewport: "1440x900",
        userAgent: "UA",
        status: "new",
        createdAt: new Date("2026-05-25T00:00:00Z"),
        user: { id: "u1", name: "张三", email: "z@x.cn" },
      },
    ]);
    asMock(prisma.feedback.count).mockResolvedValue(1);

    const { items, total } = await listFeedback({});
    expect(total).toBe(1);
    expect(items[0].userName).toBe("张三");
    expect(items[0].userEmail).toBe("z@x.cn");

    const findArg = asMock(prisma.feedback.findMany).mock.calls[0][0];
    expect(findArg.orderBy.createdAt).toBe("desc");
    expect(findArg.include.user.select.name).toBe(true);
  });

  it("applies status + type filters when provided", async () => {
    await listFeedback({ status: "new", type: "feature" });
    const findArg = asMock(prisma.feedback.findMany).mock.calls[0][0];
    expect(findArg.where.status).toBe("new");
    expect(findArg.where.type).toBe("feature");
  });
});
