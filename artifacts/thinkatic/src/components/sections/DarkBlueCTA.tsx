import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";

export function DarkBlueCTA() {
  return (
    <section className="py-16 md:py-24 bg-white w-full" aria-label="Become a BPO Partner">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        {/* Dark Navy Rounded Container */}
        <div className="relative rounded-3xl bg-[#081538] overflow-hidden p-8 sm:p-12 md:p-14 lg:p-16 border border-blue-900/60 shadow-xl w-full">
          {/* Subtle decorative glow & grid pattern */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div
              className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"
            />
            <div
              className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none"
            />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "radial-gradient(#FFFFFF 1px, transparent 1px), radial-gradient(#FFFFFF 1px, transparent 1px)",
                backgroundSize: "32px 32px",
                backgroundPosition: "0 0, 16px 16px",
              }}
            />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 w-full">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-500/15 border border-blue-400/25 mb-5">
                <Sparkles size={12} className="text-blue-400" />
                <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-blue-300">
                  GLOBAL NETWORK OPPORTUNITY
                </span>
              </div>

              <h2 className="font-display font-black text-white text-3xl sm:text-4xl md:text-5xl tracking-tight leading-tight mb-4">
                Build Your Global BPO Capacity Today
              </h2>

              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
                Join 100+ verified centres and access high-value international projects.
              </p>
            </div>

            <div className="flex-shrink-0">
              <Link href="/signup?role=bpo">
                <button
                  className="h-13 px-8 rounded-xl font-bold text-xs uppercase tracking-wider text-[#081538] bg-white hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span>Become a BPO Partner</span>
                  <ArrowRight size={15} className="text-[#214ECF]" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
