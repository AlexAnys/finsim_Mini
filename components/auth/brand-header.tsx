import Link from "next/link";
import { InfinityMark } from "./infinity-mark";

export function BrandHeader() {
  return (
    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-14 lg:py-7">
      <Link href="/login" className="group flex items-center gap-3">
        <span
          className="grid h-10 w-10 place-items-center rounded-[10px] border bg-[rgba(255,255,255,0.58)] shadow-[0_8px_28px_rgba(23,39,95,0.08)] backdrop-blur-sm"
          style={{ borderColor: "rgba(23,39,95,0.1)" }}
        >
          <InfinityMark className="h-7 w-8" />
        </span>
        <span className="flex flex-col">
          <span className="flex items-baseline gap-2 text-[15px] font-semibold text-[var(--text-main)]">
            灵析 AI
            <span className="text-[9px] font-medium tracking-[0.24em] text-[rgba(23,39,95,0.45)]">
              LINGXI
            </span>
          </span>
          <span className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            课堂洞察 · AI 教学助手
          </span>
        </span>
      </Link>

      <a
        href="mailto:admin@finsim.edu.cn"
        className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[rgba(16,24,39,0.48)] transition-colors duration-200 hover:text-[var(--brand-blue)]"
      >
        需要帮助？
      </a>
    </header>
  );
}
