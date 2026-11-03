import React from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, ShieldCheck, HeartHandshake } from "lucide-react";

export function ExtensionOfTeamSection() {
  return (
    <section className="py-20 md:py-28 bg-white relative overflow-hidden" aria-label="More Than an Outsourcing Partner">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 xl:gap-20 items-center">
          
          {/* Left Column: Visual Asset */}
          <div className="lg:col-span-6 xl:col-span-5 order-2 lg:order-1 relative">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/90 shadow-xl bg-slate-50 group">
              <img
                src="/Project Marketplace/Global FinTech Tier-1 Technical Helpdesk.png"
                alt="Thinkatic Extended Delivery Team"
                loading="lazy"
                className="w-full h-[360px] sm:h-[440px] lg:h-[480px] object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none" />

              {/* Floating caption pill */}
              <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-6 sm:right-6">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-white/60 shadow-lg flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-[#214ECF] shrink-0 border border-blue-100">
                    <HeartHandshake size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">Integrated Strategic Collaboration</p>
                    <p className="text-[11px] text-slate-500">Shared accountability &amp; continuous operational improvement</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Ambient accent */}
            <div className="absolute -top-4 -left-4 w-28 h-28 bg-[#214ECF]/10 rounded-full blur-xl -z-10" />
          </div>

          {/* Right Column: Text Content */}
          <div className="lg:col-span-6 xl:col-span-7 order-1 lg:order-2 flex flex-col items-start text-left">
            {/* Eyebrow */}
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-4">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                MORE THAN AN OUTSOURCING PARTNER
              </span>
            </div>

            {/* Large Heading */}
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl lg:text-[2.85rem] xl:text-[3.25rem] text-slate-900 tracking-tight leading-[1.12] mb-6">
              We Become an Extension of Your Team.
            </h2>

            {/* Body Narrative */}
            <div className="space-y-4 text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl font-normal mb-8">
              <p>
                Our goal isn't simply to complete tasks.
              </p>
              <p>
                It's to understand why the process exists, who it serves, and how it can be improved.
              </p>
              <p className="text-slate-800 font-medium">
                We work alongside your organisation to continuously identify opportunities to improve quality, productivity, customer experience, and operational efficiency.
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

        </div>
      </div>
    </section>
  );
}
