import { vi } from "vitest";

/**
 * Shared mock-prisma factory. 每个 Prisma model 一组 CRUD vi.fn stub.
 *
 * 用法:
 *   const prisma = createMockPrisma();
 *   prisma.user.findUnique.mockResolvedValue({ id: "u1", ... });
 *
 * Override 指定 model:
 *   const prisma = createMockPrisma({
 *     user: { findUnique: vi.fn().mockResolvedValue(...) },
 *   });
 *
 * 配合 vi.mock:
 *   vi.mock("@/lib/db/prisma", () => ({ prisma: createMockPrisma() }));
 */

type ModelStub = {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
};

function makeModelStub(): ModelStub {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  };
}

// 完整 schema.prisma model 列表 (37 个)
const PRISMA_MODELS = [
  "aiRun",
  "aiToolSetting",
  "allocationItem",
  "allocationSection",
  "analysisReport",
  "announcement",
  "asyncJob",
  "attachment",
  "auditLog",
  "chapter",
  "class",
  "contentBlock",
  "course",
  "courseClass",
  "courseKnowledgeSource",
  "courseTeacher",
  "importJob",
  "quizConfig",
  "quizQuestion",
  "quizSubmission",
  "scheduleSlot",
  "scoringCriterion",
  "section",
  "simulationConfig",
  "simulationSubmission",
  "studentGroup",
  "studentGroupMember",
  "studyBuddyPost",
  "studyBuddySummary",
  "subjectiveConfig",
  "subjectiveSubmission",
  "submission",
  "task",
  "taskBuildDraft",
  "taskInstance",
  "taskInstanceAnalytics",
  "taskPost",
  "user",
] as const;

export type MockPrisma = Record<(typeof PRISMA_MODELS)[number], ModelStub> & {
  $transaction: ReturnType<typeof vi.fn>;
  $connect: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $executeRaw: ReturnType<typeof vi.fn>;
};

export function createMockPrisma(
  overrides: Partial<Record<(typeof PRISMA_MODELS)[number], Partial<ModelStub>>> = {},
): MockPrisma {
  const base: Record<string, ModelStub> = {};
  for (const m of PRISMA_MODELS) {
    base[m] = makeModelStub();
    if (overrides[m]) {
      Object.assign(base[m], overrides[m]);
    }
  }

  return {
    ...(base as Record<(typeof PRISMA_MODELS)[number], ModelStub>),
    // $transaction 默认: 接 callback → 同步传同一个 prisma 当 tx
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => unknown)(base);
      }
      // 数组形式: Promise.all 等价
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return undefined;
    }),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  } as MockPrisma;
}

/** Reset 全部 mock (常在 beforeEach 用) */
export function resetMockPrisma(prisma: MockPrisma) {
  for (const m of PRISMA_MODELS) {
    const stub = prisma[m];
    Object.values(stub).forEach((fn) => fn.mockReset());
  }
  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: unknown) => unknown)(prisma);
    }
    if (Array.isArray(arg)) return Promise.all(arg);
    return undefined;
  });
}
