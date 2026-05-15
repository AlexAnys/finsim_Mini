/**
 * Unit 17 · 学生 runner 优先读 instance.taskSnapshot 字段
 *
 * 教师改 task 模板后，正在跑的 instance 不应让学生看到新题。
 * publish 时刻 service 已写 instance.taskSnapshot；本 helper 在前端入口
 * 优先返回 snapshot 数据，老 instance（snapshot 缺失）fallback 到 live task。
 *
 * 校验阈值：snapshot 是 object 且有 taskName 字段 → 视为有效。
 */

interface TaskShape {
  id?: string;
  taskName?: string;
  taskType?: string;
  [k: string]: unknown;
}

export interface ResolvedTaskForRunner<T extends TaskShape> {
  task: T;
  /** true → 来自 taskSnapshot（publish 时刻冻结）；false → 来自 live task */
  fromSnapshot: boolean;
}

function isValidSnapshot(value: unknown): value is TaskShape {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.taskName === "string" && obj.taskName.length > 0;
}

export function resolveTaskForRunner<T extends TaskShape>(instance: {
  taskSnapshot: unknown;
  task: T;
}): ResolvedTaskForRunner<T> {
  if (isValidSnapshot(instance.taskSnapshot)) {
    return { task: instance.taskSnapshot as T, fromSnapshot: true };
  }
  if (instance.taskSnapshot !== null && instance.taskSnapshot !== undefined) {
    console.warn(
      "[task-snapshot] taskSnapshot exists but invalid shape, falling back to live task",
    );
  }
  return { task: instance.task, fromSnapshot: false };
}
