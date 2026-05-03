"use client";

import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-base font-medium">{title}</p>
      <p className="max-w-[260px] text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
