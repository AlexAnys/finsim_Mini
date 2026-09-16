import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db/prisma";
import { assertClassAccessForTeacher } from "@/lib/auth/resource-access";
import { resolveAuthSecret } from "@/lib/auth/secret";
import {
  MAX_ROSTER_FILE_BYTES, MAX_ROSTER_ROWS, rosterStudentSchema, rosterInitialPasswordSchema,
  rosterPreviewClaimsSchema, type RosterPreviewPermit,
  type RosterImportAction, type RosterImportResult, type RosterImportRow,
} from "@/lib/validators/roster-import.schema";

type RosterFile = { name: string; buffer: Buffer };
type ParsedRow = {
  rowNumber: number; name: string; email: string; studentNumber: string;
  initialPassword: string; parseError?: string;
};
const aliases: Record<string, keyof Omit<ParsedRow, "rowNumber" | "parseError">> = {
  姓名: "name", 学生姓名: "name", name: "name",
  邮箱: "email", 电子邮箱: "email", email: "email",
  学号: "studentNumber", studentnumber: "studentNumber",
  初始密码: "initialPassword", password: "initialPassword", initialpassword: "initialPassword",
};

/** Reads only the first sheet, retaining file row numbers for correcting errors. */
export function parseRosterFile(file: RosterFile): ParsedRow[] {
  if (file.buffer.length > MAX_ROSTER_FILE_BYTES) throw new Error("ROSTER_FILE_TOO_LARGE");
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error("ROSTER_FILE_TYPE");
  if (!file.buffer.length) throw new Error("ROSTER_EMPTY");
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(file.buffer, {
      type: "buffer", sheetRows: MAX_ROSTER_ROWS + 2, raw: true,
      cellFormula: true, cellHTML: false,
    });
  } catch {
    throw new Error("ROSTER_FILE_INVALID");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.["!ref"]) throw new Error("ROSTER_EMPTY");
  const range = XLSX.utils.decode_range(sheet["!fullref"] || sheet["!ref"]);
  if (range.e.r > MAX_ROSTER_ROWS) throw new Error("ROSTER_TOO_MANY_ROWS");
  // Bound excessively wide input before allocating an array for every cell.
  if (range.e.c > 49) throw new Error("ROSTER_HEADERS_INVALID");
  const cells = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "", blankrows: true, range: 0 });
  const headings = cells[0] || [];
  const columns = new Map<keyof Omit<ParsedRow, "rowNumber" | "parseError">, number>();
  headings.forEach((heading, index) => {
    const field = aliases[String(heading).replace(/^\uFEFF/, "").trim().toLowerCase()];
    if (!field) return;
    if (columns.has(field)) throw new Error("ROSTER_HEADERS_INVALID");
    columns.set(field, index);
  });
  if (!columns.has("name") || !columns.has("email")) throw new Error("ROSTER_HEADERS_INVALID");
  const rows: ParsedRow[] = [];
  cells.slice(1).forEach((values, index) => {
    if (!values.some((value) => String(value).trim())) return;
    const row: ParsedRow = { rowNumber: index + 2, name: "", email: "", studentNumber: "", initialPassword: "" };
    for (const [field, column] of columns) {
      row[field] = String(values[column] ?? "");
      if (sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })]?.f) {
        row.parseError = "请将公式单元格粘贴为纯文本后重新上传";
      }
    }
    row.name = row.name.trim();
    row.email = row.email.trim().toLowerCase();
    row.studentNumber = row.studentNumber.trim();
    rows.push(row);
  });
  if (!rows.length) throw new Error("ROSTER_EMPTY");
  return rows;
}

type ExistingUser = { id: string; role: string; classId: string | null };
function existingStatus(existing: ExistingUser, classId: string): Pick<RosterImportRow, "status" | "message"> {
  return existing.role === "student" && existing.classId === classId
    ? { status: "already_in_class", message: "已在本班，跳过；现有账号和密码保持不变" }
    : { status: "conflict", message: "该邮箱无法在本次导入中使用；已有其他班学生请从人员信息办理转班，或联系管理员核对" };
}

