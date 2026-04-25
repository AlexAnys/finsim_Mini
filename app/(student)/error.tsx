"use client";

import { useEffect } from "react";
import { ServerErrorState } from "@/components/states/server-error";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[student error boundary]", error);
  }, [error]);

  return (
    <ServerErrorState
      primaryAction={{ label: "重新加载", onClick: reset }}
      secondaryAction={{ label: "回到学习空间", href: "/dashboard" }}
      errorDigest={error.digest}
      fullPage={false}
    />
  );
}
