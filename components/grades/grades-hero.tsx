"use client";

// PR-STU-1 · 学生 /grades hero 卡（深靛大数 + by-type 三柱）
// 数据来自 buildHeaderStats + buildByTypeStats（lib/utils/grades-transforms）
//
// 视觉对照 mockup `.harness/mockups/design/student-grades.jsx` 的 Top panel：
// - 左：本学期平均（深靛底，56pt 白色大数 + 学期目标提示）
// - 右：3 列分类（模拟/测验/主观，左右用 hairline 分隔，含近 5 次 mini bar）

import type { ByTypeStat, GradesHeaderStats } from "@/lib/utils/grades-transforms";

interface GradesHeroProps {
  header: GradesHeaderStats;
  byType: ByTypeStat[];
}

const TYPE_TONE: Record<
  ByTypeStat["type"],
  { dot: string; bar: string }
> = {
  simulation: { dot: "bg-sim", bar: "bg-sim" },
  quiz: { dot: "bg-quiz", bar: "bg-quiz" },
  subjective: { dot: "bg-subj", bar: "bg-subj" },
};

function MiniBars({
  percents,
  toneClass,
}: {
  percents: number[];
  toneClass: string;
}) {
  // 至少补到 5 槽，未填的用 line 色占位
  const slots = Array.from({ length: 5 }, (_, i) => percents[i] ?? null);
  return (
    <div className="mt-3 flex h-9 items-end gap-[3px]">
      {slots.map((p, i) => {
        const isLast = i === slots.length - 1 && percents[i] != null;
        const heightPct = p == null ? 18 : Math.max(8, Math.min(100, p));
        return (
          <div
            key={i}
            className={`flex-1 rounded-sm ${p == null ? "bg-line" : isLast ? toneClass : "bg-line-2"}`}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
}

export function GradesHero({ header, byType }: GradesHeroProps) {
  const goalScore = 90;
  const remaining = Math.max(0, goalScore - header.avgPercent);
  const hasReleased = header.releasedCount > 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {/* 左 · 本学期平均 */}
      <div className="relative overflow-hidden rounded-[14px] bg-brand px-7 py-6 text-brand-fg shadow-fs">
        {/* 装饰光晕 — 暖赭径向渐变（用 token 色） */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -top-5 h-44 w-44 rounded-full opacity-40"
          style={{
            background:
              "radial-gradient(circle, var(--fs-accent) 0%, transparent 70%)",
          }}
        />
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] opacity-70">
          本学期平均
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="font-mono text-[52px] font-bold leading-none tracking-[-0.04em]">
            {hasReleased ? header.avgPercent : "—"}
          </span>
          <span className="text-lg opacity-60">/100</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-xs opacity-90">
          <span>
            已公布{" "}
            <span className="font-semibold text-ochre">
              {header.releasedCount}
            </span>{" "}
            / {header.totalCount} 次
          </span>
        </div>
        <div className="mt-4 border-t border-white/15 pt-3.5 text-xs leading-relaxed opacity-80">
          <span className="font-semibold text-ochre opacity-100">
            学期目标 {goalScore}
          </span>
          {hasReleased ? (
            <>
              <span> · 还差 </span>
              <span className="font-semibold">{remaining}</span>
              <span> 分。继续保持已交付任务的稳定性，重点打磨待提升类别。</span>
            </>
          ) : (
            <span> · 还没有已公布成绩。提交后由教师公布即可在此查看进展。</span>
          )}
        </div>
      </div>

      {/* 右 · 三类分布 */}
      <div className="grid grid-cols-3 gap-0 rounded-[14px] border border-line bg-paper p-5 shadow-fs">
        {byType.map((b, i) => {
          const tone = TYPE_TONE[b.type];
          return (
            <div
              key={b.type}
              className={`px-4 ${i === 0 ? "" : "border-l border-line-2"}`}
            >
              <div className="flex items-center gap-1.5 pb-2.5">
                <span
                  className={`size-1.5 rounded-full ${tone.dot}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-ink-2">
                  {b.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-[34px] font-bold leading-none tracking-[-0.03em] text-ink">
                  {b.avgPercent ?? "—"}
                </span>
                <span className="text-[13px] text-ink-4">
                  {b.avgPercent != null ? "/100" : ""}
                </span>
              </div>
              <div className="mt-1.5 text-[11.5px] text-ink-4">
                {b.releasedCount} 次已公布
              </div>
              <MiniBars percents={b.recentPercents} toneClass={tone.bar} />
              <div className="mt-1 text-[10px] tracking-[0.05em] text-ink-5">
                近 5 次
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
