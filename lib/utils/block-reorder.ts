interface ReorderableBlock {
  id: string;
  slot: string;
  order: number;
}

export interface ReorderSwap {
  id: string;
  order: number;
}

/**
 * Given a block list and a target block id + direction, compute the 2-element swap
 * needed to move the target block up or down **within its own slot group**.
 *
 * Returns `null` when the move is a no-op:
 *  - target not found
 *  - target is first in slot + direction=up
 *  - target is last in slot + direction=down
 *
 * Rationale: the endpoint `POST /api/lms/content-blocks/reorder` takes an array of
 * `{id, order}` updates. A 2-swap is the minimal update that keeps neighbors' orders
 * stable, so we don't need to renumber the whole slot.
 */
export function computeReorderSwap(
  blocks: ReorderableBlock[],
  targetId: string,
  direction: "up" | "down"
): [ReorderSwap, ReorderSwap] | null {
  const target = blocks.find((b) => b.id === targetId);
  if (!target) return null;
  const sameSlot = blocks
    .filter((b) => b.slot === target.slot)
    .sort((a, b) => a.order - b.order);
  const idx = sameSlot.findIndex((b) => b.id === targetId);
  if (idx < 0) return null;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sameSlot.length) return null;
  const a = sameSlot[idx];
  const b = sameSlot[swapIdx];
  return [
    { id: a.id, order: b.order },
    { id: b.id, order: a.order },
  ];
}
