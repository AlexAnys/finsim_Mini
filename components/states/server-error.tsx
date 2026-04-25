"use client";

import { Flame } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface ServerErrorStateProps {
  title?: string;
  description?: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  errorDigest?: string;
  fullPage?: boolean;
}

export function ServerErrorState({
  title = "服务器开小差",
  description = "服务暂时无法响应。已经记录了这个错误，工程师会尽快处理。你可以稍后再试。",
  primaryAction,
  secondaryAction = { label: "返回首页", href: "/" },
  errorDigest,
  fullPage = true,
}: ServerErrorStateProps) {
  return (
    <StateCard
      icon={Flame}
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant="error"
      accentVar="var(--fs-warn)"
      tag="错误 · 500"
      fullPage={fullPage}
    >
      {errorDigest && (
        <div
          className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
          style={{
            background: "var(--fs-bg-alt)",
            color: "var(--fs-ink-5)",
            fontFamily: "var(--fs-font-mono)",
          }}
        >
          <span>错误 ID:</span>
          <span>{errorDigest}</span>
        </div>
      )}
    </StateCard>
  );
}
