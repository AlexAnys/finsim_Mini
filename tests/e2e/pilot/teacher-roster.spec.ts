import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { test as base, expect, type Page, type APIRequestContext, type TestInfo } from "@playwright/test";
import * as XLSX from "xlsx";
import { compare } from "bcryptjs";
import { api, login } from "./fixtures";

type Roster = {
  db: PrismaClient; teacher: Page; stranger: Page; prefix: string;
  teacherId: string; sourceId: string; targetId: string; foreignId: string;
  students: Array<{ id: string; email: string; name: string }>; outsiderId: string;
};
const test = base.extend<{ roster: Roster }>({
  roster: async ({ browser }, runFixture, info) => {
    const databaseURL = process.env.PILOT_DATABASE_URL;
    if (!databaseURL) throw new Error("Explicit isolated pilot database required");
    const url = new URL(databaseURL);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "55439" || url.pathname !== "/finsim_pilot") {
      throw new Error("Refusing roster writes outside owned local pilot database");
    }
    const identity = await (await fetch("http://127.0.0.1:3107/api/version")).json();
    const hash = createHash("sha256").update(JSON.stringify({ host: "127.0.0.1", port: "55439", database: "/finsim_pilot" })).digest("hex");
    expect(identity.data.databaseHash).toBe(hash);
    await info.attach("environment", { body: JSON.stringify(identity.data), contentType: "application/json" });
    const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
    const prefix = `roster-${randomUUID()}`;
    const owner = await db.user.findUniqueOrThrow({ where: { email: "teacher1@finsim.edu.cn" } });
    const other = await db.user.findUniqueOrThrow({ where: { email: "teacher2@finsim.edu.cn" } });
    const source = await db.class.create({ data: { name: prefix + "-原班", createdBy: owner.id } });
    const target = await db.class.create({ data: { name: prefix + "-目标班", createdBy: owner.id } });
    const foreign = await db.class.create({ data: { name: prefix + "-他人班", createdBy: other.id } });
    await db.user.createMany({ data: Array.from({ length: 25 }, (_, i) => ({
      id: randomUUID(), email: `${prefix}-${i}@example.test`, name: `测试学生${String(i + 1).padStart(2, "0")}`,
      passwordHash: owner.passwordHash, role: "student", classId: source.id,
    })) });
    const students = await db.user.findMany({ where: { classId: source.id }, orderBy: { name: "asc" }, select: { id: true, email: true, name: true } });
    const outsider = await db.user.create({ data: { email: `${prefix}-outsider@example.test`, name: "不能泄露的外班学生", passwordHash: owner.passwordHash, role: "student", classId: foreign.id } });
    const teacher = await login(browser, owner.email);
    const stranger = await login(browser, other.email);
    try {
      await runFixture({ db, teacher, stranger, prefix, teacherId: owner.id, sourceId: source.id, targetId: target.id, foreignId: foreign.id, students, outsiderId: outsider.id });
    } finally {
      const classes = await db.class.findMany({ where: { name: { startsWith: prefix } } });
      if (classes.some(item => !item.name.startsWith(prefix))) throw new Error("Fixture ownership changed");
      const classIds = classes.map(item => item.id);
      const instances = await db.taskInstance.findMany({ where: { classId: { in: classIds } }, select: { id: true, taskId: true } });
      const instanceIds = instances.map(item => item.id);
      await db.submission.deleteMany({ where: { taskInstanceId: { in: instanceIds } } });
      await db.quizAttempt.deleteMany({ where: { taskInstanceId: { in: instanceIds } } });
      await db.taskInstance.deleteMany({ where: { id: { in: instanceIds } } });
      await db.task.deleteMany({ where: { id: { in: instances.map(item => item.taskId) } } });
      const courses = await db.course.findMany({ where: { courseTitle: { startsWith: prefix } }, select: { id: true } });
      const courseIds = courses.map(item => item.id);
      await db.courseClass.deleteMany({ where: { courseId: { in: courseIds } } });
      await db.courseTeacher.deleteMany({ where: { courseId: { in: courseIds } } });
      await db.course.deleteMany({ where: { id: { in: courseIds } } });
      await db.studentGroup.deleteMany({ where: { classId: { in: classIds } } });
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
      await db.class.deleteMany({ where: { id: { in: classIds } } });
      await teacher.context().close(); await stranger.context().close(); await db.$disconnect();
    }
  },
});

