"use client";

import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface EmptyListStateProps {
  title?: string;
  description?: React.ReactNode;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  icon?: LucideIcon;
  accentVar?: string;
  tag?: string;
  fullPage?: boolean;
  className?: string;
}

export function EmptyListState({
  title = "暂无数据",
  description = "这里还没有内容。当有新数据时会自动显示在这里。",
  primaryAction,
  secondaryAction,
  icon = Inbox,
  accentVar = "var(--fs-primary)",
  tag = "暂无数据",
  fullPage = false,
  className,
}: EmptyListStateProps) {
  return (
    <StateCard
      icon={icon}
      title={title}
      description={description}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant="info"
      accentVar={accentVar}
      tag={tag}
      fullPage={fullPage}
      className={className}
    />
  );
}
