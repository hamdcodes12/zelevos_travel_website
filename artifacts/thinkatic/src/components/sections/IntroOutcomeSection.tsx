import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, ShieldCheck, Users } from "lucide-react";

export function IntroOutcomeSection() {
  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden" aria-label="About Thinkatic Partnership">
      {/* Subtle ambient background gradient */}
      <div className="absolute top-1/2 left-0 w-96 h-96 -translate-y-1/2 bg-blue-50/60 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 xl:gap-20 items-center">
          
          {/* Left Column: Text Content (Occupies 6 or 7 cols) */}
          <div className="lg:col-span-6 xl:col-span-7 flex flex-col items-start text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-5">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                THINKATIC
              </span>
            </div>

            {/* Monumental Heading */}
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl lg:text-[2.85rem] xl:text-[3.25rem] text-slate-900 tracking-tight leading-[1.12] mb-7">
              Your Business.<br />
              Our Expertise.<br />
              <span className="text-[#214ECF]">Better Outcomes.</span>
            </h2>

            {/* Narrative Paragraphs */}
            <div className="space-y-4 text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl font-normal mb-8">
              <p>
                Running a business requires more than technology.
              </p>
              <p>
                It requires people who understand your customers, processes that work efficiently, and systems that can scale with your growth.
              </p>
              <p className="text-slate-800 font-medium">
                At Thinkatic, we become an extension of your business — managing critical processes while you focus on what matters most: building and growing your company.
              </p>
            </div>

            {/* CTA Button */}
            <Link href="/contact">
              <button
                className="h-12 px-7 rounded-xl font-bold text-white text-xs tracking-wider uppercase flex items-center justify-center gap-2 bg-[#214ECF] hover:bg-[#1A3DB3] transition-all shadow-md shadow-blue-900/20 cursor-pointer group"
              >
                <span>Talk to Thinkatic</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
          </div>

          {/* Right Column: Visual Frame */}
          <div className="lg:col-span-6 xl:col-span-5 relative">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 shadow-xl bg-slate-50 group">
              <img
                src="/Project Marketplace/Global AI Customer Support Operations (TEST 2147).png"
                alt="Thinkatic Global Operations Team"
                loading="lazy"
                className="w-full h-[360px] sm:h-[440px] lg:h-[480px] object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
              />
              
              {/* Subtle gradient vignette overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none" />

              {/* Floating highlight badges */}
              <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-6 sm:right-6 flex flex-col gap-2.5">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-white/60 shadow-lg flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#214ECF] shrink-0 border border-blue-100">
                    <Users size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">Human Expertise + Intelligent Systems</p>
                    <p className="text-[11px] text-slate-500">Dedicated operational talent working as your extended team</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Corner Decorative Element */}
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-[#214ECF]/10 rounded-full blur-xl -z-10" />
          </div>

        </div>
      </div>
    </section>
  );
}
