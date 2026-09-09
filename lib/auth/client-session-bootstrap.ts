import type { Session } from "next-auth";

export const SESSION_INITIALIZATION_TIMEOUT_MS = 15_000;
let inFlight: Promise<Session | null> | null = null;

/** Complete the first cookie-setting response before mounting SessionProvider.
 * StrictMode's repeated effect shares this request instead of creating competing CSRF cookies.
 */
export function loadInitialSession(): Promise<Session | null> {
  if (inFlight) return inFlight;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SESSION_INITIALIZATION_TIMEOUT_MS);
  inFlight = fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
    .then(async response => {
      if (!response.ok) throw new Error("SESSION_INITIALIZATION_FAILED");
      const session: unknown = await response.json();
      if (session === null) return null;
      if (session && typeof session === "object" && !Array.isArray(session)) {
        if (Object.keys(session).length === 0) return null;
        if ("user" in session && session.user && typeof session.user === "object") return session as Session;
      }
      throw new Error("SESSION_INITIALIZATION_FAILED");
    })
    .finally(() => { clearTimeout(timeout); inFlight = null; });
  return inFlight;
}
