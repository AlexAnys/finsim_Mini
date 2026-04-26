import { prisma } from "@/lib/db/prisma";
import {
  assertTaskInstanceWritable,
  assertSubmissionReadable,
} from "@/lib/auth/resource-access";
import { logAuditForced } from "./audit.service";

// ============================================
// PR-SIM-1a · D1 防作弊·教师可控的"分两步公布"
//
// 公布语义：
// - releasedAt = null → 学生看不到 score/feedback/evaluation/conceptTags
// - releasedAt != null → 学生看到完整结果
//
// 教师在任务界面切换：
// - 自动 (auto) + autoReleaseAt：cron 扫到时点 → 批量公布
// - 手动 (manual)：教师单条/批量公布按钮
//
// 当 releaseMode = auto + autoReleaseAt 已到期，AI 评估完成时立即公布（grading.service 内）
// ============================================

type UserLike = { id: string; role: string; classId?: string | null };

/**
 * 教师手动公布单条 submission。
 *
 * 校验：
 * - 提交必须存在
 * - 教师拥有该 submission 的 task instance（assertSubmissionReadable + 写权 fallback 到 instance writable）
 * - 提交必须是 graded 状态（pending/grading 不允许公布）
 *
 * 副作用：
 * - 设 releasedAt = NOW
 * - 写 audit log（action: submission_released）
 */
export async function releaseSubmission(
  submissionId: string,
  user: UserLike,
) {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      releasedAt: true,
      taskInstanceId: true,
      studentId: true,
    },
  });
  if (!sub) throw new Error("SUBMISSION_NOT_FOUND");

  // 写权校验：通过 task instance 的写权（或独立任务的 task creator）
  if (sub.taskInstanceId) {
    await assertTaskInstanceWritable(sub.taskInstanceId, user);
  } else {
    // 独立任务（无 instance）回退到 readable 校验后再判教师所属
    await assertSubmissionReadable(submissionId, user);
  }

  if (sub.status !== "graded") throw new Error("SUBMISSION_NOT_GRADED");

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: { releasedAt: new Date() },
  });

  await logAuditForced({
    action: "submission_released",
    actorId: user.id,
    targetId: submissionId,
    targetType: "submission",
    metadata: {
      taskInstanceId: sub.taskInstanceId,
      studentId: sub.studentId,
      previousReleasedAt: sub.releasedAt?.toISOString() ?? null,
    },
  });

  return updated;
}

/**
 * 教师撤回公布单条 submission（设 releasedAt = NULL）。紧急用，不修改 status。
 */
export async function unreleaseSubmission(
  submissionId: string,
  user: UserLike,
) {
  const sub = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      status: true,
      releasedAt: true,
      taskInstanceId: true,
      studentId: true,
    },
  });
  if (!sub) throw new Error("SUBMISSION_NOT_FOUND");

  if (sub.taskInstanceId) {
    await assertTaskInstanceWritable(sub.taskInstanceId, user);
  } else {
    await assertSubmissionReadable(submissionId, user);
  }

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: { releasedAt: null },
  });

  await logAuditForced({
    action: "submission_unreleased",
    actorId: user.id,
    targetId: submissionId,
    targetType: "submission",
    metadata: {
      taskInstanceId: sub.taskInstanceId,
      studentId: sub.studentId,
      previousReleasedAt: sub.releasedAt?.toISOString() ?? null,
    },
  });

  return updated;
}

/**
 * 批量公布 / 撤回。每条独立校验所属（防止教师 A 偷塞教师 B 的 submission ID）。
 *
 * 行为：
 * - 跳过非 graded 提交（计入 skipped）
 * - 跳过权限不通过的（throw FORBIDDEN）
 * - 写一条 batch audit + 每条不再写单条 audit（避免日志爆炸；metadata 列出 ids）
 */
