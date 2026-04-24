import type { ReactNode } from "react";

interface WizardCardProps {
  title: string;
  subtitle?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

export function WizardCard({ title, subtitle, extra, children }: WizardCardProps) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex items-end justify-between gap-3.5 border-b border-line-2 px-[18px] py-3.5">
        <div>
          <h3 className="m-0 text-sm font-semibold text-ink">{title}</h3>
          {subtitle && (
            <p className="m-0 mt-0.5 text-[11.5px] leading-[1.5] text-ink-4">
              {subtitle}
            </p>
          )}
        </div>
        {extra}
      </div>
      <div className="flex flex-col gap-3.5 p-[18px]">{children}</div>
    </section>
  );
}
