/**
 * PR-1 Candidate E — Prompt registry barrel.
 *
 * 集中导出所有 feature 的 prompt builder + 提供 toolKey → preview 派生。
 * 详见 lib/ai/prompts/types.ts。
 */
export type { BuiltPrompt, PromptBuilder } from "./types";

export {
  buildSimulationChatPrompt,
  buildSimulationChatPersona,
  SIMULATION_CHAT_PROMPT_VERSION,
  type SimulationChatOpts,
  type SimulationChatBuiltPrompt,
} from "./simulation-chat";

export {
  buildSimulationEvaluatePrompt,
  buildEvidenceRetryHint,
  SIMULATION_EVALUATE_PROMPT_VERSION,
  type SimulationEvaluateOpts,
} from "./simulation-evaluate";

export {
  buildSocraticHintPrompt,
  SOCRATIC_HINT_PROMPT_VERSION,
  type SocraticHintOpts,
} from "./socratic-hint";

export {
  buildQuizShortAnswerGradePrompt,
  QUIZ_SHORT_ANSWER_GRADE_PROMPT_VERSION,
  type QuizShortAnswerGradeOpts,
} from "./quiz-short-answer-grade";

export {
  buildQuizConceptTagsPrompt,
  QUIZ_CONCEPT_TAGS_PROMPT_VERSION,
  type QuizConceptTagsOpts,
} from "./quiz-concept-tags";

export {
  buildQuizQuestionTaggerPrompt,
  QUIZ_QUESTION_TAGGER_PROMPT_VERSION,
  type QuizQuestionTaggerOpts,
} from "./quiz-question-tagger";

export {
  buildSubjectiveGradePrompt,
  SUBJECTIVE_GRADE_PROMPT_VERSION,
  type SubjectiveGradeOpts,
} from "./subjective-grade";

export {
  buildStudyBuddyReplyPrompt,
  SOCRATIC_MODE_PROMPT,
  DIRECT_MODE_PROMPT,
  STUDY_BUDDY_REPLY_PROMPT_VERSION,
  type StudyBuddyReplyOpts,
} from "./study-buddy-reply";

export {
  buildStudyBuddySummaryPrompt,
  STUDY_BUDDY_SUMMARY_PROMPT_VERSION,
  type StudyBuddySummaryOpts,
} from "./study-buddy-summary";

export {
  buildWeeklyInsightPrompt,
  WEEKLY_INSIGHT_PROMPT_VERSION,
  type WeeklyInsightOpts,
} from "./weekly-insight";

export {
  buildInsightsAggregatePrompt,
  INSIGHTS_AGGREGATE_PROMPT_VERSION,
  type InsightsAggregateOpts,
} from "./insights-aggregate";

export {
  buildScopeInsightsDiagnosisPrompt,
  buildScopeInsightsAdvicePrompt,
  SCOPE_INSIGHTS_DIAGNOSIS_PROMPT_VERSION,
  SCOPE_INSIGHTS_ADVICE_PROMPT_VERSION,
  type ScopeInsightsDiagnosisOpts,
  type ScopeInsightsAdviceOpts,
} from "./scope-insights";

export {
  buildTaskDraftFromContextPrompt,
  TASK_DRAFT_FROM_CONTEXT_PROMPT_VERSION,
  type TaskDraftFromContextOpts,
} from "./task-draft-from-context";

export {
  buildTaskDraftQuizPrompt,
  TASK_DRAFT_QUIZ_PROMPT_VERSION,
  type TaskDraftQuizOpts,
} from "./task-draft-quiz";

export {
  buildTaskDraftSubjectivePrompt,
  TASK_DRAFT_SUBJECTIVE_PROMPT_VERSION,
  type TaskDraftSubjectiveOpts,
} from "./task-draft-subjective";

export {
  buildImportParsePrompt,
  IMPORT_PARSE_PROMPT_VERSION,
  type ImportParseOpts,
} from "./import-parse";

export {
  buildCourseKnowledgeSummaryPrompt,
  COURSE_KNOWLEDGE_SUMMARY_PROMPT_VERSION,
  type CourseKnowledgeSummaryOpts,
} from "./course-knowledge-summary";

export {
  buildCourseOutlinePrompt,
  COURSE_OUTLINE_PROMPT_VERSION,
  type CourseOutlineOpts,
} from "./course-outline";

export {
  buildQuestionBankPrompt,
  QUESTION_BANK_PROMPT_VERSION,
  type QuestionBankOpts,
} from "./question-bank";

export {
  buildWorkAssistantPrompt,
  WORK_ASSISTANT_PROMPT_VERSION,
  type WorkAssistantOpts,
  type WorkAssistantToolKey,
} from "./work-assistant";
