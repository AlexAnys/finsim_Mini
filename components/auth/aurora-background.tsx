export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[var(--bg-main)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_16%,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_78%_12%,var(--glow-cyan),transparent_34%),radial-gradient(circle_at_74%_72%,var(--glow-violet),transparent_36%)]" />
      <div className="auth-star-dust absolute inset-0 opacity-70" />

      <svg
        className="absolute -left-28 bottom-0 h-[380px] w-[760px] opacity-70"
        viewBox="0 0 760 380"
        fill="none"
      >
        <path
          d="M18 316C122 230 228 216 340 272C464 334 582 318 735 188"
          stroke="rgba(23,39,95,0.13)"
          strokeWidth="1.2"
        />
        <path
          d="M42 343C154 259 266 247 384 302C512 362 628 334 752 220"
          stroke="rgba(18,214,214,0.13)"
          strokeWidth="1"
        />
        <path
          className="auth-path-pulse"
          d="M112 290C242 184 416 206 590 110"
          stroke="url(#left-orbit-line)"
          strokeLinecap="round"
          strokeWidth="1.1"
        />
        <circle cx="590" cy="110" r="3.5" fill="#4d8cff" opacity="0.55" />
        <defs>
          <linearGradient id="left-orbit-line" x1="112" y1="290" x2="590" y2="110">
            <stop stopColor="#17275F" stopOpacity="0" />
            <stop offset="0.62" stopColor="#4D8CFF" stopOpacity="0.4" />
            <stop offset="1" stopColor="#12D6D6" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>

      <svg
        className="absolute -right-48 -top-28 h-[520px] w-[700px] opacity-65"
        viewBox="0 0 700 520"
        fill="none"
      >
        <path
          d="M102 338C226 114 454 66 660 142"
          stroke="url(#aurora-arc)"
          strokeLinecap="round"
          strokeWidth="42"
          opacity="0.28"
        />
        <path
          d="M128 352C268 156 454 106 660 170"
          stroke="rgba(23,39,95,0.16)"
          strokeLinecap="round"
          strokeWidth="1.2"
        />
        <circle className="auth-orbit-star" cx="300" cy="190" r="4" fill="#12d6d6" opacity="0.7" />
        <defs>
          <linearGradient id="aurora-arc" x1="102" y1="338" x2="660" y2="142">
            <stop stopColor="#12D6D6" stopOpacity="0" />
            <stop offset="0.45" stopColor="#12D6D6" />
            <stop offset="0.78" stopColor="#7B61FF" />
            <stop offset="1" stopColor="#4D8CFF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
