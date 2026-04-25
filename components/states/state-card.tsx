import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type StateVariant = "info" | "celebrate" | "error";

export interface StateAction {
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface StateCardProps {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  primaryAction?: StateAction;
  secondaryAction?: StateAction;
  variant?: StateVariant;
  /** Token name from globals.css. Defaults vary by variant. */
  accentVar?: string;
  /** Tag strip text shown above the card body (small uppercase label). */
  tag?: string;
  /** Optional extra content rendered below description (e.g. invite code). */
  children?: React.ReactNode;
  className?: string;
  /** Render as full viewport state when used as page-level boundary. */
  fullPage?: boolean;
}

function ActionButton({
  action,
  primary,
}: {
  action: StateAction;
  primary?: boolean;
}) {
  const className = primary
    ? "rounded-md px-4 py-2 text-[12.5px] font-semibold text-white transition disabled:opacity-60"
    : "rounded-md border px-3.5 py-2 text-[12.5px] font-medium transition";
  const style: React.CSSProperties = primary
    ? { background: "var(--fs-ink)" }
    : {
        background: "var(--fs-bg-alt)",
        color: "var(--fs-ink-3)",
        borderColor: "var(--fs-line)",
      };

  if (action.href) {
    return (
      <Link href={action.href} className={className} style={style}>
        {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      className={className}
      style={style}
    >
      {action.label}
    </button>
  );
}

export function StateCard({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = "info",
  accentVar = "var(--fs-primary)",
  tag,
  children,
  className,
  fullPage = false,
}: StateCardProps) {
  const iconWrapStyle: React.CSSProperties =
    variant === "celebrate"
      ? {
          background: `linear-gradient(135deg, ${accentVar}, var(--fs-primary))`,
          color: "#fff",
          boxShadow: `0 4px 14px color-mix(in oklab, ${accentVar} 30%, transparent)`,
        }
      : variant === "error"
        ? {
            background: `color-mix(in oklab, ${accentVar} 14%, transparent)`,
            color: accentVar,
            border: `1px solid color-mix(in oklab, ${accentVar} 35%, transparent)`,
          }
        : {
            background: "var(--fs-bg-alt)",
            color: accentVar,
          };

  const card = (
    <div
      className={
        "overflow-hidden rounded-xl border border-line bg-surface" +
        (className ? ` ${className}` : "")
      }
      role={variant === "error" ? "alert" : undefined}
    >
      {tag && (
        <div
          className="border-b px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-5"
          style={{
            background: "var(--fs-bg-alt)",
            borderColor: "var(--fs-line-2)",
          }}
        >
          {tag}
        </div>
      )}
      <div className="flex flex-col items-start gap-2.5 px-7 py-8">
        <div
          aria-hidden
          className="mb-1 grid h-14 w-14 place-items-center rounded-2xl"
          style={iconWrapStyle}
        >
          <Icon size={22} strokeWidth={1.75} />
        </div>
        <div className="text-[17px] font-semibold tracking-tight text-ink">
          {title}
        </div>
        <div className="max-w-[440px] text-[12.5px] leading-relaxed text-ink-4">
          {description}
        </div>
        {children}
        {(primaryAction || secondaryAction) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {primaryAction && (
              <ActionButton action={primaryAction} primary />
            )}
            {secondaryAction && <ActionButton action={secondaryAction} />}
          </div>
        )}
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="flex min-h-[60vh] w-full items-center justify-center px-6 py-12"
        style={{ background: "var(--fs-bg)" }}
      >
        <div className="w-full max-w-[480px]">{card}</div>
      </div>
    );
  }

  return card;
}
