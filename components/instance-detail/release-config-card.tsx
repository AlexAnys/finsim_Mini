"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export type ReleaseMode = "manual" | "auto";

export interface ReleaseConfigCardProps {
  releaseMode: ReleaseMode;
  autoReleaseAt: string | null;
  /** 默认时点（一般 = dueAt）；用户切到 auto 但没填 datetime 时回退它 */
  defaultAutoReleaseAt?: string | null;
  saving: boolean;
  onSave: (next: { releaseMode: ReleaseMode; autoReleaseAt: string | null }) => Promise<void> | void;
}

/**
 * 把 ISO datetime / null 转成 <input type="datetime-local"> 接受的 yyyy-MM-ddTHH:mm 字符串
 * （本地时区 — 与教师"我看到的截止时间"一致）
 */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 把 yyyy-MM-ddTHH:mm（local）转回 ISO；空串返回 null
 */
function localInputToIso(input: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * PR-SIM-1b · D1 教师设置 instance 公布模式
 *
 * - 手动公布 (manual)：教师在提交列表逐条 / 批量按钮发
 * - 自动公布 (auto)：cron / grading.service 在 autoReleaseAt 到期后自动放行
 *
 * UI 仅触发 PATCH `/api/lms/task-instances/{id}/release-config`。状态由父组件守护。
 */
export function ReleaseConfigCard({
  releaseMode,
  autoReleaseAt,
  defaultAutoReleaseAt,
  saving,
  onSave,
}: ReleaseConfigCardProps) {
  const [mode, setMode] = useState<ReleaseMode>(releaseMode);
  const [datetimeInput, setDatetimeInput] = useState<string>(
    isoToLocalInput(autoReleaseAt ?? defaultAutoReleaseAt ?? null)
  );

  // 父组件刷新时（保存成功后）同步本地 state
  useEffect(() => {
    setMode(releaseMode);
  }, [releaseMode]);
  useEffect(() => {
    setDatetimeInput(isoToLocalInput(autoReleaseAt ?? defaultAutoReleaseAt ?? null));
  }, [autoReleaseAt, defaultAutoReleaseAt]);

  const dirty =
    mode !== releaseMode ||
    isoToLocalInput(autoReleaseAt) !== datetimeInput;

  const handleSave = async () => {
    await onSave({
      releaseMode: mode,
      autoReleaseAt: mode === "auto" ? localInputToIso(datetimeInput) : null,
    });
  };

  return (
    <section
      aria-labelledby="release-config-heading"
      className="rounded-xl border border-line bg-surface p-4 md:p-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
            <Send className="size-[15px]" />
          </span>
          <div className="min-w-0">
            <h2
              id="release-config-heading"
              className="text-[13px] font-semibold text-ink"
            >
              成绩公布
            </h2>
            <p className="mt-0.5 text-[11.5px] text-ink-4">
              控制学生何时看到分数 · AI 评估完成后默认隐藏，由你决定何时公布
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label="公布模式"
            className="inline-flex items-center gap-2 rounded-md border border-line bg-paper-alt px-2.5 py-1.5"
          >
            <span
              className={`text-[11.5px] font-medium ${
                mode === "manual" ? "text-ink" : "text-ink-5"
              }`}
            >
              手动公布
            </span>
            <Switch
              size="sm"
              checked={mode === "auto"}
              onCheckedChange={(checked) => setMode(checked ? "auto" : "manual")}
              aria-label="切换公布模式"
            />
            <span
              className={`text-[11.5px] font-medium ${
                mode === "auto" ? "text-ink" : "text-ink-5"
              }`}
            >
              自动公布
            </span>
          </div>

          {mode === "auto" && (
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-4">
              <span>公布时点</span>
              <input
                type="datetime-local"
                value={datetimeInput}
                onChange={(e) => setDatetimeInput(e.target.value)}
                className="rounded-md border border-line bg-paper-alt px-2 py-1 text-[11.5px] text-ink outline-none focus:border-brand"
              />
            </label>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Save className="size-3" />
            )}
            保存设置
          </Button>
        </div>
      </div>
    </section>
  );
}
