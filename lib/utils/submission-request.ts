const keyFor = (userId: string, instanceId: string) => `finsim_submission_request_${userId}_${instanceId}`;
/** Retain through a lost response; clear only after a confirmed successful submit. */
export function submissionRequestId(userId: string, instanceId: string): string {
  const key = keyFor(userId, instanceId);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}
export function finishSubmissionRequest(userId: string, instanceId: string) {
  localStorage.removeItem(keyFor(userId, instanceId));
}
