/**
 * PR-1 Candidate E · 教师 UI `/teacher/ai-settings` 的 prompt preview 派生器。
 *
 * 与 review-ai F-10 修复：basePromptPreview 不再是手写副本（运行时与 UI 分叉的源头），
 * 而是直接调对应 builder 的 systemPrompt + truncate。单源 = builder。
 */
import { buildSimulationChatPrompt } from "./simulation-chat";
import { buildSimulationEvaluatePrompt } from "./simulation-evaluate";
import { buildSubjectiveGradePrompt } from "./subjective-grade";
import { buildQuizShortAnswerGradePrompt } from "./quiz-short-answer-grade";
import { buildStudyBuddyReplyPrompt, SOCRATIC_MODE_PROMPT } from "./study-buddy-reply";
import { buildWeeklyInsightPrompt } from "./weekly-insight";
import { buildInsightsAggregatePrompt } from "./insights-aggregate";
import { buildTaskDraftFromContextPrompt } from "./task-draft-from-context";
import { buildTaskDraftQuizPrompt } from "./task-draft-quiz";
import { buildTaskDraftSubjectivePrompt } from "./task-draft-subjective";
import { buildImportParsePrompt } from "./import-parse";
import { buildWorkAssistantPrompt, type WorkAssistantToolKey } from "./work-assistant";

const PREVIEW_CHAR_LIMIT = 600;

/**
 * 截到 PREVIEW_CHAR_LIMIT 字 或 第一个段落分隔 `\n\n` 之前 — 取两者中较短者。
 * 截断时尾部加省略提示，明示这是节选。
 */
export function truncatePromptPreview(s: string, limit = PREVIEW_CHAR_LIMIT): string {
  const paragraphEnd = s.indexOf("\n\n");
  const cutAt = paragraphEnd >= 0 ? Math.min(paragraphEnd, limit) : limit;
  if (s.length <= cutAt) return s;
  return `${s.slice(0, cutAt)}\n…（节选；完整 prompt 由系统在运行时拼接）`;
}

/**
 * 每 toolKey 一组最小 stub opts — 让 builder 能完整渲染出 systemPrompt 供 preview。
 * 这些 stub 仅用于派生 UI preview，不参与真 AI 调用。
 */
function getToolSystemPrompt(toolKey: string): string {
  switch (toolKey) {
    case "simulationChat":
      return buildSimulationChatPrompt({
        scenario: "{scenario}",
        objectives: [],
        messageType: "user_message",
        transcript: [],
      }).systemPrompt;

    case "simulationGrading":
      return buildSimulationEvaluatePrompt({
        taskName: "{taskName}",
        scenario: "{scenario}",
        strictnessLevel: "MODERATE",
        rubric: [],
        transcriptText: "",
        finalAllocations: "",
        snapshotsBlock: "",
      }).systemPrompt;

    case "taskDraft":
      // 默认 quiz 类型（教师 UI 只看 system，type 仅影响 typeLabel）
      return buildTaskDraftFromContextPrompt({
        taskType: "quiz",
        courseName: "{courseName}",
        courseDescription: null,
        chapterName: "{chapterName}",
        sectionName: "{sectionName}",
        sources: [],
      }).systemPrompt;

    case "quizDraft":
      return buildTaskDraftQuizPrompt({
        courseName: "{courseName}",
        chapterName: "{chapterName}",
      }).systemPrompt;

    case "subjectiveDraft":
      return buildTaskDraftSubjectivePrompt({
        courseName: "{courseName}",
        chapterName: "{chapterName}",
      }).systemPrompt;

    case "importParse":
      return buildImportParsePrompt({ truncatedText: "" }).systemPrompt;

    case "quizGrade":
      return buildQuizShortAnswerGradePrompt({
        prompt: "{prompt}",
        referenceAnswer: "{referenceAnswer}",
        studentAnswer: "{studentAnswer}",
        maxPoints: 10,
      }).systemPrompt;

    case "subjectiveGrade":
      return buildSubjectiveGradePrompt({
        strictnessLevel: "MODERATE",
        prompt: "{prompt}",
        rubric: [],
        studentAnswerText: "",
      }).systemPrompt;

    case "studyBuddy":
      return buildStudyBuddyReplyPrompt({
        modePrompt: SOCRATIC_MODE_PROMPT,
        fallbackInstructions: "这是一个任务相关提问。请围绕该任务或课程内容回答。",
        materialInstructions:
          "优先使用下方教师补充课程素材；如素材不直接覆盖问题，再用通用金融知识补充并明确推断边界。",
        hasMaterial: false,
        conversationHistory: "",
      }).systemPrompt;

    case "insights":
      return buildInsightsAggregatePrompt({
        instanceTitle: "{instanceTitle}",
        taskType: "{taskType}",
        evaluations: [],
      }).systemPrompt;

    case "weeklyInsight":
      return buildWeeklyInsightPrompt({
        windowStart: new Date(0),
        windowEnd: new Date(0),
        submissions: [],
        upcomingSlots: [],
      }).systemPrompt;

    case "lessonPolish":
    case "ideologyMining":
    case "questionAnalysis":
    case "examCheck":
      return buildWorkAssistantPrompt({
        toolKey: toolKey as WorkAssistantToolKey,
        materialText: "",
        teacherRequest: "",
        outputStyle: "structured",
        strictness: "balanced",
        fileReports: [],
      }).systemPrompt;

    default:
      return "";
  }
}

export function getToolPromptPreview(toolKey: string): string {
  const fullPrompt = getToolSystemPrompt(toolKey);
  if (!fullPrompt) return "（预览暂不可用）";
  return truncatePromptPreview(fullPrompt);
}
