export const tokens = {
  ink: "#0F1623",
  ink2: "#1F2937",
  ink3: "#4B5563",
  ink4: "#6B7280",
  ink5: "#9CA3AF",
  line: "#E8E4DB",
  line2: "#EFECE5",
  hairline: "#D9D3C6",

  bg: "#F7F4EC",
  bgAlt: "#FDFBF5",
  surface: "#FFFFFF",
  surfaceTint: "#FBF9F2",

  primary: "#1E2A5E",
  primaryDeep: "#111A42",
  primaryLift: "#2A3975",
  primaryFg: "#FFFFFF",
  primarySoft: "#E7EAF3",
  primarySoft2: "#D4DAE9",

  accent: "#C48A3C",
  accentSoft: "#F6ECD8",

  success: "#0F7A5A",
  successSoft: "#DCF2E8",
  successDeep: "#0A5A42",
  warn: "#B4751C",
  warnSoft: "#FBEFD4",
  danger: "#B4322B",
  dangerSoft: "#F8E0DD",
  info: "#2E5FB4",
  infoSoft: "#DDE8FA",

  sim: "#5B4FB8",
  simSoft: "#ECE9F7",
  quiz: "#2E5FB4",
  quizSoft: "#DDE8FA",
  subj: "#0F7A5A",
  subjSoft: "#DCF2E8",

  shadow:
    "0 1px 2px rgba(15,22,35,0.04), 0 1px 3px rgba(15,22,35,0.03)",
  shadowLg:
    "0 1px 2px rgba(15,22,35,0.04), 0 8px 24px rgba(15,22,35,0.06)",
  shadowPop:
    "0 4px 16px rgba(15,22,35,0.08), 0 2px 4px rgba(15,22,35,0.04)",

  fontSans:
    '"PingFang SC", "HarmonyOS Sans", "Microsoft YaHei", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  fontMono:
    '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace',
  fontSerif:
    '"PingFang SC", "Source Han Serif CN", "Songti SC", Georgia, serif',
} as const;

export const tagColors = {
  tagA: { bg: "#EAE7FA", fg: "#453D91" },
  tagB: { bg: "#E0ECFA", fg: "#1F447B" },
  tagC: { bg: "#DFF0E8", fg: "#0A5A42" },
  tagD: { bg: "#FAEADB", fg: "#8A4F1A" },
  tagE: { bg: "#F6E1E0", fg: "#7F2A26" },
  tagF: { bg: "#E3EDE8", fg: "#2F5E4C" },
} as const;

export type TagColorKey = keyof typeof tagColors;

const TAG_KEYS: readonly TagColorKey[] = [
  "tagA",
  "tagB",
  "tagC",
  "tagD",
  "tagE",
  "tagF",
];

export function courseColorForId(id: string): TagColorKey {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TAG_KEYS[hash % TAG_KEYS.length];
}

export const taskTypeColors = {
  simulation: { fg: tokens.sim, soft: tokens.simSoft },
  quiz: { fg: tokens.quiz, soft: tokens.quizSoft },
  subjective: { fg: tokens.subj, soft: tokens.subjSoft },
} as const;

export type TaskTypeKey = keyof typeof taskTypeColors;
