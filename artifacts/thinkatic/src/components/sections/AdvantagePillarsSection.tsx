import React from "react";
import { Cpu, Users, Workflow, ArrowRight } from "lucide-react";

export function AdvantagePillarsSection() {
  const PILLARS = [
    {
      step: "01",
      title: "TECHNOLOGY",
      subtitle: "Intelligent Systems",
      description: "Automation, platforms, systems & analytics.",
      icon: Cpu,
    },
    {
      step: "02",
      title: "PEOPLE",
      subtitle: "Dedicated Talent",
      description: "Trained professionals focused on quality and customer experience.",
      icon: Users,
    },
    {
      step: "03",
      title: "PROCESS",
      subtitle: "Operational Rigor",
      description: "Structured workflows designed for efficiency, consistency, and scale.",
      icon: Workflow,
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden" aria-label="The Thinkatic Advantage">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
        
        {/* Header Block */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
              THE TRIAD MODEL
            </span>
          </div>
          
          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-3">
            Technology + People + Process
          </h2>
          
          <p className="font-display font-bold text-xl sm:text-2xl text-[#214ECF] mb-6">
            That's the Thinkatic Advantage.
          </p>

          {/* Intro Narrative */}
          <div className="space-y-2 text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl mx-auto font-normal">
            <p>Technology alone doesn't transform a business.</p>
            <p>People alone can't scale everything.</p>
            <p>Processes without technology become inefficient.</p>
            <p className="font-semibold text-slate-900 pt-2 text-base sm:text-lg">
              We bring all three together.
            </p>
          </div>
        </div>

        {/* Connected Cards with Line/Flow */}
        <div className="relative max-w-5xl mx-auto">
          {/* Subtle horizontal connecting line on desktop */}
          <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-blue-200 via-[#214ECF]/40 to-blue-200 -translate-y-6 z-0" aria-hidden="true" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {PILLARS.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col items-center text-center group"
                >
                  {/* Step badge */}
                  <span className="text-[10px] font-mono uppercase font-bold text-[#214ECF] tracking-widest bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 mb-4">
                    PILLAR {pillar.step}
                  </span>

                  {/* Icon Node with ring */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/70 border border-blue-200 flex items-center justify-center text-[#214ECF] mb-5 shadow-xs group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all duration-300">
                    <Icon size={28} />
                  </div>

                  {/* Title */}
                  <h3 className="font-display font-extrabold text-lg sm:text-xl text-slate-900 tracking-wider mb-1">
                    {pillar.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#214ECF] uppercase tracking-wider mb-3">
                    {pillar.subtitle}
                  </p>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
