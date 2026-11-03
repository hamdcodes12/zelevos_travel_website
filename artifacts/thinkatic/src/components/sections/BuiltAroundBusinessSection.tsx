import React from "react";
import {
  Compass,
  FileCode2,
  Cpu,
  Activity,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export function BuiltAroundBusinessSection() {
  const STEPS = [
    {
      num: "01",
      title: "UNDERSTAND",
      description: "Understand your requirements and business objectives.",
      icon: Compass,
    },
    {
      num: "02",
      title: "DESIGN",
      description: "Map processes and design the operating model.",
      icon: FileCode2,
    },
    {
      num: "03",
      title: "IMPLEMENT",
      description: "Set up people, workflows, technology and operations.",
      icon: Cpu,
    },
    {
      num: "04",
      title: "OPERATE",
      description: "Run the process with measurable performance standards.",
      icon: Activity,
    },
    {
      num: "05",
      title: "OPTIMISE",
      description: "Identify opportunities to improve quality, productivity and efficiency.",
      icon: Sparkles,
    },
    {
      num: "06",
      title: "SCALE",
      description: "Expand operational capacity as your business grows.",
      icon: TrendingUp,
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-slate-50/80 border-t border-b border-slate-200/80 relative" aria-label="Operating Process">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
              METHODOLOGY &amp; WORKFLOW
            </span>
          </div>

          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-5">
            Built Around Your Business
          </h2>

          <div className="space-y-3 text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto font-normal">
            <p className="font-medium text-slate-800">
              Every business is different.
            </p>
            <p>
              That's why we don't believe in one-size-fits-all outsourcing.
            </p>
            <p>
              We understand your requirements, map your processes, identify opportunities for improvement, and build an operating model around your business.
            </p>
          </div>
        </div>

        {/* 6-Step Connected Grid Timeline */}
        <div className="relative">
          {/* Timeline decorative horizontal track behind cards (desktop only) */}
          <div className="hidden xl:block absolute top-[4.5rem] left-[5%] right-[5%] h-0.5 bg-gradient-to-r from-blue-200 via-[#214ECF]/30 to-blue-200 z-0" aria-hidden="true" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 relative z-10">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all duration-300 flex flex-col items-start text-left group"
                >
                  {/* Top Step Pill with Connected Dot */}
                  <div className="w-full flex items-center justify-between mb-5">
                    <span className="font-mono text-xs font-bold text-[#214ECF] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                      {step.num}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-[#214ECF] group-hover:text-white transition-all duration-300">
                      <Icon size={17} />
                    </div>
                  </div>

                  {/* Step Title */}
                  <h3 className="font-display font-extrabold text-base text-slate-900 tracking-wide uppercase mb-2">
                    {step.title}
                  </h3>

                  {/* Step Description */}
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {step.description}
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