const accountSelect = { id: true, role: true, classId: true } as const;
const developmentPreviewKey = randomBytes(32);
const previewKey = () => resolveAuthSecret() || developmentPreviewKey;
const sign = (value: string) => createHmac("sha256", previewKey()).update(value).digest("hex");
const fingerprint = (id: string) => sign(`roster-account:${id}`);

function verifyPreview(token: string | undefined, inputDigest: string): RosterPreviewPermit[] {
  if (!token || token.length > 50000) throw new Error("ROSTER_PREVIEW_CHANGED");
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[1])) throw new Error();
    if (!timingSafeEqual(Buffer.from(sign(`roster-preview:${parts[0]}`), "hex"), Buffer.from(parts[1], "hex"))) throw new Error();
    const parsed = rosterPreviewClaimsSchema.safeParse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.inputDigest !== inputDigest || parsed.data.expiresAt <= Date.now()) throw new Error();
    return parsed.data.permits;
  } catch {
    throw new Error("ROSTER_PREVIEW_CHANGED");
  }
}

function signPreview(inputDigest: string, permits: RosterPreviewPermit[]) {
  const payload = Buffer.from(JSON.stringify({ version: 1, expiresAt: Date.now() + 30 * 60 * 1000, inputDigest, permits })).toString("base64url");
  return `${payload}.${sign(`roster-preview:${payload}`)}`;
}

function changedAccount(row: RosterImportRow) {
  Object.assign(row, { status: "failed", message: "账号状态已变化，未执行本行；请重新预览名单" });
}

export async function importClassRoster(input: {
  classId: string; actor: { id: string; role: string }; file: RosterFile;
  action: RosterImportAction; previewHash?: string; initialPassword?: string;
}): Promise<RosterImportResult> {
  const { classId, actor, file, action } = input;
  await assertClassAccessForTeacher(classId, actor);
  const target = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true } });
  if (!target) throw new Error("CLASS_NOT_FOUND");
  const parsedRows = parseRosterFile(file);
  const inputDigest = createHmac("sha256", previewKey())
    .update(JSON.stringify([actor.id, classId, input.initialPassword || ""]))
    .update(file.buffer).digest("hex");
  // Signed permits bind the exact approved rows and actions, while live permission is checked separately.
  const permits = action === "commit" ? verifyPreview(input.previewHash, inputDigest) : [];
  const approvedRows = new Map(permits.map((permit) => [permit.rowNumber, permit]));
  const rows: RosterImportRow[] = [];
  const seen = new Set<string>();
  for (const item of parsedRows) {
    const row: RosterImportRow = {
      rowNumber: item.rowNumber, name: item.name.slice(0, 100), email: item.email.slice(0, 254),
      studentNumber: item.studentNumber.slice(0, 100), status: "ready", message: "将创建学生账号并加入本班",
    };
    rows.push(row);
    const student = rosterStudentSchema.safeParse(item);
    if (item.parseError || !student.success) {
      row.status = "invalid";
      row.message = item.parseError || (!student.success ? student.error.issues[0].message : "名单格式有误");
      continue;
    }
    if (seen.has(item.email)) {
      Object.assign(row, { status: "duplicate", message: "邮箱重复，本行跳过；请核对首次出现的记录" });
      continue;
    }
    seen.add(item.email);
    let existing: ExistingUser | null;
    try {
      existing = await prisma.user.findUnique({ where: { email: item.email }, select: accountSelect });
    } catch {
      Object.assign(row, { status: "failed", message: "本行账号核对失败，请稍后重试；已成功行会自动跳过" });
      continue;
    }
    const approved = approvedRows.get(item.rowNumber);
    if (existing?.role === "student" && existing.classId === null) {
      row.message = "将复用已有未分班账号加入本班，保留姓名和密码";
      if (action === "preview") {
        permits.push({ rowNumber: item.rowNumber, kind: "enroll", accountFingerprint: fingerprint(existing.id) });
      } else if (approved?.kind === "enroll" && approved.accountFingerprint === fingerprint(existing.id)) {
        await createImportedStudent(item, classId, actor, row, approved);
      } else changedAccount(row);
      continue;
    }
    if (existing) {
      Object.assign(row, existingStatus(existing, classId));
      continue;
    }
    if (action === "commit" && approved?.kind !== "create") {
      changedAccount(row);
      continue;
    }
    item.initialPassword ||= input.initialPassword || "";
    const password = rosterInitialPasswordSchema.safeParse(item.initialPassword);
    if (!password.success) {
      Object.assign(row, { status: "invalid", message: password.error.issues[0].message });
      continue;
    }
    if (action === "preview") permits.push({ rowNumber: item.rowNumber, kind: "create" });
    else if (approved?.kind === "create") await createImportedStudent(item, classId, actor, row, approved);
    else changedAccount(row);
  }
  return {
    classId, className: target.name,
    previewHash: action === "preview" ? signPreview(inputDigest, permits) : input.previewHash!, rows,
    summary: {
      total: rows.length,
      ready: rows.filter((row) => row.status === "ready").length,
      created: rows.filter((row) => row.status === "created").length,
      enrolled: rows.filter((row) => row.status === "enrolled").length,
      skipped: rows.filter((row) => ["already_in_class", "duplicate"].includes(row.status)).length,
      failed: rows.filter((row) => ["invalid", "conflict", "failed"].includes(row.status)).length,
    },
  };
}

