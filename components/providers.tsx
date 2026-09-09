"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { loadInitialSession } from "@/lib/auth/client-session-bootstrap";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FeedbackErrorBuffer } from "@/components/feedback/feedback-error-buffer";
import { FeedbackButton } from "@/components/feedback/feedback-button";

export function Providers({ children }: { children: React.ReactNode }) {
  const [initial, setInitial] = useState<{ session: Session | null } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadInitialSession().then(
      session => { if (active) setInitial({ session }); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, []);
  if (failed) return <div role="alert" className="p-6 text-center">登录状态初始化失败，请刷新页面后重试。</div>;
  if (!initial) return <div role="status" className="p-6 text-center">正在确认登录状态...</div>;
  return (
    <SessionProvider session={initial.session}>
      <TooltipProvider>
        <FeedbackErrorBuffer />
        {children}
        {/* 全局悬浮反馈钮：仅登录用户可见，所有登录页（含全屏 sim）通用 */}
        <FeedbackButton />
      </TooltipProvider>
    </SessionProvider>
  );
}
