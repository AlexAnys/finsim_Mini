"use client";

/**
 * 灵析 AI · 注册页 V4 深色版 · Midnight Aurora
 *
 * 与登录页同款 BrandHeader + AuroraBackground + SiteFooter，
 * 但去掉 ValueOrbitStrip（避免页面过长），保留所有原版字段和校验逻辑。
 *
 * 替换路径：finsim/app/(auth)/register/page.tsx
 *
 * 共享 CSS：login-dark.module.css（已在 login 页面用过）
 *           本文件需要追加 register 专属样式（role-switch、select 适配）
 *           见同目录 register-extra.module.css
 *
 * 保留的行为（与原版完全一致）：
 *   - 字段：name, email, password, confirmPassword, classId(学生)/adminKey(教师)
 *   - 学生角色自动加载班级列表（GET /api/classes）
 *   - 完整校验：姓名 / 邮箱格式 / 密码长度 / 密码一致 / 班级或密钥必填
 *   - 注册流程：POST /api/auth/register → 自动 signIn → 按 role 跳转
 */

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
          if (data.success) setClasses(data.data);
        })
        .catch(() => toast.error("获取班级列表失败"))
        .finally(() => setClassesLoading(false));
    }
  }, [role, classes.length]);

  function validate(): boolean {
    if (!name.trim()) { setInlineError("请输入姓名"); return false; }
    if (!email.trim()) { setInlineError("请输入邮箱"); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setInlineError("邮箱格式不正确"); return false; }
    if (password.length < 6) { setInlineError("密码至少 6 个字符"); return false; }
    if (password !== confirmPassword) { setInlineError("两次输入的密码不一致"); return false; }
    if (role === "student" && !classId) { setInlineError("学生必须选择班级"); return false; }
    if (role === "teacher" && !adminKey.trim()) { setInlineError("教师注册需要输入注册密钥"); return false; }
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

  function switchRole(newRole: "student" | "teacher") {
    setRole(newRole);
    setClassId("");
    setAdminKey("");
    setInlineError(null);
  }

  return (
    <div className="lx-page">
      <AuroraBackground />
      <BrandHeader />

      <main className="lx-main">
        <div className="lx-stage">
          <RegisterHero />

          {/* Role switch */}
          <div className="lx-role-switch" role="group" aria-label="选择注册角色">
            <button
              type="button"
              className={`lx-role-chip ${role === "student" ? "lx-role-chip--active" : ""}`}
              onClick={() => switchRole("student")}
              disabled={isLoading}
            >
              <span className="lx-role-chip-label">学生注册</span>
              <span className="lx-role-chip-sub">加入老师的课堂</span>
            </button>
            <button
              type="button"
              className={`lx-role-chip ${role === "teacher" ? "lx-role-chip--active" : ""}`}
              onClick={() => switchRole("teacher")}
              disabled={isLoading}
            >
              <span className="lx-role-chip-label">教师注册</span>
              <span className="lx-role-chip-sub">需要邀请密钥</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="lx-form">
            <Field label="姓名" id="name">
              <input
                className="lx-input" id="name" type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoComplete="name"
                placeholder="请输入真实姓名"
              />
            </Field>

            <Field label="邮箱" id="email">
              <input
                className="lx-input" id="email" type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
                placeholder="your@school.edu.cn"
              />
            </Field>

            <Field label="密码" id="password">
              <input
                className="lx-input" id="password" type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                placeholder="至少 6 个字符"
              />
              <div className="lx-password-hint">建议包含字母与数字组合</div>
            </Field>

            <Field label="确认密码" id="confirmPassword">
              <input
                className="lx-input" id="confirmPassword" type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                placeholder="再次输入密码"
              />
            </Field>

            {role === "student" && (
              <Field label="所在班级" id="classId">
                <select
                  className="lx-select" id="classId"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={isLoading || classesLoading}
                >
                  <option value="">
                    {classesLoading ? "加载中..." : "请选择班级"}
                  </option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}{cls.code ? ` (${cls.code})` : ""}
                    </option>
                  ))}
                  {!classesLoading && classes.length === 0 && (
                    <option value="" disabled>暂无可选班级</option>
                  )}
                </select>
              </Field>
            )}

            {role === "teacher" && (
              <Field
                label="教师注册密钥"
                id="adminKey"
                help="向管理员获取"
              >
                <input
                  className="lx-input" id="adminKey" type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  disabled={isLoading}
                  placeholder="请输入注册密钥"
                />
              </Field>
            )}

            {inlineError && (
              <div role="alert" className="lx-error">{inlineError}</div>
            )}

            <button type="submit" disabled={isLoading} className="lx-submit">
              <span>{isLoading ? "创建中..." : "创建账号"}</span>
            </button>
          </form>

          <div className="lx-below-form">
            <span>
              已有账号？
              <Link href="/login" className="lx-link-primary">立即登录</Link>
            </span>
            <span className="lx-legal">
              注册即代表同意 <a href="#">条款</a> 与 <a href="#">隐私</a>
            </span>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

