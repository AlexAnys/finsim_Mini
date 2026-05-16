import { test, expect } from "@playwright/test";
import { loginAs, cleanupPublishedTaskAndInstance } from "./_setup";

/**
 * Smoke 01: teacher1 登录 → API create task → create instance → publish → assert published.
 *
 * 不依赖 molly 演示数据, 全程自给自足 + 自清理.
 */
test("smoke-01 teacher 建任务 → 建实例 → publish", async ({ browser }) => {
  const page = await loginAs(browser, "teacher1");
  const r = page.request;

  // 找一个 teacher1 拥有的 course + classId (seed: 王教授 → 金融2024A班)
  const coursesRes = await r.get("/api/lms/courses?take=20");
  expect(coursesRes.ok()).toBeTruthy();
  const coursesJson = await coursesRes.json();
  expect(coursesJson.success).toBe(true);
  const courses: Array<{ id: string; classId: string | null }> =
    coursesJson.data?.items ?? coursesJson.data ?? [];
  const course = courses.find((c) => c.classId);
  if (!course) {
    throw new Error("seed 未含 teacher1 的 course + classId — 检查 npm run db:seed");
  }

  const taskName = `smoke-01-task-${Date.now()}`;
  const createTaskRes = await r.post("/api/tasks", {
    data: {
      taskType: "subjective",
      taskName,
      requirements: "smoke 测试用主观题",
      subjectiveConfig: {
        prompt: "smoke 测试: 请回答下方主观题",
        allowedAttachmentTypes: [],
      },
      scoringCriteria: [
        { name: "完整性", maxPoints: 50, order: 0 },
        { name: "准确性", maxPoints: 50, order: 1 },
      ],
    },
  });
  expect(createTaskRes.status()).toBe(201);
  const taskJson = await createTaskRes.json();
  expect(taskJson.success).toBe(true);
  const taskId = taskJson.data.id;

  const dueAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  const createInstRes = await r.post("/api/lms/task-instances", {
    data: {
      title: `${taskName}-instance`,
      taskId,
      taskType: "subjective",
      classId: course.classId,
      courseId: course.id,
      dueAt,
    },
  });
  expect(createInstRes.status()).toBe(201);
  const instJson = await createInstRes.json();
  expect(instJson.success).toBe(true);
  const instanceId = instJson.data.id;

  // publish
  const pubRes = await r.post(`/api/lms/task-instances/${instanceId}/publish`);
  expect(pubRes.status()).toBe(200);
  const pubJson = await pubRes.json();
  expect(pubJson.success).toBe(true);
  expect(pubJson.data.status).toBe("published");

  // cleanup (published 实例 必须先 close 再 delete; task 必须等 instance 删完)
  await cleanupPublishedTaskAndInstance(r, taskId, instanceId);
});
