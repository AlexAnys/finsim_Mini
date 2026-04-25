"use client";

import { FileQuestion } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface NotFoundStateProps {
  title?: string;
  description?: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  fullPage?: boolean;
}

export function NotFoundState({
  title = "页面不见了",
  description = "你要找的页面不存在或已被移走。可以回到上一页继续浏览。",
  primaryAction = { label: "返回首页", href: "/" },
  secondaryAction,
  fullPage = true,
}: NotFoundStateProps) {
  return (
    <StateCard
      icon={FileQuestion}
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant="info"
      accentVar="var(--fs-ink-3)"
      tag="错误 · 404"
      fullPage={fullPage}
    />
  );
}
