import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Star, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { BPO_PLANS } from "@/data/packages-data";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function BPOPlansSection() {
  return (
    <section
      id="bpo-plans"
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F6F9FF 50%, #FFFFFF 100%)" }}
      aria-labelledby="bpo-plans-title"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 mb-5">
            <ShieldCheck size={13} className="text-[#214ECF]" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#214ECF]">
              Thinkatic BPO &amp; Customer Support
            </span>
          </div>
          <h2 id="bpo-plans-title" className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-[1.1] mb-5">
            BPO Plans for <span className="bg-gradient-to-r from-[#214ECF] via-[#214ECF] to-[#2D5FE8] bg-clip-text text-transparent">Operational Scale</span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            A structured customer operations partnership for teams that need trained agents, multichannel coverage, and dedicated supervisor governance.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {BPO_PLANS.map((plan, index) => (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease, delay: 0.1 * index }}
              className={`relative rounded-xl p-7 sm:p-8 flex flex-col bg-white transition-all duration-300 ${
                plan.isPopular
                  ? "border-2 border-[#214ECF] shadow-lg ring-4 ring-blue-500/10"
                  : "border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-6">
                <span className="text-[11px] font-mono font-bold tracking-[0.25em] uppercase text-slate-500">
                  BPO PACKAGE {String(index + 1).padStart(2, "0")}
                </span>
                {plan.isPopular && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold bg-[#214ECF] text-white shadow-2xs">
                    <Star size={11} className="fill-white" />
                    MOST POPULAR
                  </span>
                )}
              </div>

              <div className="mb-6">
                <h3 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight mb-2">
                  {plan.name}
                </h3>
                <div className="font-display font-black text-3xl sm:text-4xl text-[#214ECF] tracking-tight mb-4">
                  {plan.priceFormatted}
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1">{plan.seatRange}</span>
                  <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1">{plan.partnershipTerm}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block mb-3">
                  Inclusions
                </span>
                <div className="space-y-5">
                  {plan.featureGroups.map((group) => (
                    <div key={group.title}>
                      <h4 className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#214ECF]">{group.title}</h4>
                      <ul className="space-y-2.5">
                        {group.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-xs text-slate-800 font-medium">
                            <CheckCircle2 size={15} className="text-[#214ECF] shrink-0 mt-0.5" />
                            <span className="leading-snug">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="mb-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#214ECF]">Delivery SLA</h4>
                    <p className="text-xs font-medium leading-snug text-slate-800">{plan.portfolioAccess}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <Link href={`/contact?service=${plan.id}`}>
                  <button
                    type="button"
                    className="w-full py-3 rounded-xl bg-[#214ECF] hover:bg-[#1B40AB] text-white font-bold text-xs sm:text-sm tracking-wide transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Discuss Requirements</span>
                    <ArrowRight size={14} />
                  </button>
                </Link>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="max-w-4xl mx-auto mt-10 rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-4 text-center text-xs leading-relaxed text-slate-600">
          <strong className="text-slate-800">Lifetime Strategic Support</strong> does not mean unlimited free manpower, technology licenses, additional seats, recruitment, or execution. Those remain separately chargeable where required.
        </div>
      </div>
    </section>
  );
}