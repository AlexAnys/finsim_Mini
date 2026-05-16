import { test, expect } from "@playwright/test";
import { loginAs, getOwnClassId, cleanupPublishedTaskAndInstance } from "./_setup";

/**
 * Smoke 02: teacher1 建 simulation task + instance + publish → student1 submit → assert created.
 *
 * 关键：teacher 选 course 时必须 match student1's classId (seed 后 student1 ∈ 金融2024A班),
 * 否则 publish 后 student 提交会触发 assertTaskInstanceReadable 403.
 */
test("smoke-02 teacher 建 sim → student 提交", async ({ browser }) => {
  // student 先登录拿 classId，确保 teacher 后续选对 course
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
  if (!course) {
    throw new Error(
      `seed 缺 teacher1 的 course matching student1.classId=${studentClassId}`,
    );
  }

  const taskName = `smoke-02-sim-${Date.now()}`;
  const createTaskRes = await tr.post("/api/tasks", {
    data: {
      taskType: "simulation",
      taskName,
      requirements: "smoke sim",
      simulationConfig: {
        scenario: "smoke 测试场景: 跟客户讨论分散投资策略",
        openingLine: "您好，今天想了解一下分散投资？",
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

  // student1 提交 (transcript shape per createSimulationSubmissionSchema)
  const submitRes = await sr.post("/api/submissions", {
    data: {
      taskType: "simulation",
      taskId,
      taskInstanceId: instanceId,
      transcript: [
        { id: "m1", role: "student", text: "smoke 测试 user 1", timestamp: new Date().toISOString() },
        { id: "m2", role: "ai", text: "smoke 测试 ai 1", timestamp: new Date().toISOString() },
      ],
    },
  });
  expect([200, 201]).toContain(submitRes.status());
  const submitJson = await submitRes.json();
  expect(submitJson.success).toBe(true);
  const submissionId = submitJson.data?.id;
  expect(submissionId).toBeTruthy();

  // cleanup (close → delete instance → delete task; submission 先单删保险)
  await cleanupPublishedTaskAndInstance(tr, taskId, instanceId, [submissionId]);
});
