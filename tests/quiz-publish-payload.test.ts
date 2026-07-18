import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { createPublishedTaskWithInstanceSchema } from "@/lib/validators/task.schema";
import {
  buildQuizQuestionPayload,
  isQuizQuestionComplete,
  normalizeStoredQuizOptions,
} from "@/lib/utils/quiz-question-payload";

const auditQuestion = {
  type: "single_choice" as const,
  stem: "以下哪一项属于个人理财中流动性最强的资产？",
  options: [
    { id: "A", text: "活期存款" },
    { id: "B", text: "自住房产" },
    { id: "C", text: "十年期国债" },
    { id: "D", text: "" },
  ],
  correctOptionIds: ["A"],
  correctAnswer: "",
  points: 1,
  explanation: "",
};

describe("quiz 发布 payload", () => {
  it("忽略未填写的可选槽位，已有答案时不误报缺失", () => {
    expect(isQuizQuestionComplete(auditQuestion)).toBe(true);
  });

  it("过滤空选项后可通过 with-task 的原服务端 schema", () => {
    const quizQuestion = buildQuizQuestionPayload(auditQuestion, 0);
    const multipleQuestion = buildQuizQuestionPayload(
      {
        ...auditQuestion,
        type: "multiple_choice",
        stem: "下列哪些属于固定支出？",
        correctOptionIds: ["A", "B"],
      },
      1,
    );
    expect(quizQuestion.options).toEqual([
      { id: "A", text: "活期存款" },
      { id: "B", text: "自住房产" },
      { id: "C", text: "十年期国债" },
    ]);

    const parsed = createPublishedTaskWithInstanceSchema.safeParse({
      task: {
        taskType: "quiz",
        taskName: "ZZAUDIT 客观题小测",
        quizConfig: { mode: "fixed", showCorrectAnswer: true },
        quizQuestions: [quizQuestion, multipleQuestion],
      },
      instance: {
        title: "ZZAUDIT 客观题小测",
        classId: "00000000-0000-4000-8000-000000000001",
        courseId: "00000000-0000-4000-8000-000000000002",
        chapterId: "00000000-0000-4000-8000-000000000003",
        sectionId: "00000000-0000-4000-8000-000000000004",
        slot: "in",
        dueAt: "2026-07-29T00:00:00.000Z",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("真正缺少有效选项或正确答案时仍阻止发布", () => {
    expect(
      isQuizQuestionComplete({
        ...auditQuestion,
        options: [
          { id: "A", text: "唯一选项" },
          { id: "B", text: "" },
        ],
      }),
    ).toBe(false);
    expect(isQuizQuestionComplete({ ...auditQuestion, correctOptionIds: [] })).toBe(false);
  });

  it("判断题发布为固定的正确/错误选项", () => {
    expect(
      buildQuizQuestionPayload(
        {
          ...auditQuestion,
          type: "true_false",
          options: auditQuestion.options.map((option) => ({ ...option, text: "" })),
          correctOptionIds: ["A"],
        },
        0,
      ).options,
    ).toEqual([
      { id: "A", text: "正确" },
      { id: "B", text: "错误" },
    ]);
  });

  it("向导消费 payload seam，并提供可读的缺失内容提示", () => {
    const here = fileURLToPath(import.meta.url);
    const modal = fs.readFileSync(
      path.join(path.dirname(path.dirname(here)), "components/teacher-course-edit/task-wizard-modal.tsx"),
      "utf8",
    );
    expect(modal).toContain("form.questions.map(buildQuizQuestionPayload)");
    expect(modal).toContain("!isQuizQuestionComplete(question)");
    expect(modal).toContain("任务内容不完整，请检查题目、选项和正确答案");
  });
});

describe("教师端 quiz 选项兼容", () => {
  it("把历史 {label,content} 归一为页面使用的 {id,text}", () => {
    expect(
      normalizeStoredQuizOptions([
        { label: "A", content: "设定财务目标" },
        { label: "B", content: "评估财务状况" },
      ]),
    ).toEqual([
      { id: "A", text: "设定财务目标" },
      { id: "B", text: "评估财务状况" },
    ]);
  });

  it("教师详情页在数据入口消费归一化函数", () => {
    const here = fileURLToPath(import.meta.url);
    const page = fs.readFileSync(
      path.join(path.dirname(path.dirname(here)), "app/teacher/tasks/[id]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("normalizeStoredQuizOptions(q.options)");
  });
});
