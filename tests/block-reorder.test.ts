import { describe, it, expect } from "vitest";
import { computeReorderSwap } from "@/lib/utils/block-reorder";

function b(id: string, slot: string, order: number) {
  return { id, slot, order };
}

describe("computeReorderSwap", () => {
  it("returns null when target id not found", () => {
    const blocks = [b("a", "pre", 0), b("b", "pre", 1)];
    expect(computeReorderSwap(blocks, "missing", "up")).toBeNull();
  });

  it("returns null when first in slot + direction=up (no-op)", () => {
    const blocks = [b("a", "pre", 0), b("b", "pre", 1)];
    expect(computeReorderSwap(blocks, "a", "up")).toBeNull();
  });

  it("returns null when last in slot + direction=down (no-op)", () => {
    const blocks = [b("a", "pre", 0), b("b", "pre", 1)];
    expect(computeReorderSwap(blocks, "b", "down")).toBeNull();
  });

  it("swaps orders for adjacent pair (down)", () => {
    const blocks = [b("a", "pre", 0), b("b", "pre", 1), b("c", "pre", 2)];
    const swap = computeReorderSwap(blocks, "a", "down");
    expect(swap).toEqual([
      { id: "a", order: 1 },
      { id: "b", order: 0 },
    ]);
  });

  it("swaps orders for adjacent pair (up)", () => {
    const blocks = [b("a", "pre", 0), b("b", "pre", 1), b("c", "pre", 2)];
    const swap = computeReorderSwap(blocks, "c", "up");
    expect(swap).toEqual([
      { id: "c", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("ignores blocks in different slots when computing neighbor", () => {
    // In "pre" slot: a(order 0), c(order 1). "in" slot has b(order 0) but shouldn't affect.
    const blocks = [b("a", "pre", 0), b("b", "in", 0), b("c", "pre", 1)];
    const swap = computeReorderSwap(blocks, "a", "down");
    expect(swap).toEqual([
      { id: "a", order: 1 },
      { id: "c", order: 0 },
    ]);
  });

  it("handles non-sequential orders correctly (preserves stable swap)", () => {
    // Orders may have gaps after deletes. The swap still exchanges exact order values,
    // not "idx+1/-1", so gaps persist and never clash with other blocks.
    const blocks = [b("a", "pre", 0), b("b", "pre", 5), b("c", "pre", 10)];
    const swap = computeReorderSwap(blocks, "b", "up");
    expect(swap).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 5 },
    ]);
  });

  it("cross-slot move is not supported — up on first in slot returns null even if another slot has lower orders", () => {
    const blocks = [b("a", "in", 0), b("b", "pre", 99)];
    // b is the only item in "pre", so up/down are both no-ops
    expect(computeReorderSwap(blocks, "b", "up")).toBeNull();
    expect(computeReorderSwap(blocks, "b", "down")).toBeNull();
  });
});
