import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Fix 10 · async-job cron sweeper
 *
 * 覆盖：
 * 1) 扫到 queued > 60s → 触发 runAsyncJob 原子认领
 * 2) 扫到 running > 10min + attempts<max → 原子重置回 queued + 重跑
 * 3) 扫到 running > 10min + 达 maxAttempts → 标 failed
 * 4) 原子 updateMany 返回 count=0（race）时不重复执行
 * 5) 单 job 抛错不阻塞其它 job（Promise.allSettled）
 */

vi.mock("@/lib/db/prisma", () => {
  const updateMany = vi.fn();
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  return {
    prisma: {
      asyncJob: { findMany, findUnique, update, updateMany },
    },
  };
});

import { prisma } from "@/lib/db/prisma";
import { sweepStuckJobs } from "@/lib/services/async-job.service";

type AsyncJobFindMany = ReturnType<typeof vi.fn>;
type AsyncJobUpdateMany = ReturnType<typeof vi.fn>;
type AsyncJobFindUnique = ReturnType<typeof vi.fn>;
type AsyncJobUpdate = ReturnType<typeof vi.fn>;

const findMany = prisma.asyncJob.findMany as unknown as AsyncJobFindMany;
const updateMany = prisma.asyncJob.updateMany as unknown as AsyncJobUpdateMany;
const findUnique = prisma.asyncJob.findUnique as unknown as AsyncJobFindUnique;
const update = prisma.asyncJob.update as unknown as AsyncJobUpdate;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Fix 10 · sweepStuckJobs", () => {
  it("queued > 60s: 调 runAsyncJob 触发（原子认领 count=1 走完整路径）", async () => {
    const now = new Date("2026-05-13T12:00:00Z");
    // 1st findMany: queued stuck
    // 2nd findMany: running stuck (empty)
    findMany
      .mockResolvedValueOnce([{ id: "job-q-1" }])
      .mockResolvedValueOnce([]);

    // runAsyncJob 内部：updateMany claim count=1 → findUnique → 假装 type 不支持，performAsyncJob 抛错
    // 模拟 claim 成功
    updateMany.mockResolvedValueOnce({ count: 1 });
    findUnique.mockResolvedValueOnce({
      id: "job-q-1",
      type: "task_draft_generate", // 这种 type performAsyncJob 会 throw "ASYNC_JOB_HANDLER_NOT_IMPLEMENTED"
      input: null,
      entityType: null,
      entityId: null,
      createdBy: "user-1",
    });
    // runAsyncJob catch 块的 update → 写 failed
    update.mockResolvedValueOnce({ id: "job-q-1", status: "failed" });

    const result = await sweepStuckJobs({ now });

    // 第一次 findMany: queued
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "queued",
          createdAt: { lt: new Date(now.getTime() - 60_000) },
        }),
      }),
    );
    // 第二次 findMany: running
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "running",
          startedAt: { lt: new Date(now.getTime() - 10 * 60_000) },
        }),
      }),
    );

    expect(result.queuedStuck).toBe(1);
    expect(result.runningStuck).toBe(0);
    expect(result.triggered).toBe(1);
    // runAsyncJob 内部抛 ASYNC_JOB_HANDLER_NOT_IMPLEMENTED 但被 catch 处理 → fulfilled
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("running > 10min + attempts<max: 原子重置回 queued + 触发重跑", async () => {
    const now = new Date("2026-05-13T12:00:00Z");
    findMany
      .mockResolvedValueOnce([]) // queued empty
      .mockResolvedValueOnce([
        { id: "job-r-1", attempts: 1, maxAttempts: 3 },
      ]);

    // 原子重置 count=1
    updateMany.mockResolvedValueOnce({ count: 1 });
    // runAsyncJob 内部：claim count=1 → findUnique
    updateMany.mockResolvedValueOnce({ count: 1 });
    findUnique.mockResolvedValueOnce({
      id: "job-r-1",
      type: "task_draft_generate",
      input: null,
      entityType: null,
      entityId: null,
      createdBy: "user-1",
    });
    update.mockResolvedValueOnce({ id: "job-r-1", status: "failed" });

    const result = await sweepStuckJobs({ now });

    // 第一次 updateMany: 重置 running → queued
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "job-r-1", status: "running" },
      data: expect.objectContaining({
        status: "queued",
        startedAt: null,
        progress: 0,
        error: "STUCK_TIMEOUT_RESET",
      }),
    });
    expect(result.runningStuck).toBe(1);
    expect(result.requeuedRunning).toBe(1);
    expect(result.markedFailed).toBe(0);
    expect(result.triggered).toBe(1);
  });

  it("running > 10min + 达 maxAttempts: 标 failed（不重跑）", async () => {
    const now = new Date("2026-05-13T12:00:00Z");
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "job-r-max", attempts: 3, maxAttempts: 3 },
      ]);

    updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await sweepStuckJobs({ now });

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "job-r-max", status: "running" },
      data: expect.objectContaining({
        status: "failed",
        error: "STUCK_TIMEOUT_GAVE_UP",
        completedAt: now,
      }),
    });
    expect(result.runningStuck).toBe(1);
    expect(result.markedFailed).toBe(1);
    expect(result.requeuedRunning).toBe(0);
    expect(result.triggered).toBe(0);
  });

  it("原子重置 count=0（race: worker 正好完成）→ 不计入 requeued，不触发", async () => {
    const now = new Date("2026-05-13T12:00:00Z");
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "job-r-race", attempts: 0, maxAttempts: 3 }]);

    updateMany.mockResolvedValueOnce({ count: 0 }); // race lost

    const result = await sweepStuckJobs({ now });
    expect(result.requeuedRunning).toBe(0);
    expect(result.triggered).toBe(0);
  });

  it("批量混合：1 queued + 1 running-reset + 1 running-max", async () => {
    const now = new Date("2026-05-13T12:00:00Z");
    findMany
      .mockResolvedValueOnce([{ id: "qA" }])
      .mockResolvedValueOnce([
        { id: "rB", attempts: 0, maxAttempts: 3 },
        { id: "rC", attempts: 3, maxAttempts: 3 },
      ]);

    // For rB: reset to queued
    updateMany.mockResolvedValueOnce({ count: 1 });
    // For rC: mark failed
    updateMany.mockResolvedValueOnce({ count: 1 });
    // For qA: runAsyncJob claim
    updateMany.mockResolvedValueOnce({ count: 1 });
    findUnique.mockResolvedValueOnce({
      id: "qA",
      type: "task_draft_generate",
      input: null,
      entityType: null,
      entityId: null,
      createdBy: "u",
    });
    update.mockResolvedValueOnce({ id: "qA", status: "failed" });
    // For rB: runAsyncJob claim
    updateMany.mockResolvedValueOnce({ count: 1 });
    findUnique.mockResolvedValueOnce({
      id: "rB",
      type: "task_draft_generate",
      input: null,
      entityType: null,
      entityId: null,
      createdBy: "u",
    });
    update.mockResolvedValueOnce({ id: "rB", status: "failed" });

    const result = await sweepStuckJobs({ now });
    expect(result.queuedStuck).toBe(1);
    expect(result.runningStuck).toBe(2);
    expect(result.requeuedRunning).toBe(1);
    expect(result.markedFailed).toBe(1);
    expect(result.triggered).toBe(2);
  });

  it("空扫描：无 stuck job → 结果全 0，不调 updateMany", async () => {
    const now = new Date("2026-05-13T12:00:00Z");
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await sweepStuckJobs({ now });
    expect(result.queuedStuck).toBe(0);
    expect(result.runningStuck).toBe(0);
    expect(result.triggered).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("runAsyncJob claim count=0（race: 已被另一个 cron 实例认领）→ failed 不重复执行", async () => {
    const now = new Date("2026-05-13T12:00:00Z");
    findMany.mockResolvedValueOnce([{ id: "race-job" }]).mockResolvedValueOnce([]);
    // claim count=0 → runAsyncJob 直接 return findUnique 结果
    updateMany.mockResolvedValueOnce({ count: 0 });
    findUnique.mockResolvedValueOnce({ id: "race-job", status: "running" });

    const result = await sweepStuckJobs({ now });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled(); // 没进 try 块，不写 succeeded/failed
    expect(result.triggered).toBe(1);
    expect(result.succeeded).toBe(1); // Promise fulfilled (return existing job)
  });
});
