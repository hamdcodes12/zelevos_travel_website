import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import {
  Bot, Cloud, Lock, Database, Cpu,
  ArrowRight, CheckCheck, Zap, Star, ShieldCheck, Layers,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── 5 Core Enterprise Capabilities ──────────────────────────────────────────

const capabilities = [
  {
    id: "01",
    title: "AI & Automation",
    slug: "ai-business",
    icon: Bot,
    desc: "From website AI chatbots to advanced business agents, Voice AI, and custom workflow automation.",
    services: ["AI Starter", "AI Business", "AI Enterprise", "AI Automation"],
    stat: { value: "99.8%", label: "Accuracy & Verification" },
    accent: "#214ECF",
    gradient: "from-[#F4F7FF] to-white",
    featured: true,
  },
  {
    id: "02",
    title: "Cloud & Modernization",
    slug: "cloud-modernization",
    icon: Cloud,
    desc: "Deconstruct legacy monoliths, architect multi-cloud infrastructure, and automate CI/CD release pipelines.",
    services: ["Cloud Modernization", "Legacy Transformation", "Enterprise Transformation", "Multi-Cloud IaC"],
    stat: { value: "99.99%", label: "Uptime SLA Commitment" },
    accent: "#214ECF",
    gradient: "from-[#EEF3FF] to-white",
    featured: false,
  },
  {
    id: "03",
    title: "Cybersecurity & Zero Trust",
    slug: "enterprise-security",
    icon: Lock,
    desc: "Defend mission-critical infrastructure with Zero Trust architectures, 24/7 SIEM monitoring, and LLM prompt defense.",
    services: ["Cybersecurity Foundation", "Enterprise Security", "AI Security", "24/7 SOC Surveillance"],
    stat: { value: "Zero Trust", label: "Defensible Perimeter" },
    accent: "#214ECF",
    gradient: "from-[#F4F7FF] to-white",
    featured: false,
  },
  {
    id: "04",
    title: "Enterprise Data Platforms",
    slug: "enterprise-data-platform",
    icon: Database,
    desc: "Unify fragmented data into automated real-time lakehouses, automated ETL pipelines, and AI-ready feature stores.",
    services: ["Data Foundation", "Enterprise Data Platform", "Real-Time Streaming", "Executive BI"],
    stat: { value: "<25ms", label: "Streaming Latency" },
    accent: "#214ECF",
    gradient: "from-[#EEF3FF] to-white",
    featured: false,
  },
  {
    id: "05",
    title: "Product Engineering",
    slug: "enterprise-product-engineering",
    icon: Cpu,
    desc: "Full-lifecycle digital product development and dedicated senior engineering squads for high-concurrency systems.",
    services: ["Digital Product Development", "Enterprise Product Engineering", "Dedicated Squads", "QA Automation"],
    stat: { value: "2B+", label: "Operations / Year" },
    accent: "#214ECF",
    gradient: "from-[#F4F8FF] to-[#E9F1FF]",
    featured: false,
  },
];

function ServiceChip({ label, accent }: { label: string; accent: string }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium border border-slate-200 bg-white text-slate-700 shadow-2xs"
    >
      <CheckCheck size={11} className="text-[#214ECF] shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function CapabilityCard({ capability, index }: { capability: (typeof capabilities)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const Icon = capability.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease, delay: index * 0.08 }}
      className="group relative rounded-xl p-6 md:p-7 flex flex-col justify-between border cursor-default overflow-hidden h-full bg-white transition-all duration-300"
      style={{
        borderColor: capability.featured ? "#93C5FD" : "#E2E8F0",
        boxShadow: capability.featured ? "0 8px 24px -4px rgba(30, 64, 175, 0.08)" : "0 1px 3px rgba(15, 23, 42, 0.03)",
      }}
    >
      {/* Featured indicator */}
      {capability.featured && (
        <div
          className="absolute top-5 right-5 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-blue-50 border border-blue-200"
        >
          <Star size={11} fill="#214ECF" color="#214ECF" />
          <span className="text-[10px] uppercase tracking-wider text-[#214ECF]">
            Front Door Capability
          </span>
        </div>
      )}

      {/* Top Header */}
      <div>
        <div className="flex items-center gap-3.5 mb-5">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 border bg-blue-50/60 border-blue-200/80"
          >
            <Icon size={20} className="text-[#214ECF]" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#214ECF] uppercase">
              CAPABILITY {capability.id}
            </span>
            <h3 className="font-display font-bold text-slate-900 text-lg md:text-xl leading-tight">
              {capability.title}
            </h3>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-slate-700 mb-6 font-normal min-h-[44px]">
          {capability.desc}
        </p>

        {/* Deliverables chips */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {capability.services.map((s) => (
            <ServiceChip key={s} label={s} accent={capability.accent} />
          ))}
        </div>
      </div>

      {/* Metric & CTA Footer */}
      <div className="flex items-center justify-between pt-5 border-t border-slate-100">
        <div>
          <p className="font-display font-black text-2xl leading-none text-slate-900">
            {capability.stat.value}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold mt-1">
            {capability.stat.label}
          </p>
        </div>

        <Link href={`/services/${capability.slug}`}>
          <div
            className="flex items-center gap-1.5 text-xs font-bold text-[#214ECF] group-hover:translate-x-0.5 transition-transform cursor-pointer"
          >
            <span>Architecture details</span>
            <ArrowRight size={13} />
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

export function BPOServices() {
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });

  return (
    <section
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "#FFFFFF" }}
      aria-label="Enterprise Capabilities"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">

        {/* ── Section Header ── */}
        <div ref={headingRef} className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-end mb-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 mb-4"
            >
              <Layers size={13} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#214ECF]">
                Enterprise Technology Transformation
              </span>
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.7, ease, delay: 0.05 }}
              className="font-display font-black text-slate-900 leading-[1.05]"
              style={{ fontSize: "clamp(2.3rem, 4.5vw, 4rem)" }}
            >
              Mission-Critical <br />
              <span className="bg-gradient-to-r from-[#214ECF] via-[#214ECF] to-[#2D5FE8] bg-clip-text text-transparent">
                Capabilities at Scale.
              </span>
            </motion.h2>
          </div>

          <div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease, delay: 0.2 }}
              className="text-base md:text-lg leading-relaxed text-slate-600 mb-6"
            >
              AI is the front door, but transformation is comprehensive. We unify AI, Cloud, Cybersecurity, Data, and Engineering into one integrated enterprise transformation capability.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease, delay: 0.3 }}
              className="flex flex-wrap gap-2"
            >
              {[
                { icon: Zap, label: "AI & Automation" },
                { icon: Cloud, label: "Cloud Modernization" },
                { icon: ShieldCheck, label: "Zero Trust Security" },
                { icon: Database, label: "Data Intelligence" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#DCE5FF] bg-blue-50/50 text-xs font-semibold text-slate-700"
                >
                  <Icon size={12} className="text-[#214ECF]" />
                  {label}
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ── Cards Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {capabilities.slice(0, 3).map((cap, i) => (
            <CapabilityCard key={cap.id} capability={cap} index={i} />
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          {capabilities.slice(3, 5).map((cap, i) => (
            <CapabilityCard key={cap.id} capability={cap} index={i + 3} />
          ))}
        </div>

        {/* ── Consultation Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease }}
          className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-xl border border-slate-200 p-7 bg-white shadow-2xs"
        >
          <div>
            <h4 className="text-slate-900 font-bold text-base mb-1">
              Have a complex multi-disciplinary technology challenge?
            </h4>
            <p className="text-sm text-slate-700 font-normal">
              Our principal enterprise architects will assess your systems, tech stack, and transformation roadmap.
            </p>
          </div>
          <Link href="/contact">
            <button
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-[#214ECF] hover:bg-[#1A3DB3] shadow-xs hover:shadow-sm transition-all shrink-0 cursor-pointer"
            >
              Consult an Architect
              <ArrowRight size={14} />
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
