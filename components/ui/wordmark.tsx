import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: number;
  className?: string;
  /** 暗背景上的白色版（用于深色 nav、按钮内嵌等场景） */
  mono?: boolean;
  /** 是否显示「灵析 AI」文字（默认 true） */
  showText?: boolean;
}

/**
 * 灵析 AI 品牌 mark · 横向 ∞ 双环 + 双星点
 *
 * 与登录/注册页深色版（真实金属丝带 lockup.png）形态完全一致，
 * 这里是适配米色 paper 浅色背景的实色 SVG 版本。
 *
 * 替换路径：finsim/components/ui/wordmark.tsx
 *
 * API 完全向后兼容：size / className / mono / showText 全部保留，
 * 所有调用点（sidebar 等）零改动。
 */
export function Wordmark({
  size = 28,
  className,
  mono = false,
  showText = true,
}: WordmarkProps) {
  // 横向 ∞ 比例 80:44 ≈ 1.82:1（与真实 lockup logo 一致）
  const symbolHeight = size;
  const symbolWidth = Math.round(size * 1.82);
  const fontSize = Math.round(size * 0.54);

  const strokeColor = mono ? "#ffffff" : "var(--fs-primary)";
  const dot1Color = mono ? "#ffffff" : "var(--fs-sim)";
  const dot2Color = mono ? "rgba(255,255,255,0.7)" : "var(--fs-primary-lift)";
  const textColorClass = mono ? "text-white" : "text-ink";
  const aiColorClass = mono ? "text-white/80" : "text-brand";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width={symbolWidth}
        height={symbolHeight}
        viewBox="0 0 80 44"
        fill="none"
        aria-label="灵析 AI"
        className="shrink-0"
      >
        {/* 双环 ∞ 一笔画 */}
        <path
          d="M 14 22 C 14 10, 30 10, 40 22 C 50 34, 66 34, 66 22 C 66 10, 50 10, 40 22 C 30 34, 14 34, 14 22 Z"
          stroke={strokeColor}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* 主星点（右上，紫色） */}
        <circle cx="62" cy="11" r="1.8" fill={dot1Color} />
        {/* 次星点（左下，浅靛蓝） */}
        <circle cx="18" cy="33" r="1.2" fill={dot2Color} />
      </svg>

      {showText && (
        <div
          className={cn(
            "font-semibold tracking-tight leading-none whitespace-nowrap",
            textColorClass,
          )}
          style={{
            fontSize,
            letterSpacing: "-0.005em",
          }}
        >
          灵析 <span className={aiColorClass}>AI</span>
        </div>
      )}
    </div>
  );
}
