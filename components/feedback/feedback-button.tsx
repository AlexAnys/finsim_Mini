"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
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
import { FEEDBACK_SCREENSHOT_MAX_CHARS } from "@/lib/feedback/constants";

type FeedbackType = "issue" | "feature";

type ShotReason = "ok" | "too_large" | "failed";
interface ShotResult {
  dataUrl: string | null;
  reason: ShotReason;
}

/**
 * 客户端截图：动态加载 modern-screenshot（懒加载分包，不拖首屏），降采样 + JPEG 压缩。
 *
 * 为什么用 modern-screenshot 而非 html2canvas：项目用 Tailwind v4，调色板 + shadcn 组件
 * 大量 emit `oklch()` 颜色函数；html2canvas 自解析 CSS、不识别 oklch → 渲染恒抛错 → 截图恒空。
 * modern-screenshot 走 foreignObject/SVG 序列化，由**浏览器原生渲染**，oklch 等现代 CSS 原生支持。
 *
 * 契约（AC5 + R2）：**客户端保证产出 ≤ FEEDBACK_SCREENSHOT_MAX_CHARS**。
 * - 首轮 q0.6；若超限再降到 q0.4 重试一次（多救回一些大页面）。
 * - 仍超限 → 返回 too_large（丢图，传 null）；采集异常 → failed。
 * 两种「无截图」情况都不阻断提交——其余字段照常走成功路径。
 */
async function captureScreenshot(): Promise<ShotResult> {
  try {
    const { domToJpeg } = await import("modern-screenshot");
    const node = document.documentElement;
    let dataUrl = await domToJpeg(node, {
      scale: 0.5, // 降采样：一半分辨率
      quality: 0.6,
      backgroundColor: "#ffffff",
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    });
    if (dataUrl.length > FEEDBACK_SCREENSHOT_MAX_CHARS) {
      // 二次压缩：更低质量再试一次
      dataUrl = await domToJpeg(node, {
        scale: 0.5,
        quality: 0.4,
        backgroundColor: "#ffffff",
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      });
    }
    if (!dataUrl || dataUrl.length > FEEDBACK_SCREENSHOT_MAX_CHARS) {
      return { dataUrl: null, reason: "too_large" };
    }
    return { dataUrl, reason: "ok" };
  } catch {
    return { dataUrl: null, reason: "failed" };
  }
}

export function FeedbackButton() {
  const { status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("issue");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shotReason, setShotReason] = useState<ShotReason | null>(null);

  // 仅登录用户可见（登录 / 注册页未登录 → 不渲染，R6 边界）
  if (status !== "authenticated") return null;

  // 全屏 sim 页（(simulation)/sim/[id]）右下角是「提交给客户」提交钮、底部居中是「发送」+
  // 对话输入框、顶栏右侧是重来/结束对话——默认右下定位会与「提交给客户」碰撞（AC4）。
  // sim 也是「任意界面」，学生在 sim 里遇 bug 是高价值反馈，保留按钮 → 在 sim 页把 FAB
  // 挪到**左下角**（实测该区仅左栏情景说明 inert 内容，无任何 sim 交互控件）。
  const isSimPage = pathname?.startsWith("/sim/") ?? false;

  function reset() {
    setType("issue");
    setContent("");
    setShotReason(null);
  }

  async function handleSubmit() {
    const text = content.trim();
    if (!text) {
      toast.error("请填写反馈内容");
      return;
    }
    setSubmitting(true);
    setShotReason(null);
    try {
      // 截图：客户端保证 ≤ 上限；过大/失败 → 传 null，其余字段照常提交（AC5）
      const shot = await captureScreenshot();
      setShotReason(shot.reason);

      const recentErrors = getRecentErrors();
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content: text,
          pageUrl: window.location.href,
          screenshot: shot.dataUrl,
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
      // 成功：截图被省略时给一句轻提示，但提交本身已成功
      if (shot.reason === "too_large") {
        toast.success("感谢反馈！截图过大已省略，其余信息已提交");
      } else if (shot.reason === "failed") {
        toast.success("感谢反馈！截图未能生成，其余信息已提交");
      } else {
        toast.success("感谢反馈！我们已收到，会尽快处理");
      }
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
        className={cn(
          "fixed bottom-5 z-40 size-12 rounded-full p-0 shadow-lg shadow-black/15",
          // sim 页挪左下避开右下「提交给客户」；其余页右下角默认
          isSimPage ? "left-5" : "right-5",
        )}
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
              {shotReason === "too_large" ? (
                <>
                  <CameraOff className="size-3.5" /> 截图过大已省略，其余信息照常提交
                </>
              ) : shotReason === "failed" ? (
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
