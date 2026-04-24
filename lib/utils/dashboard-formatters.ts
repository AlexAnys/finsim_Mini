export interface RelativeDueResult {
  label: string;
  isUrgent: boolean;
}

export function formatRelativeDue(
  dueAt: string | Date,
  now: Date = new Date(),
): RelativeDueResult {
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const msDiff = due.getTime() - now.getTime();
  const hoursDiff = msDiff / (1000 * 60 * 60);

  if (msDiff < 0) {
    return {
      label: `已过期 ${due.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}`,
      isUrgent: false,
    };
  }

  if (hoursDiff <= 24) {
    const sameDay = due.toDateString() === now.toDateString();
    const hh = String(due.getHours()).padStart(2, "0");
    const mm = String(due.getMinutes()).padStart(2, "0");
    return {
      label: sameDay ? `今晚 ${hh}:${mm} 截止` : `明天 ${hh}:${mm} 截止`,
      isUrgent: true,
    };
  }

  const daysDiff = Math.ceil(hoursDiff / 24);
  if (daysDiff <= 7) {
    return { label: `${daysDiff} 天后截止`, isUrgent: false };
  }

  return {
    label:
      due.toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) +
      " 截止",
    isUrgent: false,
  };
}

export function relativeTimeFromNow(
  iso: string | Date,
  now: Date = new Date(),
): string {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return minutes <= 0 ? "刚刚" : `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return then.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
