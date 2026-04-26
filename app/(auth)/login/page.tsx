"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [roleHint, setRoleHint] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);

    if (!email.trim()) {
      setInlineError("请输入邮箱");
      return;
    }
    if (!password) {
      setInlineError("请输入密码");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setInlineError("邮箱或密码错误");
        return;
      }

      toast.success("登录成功");

      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();

      const role = session?.user?.role;
      if (role === "teacher" || role === "admin") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setInlineError("登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* LEFT · brand hero */}
      <aside
        className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-16"
        style={{
          background:
            "linear-gradient(135deg, var(--fs-primary-deep) 0%, var(--fs-primary-lift) 100%)",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full"
          style={{ background: "color-mix(in oklab, var(--fs-sim) 30%, transparent)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full"
          style={{ background: "color-mix(in oklab, var(--fs-primary) 25%, transparent)" }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div
            className="grid h-9 w-9 place-items-center rounded-lg text-[15px] font-bold"
            style={{
              background:
                "linear-gradient(135deg, var(--fs-sim), var(--fs-primary))",
            }}
          >
            灵
          </div>
          <div>
            <div className="text-[15px] font-semibold">灵析 AI</div>
            <div className="mt-0.5 text-[10.5px] text-white/55">
              AI 把课堂的隐性问题，变成可视的行动
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="mb-4 text-4xl font-semibold leading-tight tracking-tight">
            看见每个学生
            <br />
            没说出口的{" "}
            <span style={{ color: "var(--fs-sim)" }}>那道坎</span>。
          </h2>
          <p className="max-w-[480px] text-sm leading-relaxed text-white/75">
            灵析在每节课后聚合学生的对话、答题、提交，把共性盲区、个体差异与知识断点，变成你立刻能采取的教学动作。
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3.5">
          {[
            { n: "看见", l: "AI 聚合隐性卡点" },
            { n: "因人", l: "个性化建议到学生" },
            { n: "省时", l: "AI 先批 · 教师确认" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-[10px] border border-white/10 bg-white/[0.08] px-3.5 py-3"
            >
              <div className="fs-num text-[22px] font-bold tracking-tight">
                {s.n}
              </div>
              <div className="mt-0.5 text-[11px] text-white/60">{s.l}</div>
            </div>
          ))}
        </div>
      </aside>

      {/* RIGHT · form */}
      <main className="flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile-only brand header */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg text-base font-bold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--fs-sim), var(--fs-primary))",
              }}
            >
              灵
            </div>
            <div>
              <div className="text-base font-semibold text-ink">灵析 AI</div>
              <div className="text-[11px] text-ink-4">
                AI 把课堂的隐性问题，变成可视的行动
              </div>
            </div>
          </div>

          {/* Role hint chip switch — visual hint only, real role comes from account */}
          <div
            role="group"
            aria-label="登录身份提示"
            className="mb-7 flex rounded-lg p-1"
            style={{ background: "var(--fs-bg-alt)" }}
          >
            {[
              { k: "student" as const, label: "学生登录", sub: "使用学校邮箱登录" },
              { k: "teacher" as const, label: "教师登录", sub: "使用工作邮箱登录" },
            ].map((r) => {
              const active = roleHint === r.k;
              return (
                <button
                  key={r.k}
                  type="button"
                  onClick={() => setRoleHint(r.k)}
                  className="flex-1 rounded-md px-3 py-2.5 text-left transition-shadow"
                  style={{
                    background: active ? "var(--fs-surface)" : "transparent",
                    boxShadow: active ? "var(--fs-shadow)" : "none",
                  }}
                >
                  <div
                    className="text-[12.5px] font-semibold"
                    style={{ color: active ? "var(--fs-ink)" : "var(--fs-ink-4)" }}
                  >
                    {r.label}
                  </div>
                  <div className="mt-px text-[10.5px] text-ink-5">{r.sub}</div>
                </button>
              );
            })}
          </div>

          <h1 className="text-[28px] font-semibold tracking-tight text-ink">
            欢迎回来
          </h1>
          <p className="mb-7 mt-1.5 text-[13px] leading-relaxed text-ink-4">
            继续你尚未完成的对话，或者从 AI 客户那里开始新的一次。
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <label className="block">
              <div className="mb-1.5 text-[11.5px] font-semibold text-ink-3">
                邮箱
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                placeholder="your@school.edu.cn"
                className="w-full rounded-[7px] border border-line bg-paper-alt px-3.5 py-2.5 text-[13px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-ink-3">
                  密码
                </span>
                <span className="text-[11px] text-ink-5">
                  忘记密码？请联系管理员
                </span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-[7px] border border-line bg-paper-alt px-3.5 py-2.5 text-[13px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>

            {inlineError && (
              <div
                role="alert"
                className="rounded-md border px-3 py-2 text-[12px]"
                style={{
                  background: "var(--fs-danger-soft)",
                  borderColor: "color-mix(in oklab, var(--fs-danger) 30%, transparent)",
                  color: "var(--fs-danger)",
                }}
              >
                {inlineError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-lg py-3 text-[13px] font-semibold text-white transition disabled:opacity-60"
              style={{ background: "var(--fs-ink)" }}
            >
              {isLoading ? "登录中..." : "登录"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[11px] text-ink-5">或</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <p className="text-center text-[12.5px] text-ink-4">
            还没有账号？{" "}
            <Link
              href="/register"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              立即注册
            </Link>
          </p>

          <div className="mt-7 text-center text-[11px] leading-relaxed text-ink-5">
            登录即代表你同意{" "}
            <span className="text-ink-4">使用条款</span> 与{" "}
            <span className="text-ink-4">隐私政策</span>
          </div>
        </div>
      </main>
    </div>
  );
}
