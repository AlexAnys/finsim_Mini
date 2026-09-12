import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import type { JWT } from "next-auth/jwt";

vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("next-auth", () => ({ default: vi.fn(() => ({})) }));
import { prisma } from "@/lib/db/prisma";
import authConfig from "@/lib/auth/auth.config";

const jwt = authConfig.callbacks!.jwt!;
const credentialVersion = (hash: string) => createHash("sha256").update(hash).digest("hex");
const account = { id: "student", email: "student@example.test", name: "当前姓名", role: "student", classId: "new-class", passwordHash: "stored-password-hash" };
const oldToken = (): JWT => ({ userId: account.id, role: "teacher", classId: "old-class", name: "旧姓名", credentialVersion: credentialVersion(account.passwordHash) });
const refresh = (token: JWT, extra = {}) => jwt({ token, ...extra } as Parameters<typeof jwt>[0]);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(account as never);
});

describe("session revalidation against current account", () => {
  it("binds only a successfully verified password and never returns its hash", async () => {
    const passwordHash = await hash("temporary-test-password", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...account, passwordHash } as never);
    const provider = authConfig.providers[0] as unknown as { options: { authorize: (credentials: Record<string, string>) => Promise<Record<string, unknown> | null> } };
    expect(await provider.options.authorize({ email: account.email, password: "wrong" })).toBeNull();
    const user = await provider.options.authorize({ email: account.email, password: "temporary-test-password" });
    expect(user).toMatchObject({ id: account.id, credentialVersion: credentialVersion(passwordHash) });
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("refreshes changed role, class and profile before authorization", async () => {
    expect(await refresh(oldToken())).toMatchObject({ userId: "student", role: "student", classId: "new-class", name: "当前姓名" });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: account.id } }));
  });

  it("rejects a previously valid session immediately after password change", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...account, passwordHash: "new-password-hash" } as never);
    expect(await refresh(oldToken())).toBeNull();
  });

  it("rejects a deleted user and sessions minted before credential binding", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    expect(await refresh(oldToken())).toBeNull();
    const legacy = oldToken(); delete legacy.credentialVersion;
    expect(await refresh(legacy)).toBeNull();
  });

  it("does not accept role, class or password-version claims from client session update", async () => {
    const next = await refresh(oldToken(), { trigger: "update", session: { role: "admin", classId: "foreign", credentialVersion: "forged" } });
    expect(next).toMatchObject({ role: "student", classId: "new-class", credentialVersion: credentialVersion(account.passwordHash) });
  });

  it("sign-in binds the verified credential and catches a concurrent password reset", async () => {
    const user = { ...account, credentialVersion: credentialVersion(account.passwordHash) };
    expect(await refresh({} as JWT, { user })).toMatchObject({ userId: account.id, role: "student", credentialVersion: user.credentialVersion });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...account, passwordHash: "changed-after-authorize" } as never);
    expect(await refresh({} as JWT, { user })).toBeNull();
  });

  it("does not expose credential binding or password hash through the browser session", async () => {
    const token = await refresh(oldToken());
    const session = await authConfig.callbacks!.session!({ session: { user: {}, expires: "future" }, token } as never);
    expect(session.user).toMatchObject({ id: account.id, role: "student", classId: "new-class", name: "当前姓名" });
    expect(JSON.stringify(session)).not.toContain("credentialVersion");
    expect(JSON.stringify(session)).not.toContain(account.passwordHash);
  });

  it("never authorizes stale claims when the current account cannot be read", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("database unavailable"));
    await expect(refresh(oldToken())).rejects.toThrow("database unavailable");
  });
});
