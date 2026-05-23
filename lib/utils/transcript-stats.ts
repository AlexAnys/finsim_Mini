/**
 * S2 (P3) 对话轮次 + 参与度统计 — 纯 read-time util，0 schema。
 *
 * 「对话轮次：N」= transcript 中学生发言条数。本场景轮次比 timestamp 更具
 * 代表性（生产数据 timestamp 提交时统一盖章、全部相同，无法回算真实耗时）。
 *
 * 计数逻辑集中在此处，供 S2（轮次显示）与 S3（参与度统计：轮次 + 总字数 +
 * 平均每轮字数）复用同一次遍历，避免重复实现导致口径漂移。
 *
 * 角色 / 文本容错与 lib/services/scope-insights.service.ts 的
 * extractStudentTranscript 保持一致：
 * - 学生端 role ∈ {"student", "user"}（schema 规范值为 "student"，"user" 为容错）
 * - 文本可来自 text 或 content 字段
 * - 空白 / 空串文本不计为一轮（非真实发言）
 */

const STUDENT_ROLES = new Set(["student", "user"]);

export interface TranscriptStats {
  /** 学生发言条数（= 对话轮次） */
  studentTurns: number;
  /** 学生发言总字数（去除首尾空白后逐条累加 length） */
  studentCharTotal: number;
  /** 平均每轮字数（按有效轮次取整；无学生发言时为 0，不除零） */
  studentCharAvg: number;
}

/** 从单条 transcript 元素取出学生发言文本；非学生发言 / 空白 / 脏数据返回 null。 */
function studentText(turn: unknown): string | null {
  if (!turn || typeof turn !== "object") return null;
  const r = turn as Record<string, unknown>;
  const role = typeof r.role === "string" ? r.role : null;
  if (!role || !STUDENT_ROLES.has(role)) return null;
  const raw =
    typeof r.text === "string"
      ? r.text
      : typeof r.content === "string"
        ? r.content
        : "";
  const text = raw.trim();
  return text.length > 0 ? text : null;
}

/**
 * 计算一份 transcript 的学生参与度统计。
 * 非数组 / null / undefined / 脏元素一律安全降级（不抛错）。
 */
export function computeTranscriptStats(raw: unknown): TranscriptStats {
  if (!Array.isArray(raw)) {
    return { studentTurns: 0, studentCharTotal: 0, studentCharAvg: 0 };
  }
  let studentTurns = 0;
  let studentCharTotal = 0;
  for (const turn of raw) {
    const text = studentText(turn);
    if (text === null) continue;
    studentTurns += 1;
    studentCharTotal += text.length;
  }
  const studentCharAvg =
    studentTurns > 0 ? Math.round(studentCharTotal / studentTurns) : 0;
  return { studentTurns, studentCharTotal, studentCharAvg };
}

/** 便捷计数：仅取对话轮次（= 学生发言条数）。等价于 computeTranscriptStats(raw).studentTurns。 */
export function countStudentTurns(raw: unknown): number {
  return computeTranscriptStats(raw).studentTurns;
}