const rosterPath = (id: string) => `/api/lms/classes/${id}/roster`;
async function preview(request: APIRequestContext, sourceId: string, input: Record<string, unknown>) {
  return api(request, "post", rosterPath(sourceId), { ...input, preview: true });
}
async function commit(request: APIRequestContext, sourceId: string, input: Record<string, unknown>, token: string) {
  return api(request, "post", rosterPath(sourceId), { ...input, preview: false, previewToken: token });
}
function workbook(rows: Record<string, string>[]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "学生名单");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
async function capture(page: Page, info: TestInfo, name: string) {
  const directory = ".harness/screenshots/teacher-roster";
  await mkdir(directory, { recursive: true });
  await info.attach(name, { body: await page.screenshot({ path: `${directory}/${name}.png` }), contentType: "image/png" });
}

test("class creator transfers 25 students transactionally, creates group once, and replays safely", async ({ roster: r }) => {
  const old = await r.db.studentGroup.create({ data: { teacherId: r.teacherId, classId: r.sourceId, name: "原小组", type: "manual", members: { create: r.students.map(student => ({ studentId: student.id })) } } });
  const input = { mode: "transfer", targetClassId: r.targetId, studentIds: r.students.map(student => student.id), newGroupName: "新组", groupMode: "add" };
  const plan = await preview(r.teacher.request, r.sourceId, input);
  expect(plan.canApply).toBe(true); expect(plan.previewToken).toBeTruthy();
  expect(await r.db.user.count({ where: { classId: r.sourceId } })).toBe(25);
  const done = await commit(r.teacher.request, r.sourceId, input, plan.previewToken);
  expect(done.appliedCount).toBe(25);
  expect(await r.db.user.count({ where: { classId: r.sourceId } })).toBe(0);
  expect(await r.db.user.count({ where: { classId: r.targetId } })).toBe(25);
  expect(await r.db.studentGroupMember.count({ where: { groupId: old.id } })).toBe(0);
  const group = await r.db.studentGroup.findFirstOrThrow({ where: { classId: r.targetId, name: "新组" } });
  expect(await r.db.studentGroupMember.count({ where: { groupId: group.id } })).toBe(25);
  const retry = await commit(r.teacher.request, r.sourceId, input, plan.previewToken);
  expect(retry.appliedCount).toBe(0); expect(retry.skippedCount).toBe(25);
  expect(await r.db.studentGroup.count({ where: { classId: r.targetId, name: "新组" } })).toBe(1);
  const classes = await api(r.teacher.request, "get", "/api/lms/classes");
  expect(classes.find((row: { id: string }) => row.id === r.targetId)._count.students).toBe(25);
});

test("group add preserves memberships, replace changes only the managed group scope", async ({ roster: r }) => {
  const studentIds = r.students.slice(0, 2).map(student => student.id);
  const first = await r.db.studentGroup.create({ data: { teacherId: r.teacherId, classId: r.sourceId, name: "已有组", type: "manual", members: { create: studentIds.map(studentId => ({ studentId })) } } });
  const otherTeacher = await r.db.user.findUniqueOrThrow({ where: { email: "teacher2@finsim.edu.cn" } });
  const otherGroup = await r.db.studentGroup.create({ data: { teacherId: otherTeacher.id, classId: r.sourceId, name: "其他老师小组", type: "manual", members: { create: studentIds.map(studentId => ({ studentId })) } } });
  const input = { mode: "group", targetClassId: r.sourceId, studentIds, newGroupName: "新分组", groupMode: "add" };
  const plan = await preview(r.teacher.request, r.sourceId, input);
  await commit(r.teacher.request, r.sourceId, input, plan.previewToken);
  expect(await r.db.studentGroupMember.count({ where: { groupId: first.id } })).toBe(2);
  expect(await r.db.studentGroupMember.count({ where: { groupId: otherGroup.id } })).toBe(2);
  const added = await r.db.studentGroup.findFirstOrThrow({ where: { classId: r.sourceId, name: "新分组" } });
  const replace = { ...input, newGroupName: undefined, targetGroupId: first.id, groupMode: "replace" };
  const replacement = await preview(r.teacher.request, r.sourceId, replace);
  await commit(r.teacher.request, r.sourceId, replace, replacement.previewToken);
  expect(await r.db.studentGroupMember.count({ where: { groupId: added.id } })).toBe(0);
  expect(await r.db.studentGroupMember.count({ where: { groupId: first.id } })).toBe(2);
  expect(await r.db.studentGroupMember.count({ where: { groupId: otherGroup.id } })).toBe(2);
  expect((await r.teacher.request.post(rosterPath(r.sourceId), { data: { ...replace, targetGroupId: otherGroup.id, preview: true } })).status()).toBe(403);
  expect(await r.db.user.count({ where: { classId: r.sourceId } })).toBe(25);
});

