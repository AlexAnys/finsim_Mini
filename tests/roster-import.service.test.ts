import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/db/prisma", () => ({ prisma: {
  class: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock("@/lib/auth/resource-access", () => ({ assertClassAccessForTeacher: vi.fn() }));
vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed-initial-password") }));

import { prisma } from "@/lib/db/prisma";
import { hash } from "bcryptjs";
import { assertClassAccessForTeacher } from "@/lib/auth/resource-access";
import { importClassRoster, parseRosterFile } from "@/lib/services/roster-import.service";

const mk = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const actor = { id: "teacher", role: "teacher" };
const header = ["姓名", "邮箱", "学号", "初始密码"];
function file(rows: string[][], extension = "xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "学生名单");
  return { name: `名单.${extension}`, buffer: Buffer.from(XLSX.write(workbook, {
    type: "buffer", bookType: extension === "xls" ? "biff8" : extension as "xlsx" | "csv",
  })) };
}
const one = () => file([header, ["张同学", "NEW@EXAMPLE.COM", "00123", "student123"]]);
async function run(input: ReturnType<typeof one>, action: "preview" | "commit" = "preview", previewHash?: string) {
  return importClassRoster({ classId: "class-a", actor, file: input, action, previewHash });
}

beforeEach(() => {
  vi.resetAllMocks();
  mk(assertClassAccessForTeacher).mockResolvedValue(undefined);
  mk(prisma.class.findUnique).mockResolvedValue({ id: "class-a", name: "会计A班" });
  mk(prisma.user.findUnique).mockResolvedValue(null);
  mk(prisma.user.create).mockResolvedValue({ id: "new-student" });
  mk(prisma.user.updateMany).mockResolvedValue({ count: 1 });
  mk(prisma.$transaction).mockImplementation(async (operation) => operation(prisma));
  mk(hash).mockResolvedValue("hashed-initial-password");
});

describe("parseRosterFile", () => {
  it.each(["xlsx", "xls", "csv"])("reads %s with Chinese headings and leading zero student number", (extension) => {
    const result = parseRosterFile(file([header, ["张同学", "NEW@EXAMPLE.COM", "00123", "student123"]], extension));
    expect(result[0]).toMatchObject({ rowNumber: 2, name: "张同学", email: "new@example.com", studentNumber: "00123" });
  });
  it("rejects oversized, unsupported, missing headings, ambiguous headings and empty files", () => {
    expect(() => parseRosterFile({ name: "x.xlsx", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) })).toThrow("ROSTER_FILE_TOO_LARGE");
    expect(() => parseRosterFile({ name: "x.pdf", buffer: Buffer.from("x") })).toThrow("ROSTER_FILE_TYPE");
    expect(() => parseRosterFile(file([["姓名"], ["张同学"]]))).toThrow("ROSTER_HEADERS_INVALID");
    expect(() => parseRosterFile(file([["姓名", "邮箱", "email"], ["张", "a@b.cn", "c@d.cn"]]))).toThrow("ROSTER_HEADERS_INVALID");
    expect(() => parseRosterFile(file([header]))).toThrow("ROSTER_EMPTY");
  });
  it("rejects more than 200 rows instead of silently truncating a workbook", () => {
    expect(() => parseRosterFile(file([header, ...Array.from({ length: 201 }, (_, index) => ["学生", `a${index}@example.com`, "", "student123"]) ]))).toThrow("ROSTER_TOO_MANY_ROWS");
  });
  it("marks spreadsheet formulas invalid instead of importing cached formula values", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([header, ["甲", "a@example.com", "", "student123"]]);
    sheet.B2.f = '"a@example.com"';
    XLSX.utils.book_append_sheet(workbook, sheet, "学生名单");
    const result = parseRosterFile({ name: "formula.xlsx", buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) });
    expect(result[0].parseError).toContain("公式");
  });
});

