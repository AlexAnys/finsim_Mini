"use client";

import { useEffect } from "react";
import { ServerErrorState } from "@/components/states/server-error";

export default function TeacherError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[teacher error boundary]", error);
  }, [error]);

  return (
    <ServerErrorState
      primaryAction={{ label: "重新加载", onClick: reset }}
      secondaryAction={{ label: "回到工作台", href: "/teacher/dashboard" }}
      errorDigest={error.digest}
      fullPage={false}
    />
  );
}