test("anonymous, student and other teacher cannot manage rosters or probe foreign students", async ({ roster: r, browser, request }) => {
  const input = { mode: "transfer", targetClassId: r.targetId, studentIds: [r.students[0].id], preview: true };
  expect((await request.post(rosterPath(r.sourceId), { data: input })).status()).toBe(401);
  expect((await r.stranger.request.post(rosterPath(r.sourceId), { data: input })).status()).toBe(403);
  const student = await login(browser, r.students[0].email);
  try { expect((await student.request.post(rosterPath(r.sourceId), { data: input })).status()).toBe(403); }
  finally { await student.context().close(); }
  expect((await r.teacher.request.post(rosterPath(r.sourceId), { data: { ...input, targetClassId: r.foreignId } })).status()).toBe(403);
  const foreignStudent = await r.teacher.request.post(rosterPath(r.sourceId), { data: { ...input, studentIds: [r.outsiderId] } });
  expect(foreignStudent.ok()).toBe(false);
  expect(await foreignStudent.text()).not.toContain("不能泄露的外班学生");
  expect(await r.db.user.count({ where: { classId: r.sourceId } })).toBe(25);
});

test("stale preview never partially transfers a mixed batch", async ({ roster: r }) => {
  const input = { mode: "transfer", targetClassId: r.targetId, studentIds: r.students.slice(0, 3).map(student => student.id) };
  const plan = await preview(r.teacher.request, r.sourceId, input);
  await r.db.user.update({ where: { id: r.students[2].id }, data: { classId: r.foreignId } });
  const rejected = await r.teacher.request.post(rosterPath(r.sourceId), { data: { ...input, preview: false, previewToken: plan.previewToken } });
  expect(rejected.ok()).toBe(false);
  expect(await r.db.user.count({ where: { id: { in: input.studentIds }, classId: r.targetId } })).toBe(0);
  expect(await r.db.user.count({ where: { id: { in: input.studentIds.slice(0, 2) }, classId: r.sourceId } })).toBe(2);
});

