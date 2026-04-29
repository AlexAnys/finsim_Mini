import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function isSafeRelativePath(value: string) {
  return (
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("..") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value.split("/").every(Boolean)
  );
}

const attachmentPathSchema = z
  .string()
  .max(1000)
  .refine(isSafeRelativePath, "附件路径不合法");

// 对话消息（PR-7B 升级 mood 8 档 + moodScore/hint；PR-7C 仅复用）
export const transcriptMessageSchema = z.object({
  id: z.string().max(120),
  role: z.enum(["student", "ai"]),
  text: z.string().max(4000),
  timestamp: z.string().max(100),
  mood: z
    .enum([
      "HAPPY",
      "RELAXED",
      "EXCITED",
      "NEUTRAL",
      "SKEPTICAL",
      "CONFUSED",
      "ANGRY",
      "DISAPPOINTED",
    ])
    .optional(),
  moodScore: z.number().min(0).max(1).optional(),
  hint: z.string().max(500).optional(),
});

// 资产配置 snapshot（PR-7C：学生在对话过程中按"记录当前配比"按钮触发）
export const allocationSnapshotSchema = z.object({
  /** 学生轮数（即对话中 student-role 消息的累计计数）；从 1 起 */
  turn: z.number().int().min(0),
  /** ISO timestamp */
  ts: z.string(),
  /** 当前快照下的配比（来自所有 sections 拍平后的 [{label, value}]） */
  // PR-FIX-2 B5: 单 snapshot allocations 上限 20 项（防客户端塞过大数组）
  allocations: z.array(
    z.object({
      label: z.string().max(100),
      value: z.number().min(0).max(100),
    }),
  ).max(20),
});

// 资产配置（PR-7C：sections 必填；snapshots 可选）
export const assetAllocationSchema = z.object({
  sections: z.array(z.object({
    label: z.string().max(100),
    items: z.array(z.object({
      label: z.string().max(100),
      value: z.number().min(0).max(100),
    })).max(40),
  })).max(12),
  // PR-FIX-2 B5: snapshots 数组上限 20 项（防客户端塞过大数组刷 AI token）
  snapshots: z.array(allocationSnapshotSchema).max(20).optional(),
});

// 评分标准分项结果
export const rubricBreakdownSchema = z.object({
  criterionId: z.string(),
  score: z.number().min(0),
  maxScore: z.number().min(0),
  comment: z.string(),
});

// 模拟对话评估结果
export const simulationEvaluationSchema = z.object({
  totalScore: z.number().min(0),
  maxScore: z.number().min(0),
  feedback: z.string(),
  rubricBreakdown: z.array(rubricBreakdownSchema),
});

// 测验答案
export const quizAnswerSchema = z.object({
  questionId: z.string().max(120),
  selectedOptionIds: z.array(z.string().max(120)).max(20).optional(),
  textAnswer: z.string().max(2000).optional(),
});

// 测验分项结果
export const quizBreakdownSchema = z.object({
  questionId: z.string(),
  score: z.number().min(0),
  maxScore: z.number().min(0),
  correct: z.boolean(),
  comment: z.string(),
});

// 测验评估结果
export const quizEvaluationSchema = z.object({
  totalScore: z.number().min(0),
  maxScore: z.number().min(0),
  feedback: z.string(),
  quizBreakdown: z.array(quizBreakdownSchema),
});

// 主观题评估结果
export const subjectiveEvaluationSchema = z.object({
  totalScore: z.number().min(0),
  maxScore: z.number().min(0),
  feedback: z.string(),
  rubricBreakdown: z.array(rubricBreakdownSchema),
});

// 创建提交 - 模拟对话
export const createSimulationSubmissionSchema = z.object({
  taskType: z.literal("simulation"),
  taskId: z.string().uuid(),
  taskInstanceId: z.string().uuid().optional(),
  transcript: z.array(transcriptMessageSchema).max(120),
  assets: assetAllocationSchema.optional(),
});

// 创建提交 - 测验
export const createQuizSubmissionSchema = z.object({
  taskType: z.literal("quiz"),
  taskId: z.string().uuid(),
  taskInstanceId: z.string().uuid().optional(),
  answers: z.array(quizAnswerSchema).max(200),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

// 创建提交 - 主观题
export const createSubjectiveSubmissionSchema = z.object({
  taskType: z.literal("subjective"),
  taskId: z.string().uuid(),
  taskInstanceId: z.string().uuid().optional(),
  textAnswer: z.string().max(20000).optional(),
  attachments: z.array(z.object({
    fileName: z.string().max(500),
    filePath: attachmentPathSchema,
    fileSize: z.number().int().min(0).max(MAX_FILE_SIZE_BYTES),
    contentType: z.string().max(100),
  })).max(10).optional(),
});

// 统一创建提交
export const createSubmissionSchema = z.discriminatedUnion("taskType", [
  createSimulationSubmissionSchema,
  createQuizSubmissionSchema,
  createSubjectiveSubmissionSchema,
]);

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type AllocationSnapshot = z.infer<typeof allocationSnapshotSchema>;

// 学习伙伴消息
export const studyBuddyMessageSchema = z.object({
  role: z.enum(["student", "ai"]),
  content: z.string(),
  createdAt: z.string(),
});

// 学习伙伴汇总
export const topQuestionSchema = z.object({
  question: z.string(),
  count: z.number(),
  examples: z.array(z.string()),
});

export const knowledgeGapSchema = z.object({
  topic: z.string(),
  description: z.string(),
  frequency: z.number(),
});
