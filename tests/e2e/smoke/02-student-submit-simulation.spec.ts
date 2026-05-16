import { test, expect } from "@playwright/test";
import { loginAs } from "./_setup";

/**
 * Smoke 02: teacher1 建 simulation task + instance + publish → student1 submit → assert created.
 *
 * 端到端验证 task → instance → publish → submission 链路. 不依赖 molly seed.
 */
test("smoke-02 teacher 建 sim → student 提交", async ({ browser }) => {
  const teacherPage = await loginAs(browser, "teacher1");
  const tr = teacherPage.request;

  const coursesRes = await tr.get("/api/lms/courses?take=20");
  const coursesJson = await coursesRes.json();
  const course = (coursesJson.data?.items ?? coursesJson.data ?? []).find(
    (c: { id: string; classId: string | null }) => c.classId,
  );
  if (!course) throw new Error("seed 缺 teacher1 course");

  const taskName = `smoke-02-sim-${Date.now()}`;
  const createTaskRes = await tr.post("/api/tasks", {
    data: {
      taskType: "simulation",
      taskName,
      requirements: "smoke sim",
      simulationConfig: {
        rounds: 3,
        timeLimitSeconds: 600,
      },
      scoringCriteria: [{ name: "总体表现", maxPoints: 100, order: 0 }],
    },
  });
  expect(createTaskRes.status()).toBe(201);
  const taskId = (await createTaskRes.json()).data.id;

  const dueAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  const createInstRes = await tr.post("/api/lms/task-instances", {
    data: {
      title: `${taskName}-inst`,
      taskId,
      taskType: "simulation",
      classId: course.classId,
      courseId: course.id,
      dueAt,
    },
  });
  expect(createInstRes.status()).toBe(201);
  const instanceId = (await createInstRes.json()).data.id;

  const pubRes = await tr.post(`/api/lms/task-instances/${instanceId}/publish`);
  expect(pubRes.status()).toBe(200);

  // student1 提交
  const studentPage = await loginAs(browser, "student1");
  const sr = studentPage.request;
  const submitRes = await sr.post("/api/submissions", {
    data: {
      taskType: "simulation",
      taskId,
      taskInstanceId: instanceId,
      dialogue: [
        { role: "user", content: "smoke 测试 user 1" },
        { role: "assistant", content: "smoke 测试 ai 1" },
        { role: "user", content: "smoke 测试 user 2" },
      ],
    },
  });
  expect([200, 201]).toContain(submitRes.status());
  const submitJson = await submitRes.json();
  expect(submitJson.success).toBe(true);
  const submissionId = submitJson.data?.id;
  expect(submissionId).toBeTruthy();

  // cleanup (teacher 删 instance 会连带删 submission, 但保险删 submission 先)
  await tr.delete(`/api/submissions/${submissionId}`).catch(() => {});
  await tr.delete(`/api/lms/task-instances/${instanceId}`).catch(() => {});
  await tr.delete(`/api/tasks/${taskId}`).catch(() => {});
});
