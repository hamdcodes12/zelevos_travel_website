import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { ArrowUpRight, Star, TrendingUp, Users, Globe, Zap } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const LOGOS = [
  { name: "Stripe",     symbol: "S/",  color: "#635BFF" },
  { name: "Netflix",    symbol: "N—",  color: "#E50914" },
  { name: "Airbnb",     symbol: "⌂",   color: "#FF5A5F" },
  { name: "Salesforce", symbol: "SF",  color: "#00A1E0" },
  { name: "Notion",     symbol: "N□",  color: "#0F172A" },
  { name: "Figma",      symbol: "F◆",  color: "#F24E1E" },
  { name: "HubSpot",    symbol: "H{",  color: "#FF7A59" },
  { name: "Shopify",    symbol: "◈",   color: "#96BF48" },
  { name: "Linear",     symbol: "◯—",  color: "#5E6AD2" },
  { name: "Vercel",     symbol: "▲",   color: "#0F172A" },
  { name: "Loom",       symbol: "◉",   color: "#625DF5" },
  { name: "Intercom",   symbol: "◌",   color: "#1F8EED" },
];

const CASE_STUDIES = [
  {
    name: "Stripe",
    symbol: "S/",
    color: "#635BFF",
    category: "FinTech",
    metric: "68%",
    metricLabel: "fewer false positives",
    result: "Built AI-powered fraud detection that reduced chargebacks and saved millions in operational losses.",
    icon: <TrendingUp size={16} />,
  },
  {
    name: "Airbnb",
    symbol: "⌂",
    color: "#FF5A5F",
    category: "Marketplace",
    metric: "34%",
    metricLabel: "host revenue lift",
    result: "Smart pricing AI and host-experience automation boosted revenue across all pilot markets.",
    icon: <Users size={16} />,
  },
  {
    name: "HubSpot",
    symbol: "H{",
    color: "#FF7A59",
    category: "MarTech",
    metric: "50+",
    metricLabel: "markets automated",
    result: "Full-stack AI marketing automation enabling hyper-personalized campaigns at global scale.",
    icon: <Globe size={16} />,
  },
  {
    name: "Shopify",
    symbol: "◈",
    color: "#96BF48",
    category: "E-Commerce",
    metric: "41%",
    metricLabel: "AOV increase",
    result: "AI recommendation engine and dynamic storefront drove measurable lift in average order value.",
    icon: <Zap size={16} />,
  },
  {
    name: "Salesforce",
    symbol: "SF",
    color: "#00A1E0",
    category: "Enterprise CRM",
    metric: "3.2×",
    metricLabel: "pipeline velocity",
    result: "Enterprise AI agents automating lead scoring and pipeline management for Fortune 500 clients.",
    icon: <TrendingUp size={16} />,
  },
  {
    name: "Netflix",
    symbol: "N—",
    color: "#E50914",
    category: "Media / Streaming",
    metric: "22%",
    metricLabel: "watch-time gain",
    result: "Generative AI personalization improved content discovery and audience engagement at scale.",
    icon: <Users size={16} />,
  },
];

const STATS = [
  { value: "500+", label: "Enterprise Clients" },
  { value: "15+",  label: "Industries Served"  },
  { value: "2B+",  label: "Operations / Year"  },
  { value: "98.4%", label: "Accuracy Rate"     },
];

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── Marquee strip ─────────────────────────────────────────────────────────────

