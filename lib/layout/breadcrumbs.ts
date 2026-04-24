import type { UserRole } from "@/lib/types";

export interface Crumb {
  label: string;
  isLast: boolean;
}

const LABELS: Record<string, string> = {
  dashboard: "仪表盘",
  courses: "我的课程",
  grades: "我的成绩",
  schedule: "课表",
  "study-buddy": "学习伙伴",
  tasks: "任务中心",
  groups: "班级管理",
  analytics: "数据洞察",
  instances: "任务实例",
  announcements: "公告管理",
  "ai-assistant": "AI 助手",
  new: "新建",
  insights: "洞察分析",
};

function roleRoot(role: UserRole | undefined): string {
  switch (role) {
    case "teacher":
      return "教师";
    case "admin":
      return "管理员";
    case "student":
    default:
      return "学生";
  }
}

function labelFor(segment: string): string {
  return LABELS[segment] ?? segment;
}

function isOpaqueId(segment: string): boolean {
  return /^[0-9a-f-]{8,}$/i.test(segment);
}

export function deriveCrumbs(
  pathname: string,
  role: UserRole | undefined,
): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const root: Crumb = { label: roleRoot(role), isLast: false };

  let pageSegments = segments;
  if (segments[0] === "teacher") {
    pageSegments = segments.slice(1);
  }

  const crumbs: Crumb[] = [root];
  for (const seg of pageSegments) {
    if (isOpaqueId(seg)) continue;
    crumbs.push({ label: labelFor(seg), isLast: false });
  }
  if (crumbs.length > 0) {
    crumbs[crumbs.length - 1].isLast = true;
  }
  return crumbs;
}
