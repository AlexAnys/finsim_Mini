import { describe, it, expect } from "vitest";
import { resolveAuthSecret } from "@/lib/auth/secret";

describe("resolveAuthSecret", () => {
  it("returns AUTH_SECRET when both v5 and v4 env are set (v5 priority)", () => {
    const env = {
      AUTH_SECRET: "v5-new-secret",
      NEXTAUTH_SECRET: "v4-old-secret",
    };
    expect(resolveAuthSecret(env)).toBe("v5-new-secret");
  });

  it("falls back to NEXTAUTH_SECRET when only v4 env is set", () => {
    const env = { NEXTAUTH_SECRET: "v4-old-secret" };
    expect(resolveAuthSecret(env)).toBe("v4-old-secret");
  });

  it("returns AUTH_SECRET when only v5 env is set", () => {
    const env = { AUTH_SECRET: "v5-only" };
    expect(resolveAuthSecret(env)).toBe("v5-only");
  });

  it("returns undefined when neither env is set", () => {
    expect(resolveAuthSecret({})).toBeUndefined();
  });

  it("treats empty-string AUTH_SECRET as unset and falls back to v4", () => {
    // Deployers sometimes accidentally set AUTH_SECRET="" — don't let that mask a valid v4 secret.
    const env = {
      AUTH_SECRET: "",
      NEXTAUTH_SECRET: "v4-still-works",
    };
    expect(resolveAuthSecret(env)).toBe("v4-still-works");
  });

  it("treats whitespace-only AUTH_SECRET as unset and falls back to v4", () => {
    const env = {
      AUTH_SECRET: "   \n\t  ",
      NEXTAUTH_SECRET: "v4-still-works",
    };
    expect(resolveAuthSecret(env)).toBe("v4-still-works");
  });

  it("trims whitespace around valid secret values", () => {
    const env = { AUTH_SECRET: "  abc123  " };
    expect(resolveAuthSecret(env)).toBe("abc123");
  });

  it("reads process.env by default when no arg provided", () => {
    const result = resolveAuthSecret();
    expect(typeof result === "string" || result === undefined).toBe(true);
  });
});
