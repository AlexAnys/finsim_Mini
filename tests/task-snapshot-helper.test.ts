import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveTaskForRunner } from "@/lib/utils/task-snapshot";

const liveTask = {
  id: "live-id",
  taskName: "Live Task",
  taskType: "quiz",
  custom: "live",
};

const snapshotTask = {
  id: "snapshot-id",
  taskName: "Snapshot Task",
  taskType: "quiz",
  custom: "snapshot",
};

describe("resolveTaskForRunner", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns snapshot when valid (object + taskName)", () => {
    const result = resolveTaskForRunner({
      taskSnapshot: snapshotTask,
      task: liveTask,
    });
    expect(result.task.id).toBe("snapshot-id");
    expect(result.task.custom).toBe("snapshot");
    expect(result.fromSnapshot).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to live task when snapshot is null", () => {
    const result = resolveTaskForRunner({
      taskSnapshot: null,
      task: liveTask,
    });
    expect(result.task.id).toBe("live-id");
    expect(result.fromSnapshot).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to live when snapshot is undefined", () => {
    const result = resolveTaskForRunner({
      taskSnapshot: undefined,
      task: liveTask,
    });
    expect(result.task.id).toBe("live-id");
    expect(result.fromSnapshot).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to live when snapshot is not an object (string/number/boolean)", () => {
    for (const bad of ["str", 42, true]) {
      const result = resolveTaskForRunner({
        taskSnapshot: bad,
        task: liveTask,
      });
      expect(result.task.id).toBe("live-id");
      expect(result.fromSnapshot).toBe(false);
    }
    expect(warnSpy).toHaveBeenCalled();
  });

  it("falls back to live when snapshot is an object but missing taskName", () => {
    const result = resolveTaskForRunner({
      taskSnapshot: { id: "x", taskType: "quiz" },
      task: liveTask,
    });
    expect(result.task.id).toBe("live-id");
    expect(result.fromSnapshot).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("falls back to live when taskName is empty string", () => {
    const result = resolveTaskForRunner({
      taskSnapshot: { taskName: "", taskType: "quiz" },
      task: liveTask,
    });
    expect(result.task.id).toBe("live-id");
    expect(result.fromSnapshot).toBe(false);
  });

  it("preserves nested config fields from snapshot", () => {
    const result = resolveTaskForRunner({
      taskSnapshot: {
        ...snapshotTask,
        quizQuestions: [{ id: "q1", prompt: "P1" }],
        scoringCriteria: [{ id: "c1", maxPoints: 10 }],
      },
      task: liveTask,
    });
    expect(result.fromSnapshot).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = result.task as any;
    expect(t.quizQuestions).toHaveLength(1);
    expect(t.scoringCriteria[0].maxPoints).toBe(10);
  });
});
