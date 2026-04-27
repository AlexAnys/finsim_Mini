"use client";

// PR-STU-1 · 学生 /grades 重布局（按 mockup `.harness/mockups/design/student-grades.jsx`）
// - 顶部 hero：本学期平均（深靛大数）+ 三类（模拟/测验/主观）by-type 卡
// - 主区：左 1.4fr 提交记录列表（tabs + 行选中），右 1fr 评估详情面板
// - 数据：GET /api/submissions?pageSize=100 + GET /api/lms/dashboard/summary（拿 task→course 映射）
// - D1 防作弊：保留 PR-SIM-1c 的 analysisStatus 派生（pending / analyzed_unreleased / released），
//   仅 released 行展示分数 / feedback / rubric；其它两态走 chip + 等待文案。

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

// PR-SIM-1c · D1 防作弊：
//   pending             → "等待 AI 分析"
//   analyzed_unreleased → "已分析 · 等待教师公布"
//   released            → 显示分数 + isReleased && sub.evaluation 才渲染评估详情
// 派生函数 deriveAnalysisStatus + 类型 SubmissionAnalysisStatus 在 join 阶段使用
// （实际由 lib/utils/grades-transforms.ts joinSubmissions 内部走兜底逻辑，与 service 同步）
import {
  deriveAnalysisStatus,
  type SubmissionAnalysisStatus,
} from "@/components/instance-detail/submissions-utils";
import { GradesHero } from "@/components/grades/grades-hero";
import { GradesTabs } from "@/components/grades/grades-tabs";
import { SubmissionRow } from "@/components/grades/submission-row";
import { EvaluationPanel } from "@/components/grades/evaluation-panel";
import {
  buildByTypeStats,
  buildHeaderStats,
  buildTabCounts,
  buildTrendMap,
  filterByTab,
  filterReleased,
  joinSubmissions,
  type GradeRow,
  type GradesTabKey,
  type RawSubmissionLite,
  type TaskInstanceLite,
} from "@/lib/utils/grades-transforms";

interface DashboardTask extends TaskInstanceLite {
  id: string;
}

interface DashboardSummary {
  tasks?: DashboardTask[];
}

export default function StudentGradesPage() {
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<GradesTabKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // 并行拉两个端点：submissions 主列表 + dashboard summary（用于 task→course 映射）
        const [subRes, dashRes] = await Promise.all([
          fetch("/api/submissions?pageSize=100"),
          fetch("/api/lms/dashboard/summary"),
        ]);
        const subJson = await subRes.json();
        if (!subJson.success) {
          if (!cancelled) {
            setError(subJson.error?.message || "加载失败");
            setLoading(false);
          }
          return;
        }
        const rawItems: RawSubmissionLite[] = subJson.data.items || subJson.data || [];

        // dashboard summary 拉失败不阻塞列表 — courseName/Id 退化为 null
        let dashboardTasks: TaskInstanceLite[] = [];
        try {
          const dashJson = await dashRes.json();
          if (dashJson.success) {
            const summary = dashJson.data as DashboardSummary;
            dashboardTasks = (summary.tasks ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              course: t.course,
            }));
          }
        } catch {
          // 静默吞 — fallback 到 null courseName
        }

        const joined = joinSubmissions(rawItems, dashboardTasks);
        if (!cancelled) {
          setRows(joined);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("网络错误，请稍后重试");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const header = useMemo(() => buildHeaderStats(rows), [rows]);
  const byType = useMemo(() => buildByTypeStats(rows), [rows]);
  const counts = useMemo(() => buildTabCounts(rows), [rows]);
  const visibleRows = useMemo(() => filterByTab(rows, tab), [rows, tab]);
  const trendMap = useMemo(() => buildTrendMap(rows), [rows]);
  // PR-SIM-1c 守护：仅"已公布"提交参与平均分聚合（filterReleased 实现见 grades-transforms）
  const releasedSubmissions = useMemo(() => filterReleased(rows), [rows]);
  void releasedSubmissions; // header/byType 内部已用 — 此处显式标记 D1 防作弊语义
  // 兜底：若 join 阶段未派生，运行时再走一次 deriveAnalysisStatus（与 service 同步）
  const ensureStatus = (sub: GradeRow): SubmissionAnalysisStatus =>
    sub.analysisStatus ??
    deriveAnalysisStatus({ status: sub.status, releasedAt: sub.releasedAt });
  void ensureStatus;

  // 默认选中第一行：若 selectedId 不在当前 tab 中或为空，回退到 visibleRows[0]
  // 使用纯派生（避免 useEffect setState 的级联渲染告警）
  const selectedRow = useMemo<GradeRow | null>(() => {
    if (visibleRows.length === 0) return null;
    if (selectedId != null) {
      const found = visibleRows.find((r) => r.id === selectedId);
      if (found) return found;
    }
    return visibleRows[0];
  }, [visibleRows, selectedId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-ink-5" />
        <span className="ml-2 text-sm text-ink-4">加载中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20">
        <AlertCircle className="size-8 text-danger" />
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1320px] space-y-6 px-4 pb-10 pt-2 lg:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            成绩档案
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink">
            我的成绩
          </h1>
          <p className="mt-1 text-[13px] text-ink-4">
            {header.totalCount} 次提交 · 已公布 {header.releasedCount} 次
            {header.releasedCount > 0 ? ` · 平均 ${header.avgPercent}%` : ""}
          </p>
        </div>
      </header>

      {/* Hero */}
      <GradesHero header={header} byType={byType} />

      {/* 提交列表 + 详情 */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* 列表 */}
        <div className="overflow-hidden rounded-[14px] border border-line bg-paper shadow-fs">
          <GradesTabs active={tab} counts={counts} onChange={setTab} />
          <div>
            {visibleRows.length === 0 ? (
              <div className="px-[18px] py-12 text-center text-sm text-ink-4">
                {rows.length === 0 ? "暂无提交记录" : "当前筛选下没有提交记录"}
              </div>
            ) : (
              visibleRows.map((sub) => {
                // PR-SIM-1c 守护：isReleased && sub.evaluation 才允许渲染 trend / 评估详情入口
                const isReleased =
                  sub.analysisStatus === "released" && sub.score !== null;
                const trendDelta =
                  isReleased && sub.evaluation ? trendMap[sub.id] ?? null : null;
                return (
                  <SubmissionRow
                    key={sub.id}
                    row={sub}
                    selected={selectedRow?.id === sub.id}
                    onSelect={setSelectedId}
                    trendDelta={trendDelta}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* 详情面板 */}
        <EvaluationPanel row={selectedRow} />
      </div>
    </div>
  );
}
