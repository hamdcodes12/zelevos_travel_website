import React from "react";
import { Link } from "wouter";
import { ArrowRight, PhoneCall, Calendar } from "lucide-react";

export function FinalHomeCTASection() {
  return (
    <section
      className="py-20 md:py-28 bg-[#071330] text-white relative overflow-hidden"
      aria-label="Ready to Build a Smarter Operation"
      style={{
        background: "linear-gradient(135deg, #060F26 0%, #071330 45%, #0B1E54 100%)",
      }}
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-600/15 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10 text-center">
        
        {/* Eyebrow */}
        <div className="inline-flex items-center px-3.5 py-1 rounded-md bg-blue-500/15 border border-blue-400/25 mb-6">
          <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-blue-300 font-bold">
            NEXT STEPS
          </span>
        </div>

        {/* Heading */}
        <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl text-slate-200 tracking-tight mb-2">
          Ready to Build a Smarter Operation?
        </h2>

        {/* Monumental Call */}
        <p className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white tracking-tight leading-none mb-6">
          Let's Talk.
        </p>

        {/* Body Text */}
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto mb-10">
          Whether you need customer support, back-office operations, technology services, or a complete outsourcing solution, Thinkatic can help you build an operation designed for today and ready for tomorrow.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Link href="/contact" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto h-12 px-7 rounded-xl font-bold text-white text-xs tracking-wider uppercase flex items-center justify-center gap-2 bg-[#214ECF] hover:bg-[#1A3DB3] transition-all shadow-lg shadow-blue-950/50 cursor-pointer group">
              <span>Talk to Thinkatic</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>

          <Link href="/contact" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto h-12 px-7 rounded-xl font-bold text-white text-xs tracking-wider uppercase flex items-center justify-center gap-2 border border-white/30 bg-white/10 hover:bg-white/20 transition-all backdrop-blur-xs cursor-pointer">
              <Calendar size={14} className="text-blue-300" />
              <span>Request a Consultation</span>
            </button>
          </Link>
        </div>

      </div>
    </section>
  );
}
