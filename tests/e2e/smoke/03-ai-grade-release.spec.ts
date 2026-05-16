import { test, expect } from "@playwright/test";
import { loginAs } from "./_setup";

/**
 * Smoke 03: teacher 手动 grade + release submission → student 看到 score.
 *
 * 不调真 AI provider (AI 调用对外网/key 依赖大), 用 teacher 手动 grade POST {score, maxScore}.
 * 既覆盖 grade + release 主线又稳定不挂在 AI provider 上.
 */
test("smoke-03 teacher 手动 grade + release → student 看到分数", async ({ browser }) => {
  const teacherPage = await loginAs(browser, "teacher1");
  const tr = teacherPage.request;

  const coursesRes = await tr.get("/api/lms/courses?take=20");
  const coursesJson = await coursesRes.json();
  const course = (coursesJson.data?.items ?? coursesJson.data ?? []).find(
    (c: { id: string; classId: string | null }) => c.classId,
  );
  if (!course) throw new Error("seed 缺 teacher1 course");

  const taskName = `smoke-03-sub-${Date.now()}`;
  const createTaskRes = await tr.post("/api/tasks", {
    data: {
      taskType: "subjective",
      taskName,
      subjectiveConfig: { wordLimit: 100, allowedAttachmentTypes: [] },
      scoringCriteria: [{ name: "总评", maxPoints: 100, order: 0 }],
    },
  });
  const taskId = (await createTaskRes.json()).data.id;

  const dueAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  const createInstRes = await tr.post("/api/lms/task-instances", {
    data: {
      title: `${taskName}-inst`,
      taskId,
      taskType: "subjective",
      classId: course.classId,
      courseId: course.id,
      dueAt,
    },
  });
  const instanceId = (await createInstRes.json()).data.id;
  await tr.post(`/api/lms/task-instances/${instanceId}/publish`);

  // student 提交
  const studentPage = await loginAs(browser, "student1");
  const sr = studentPage.request;
  const submitRes = await sr.post("/api/submissions", {
    data: {
      taskType: "subjective",
      taskId,
      taskInstanceId: instanceId,
      textAnswer: "smoke 03 学生主观题答案。理财应分散投资，注意流动性配置。",
      attachments: [],
    },
  });
  expect([200, 201]).toContain(submitRes.status());
  const submissionId = (await submitRes.json()).data.id;

  // teacher 手动 grade
  const gradeRes = await tr.post(`/api/submissions/${submissionId}/grade`, {
    data: { score: 85, maxScore: 100, feedback: "smoke 测试评语" },
  });
  expect(gradeRes.status()).toBe(200);
  expect((await gradeRes.json()).success).toBe(true);

  // release
  const releaseRes = await tr.post(`/api/submissions/${submissionId}/release`, {
    data: { released: true },
  });
  expect(releaseRes.status()).toBe(200);

  // student 拿到分数
  const studentViewRes = await sr.get(`/api/submissions/${submissionId}`);
  expect(studentViewRes.status()).toBe(200);
  const studentJson = await studentViewRes.json();
  expect(studentJson.success).toBe(true);
  expect(studentJson.data.score).toBe(85);

  // cleanup
  await tr.delete(`/api/submissions/${submissionId}`).catch(() => {});
  await tr.delete(`/api/lms/task-instances/${instanceId}`).catch(() => {});
  await tr.delete(`/api/tasks/${taskId}`).catch(() => {});
});
