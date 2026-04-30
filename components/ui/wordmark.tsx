import Image from "next/image";
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
  const fontSize = Math.round(size * 0.62);

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden bg-brand",
        )}
        style={{
          width: markSize,
          height: markSize,
          borderRadius: markSize * 0.25,
          boxShadow: mono
            ? "none"
            : "0 8px 22px rgba(23,39,95,0.12), inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        <Image
          src="/brand/lingxi-logo.png"
          alt="灵析"
          width={96}
          height={96}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      {showText && (
        <div
          className={cn(
            "font-bold leading-none",
            mono ? "text-white" : "text-ink",
          )}
          style={{
            fontSize,
            letterSpacing: 0,
          }}
        >
          灵
          <span className={mono ? "text-white" : "text-brand"}>析</span>
        </div>
      )}
    </div>
  );
}