test("transfer preserves released work and history, while unfinished attempts block the whole batch", async ({ roster: r, browser }) => {
  const task = await r.db.task.create({ data: { creatorId: r.teacherId, taskName: r.prefix + "-历史作业", taskType: "quiz" } });
  const instance = await r.db.taskInstance.create({ data: { title: r.prefix + "-历史作业", taskId: task.id, taskType: "quiz", classId: r.sourceId, groupIds: [], createdBy: r.teacherId, status: "published", dueAt: new Date(Date.now() + 86400_000) } });
  const submission = await r.db.submission.create({ data: { studentId: r.students[0].id, taskId: task.id, taskInstanceId: instance.id, taskType: "quiz", status: "graded", score: 88, maxScore: 100, releasedAt: new Date(), quizSubmission: { create: { answers: [] } } } });
  const attempt = await r.db.quizAttempt.create({ data: { studentId: r.students[1].id, taskInstanceId: instance.id, taskSnapshot: {}, issuedQuestionIds: [] } });
  const input = { mode: "transfer", targetClassId: r.targetId, studentIds: r.students.slice(0, 2).map(student => student.id) };
  const blocked = await preview(r.teacher.request, r.sourceId, input);
  expect(blocked.canApply).toBe(false); expect(blocked.blockers.length).toBeGreaterThan(0);
  const rejected = await r.teacher.request.post(rosterPath(r.sourceId), { data: { ...input, preview: false, previewToken: blocked.previewToken } });
  expect(rejected.ok()).toBe(false);
  expect(await r.db.user.count({ where: { id: { in: input.studentIds }, classId: r.sourceId } })).toBe(2);
  await r.db.quizAttempt.delete({ where: { id: attempt.id } });
  const approved = await preview(r.teacher.request, r.sourceId, input);
  expect(approved.warnings.length).toBeGreaterThan(0);
  await commit(r.teacher.request, r.sourceId, input, approved.previewToken);
  const preserved = await r.db.submission.findUniqueOrThrow({ where: { id: submission.id } });
  expect(Number(preserved.score)).toBe(88); expect(preserved.deletedAt).toBeNull(); expect(preserved.taskInstanceId).toBe(instance.id);
  const student = await login(browser, r.students[0].email);
  try {
    const history = await api(student.request, "get", "/api/submissions");
    expect(history.items.some((row: { id: string }) => row.id === submission.id)).toBe(true);
    expect(Number((await api(student.request, "get", `/api/submissions/${submission.id}`)).score)).toBe(88);
    await student.goto("/grades"); await expect(student.getByText(r.prefix + "-历史作业", { exact: true }).first()).toBeVisible();
    expect((await student.request.get(`/api/lms/task-instances/${instance.id}`)).status()).toBe(403);
  } finally { await student.context().close(); }
});

