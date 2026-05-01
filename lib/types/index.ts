// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 用户相关
export type UserRole = "student" | "teacher" | "admin";

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  classId: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

// 任务类型
export type TaskType = "simulation" | "quiz" | "subjective";

// 任务实例状态
export type TaskInstanceStatus = "draft" | "published" | "closed" | "archived";

// 提交状态
export type SubmissionStatus = "submitted" | "grading" | "graded" | "failed";

// 内容块类型
export type ContentBlockType = "markdown" | "resource" | "simulation-config" | "quiz" | "subjective" | "custom";

// Slot 类型
export type SlotType = "pre" | "in" | "post";

// 测验题型
export type QuizQuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_answer";

// 测验模式
export type QuizMode = "fixed" | "adaptive";

// 严格度
export type StrictnessLevel = "LENIENT" | "MODERATE" | "STRICT" | "VERY_STRICT";

// 学习伙伴模式
export type StudyBuddyMode = "socratic" | "direct";

// 情绪 (PR-7B: 8 档 D1)
// HAPPY=平静 / RELAXED=放松 / EXCITED=兴奋 / NEUTRAL=犹豫
// SKEPTICAL=怀疑 / CONFUSED=略焦虑 / ANGRY=焦虑 / DISAPPOINTED=失望
// 旧 5 档值 (HAPPY/NEUTRAL/ANGRY/CONFUSED/SKEPTICAL) 仍合法 — 历史 transcript 数据零迁移
export type MoodType =
  | "HAPPY"
  | "RELAXED"
  | "EXCITED"
  | "NEUTRAL"
  | "SKEPTICAL"
  | "CONFUSED"
  | "ANGRY"
  | "DISAPPOINTED";

// AI Feature
export type AIFeature =
  | "simulation"
  | "evaluation"
  | "studyBuddyReply"
  | "studyBuddySummary"
  | "quizGrade"
  | "subjectiveGrade"
  | "taskDraft"
  | "quizDraft"
  | "subjectiveDraft"
  | "importParse"
  | "insights"
  | "weeklyInsight"
  | "lessonPolish"
  | "ideologyMining"
  | "questionAnalysis"
  | "examCheck";

// 评估结果
export interface RubricBreakdown {
  criterionId: string;
  score: number;
  maxScore: number;
  comment: string;
}

export interface SimulationEvaluation {
  totalScore: number;
  maxScore: number;
  feedback: string;
  rubricBreakdown: RubricBreakdown[];
}

export interface QuizBreakdown {
  questionId: string;
  score: number;
  maxScore: number;
  correct: boolean;
  comment: string;
}

export interface QuizEvaluation {
  totalScore: number;
  maxScore: number;
  feedback: string;
  quizBreakdown: QuizBreakdown[];
}

export interface SubjectiveEvaluation {
  totalScore: number;
  maxScore: number;
  feedback: string;
  rubricBreakdown: RubricBreakdown[];
}

// 对话消息
export interface TranscriptMessage {
  id: string;
  role: "student" | "ai";
  text: string;
  timestamp: string;
  mood?: MoodType;
  /** PR-7B: 0-1 single-axis mood intensity. 0=平静, 1=失望/焦虑 */
  moodScore?: number;
  /** PR-7B: Socratic hint surfaced when student perf low or off-track */
  hint?: string;
}

// 资产配置
export interface AssetAllocation {
  sections: Array<{
    label: string;
    items: Array<{
      label: string;
      value: number;
    }>;
  }>;
}
