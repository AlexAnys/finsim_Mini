"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
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
    "w-full rounded-[7px] border border-line bg-paper-alt px-3.5 py-2.5 text-[13px] text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

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
            F
          </div>
          <div>
            <div className="text-[15px] font-semibold">FinSim AI</div>
            <div className="mt-0.5 text-[10.5px] text-white/55">
              面向金融教育的 AI 实训平台
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="mb-4 text-4xl font-semibold leading-tight tracking-tight">
            从第一份任务开始，
            <br />
            <span style={{ color: "var(--fs-sim)" }}>边练边学</span>。
          </h2>
          <p className="max-w-[480px] text-sm leading-relaxed text-white/75">
            创建账号后即可加入老师的课堂，做模拟、写报告、看 AI 给出的逐条建议。
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-3.5">
          {[
            { n: "3 类", l: "任务模式" },
            { n: "AI", l: "实时点评" },
            { n: "中文", l: "全程界面" },
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
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div
              className="grid h-10 w-10 place-items-center rounded-lg text-base font-bold text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--fs-sim), var(--fs-primary))",
              }}
            >
              F
            </div>
            <div>
              <div className="text-base font-semibold text-ink">FinSim AI</div>
              <div className="text-[11px] text-ink-4">
                面向金融教育的 AI 实训平台
              </div>
            </div>
          </div>

          <div
            role="group"
            aria-label="选择注册角色"
            className="mb-7 flex rounded-lg p-1"
            style={{ background: "var(--fs-bg-alt)" }}
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
            创建账号
          </h1>
          <p className="mb-7 mt-1.5 text-[13px] leading-relaxed text-ink-4">
            填写下面的信息加入 FinSim 平台。
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <label className="block">
              <div className="mb-1.5 text-[11.5px] font-semibold text-ink-3">
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
                className={inputClass}
              />
            </label>

            <label className="block">
              <div className="mb-1.5 text-[11.5px] font-semibold text-ink-3">
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
              <div className="mb-1.5 text-[11.5px] font-semibold text-ink-3">
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
                <div className="mb-1.5 text-[11.5px] font-semibold text-ink-3">
                  班级
                </div>
                <Select
                  value={classId}
                  onValueChange={setClassId}
                  disabled={isLoading || classesLoading}
                >
                  <SelectTrigger className="w-full rounded-[7px] border border-line bg-paper-alt px-3.5 py-2.5 text-[13px] text-ink">
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
                <div className="mb-1.5 text-[11.5px] font-semibold text-ink-3">
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
              className="mt-2 w-full rounded-lg py-3 text-[13px] font-semibold text-white transition disabled:opacity-60"
              style={{ background: "var(--fs-ink)" }}
            >
              {isLoading ? "注册中..." : "注册"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[11px] text-ink-5">或</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <p className="text-center text-[12.5px] text-ink-4">
            已有账号？{" "}
            <Link
              href="/login"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              立即登录
            </Link>
          </p>

          <div className="mt-7 text-center text-[11px] leading-relaxed text-ink-5">
            注册即代表你同意{" "}
            <span className="text-ink-4">使用条款</span> 与{" "}
            <span className="text-ink-4">隐私政策</span>
          </div>
        </div>
      </main>
    </div>
  );
}
