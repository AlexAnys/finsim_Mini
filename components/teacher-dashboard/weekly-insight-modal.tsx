"use client";

import { Loader2, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface WeeklyInsightUiPayload {
  weakConceptsByCourse: Array<{
    courseId: string;
    courseTitle: string;
    concepts: Array<{
      tag: string;
      errorRate: number;
      exampleStudents: string[];
    }>;
  }>;
  classDifferences: Array<{
    classId: string;
    className: string;
    avgScore: number | null;
    summary: string;
  }>;
  studentClusters: Array<{
    label: string;
    size: number;
    characteristics: string;
  }>;
  upcomingClassRecommendations: Array<{
    scheduleSlotId: string;
    courseTitle: string;
    date: string;
    recommendation: string;
  }>;
  highlightSummary: string;
}

export interface WeeklyInsightUiResult {
  payload: WeeklyInsightUiPayload;
  generatedAt: string | Date;
  windowStart: string | Date;
  windowEnd: string | Date;
  submissionCount: number;
  cached: boolean;
}

interface WeeklyInsightModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WeeklyInsightUiResult | null;
  loading: boolean;
  error: string | null;
  onRegenerate: () => void;
}

function fmtDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function fmtPercent(rate: number): string {
  if (Number.isNaN(rate)) return "-";
  return `${Math.round(rate * 100)}%`;
}

export function WeeklyInsightModal({
  open,
  onOpenChange,
  data,
  loading,
  error,
  onRegenerate,
}: WeeklyInsightModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"
        aria-describedby="weekly-insight-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink">
            <Sparkles className="size-[16px] text-ochre" aria-hidden />
            一周洞察
          </DialogTitle>
          <DialogDescription id="weekly-insight-desc" className="text-ink-3">
            基于过去 7 天已批改并已公布的提交，结合接下来 7 天课表，生成跨课程 / 班级 / 任务的教学聚合视图。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Loader2 className="size-6 animate-spin text-ink-5" aria-label="加载中" />
            <p className="text-sm text-ink-4">正在生成本周洞察...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <AlertCircle className="size-6 text-danger" aria-hidden />
            <p className="text-sm text-danger">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              className="mt-2"
            >
              重试
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 元数据条 */}
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-4">
              <span>
                时间窗口 {fmtDate(data.windowStart)} ~ {fmtDate(data.windowEnd)}
              </span>
              <span className="text-ink-5">·</span>
              <span>本周纳入 {data.submissionCount} 份提交</span>
              {data.cached && (
                <Badge variant="secondary" className="text-[11px]">
                  缓存（1h）
                </Badge>
              )}
            </div>

            {/* Section 1: 本周亮点摘要 */}
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-ink">
                本周亮点摘要
              </h3>
              <div
                className="rounded-lg bg-paper-alt p-4 text-[13px] leading-[1.6] text-ink-2"
                style={{ border: "1px solid var(--fs-line)" }}
              >
                {data.payload.highlightSummary || "暂无摘要"}
              </div>
            </section>

            {/* Section 2: 各课弱点概念聚合 */}
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-ink">
                各课弱点概念聚合
              </h3>
              {data.payload.weakConceptsByCourse.length === 0 ? (
                <p className="text-[12.5px] text-ink-4">暂无可聚合的弱点概念</p>
              ) : (
                <div className="space-y-3">
                  {data.payload.weakConceptsByCourse.map((course) => (
                    <div
                      key={course.courseId}
                      className="rounded-lg bg-paper p-3"
                      style={{ border: "1px solid var(--fs-line)" }}
                    >
                      <div className="mb-2 text-[13px] font-medium text-ink">
                        {course.courseTitle}
                      </div>
                      {course.concepts.length === 0 ? (
                        <p className="text-[12px] text-ink-4">暂无</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {course.concepts.map((c) => (
                            <li
                              key={`${course.courseId}-${c.tag}`}
                              className="flex flex-wrap items-center gap-2 text-[12.5px]"
                            >
                              <Badge variant="outline" className="text-[11px]">
                                {c.tag}
                              </Badge>
                              <span className="text-ink-3">
                                出错率 {fmtPercent(c.errorRate)}
                              </span>
                              {c.exampleStudents.length > 0 && (
                                <span className="text-ink-4">
                                  · 涉及：{c.exampleStudents.slice(0, 3).join("、")}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: 班级差异 + 学生聚类 */}
            <section className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-[14px] font-semibold text-ink">
                  班级差异
                </h3>
                {data.payload.classDifferences.length === 0 ? (
                  <p className="text-[12.5px] text-ink-4">暂无班级差异数据</p>
                ) : (
                  <ul className="space-y-2">
                    {data.payload.classDifferences.map((c) => (
                      <li
                        key={c.classId}
                        className="rounded-md bg-paper p-3"
                        style={{ border: "1px solid var(--fs-line)" }}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-ink">
                            {c.className}
                          </span>
                          <span className="text-[11px] text-ink-4">
                            均分 {c.avgScore !== null ? c.avgScore.toFixed(1) : "暂无"}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.5] text-ink-3">
                          {c.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-[14px] font-semibold text-ink">
                  学生聚类
                </h3>
                {data.payload.studentClusters.length === 0 ? (
                  <p className="text-[12.5px] text-ink-4">暂无学生聚类数据</p>
                ) : (
                  <ul className="space-y-2">
                    {data.payload.studentClusters.map((c, i) => (
                      <li
                        key={`${c.label}-${i}`}
                        className="rounded-md bg-paper p-3"
                        style={{ border: "1px solid var(--fs-line)" }}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-ink">
                            {c.label}
                          </span>
                          <span className="text-[11px] text-ink-4">
                            {c.size} 人
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-[1.5] text-ink-3">
                          {c.characteristics}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Section 4: 接下来 N 节课的教学建议 */}
            <section>
              <h3 className="mb-2 text-[14px] font-semibold text-ink">
                接下来课堂的教学建议
              </h3>
              {data.payload.upcomingClassRecommendations.length === 0 ? (
                <p className="text-[12.5px] text-ink-4">未来 7 天暂无相关课堂</p>
              ) : (
                <ul className="space-y-2">
                  {data.payload.upcomingClassRecommendations.map((u) => (
                    <li
                      key={u.scheduleSlotId}
                      className="rounded-md bg-brand-soft/40 p-3"
                      style={{ border: "1px solid var(--fs-line)" }}
                    >
                      <div className="flex flex-wrap items-baseline gap-2 text-[12.5px]">
                        <span className="font-medium text-ink">
                          {u.courseTitle}
                        </span>
                        <span className="text-ink-4">{u.date}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-[1.5] text-ink-2">
                        {u.recommendation}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-ink-4">暂无数据</p>
        )}

        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className="size-[12px]" aria-hidden />
            重新生成
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