export async function batchReleaseSubmissions(
  submissionIds: string[],
  user: UserLike,
  released: boolean,
): Promise<{ released: number; skipped: number }> {
  if (submissionIds.length === 0) return { released: 0, skipped: 0 };

  // 拉所有 + 各自的 instanceId
  const subs = await prisma.submission.findMany({
    where: { id: { in: submissionIds } },
    select: {
      id: true,
      status: true,
      taskInstanceId: true,
    },
  });

  // 权限校验：每个不重复的 instanceId 走一次 writable 校验
  const uniqueInstanceIds = Array.from(
    new Set(subs.map((s) => s.taskInstanceId).filter((x): x is string => !!x)),
  );
  for (const instanceId of uniqueInstanceIds) {
    await assertTaskInstanceWritable(instanceId, user);
  }

  // 独立任务（无 instance）回退到 readable 单独校验
  const standaloneSubs = subs.filter((s) => !s.taskInstanceId);
  for (const s of standaloneSubs) {
    await assertSubmissionReadable(s.id, user);
  }

  // 公布时仅 graded 才生效；撤回时所有都允许
  const eligible = released
    ? subs.filter((s) => s.status === "graded")
    : subs;
  const eligibleIds = eligible.map((s) => s.id);
  const skipped = subs.length - eligible.length;

  if (eligibleIds.length > 0) {
    await prisma.submission.updateMany({
      where: { id: { in: eligibleIds } },
      data: { releasedAt: released ? new Date() : null },
    });
  }

  await logAuditForced({
    action: released ? "submission_released_batch" : "submission_unreleased_batch",
    actorId: user.id,
    targetType: "submission",
    metadata: {
      requestedCount: submissionIds.length,
      affectedCount: eligibleIds.length,
      skippedCount: skipped,
      ids: eligibleIds.slice(0, 100), // 防 metadata 爆
    },
  });

  return { released: eligibleIds.length, skipped };
}

/**
 * 设置 task instance 的公布配置（mode + autoReleaseAt）。
 *
 * 校验：
 * - 教师写权
 * - mode = auto 时 autoReleaseAt 可选（null 表示立即公布等同 manual immediate）
 * - mode = manual 时 autoReleaseAt 会被忽略（依然存库以便切回 auto 时复用）
 */
export async function setInstanceReleaseMode(
  instanceId: string,
  user: UserLike,
  mode: "auto" | "manual",
  autoReleaseAt?: Date | null,
) {
  await assertTaskInstanceWritable(instanceId, user);

  // findUnique to ensure exists（assertTaskInstanceWritable 已校验，但这里要拿 prev value 写 audit）
  const existing = await prisma.taskInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, releaseMode: true, autoReleaseAt: true },
  });
  if (!existing) throw new Error("INSTANCE_NOT_FOUND");

  const updated = await prisma.taskInstance.update({
    where: { id: instanceId },
    data: {
      releaseMode: mode,
      ...(autoReleaseAt !== undefined && { autoReleaseAt }),
    },
  });

  await logAuditForced({
    action: "instance_release_mode_changed",
    actorId: user.id,
    targetId: instanceId,
    targetType: "taskInstance",
    metadata: {
      previousMode: existing.releaseMode,
      previousAutoReleaseAt: existing.autoReleaseAt?.toISOString() ?? null,
      newMode: mode,
      newAutoReleaseAt:
        autoReleaseAt === undefined
          ? existing.autoReleaseAt?.toISOString() ?? null
          : autoReleaseAt?.toISOString() ?? null,
    },
  });

  return updated;
}

/**
 * Cron 扫描：自动公布所有 releaseMode=auto + autoReleaseAt<=now + status=graded + releasedAt=null 的 submissions。
 *
 * 不依赖部署 cron 设施 — 用户 / admin 也可手动 GET /api/cron/release-submissions。
 */
export async function autoReleaseSubmissions(
  now?: Date,
): Promise<{ released: number; instances: number }> {
  const t = now ?? new Date();

  // 找出符合条件的 submission（jointed via taskInstance auto + 时间到）
  const eligible = await prisma.submission.findMany({
    where: {
      status: "graded",
      releasedAt: null,
      taskInstance: {
        releaseMode: "auto",
        autoReleaseAt: { lte: t },
      },
    },
    select: { id: true, taskInstanceId: true },
  });

  if (eligible.length === 0) {
    await logAuditForced({
      action: "auto_release_batch",
      // cron 触发，无 actorId（audit.service 类型为 optional string，留空写库）
      targetType: "submission",
      metadata: {
        scannedAt: t.toISOString(),
        affectedCount: 0,
        instanceCount: 0,
      },
    });
    return { released: 0, instances: 0 };
  }

  const instanceIds = new Set(
    eligible.map((s) => s.taskInstanceId).filter((x): x is string => !!x),
  );

  await prisma.submission.updateMany({
    where: { id: { in: eligible.map((s) => s.id) } },
    data: { releasedAt: t },
  });

  await logAuditForced({
    action: "auto_release_batch",
    // cron actorId omitted
    targetType: "submission",
    metadata: {
      scannedAt: t.toISOString(),
      affectedCount: eligible.length,
      instanceCount: instanceIds.size,
      ids: eligible.slice(0, 100).map((s) => s.id),
    },
  });

  return { released: eligible.length, instances: instanceIds.size };
}
