"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth/auth-layout";
import { LoginHero } from "@/components/auth/login-hero";
import { ValueOrbitStrip } from "@/components/auth/value-orbit-strip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClassOption {
  id: string;
  name: string;
  code: string | null;
  academicYear: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [classId, setClassId] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    if (role === "student" && classes.length === 0) {
      setClassesLoading(true);
      fetch("/api/classes")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setClasses(data.data);
          } else {
            setInlineError(data.error?.message || "获取班级列表失败");
          }
        })
        .catch(() => {
          toast.error("获取班级列表失败");
        })
        .finally(() => {
          setClassesLoading(false);
        });
    }
  }, [role, classes.length]);

  function validate(): boolean {
    if (!name.trim()) {
      setInlineError("请输入姓名");
      return false;
    }
    if (!email.trim()) {
      setInlineError("请输入邮箱");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setInlineError("邮箱格式不正确");
      return false;
    }
    if (password.length < 6) {
      setInlineError("密码至少6个字符");
      return false;
    }
    if (password !== confirmPassword) {
      setInlineError("两次输入的密码不一致");
      return false;
    }
    if (role === "student" && !classId) {
      setInlineError("学生必须选择班级");
      return false;
    }
    if (role === "teacher" && !adminKey.trim()) {
      setInlineError("教师注册需要输入注册密钥");
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);

    if (!validate()) return;

    setIsLoading(true);

    try {
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
          role,
          classId: role === "student" ? classId : undefined,
          adminKey: role === "teacher" ? adminKey.trim() : undefined,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerData.success) {
        setInlineError(registerData.error?.message || "注册失败");
        return;
      }

      toast.success("注册成功，正在自动登录...");

      const signInResult = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast.error("自动登录失败，请手动登录");
        router.push("/login");
        return;
      }

      if (role === "teacher") {
        router.push("/teacher/dashboard");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      setInlineError("注册失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-[8px] border border-[rgba(23,39,95,0.16)] bg-[rgba(250,248,242,0.72)] px-3.5 text-[13px] text-[var(--text-main)] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] outline-none transition duration-200 placeholder:text-[rgba(107,114,128,0.68)] focus:border-[var(--brand-indigo)] focus:bg-white focus:ring-[3px] focus:ring-[rgba(18,214,214,0.16)] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <AuthLayout>
      <LoginHero />
      <div className="w-full">
        <section className="auth-fade-up auth-fade-up-delay mx-auto w-full max-w-[410px]">
          <div
            role="group"
            aria-label="选择注册角色"
            className="mb-7 grid grid-cols-2 rounded-[8px] border bg-[rgba(250,248,242,0.7)] p-1"
            style={{ borderColor: "rgba(23,39,95,0.1)" }}
          >
            {[
              { k: "student" as const, label: "学生注册", sub: "加入老师的课堂" },
              { k: "teacher" as const, label: "教师注册", sub: "需要邀请密钥" },
            ].map((r) => {
              const active = role === r.k;
              return (
                <button
                  key={r.k}
                  type="button"
                  onClick={() => {
                    setRole(r.k);
                    setClassId("");
                    setAdminKey("");
                    setInlineError(null);
                  }}
                  disabled={isLoading}
                  className="rounded-[7px] px-3 py-2.5 text-left transition duration-200 disabled:opacity-60"
                  style={{
                    background: active ? "rgba(255,255,255,0.78)" : "transparent",
                    boxShadow: active
                      ? "0 1px 2px rgba(23,39,95,0.08), 0 8px 22px rgba(23,39,95,0.05)"
                      : "none",
                  }}
                >
                  <div
                    className="text-[12.5px] font-semibold"
                    style={{
                      color: active ? "var(--text-main)" : "rgba(107,114,128,0.82)",
                    }}
                  >
                    {r.label}
                  </div>
                  <div className="mt-px text-[10.5px] text-[rgba(107,114,128,0.72)]">
                    {r.sub}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mb-7">
            <h1 className="text-[30px] font-semibold leading-tight text-[var(--text-main)]">
              创建账号
            </h1>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-muted)]">
              填写下面的信息加入灵析，账号会自动进入对应学习或教学空间。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="block">
              <div className="mb-1.5 text-[11.5px] font-semibold text-[rgba(16,24,39,0.7)]">
                姓名
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoComplete="name"
                placeholder="请输入真实姓名"
                className={inputClass}
              />
            </label>

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
                className={inputClass}
              />
            </label>

            <label className="block">
              <div className="mb-1.5 text-[11.5px] font-semibold text-[rgba(16,24,39,0.7)]">
                密码
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                placeholder="至少 6 个字符"
                className={inputClass}
              />
            </label>

            <label className="block">
              <div className="mb-1.5 text-[11.5px] font-semibold text-[rgba(16,24,39,0.7)]">
                确认密码
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                placeholder="再次输入密码"
                className={inputClass}
              />
            </label>

            {role === "student" && (
              <label className="block">
                <div className="mb-1.5 text-[11.5px] font-semibold text-[rgba(16,24,39,0.7)]">
                  班级
                </div>
                <Select
                  value={classId}
                  onValueChange={setClassId}
                  disabled={isLoading || classesLoading}
                >
                  <SelectTrigger className="h-11 w-full rounded-[8px] border border-[rgba(23,39,95,0.16)] bg-[rgba(250,248,242,0.72)] px-3.5 text-[13px] text-[var(--text-main)] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] focus:ring-[3px] focus:ring-[rgba(18,214,214,0.16)]">
                    <SelectValue
                      placeholder={classesLoading ? "加载中..." : "请选择班级"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                        {cls.code ? ` (${cls.code})` : ""}
                      </SelectItem>
                    ))}
                    {!classesLoading && classes.length === 0 && (
                      <div className="px-2 py-4 text-center text-sm text-ink-4">
                        暂无可选班级
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </label>
            )}

            {role === "teacher" && (
              <label className="block">
                <div className="mb-1.5 text-[11.5px] font-semibold text-[rgba(16,24,39,0.7)]">
                  教师注册密钥
                </div>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  disabled={isLoading}
                  placeholder="请向管理员获取密钥"
                  className={inputClass}
                />
              </label>
            )}

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
              className="mt-2 h-11 w-full rounded-[8px] text-[13px] font-semibold text-white shadow-[0_12px_26px_rgba(23,39,95,0.16)] transition duration-200 hover:-translate-y-px hover:shadow-[0_16px_34px_rgba(18,214,214,0.14),0_10px_28px_rgba(123,97,255,0.13)] disabled:translate-y-0 disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, #24357D 0%, #17275F 50%, #1D3B8F 100%)",
              }}
            >
              {isLoading ? "注册中..." : "注册"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-[var(--line-soft)]" />
            <span className="text-[11px] text-[rgba(107,114,128,0.72)]">或</span>
            <div className="h-px flex-1 bg-[var(--line-soft)]" />
          </div>

          <p className="text-center text-[12.5px] text-[var(--text-muted)]">
            已有账号？{" "}
            <Link
              href="/login"
              className="font-medium text-[var(--brand-indigo)] underline-offset-4 transition hover:text-[var(--brand-blue)] hover:underline"
            >
              立即登录
            </Link>
          </p>

          <div className="mt-7 text-center text-[11px] leading-relaxed text-[rgba(107,114,128,0.78)]">
            注册即代表你同意{" "}
            <span className="text-[rgba(16,24,39,0.62)]">使用条款</span> 与{" "}
            <span className="text-[rgba(16,24,39,0.62)]">隐私政策</span>
          </div>
        </section>
        <ValueOrbitStrip />
      </div>
    </AuthLayout>
  );
}
