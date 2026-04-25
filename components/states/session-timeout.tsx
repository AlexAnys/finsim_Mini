"use client";

import { Clock } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface SessionTimeoutStateProps {
  title?: string;
  description?: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  fullPage?: boolean;
}

export function SessionTimeoutState({
  title = "登录已过期",
  description = "为了安全考虑，你的登录状态已过期。请重新登录后继续使用。",
  primaryAction = { label: "重新登录", href: "/login" },
  secondaryAction,
  fullPage = true,
}: SessionTimeoutStateProps) {
  return (
    <StateCard
      icon={Clock}
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant="info"
      accentVar="var(--fs-info)"
      tag="登录 · 已过期"
      fullPage={fullPage}
    />
  );
}
