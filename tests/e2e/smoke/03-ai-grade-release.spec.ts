import { test, expect } from "@playwright/test";
import { loginAs, getOwnClassId, cleanupPublishedTaskAndInstance } from "./_setup";

/**
 * Smoke 03: teacher 手动 grade + release submission → student 看到 score.
 *
 * 关键：teacher 选 course 时必须 match student1's classId (同 smoke-02).
 * 不调真 AI grade (依赖 provider key + 网络慢), 走 teacher 手动 grade 主线契约.
 */
test("smoke-03 teacher 手动 grade + release → student 看到分数", async ({ browser }) => {
  // student 先登录拿 classId
  const studentPage = await loginAs(browser, "student1");
  const sr = studentPage.request;
  const studentClassId = await getOwnClassId(sr);
  expect(studentClassId).toBeTruthy();

  const teacherPage = await loginAs(browser, "teacher1");
  const tr = teacherPage.request;

  const coursesRes = await tr.get("/api/lms/courses?take=50");
  const coursesJson = await coursesRes.json();
  const courses: Array<{ id: string; classId: string | null }> =
    coursesJson.data?.items ?? coursesJson.data ?? [];
  const course = courses.find((c) => c.classId === studentClassId);
  if (!course) throw new Error(`seed 缺 teacher1 course matching ${studentClassId}`);

  const taskName = `smoke-03-sub-${Date.now()}`;
  const createTaskRes = await tr.post("/api/tasks", {
    data: {
      taskType: "subjective",
      taskName,
      subjectiveConfig: {
        prompt: "smoke 测试: 请回答下方主观题",
        allowedAttachmentTypes: [],
      },
      scoringCriteria: [{ name: "总评", maxPoints: 100, order: 0 }],
    },
  });
  expect(createTaskRes.status()).toBe(201);
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
  expect(createInstRes.status()).toBe(201);
  const instanceId = (await createInstRes.json()).data.id;
  const pubRes = await tr.post(`/api/lms/task-instances/${instanceId}/publish`);
  expect(pubRes.status()).toBe(200);

  // student 提交
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
  // Prisma Decimal 序列化为 string，用 Number() 归一化比较
  expect(Number(studentJson.data.score)).toBe(85);

  // cleanup
  await cleanupPublishedTaskAndInstance(tr, taskId, instanceId, [submissionId]);
});
