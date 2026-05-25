"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { MessageSquarePlus, Bug, Lightbulb, Loader2, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getRecentErrors, clearErrors } from "@/lib/feedback/error-buffer";

type FeedbackType = "issue" | "feature";

/** 客户端截图：动态加载 html2canvas（懒加载分包，不拖首屏），降采样 + JPEG 压缩。失败返回 null（优雅降级）。 */
async function captureScreenshot(): Promise<string | null> {
  try {
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(document.body, {
      scale: 0.5, // 降采样：一半分辨率
      logging: false,
      useCORS: true,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
    });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6); // JPEG 质量 0.6
    // 体积兜底：超过 ~650KB 直接放弃（服务端上限 700KB），不卡死
    if (dataUrl.length > 650_000) return null;
    return dataUrl;
  } catch {
    return null;
  }
}

export function FeedbackButton() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("issue");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shotOk, setShotOk] = useState<boolean | null>(null);

  // 仅登录用户可见（登录 / 注册页未登录 → 不渲染，R6 边界）
  if (status !== "authenticated") return null;

  function reset() {
    setType("issue");
    setContent("");
    setShotOk(null);
  }

  async function handleSubmit() {
    const text = content.trim();
    if (!text) {
      toast.error("请填写反馈内容");
      return;
    }
    setSubmitting(true);
    setShotOk(null);
    try {
      const screenshot = await captureScreenshot();
      setShotOk(screenshot != null);

      const recentErrors = getRecentErrors();
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content: text,
          pageUrl: window.location.href,
          screenshot,
          recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "提交失败，请稍后重试");
        return;
      }
      toast.success("感谢反馈！我们已收到，会尽快处理");
      clearErrors();
      reset();
      setOpen(false);
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="反馈"
        className="fixed bottom-5 right-5 z-40 size-12 rounded-full p-0 shadow-lg shadow-black/15"
      >
        <MessageSquarePlus className="size-5" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : (reset(), setOpen(false)))}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>反馈一下</DialogTitle>
            <DialogDescription>
              遇到问题或想要新功能？一句话告诉我们，会自动附上当前页面信息帮助定位。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-2">
              <TypeOption
                active={type === "issue"}
                onClick={() => setType("issue")}
                icon={<Bug className="size-4" />}
                label="报告问题"
              />
              <TypeOption
                active={type === "feature"}
                onClick={() => setType("feature")}
                icon={<Lightbulb className="size-4" />}
                label="想要功能"
              />
            </div>

            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
              rows={4}
              placeholder={
                type === "issue"
                  ? "哪里出了问题？比如「点提交后一直转圈」"
                  : "你希望增加什么？比如「成绩能导出 Excel」"
              }
              className="resize-none"
            />

            <p className="flex items-center gap-1.5 text-[11.5px] text-ink-4">
              {shotOk === false ? (
                <>
                  <CameraOff className="size-3.5" /> 截图未能生成，其余信息照常提交
                </>
              ) : (
                <>
                  <Camera className="size-3.5" /> 提交时会自动附上当前页面截图与近期报错（仅管理员可见）
                </>
              )}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => (reset(), setOpen(false))} disabled={submitting}>
              取消
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || !content.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> 提交中...
                </>
              ) : (
                "提交反馈"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TypeOption({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-line bg-paper text-ink-3 hover:bg-paper-alt",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