test("XLSX import previews mixed rows, preserves existing passwords and safely retries partial success", async ({ roster: r, request, browser }) => {
  const before = await r.db.user.findUniqueOrThrow({ where: { id: r.students[0].id } });
  const unassigned = await r.db.user.create({ data: { email: `${r.prefix}-unassigned@example.test`, name: "既有未分班姓名", role: "student", passwordHash: before.passwordHash } });
  const newEmail = `${r.prefix}-new@example.test`;
  const defaultEmail = `${r.prefix}-default@example.test`;
  const sheet = workbook([
    { 姓名: "名单新学生", 邮箱: newEmail, 学号: "001", 初始密码: "RowPassword123" },
    { 姓名: "默认密码学生", 邮箱: defaultEmail, 学号: "002" },
    { 姓名: "不应覆盖姓名", 邮箱: before.email, 初始密码: "DoNotReplace123" },
    { 姓名: "重复学生", 邮箱: newEmail, 初始密码: "OtherPassword123" },
    { 姓名: "错误邮箱", 邮箱: "invalid-email" },
    { 姓名: "我只知道邮箱", 邮箱: `${r.prefix}-outsider@example.test` },
    { 姓名: "不应覆盖未分班姓名", 邮箱: unassigned.email },
  ]);
  const path = `/api/lms/classes/${r.sourceId}/import`;
  const multipart = { file: { name: "学生名单.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: sheet }, action: "preview", initialPassword: "DefaultPassword123" };
  expect((await request.post(path, { multipart })).status()).toBe(401);
  expect((await r.stranger.request.post(path, { multipart })).status()).toBe(403);
  const student = await login(browser, r.students[0].email);
  try { expect((await student.request.post(path, { multipart })).status()).toBe(403); }
  finally { await student.context().close(); }
  const response = await r.teacher.request.post(path, { multipart });
  expect(response.ok()).toBe(true);
  const plan = (await response.json()).data;
  expect(plan.summary).toMatchObject({ total: 7, ready: 3, skipped: 2, failed: 2 });
  expect(JSON.stringify(plan)).not.toContain("不能泄露的外班学生");
  expect(JSON.stringify(plan)).not.toContain("Password123");
  expect(await r.db.user.findUnique({ where: { email: newEmail } })).toBeNull();
  const altered = await r.teacher.request.post(path, { multipart: { ...multipart, action: "commit", previewHash: plan.previewHash, initialPassword: "ChangedPassword123" } });
  expect(altered.ok()).toBe(false);
  const committed = await r.teacher.request.post(path, { multipart: { ...multipart, action: "commit", previewHash: plan.previewHash } });
  expect(committed.ok()).toBe(true);
  expect((await committed.json()).data.summary).toMatchObject({ created: 2, enrolled: 1, skipped: 2, failed: 2 });
  const preserved = await r.db.user.findUniqueOrThrow({ where: { id: before.id } });
  expect(preserved.passwordHash).toBe(before.passwordHash); expect(preserved.name).toBe(before.name);
  const enrolled = await r.db.user.findUniqueOrThrow({ where: { id: unassigned.id } });
  expect(enrolled.classId).toBe(r.sourceId); expect(enrolled.name).toBe(unassigned.name); expect(enrolled.passwordHash).toBe(unassigned.passwordHash);
  expect(await compare("RowPassword123", (await r.db.user.findUniqueOrThrow({ where: { email: newEmail } })).passwordHash)).toBe(true);
  expect(await compare("DefaultPassword123", (await r.db.user.findUniqueOrThrow({ where: { email: defaultEmail } })).passwordHash)).toBe(true);
  const retry = await r.teacher.request.post(path, { multipart: { ...multipart, action: "commit", previewHash: plan.previewHash } });
  expect(retry.ok()).toBe(true); expect((await retry.json()).data.summary).toMatchObject({ created: 0, enrolled: 0, skipped: 5, failed: 2 });
  expect(await r.db.user.count({ where: { classId: r.sourceId } })).toBe(28);
});

test("teacher UI selects 25, creates a target group while transferring, and refreshes both classes", async ({ roster: r }, info) => {
  await r.teacher.setViewportSize({ width: 1440, height: 1000 });
  await r.teacher.goto("/teacher/groups");
  await r.teacher.getByRole("button", { name: new RegExp(r.prefix + "-原班") }).click();
  await expect(r.teacher.getByLabel("选择当前筛选学生")).toBeEnabled();
  await r.teacher.getByLabel("选择当前筛选学生").check();
  await r.teacher.getByPlaceholder("搜索姓名或邮箱").fill("测试学生01");
  await expect(r.teacher.getByText("已选人数包含被当前筛选隐藏的学生；批量操作会处理全部已选学生。")).toBeVisible();
  await r.teacher.getByPlaceholder("搜索姓名或邮箱").fill("");
  await r.teacher.getByRole("button", { name: "批量管理", exact: true }).click();
  const dialog = r.teacher.getByRole("dialog");
  await expect(dialog.getByText(/已选 25 人/)).toBeVisible();
  await dialog.getByLabel("操作", { exact: true }).selectOption("transfer");
  await dialog.getByLabel("目标班级", { exact: true }).selectOption(r.targetId);
  await dialog.getByLabel("目标小组（可选）", { exact: true }).selectOption("new");
  await dialog.getByLabel("新小组名称", { exact: true }).fill("操作中创建小组");
  await dialog.getByRole("button", { name: "预览操作影响" }).click();
  await expect(dialog.getByText("确认预览：25 人待处理，0 人无需重复处理")).toBeVisible();
  await capture(r.teacher, info, "transfer-preview-desktop-final");
  await r.teacher.setViewportSize({ width: 390, height: 844 });
  const bounds = await dialog.boundingBox(); expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  await capture(r.teacher, info, "transfer-preview-mobile-final");
  await dialog.getByRole("button", { name: "确认执行" }).click();
  await expect(dialog).toBeHidden();
  await expect(r.teacher.getByRole("status").filter({ hasText: "已完成 25 人" })).toBeVisible();
  await expect(r.teacher.getByRole("button", { name: new RegExp(r.prefix + "-原班.*0 名学生") })).toBeVisible();
  await r.teacher.getByRole("button", { name: new RegExp(r.prefix + "-目标班.*25 名学生") }).click();
  await expect(r.teacher.getByText("操作中创建小组", { exact: true }).first()).toBeVisible();
  expect(await r.db.user.count({ where: { classId: r.targetId } })).toBe(25);
});

test("teacher uploads XLSX through preview/confirm and sees per-row result", async ({ roster: r }, info) => {
  await r.teacher.setViewportSize({ width: 1440, height: 1100 });
  const email = `${r.prefix}-ui-import@example.test`;
  await r.teacher.goto("/teacher/groups");
  await r.teacher.getByRole("button", { name: new RegExp(r.prefix + "-目标班") }).click();
  await r.teacher.getByRole("button", { name: "批量导入学生", exact: true }).click();
  const dialog = r.teacher.getByRole("dialog");
  const download = r.teacher.waitForEvent("download");
  await dialog.getByRole("button", { name: "下载名单模板（Excel 可打开）" }).click();
  expect((await download).suggestedFilename()).toBe("学生导入模板.csv");
  await dialog.getByLabel("选择学生名单", { exact: true }).setInputFiles({ name: "老师名单.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbook([{ 姓名: "导入演示学生", 邮箱: email }, { 姓名: "错误行", 邮箱: "incorrect" }]) });
  await dialog.getByLabel("新账号初始密码（仅新建账号需要）", { exact: true }).fill("ImportUI123");
  await dialog.getByRole("button", { name: "上传并预览", exact: true }).click();
  await expect(dialog.getByText("可导入 1 人 · 跳过 0 人 · 需修正 1 人")).toBeVisible();
  expect(await r.db.user.findUnique({ where: { email } })).toBeNull();
  await capture(r.teacher, info, "import-preview-final");
  await dialog.getByRole("button", { name: "确认导入 1 人", exact: true }).click();
  await expect(dialog.getByText(/已创建 1 人，已有账号入班 0 人/)).toBeVisible();
  await dialog.getByRole("button", { name: "完成", exact: true }).click();
  await expect(r.teacher.getByText(email, { exact: true })).toBeVisible();
  expect(await r.db.user.count({ where: { email, classId: r.targetId } })).toBe(1);
});

test("more than 200 students load without truncation and a failed class switch clears old students", async ({ roster: r }) => {
  const owner = await r.db.user.findUniqueOrThrow({ where: { id: r.teacherId } });
  await r.db.user.createMany({ data: Array.from({ length: 180 }, (_, i) => ({ email: `${r.prefix}-extra-${i}@example.test`, name: `其他测试学生${i}`, passwordHash: owner.passwordHash, role: "student", classId: r.sourceId })) });
  const one = await api(r.teacher.request, "get", `/api/lms/classes/${r.sourceId}/members?take=200&page=1`);
  const two = await api(r.teacher.request, "get", `/api/lms/classes/${r.sourceId}/members?take=200&page=2`);
  expect(one).toHaveLength(200); expect(two).toHaveLength(5);
  expect(new Set([...one, ...two].map((row: { id: string }) => row.id)).size).toBe(205);
  await r.teacher.goto("/teacher/groups");
  await r.teacher.getByRole("button", { name: new RegExp(r.prefix + "-原班") }).click();
  await expect(r.teacher.getByText(/全选筛选结果 205 人/)).toBeVisible();
  await r.teacher.getByLabel("选择当前筛选学生").check();
  await r.teacher.getByRole("button", { name: "批量管理", exact: true }).click();
  await expect(r.teacher.getByRole("dialog").getByRole("alert")).toHaveText("每次最多操作 200 人，请缩小选择范围。");
  await r.teacher.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
  await r.teacher.route(`**/api/lms/classes/${r.targetId}/members?*`, route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, error: { message: "测试模拟加载失败" } }) }));
  await r.teacher.getByRole("button", { name: new RegExp(r.prefix + "-目标班") }).click();
  await expect(r.teacher.getByRole("alert").filter({ hasText: "测试模拟加载失败" })).toBeVisible();
  await expect(r.teacher.getByRole("button", { name: "批量管理", exact: true })).toBeDisabled();
  await expect(r.teacher.getByText(r.students[0].email, { exact: true })).toBeHidden();
  await expect(r.teacher.getByText(/全选筛选结果 0 人 · 已选 0 人/)).toBeVisible();
});

