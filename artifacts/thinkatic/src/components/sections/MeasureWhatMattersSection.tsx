import React from "react";
import {
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  Smile,
  Target,
  BarChart3,
} from "lucide-react";

export function MeasureWhatMattersSection() {
  const METRICS = [
    {
      name: "Quality",
      desc: "Structured evaluation frameworks, call audits, and error prevention protocols.",
      icon: ShieldCheck,
    },
    {
      name: "Productivity",
      desc: "Output benchmarks, active delivery hours, and task throughput tracking.",
      icon: TrendingUp,
    },
    {
      name: "Response Time",
      desc: "First contact velocity, queue management, and prompt customer engagement.",
      icon: Clock,
    },
    {
      name: "Resolution Time",
      desc: "First-contact resolution (FCR) discipline and disciplined ticket closure cycles.",
      icon: CheckCircle2,
    },
    {
      name: "Customer Satisfaction",
      desc: "Post-interaction sentiment, feedback capture, and experience ratings.",
      icon: Smile,
    },
    {
      name: "Process Accuracy",
      desc: "Strict adherence to client operating standards and verification compliance.",
      icon: Target,
    },
    {
      name: "Operational Efficiency",
      desc: "Continuous workflow refinement, root cause elimination, and cost optimization.",
      icon: BarChart3,
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden" aria-label="Built to Measure What Matters">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
              PERFORMANCE ARCHITECTURE
            </span>
          </div>

          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
            Built to Measure What Matters
          </h2>

          <div className="space-y-2 text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto font-normal">
            <p className="font-medium text-slate-800">
              We believe outsourcing should be measurable.
            </p>
            <p>
              Our operations can be structured around clearly defined performance metrics such as:
            </p>
          </div>
        </div>

        {/* 7 Metric Framework Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-6xl mx-auto mb-16">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.name}
                className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md hover:border-blue-300 hover:bg-white transition-all duration-300 flex flex-col items-start text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-white border border-blue-100 flex items-center justify-center text-[#214ECF] mb-4 group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Icon size={20} />
                </div>

                <h3 className="font-display font-bold text-base text-slate-900 mb-1.5">
                  {metric.name}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {metric.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom Triad Statement */}
        <div className="max-w-2xl mx-auto bg-gradient-to-r from-blue-50/60 via-blue-50 to-blue-50/60 rounded-2xl p-6 sm:p-8 border border-blue-200/80 text-center shadow-xs">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm sm:text-base md:text-lg font-display font-bold text-slate-900">
            <span>Clear metrics.</span>
            <span className="hidden sm:inline text-blue-300">•</span>
            <span className="text-[#214ECF]">Transparent performance.</span>
            <span className="hidden sm:inline text-blue-300">•</span>
            <span>Continuous improvement.</span>
          </div>
        </div>

      </div>
    </section>
  );
}