function MarqueeStrip() {
  const doubled = LOGOS;

  return (
    <div className="relative py-6">
      <div
        className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5"
      >
        {doubled.map((logo, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 flex-shrink-0 group cursor-default"
          >
            <span
              className="text-xl font-display font-black select-none transition-all duration-300 group-hover:opacity-100"
              style={{ color: logo.color, opacity: 0.85, letterSpacing: "-0.02em" }}
            >
              {logo.symbol}
            </span>
            <span
              className="text-sm font-bold uppercase tracking-[0.15em] transition-all duration-300 group-hover:opacity-60"
              style={{ color: "#334155", letterSpacing: "0.12em" }}
            >
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Case study card ───────────────────────────────────────────────────────────

function CaseCard({ cs, index }: { cs: typeof CASE_STUDIES[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease, delay: (index % 3) * 0.1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative rounded-2xl border p-6 md:p-7 flex flex-col gap-5 overflow-hidden cursor-default transition-all duration-300 bg-white"
      style={{
        background: "#FFFFFF",
        borderColor: hovered ? "#CBD5E1" : "#E2E8F0",
        boxShadow: hovered ? "0 12px 28px -6px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.03)" : "0 1px 3px rgba(15, 23, 42, 0.03)",
        transition: "background 0.3s, border-color 0.3s, box-shadow 0.4s",
      }}
    >
      {/* Corner glow on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ background: `radial-gradient(ellipse at 10% 10%, ${cs.color}10 0%, transparent 60%)` }}
      />

      {/* Animated top border */}
      <motion.div
        className="absolute top-0 left-0 h-[1.5px] pointer-events-none rounded-full"
        animate={{ width: hovered ? "100%" : "0%" }}
        transition={{ duration: 0.5, ease }}
        style={{ background: `linear-gradient(90deg, ${cs.color}, transparent)` }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-black text-sm select-none"
            style={{ background: `${cs.color}18`, color: cs.color, border: `1px solid ${cs.color}30` }}
          >
            {cs.symbol}
          </div>
          <div>
            <p className="text-foreground font-bold text-sm leading-tight">{cs.name}</p>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-medium">{cs.category}</p>
          </div>
        </div>

        {/* Stars */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={11} fill={cs.color} color={cs.color} style={{ opacity: 0.8 }} />
          ))}
        </div>
      </div>

      {/* Metric pill */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-4xl font-display font-black leading-none"
          style={{ color: cs.color }}
        >
          {cs.metric}
        </span>
        <span className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">{cs.metricLabel}</span>
      </div>

      {/* Result */}
      <p className="text-sm leading-relaxed flex-1 text-slate-700 font-normal">
        {cs.result}
      </p>

      {/* Footer */}
      <motion.div
        className="flex items-center gap-2 text-xs font-semibold"
        animate={{ x: hovered ? 4 : 0 }}
        transition={{ duration: 0.3, ease }}
        style={{ color: cs.color }}
      >
        <span className="flex items-center gap-1" style={{ color: cs.color }}>
          {cs.icon}
        </span>
        View full case study
        <ArrowUpRight size={13} />
      </motion.div>
    </motion.div>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

export function OurClients() {
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });

  return (
    <section
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "#FFFFFF" }}
      data-testid="section-clients"
    >
      {/* Top divider */}
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(33,78,207,0.06) 50%, transparent)" }} />

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.05) 0%, transparent 70%)", filter: "blur(60px)" }} />

      <div className="max-w-7xl mx-auto px-6 md:px-12">

        {/* ── Header ── */}
        <div ref={headingRef} className="mb-12 max-w-3xl">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease }}
            className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] mb-5"
            style={{ color: "#214ECF" }}
          >
            Trusted Companies
          </motion.p>

          <div className="overflow-visible mb-5">
            <motion.h2
              initial={{ y: "100%", opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.85, ease, delay: 0.05 }}
              className="font-display font-bold text-foreground leading-[1.0]"
              style={{ fontSize: "clamp(2.6rem, 5.5vw, 5rem)" }}
            >
              Trusted by the world's
              <br />
              <span style={{ background: "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                leading teams.
              </span>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
            className="text-base md:text-lg leading-relaxed text-slate-700 font-normal max-w-2xl"
          >
            From high-growth startups to Fortune 500 enterprises — our AI-powered BPO operations drive measurable outcomes across every industry we touch.
          </motion.p>
        </div>

        {/* ── Marquee logo ticker ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mb-12 rounded-2xl border border-[#DCE5FF] overflow-hidden"
          style={{ background: "#FFFFFF" }}
        >
          <MarqueeStrip />
        </motion.div>

        {/* ── Stats bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.35 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-px mb-16 rounded-2xl overflow-hidden border border-[#DCE5FF] shadow-[0_8px_24px_rgba(33,78,207,0.06)]"
          style={{ background: "#DCE5FF" }}
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center py-7 px-4 gap-1.5 hover:bg-[#F4F7FF] transition-colors duration-200"
              style={{ background: "#FFFFFF" }}
            >
              <span className="font-display font-black text-[#214ECF] text-3xl md:text-4xl leading-none">
                {stat.value}
              </span>
              <span className="text-xs font-mono uppercase tracking-wider text-center text-slate-600 font-semibold">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>

        {/* ── Case study cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {CASE_STUDIES.map((cs, i) => (
            <CaseCard key={cs.name} cs={cs} index={i} />
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-6"
        >
          <Link href="/case-studies">
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: "0 0 60px rgba(91,63,232,0.5), 0 8px 32px rgba(0,0,0,0.5)" }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-3 px-10 py-4 rounded-full font-bold tracking-[0.12em] uppercase text-sm text-foreground"
              style={{ background: "linear-gradient(135deg, #3d25d4 0%, #5b3fe8 50%, #7c5cff 100%)", boxShadow: "0 0 40px rgba(91,63,232,0.35), 0 4px 24px rgba(0,0,0,0.4)" }}
            >
              View All Case Studies
              <ArrowUpRight size={16} />
            </motion.button>
          </Link>
          <p className="text-xs font-mono uppercase tracking-wider text-slate-600 font-medium">
            40+ detailed outcomes across every major industry
          </p>
        </motion.div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(33,78,207,0.06) 50%, transparent)" }} />
    </section>
  );
}
