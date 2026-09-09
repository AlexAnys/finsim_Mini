import { AsyncLocalStorage } from "node:async_hooks";

export interface JobLease { jobId: string; attempt: number }
const jobContext = new AsyncLocalStorage<JobLease>();

export function getCurrentJobLease(): JobLease | undefined {
  return jobContext.getStore();
}

export function withJobLease<T>(lease: JobLease, callback: () => T): T {
  return jobContext.run(lease, callback);
}