describe("importClassRoster", () => {
  it("previews valid, duplicate, malformed and missing-password rows without writing or exposing passwords", async () => {
    const result = await run(file([header,
      ["张同学", "new@example.com", "00123", "student123"],
      ["张同学", " NEW@example.com ", "", "student123"],
      ["李同学", "bad-email", "", "student123"],
      ["王同学", "other@example.com", "", ""],
    ]));
    expect(result.rows.map((row) => row.status)).toEqual(["ready", "duplicate", "invalid", "invalid"]);
    expect(result.summary).toEqual({ total: 4, ready: 1, created: 0, enrolled: 0, skipped: 1, failed: 2 });
    expect(JSON.stringify(result)).not.toContain("student123");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
  it("skips existing students in the target class without requiring or changing their passwords", async () => {
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId: "class-a" });
    const result = await run(file([header, ["输入姓名", "existing@example.com", "", ""]]));
    expect(result.rows[0].status).toBe("already_in_class");
    expect(hash).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("returns a generic conflict for inaccessible accounts without returning stored identity or class", async () => {
    mk(prisma.user.findUnique).mockResolvedValue({ id: "secret-id", role: "teacher", classId: "secret-class", name: "真实姓名" });
    const result = await run(one());
    expect(result.rows[0].status).toBe("conflict");
    expect(JSON.stringify(result)).not.toMatch(/secret-id|secret-class|真实姓名/);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("checks permission before parsing or searching account emails", async () => {
    mk(assertClassAccessForTeacher).mockRejectedValue(new Error("FORBIDDEN"));
    await expect(run(one())).rejects.toThrow("FORBIDDEN");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
  it("requires matching preview and hashes each new account using registration's bcrypt cost", async () => {
    const input = one();
    const preview = await run(input);
    await expect(run(input, "commit", "a".repeat(64))).rejects.toThrow("ROSTER_PREVIEW_CHANGED");
    expect(prisma.user.create).not.toHaveBeenCalled();
    const result = await run(input, "commit", preview.previewHash);
    expect(result.rows[0].status).toBe("created");
    expect(hash).toHaveBeenCalledWith("student123", 12);
    expect(prisma.user.create).toHaveBeenCalledWith({ data: {
      name: "张同学", email: "new@example.com", role: "student", classId: "class-a", passwordHash: "hashed-initial-password",
    }, select: { id: true } });
    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(JSON.stringify(mk(prisma.auditLog.create).mock.calls)).not.toContain("student123");
  });
  it("revalidates target permission and account state on confirm; repeated import never recreates a student", async () => {
    const input = one();
    const preview = await run(input);
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId: "class-a" });
    const result = await run(input, "commit", preview.previewHash);
    expect(result.summary.skipped).toBe(1);
    expect(prisma.user.create).not.toHaveBeenCalled();
    mk(assertClassAccessForTeacher).mockRejectedValue(new Error("FORBIDDEN"));
    await expect(run(input, "commit", preview.previewHash)).rejects.toThrow("FORBIDDEN");
  });
  it("reports row failures and continues other rows without changing any historical data", async () => {
    const input = file([header, ["甲", "a@example.com", "", "student123"], ["乙", "b@example.com", "", "student456"]]);
    const preview = await run(input);
    mk(prisma.$transaction).mockRejectedValueOnce(new Error("database failure"));
    const result = await run(input, "commit", preview.previewHash);
    expect(result.rows.map((row) => row.status)).toEqual(["failed", "created"]);
    expect(result.summary).toEqual({ total: 2, ready: 0, created: 1, enrolled: 0, skipped: 0, failed: 1 });
  });
  it("reuses unassigned students and retains their name, password, and learning records", async () => {
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId: null });
    const input = file([["姓名", "邮箱"], ["导入的名字", "existing@example.com"]]);
    const preview = await run(input);
    expect(preview.rows[0].status).toBe("ready");
    const result = await run(input, "commit", preview.previewHash);
    expect(result.rows[0].status).toBe("enrolled");
    expect(result.summary.enrolled).toBe(1);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "existing", classId: null, role: "student" }, data: { classId: "class-a" },
    });
    expect(hash).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("does not silently reassign an unassigned account which another import has already enrolled", async () => {
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId: null });
    const preview = await run(one());
    mk(prisma.user.updateMany).mockResolvedValue({ count: 0 });
    const result = await run(one(), "commit", preview.previewHash);
    expect(result.rows[0].status).toBe("failed");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
  it("supports a shared initial password without a password column and binds it to the preview", async () => {
    const input = { classId: "class-a", actor, file: file([["姓名", "邮箱"], ["甲", "a@example.com"]]), initialPassword: "shared-pass" };
    const preview = await importClassRoster({ ...input, action: "preview" });
    expect(preview.summary.ready).toBe(1);
    expect(JSON.stringify(preview)).not.toContain("shared-pass");
    await expect(importClassRoster({ ...input, initialPassword: "different-pass", action: "commit", previewHash: preview.previewHash })).rejects.toThrow("ROSTER_PREVIEW_CHANGED");
    await importClassRoster({ ...input, action: "commit", previewHash: preview.previewHash });
    expect(hash).toHaveBeenCalledWith("shared-pass", 12);
  });
  it("rejects over-72-byte initial passwords rather than silently truncating bcrypt input", async () => {
    const result = await run(file([header, ["甲", "a@example.com", "", "密".repeat(25)]]));
    expect(result.rows[0].status).toBe("invalid");
    expect(hash).not.toHaveBeenCalled();
  });
  it("treats a unique-email race as already imported without resetting a password", async () => {
    const preview = await run(one());
    mk(prisma.$transaction).mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }));
    mk(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "existing", role: "student", classId: "class-a" });
    const result = await run(one(), "commit", preview.previewHash);
    expect(result.rows[0].status).toBe("already_in_class");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("continues after an account lookup fails and reports a retryable row without database details", async () => {
    const input = file([header, ["甲", "a@example.com", "", "student123"], ["乙", "b@example.com", "", "student456"]]);
    const preview = await run(input);
    mk(prisma.user.findUnique).mockRejectedValueOnce(new Error("private SQL details"));
    const result = await run(input, "commit", preview.previewHash);
    expect(result.rows.map((row) => row.status)).toEqual(["failed", "created"]);
    expect(JSON.stringify(result)).not.toContain("private SQL details");
  });
  it("does not turn a concurrent other-class registration into enrollment", async () => {
    const preview = await run(one());
    mk(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "other", role: "student", classId: "class-b" });
    const result = await run(one(), "commit", preview.previewHash);
    expect(result.rows[0].status).toBe("conflict");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("keeps the import row unchanged if its transaction's audit write fails", async () => {
    const preview = await run(one());
    mk(prisma.auditLog.create).mockRejectedValueOnce(new Error("audit unavailable"));
    const result = await run(one(), "commit", preview.previewHash);
    expect(result.rows[0].status).toBe("failed");
    // The audit and user insert share one interactive transaction; real rollback is covered by independent DB QA.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
  it.each(["class-a", "class-b"])("cannot create or enroll a row previewed as already assigned to %s", async (classId) => {
    const input = one();
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId });
    const preview = await run(input);
    expect(preview.summary.ready).toBe(0);
    mk(prisma.user.findUnique).mockResolvedValue(null);
    expect((await run(input, "commit", preview.previewHash)).rows[0].status).toBe("failed");
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId: null });
    expect((await run(input, "commit", preview.previewHash)).rows[0].status).toBe("failed");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("will not switch the approved action from creating an account to enrolling an existing one", async () => {
    const input = one();
    const preview = await run(input);
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId: null });
    const result = await run(input, "commit", preview.previewHash);
    expect(result.rows[0].status).toBe("failed");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("will not replace an approved unassigned account with a new account or a different account id", async () => {
    const input = one();
    mk(prisma.user.findUnique).mockResolvedValue({ id: "existing", role: "student", classId: null });
    const preview = await run(input);
    mk(prisma.user.findUnique).mockResolvedValue(null);
    expect((await run(input, "commit", preview.previewHash)).rows[0].status).toBe("failed");
    mk(prisma.user.findUnique).mockResolvedValue({ id: "different-id", role: "student", classId: null });
    expect((await run(input, "commit", preview.previewHash)).rows[0].status).toBe("failed");
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(Buffer.from(preview.previewHash.split(".")[0], "base64url").toString()).not.toContain('"existing"');
  });
  it("rechecks the approved action inside the transaction after a concurrent registration", async () => {
    const input = one();
    const preview = await run(input);
    mk(prisma.user.findUnique).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "other", role: "student", classId: null });
    expect((await run(input, "commit", preview.previewHash)).rows[0].status).toBe("failed");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
  it("rejects edited or expired preview permits before writing", async () => {
    const input = one();
    const preview = await run(input);
    const [payload, signature] = preview.previewHash.split(".");
    const modified = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), expiresAt: Date.now() + 99e9 })).toString("base64url");
    await expect(run(input, "commit", `${modified}.${signature}`)).rejects.toThrow("ROSTER_PREVIEW_CHANGED");
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 31 * 60 * 1000);
    try {
      await expect(run(input, "commit", preview.previewHash)).rejects.toThrow("ROSTER_PREVIEW_CHANGED");
    } finally { clock.mockRestore(); }
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
