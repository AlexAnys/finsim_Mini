"use client";

import { useEffect } from "react";
import { recordError } from "@/lib/feedback/error-buffer";

/**
 * 根层错误缓冲监听器（轻量，仅副作用无渲染）。
 *
 * 挂载时安装 4 类全局错误监听，卸载时清理。所有逻辑只在浏览器跑，
 * 不阻塞渲染、不引入额外 re-render（R4：不拖性能）。
 */
export function FeedbackErrorBuffer() {
  useEffect(() => {
    // 1) window error（运行时 JS 报错）
    const onError = (e: ErrorEvent) => {
      recordError(e.message || String(e.error ?? "未知错误"), "window.error");
    };
    // 2) 未处理的 Promise rejection
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg =
        reason instanceof Error ? reason.message : typeof reason === "string" ? reason : JSON.stringify(reason);
      recordError(msg, "unhandledrejection");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // 3) console.error 包裹（保留原行为，仅旁路记录）
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      try {
        recordError(
          args
            .map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a)))
            .join(" "),
          "console.error",
        );
      } catch {
        // 记录失败不影响原 console.error
      }
      originalConsoleError.apply(console, args as []);
    };

    // 4) fetch 失败 / 非 2xx 旁路记录（不改变响应，不吞错）
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const res = await originalFetch(...args);
        if (!res.ok) {
          const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
          recordError(`HTTP ${res.status} ${url}`, "fetch");
        }
        return res;
      } catch (err) {
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
        recordError(`网络请求失败 ${url}: ${err instanceof Error ? err.message : String(err)}`, "fetch");
        throw err;
      }
    };

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      console.error = originalConsoleError;
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
