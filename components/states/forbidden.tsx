"use client";

import { ShieldAlert } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface ForbiddenStateProps {
  title?: string;
  description?: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  fullPage?: boolean;
}

export function ForbiddenState({
  title = "你还不能看这个页面",
  description = "这个页面仅对特定角色可见。如果是误操作，可以回到上一页继续。",
  primaryAction = { label: "返回首页", href: "/" },
  secondaryAction,
  fullPage = true,
}: ForbiddenStateProps) {
  return (
    <StateCard
      icon={ShieldAlert}
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant="error"
      accentVar="var(--fs-danger)"
      tag="错误 · 403"
      fullPage={fullPage}
    />
  );
}
