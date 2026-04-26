"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Quote,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InsightsCommonIssue {
  title: string;
  description: string;
  studentCount: number;
}

export interface InsightsHighlight {
  submissionId: string;
  studentName: string;
  quote: string;
}

export interface InsightsWeaknessConcept {
  tag: string;
  count: number;
}

export interface InsightsCachedResponse {
  cached: boolean;
  commonIssues:
    | {
        commonIssues: InsightsCommonIssue[];
        highlights: InsightsHighlight[];
        weaknessConcepts: InsightsWeaknessConcept[];
      }
    | null;
  aggregatedAt: string | null;
  studentCount: number;
}

export interface InsightsTabProps {
  instanceId: string;
  onExplainConcept?: (tag: string) => void;
}

export function InsightsTab({ instanceId, onExplainConcept }: InsightsTabProps) {
  const [data, setData] = useState<InsightsCachedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCached = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/lms/task-instances/${instanceId}/insights/aggregate`
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "加载失败");
        return;
      }
      setData(json.data);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    fetchCached();
  }, [fetchCached]);

  const handleAggregate = useCallback(async () => {
    setAggregating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/lms/task-instances/${instanceId}/insights/aggregate`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "生成洞察失败");
        return;
      }
      setData({
        cached: false,
        commonIssues: json.data.commonIssues,
        aggregatedAt: json.data.aggregatedAt,
        studentCount: json.data.studentCount,
      });
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setAggregating(false);
    }
  }, [instanceId]);

  const aggregatedAtLabel = data?.aggregatedAt
    ? new Date(data.aggregatedAt).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const issues = data?.commonIssues?.commonIssues ?? [];
  const highlights = data?.commonIssues?.highlights ?? [];
  const weaknesses = data?.commonIssues?.weaknessConcepts ?? [];

  return (
    <div
      id="tabpanel-insights"
      role="tabpanel"
      aria-labelledby="tab-insights"
      className="space-y-4"
    >
      {/* Trigger card */}
      <section className="flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-sim-soft text-sim">
            <Sparkles className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">AI 班级洞察</div>
            <p className="mt-0.5 text-[12px] text-ink-4">
              {aggregatedAtLabel
                ? `最近一次生成于 ${aggregatedAtLabel} · 基于 ${data?.studentCount ?? 0} 份提交`
                : "尚未生成 · 点击右侧按钮触发 AI 聚合（约需 30 秒）"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleAggregate}
          disabled={aggregating || loading}
        >
          {aggregating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : aggregatedAtLabel ? (
            <RefreshCw className="size-3" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {aggregatedAtLabel ? "重新生成" : "生成洞察"}
        </Button>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-ink-4">
          <Loader2 className="mr-2 size-4 animate-spin" /> 加载中...
        </div>
      ) : !data?.commonIssues ? (
        <div className="rounded-xl border border-dashed border-line bg-surface py-12 text-center">
          <Sparkles className="mx-auto size-8 text-ink-5" />
          <div className="mt-3 text-sm font-medium text-ink-3">
            还没有 AI 洞察
          </div>
          <p className="mt-1 text-[12px] text-ink-5">
            等学生提交并完成 AI 批改后，点击&ldquo;生成洞察&rdquo;即可
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {/* Left column: Common issues */}
          <section className="rounded-xl border border-line bg-surface p-5">
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-ink">共性问题</h2>
              <span className="text-[11px] text-ink-5">
                Top {issues.length}
              </span>
            </header>
            {issues.length === 0 ? (
              <div className="rounded-md border border-dashed border-line py-6 text-center text-[12px] text-ink-5">
                暂未发现明显共性问题
              </div>
            ) : (
              <ol className="space-y-3">
                {issues.map((issue, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-line-2 bg-paper-alt p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-[12px] font-bold tabular-nums text-paper">
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[13px] font-semibold text-ink">
                            {issue.title}
                          </h3>
                          {typeof issue.studentCount === "number" && (
                            <span className="rounded bg-warn px-1.5 py-0.5 text-[10px] font-bold text-paper tabular-nums">
                              {issue.studentCount} 名学生
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
                          {issue.description}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Right column: Highlights + Weaknesses */}
          <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">亮点片段</h2>
              {highlights.length === 0 ? (
                <div className="rounded-md border border-dashed border-line py-4 text-center text-[12px] text-ink-5">
                  暂无亮点
                </div>
              ) : (
                <ul className="space-y-3">
                  {highlights.map((h, i) => (
                    <li
                      key={i}
                      className="rounded-md border-l-2 border-l-success bg-paper-alt p-3"
                    >
                      <div className="flex items-start gap-2">
                        <Quote className="mt-0.5 size-3 shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] leading-relaxed text-ink-2">
                            {h.quote}
                          </p>
                          <div className="mt-1 text-[11px] text-ink-5">
                            — {h.studentName}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">薄弱概念</h2>
              {weaknesses.length === 0 ? (
                <div className="rounded-md border border-dashed border-line py-4 text-center text-[12px] text-ink-5">
                  无标记数据
                </div>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {weaknesses.map((w) => (
                    <li key={w.tag}>
                      <button
                        type="button"
                        onClick={() => onExplainConcept?.(w.tag)}
                        className="inline-flex items-center gap-1 rounded-md border border-line bg-paper-alt px-2 py-1 text-[11.5px] text-ink-2 transition hover:border-brand hover:text-brand"
                        title={`${w.count} 名学生涉及 — 点击生成讲解`}
                      >
                        <span>#{w.tag}</span>
                        <span className="rounded bg-surface px-1 text-[10px] tabular-nums text-ink-5">
                          {w.count}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
