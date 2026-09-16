import { z } from "zod";

export const MAX_ROSTER_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_ROSTER_ROWS = 200;

export const rosterImportRequestSchema = z.object({
  action: z.enum(["preview", "commit"], { message: "请选择预览或确认导入" }),
  previewHash: z.string().max(50000, "预览记录过长，请重新预览名单")
    .regex(/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/, "预览记录格式无效，请重新预览名单").optional(),
  initialPassword: z.string().max(72, "初始密码过长").optional(),
}).superRefine((value, ctx) => {
  if (value.action === "commit" && !value.previewHash) {
    ctx.addIssue({ code: "custom", message: "请先预览名单，再确认导入", path: ["previewHash"] });
  }
});

export const rosterStudentSchema = z.object({
  name: z.string().trim().min(1, "姓名不能为空").max(100, "姓名不能超过100个字符"),
  email: z.string().trim().toLowerCase().email("邮箱格式不正确").max(254, "邮箱过长"),
  studentNumber: z.string().trim().max(100, "学号不能超过100个字符"),
});

export const rosterInitialPasswordSchema = z.string()
  .min(6, "新账号须提供至少6个字符的初始密码")
  .refine((value) => new TextEncoder().encode(value).byteLength <= 72,
    "初始密码不能超过72字节（中文通常每字3字节）");

export const rosterPreviewClaimsSchema = z.object({
  version: z.literal(1),
  expiresAt: z.number().int(),
  inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
  permits: z.array(z.discriminatedUnion("kind", [
    z.object({ rowNumber: z.number().int().min(2).max(MAX_ROSTER_ROWS + 1), kind: z.literal("create") }),
    z.object({ rowNumber: z.number().int().min(2).max(MAX_ROSTER_ROWS + 1), kind: z.literal("enroll"), accountFingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  ])).max(MAX_ROSTER_ROWS),
});
export type RosterPreviewPermit = z.infer<typeof rosterPreviewClaimsSchema>["permits"][number];

export type RosterImportAction = z.infer<typeof rosterImportRequestSchema>["action"];
export type RosterImportStatus = "ready" | "created" | "enrolled" | "already_in_class" | "duplicate" | "invalid" | "conflict" | "failed";
export interface RosterImportRow {
  rowNumber: number;
  name: string;
  email: string;
  studentNumber: string;
  status: RosterImportStatus;
  message: string;
}
export interface RosterImportResult {
  classId: string;
  className: string;
  previewHash: string;
  rows: RosterImportRow[];
  summary: { total: number; ready: number; created: number; enrolled: number; skipped: number; failed: number };
}
