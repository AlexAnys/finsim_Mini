type InfinityMarkProps = {
  className?: string;
};

export function InfinityMark({ className }: InfinityMarkProps) {
  return (
    <svg
      viewBox="0 0 120 72"
      className={className}
      role="img"
      aria-label="灵析 AI 无限轨道标识"
    >
      <defs>
        <linearGradient id="lingxi-mark-ribbon" x1="18" y1="12" x2="102" y2="60">
          <stop offset="0%" stopColor="#283A8C" />
          <stop offset="28%" stopColor="#4D8CFF" />
          <stop offset="58%" stopColor="#7b61ff" />
          <stop offset="100%" stopColor="#12d6d6" />
        </linearGradient>
        <linearGradient id="lingxi-mark-orbit" x1="12" y1="58" x2="108" y2="10">
          <stop offset="0%" stopColor="#4d8cff" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#12d6d6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7b61ff" stopOpacity="0.28" />
        </linearGradient>
        <filter id="lingxi-mark-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.07 0 0 0 0 0.84 0 0 0 0 0.84 0 0 0 0.42 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M16 43C26 18 45 14 61 36C77 58 96 54 105 30"
        fill="none"
        stroke="url(#lingxi-mark-ribbon)"
        strokeLinecap="round"
        strokeWidth="8.5"
        filter="url(#lingxi-mark-glow)"
      />
      <path
        d="M16 29C26 54 45 58 61 36C77 14 96 18 105 42"
        fill="none"
        stroke="url(#lingxi-mark-ribbon)"
        strokeLinecap="round"
        strokeWidth="8.5"
        opacity="0.9"
        filter="url(#lingxi-mark-glow)"
      />
      <path
        d="M20 53C44 67 93 54 106 18"
        fill="none"
        stroke="url(#lingxi-mark-orbit)"
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <circle cx="104.5" cy="18.5" r="3" fill="#f8feff" />
      <circle cx="104.5" cy="18.5" r="6" fill="#12d6d6" opacity="0.18" />
    </svg>
  );
}
