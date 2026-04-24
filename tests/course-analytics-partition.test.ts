import { describe, it, expect } from "vitest";
import { partitionSettledSubs } from "@/components/course/course-analytics-tab";

describe("partitionSettledSubs", () => {
  it("separates fulfilled and rejected by index, preserving instance IDs", () => {
    const instances = [{ id: "i-a" }, { id: "i-b" }, { id: "i-c" }];
    const settled: Array<PromiseSettledResult<string>> = [
      { status: "fulfilled", value: "data-a" },
      { status: "rejected", reason: new Error("boom") },
      { status: "fulfilled", value: "data-c" },
    ];

    const { fulfilled, failedIds } = partitionSettledSubs(instances, settled);

    expect(fulfilled).toEqual([
      { instanceId: "i-a", value: "data-a" },
      { instanceId: "i-c", value: "data-c" },
    ]);
    expect(failedIds).toEqual(["i-b"]);
  });

  it("all rejected: empty fulfilled, all ids failed", () => {
    const instances = [{ id: "x" }, { id: "y" }];
    const settled: Array<PromiseSettledResult<unknown>> = [
      { status: "rejected", reason: new Error("e1") },
      { status: "rejected", reason: new Error("e2") },
    ];

    const { fulfilled, failedIds } = partitionSettledSubs(instances, settled);
    expect(fulfilled).toHaveLength(0);
    expect(failedIds).toEqual(["x", "y"]);
  });

  it("all fulfilled: empty failedIds", () => {
    const instances = [{ id: "ok-1" }];
    const settled: Array<PromiseSettledResult<number>> = [
      { status: "fulfilled", value: 42 },
    ];

    const { fulfilled, failedIds } = partitionSettledSubs(instances, settled);
    expect(fulfilled).toEqual([{ instanceId: "ok-1", value: 42 }]);
    expect(failedIds).toEqual([]);
  });

  it("empty inputs return empty partitions", () => {
    const { fulfilled, failedIds } = partitionSettledSubs([], []);
    expect(fulfilled).toEqual([]);
    expect(failedIds).toEqual([]);
  });
});
