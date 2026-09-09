import { afterEach, describe, expect, it, vi } from "vitest";
import { loadInitialSession, SESSION_INITIALIZATION_TIMEOUT_MS } from "@/lib/auth/client-session-bootstrap";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("cold-start login readiness", () => {
  it("coalesces repeated mounts and stays pending until the cookie-setting response is complete", async () => {
    let respond!: (response: Response) => void;
    const request = new Promise<Response>(resolve => { respond = resolve; });
    const fetch = vi.fn(() => request); vi.stubGlobal("fetch", fetch);
    const first = loadInitialSession(); const repeatedMount = loadInitialSession();
    expect(first).toBe(repeatedMount); expect(fetch).toHaveBeenCalledTimes(1);
    let ready = false; void first.then(() => { ready = true; });
    await Promise.resolve(); expect(ready).toBe(false);
    respond(new Response("null", { status: 200 }));
    await expect(first).resolves.toBeNull(); expect(ready).toBe(true);
  });
  it("does not convert a failed session response into a ready anonymous form", async () => {
    const fetch = vi.fn(async () => new Response("{}", { status: 503 })); vi.stubGlobal("fetch", fetch);
    await expect(loadInitialSession()).rejects.toThrow("SESSION_INITIALIZATION_FAILED");
    expect(fetch).toHaveBeenCalledTimes(1); // no automatic retry
  });
  it("rejects configuration-error objects rather than treating them as sessions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "configuration error" })));
    await expect(loadInitialSession()).rejects.toThrow("SESSION_INITIALIZATION_FAILED");
  });
  it("aborts a stalled bootstrap and does not automatically start another cookie-setting request", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetch = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      signal = options.signal as AbortSignal;
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    vi.stubGlobal("fetch", fetch);
    const failure = expect(loadInitialSession()).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(SESSION_INITIALIZATION_TIMEOUT_MS);
    await failure;
    expect(signal?.aborted).toBe(true); expect(fetch).toHaveBeenCalledTimes(1);
  });

});
