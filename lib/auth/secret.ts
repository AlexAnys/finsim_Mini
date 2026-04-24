type SecretEnv = {
  AUTH_SECRET?: string | undefined;
  NEXTAUTH_SECRET?: string | undefined;
};

export function resolveAuthSecret(
  env: SecretEnv = process.env as SecretEnv
): string | undefined {
  const v5 = env.AUTH_SECRET?.trim();
  if (v5) return v5;
  const v4 = env.NEXTAUTH_SECRET?.trim();
  if (v4) return v4;
  return undefined;
}
