import { z } from "zod";

// 任务类型
export const taskTypeEnum = z.enum(["simulation", "quiz", "subjective"]);
export const strictnessEnum = z.enum(["LENIENT", "MODERATE", "STRICT", "VERY_STRICT"]);
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
  practiceEnabled: z.boolean().default(false),
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

export const updateTaskSchema = createTaskSchema.partial().extend({
  /** Unit 4: 高危拦截 — 已有 graded submission 时第一次 PATCH 会被服务端拒绝。
   *  用户在客户端 dialog 明确点"直接保存"后，前端会重发同 body + force:true 跳过拦截。
   *  audit log 会记录 force=true。
   */
  force: z.boolean().optional(),
});

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

export const createPublishedTaskWithInstanceSchema = z.object({
  task: createTaskSchema,
  instance: createTaskInstanceSchema.omit({
    taskId: true,
    taskType: true,
  }),
  // PR-15 bug 1: 关联 TaskBuildDraft；带此字段时 draft.status 必须为 draft/ready/approved 之一，发布后 draft 原子 flip 为 published
  taskBuildDraftId: z.string().uuid().optional(),
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

// Unit A1: 教师编辑 instance.taskSnapshot（影响学生看到的配置）
// 三态 discriminated union；taskType 必填用于 dispatch + 后端守 task.id/taskType 不变
export const updateInstanceSnapshotSimulationSchema = z.object({
  taskType: z.literal("simulation"),
  simulationConfig: simulationConfigSchema.partial().optional(),
  scoringCriteria: z.array(scoringCriterionSchema).optional(),
  allocationSections: z.array(allocationSectionSchema).optional(),
});

export const updateInstanceSnapshotQuizSchema = z.object({
  taskType: z.literal("quiz"),
  quizConfig: quizConfigSchema.partial().optional(),
  quizQuestions: z.array(quizQuestionSchema).optional(),
  scoringCriteria: z.array(scoringCriterionSchema).optional(),
});

export const updateInstanceSnapshotSubjectiveSchema = z.object({
  taskType: z.literal("subjective"),
  subjectiveConfig: subjectiveConfigSchema.partial().optional(),
  scoringCriteria: z.array(scoringCriterionSchema).optional(),
});

export const updateTaskInstanceSnapshotSchema = z.discriminatedUnion("taskType", [
  updateInstanceSnapshotSimulationSchema,
  updateInstanceSnapshotQuizSchema,
  updateInstanceSnapshotSubjectiveSchema,
]);

export type UpdateTaskInstanceSnapshotInput = z.infer<typeof updateTaskInstanceSnapshotSchema>;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTaskInstanceInput = z.infer<typeof createTaskInstanceSchema>;
export type CreatePublishedTaskWithInstanceInput = z.infer<typeof createPublishedTaskWithInstanceSchema>;
export type UpdateTaskInstanceInput = z.infer<typeof updateTaskInstanceSchema>;
