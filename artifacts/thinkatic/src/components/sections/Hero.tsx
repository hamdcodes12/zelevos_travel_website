import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden flex items-center bg-[#071330] pt-24 sm:pt-28 pb-16 sm:pb-20 lg:py-24 min-h-[560px] lg:min-h-[620px] xl:min-h-[660px]"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(6, 16, 42, 0.94) 0%, rgba(6, 16, 42, 0.88) 35%, rgba(6, 16, 42, 0.45) 55%, rgba(6, 16, 42, 0.12) 75%, rgba(6, 16, 42, 0.02) 100%), url('/hero-bg.png')`,
        backgroundSize: "cover",
        backgroundPosition: "right center",
        backgroundRepeat: "no-repeat",
      }}
      aria-label="Thinkatic — Your Global BPO Delivery Partner"
    >
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10 lg:gap-8 w-full">
          {/* Left-Aligned Hero Content (Occupies ~45-50% on desktop, left padding 6–8vw) */}
          <div className="w-full lg:w-[48%] xl:w-[46%] flex flex-col items-start text-left lg:pl-[4vw] xl:pl-[5vw]">
            {/* Eyebrow Label */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center px-3 py-1 rounded-md bg-blue-500/15 border border-blue-400/25 mb-4 sm:mb-5"
            >
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-blue-300 font-bold">
                THINKATIC
              </span>
            </motion.div>

            {/* Main Monumental Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="font-display font-black text-white text-3xl sm:text-4xl md:text-5xl lg:text-[2.85rem] xl:text-[3.35rem] leading-[1.12] tracking-tight mb-5"
            >
              Your Global BPO <br />
              Delivery <span className="text-[#3B82F6]">Partner</span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-sm sm:text-base md:text-[1.05rem] text-slate-200 leading-relaxed mb-8 max-w-xl font-normal"
            >
              We connect verified BPO centres with international business opportunities.
              From talent to technology, Thinkatic powers your global growth.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto"
            >
              <Link href="/signup?role=bpo">
                <button
                  className="h-12 px-6.5 rounded-xl font-bold text-white text-xs tracking-wider uppercase flex items-center justify-center gap-2 bg-[#214ECF] hover:bg-[#1A3DB3] transition-all shadow-md shadow-blue-950/40 cursor-pointer"
                >
                  <span>Become a BPO Partner</span>
                  <ArrowRight size={14} />
                </button>
              </Link>

              <Link href="/contact">
                <button
                  className="h-12 px-6.5 rounded-xl font-bold text-white text-xs tracking-wider uppercase flex items-center justify-center border border-white/30 bg-white/10 hover:bg-white/20 transition-all backdrop-blur-xs cursor-pointer"
                >
                  Talk to Thinkatic
                </button>
              </Link>
            </motion.div>
          </div>

          {/* Right-Side Global Information (Over the global map area) */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full lg:w-[48%] xl:w-[46%] flex flex-col items-start sm:items-center lg:items-end text-left sm:text-center lg:text-right mt-4 lg:mt-0 lg:pr-[2vw] xl:pr-[4vw]"
          >
            <div className="inline-flex flex-col items-start sm:items-center lg:items-end">
              <div className="text-2xl sm:text-3xl md:text-4xl lg:text-[2.6rem] xl:text-[3rem] font-display font-black text-white tracking-tight leading-tight mb-2 sm:mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
                India <span className="text-[#3B82F6] font-normal mx-1 sm:mx-1.5">→</span> US &amp; UK
              </div>
              <div className="flex flex-wrap items-center justify-start sm:justify-center lg:justify-end gap-2 sm:gap-3 text-xs sm:text-sm md:text-base font-semibold text-slate-100 tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                <span>Global Reach</span>
                <span className="text-blue-400 font-light">|</span>
                <span>Local Talent</span>
                <span className="text-blue-400 font-light">|</span>
                <span>Real Impact</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
