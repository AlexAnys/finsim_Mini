import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WizardReviewBlockProps {
  title: string;
  children: ReactNode;
  mono?: boolean;
  wide?: boolean;
}

export function WizardReviewBlock({
  title,
  children,
  mono,
  wide,
}: WizardReviewBlockProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line-2 bg-paper-alt p-3.5",
        wide && "sm:col-span-2"
      )}
    >
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-5">
        {title}
      </div>
      <div
        className={cn(
          "text-xs leading-[1.65] text-ink-2",
          mono && "font-mono",
          typeof children === "string" && "whitespace-pre-wrap"
        )}
      >
        {children}
      </div>
    </div>
  );
}
