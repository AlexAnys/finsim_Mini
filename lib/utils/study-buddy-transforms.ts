// PR-STU-2 · 学生 /study-buddy 重布局：纯数据 transforms（无副作用、可测）
//
// 数据流：GET /api/study-buddy/posts + GET /api/lms/dashboard/summary（client-side join）
// - 获取 posts 主列表
// - 通过 taskInstanceId / taskId 在 dashboard summary.tasks 派生 课程名 + 任务名
// - 时间相对化（5 分钟前 / 昨天 22:10 / 2 天前 / N 天前）

export type StudyBuddyMode = "socratic" | "direct";
export type StudyBuddyStatus = "pending" | "answered" | "error";

export interface StudyBuddyMessage {
  role: string; // "student" | "ai"
  content: string;
  createdAt: string;
}

/** GET /api/study-buddy/posts 原始 item（service 层 select 的字段集） */
export interface RawStudyBuddyPost {
  id: string;
  taskId: string;
  taskInstanceId?: string | null;
  title: string;
  question: string;
  mode: StudyBuddyMode;
  anonymous: boolean;
  status: StudyBuddyStatus;
  aiReply: string | null;
  messages: StudyBuddyMessage[] | null;
  createdAt: string;
  /** 关联的学生（service include 透传），匿名时不展示 */
  student?: { id?: string; name?: string | null } | null;
}

/** 客户端 join 后的 post — 供列表 / 对话视图渲染 */
export interface StudyBuddyPostRow {
  id: string;
  taskId: string;
  taskInstanceId: string | null;
  title: string;
  question: string;
  mode: StudyBuddyMode;
  anonymous: boolean;
  status: StudyBuddyStatus;
  aiReply: string | null;
  messages: StudyBuddyMessage[];
  createdAt: string;
  /** 课程名 — 缺失则 null（页面优雅 fallback） */
  courseName: string | null;
  /** 课程 id — 用于 courseColorForId 派生 tag 色 */
  courseId: string | null;
  /** 任务名 — 缺失则 null */
  taskName: string | null;
  /** 派生的相对时间字符串（"5 分钟前"等） */
  relativeTime: string;
  /** 消息条数（含 student + ai） */
  messageCount: number;
}

/** dashboard summary tasks lite shape — 与 grades-transforms 对齐 */
export interface DashboardTaskLite {
  id: string;
  title?: string;
  /** task 模板名（taskName） */
  taskName?: string;
  /** task 模板 id — 用于 POST /api/study-buddy/posts.taskId（FK） */
  taskId?: string;
  taskType?: string;
  course?: { id?: string; courseTitle?: string } | null;
  chapter?: { id?: string; title?: string } | null;
  section?: { id?: string; title?: string } | null;
}

/**
 * 相对时间格式化（参考 mockup "20 分钟前 / 昨天 22:10 / 2 天前"）
 * - <1 分钟 → "刚刚"
 * - <60 分钟 → "N 分钟前"
 * - <24 小时 且 同一天 → "N 小时前"
 * - 昨天（昨日整体） → "昨天 HH:MM"
 * - <7 天 → "N 天前"
 * - 否则 → "YYYY-MM-DD"
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHours = Math.floor(diffMin / 60);
  // 同一天
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay && diffHours < 24) return `${diffHours} 小时前`;
  // 昨天判定（now 当日 00:00 - 24h ~ now 当日 00:00）
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  if (d.getTime() >= yesterdayStart.getTime() && d.getTime() < todayStart.getTime()) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `昨天 ${hh}:${mm}`;
  }
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 7) return `${diffDays} 天前`;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 客户端 join：把 dashboard summary 里的 task → course 映射落到 post 上。
 * - taskInstanceId 优先（指向具体 instance 派生 course）
 * - 否则 taskId 兜底（用 task.id 在 dashboard.tasks 找 — dashboard 实际返回的是 instance, 此情况 courseName=null）
 *
 * 缺失时 courseName / courseId / taskName 全为 null（UI 走优雅占位）。
 */
export function joinStudyBuddyPosts(
  rawPosts: RawStudyBuddyPost[],
  dashboardTasks: DashboardTaskLite[],
  now: Date = new Date(),
): StudyBuddyPostRow[] {
  const tiMap = new Map<string, DashboardTaskLite>();
  for (const ti of dashboardTasks) {
    if (ti.id) tiMap.set(ti.id, ti);
  }
  return rawPosts.map((p) => {
    const ti = p.taskInstanceId ? tiMap.get(p.taskInstanceId) : undefined;
    const courseName = ti?.course?.courseTitle ?? null;
    const courseId = ti?.course?.id ?? null;
    const taskName = ti?.taskName ?? ti?.title ?? null;
    const messages = Array.isArray(p.messages) ? p.messages : [];
    return {
      id: p.id,
      taskId: p.taskId,
      taskInstanceId: p.taskInstanceId ?? null,
      title: p.title,
      question: p.question,
      mode: p.mode,
      anonymous: p.anonymous,
      status: p.status,
      aiReply: p.aiReply,
      messages,
      createdAt: p.createdAt,
      courseName,
      courseId,
      taskName,
      relativeTime: formatRelativeTime(p.createdAt, now),
      messageCount: messages.length,
    };
  });
}

/** 为列表绘制按时间降序排序（最新在前） */
export function sortPostsByCreatedDesc(
  posts: StudyBuddyPostRow[],
): StudyBuddyPostRow[] {
  return [...posts].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** 单条消息时间格式化：HH:MM（用于 message bubble） */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
