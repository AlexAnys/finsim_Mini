import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => {
  const feedback = {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const prisma = {
    feedback,
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    // AC13：$transaction(cb) 用 tx 跑 cb；tx 复用同一组 feedback mock + $executeRaw(advisory lock no-op)
    $transaction: vi.fn((cb: (tx: unknown) => unknown) =>
      cb({ feedback, $queryRaw: prisma.$queryRaw, $executeRaw: prisma.$executeRaw }),
    ),
  };
  return { prisma };
});

import { prisma } from "@/lib/db/prisma";
import {
  createFeedback,
  listFeedback,
  updateFeedbackStatus,
  FEEDBACK_RATE_WINDOW_MS,
  FEEDBACK_RATE_LIMIT,
  FEEDBACK_SCREENSHOT_MAX_CHARS as SERVICE_SHOT_MAX,
} from "@/lib/services/feedback.service";
import { FEEDBACK_SCREENSHOT_MAX_CHARS as SHARED_SHOT_MAX, FEEDBACK_SCREENSHOT_DOS_LIMIT } from "@/lib/feedback/constants";

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

describe("AC5 截图大小契约（单一真源 + 服务端防御不抛错）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.feedback.count).mockResolvedValue(0);
    asMock(prisma.feedback.create).mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "fb-1", status: "new", createdAt: new Date(), ...data }),
    );
  });

  it("截图上限单一真源：service re-export === 共享 constants", () => {
    expect(SERVICE_SHOT_MAX).toBe(SHARED_SHOT_MAX);
  });

  it("绕过 Zod 直调 service 传超大截图：丢图传 null 而非抛错（防御线，其余照常落库）", async () => {
    const oversize = "data:image/jpeg;base64," + "A".repeat(SHARED_SHOT_MAX + 1000);
    const result = await createFeedback({ ...baseInput, screenshot: oversize }, author);
    // 不抛错，提交成功
    expect(result.id).toBe("fb-1");
    const createArg = asMock(prisma.feedback.create).mock.calls[0][0];
    // 超大截图被丢成 null，但其余字段照常落库
    expect(createArg.data.screenshot).toBeNull();
    expect(createArg.data.content).toBe(baseInput.content);
    expect(createArg.data.pageUrl).toBe(baseInput.pageUrl);
  });

  it("恰好等于上限的截图保留（边界）", async () => {
    const atLimit = "x".repeat(SHARED_SHOT_MAX);
    await createFeedback({ ...baseInput, screenshot: atLimit }, author);
    const createArg = asMock(prisma.feedback.create).mock.calls[0][0];
    expect(createArg.data.screenshot).toBe(atLimit);
  });
});

describe("AC12 截图永不丢反馈（store-limit 与 DoS-limit 分离）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.feedback.count).mockResolvedValue(0);
    asMock(prisma.feedback.create).mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "fb-1", status: "new", createdAt: new Date(), ...data }),
    );
  });

  it("DoS-limit 远大于 store-limit（分离）", () => {
    expect(FEEDBACK_SCREENSHOT_DOS_LIMIT).toBeGreaterThan(SHARED_SHOT_MAX);
  });

  it("介于 store-limit 与 DoS-limit 之间的截图：丢图 null 但反馈照常落库（service LIVE 兜底）", async () => {
    const mid = "x".repeat(SHARED_SHOT_MAX + 500_000); // > store-limit, < DoS-limit
    expect(mid.length).toBeLessThan(FEEDBACK_SCREENSHOT_DOS_LIMIT);
    const result = await createFeedback({ ...baseInput, screenshot: mid }, author);
    expect(result.id).toBe("fb-1"); // 反馈落库（非抛错/拒绝）
    const createArg = asMock(prisma.feedback.create).mock.calls[0][0];
    expect(createArg.data.screenshot).toBeNull(); // 截图被丢
    expect(createArg.data.content).toBe(baseInput.content); // 其余字段在
  });
});

describe("AC13 限频原子化（事务 + per-user advisory 锁）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asMock(prisma.feedback.create).mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "fb-1", status: "new", createdAt: new Date(), ...data }),
    );
  });

  it("count + create 跑在 $transaction 内 + 先取 advisory 事务锁", async () => {
    asMock(prisma.feedback.count).mockResolvedValue(0);
    await createFeedback(baseInput, author);
    // 用了事务
    expect(asMock(prisma.$transaction)).toHaveBeenCalledTimes(1);
    // 取了 advisory 锁（pg_advisory_xact_lock，用 $executeRaw 因其返回 void）
    const lockCall = asMock(prisma.$executeRaw).mock.calls[0];
    expect(lockCall).toBeTruthy();
    const sqlParts = lockCall[0]; // tagged template strings array
    expect(Array.isArray(sqlParts) ? sqlParts.join("?") : String(sqlParts)).toContain("pg_advisory_xact_lock");
    // 锁的入参是 author.id（advisory key 按 user 隔离）
    expect(lockCall.slice(1)).toContain(author.id);
  });

  it("达到上限：在事务内拒绝且不 create", async () => {
    asMock(prisma.feedback.count).mockResolvedValue(FEEDBACK_RATE_LIMIT);
    await expect(createFeedback(baseInput, author)).rejects.toThrow("FEEDBACK_RATE_LIMITED");
    expect(prisma.feedback.create).not.toHaveBeenCalled();
    // 仍进了事务（锁 + count 在 tx 内）才拒
    expect(asMock(prisma.$transaction)).toHaveBeenCalledTimes(1);
  });
});
