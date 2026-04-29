type SecretEnv = {
  AUTH_SECRET?: string | undefined;
  NEXTAUTH_SECRET?: string | undefined;
  NEXT_PHASE?: string | undefined;
  NODE_ENV?: string | undefined;
  ADMIN_KEY?: string | undefined;
  ENABLE_STUDENT_SELF_REGISTRATION?: string | undefined;
};

const DEV_AUTH_SECRETS = new Set([
  "dev-secret-change-in-production-must-be-256-bits",
  "nextauth-secret",
  "changeme",
  "secret",
]);

const DEV_ADMIN_KEYS = new Set([
  "finsim-teacher-key",
  "admin",
  "changeme",
  "secret",
]);

function truthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

function isProduction(env: SecretEnv) {
  return env.NODE_ENV === "production";
}

function isProductionBuild(env: SecretEnv) {
  return env.NEXT_PHASE === "phase-production-build";
}

export function resolveAuthSecret(
  env: SecretEnv = process.env as SecretEnv
): string | undefined {
  const v5 = env.AUTH_SECRET?.trim();
  if (v5) {
    if (isProduction(env) && (v5.length < 32 || DEV_AUTH_SECRETS.has(v5))) {
      throw new Error("AUTH_SECRET_WEAK");
    }
    return v5;
  }
  const v4 = env.NEXTAUTH_SECRET?.trim();
  if (v4) {
    if (isProduction(env) && (v4.length < 32 || DEV_AUTH_SECRETS.has(v4))) {
      throw new Error("AUTH_SECRET_WEAK");
    }
    return v4;
  }
  if (isProduction(env)) {
    if (isProductionBuild(env)) return undefined;
    throw new Error("AUTH_SECRET_REQUIRED");
  }
  return undefined;
}

export function resolveAdminKey(
  env: SecretEnv = process.env as SecretEnv,
): string | undefined {
  const key = env.ADMIN_KEY?.trim();
  if (!key) {
    if (isProduction(env)) throw new Error("ADMIN_KEY_REQUIRED");
    return undefined;
  }
  if (isProduction(env) && (key.length < 16 || DEV_ADMIN_KEYS.has(key))) {
    throw new Error("ADMIN_KEY_WEAK");
  }
  return key;
}

export function isStudentSelfRegistrationEnabled(
  env: SecretEnv = process.env as SecretEnv,
): boolean {
  const explicit = env.ENABLE_STUDENT_SELF_REGISTRATION;
  if (explicit !== undefined) return truthy(explicit);
  return !isProduction(env);
}