async function createImportedStudent(
  item: ParsedRow, classId: string, actor: { id: string; role: string }, row: RosterImportRow, permit: RosterPreviewPermit,
) {
  try {
    // Keep CPU-heavy hashing outside the transaction. Passwords are never logged or returned.
    const passwordHash = permit.kind === "enroll" ? undefined : await hash(item.initialPassword, 12);
    const outcome = await prisma.$transaction(async (tx) => {
      await assertClassAccessForTeacher(classId, actor, tx);
      const existing = await tx.user.findUnique({ where: { email: item.email }, select: accountSelect });
      if (existing?.role === "student" && existing.classId === null) {
        if (permit.kind !== "enroll" || permit.accountFingerprint !== fingerprint(existing.id)) throw new Error("ROSTER_ACCOUNT_CHANGED");
        const update = await tx.user.updateMany({
          where: { id: existing.id, classId: null, role: "student" }, data: { classId },
        });
        if (update.count !== 1) throw new Error("ROSTER_ACCOUNT_CHANGED");
        await tx.auditLog.create({ data: {
          action: "class.roster.enroll", actorId: actor.id, targetId: existing.id, targetType: "User",
          metadata: { classId },
        } });
        return { status: "enrolled" as const, message: "已有账号已加入本班，姓名和密码保持不变" };
      }
      if (existing) return existingStatus(existing, classId);
      if (!passwordHash || permit.kind !== "create") throw new Error("ROSTER_ACCOUNT_CHANGED");
      const student = await tx.user.create({
        data: { name: item.name, email: item.email, passwordHash, role: "student", classId },
        select: { id: true },
      });
      await tx.auditLog.create({ data: {
        action: "class.roster.import", actorId: actor.id, targetId: student.id, targetType: "User",
        metadata: { classId },
      } });
      return { status: "created" as const, message: "账号已创建并加入本班，请私下交付设置的初始密码" };
    });
    Object.assign(row, outcome);
  } catch (error) {
    if (error instanceof Error && error.message === "ROSTER_ACCOUNT_CHANGED") {
      changedAccount(row);
      return;
    }
    // An overlapping retry may have created this email while this row was hashing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      try {
        await assertClassAccessForTeacher(classId, actor);
        const existing = await prisma.user.findUnique({ where: { email: item.email }, select: accountSelect });
        if (existing) {
          Object.assign(row, existingStatus(existing, classId));
          return;
        }
      } catch { /* Report this row as retryable, without returning database details. */ }
    }
    Object.assign(row, { status: "failed", message: "本行未能导入，请核对权限后重试；已成功行会自动跳过" });
  }
}
