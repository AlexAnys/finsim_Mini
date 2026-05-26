"use client";

import { useEffect, useState } from "react";
import { Loader2, Inbox, AlertCircle, Bug, Lightbulb, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

interface CapturedError {
  message: string;
  source?: string;
  at?: string;
}

interface CapturedElement {
  text?: string;
  ariaLabel?: string;
  testId?: string;
  role?: string;
  domPath?: string;
}

interface FeedbackContextData {
  sourcePath?: string;
  routeIds?: Record<string, string>;
  dialog?: { title: string; step?: string } | null;
  pageTitle?: string;
  element?: CapturedElement | null;
}

interface FeedbackRow {
  id: string;
  userId: string;
  userRole: string;
  type: "issue" | "feature";
  content: string;
  pageUrl: string;
  screenshot: string | null;
  recentErrors: CapturedError[] | null;
  context: FeedbackContextData | null;
  viewport: string | null;
  userAgent: string | null;
  status: "new" | "handled";
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
}

type StatusFilter = "all" | "new" | "handled";

const ROLE_LABEL: Record<string, string> = {
  student: "学生",
  teacher: "老师",
  admin: "管理员",
};

export default function AdminFeedbackPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [shotPreview, setShotPreview] = useState<string | null>(null);

  async function load(currentFilter: StatusFilter) {
    setLoading(true);
    setErrMsg(null);
    try {
      const url = new URL("/api/feedback", window.location.origin);
      if (currentFilter !== "all") url.searchParams.set("status", currentFilter);
      url.searchParams.set("take", "100");
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!json.success) {
        setErrMsg(json.error?.message ?? "加载失败");
        return;
      }
      setRows((json.data?.items ?? []) as FeedbackRow[]);
      setTotal(json.data?.total ?? 0);
    } catch {
      setErrMsg("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(filter);
  }, [filter]);

  async function toggleStatus(row: FeedbackRow) {
    const next = row.status === "new" ? "handled" : "new";
    setUpdatingId(row.id);
    try {
      const res = await fetch(`/api/feedback/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (json.success) {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-4 pb-10 pt-2 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-ochre">
            <Inbox className="size-3.5" />
            反馈收件箱
          </div>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-ink">
            用户反馈
          </h1>
          <p className="mt-1 text-[13px] text-ink-4">
            学生 / 老师 / 管理员提交的问题与功能建议，含页面截图与上下文。仅管理员可见。
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(filter)}>
          刷新
        </Button>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="new">待处理</TabsTrigger>
          <TabsTrigger value="handled">已处理</TabsTrigger>
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
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-ink-4">暂无反馈</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="space-y-2.5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={r.type === "issue" ? "destructive" : "secondary"}
                    className="flex items-center gap-1 text-[10.5px]"
                  >
                    {r.type === "issue" ? <Bug className="size-3" /> : <Lightbulb className="size-3" />}
                    {r.type === "issue" ? "报告问题" : "想要功能"}
                  </Badge>
                  <Badge variant="outline" className="text-[10.5px]">
                    {ROLE_LABEL[r.userRole] ?? r.userRole}
                  </Badge>
                  <Badge
                    variant={r.status === "handled" ? "secondary" : "outline"}
                    className="text-[10.5px]"
                  >
                    {r.status === "handled" ? "已处理" : "待处理"}
                  </Badge>
                  <span className="ml-auto text-[11px] text-ink-4">
                    {new Date(r.createdAt).toLocaleString("zh-CN")}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">
                  {r.content}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-4">
                  <span>提交者：{r.userName ?? r.userEmail ?? r.userId}</span>
                  <a
                    href={r.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    {r.pageUrl}
                  </a>
                  {r.viewport && <span>视口 {r.viewport}</span>}
                </div>

                {r.userAgent && (
                  <p className="break-all text-[10.5px] text-ink-5">UA：{r.userAgent}</p>
                )}

                {r.recentErrors && r.recentErrors.length > 0 && (
                  <details className="rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    <summary className="cursor-pointer text-[11.5px] font-medium text-destructive">
                      近期报错（{r.recentErrors.length} 条）
                    </summary>
                    <ul className="mt-1.5 space-y-1">
                      {r.recentErrors.map((e, i) => (
                        <li key={i} className="break-all text-[10.5px] text-ink-3">
                          <span className="text-ink-5">[{e.source ?? "error"}]</span> {e.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {r.context && (r.context.sourcePath || r.context.routeIds || r.context.dialog || r.context.pageTitle || r.context.element) && (
                  <div className="space-y-1 rounded-md border border-brand/25 bg-brand-soft/40 p-2 text-[11px]">
                    <div className="font-semibold text-brand">定位上下文</div>
                    {r.context.sourcePath && (
                      <div className="break-all text-ink-3">
                        <span className="text-ink-5">源码：</span>
                        <code className="rounded bg-paper px-1 py-0.5 text-[10.5px]">{r.context.sourcePath}</code>
                      </div>
                    )}
                    {r.context.routeIds && Object.keys(r.context.routeIds).length > 0 && (
                      <div className="break-all text-ink-3">
                        <span className="text-ink-5">路由 ID：</span>
                        {Object.entries(r.context.routeIds).map(([k, v]) => `${k}=${v}`).join(" · ")}
                      </div>
                    )}
                    {r.context.dialog && (
                      <div className="break-all text-ink-3">
                        <span className="text-ink-5">弹窗：</span>
                        {r.context.dialog.title}
                        {r.context.dialog.step ? ` · ${r.context.dialog.step}` : ""}
                      </div>
                    )}
                    {r.context.pageTitle && (
                      <div className="truncate text-ink-3">
                        <span className="text-ink-5">页面：</span>
                        {r.context.pageTitle}
                      </div>
                    )}
                    {r.context.element && (
                      <div className="break-all text-ink-3">
                        <span className="text-ink-5">点选元素：</span>
                        {r.context.element.text || r.context.element.ariaLabel || "（无文字）"}
                        {r.context.element.testId ? ` [testid=${r.context.element.testId}]` : ""}
                        {r.context.element.domPath ? (
                          <span className="mt-0.5 block text-[10px] text-ink-5">{r.context.element.domPath}</span>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {r.screenshot && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.screenshot}
                    alt="反馈截图"
                    className="max-h-40 cursor-zoom-in rounded-md border border-line object-contain"
                    onClick={() => setShotPreview(r.screenshot)}
                  />
                )}

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    variant={r.status === "new" ? "default" : "outline"}
                    onClick={() => void toggleStatus(r)}
                    disabled={updatingId === r.id}
                  >
                    {updatingId === r.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : r.status === "new" ? (
                      "标记已处理"
                    ) : (
                      "重新打开"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="text-[11px] text-ink-5">共 {total} 条反馈</div>
        </div>
      )}

      {shotPreview && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setShotPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shotPreview}
            alt="反馈截图大图"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
