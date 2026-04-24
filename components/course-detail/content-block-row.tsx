"use client";

import Link from "next/link";
import {
  MessageSquare,
  HelpCircle,
  FileText,
  BookOpen,
  Paperclip,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ContentBlockRowKind =
  | "markdown"
  | "resource"
  | "simulation_config"
  | "quiz"
  | "subjective"
  | "custom";

const KIND_CONFIG: Record<
  ContentBlockRowKind,
  {
    label: string;
    icon: LucideIcon;
    tone: "ink" | "quiz" | "sim" | "subj" | "ochre";
  }
> = {
  markdown: { label: "讲义", icon: BookOpen, tone: "ink" },
  resource: { label: "资源", icon: Paperclip, tone: "ink" },
  simulation_config: { label: "模拟配置", icon: MessageSquare, tone: "sim" },
  quiz: { label: "测验", icon: HelpCircle, tone: "quiz" },
  subjective: { label: "主观题", icon: FileText, tone: "subj" },
  custom: { label: "其他", icon: ExternalLink, tone: "ochre" },
};

const TONE_SOFT: Record<string, string> = {
  ink: "bg-paper text-ink-4",
  quiz: "bg-quiz-soft text-quiz",
  sim: "bg-sim-soft text-sim",
  subj: "bg-subj-soft text-subj",
  ochre: "bg-ochre-soft text-ochre",
};

interface ContentBlockRowProps {
  kind: ContentBlockRowKind;
  title: string;
  meta?: string | null;
  href?: string;
}

export function ContentBlockRow({
  kind,
  title,
  meta,
  href,
}: ContentBlockRowProps) {
  const cfg = KIND_CONFIG[kind];
  const Icon = cfg.icon;
  const body = (
    <div className="flex items-center gap-2.5 rounded-md border border-line-2 bg-surface px-3 py-2 transition-colors hover:bg-surface-tint">
      <div
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md",
          TONE_SOFT[cfg.tone],
        )}
      >
        <Icon className="size-3" />
      </div>
      <div className="flex-1 text-[12.5px] text-ink-2">{title}</div>
      {meta && <span className="text-[11px] text-ink-5">{meta}</span>}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}
