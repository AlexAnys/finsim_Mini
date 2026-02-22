import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .min(1, "邮箱不能为空")
    .email("邮箱格式不正确"),
  password: z
    .string()
    .min(6, "密码至少6个字符"),
  name: z
    .string()
    .min(1, "姓名不能为空")
    .max(100, "姓名不能超过100个字符"),
  role: z.enum(["student", "teacher"], {
    message: "角色必须是 student 或 teacher",
  }),
  classId: z.string().optional(),
  adminKey: z.string().optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "邮箱不能为空")
    .email("邮箱格式不正确"),
  password: z
    .string()
    .min(1, "密码不能为空"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
