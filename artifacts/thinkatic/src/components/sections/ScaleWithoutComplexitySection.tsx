import React from "react";
import {
  Layers,
  Zap,
  TrendingUp,
  HeartHandshake,
} from "lucide-react";

export function ScaleWithoutComplexitySection() {
  const PILLARS = [
    {
      title: "REDUCE OPERATIONAL COMPLEXITY",
      description:
        "Let our teams handle processes while your core team focuses on strategic priorities.",
      icon: Layers,
    },
    {
      title: "IMPROVE EFFICIENCY",
      description:
        "Standardised processes and technology help create faster, more consistent operations.",
      icon: Zap,
    },
    {
      title: "SCALE FASTER",
      description:
        "Increase operational capacity without building every function internally.",
      icon: TrendingUp,
    },
    {
      title: "IMPROVE CUSTOMER EXPERIENCE",
      description:
        "Deliver responsive, reliable, and professional customer interactions.",
      icon: HeartHandshake,
    },
  ];

  return (
    <section
      className="py-20 md:py-28 bg-[#071330] text-white relative overflow-hidden"
      aria-label="Scale Without the Complexity"
      style={{
        background: "linear-gradient(135deg, #060F26 0%, #071330 50%, #0A1C4D 100%)",
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
        
        {/* Header Block */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-500/15 border border-blue-400/25 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-blue-300 font-bold">
              OPERATIONAL LEVERAGE
            </span>
          </div>

          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight mb-5">
            Scale Without the Complexity
          </h2>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            Whether you're a startup looking to build your first support team or an established organisation looking to optimise operations, Thinkatic provides the infrastructure and expertise to help you scale.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {PILLARS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-2xl p-7 sm:p-9 bg-white/[0.04] border border-white/10 hover:border-blue-400/40 hover:bg-white/[0.07] transition-all duration-300 flex flex-col items-start text-left group shadow-lg shadow-black/20"
              >
                <div className="w-13 h-13 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all duration-300 mb-6 shrink-0">
                  <Icon size={24} />
                </div>

                <h3 className="font-display font-bold text-base sm:text-lg text-white tracking-wider uppercase mb-2.5">
                  {card.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
