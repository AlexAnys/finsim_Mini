import type { ReactNode } from "react";
import { AuroraBackground } from "./aurora-background";
import { BrandHeader } from "./brand-header";

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-main text-text-main">
      <AuroraBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <BrandHeader />
        <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-5 pb-10 pt-4 sm:px-8 min-[920px]:grid-cols-[minmax(0,1fr)_410px] min-[920px]:gap-12 lg:px-14 lg:pb-8 lg:pt-2">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 pb-5 text-[10.5px] text-[rgba(16,24,39,0.42)] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-14">
      <div>灵析 AI · 教学平台 · v3.0 · 2026</div>
      <div className="hidden items-center gap-2 text-[rgba(23,39,95,0.42)] md:flex">
        <span>无限</span>
        <span className="h-px w-5 bg-[var(--line-soft)]" />
        <span>理解</span>
        <span className="h-px w-5 bg-[var(--line-soft)]" />
        <span>共鸣</span>
        <span className="h-px w-5 bg-[var(--line-soft)]" />
        <span>成长</span>
        <span className="h-px w-5 bg-[var(--line-soft)]" />
        <span>探索</span>
      </div>
      <div>© 2026 灵析</div>
    </footer>
  );
}
