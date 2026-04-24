export interface OverviewStats {
  assigned: number;
  submitted: number;
  grading: number;
  graded: number;
}

export interface FunnelEntry {
  key: "assigned" | "submitted" | "grading" | "graded";
  label: string;
  value: number;
  sub: string;
  pct: number;
  barClass: string;
}

export function pctLabel(v: number): string {
  if (!isFinite(v) || isNaN(v)) return "0%";
  return `${Math.round(v * 100)}%`;
}

export function buildFunnel(stats: OverviewStats): FunnelEntry[] {
  const { assigned, submitted, grading, graded } = stats;
  const denomAssigned = assigned > 0 ? assigned : 1;
  const denomSubmitted = submitted > 0 ? submitted : 1;
  const subRate = submitted / denomAssigned;
  const gradingRate = grading / denomAssigned;
  const gradedRate = graded / denomSubmitted;

  return [
    {
      key: "assigned",
      label: "已指派",
      value: assigned,
      sub: "班级全员",
      pct: 1,
      barClass: "bg-ink-4",
    },
    {
      key: "submitted",
      label: "已提交",
      value: submitted,
      sub: `${pctLabel(subRate)} 到交率`,
      pct: subRate,
      barClass: "bg-brand",
    },
    {
      key: "grading",
      label: "批改中",
      value: grading,
      sub: "AI + 教师流转中",
      pct: gradingRate,
      barClass: "bg-warn",
    },
    {
      key: "graded",
      label: "已出分",
      value: graded,
      sub: `${pctLabel(gradedRate)} 完成批改`,
      pct: gradedRate,
      barClass: "bg-success",
    },
  ];
}

export type CountdownTone = "danger" | "warn" | "ink";

export interface CountdownResult {
  text: string;
  tone: CountdownTone;
}

export function formatCountdown(dueIso: string, now: number = Date.now()): CountdownResult {
  const due = new Date(dueIso).getTime();
  if (isNaN(due)) return { text: "-", tone: "ink" };
  const diff = due - now;
  if (diff < 0) return { text: "已截止", tone: "danger" };
  const totalHours = diff / 3600000;
  if (totalHours < 24) {
    const h = Math.floor(totalHours);
    const m = Math.floor((totalHours - h) * 60);
    return { text: `剩余 ${h} 小时 ${m} 分钟`, tone: "warn" };
  }
  const days = Math.floor(totalHours / 24);
  if (days < 3) return { text: `剩余 ${days} 天`, tone: "warn" };
  return { text: `剩余 ${days} 天`, tone: "ink" };
}
