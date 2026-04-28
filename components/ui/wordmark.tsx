import Image from "next/image";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  size?: number;
  className?: string;
  /** 暗背景上的白色版（保留 prop 兼容签名；当前 PNG 自带极光背景，视觉无差异） */
  mono?: boolean;
  /** 是否显示「灵析 AI」文字（默认 true） */
  showText?: boolean;
}

/**
 * 灵析 AI 品牌 mark · 真 brand asset 版（圆角方块 + 极光 + 金属丝带 ∞）
 *
 * 直接使用设计师交付的 `/public/brand/app-icon.png`，与登录/注册页
 * 深色 hero 中的 lockup.png 同源 brand mark。
 *
 * API 完全向后兼容：size / className / mono / showText 全部保留，
 * 所有调用点（sidebar 等）零改动。
 *
 * mono prop 保留签名兼容，但 PNG 已包含完整极光背景，视觉无差异。
 */
export function Wordmark({
  size = 28,
  className,
  mono = false,
  showText = true,
}: WordmarkProps) {
  const fontSize = Math.round(size * 0.54);

  const textColorClass = mono ? "text-white" : "text-ink";
  const aiColorClass = mono ? "text-white/80" : "text-brand";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/app-icon.png"
        width={size}
        height={size}
        alt="灵析 AI"
        priority
        className="shrink-0"
        style={{ borderRadius: Math.round(size * 0.22) }}
      />

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
