"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface AuditRow {
  id: string;
  action: string;
  actorId: string | null;
  targetId: string | null;
  targetType: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorEmail: string | null;
  actorName: string | null;
}

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
  userEmail: string | null;
  userName: string | null;
}

type TabKey = "audit" | "ai";

export default function AdminAuditPage() {
  const [tab, setTab] = useState<TabKey>("audit");
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [aiRows, setAiRows] = useState<AiRunRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function load(currentTab: TabKey) {
    setLoading(true);
    setErrMsg(null);
    try {
      const url = new URL("/api/admin/audit", window.location.origin);
      url.searchParams.set("tab", currentTab);
      url.searchParams.set("take", "100");
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!json.success) {
        setErrMsg(json.error?.message ?? "加载失败");
        return;
      }
      if (currentTab === "audit") {
        setAuditRows((json.data?.items ?? []) as AuditRow[]);
      } else {
        setAiRows((json.data?.items ?? []) as AiRunRow[]);
      }
      setTotal(json.data?.total ?? 0);
    } catch {
      setErrMsg("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(tab);
  }, [tab]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-10 pt-2 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            <ShieldAlert className="size-3.5" />
            审计中心
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink">
            管理员审计
          </h1>
          <p className="mt-1 text-[13px] text-ink-4">
            跨教师查看 AuditLog 与 AiRun。仅管理员可见。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(tab)}>
          刷新
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="audit">敏感操作日志</TabsTrigger>
          <TabsTrigger value="ai">AI 调用记录</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-4">
          <Loader2 className="size-5 animate-spin" /> 加载中...
        </div>
      ) : errMsg ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" /> {errMsg}
        </div>
      ) : tab === "audit" ? (
        auditRows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-4">
              暂无审计日志
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {auditRows.map((r) => (
              <Card key={r.id} className="overflow-hidden">
                <CardContent className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10.5px]">
                      {r.action}
                    </Badge>
                    {r.targetType && (
                      <Badge variant="secondary" className="text-[10.5px]">
                        {r.targetType}
                      </Badge>
                    )}
                    <span className="ml-auto text-[11px] text-ink-4">
                      {new Date(r.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="text-[12px] text-ink-3">
                    操作者：{r.actorName ?? r.actorEmail ?? r.actorId ?? "（系统）"} ·
                    目标 ID：{r.targetId ?? "-"}
                  </div>
                  {r.metadata && Object.keys(r.metadata).length > 0 && (
                    <pre className="break-all rounded-md bg-paper-alt p-2 text-[10.5px] text-ink-4">
                      {JSON.stringify(r.metadata, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            ))}
            <div className="text-[11px] text-ink-5">共 {total} 条审计记录</div>
          </div>
        )
      ) : aiRows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-4">
            暂无 AI 调用记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {aiRows.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="space-y-1 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10.5px]">
                    {r.feature}
                  </Badge>
                  <Badge variant="secondary" className="text-[10.5px]">
                    {r.provider}:{r.model}
                  </Badge>
                  <Badge
                    variant={r.status === "succeeded" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}
                    className="text-[10.5px]"
                  >
                    {r.status}
                  </Badge>
                  <span className="ml-auto text-[11px] text-ink-4">
                    {new Date(r.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>
                <div className="text-[12px] text-ink-3">
                  用户：{r.userName ?? r.userEmail ?? "—"} ·
                  耗时 {r.latencyMs != null ? `${(r.latencyMs / 1000).toFixed(2)}s` : "—"} ·
                  in {r.inputTokens ?? "—"} / out {r.outputTokens ?? "—"} tokens ·
                  成本 {r.costEstUSD != null ? `$${r.costEstUSD.toFixed(4)}` : "—"}
                </div>
                {r.summary && (
                  <div className="line-clamp-2 rounded-md bg-paper-alt p-2 text-[11.5px] leading-relaxed text-ink-3">
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
          <div className="text-[11px] text-ink-5">共 {total} 条 AI 调用</div>
        </div>
      )}
    </div>
  );
}
