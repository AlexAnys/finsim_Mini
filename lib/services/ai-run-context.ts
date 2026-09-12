import { AsyncLocalStorage } from "node:async_hooks";

export interface CapturedAiRun {
  runId: string | null;
  feature: string;
  provider: string;
  model: string;
  status: "running" | "succeeded" | "failed";
  inputTokens: number | null;
  outputTokens: number | null;
  costEstUSD: number | null;
}

const captures = new AsyncLocalStorage<{
  metadata: Record<string, unknown>;
  runs: CapturedAiRun[];
}>();

/** Bind every call/repair/fallback to this business operation, including concurrent operations by one user. */
export async function captureAiRuns<T>(metadata: Record<string, unknown>, operation: () => Promise<T>) {
  const capture = { metadata, runs: [] as CapturedAiRun[] };
  const result = await captures.run(capture, operation);
  return { result, runs: capture.runs };
}

export function aiRunBusinessMetadata() { return captures.getStore()?.metadata ?? {}; }

export function captureAiRunStarted(run: Pick<CapturedAiRun, "runId" | "feature" | "provider" | "model">) {
  captures.getStore()?.runs.push({ ...run, status: "running", inputTokens: null, outputTokens: null, costEstUSD: null });
}

export function captureAiRunFinished(runId: string, data: Pick<CapturedAiRun, "status" | "inputTokens" | "outputTokens" | "costEstUSD">) {
  const run = captures.getStore()?.runs.find((item) => item.runId === runId);
  if (run) Object.assign(run, data);
}

export function summarizeAiRuns(runs: CapturedAiRun[]) {
  const last = runs.findLast((run) => run.status === "succeeded") ?? runs.at(-1);
  if (!last) return null;
  // Unknown usage/cost for any attempt remains unknown, never a deceptively low total.
  const sum = (field: "inputTokens" | "outputTokens" | "costEstUSD") =>
    runs.some((run) => run[field] == null) ? null : runs.reduce((total, run) => total + run[field]!, 0);
  return {
    runId: last.runId,
    runIds: runs.flatMap((run) => run.runId ? [run.runId] : []),
    model: last.model,
    provider: last.provider,
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    costEstUSD: sum("costEstUSD"),
  };
}
