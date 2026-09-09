import { randomUUID } from "node:crypto";
import { test, expect, api, answerDocx, createPublished, gradeRow, mockControl, mockURL, objectiveQuestion } from "./fixtures";

test("teacher UI publishes an attachment task; student upload reaches grading, then release/retract/restore", async ({ pilot }) => {
  const { teacher, student, stranger, db } = pilot;
  const invalidName = pilot.prefix + "-缺评分标准";
  const rejected = await teacher.request.post("/api/lms/task-instances/with-task", { data: {
    task: { taskType: "subjective", taskName: invalidName, subjectiveConfig: { prompt: "没有评分标准不能发布" } },
    instance: { title: invalidName, courseId: pilot.courseId, classId: pilot.classId, dueAt: new Date(Date.now() + 86400_000).toISOString() },
  } });
  expect(rejected.status()).toBe(400);
  expect((await rejected.json()).error.code).toBe("TASK_RUBRIC_REQUIRED");
  expect(await db.taskInstance.count({ where: { courseId: pilot.courseId } })).toBe(0);
  expect(await db.task.count({ where: { taskName: invalidName } })).toBe(0);
  await teacher.goto(`/teacher/courses/${pilot.courseId}`);
  await expect(teacher.getByRole("heading", { name: pilot.prefix, exact: true })).toBeVisible();
  if (await teacher.getByRole("button", { name: "展开章节", exact: true }).count()) await teacher.getByRole("button", { name: "展开章节", exact: true }).first().click();
  await teacher.getByRole("button", { name: "在课前添加任务", exact: true }).click();
  const dialog = teacher.getByRole("dialog");
  await dialog.getByRole("button", { name: /主观题/ }).click();
  await dialog.getByRole("button", { name: "下一步", exact: true }).click();
  await dialog.getByLabel("任务名称").fill(pilot.prefix + "-附件作业");
  await dialog.getByRole("button", { name: "下一步", exact: true }).click();
  await dialog.getByLabel("题目内容").fill("说明分散投资与风险的关系，完整论证可放在附件。");
  await dialog.getByRole("button", { name: "开启", exact: true }).click();
  if (!(await dialog.getByPlaceholder("例如：论述逻辑").count())) await dialog.getByRole("button", { name: "添加标准", exact: true }).click();
  await dialog.getByPlaceholder("例如：论述逻辑").first().fill("论述准确性");
  await dialog.getByRole("button", { name: "下一步", exact: true }).click();
  const published = teacher.waitForResponse(r => r.url().endsWith("/api/lms/task-instances/with-task") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "创建并发布", exact: true }).click();
  const publishResponse = await published; expect(publishResponse.ok()).toBeTruthy();
  const instance = await db.taskInstance.findFirstOrThrow({ where: { courseId: pilot.courseId } });
  expect(instance.status).toBe("published");

  const marker = `附件证据${randomUUID()}：分散投资降低非系统性风险，但不保证收益。`;
  await student.goto(`/tasks/${instance.id}`);
  await student.locator("textarea").first().fill("完整论证详见附件。");
  const uploaded = student.waitForResponse(r => r.url().includes("/api/files/upload") && r.request().method() === "POST");
  await student.locator('input[type="file"]').setInputFiles({ name: pilot.prefix + "-answer.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: await answerDocx(marker) });
  expect((await uploaded).ok()).toBeTruthy();
  await expect(student.getByText(pilot.prefix + "-answer.docx", { exact: true })).toBeVisible();
  await student.getByRole("button", { name: "提交", exact: true }).click();
  const row = await gradeRow(pilot, instance.id);
  expect(Number(row.score)).toBeGreaterThan(0); expect(row.releasedAt).toBeNull();
  const detail = await db.subjectiveSubmission.findUniqueOrThrow({ where: { submissionId: row.id } });
  expect(detail.extractedText).toContain(marker);
  const calls = await (await fetch(mockURL + "/_requests")).json();
  expect(JSON.stringify(calls)).toContain(marker);
  expect((await api(student.request, "get", `/api/submissions/${row.id}`)).score).toBeNull();
  const otherTeacher = await api(stranger.request, "get", `/api/submissions?studentId=${pilot.studentId}`);
  expect(otherTeacher.items.some((item: { id: string }) => item.id === row.id)).toBe(false);
  expect((await stranger.request.get(`/api/submissions/${row.id}`)).status()).toBe(403);

  await api(teacher.request, "post", `/api/submissions/${row.id}/release`, { released: true });
  const shown = await api(student.request, "get", `/api/submissions/${row.id}`);
  expect(Number(shown.score)).toBe(Number(row.score));
  await student.goto("/grades"); await expect(student.getByText(pilot.prefix + "-附件作业", { exact: true }).first()).toBeVisible();
  await api(teacher.request, "post", `/api/submissions/${row.id}/release`, { released: false });
  expect((await api(student.request, "get", `/api/submissions/${row.id}`)).score).toBeNull();
  expect((await db.submission.findUniqueOrThrow({ where: { id: row.id } })).releaseSuppressedAt).not.toBeNull();
  await api(teacher.request, "delete", `/api/submissions/${row.id}`);
  expect((await db.submission.findUniqueOrThrow({ where: { id: row.id } })).deletedAt).not.toBeNull();
  expect([403, 404]).toContain((await student.request.get(`/api/submissions/${row.id}`)).status());
  await teacher.goto(`/teacher/instances/${instance.id}`);
  await teacher.getByRole("tab", { name: /提交/ }).click();
  await teacher.getByRole("button", { name: "查看已删除提交 / 恢复", exact: true }).click();
  await teacher.getByRole("button", { name: "恢复提交", exact: true }).click();
  await expect.poll(async () => (await db.submission.findUniqueOrThrow({ where: { id: row.id } })).deletedAt).toBeNull();
  expect(Number((await db.submission.findUniqueOrThrow({ where: { id: row.id } })).score)).toBe(Number(row.score));
});

test("fixed quiz hides answers, grades its displayed snapshot, and replays one request id once", async ({ pilot }) => {
  const question = objectiveQuestion("旧快照：分散投资的主要作用是什么？");
  const instance = await createPublished(pilot, { taskType: "quiz", quizConfig: { mode: "fixed", showCorrectAnswer: false }, quizQuestions: [question] });
  const full = await api(pilot.teacher.request, "get", `/api/lms/task-instances/${instance.id}`);
  for (const path of [`/api/tasks/${full.taskId}`, `/api/lms/task-instances/${instance.id}`]) {
    const data = await api(pilot.student.request, "get", path);
    expect(JSON.stringify(data)).not.toMatch(/correctOptionIds|correctAnswer|不得提前泄露的解析/);
  }
  const qid = full.taskSnapshot.quizQuestions[0].id;
  expect((await pilot.student.request.post(`/api/lms/quiz-questions/${qid}/check`, { data: { taskInstanceId: instance.id, selectedOptionIds: [] } })).ok()).toBe(false);
  await api(pilot.teacher.request, "patch", `/api/tasks/${full.taskId}`, { quizQuestions: [objectiveQuestion("新的模板题，不应该出现在旧实例")] });
  await pilot.student.goto(`/tasks/${instance.id}`);
  await expect(pilot.student.getByText(question.prompt, { exact: true })).toBeVisible();
  await pilot.student.getByRole("radio", { name: /分散风险/ }).check();
  const submitted = pilot.student.waitForResponse(r => r.url().endsWith("/api/submissions") && r.request().method() === "POST");
  await pilot.student.getByRole("button", { name: "提交答卷", exact: true }).click();
  const response = await submitted; expect(response.ok()).toBeTruthy();
  const requestPayload = response.request().postDataJSON();
  const row = await gradeRow(pilot, instance.id);
  expect(Number(row.score)).toBe(2); expect(Number(row.maxScore)).toBe(2);
  const replay = await api(pilot.student.request, "post", "/api/submissions", requestPayload);
  expect(replay.id).toBe(row.id);
  expect(await pilot.db.submission.count({ where: { taskInstanceId: instance.id } })).toBe(1);
});

test("adaptive student UI stops at two issued questions and receives 4/4 from a five-question bank", async ({ pilot }) => {
  const instance = await createPublished(pilot, { taskType: "quiz", quizConfig: { mode: "adaptive", maxQuestions: 2, startDifficulty: 1, difficultyStep: 1 }, quizQuestions: Array.from({ length: 5 }, (_, i) => objectiveQuestion(`自适应第${i + 1}题：分散投资的作用？`, i)) });
  await pilot.student.goto(`/tasks/${instance.id}`);
  for (let i = 0; i < 2; i++) {
    await pilot.student.getByRole("radio", { name: /分散风险/ }).check();
    await pilot.student.getByRole("button", { name: "提交本题", exact: true }).click();
    if (i === 0) await expect(pilot.student.getByText(/第 2 题/)).toBeVisible();
  }
  await pilot.student.getByRole("button", { name: "提交答卷", exact: true }).click();
  const row = await gradeRow(pilot, instance.id);
  expect(Number(row.score)).toBe(4); expect(Number(row.maxScore)).toBe(4);
  const attempt = await pilot.db.quizAttempt.findFirstOrThrow({ where: { taskInstanceId: instance.id } });
  expect(attempt.issuedQuestionIds).toHaveLength(2); expect(attempt.completedAt).not.toBeNull();
});

test("simulation exchanges a real streamed UI turn and persists/grades the submitted conversation", async ({ pilot }) => {
  const instance = await createPublished(pilot, { taskType: "simulation", simulationConfig: { scenario: "为客户配置应急储备与分散投资", openingLine: "我有一笔存款，希望先了解风险。" }, scoringCriteria: [{ name: "风险解释", maxPoints: 100, order: 0 }] });
  await pilot.student.goto(`/sim/${instance.id}`);
  const composer = pilot.student.getByPlaceholder("继续对话…（Enter 发送，Shift + Enter 换行）");
  await composer.fill("我建议先留出六个月应急资金，再分散配置资产并解释期限和风险。");
  await pilot.student.getByRole("button", { name: /^发送/ }).click();
  await expect(pilot.student.getByText(/我希望先保留应急资金/).first()).toBeVisible();
  await pilot.student.getByRole("button", { name: "结束对话", exact: true }).click();
  const row = await gradeRow(pilot, instance.id);
  expect(Number(row.score)).toBe(80); expect(Number(row.maxScore)).toBe(100);
  const saved = await pilot.db.simulationSubmission.findUniqueOrThrow({ where: { submissionId: row.id } });
  expect(JSON.stringify(saved.transcript)).toContain("六个月应急资金");
});

test("provider failure leaves short-answer grading failed and unreleased; teacher retry recovers", async ({ pilot }) => {
  const instance = await createPublished(pilot, { taskType: "quiz", quizConfig: { mode: "fixed" }, quizQuestions: [{ type: "short_answer", prompt: "说明风险与收益的关系。", correctAnswer: "预期收益通常与风险相关。", points: 3, order: 0 }] });
  await api(pilot.teacher.request, "patch", `/api/lms/task-instances/${instance.id}/release-config`, { releaseMode: "auto", autoReleaseAt: null });
  await mockControl({ mode: "error", statusCode: 503 });
  await pilot.student.goto(`/tasks/${instance.id}`);
  await pilot.student.getByPlaceholder("请输入你的答案...").fill("预期收益通常与风险相关，不能把高收益视作保本承诺。");
  await pilot.student.getByRole("button", { name: "提交答卷", exact: true }).click();
  const failed = await gradeRow(pilot, instance.id, "failed");
  expect(failed.releasedAt).toBeNull();
  expect((await api(pilot.student.request, "get", `/api/submissions/${failed.id}`)).score).toBeNull();
  await mockControl({ reset: true });
  await api(pilot.teacher.request, "post", `/api/submissions/${failed.id}/retry-grade`);
  const recovered = await gradeRow(pilot, instance.id);
  expect(Number(recovered.score)).toBe(3); expect(Number(recovered.maxScore)).toBe(3);
});

test("first submission request survives twenty real concurrent deliveries with one row and one job", async ({ pilot }, info) => {
  const instance = await createPublished(pilot, { taskType: "quiz", quizConfig: { mode: "fixed" }, quizQuestions: [objectiveQuestion("幂等并发：分散投资的作用是什么？")] });
  const full = await api(pilot.teacher.request, "get", `/api/lms/task-instances/${instance.id}`);
  const payload = { requestId: randomUUID(), taskType: "quiz", taskId: full.taskId, taskInstanceId: instance.id, taskVersion: full.contentVersion, answers: [{ questionId: full.taskSnapshot.quizQuestions[0].id, selectedOptionIds: ["A"] }] };
  const replies = await Promise.all(Array.from({ length: 20 }, async () => {
    const response = await pilot.student.request.post("/api/submissions", { data: payload });
    return { status: response.status(), body: await response.json() };
  }));
  await info.attach("twenty-concurrent-responses", { body: JSON.stringify(replies, null, 2), contentType: "application/json" });
  expect(replies.every(reply => [200, 201].includes(reply.status) && reply.body.success === true)).toBe(true);
  const ids = new Set(replies.map(reply => reply.body.data.id)); expect(ids.size).toBe(1);
  const row = await gradeRow(pilot, instance.id);
  expect(await pilot.db.submission.count({ where: { taskInstanceId: instance.id } })).toBe(1);
  expect(await pilot.db.asyncJob.count({ where: { entityId: row.id, type: "submission_grade" } })).toBe(1);
});
