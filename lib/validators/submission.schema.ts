import { z } from "zod";

// 对话消息
export const transcriptMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["student", "ai"]),
  text: z.string(),
  timestamp: z.string(),
  mood: z.enum(["HAPPY", "NEUTRAL", "ANGRY", "CONFUSED", "SKEPTICAL"]).optional(),
});

// 资产配置
export const assetAllocationSchema = z.object({
  sections: z.array(z.object({
    label: z.string(),
    items: z.array(z.object({
      label: z.string(),
      value: z.number().min(0).max(100),
    })),
  })),
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
  questionId: z.string(),
  selectedOptionIds: z.array(z.string()).optional(),
  textAnswer: z.string().optional(),
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
  transcript: z.array(transcriptMessageSchema),
  assets: assetAllocationSchema.optional(),
  evaluation: simulationEvaluationSchema.optional(),
});

// 创建提交 - 测验
export const createQuizSubmissionSchema = z.object({
  taskType: z.literal("quiz"),
  taskId: z.string().uuid(),
  taskInstanceId: z.string().uuid().optional(),
  answers: z.array(quizAnswerSchema),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

// 创建提交 - 主观题
export const createSubjectiveSubmissionSchema = z.object({
  taskType: z.literal("subjective"),
  taskId: z.string().uuid(),
  taskInstanceId: z.string().uuid().optional(),
  textAnswer: z.string().optional(),
  attachments: z.array(z.object({
    fileName: z.string(),
    filePath: z.string(),
    fileSize: z.number(),
    contentType: z.string(),
  })).optional(),
});

// 统一创建提交
export const createSubmissionSchema = z.discriminatedUnion("taskType", [
  createSimulationSubmissionSchema,
  createQuizSubmissionSchema,
  createSubjectiveSubmissionSchema,
]);

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

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
