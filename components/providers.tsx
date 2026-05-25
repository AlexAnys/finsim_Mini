"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FeedbackErrorBuffer } from "@/components/feedback/feedback-error-buffer";
import { FeedbackButton } from "@/components/feedback/feedback-button";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>
        <FeedbackErrorBuffer />
        {children}
        {/* 全局悬浮反馈钮：仅登录用户可见，所有登录页（含全屏 sim）通用 */}
        <FeedbackButton />
      </TooltipProvider>
    </SessionProvider>
  );
}
