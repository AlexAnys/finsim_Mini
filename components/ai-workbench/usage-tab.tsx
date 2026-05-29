"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AiRunRow {
  id: string;
  feature: string;
  provider: string;
  model: string;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstUSD: number | null;
  latencyMs: number | null;
  summary: string | null;
  error: string | null;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
}

interface AggregateRow {
  feature: string;
  count: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUSD: number;
  runsWithoutCost: number;
}

interface ApiResult {
  items: AiRunRow[];
  total: number;
  aggregateByFeature: AggregateRow[];
}

const FEATURE_LABEL: Record<string, string> = {
  weeklyInsight: "一周洞察",
  scopeInsights: "数据洞察",
  scopeTeachingAdvice: "教学建议",
  simulation: "模拟对话",
  evaluation: "AI 批改",
  taskBuild: "任务生成",
  outline: "大纲生成",
  insights: "聚合洞察",
  lessonPolish: "教案优化",
  importParse: "导入解析",
  examCheck: "考题校验",
  questionAnalysis: "题目分析",
  ideologyMining: "思政挖掘",
};

const STATUS_LABEL: Record<string, string> = {
  running: "进行中",
  succeeded: "成功",
  failed: "失败",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  running: "outline",
  succeeded: "secondary",
  failed: "destructive",
};

function fmtCost(cny: number | null): string {
  if (cny == null) return "—";
  if (cny === 0) return "¥0";
  return `¥${cny.toFixed(4)}`;
}

function fmtTokens(n: number | null): string {
  if (n == null) return "—";
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

function fmtLatency(ms: number | null): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(2)}s`;
}

export function UsageTab() {
  const [data, setData] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [featureFilter, setFeatureFilter] = useState<string>("");

  async function load() {
    setLoading(true);
    setErrMsg(null);
    try {
      const url = new URL("/api/lms/ai-usage", window.location.origin);
      if (featureFilter) url.searchParams.set("feature", featureFilter);
      url.searchParams.set("take", "50");
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!json.success) {
        setErrMsg(json.error?.message ?? "加载失败");
        return;
      }
      setData(json.data as ApiResult);
    } catch {
      setErrMsg("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureFilter]);

  const totalCost = useMemo(() => {
    if (!data) return 0;
    return data.aggregateByFeature.reduce((sum, r) => sum + r.totalCostUSD, 0);
  }, [data]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            <Sparkles className="size-3.5" />
            AI 使用记录
          </div>
          <h2 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-ink">
            AI 用量
          </h2>
          <p className="mt-1 text-[13px] text-ink-4">
            查看你触发的每一次 AI 调用，含 token 数、估算成本、耗时与原始 prompt 摘要。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </header>

      <section>
        <h3 className="mb-2 text-[14px] font-semibold text-ink">按功能聚合（仅 succeeded）</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-ink-4">
            <Loader2 className="size-4 animate-spin" /> 加载中...
          </div>
        ) : errMsg ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4" /> {errMsg}
          </div>
        ) : !data || data.aggregateByFeature.length === 0 ? (
          <p className="text-[13px] text-ink-4">暂无聚合数据</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-brand-soft/40">
              <CardHeader className="pb-1">
                <CardTitle className="text-[12.5px] font-medium text-ink-3">本期总估算成本</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="fs-num text-[20px] font-semibold text-brand">{fmtCost(totalCost)}</div>
                <div className="mt-1 text-[11px] text-ink-4">
                  共 {data.aggregateByFeature.reduce((s, r) => s + r.count, 0)} 次成功调用
                </div>
              </CardContent>
            </Card>
            {data.aggregateByFeature.map((agg) => (
              <Card key={agg.feature}>
                <CardHeader className="pb-1">
                  <CardTitle className="text-[12.5px] font-medium text-ink-3">
                    {FEATURE_LABEL[agg.feature] ?? agg.feature}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="fs-num text-[18px] font-semibold text-ink">{fmtCost(agg.totalCostUSD)}</div>
                  <div className="mt-1 text-[11px] text-ink-4">
                    {agg.count} 次 · in {fmtTokens(agg.totalInputTokens)} · out {fmtTokens(agg.totalOutputTokens)}
                  </div>
                  {agg.runsWithoutCost > 0 && (
                    <div className="mt-0.5 text-[10.5px] text-ink-5">
                      {agg.runsWithoutCost} 次成本未估算（模型不在价目表）
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-ink">调用明细</h3>
          <div className="flex items-center gap-2 text-[12px]">
            <label className="text-ink-4">功能筛选：</label>
            <select
              className="rounded-md border border-line-2 bg-paper px-2 py-1 text-[12px]"
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
            >
              <option value="">全部</option>
              {Object.keys(FEATURE_LABEL).map((k) => (
                <option key={k} value={k}>
                  {FEATURE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </header>

        {!data || data.items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-4">
              暂无 AI 调用记录
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.items.map((r) => (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="space-y-1.5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10.5px]">
                      {FEATURE_LABEL[r.feature] ?? r.feature}
                    </Badge>
                    <Badge variant="secondary" className="text-[10.5px]">
                      {r.provider}:{r.model}
                    </Badge>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="text-[10.5px]">
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                    <span className="ml-auto text-[11px] text-ink-4">
                      {new Date(r.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-3">
                    <span>耗时 {fmtLatency(r.latencyMs)}</span>
                    <span className="text-ink-5">·</span>
                    <span>输入 {fmtTokens(r.inputTokens)} tokens</span>
                    <span className="text-ink-5">·</span>
                    <span>输出 {fmtTokens(r.outputTokens)} tokens</span>
                    <span className="text-ink-5">·</span>
                    <span>成本 {fmtCost(r.costEstUSD)}</span>
                  </div>
                  {r.summary && (
                    <div className="line-clamp-2 break-words rounded-md bg-paper-alt p-2 text-[11.5px] leading-relaxed text-ink-3">
                      {r.summary}
                    </div>
                  )}
                  {r.error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11.5px] leading-relaxed text-destructive">
                      错误：{r.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            <div className="text-[11px] text-ink-5">共 {data.total} 条记录</div>
          </div>
        )}
      </section>
    </div>
  );
}
