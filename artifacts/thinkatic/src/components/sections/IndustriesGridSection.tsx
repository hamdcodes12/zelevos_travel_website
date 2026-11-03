import React from "react";
import {
  Laptop,
  ShoppingCart,
  Plane,
  Landmark,
  Activity,
  Store,
  Rocket,
  Building2,
  ArrowRight,
} from "lucide-react";

export function IndustriesGridSection() {
  const INDUSTRIES = [
    { name: "Technology", icon: Laptop, desc: "SaaS, tech infrastructure & application support" },
    { name: "E-commerce", icon: ShoppingCart, desc: "Omnichannel care, catalog & order operations" },
    { name: "Travel", icon: Plane, desc: "Reservations, guest support & travel desk workflows" },
    { name: "Financial Services", icon: Landmark, desc: "Account inquiries, validation & transaction care" },
    { name: "Healthcare", icon: Activity, desc: "Patient intake, scheduling & admin coordination" },
    { name: "Consumer Businesses", icon: Store, desc: "Brand experience, inquiries & customer retention" },
    { name: "Startups", icon: Rocket, desc: "Rapidly scalable support & operational foundation" },
    { name: "Enterprises", icon: Building2, desc: "Complex global workflows & dedicated delivery pods" },
  ];

  return (
    <section id="industries" className="py-20 md:py-28 bg-slate-50/70 border-t border-b border-slate-200/80 relative" aria-label="Industries We Serve">
      <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
          <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200/80 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
              INDUSTRY COVERAGE
            </span>
          </div>

          <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
            Industries We Serve
          </h2>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            We support businesses across multiple industries with technology-enabled outsourcing and operational solutions.
          </p>
        </div>

        {/* 8 Industry Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
          {INDUSTRIES.map((ind) => {
            const Icon = ind.icon;
            return (
              <div
                key={ind.name}
                className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs hover:shadow-lg hover:border-blue-300 transition-all duration-300 flex flex-col items-start text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-4 group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Icon size={22} />
                </div>

                <h3 className="font-display font-bold text-base text-slate-900 mb-1.5 group-hover:text-[#214ECF] transition-colors">
                  {ind.name}
                </h3>

                <p className="text-xs text-slate-500 leading-relaxed font-normal">
                  {ind.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom Statement */}
        <div className="text-center max-w-2xl mx-auto pt-2">
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Solutions can be customised according to industry requirements and process complexity.
          </p>
        </div>

      </div>
    </section>
  );
}
