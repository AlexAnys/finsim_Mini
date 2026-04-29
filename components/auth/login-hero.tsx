export function LoginHero() {
  return (
    <section className="auth-fade-up relative mx-auto max-w-[680px] text-center min-[920px]:mx-0 min-[920px]:max-w-[540px] min-[920px]:text-left">
      <HeroOrbit />
      <p className="mb-5 text-[12px] font-semibold text-[var(--brand-indigo)]">
        AI 教学洞察平台
      </p>
      <h1 className="max-w-[680px] text-4xl font-semibold leading-[1.12] text-[var(--text-main)] sm:text-[44px] min-[920px]:text-[42px] lg:text-[52px]">
        课堂之后，真正的教学才开始。
      </h1>
      <p className="mt-6 max-w-[520px] text-[15px] leading-8 text-[var(--text-muted)] sm:text-base min-[920px]:mx-0">
        灵析整理每位学生的对话、答题与提交，把分散的信号汇成教师可采取的下一步。
      </p>
      <div className="mt-9 hidden max-w-[480px] grid-cols-3 gap-4 min-[920px]:grid">
        {[
          ["洞察", "发现课堂后真实卡点"],
          ["共鸣", "理解每位学生的信号"],
          ["行动", "把反馈转成下一步"],
        ].map(([title, body]) => (
          <div key={title} className="border-l border-[var(--line-soft)] pl-4">
            <div className="text-[18px] font-semibold text-[var(--brand-navy)]">
              {title}
            </div>
            <div className="mt-1 text-[11px] leading-5 text-[rgba(16,24,39,0.48)]">
              {body}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroOrbit() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 360 210"
      className="pointer-events-none absolute -right-2 -top-12 hidden h-[210px] w-[360px] opacity-75 sm:block lg:-right-16"
      fill="none"
    >
      <path
        d="M26 132C88 38 204 30 326 86"
        stroke="rgba(23,39,95,0.13)"
        strokeWidth="1.1"
      />
      <path
        className="auth-path-pulse"
        d="M44 150C118 80 230 82 322 38"
        stroke="url(#hero-orbit-gradient)"
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <circle className="auth-orbit-star" cx="322" cy="38" r="4" fill="#12d6d6" />
      <circle cx="322" cy="38" r="9" fill="#12d6d6" opacity="0.12" />
      <defs>
        <linearGradient id="hero-orbit-gradient" x1="44" y1="150" x2="322" y2="38">
          <stop stopColor="#17275F" stopOpacity="0" />
          <stop offset="0.58" stopColor="#4D8CFF" stopOpacity="0.42" />
          <stop offset="1" stopColor="#12D6D6" stopOpacity="0.72" />
        </linearGradient>
      </defs>
    </svg>
  );
}
