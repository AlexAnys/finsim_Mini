import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: number;
  className?: string;
  mono?: boolean;
  showText?: boolean;
}

export function Wordmark({
  size = 28,
  className,
  mono = false,
  showText = true,
}: WordmarkProps) {
  const markSize = size;
  const svgSize = Math.round(size * 0.55);
  const fontSize = Math.round(size * 0.62);

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative grid place-items-center shrink-0",
          mono ? "bg-brand" : "bg-brand",
        )}
        style={{
          width: markSize,
          height: markSize,
          borderRadius: markSize * 0.25,
          boxShadow: mono
            ? "none"
            : "inset 0 -2px 0 var(--fs-accent)",
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 14 L7 10 L11 12 L17 5"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="17" cy="5" r="1.4" fill="var(--fs-accent)" />
        </svg>
      </div>
      {showText && (
        <div
          className={cn(
            "font-bold tracking-tight leading-none",
            mono ? "text-white" : "text-ink",
          )}
          style={{
            fontSize,
            letterSpacing: "-0.02em",
          }}
        >
          Fin
          <span className={mono ? "text-white" : "text-brand"}>Sim</span>
        </div>
      )}
    </div>
  );
}
