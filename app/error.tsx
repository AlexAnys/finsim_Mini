"use client";

import { useEffect } from "react";
import { ServerErrorState } from "@/components/states/server-error";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-paper">
      <ServerErrorState
        primaryAction={{ label: "重新加载", onClick: reset }}
        secondaryAction={{ label: "返回首页", href: "/" }}
        errorDigest={error.digest}
      />
    </div>
  );
}