test("teacher cannot grant themselves foreign roster access by creating or linking a course", async ({ roster: r }) => {
  expect((await r.teacher.request.get(`/api/lms/classes/${r.foreignId}/members`)).status()).toBe(403);
  const created = await r.teacher.request.post("/api/lms/courses", { data: { courseTitle: r.prefix + "-自授权限尝试", classId: r.foreignId } });
  expect(created.status()).toBe(403);
  expect(await r.db.course.count({ where: { courseTitle: r.prefix + "-自授权限尝试" } })).toBe(0);
  const ownCourse = await api(r.teacher.request, "post", "/api/lms/courses", { courseTitle: r.prefix + "-合法课程", classId: r.sourceId });
  const linked = await r.teacher.request.post(`/api/lms/courses/${ownCourse.id}/classes`, { data: { classId: r.foreignId } });
  expect(linked.status()).toBe(403);
  expect(await r.db.courseClass.count({ where: { courseId: ownCourse.id, classId: r.foreignId } })).toBe(0);
  expect((await r.teacher.request.get(`/api/lms/classes/${r.foreignId}/members`)).status()).toBe(403);
});

test("import commit cannot silently upgrade a conflict or change the approved account action", async ({ roster: r }) => {
  const newEmail = `${r.prefix}-new-then-existing@example.test`;
  const before = await r.db.user.findUniqueOrThrow({ where: { id: r.outsiderId } });
  const file = { name: "状态变化.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbook([
    { 姓名: "新建预览后出现已有账号", 邮箱: newEmail, 初始密码: "DoNotReset123" },
    { 姓名: "外班预览后变未分班", 邮箱: before.email },
  ]) };
  const path = `/api/lms/classes/${r.sourceId}/import`;
  const planResponse = await r.teacher.request.post(path, { multipart: { file, action: "preview" } });
  expect(planResponse.ok()).toBe(true); const plan = (await planResponse.json()).data;
  expect(plan.summary.ready).toBe(1); expect(plan.summary.failed).toBe(1);
  const concurrent = await r.db.user.create({ data: { email: newEmail, name: "新出现的已有账号", passwordHash: before.passwordHash, role: "student" } });
  await r.db.user.update({ where: { id: before.id }, data: { classId: null } });
  const result = await r.teacher.request.post(path, { multipart: { file, action: "commit", previewHash: plan.previewHash } });
  expect(result.ok()).toBe(true);
  const done = (await result.json()).data;
  expect(done.summary.created).toBe(0); expect(done.summary.enrolled).toBe(0);
  expect((await r.db.user.findUniqueOrThrow({ where: { id: concurrent.id } })).classId).toBeNull();
  expect((await r.db.user.findUniqueOrThrow({ where: { id: before.id } })).classId).toBeNull();
});

