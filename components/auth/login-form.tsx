"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
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
    <section className="auth-fade-up auth-fade-up-delay mx-auto w-full max-w-[410px]">
      <div className="mb-7">
        <h2 className="text-[30px] font-semibold leading-tight text-[var(--text-main)]">
          欢迎回来
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-[var(--text-muted)]">
          使用你的学校邮箱进入灵析，继续学习任务、课堂信号与教学建议。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="block">
          <div className="mb-1.5 text-[11.5px] font-semibold text-[rgba(16,24,39,0.7)]">
            邮箱
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="email"
            placeholder="your@school.edu.cn"
            className="h-11 w-full rounded-[8px] border border-[rgba(23,39,95,0.16)] bg-[rgba(250,248,242,0.72)] px-3.5 text-[13px] text-[var(--text-main)] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] outline-none transition duration-200 placeholder:text-[rgba(107,114,128,0.68)] focus:border-[var(--brand-indigo)] focus:bg-white focus:ring-[3px] focus:ring-[rgba(18,214,214,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-[rgba(16,24,39,0.7)]">
              密码
            </span>
            <span className="text-[11px] text-[rgba(107,114,128,0.8)]">
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
            className="h-11 w-full rounded-[8px] border border-[rgba(23,39,95,0.16)] bg-[rgba(250,248,242,0.72)] px-3.5 text-[13px] text-[var(--text-main)] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] outline-none transition duration-200 placeholder:text-[rgba(107,114,128,0.68)] focus:border-[var(--brand-indigo)] focus:bg-white focus:ring-[3px] focus:ring-[rgba(18,214,214,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        {inlineError && (
          <div
            role="alert"
            className="rounded-[8px] border px-3 py-2 text-[12px]"
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
          className="mt-2 h-11 w-full rounded-[8px] text-[13px] font-semibold text-white shadow-[0_12px_26px_rgba(23,39,95,0.16)] transition duration-200 hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(18,214,214,0.14),0_10px_28px_rgba(123,97,255,0.13)] disabled:translate-y-0 disabled:opacity-60"
          style={{
            background:
              "linear-gradient(135deg, #24357D 0%, #17275F 50%, #1D3B8F 100%)",
          }}
        >
          {isLoading ? "登录中..." : "登录"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-2.5">
        <div className="h-px flex-1 bg-[var(--line-soft)]" />
        <span className="text-[11px] text-[rgba(107,114,128,0.72)]">或</span>
        <div className="h-px flex-1 bg-[var(--line-soft)]" />
      </div>

      <p className="text-center text-[12.5px] text-[var(--text-muted)]">
        还没有账号？{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--brand-indigo)] underline-offset-4 transition hover:text-[var(--brand-blue)] hover:underline"
        >
          立即注册
        </Link>
      </p>

      <div className="mt-7 text-center text-[11px] leading-relaxed text-[rgba(107,114,128,0.78)]">
        登录即代表你同意{" "}
        <a
          href="#terms"
          className="text-[rgba(16,24,39,0.62)] underline-offset-4 hover:text-[var(--brand-blue)] hover:underline"
        >
          使用条款
        </a>{" "}
        与{" "}
        <a
          href="#privacy"
          className="text-[rgba(16,24,39,0.62)] underline-offset-4 hover:text-[var(--brand-blue)] hover:underline"
        >
          隐私政策
        </a>
      </div>
    </section>
  );
}
