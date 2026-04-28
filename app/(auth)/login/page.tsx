"use client";

/**
 * 灵析 AI · 登录页 V4 深色版 · Midnight Aurora
 *
 * 关键技术：mix-blend-mode: screen 让品牌资产中的深空底变透明，
 *           只保留极光、星点、丝带等亮色元素融入页面背景。
 *
 * 真实品牌资产（来自 灵析V2.zip）：
 *   /public/brand/lockup.png        ← 横向 wordmark（∞ + 灵析 AI + LingXi）
 *   /public/brand/mood-aurora.png   ← brand mood 极光横幅（顶部背景）
 *   /public/brand/value-connect.png ← 连接（双星椭圆轨道，含文字）
 *   /public/brand/value-explore.png ← 探索（星系螺旋，含文字）
 *   /public/brand/value-grow.png    ← 成长（S 形螺旋向上，含文字）
 *
 * 落地步骤：HANDOFF-V4-DARK.md
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);
    if (!email.trim()) { setInlineError("请输入邮箱"); return; }
    if (!password) { setInlineError("请输入密码"); return; }

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim(), password, redirect: false,
      });
      if (result?.error) { setInlineError("邮箱或密码错误"); return; }
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
    <div className="lx-page">
      <AuroraBackground />
      <BrandHeader />

      <main className="lx-main">
        <div className="lx-stage">
          <LoginHero />
          <LoginForm
            email={email}
            password={password}
            isLoading={isLoading}
            inlineError={inlineError}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={handleSubmit}
          />
        </div>
        <ValueOrbitStrip />
      </main>

      <SiteFooter />
    </div>
  );
}

// ─── AuroraBackground ───
function AuroraBackground() {
  return (
    <div className="lx-aurora" aria-hidden>
      {/* mood 图融入背景：mix-blend-mode: screen 让黑底透明 */}
      <div
        className="lx-aurora-mood"
        style={{ backgroundImage: "url(/brand/mood-aurora.png)" }}
      />
      <div className="lx-aurora-arc-tr" />
      <div className="lx-aurora-arc-bl" />
      <div className="lx-stardust" />

      <svg className="lx-orbit-decor" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs>
          <linearGradient id="track-bl" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6a7cff" stopOpacity="0" />
            <stop offset="50%" stopColor="#4fd1ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00e0d6" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="track-tr" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e0d6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6a7cff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M -40 760 Q 220 680, 420 740 Q 620 800, 820 720 T 1200 760" stroke="url(#track-bl)" strokeWidth="1.2" fill="none" />
        <circle cx="220" cy="708" r="2.5" fill="#4fd1ff" opacity="0.85" />
        <circle cx="620" cy="780" r="2" fill="#6a7cff" opacity="0.75" />
        <circle cx="1020" cy="724" r="2.5" fill="#00e0d6" opacity="0.85" />
        <path d="M 900 80 Q 1140 140, 1320 280 Q 1420 380, 1480 540" stroke="url(#track-tr)" strokeWidth="1.4" fill="none" />
        <circle cx="1140" cy="140" r="2" fill="#00e0d6" opacity="0.85" />
        <circle cx="1320" cy="280" r="2.5" fill="#4fd1ff" opacity="0.85" />
      </svg>
    </div>
  );
}

// ─── BrandHeader · Logo 融入背景 ───
function BrandHeader() {
  return (
    <header className="lx-topbar">
      <div className="lx-brand">
        {/* mix-blend-mode: screen 在 CSS 里处理 — 黑底透明，logo 浮起 */}
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

// ─── LoginHero ───
function LoginHero() {
  return (
    <>
      <div className="lx-eyebrow">FOR EDUCATORS</div>
      <div className="lx-title-wrap">
        <h1 className="lx-title">
          课堂之后，
          <br />
          真正的<em>教学</em>才开始。
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
        灵析整理每位学生的对话、答题与提交，把分散的信号汇成教师可采取的下一步。
      </p>
    </>
  );
}

// ─── LoginForm ───
interface LoginFormProps {
  email: string;
  password: string;
  isLoading: boolean;
  inlineError: string | null;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

function LoginForm({
  email, password, isLoading, inlineError,
  onEmailChange, onPasswordChange, onSubmit,
}: LoginFormProps) {
  return (
    <>
      <form onSubmit={onSubmit} className="lx-form">
        <div className="lx-field">
          <div className="lx-field-row">
            <label className="lx-field-label" htmlFor="email">邮箱</label>
          </div>
          <div className="lx-input-wrap">
            <input
              className="lx-input" id="email" type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              placeholder="your@school.edu.cn"
            />
          </div>
        </div>

        <div className="lx-field">
          <div className="lx-field-row">
            <label className="lx-field-label" htmlFor="password">密码</label>
            <span className="lx-field-help">忘记密码？请联系管理员</span>
          </div>
          <div className="lx-input-wrap">
            <input
              className="lx-input" id="password" type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
        </div>

        {inlineError && (
          <div role="alert" className="lx-error">{inlineError}</div>
        )}

        <button type="submit" disabled={isLoading} className="lx-submit">
          <span>{isLoading ? "登录中..." : "登 录"}</span>
        </button>
      </form>

      <div className="lx-below-form">
        <span>
          还没有账号？
          <Link href="/register" className="lx-link-primary">立即注册</Link>
        </span>
        <span className="lx-legal">
          登录即代表同意 <a href="#">条款</a> 与 <a href="#">隐私</a>
        </span>
      </div>
    </>
  );
}

// ─── ValueOrbitStrip · 极简版：仅 3 张图 + screen blend，无文字无卡片 ───
// 文字（连接 / 探索 / 成长 + 描述）已包含在每张品牌图中，避免重复
const ORBIT_VALUES = [
  {
    img: "/brand/value-connect.png",
    alt: "连接 — 汇聚学生信号，形成师生理解通路",
  },
  {
    img: "/brand/value-explore.png",
    alt: "探索 — 从课堂反馈中发现未被说出的困惑",
  },
  {
    img: "/brand/value-grow.png",
    alt: "成长 — 让每次教学反馈都成为下一步行动",
  },
];

function ValueOrbitStrip() {
  return (
    <section className="lx-orbit-strip" aria-label="灵析 AI 核心价值（连接 · 探索 · 成长）">
      <div className="lx-orbit-grid">
        {ORBIT_VALUES.map((v) => (
          <div key={v.img} className="lx-orbit-pillar">
            <div className="lx-orbit-img-wrap">
              <Image
                src={v.img}
                alt={v.alt}
                width={400}
                height={300}
                className="lx-orbit-img"
                style={{ width: "auto", height: "auto" }}
                loading="lazy"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
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
