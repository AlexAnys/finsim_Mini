"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { Search, Download, Sparkles, AlertCircle } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  filterSubmissions,
  formatDuration,
  scoreDiff,
  sortSubmissions,
  statusCounts,
  type NormalizedSubmission,
  type SubmissionFilterKey,
  type SubmissionSortKey,
} from "./submissions-utils";

const VIRTUALIZE_THRESHOLD = 50;
const ROW_HEIGHT = 64;
const TABLE_GRID_COLS =
  "grid-cols-[40px_minmax(180px,1.6fr)_100px_80px_80px_120px_120px_120px]";
const TABLE_MIN_WIDTH = "min-w-[820px]";

const statusBadge: Record<string, { label: string; cls: string }> = {
  submitted: { label: "待批改", cls: "bg-paper-alt text-ink-3" },
  grading: { label: "批改中", cls: "bg-warn-soft text-warn" },
  graded: { label: "已出分", cls: "bg-success-soft text-success-deep" },
  failed: { label: "批改失败", cls: "bg-danger-soft text-danger" },
};

const filterTabs: Array<{ key: SubmissionFilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "submitted", label: "待批改" },
  { key: "grading", label: "批改中" },
  { key: "graded", label: "已出分" },
];

function avatarBg(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 88%)`;
}

interface SubmissionRowProps {
  row: NormalizedSubmission;
  index: number;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenGrading: (id: string) => void;
  height?: number;
}

function SubmissionRow({
  row,
  selected,
  onToggleSelect,
  onOpenGrading,
  height,
}: SubmissionRowProps) {
  const status = statusBadge[row.status] || statusBadge.submitted;
  const diff = scoreDiff(row.score, row.aiScore);
  const submittedAt = new Date(row.submittedAt).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      style={{ height: height ? `${height}px` : undefined }}
      className={`grid ${TABLE_GRID_COLS} items-center gap-3 border-b border-line-2 px-4 py-2 hover:bg-paper-alt/60`}
    >
      <div className="flex items-center justify-center">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(row.id)}
          aria-label={`选择 ${row.studentName}`}
        />
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-md text-[12px] font-semibold text-ink-2"
          style={{ background: avatarBg(row.studentId) }}
          aria-hidden
        >
          {row.studentName.slice(-2)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-ink">
            {row.studentName}
          </div>
          <div className="text-[11px] tabular-nums text-ink-5">
            {formatDuration(row.durationSeconds)}
          </div>
        </div>
      </div>
      <div>
        <span
          className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}
        >
          {status.label}
        </span>
      </div>
      <div className="text-right tabular-nums">
        {row.score == null ? (
          <span className="text-ink-5">—</span>
        ) : (
          <span className="text-[14px] font-bold text-ink">
            {row.score}
            <span className="ml-0.5 text-[11px] font-medium text-ink-5">
              /{row.maxScore ?? 100}
            </span>
          </span>
        )}
      </div>
      <div className="text-right tabular-nums">
        {row.aiScore == null ? (
          <span className="text-ink-5">—</span>
        ) : (
          <span className="text-[13px] font-medium text-ink-3">{row.aiScore}</span>
        )}
      </div>
      <div className="text-[11.5px] tabular-nums">
        {diff != null ? (
          <span
            className={`inline-flex items-center rounded px-1.5 py-0.5 ${
              Math.abs(diff) > 5
                ? "bg-warn-soft text-warn"
                : "bg-paper-alt text-ink-4"
            }`}
          >
            {diff > 0 ? "+" : ""}
            {diff}
          </span>
        ) : (
          <span className="text-ink-5">—</span>
        )}
      </div>
      <div className="text-[11.5px] tabular-nums text-ink-4">{submittedAt}</div>
      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="xs"
          variant={row.status === "graded" ? "outline" : "default"}
          onClick={() => onOpenGrading(row.id)}
        >
          {row.status === "graded" ? "复评" : "批改"}
        </Button>
      </div>
    </div>
  );
}

export interface SubmissionsTabProps {
  rows: NormalizedSubmission[];
  loading: boolean;
  onOpenGrading: (submissionId: string) => void;
  onExport: () => void;
  onBulkGrade?: (ids: string[]) => void;
}

export function SubmissionsTab({
  rows,
  loading,
  onOpenGrading,
  onExport,
  onBulkGrade,
}: SubmissionsTabProps) {
  const [filter, setFilter] = useState<SubmissionFilterKey>("all");
  const [sort, setSort] = useState<SubmissionSortKey>("time-desc");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => statusCounts(rows), [rows]);

  const visibleRows = useMemo(() => {
    return sortSubmissions(filterSubmissions(rows, filter, query), sort);
  }, [rows, filter, query, sort]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // PR-FIX-3 UX3: checkbox 显示"全选未批改" + checked 状态基于 eligible rows（非 graded）
  // 之前 bug: every() 含 graded 行 → 永远 false（toggleSelectAll 又只选 ungraded） →
  // checkbox 永远不显示"已勾选"状态，UX 不一致。
  const eligibleRows = useMemo(
    () => visibleRows.filter((r) => r.status !== "graded"),
    [visibleRows],
  );
  const allEligibleSelected =
    eligibleRows.length > 0 && eligibleRows.every((r) => selected.has(r.id));
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allEligibleSelected) {
        for (const r of eligibleRows) next.delete(r.id);
      } else {
        for (const r of eligibleRows) next.add(r.id);
      }
      return next;
    });
  }, [allEligibleSelected, eligibleRows]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const useVirtual = visibleRows.length > VIRTUALIZE_THRESHOLD;
  const virtualizer = useVirtualizer({
    count: useVirtual ? visibleRows.length : 0,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const handleBulkGrade = () => {
    if (!onBulkGrade || selected.size === 0) return;
    onBulkGrade(Array.from(selected));
  };

  return (
    <div
      id="tabpanel-submissions"
      role="tabpanel"
      aria-labelledby="tab-submissions"
      className="space-y-3"
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3 -translate-y-1/2 text-ink-5" />
          <input
            type="search"
            placeholder="搜索学生姓名"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-line bg-paper-alt py-1.5 pl-8 pr-3 text-xs text-ink outline-none focus:border-brand"
          />
        </div>

        <div className="flex gap-1 rounded-md bg-paper-alt p-0.5">
          {filterTabs.map((t) => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11.5px] font-medium ${
                  active
                    ? "bg-surface text-ink shadow-sm"
                    : "text-ink-4 hover:text-ink-2"
                }`}
              >
                {t.label}
                <span
                  className={`tabular-nums rounded px-1 text-[10px] ${
                    active ? "bg-paper-alt text-ink-5" : "text-ink-5"
                  }`}
                >
                  {counts[t.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SubmissionSortKey)}
          className="rounded-md border border-line bg-paper-alt px-2 py-1.5 text-xs text-ink-3"
        >
          <option value="time-desc">最新提交</option>
          <option value="time-asc">最早提交</option>
          <option value="score-desc">分数从高到低</option>
          <option value="score-asc">分数从低到高</option>
          <option value="name">姓名</option>
        </select>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="size-3" />
          导出
        </Button>
        {onBulkGrade && (
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={handleBulkGrade}
          >
            <Sparkles className="size-3" />
            批量批改 {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <div className={TABLE_MIN_WIDTH}>
            {/* Header row */}
            <div
              className={`grid ${TABLE_GRID_COLS} items-center gap-3 border-b border-line bg-paper-alt px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.8px] text-ink-5`}
            >
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={allEligibleSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="全选未批改"
                  disabled={eligibleRows.length === 0}
                />
              </div>
              <div>学生 / 用时</div>
              <div>状态</div>
              <div className="text-right">教师分</div>
              <div className="text-right">AI 初判</div>
              <div>分差</div>
              <div>提交时间</div>
              <div className="text-right">操作</div>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-ink-4">加载中...</div>
            ) : visibleRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <AlertCircle className="size-7 text-ink-5" />
                <p className="text-sm text-ink-4">
                  {rows.length === 0 ? "暂无提交记录" : "无匹配的记录"}
                </p>
              </div>
            ) : useVirtual ? (
              <div
                ref={scrollerRef}
                className="max-h-[640px] overflow-y-auto"
                style={{ contain: "strict" }}
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {virtualizer.getVirtualItems().map((vi) => {
                    const row = visibleRows[vi.index];
                    return (
                      <div
                        key={row.id}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${vi.start}px)`,
                        }}
                      >
                        <SubmissionRow
                          row={row}
                          index={vi.index}
                          selected={selected.has(row.id)}
                          onToggleSelect={toggleSelect}
                          onOpenGrading={onOpenGrading}
                          height={ROW_HEIGHT}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                {visibleRows.map((row, idx) => (
                  <SubmissionRow
                    key={row.id}
                    row={row}
                    index={idx}
                    selected={selected.has(row.id)}
                    onToggleSelect={toggleSelect}
                    onOpenGrading={onOpenGrading}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line bg-paper-alt px-4 py-2 text-[11.5px] text-ink-5">
          <span>
            显示 {visibleRows.length} 条 · 共 {rows.length} 份
            {useVirtual && (
              <span className="ml-2 text-[10px] text-brand">虚拟化</span>
            )}
          </span>
          {selected.size > 0 && (
            <span className="text-ink-3">
              已选 <b className="text-ink">{selected.size}</b> 项
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
