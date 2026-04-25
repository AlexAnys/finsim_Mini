"use client";

import { useEffect } from "react";
import { ServerErrorState } from "@/components/states/server-error";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth error boundary]", error);
  }, [error]);

  return (
    <ServerErrorState
      title="登录服务暂时无法访问"
      description="登录功能遇到了问题。请稍后重试，或联系管理员。"
      primaryAction={{ label: "重试", onClick: reset }}
      secondaryAction={{ label: "返回首页", href: "/" }}
      errorDigest={error.digest}
    />
  );
}
