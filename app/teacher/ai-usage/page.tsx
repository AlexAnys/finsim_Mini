import { redirect } from "next/navigation";

// Unit B1: 旧路径保留兼容书签 / 外链 / 已发邮件，永久重定向到 AI 工作台。
export default function TeacherAiUsageRedirect() {
  redirect("/teacher/ai-workbench?tab=usage");
}