// ─── Field 复用包装组件 ───
function Field({
  label, id, help, children,
}: {
  label: string;
  id: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="lx-field">
      <div className="lx-field-row">
        <label className="lx-field-label" htmlFor={id}>{label}</label>
        {help && <span className="lx-field-help">{help}</span>}
      </div>
      <div className="lx-input-wrap">{children}</div>
    </div>
  );
}

// ─── AuroraBackground ───
function AuroraBackground() {
  return (
    <div className="lx-aurora" aria-hidden>
      <div
        className="lx-aurora-mood"
        style={{ backgroundImage: "url(/brand/mood-aurora.png)" }}
      />
      <div className="lx-aurora-arc-tr" />
      <div className="lx-aurora-arc-bl" />
      <div className="lx-stardust" />
    </div>
  );
}

// ─── BrandHeader ───
function BrandHeader() {
  return (
    <header className="lx-topbar">
      <div className="lx-brand">
        <Image
          src="/brand/lockup.png"
          alt="灵析 AI · LingXi"
          width={220}
          height={56}
          className="lx-brand-logo"
          style={{ width: "auto" }}
          priority
        />
        <span className="lx-brand-divider" />
        <span className="lx-brand-tag">课堂洞察 · AI 教学助手</span>
      </div>
      <a className="lx-topbar-help" href="#">需要帮助？</a>
    </header>
  );
}

// ─── RegisterHero ───
function RegisterHero() {
  return (
    <>
      <div className="lx-eyebrow">JOIN US</div>
      <div className="lx-title-wrap">
        <h1 className="lx-title">
          教与学，
          <br />
          在这里<em>会合</em>。
        </h1>
        <svg className="lx-title-orbit" viewBox="0 0 130 90" fill="none" aria-hidden>
          <path d="M 5 70 Q 35 45, 65 55 Q 95 65, 125 30" stroke="rgba(79,209,255,0.45)" strokeWidth="0.8" fill="none" />
          <circle cx="125" cy="30" r="1.8" fill="#00e0d6">
            <animate attributeName="r" values="1.5;2.5;1.5" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="65" cy="55" r="1" fill="#6a7cff" opacity="0.85" />
          <circle cx="125" cy="30" r="6" fill="#00e0d6" opacity="0.25">
            <animate attributeName="r" values="4;8;4" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="3s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
      <p className="lx-sub">
        灵析 AI 把每节课的对话、答题与提交，汇成师生之间共同的理解。
      </p>
    </>
  );
}

// ─── SiteFooter ───
const FOOTER_BRAND_WORDS = ["无限", "理解", "共鸣", "成长", "探索"];

function SiteFooter() {
  return (
    <footer className="lx-footer">
      <div className="lx-footer-brand-line">
        {FOOTER_BRAND_WORDS.map((w, i) => (
          <span key={w} style={{ display: "contents" }}>
            <span>{w}</span>
            {i < FOOTER_BRAND_WORDS.length - 1 && (
              <span className="lx-footer-brand-dot" />
            )}
          </span>
        ))}
      </div>
      <div className="lx-footer-meta-row">
        <div className="lx-footer-meta">
          <span>灵析 AI · 教学平台</span>
          <span className="lx-footer-dot" />
          <span>v3.0</span>
          <span className="lx-footer-dot" />
          <span>2026</span>
        </div>
        <div>© 2026 灵析</div>
      </div>
    </footer>
  );
}
