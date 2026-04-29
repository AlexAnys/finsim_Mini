const VALUES = [
  {
    title: "连接",
    body: "汇聚学生信号，形成师生理解通路。",
  },
  {
    title: "探索",
    body: "从课堂反馈中发现未被说出的困惑。",
  },
  {
    title: "成长",
    body: "让每次教学反馈都成为下一步行动。",
  },
];

export function ValueOrbitStrip() {
  return (
    <section className="auth-fade-up auth-fade-up-delay-2 relative mt-12">
      <div className="absolute left-[15px] top-6 bottom-6 w-px bg-[var(--line-soft)] min-[920px]:left-0 min-[920px]:right-0 min-[920px]:top-[15px] min-[920px]:bottom-auto min-[920px]:h-px min-[920px]:w-auto" />
      <div className="relative grid gap-5 min-[920px]:grid-cols-3 min-[920px]:gap-4">
        {VALUES.map((item) => (
          <div key={item.title} className="relative flex gap-3 min-[920px]:block min-[920px]:text-center">
            <span
              className="relative z-10 block h-8 w-8 shrink-0 rounded-full border min-[920px]:mx-auto"
              style={{
                borderColor: "rgba(23,39,95,0.12)",
                background:
                  "radial-gradient(circle, var(--brand-cyan) 0 4px, rgba(18,214,214,0.1) 4.5px, var(--bg-soft) 5px)",
                boxShadow: "0 0 14px var(--glow-cyan)",
              }}
            />
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--brand-navy)]">
                {item.title}
              </h2>
              <p className="mt-1 max-w-[210px] text-[11.5px] leading-5 text-[rgba(16,24,39,0.58)] min-[920px]:mx-auto">
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
