import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

function databaseHash() {
  try {
    const url = new URL(process.env.DATABASE_URL || "");
    return createHash("sha256").update(JSON.stringify({ host: url.hostname === "localhost" ? "127.0.0.1" : url.hostname, port: url.port || "5432", database: url.pathname })).digest("hex");
  } catch { return null; }
}

export function deploymentIdentity() {
  const configuredSha = process.env.APP_GIT_SHA || "development";
  return {
    app: "finsim",
    databaseHash: databaseHash(),
    // Compare non-secret runtime routing settings across a QA run without publishing values.
    configHash: createHash("sha256").update(JSON.stringify(Object.entries(process.env)
      .filter(([key]) => /^(AI_[A-Z_]+_(PROVIDER|MODEL|TIMEOUT_MS)|AI_PROVIDER|AI_FALLBACK_PROVIDER|(?:MIMO|DEEPSEEK|QWEN|OPENAI|GEMINI)_(?:MODEL|BASE_URL|PROXY_URL)|OCR_PROVIDER)$/.test(key))
      .sort(([left], [right]) => left.localeCompare(right)))).digest("hex"),
    gitSha: /^[a-f0-9]{40}$/.test(configuredSha) ? configuredSha : "development",
    environment: ["production", "staging", "local", "test"].includes(process.env.APP_ENV || "")
      ? process.env.APP_ENV : "local",
  };
}

export async function checkReadiness() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      // LIMIT 0 validates the deployed contract without reading student records.
      prisma.$queryRaw`SELECT s."requestId", s."taskSnapshot", s."deletedAt", t."contentVersion", q."id", f."id"
        FROM "Submission" s CROSS JOIN "TaskInstance" t CROSS JOIN "QuizAttempt" q CROSS JOIN "FileUpload" f LIMIT 0`,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("readiness timeout")), 3000); }),
    ]);
    return { ready: true, ...deploymentIdentity() };
  } catch {
    return { ready: false, ...deploymentIdentity() };
  } finally {
    clearTimeout(timer);
  }
}
