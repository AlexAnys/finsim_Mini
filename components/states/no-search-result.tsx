"use client";

import { Search } from "lucide-react";
import { StateCard, type StateAction } from "./state-card";

interface NoSearchResultStateProps {
  keyword?: string;
  description?: string;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  fullPage?: boolean;
  className?: string;
}

export function NoSearchResultState({
  keyword,
  description,
  primaryAction,
  secondaryAction,
  fullPage = false,
  className,
}: NoSearchResultStateProps) {
  const desc =
    description ??
    (keyword
      ? `关键词"${keyword}"没有匹配到任何内容。可以试试相近的词。`
      : "当前没有匹配到任何内容。可以换个关键词重新搜索。");

  return (
    <StateCard
      icon={Search}
      title="没有匹配到内容"
      description={desc}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      variant="info"
      accentVar="var(--fs-ink-3)"
      tag="搜索 · 无结果"
      fullPage={fullPage}
      className={className}
    />
  );
}
