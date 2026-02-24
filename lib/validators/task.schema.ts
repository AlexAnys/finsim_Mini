import { z } from "zod";

// 任务类型
export const taskTypeEnum = z.enum(["simulation", "quiz", "subjective"]);
export const strictnessEnum = z.enum(["LENIENT", "MODERATE", "STRICT", "VERY_STRICT"]);
export const visibilityEnum = z.enum(["private", "shared", "department", "public"]);
export const quizModeEnum = z.enum(["fixed", "adaptive"]);
export const quizQuestionTypeEnum = z.enum(["single_choice", "multiple_choice", "true_false", "short_answer"]);

// 评分标准
export const scoringCriterionSchema = z.object({
  name: z.string().min(1, "标准名称不能为空").max(200),
  description: z.string().optional(),
  maxPoints: z.number().int().min(1, "最高分至少为1"),
  order: z.number().int().min(0),
});

// 资产配置项
export const allocationItemSchema = z.object({
  label: z.string().min(1).max(200),
  order: z.number().int().min(0),
});

// 资产配置分区
export const allocationSectionSchema = z.object({
  label: z.string().min(1).max(200),
  order: z.number().int().min(0),
  items: z.array(allocationItemSchema).optional(),
});

// 模拟对话配置
export const simulationConfigSchema = z.object({
  scenario: z.string().min(1, "场景描述不能为空"),
  openingLine: z.string().min(1, "开场白不能为空"),
  dialogueRequirements: z.string().optional(),
  studyBuddyContext: z.string().optional(),
  evaluatorPersona: z.string().optional(),
  strictnessLevel: strictnessEnum.default("MODERATE"),
  systemPrompt: z.string().optional(),
});

// 测验配置
export const quizConfigSchema = z.object({
  mode: quizModeEnum,
  timeLimitMinutes: z.number().int().min(1).optional(),
  showCorrectAnswer: z.boolean().default(false),
  maxQuestions: z.number().int().min(1).optional(),
  startDifficulty: z.number().int().min(1).max(5).optional(),
  difficultyStep: z.number().int().min(1).optional(),
});

// 主观题配置
export const subjectiveConfigSchema = z.object({
  prompt: z.string().min(1, "题目提示不能为空"),
  allowTextAnswer: z.boolean().default(true),
  allowedAttachmentTypes: z.array(z.string()).default([]),
  referenceAnswer: z.string().optional(),
  evaluatorPersona: z.string().optional(),
  strictnessLevel: strictnessEnum.default("MODERATE"),
});

// 测验题目选项
export const quizOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

// 测验题目
export const quizQuestionSchema = z.object({
  type: quizQuestionTypeEnum,
  prompt: z.string().min(1, "题目内容不能为空"),
  options: z.array(quizOptionSchema).optional(),
  correctOptionIds: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  points: z.number().int().min(1).max(3),
  difficulty: z.number().int().min(1).max(5).optional(),
  explanation: z.string().optional(),
  order: z.number().int().min(0),
});

// 创建任务请求
export const createTaskSchema = z.object({
  taskType: taskTypeEnum,
  taskName: z.string().min(1, "任务名称不能为空").max(200),
  requirements: z.string().optional(),
  visibility: visibilityEnum.default("private"),
  practiceEnabled: z.boolean().default(false),
  courseName: z.string().max(200).optional(),
  chapterName: z.string().max(200).optional(),
  // 类型专属配置
  simulationConfig: simulationConfigSchema.optional(),
  quizConfig: quizConfigSchema.optional(),
  subjectiveConfig: subjectiveConfigSchema.optional(),
  // 评分标准
  scoringCriteria: z.array(scoringCriterionSchema).optional(),
  // 资产配置（仅 simulation）
  allocationSections: z.array(allocationSectionSchema).optional(),
  // 测验题目（仅 quiz）
  quizQuestions: z.array(quizQuestionSchema).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

// 任务实例
export const createTaskInstanceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  taskId: z.string().uuid(),
  taskType: taskTypeEnum,
  classId: z.string().uuid(),
  groupIds: z.array(z.string().uuid()).default([]),
  courseId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  slot: z.enum(["pre", "in", "post"]).optional(),
  dueAt: z.string().datetime(),
  publishAt: z.string().datetime().optional(),
  attemptsAllowed: z.number().int().min(1).optional(),
});

export const updateTaskInstanceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  publishAt: z.string().datetime().optional(),
  attemptsAllowed: z.number().int().min(1).optional(),
  groupIds: z.array(z.string().uuid()).optional(),
  status: z.enum(["draft", "published", "closed", "archived"]).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTaskInstanceInput = z.infer<typeof createTaskInstanceSchema>;
export type UpdateTaskInstanceInput = z.infer<typeof updateTaskInstanceSchema>;
