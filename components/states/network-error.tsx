"use client";

import { WifiOff } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface NetworkErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  secondaryAction?: StateAction;
  fullPage?: boolean;
  className?: string;
}

export function NetworkErrorState({
  title = "看起来没网了",
  description = "无法连接到服务器。检查一下网络后再试。已完成的内容会暂存在本地。",
  onRetry,
  secondaryAction,
  fullPage = false,
  className,
}: NetworkErrorStateProps) {
  return (
    <StateCard
      icon={WifiOff}
      title={title}
      description={description}
      primaryAction={onRetry ? { label: "重试", onClick: onRetry } : undefined}
      secondaryAction={secondaryAction}
      variant="error"
      accentVar="var(--fs-ink-3)"
      tag="网络 · 已断开"
      fullPage={fullPage}
      className={className}
    />
  );
}
