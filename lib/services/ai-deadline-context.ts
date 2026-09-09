import { AsyncLocalStorage } from "node:async_hooks";

const deadlines = new AsyncLocalStorage<number>();

export function getAiDeadline(): number | undefined { return deadlines.getStore(); }

/** Groups multiple AI calls (e.g. a quiz's short answers) into one wait budget. */
export function withAiDeadline<T>(timeoutMs: number, callback: () => T): T {
  const deadline = Math.min(Date.now() + timeoutMs, deadlines.getStore() ?? Infinity);
  return deadlines.run(deadline, callback);
}