test("an actual audit insert failure rolls back only its import row and preserves successful rows", async ({ roster: r }) => {
  const suffix = randomUUID().replaceAll("-", "");
  const functionName = `roster_qa_fail_${suffix}`;
  const failEmail = `${r.prefix}-fail@example.test`;
  const goodEmail = `${r.prefix}-good@example.test`;
  const file = { name: "部分失败.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: workbook([
    { 姓名: "正常导入", 邮箱: goodEmail, 初始密码: "ValidPassword123" },
    { 姓名: "模拟审计失败", 邮箱: failEmail, 初始密码: "ValidPassword123" },
  ]) };
  const path = `/api/lms/classes/${r.sourceId}/import`;
  const planResponse = await r.teacher.request.post(path, { multipart: { file, action: "preview" } });
  expect(planResponse.ok()).toBe(true); const plan = (await planResponse.json()).data;
  // Both identifiers and literal below are generated from UUIDs, in our guarded local database only.
  await r.db.$executeRawUnsafe(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'class.roster.import' AND EXISTS (SELECT 1 FROM "User" WHERE id = NEW."targetId" AND email = '${failEmail}') THEN RAISE EXCEPTION 'owned QA audit failure'; END IF; RETURN NEW; END $$`);
  try {
    await r.db.$executeRawUnsafe(`CREATE TRIGGER ${functionName} BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    const result = await r.teacher.request.post(path, { multipart: { file, action: "commit", previewHash: plan.previewHash } });
    expect(result.ok()).toBe(true); const done = (await result.json()).data;
    expect(done.summary).toMatchObject({ created: 1, failed: 1 });
    expect(await r.db.user.count({ where: { email: goodEmail, classId: r.sourceId } })).toBe(1);
    expect(await r.db.user.findUnique({ where: { email: failEmail } })).toBeNull();
  } finally {
    await r.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${functionName} ON "AuditLog"`);
    await r.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}()`);
  }
});
