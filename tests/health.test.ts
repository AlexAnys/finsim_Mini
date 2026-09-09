import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));
import { prisma } from "@/lib/db/prisma";
import { GET as version } from "@/app/api/version/route";
import { GET as ready } from "@/app/api/health/ready/route";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("deployment identity and readiness", () => {
  it("reports actual runtime SHA without caching", async () => {
    vi.stubEnv("APP_GIT_SHA", "a".repeat(40)); vi.stubEnv("APP_ENV", "staging");
    const response = version();
    expect((await response.json()).data).toMatchObject({ app: "finsim", gitSha: "a".repeat(40), environment: "staging" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("uses an explicit development identity until a real build SHA is supplied", async () => {
    vi.stubEnv("APP_GIT_SHA", "untrusted-value");
    expect((await version().json()).data.gitSha).toBe("development");
  });
  it("changes routing identity when the same model switches between real and mock endpoints", async () => {
    vi.stubEnv("MIMO_BASE_URL", "https://provider.example/v1");
    const real = (await version().json()).data.configHash;
    vi.stubEnv("MIMO_BASE_URL", "http://127.0.0.1:3189/v1");
    expect((await version().json()).data.configHash).not.toBe(real);
  });
  it("returns 503 when the actual database check fails, without leaking the error", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("postgres://secret"));
    const response = await ready();
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret");
  });
  it("returns ready only after the database query succeeds", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ value: 1 }]);
    const response = await ready();
    expect(response.status).toBe(200); expect((await response.json()).data.ready).toBe(true);
  });
});
