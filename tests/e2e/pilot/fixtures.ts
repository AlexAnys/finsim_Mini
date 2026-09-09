import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { test as base, expect, type Page, type APIRequestContext, type Browser } from "@playwright/test";
import JSZip from "jszip";

export const mockURL = "http://127.0.0.1:3189";
export async function mockControl(data: Record<string, unknown>) {
  const response = await fetch(mockURL + "/_control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  expect(response.ok).toBeTruthy();
}
export async function api(request: APIRequestContext, method: "get" | "post" | "patch" | "delete", path: string, data?: unknown) {
  const response = await request[method](path, data === undefined ? undefined : { data });
  const body = await response.json();
  expect(response.ok(), `${method} ${path}: ${JSON.stringify(body)}`).toBeTruthy();
  expect(body.success).toBe(true); return body.data;
}
export async function login(browser: Browser, email: string) {
  const context = await browser.newContext({ baseURL: process.env.PILOT_BASE_URL || "http://127.0.0.1:3107" }); const page = await context.newPage();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  return page;
}
export async function answerDocx(text: string) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>');
  return zip.generateAsync({ type: "nodebuffer" });
}
export type Pilot = { db: PrismaClient; teacher: Page; student: Page; stranger: Page; courseId: string; classId: string; chapterId: string; sectionId: string; studentId: string; prefix: string };
export const test = base.extend<{ pilot: Pilot }>({
  pilot: async ({ browser }, runFixture, info) => {
    const databaseURL = process.env.PILOT_DATABASE_URL;
    if (!databaseURL) throw new Error("PILOT_DATABASE_URL must explicitly target isolated finsim_pilot");
    const dbURL = new URL(databaseURL);
    if (!["127.0.0.1", "localhost"].includes(dbURL.hostname) || dbURL.port !== "55439" || dbURL.pathname !== "/finsim_pilot") throw new Error("Refusing to write outside the isolated pilot database");
    const identity = await (await fetch((process.env.PILOT_BASE_URL || "http://127.0.0.1:3107") + "/api/version")).json();
    const expectedDbHash = createHash("sha256").update(JSON.stringify({ host: dbURL.hostname === "localhost" ? "127.0.0.1" : dbURL.hostname, port: dbURL.port || "5432", database: dbURL.pathname })).digest("hex");
    expect(identity.data?.app).toBe("finsim"); expect(identity.data?.databaseHash).toBe(expectedDbHash);
    await info.attach("environment-identity", { body: JSON.stringify({ ...identity.data, aiSource: "loopback protocol fixture 127.0.0.1:3189; no model-quality claim" }), contentType: "application/json" });
    const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
    const [teacher, student, stranger] = await Promise.all([login(browser, "teacher1@finsim.edu.cn"), login(browser, "student1@finsim.edu.cn"), login(browser, "teacher2@finsim.edu.cn")]);
    const me = await api(student.request, "get", "/api/users/me");
    const prefix = `pilot-${randomUUID()}`;
    const course = await api(teacher.request, "post", "/api/lms/courses", { courseTitle: prefix, classId: me.classId });
    const chapter = await api(teacher.request, "post", "/api/lms/chapters", { courseId: course.id, title: "第一章", order: 0 });
    const section = await api(teacher.request, "post", "/api/lms/sections", { courseId: course.id, chapterId: chapter.id, title: "第一节", order: 0 });
    await mockControl({ reset: true });
    try {
      await runFixture({ db, teacher, student, stranger, courseId: course.id, classId: me.classId, chapterId: chapter.id, sectionId: section.id, studentId: me.id, prefix });
    } finally {
      const ownCourse = await db.course.findUnique({ where: { id: course.id } });
      if (ownCourse?.courseTitle !== prefix) throw new Error("Fixture ownership changed; refusing cleanup");
      const instances = await db.taskInstance.findMany({ where: { courseId: course.id }, select: { id: true, taskId: true } });
      const ids = instances.map(row => row.id); const taskIds = instances.map(row => row.taskId);
      const submissions = await db.submission.findMany({ where: { taskInstanceId: { in: ids } }, select: { id: true, status: true, score: true, maxScore: true, releasedAt: true, deletedAt: true } });
      await info.attach("owned-fixture-results", { body: JSON.stringify({ courseId: course.id, submissions }, null, 2), contentType: "application/json" });
      const subIds = submissions.map(row => row.id);
      await db.asyncJob.deleteMany({ where: { entityId: { in: subIds } } });
      await db.submission.deleteMany({ where: { id: { in: subIds } } });
      await db.quizAttempt.deleteMany({ where: { taskInstanceId: { in: ids } } });
      await db.taskInstance.deleteMany({ where: { id: { in: ids } } });
      await db.task.deleteMany({ where: { id: { in: taskIds } } });
      await db.section.deleteMany({ where: { courseId: course.id } });
      await db.chapter.deleteMany({ where: { courseId: course.id } });
      await db.courseClass.deleteMany({ where: { courseId: course.id } });
      await db.courseTeacher.deleteMany({ where: { courseId: course.id } });
      await db.course.delete({ where: { id: course.id } });
      await db.fileUpload.deleteMany({ where: { ownerId: me.id, fileName: { startsWith: prefix } } });
      await Promise.all([teacher.context().close(), student.context().close(), stranger.context().close()]);
      await db.$disconnect(); await mockControl({ reset: true });
    }
  },
});
export { expect };
export async function createPublished(pilot: Pilot, task: Record<string, unknown>) {
  const created = await api(pilot.teacher.request, "post", "/api/lms/task-instances/with-task", {
    task: { taskName: pilot.prefix, ...task },
    instance: { title: pilot.prefix, courseId: pilot.courseId, classId: pilot.classId, chapterId: pilot.chapterId, sectionId: pilot.sectionId, dueAt: new Date(Date.now() + 86400_000).toISOString() },
  });
  return created.instance ?? created.taskInstance ?? created;
}
export async function gradeRow(pilot: Pilot, instanceId: string, expectedStatus = "graded") {
  await expect.poll(async () => (await pilot.db.submission.findFirst({ where: { taskInstanceId: instanceId, studentId: pilot.studentId }, orderBy: { submittedAt: "desc" } }))?.status, { timeout: 45_000 }).toBe(expectedStatus);
  return (await pilot.db.submission.findFirstOrThrow({ where: { taskInstanceId: instanceId, studentId: pilot.studentId }, orderBy: { submittedAt: "desc" } }));
}
export const objectiveQuestion = (prompt: string, order = 0) => ({ type: "single_choice", prompt, options: [{ id: "A", text: "分散风险" }, { id: "B", text: "保证盈利" }], correctOptionIds: ["A"], points: 2, difficulty: 1, explanation: "不得提前泄露的解析", order });
