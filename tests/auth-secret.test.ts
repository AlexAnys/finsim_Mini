import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isStudentSelfRegistrationEnabled,
  resolveAdminKey,
  resolveAuthSecret,
} from "@/lib/auth/secret";

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

  it("requires an auth secret in production", () => {
    expect(() => resolveAuthSecret({ NODE_ENV: "production" })).toThrow(
      "AUTH_SECRET_REQUIRED",
    );
  });

  it("allows production build phase to run without injecting runtime secret", () => {
    expect(
      resolveAuthSecret({
        NODE_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }),
    ).toBeUndefined();
  });

  it("rejects default dev auth secrets in production", () => {
    expect(() =>
      resolveAuthSecret({
        NODE_ENV: "production",
        AUTH_SECRET: "dev-secret-change-in-production-must-be-256-bits",
      }),
    ).toThrow("AUTH_SECRET_WEAK");
  });
});

describe("resolveAdminKey", () => {
  it("returns configured admin key outside production", () => {
    expect(resolveAdminKey({ ADMIN_KEY: " local-key " })).toBe("local-key");
  });

  it("requires admin key in production", () => {
    expect(() => resolveAdminKey({ NODE_ENV: "production" })).toThrow(
      "ADMIN_KEY_REQUIRED",
    );
  });

  it("rejects default admin key in production", () => {
    expect(() =>
      resolveAdminKey({
        NODE_ENV: "production",
        ADMIN_KEY: "finsim-teacher-key",
      }),
    ).toThrow("ADMIN_KEY_WEAK");
  });
});

describe("isStudentSelfRegistrationEnabled", () => {
  it("defaults to enabled outside production for local development", () => {
    expect(isStudentSelfRegistrationEnabled({ NODE_ENV: "development" })).toBe(
      true,
    );
  });

  it("defaults to disabled in production", () => {
    expect(isStudentSelfRegistrationEnabled({ NODE_ENV: "production" })).toBe(
      false,
    );
  });

  it("honors explicit opt-in", () => {
    expect(
      isStudentSelfRegistrationEnabled({
        NODE_ENV: "production",
        ENABLE_STUDENT_SELF_REGISTRATION: "true",
      }),
    ).toBe(true);
  });
});

describe("production compose secret requirements", () => {
  it("does not provide production fallbacks for auth/admin/database secrets", () => {
    const compose = readFileSync(join(process.cwd(), "docker-compose.yml"), "utf-8");

    expect(compose).toContain("${AUTH_SECRET:?AUTH_SECRET must be set}");
    expect(compose).toContain("${ADMIN_KEY:?ADMIN_KEY must be set}");
    expect(compose).toContain("${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}");
    expect(compose).not.toContain("NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-dev-secret");
    expect(compose).not.toContain("ADMIN_KEY=${ADMIN_KEY:-finsim-teacher-key}");
    expect(compose).not.toContain("POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-finsim_dev_password}");
  });
});
