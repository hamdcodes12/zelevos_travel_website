import { motion } from "framer-motion";
import { Link } from "wouter";
import { Sparkles, ArrowRight, CheckCircle2, Star, Shield, Zap, Layers, ArrowUpRight } from "lucide-react";
import { FLAGSHIP_ENGAGEMENTS } from "@/data/packages-data";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function FlagshipPricingSection() {
  return (
    <section
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F6F9FF 50%, #FFFFFF 100%)" }}
      aria-label="Flagship Technology Engagements"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-6xl h-[600px] opacity-40"
          style={{
            background: "radial-gradient(ellipse at center, rgba(33,78,207,0.08) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: "linear-gradient(rgba(33,78,207,1) 1px, transparent 1px), linear-gradient(90deg, rgba(33,78,207,1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-5"
            style={{
              background: "rgba(33,78,207,0.06)",
              borderColor: "rgba(33,78,207,0.18)",
            }}
          >
            <Sparkles size={13} className="text-[#214ECF]" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#214ECF]">
              Strategic Flagship Engagements
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease, delay: 0.1 }}
            className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-[1.1] mb-5"
          >
            Mission-Critical Transformation. <br />
            <span className="bg-gradient-to-r from-[#214ECF] via-[#214ECF] to-[#2D5FE8] bg-clip-text text-transparent">
              Transparent Investment.
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-600 leading-relaxed"
          >
            We partner with US enterprises on outcome-driven technology modernization. Here are our three primary strategic engagement tiers designed for measurable impact.
          </motion.p>
        </div>

        {/* 3 Flagship Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-8 items-stretch mb-16">
          {FLAGSHIP_ENGAGEMENTS.map((plan, idx) => {
            const isPopular = plan.isPopular;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease, delay: 0.15 * idx }}
                whileHover={{ y: -4 }}
                className={`relative rounded-xl p-8 sm:p-9 flex flex-col justify-between transition-all duration-300 ${
                  isPopular
                    ? "bg-[#FFFFFF] border-2 border-[#214ECF] shadow-lg ring-4 ring-blue-500/10"
                    : "bg-[#FFFFFF] border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md"
                }`}
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-3 mb-6">
                  <span className="text-[11px] font-mono font-bold tracking-[0.25em] uppercase text-slate-500">
                    {plan.planNumber}
                  </span>

                  {isPopular ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold bg-[#214ECF] text-white shadow-2xs">
                      <Star size={11} className="fill-white" />
                      Most Popular
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {plan.tag}
                    </span>
                  )}
                </div>

                {/* Plan Title & Investment */}
                <div className="mb-6">
                  <h3 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">Starting at</span>
                    <span className="font-display font-black text-3xl sm:text-4xl text-[#214ECF] tracking-tight">
                      {plan.startingPriceFormatted}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed font-normal min-h-[44px]">
                    {plan.shortPositioning}
                  </p>
                </div>

                {/* Target & Outcomes */}
                <div className="pt-6 border-t border-slate-100 mb-8 flex-1">
                  <div className="mb-5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">
                      Ideal For
                    </span>
                    <p className="text-xs font-medium text-slate-800">
                      {plan.idealCustomer}
                    </p>
                  </div>

                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-3">
                    Core Capabilities Included
                  </span>
                  <ul className="space-y-2.5">
                    {plan.includes.slice(0, 6).map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-800 font-medium">
                        <CheckCircle2 size={15} className="text-[#214ECF] shrink-0 mt-0.5" />
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                    {plan.includes.length > 6 && (
                      <li className="text-[11px] font-mono text-[#214ECF] pl-6 pt-1 font-semibold">
                        + {plan.includes.length - 6} more enterprise deliverables
                      </li>
                    )}
                  </ul>
                </div>

                {/* Action Button */}
                <div className="pt-2">
                  <Link href={plan.ctaRoute || "/contact"}>
                    <button
                      className={`w-full h-12 px-6 rounded-xl font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                        isPopular
                          ? "bg-[#214ECF] text-white shadow-xs hover:bg-[#1A3DB3]"
                          : "bg-slate-900 text-white hover:bg-slate-800 shadow-xs"
                      }`}
                    >
                      <span>{plan.ctaLabel}</span>
                      <ArrowRight size={15} />
                    </button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Banner to Full Catalog */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease, delay: 0.3 }}
          className="rounded-xl border border-slate-200 p-6 sm:p-8 bg-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xs"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#214ECF] shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <h4 className="font-display font-bold text-lg text-slate-900 mb-1">
                Explore All 16 Enterprise Transformation Plans
              </h4>
              <p className="text-xs sm:text-sm text-slate-700 font-normal">
                Browse detailed architectures across AI & Automation, Cloud & Modernization, Cybersecurity, Data Platforms, Product Engineering, and 24/7 Managed Services.
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <Link href="/pricing">
              <button className="w-full md:w-auto h-11 px-5 rounded-xl font-bold text-xs tracking-wider uppercase bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 flex items-center justify-center gap-2 shadow-2xs cursor-pointer">
                View Full Pricing & Plans
                <ArrowUpRight size={14} className="text-[#214ECF]" />
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
