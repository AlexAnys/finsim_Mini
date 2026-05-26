"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquarePlus, Bug, Lightbulb, Loader2, Camera, CameraOff, MousePointerClick, X } from "lucide-react";
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
import {
  collectFeedbackContext,
  describeElement,
  type CapturedElement,
  type FeedbackContext,
} from "@/lib/feedback/context";

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
 *
 * AC8：截图对象是 document.documentElement，含当前打开的弹窗（弹窗也在 DOM 里），所以
 * 「点开反馈时屏上的弹窗」会一并进图。AC11：若有点选元素，截图前临时给它描边高亮。
 */
async function captureScreenshot(highlightEl?: Element | null): Promise<ShotResult> {
  let prevOutline = "";
  let prevOffset = "";
  const target = highlightEl as HTMLElement | null;
  if (target?.style) {
    prevOutline = target.style.outline;
    prevOffset = target.style.outlineOffset;
    target.style.outline = "3px solid #ef4444";
    target.style.outlineOffset = "2px";
  }
  try {
    const { domToJpeg } = await import("modern-screenshot");
    const node = document.documentElement;
    const opts = {
      scale: 0.5, // 降采样：一半分辨率
      backgroundColor: "#ffffff",
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
    let dataUrl = await domToJpeg(node, { ...opts, quality: 0.6 });
    if (dataUrl.length > FEEDBACK_SCREENSHOT_MAX_CHARS) {
      dataUrl = await domToJpeg(node, { ...opts, quality: 0.4 }); // 二次压缩
    }
    if (!dataUrl || dataUrl.length > FEEDBACK_SCREENSHOT_MAX_CHARS) {
      return { dataUrl: null, reason: "too_large" };
    }
    return { dataUrl, reason: "ok" };
  } catch {
    return { dataUrl: null, reason: "failed" };
  } finally {
    if (target?.style) {
      target.style.outline = prevOutline;
      target.style.outlineOffset = prevOffset;
    }
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
  // AC11：点选元素模式 + 已选元素 + 实际 DOM 引用（截图高亮用，不进 state 序列化）
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<CapturedElement | null>(null);
  const [pickedEl, setPickedEl] = useState<Element | null>(null);

  // AC11：点选模式下，捕获下一次点击的元素（capture 阶段拦截，阻止其默认行为）
  const onPickClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.target as Element | null;
    setPicked(describeElement(el));
    setPickedEl(el);
    setPicking(false);
    setOpen(true); // 选完重新打开反馈弹窗
  }, []);

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPicking(false);
        setOpen(true);
      }
    };
    // capture=true：在目标元素自身 handler 之前拦下
    document.addEventListener("click", onPickClick, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onPickClick, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [picking, onPickClick]);

  // 仅登录用户可见（登录 / 注册页未登录 → 不渲染，R6 边界）
  if (status !== "authenticated") return null;

  // 全屏 sim 页（(simulation)/sim/[id]）右下=「提交给客户」提交钮、中下=「发送」+对话输入框、
  // 顶栏右=重来/结束对话——默认右下定位会与「提交给客户」碰撞。sim 也是「任意界面」，学生在
  // sim 里遇 bug 是高价值反馈，保留按钮 → 在 sim 页把 FAB 挪到**右上角(顶栏下方)**（r2 实测）。
  const isSimPage = pathname?.startsWith("/sim/") ?? false;

  function reset() {
    setType("issue");
    setContent("");
    setShotReason(null);
    setPicked(null);
    setPickedEl(null);
  }

  function startPicking() {
    setOpen(false); // 关弹窗让用户能点页面元素
    setPicking(true);
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
      // 截图：客户端保证 ≤ 上限；过大/失败 → 传 null，其余字段照常提交（AC5）。
      // AC8：含当前弹窗一并入图；AC11：高亮已选元素。
      const shot = await captureScreenshot(pickedEl);
      setShotReason(shot.reason);

      // AC10 自动上下文 + AC11 点选元素合并
      const ctx: FeedbackContext = collectFeedbackContext(pathname ?? window.location.pathname);
      if (picked) ctx.element = picked;

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
          context: ctx,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "提交失败，请稍后重试");
        return;
      }
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
      {/* AC9：带「反馈」文字标签的胶囊钮（区别于顶栏通知铃铛）。AC8：z-[60] 浮于弹窗(z-50)之上。
          自身弹窗 / 点选模式打开时隐藏 FAB（避免遮自己弹窗 / 干扰点选）。 */}
      {!open && !picking && (
        <Button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="反馈"
          title="反馈：报告问题或提建议"
          className={cn(
            // AC8: pointer-events-auto 覆盖 radix Dialog 打开时 body 上的 pointer-events:none
            // （FAB 是 body 直接子级会继承），配合 z-[60]>遮罩 z-50 → 弹窗上方仍可点。
            "pointer-events-auto fixed right-5 z-[60] h-11 gap-1.5 rounded-full px-4 shadow-lg shadow-black/15",
            isSimPage ? "top-16" : "bottom-5",
          )}
        >
          <MessageSquarePlus className="size-[18px]" />
          <span className="text-sm font-semibold">反馈</span>
        </Button>
      )}

      {/* AC11：点选模式提示条（浮于最上层） */}
      {picking && (
        <div className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-ink/90 px-4 py-2.5 text-sm text-white shadow-lg">
          <MousePointerClick className="size-4" />
          点选你想反馈的页面元素（按 Esc 取消）
          <button
            type="button"
            onClick={() => {
              setPicking(false);
              setOpen(true);
            }}
            className="ml-2 inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25"
          >
            <X className="size-3" /> 取消
          </button>
        </div>
      )}

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

            {/* AC11：可选点选元素 */}
            <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper-alt px-3 py-2">
              <div className="min-w-0 text-[11.5px] text-ink-4">
                {picked ? (
                  <span className="flex items-center gap-1.5 text-ink-3">
                    <MousePointerClick className="size-3.5 shrink-0 text-brand" />
                    <span className="truncate">已标记：{picked.text || picked.ariaLabel || picked.domPath}</span>
                  </span>
                ) : (
                  "可选：点选出问题的具体元素，帮我们更快定位"
                )}
              </div>
              {picked ? (
                <button
                  type="button"
                  onClick={() => (setPicked(null), setPickedEl(null))}
                  className="shrink-0 text-[11.5px] text-ink-4 underline hover:text-ink-3"
                >
                  清除
                </button>
              ) : (
                <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-[11.5px]" onClick={startPicking}>
                  <MousePointerClick className="size-3.5" /> 点选元素
                </Button>
              )}
            </div>

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
                  <Camera className="size-3.5" /> 提交时会自动附上当前页面截图、定位上下文与近期报错（仅管理员可见）
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
