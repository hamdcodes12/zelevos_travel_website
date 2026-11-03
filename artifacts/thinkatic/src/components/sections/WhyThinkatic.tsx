import { useRef, useEffect, useState } from "react";
import { motion, useInView, animate, useReducedMotion } from "framer-motion";
import {
  Zap, Globe, Building2, Shield, Target, TrendingUp,
  Activity, CheckCircle2, Layers
} from "lucide-react";

// ─── Data (100% Content Locked) ──────────────────────────────────────────────

const LINES = [
  "Traditional outsourcing focuses on manpower.",
  "Thinkatic combines skilled professionals, artificial intelligence, automation, analytics, and enterprise technology to deliver measurable business outcomes.",
  "We don't simply execute processes.",
  "We optimize, automate, and continuously improve them.",
];

const FEATURES = [
  {
    id: "01",
    icon: Zap,
    title: "Modern Operations",
    desc: "Every workflow combines modern tooling with robust human quality oversight and continuous calibration.",
    color: "#D97706",
    tag: "Calibrated Workflows",
  },
  {
    id: "02",
    icon: Globe,
    title: "24×7 Global Delivery",
    desc: "Three regional hubs across Americas, EMEA, and APAC ensure round-the-clock coverage in every market.",
    color: "#214ECF",
    tag: "Follow-The-Sun",
  },
  {
    id: "03",
    icon: Building2,
    title: "Multi-Industry Expertise",
    desc: "Deep domain knowledge across Healthcare, FinTech, Insurance, Retail, and Technology verticals.",
    color: "#059669",
    tag: "Vertical Specialization",
  },
  {
    id: "04",
    icon: Shield,
    title: "Enterprise Security",
    desc: "ISO 27001 certified, SOC 2 Type II audited, HIPAA compliant — security is foundational, not an add-on.",
    color: "#7C3AED",
    tag: "Zero Trust Standard",
  },
  {
    id: "05",
    icon: Target,
    title: "Outcome-Focused Delivery",
    desc: "We commit to measurable KPIs — not activity metrics. Every engagement is tied to business outcomes.",
    color: "#DC2626",
    tag: "SLA Guaranteed",
  },
  {
    id: "06",
    icon: TrendingUp,
    title: "Scalable Teams",
    desc: "Ramp from 5 to 500 agents in days. Our elastic capacity model scales with your business cycle.",
    color: "#214ECF",
    tag: "Elastic Capacity",
  },
];

const COUNTERS = [
  {
    id: "clients",
    end: 500,
    suffix: "+",
    label: "Enterprise Clients",
    color: "#214ECF",
    micro: "Fortune 500 & High-Growth",
    trend: "+34% YoY",
    barWidth: "88%",
  },
  {
    id: "accuracy",
    end: 98.4,
    suffix: "%",
    label: "Accuracy Rate",
    color: "#059669",
    decimals: 1,
    micro: "AI-Verified Operations",
    trend: "SLA Benchmark",
    barWidth: "98.4%",
  },
  {
    id: "ops",
    end: 2,
    suffix: "B+",
    label: "Operations / Year",
    color: "#7C3AED",
    micro: "High-Throughput Concurrency",
    trend: "Continuous Run",
    barWidth: "94%",
  },
];

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── Animated Counter ────────────────────────────────────────────────────────

function AnimatedCounter({
  end,
  suffix,
  color,
  decimals = 0,
}: {
  end: number;
  suffix: string;
  color: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const shouldReduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (shouldReduce) {
      setValue(end);
      return;
    }
    const controls = animate(0, end, {
      duration: 1.8,
      ease: "easeOut",
      onUpdate(v) {
        setValue(v);
      },
    });
    return () => controls.stop();
  }, [inView, end, shouldReduce]);

  return (
    <div className="flex items-baseline gap-0.5">
      <span
        ref={ref}
        className="font-display font-black text-3xl sm:text-4xl lg:text-5xl leading-none text-slate-900 tracking-tight"
      >
        {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
      </span>
      <span
        className="font-display font-black text-2xl sm:text-3xl leading-none"
        style={{ color }}
      >
        {suffix}
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WhyThinkatic() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });

  return (
    <section
      ref={sectionRef}
      className="relative py-28 md:py-36 bg-white overflow-hidden"
      aria-label="Why Choose Us"
    >
      {/* ── Background Architectural Lattice & Ambient Glow ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Subtle radial light accents */}
        <div
          className="absolute top-0 right-1/4 w-[600px] h-[500px] opacity-40"
          style={{
            background: "radial-gradient(ellipse at center, rgba(30,64,175,0.06) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-10 left-10 w-[500px] h-[400px] opacity-30"
          style={{
            background: "radial-gradient(ellipse at center, rgba(5,150,105,0.04) 0%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />

        {/* Hairline Grid Lattice */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(#0F172A 1px, transparent 1px), linear-gradient(90deg, #0F172A 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Subtle decorative topological hairline */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.035]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-100 200 C 300 120, 600 350, 1100 240 S 1600 100, 2000 220"
            fill="none"
            stroke="#214ECF"
            strokeWidth="1.5"
          />
          <path
            d="M-100 450 C 400 380, 800 620, 1300 480 S 1700 350, 2000 420"
            fill="none"
            stroke="#214ECF"
            strokeWidth="1.5"
            strokeDasharray="4 8"
          />
        </svg>

        {/* Top & bottom hairline dividers */}
        <div className="absolute top-0 inset-x-0 h-px bg-slate-200" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-slate-200" />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 relative z-10">

        {/* ── TOP SECTION: Editorial Header + Integrated Telemetry Dashboard ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start mb-24 lg:mb-28">

          {/* Left Column: Monumental Editorial Anchor (7 cols) */}
          <div ref={headingRef} className="lg:col-span-7 flex flex-col justify-between">
            <div>
              {/* Eyebrow badge */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, ease }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-blue-200/80 bg-blue-50/60 mb-6"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#214ECF] animate-pulse" />
                <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#214ECF]">
                  Why Choose Us
                </span>
              </motion.div>

              {/* Main Headline */}
              <div className="overflow-hidden mb-8">
                <motion.h2
                  initial={{ y: 24, opacity: 0 }}
                  animate={inView ? { y: 0, opacity: 1 } : {}}
                  transition={{ duration: 0.75, ease, delay: 0.06 }}
                  className="font-display font-black text-slate-900 tracking-tight leading-[1.03] text-4xl sm:text-5xl lg:text-6xl"
                >
                  Intelligence meets <br />
                  <span className="bg-gradient-to-r from-[#214ECF] via-[#214ECF] to-[#2D5FE8] bg-clip-text text-transparent">
                    human expertise.
                  </span>
                </motion.h2>
              </div>
            </div>

            {/* Editorial Narrative Composition for the 4 Text Lines */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease, delay: 0.15 }}
              className="space-y-6"
            >
              {/* Line 1 & Line 2: The Core Thesis */}
              <div className="p-5 sm:p-6 rounded-xl border border-slate-200/90 bg-slate-50/60 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#214ECF]" />
                <p className="text-xs font-mono font-bold tracking-wider uppercase text-slate-500 mb-2">
                  {LINES[0]}
                </p>
                <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
                  {LINES[1]}
                </p>
              </div>

              {/* Line 3 & Line 4: The Operational Paradigm */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 pt-1 text-slate-700">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 shrink-0">
                  <CheckCircle2 size={16} className="text-[#214ECF]" />
                  <span>{LINES[2]}</span>
                </div>
                <div className="hidden sm:block w-px h-4 bg-slate-300" />
                <p className="text-sm font-semibold text-[#214ECF] leading-relaxed">
                  {LINES[3]}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Unified Telemetry & Scale Console (5 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="relative rounded-2xl border border-slate-200 bg-white p-7 sm:p-8 shadow-xs overflow-hidden">
              {/* Corner crosshairs registration marks */}
              <div className="absolute top-2.5 left-2.5 text-slate-400 font-mono text-[10px] select-none leading-none">+</div>
              <div className="absolute top-2.5 right-2.5 text-slate-400 font-mono text-[10px] select-none leading-none">+</div>
              <div className="absolute bottom-2.5 left-2.5 text-slate-400 font-mono text-[10px] select-none leading-none">+</div>
              <div className="absolute bottom-2.5 right-2.5 text-slate-400 font-mono text-[10px] select-none leading-none">+</div>

              {/* Console Header */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-[#214ECF]" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-600">
                    Scale Benchmarks
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Verified SLA</span>
                </div>
              </div>

              {/* Integrated 3-Stat Stack */}
              <div className="divide-y divide-slate-100">
                {COUNTERS.map((c, i) => (
                  <div
                    key={c.id}
                    className={"py-5 " + (i === 0 ? "pt-0 " : "") + (i === COUNTERS.length - 1 ? "pb-0 " : "") + "group transition-colors"}
                  >
                    <div className="flex items-baseline justify-between mb-1.5">
                      <AnimatedCounter
                        end={c.end}
                        suffix={c.suffix}
                        color={c.color}
                        decimals={c.decimals}
                      />
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
                        {c.trend}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">
                        {c.label}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500">
                        {c.micro}
                      </p>
                    </div>

                    {/* Architectural hairline progress accent */}
                    <div className="w-full h-1 bg-slate-100 rounded-full mt-3 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: c.color }}
                        initial={{ width: "0%" }}
                        animate={inView ? { width: c.barWidth } : {}}
                        transition={{ duration: 1.2, delay: 0.4 + i * 0.15, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Console Footnote */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
                <span>Continuously Monitored</span>
                <span className="text-[#214ECF] font-semibold">ISO 27001 / SOC 2</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── BOTTOM SECTION: Connected Architectural Capabilities System ── */}
        <div>
          {/* Section Subtitle Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <Layers size={16} className="text-[#214ECF]" />
              <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">
                Enterprise Capability Architecture
              </h3>
            </div>
            <div className="text-xs font-mono text-slate-500 font-medium">
              06 Mission-Critical Transformation Pillars
            </div>
          </div>

          {/* Unified Architectural Grid (3 Columns x 2 Rows) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;

              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.55, ease, delay: 0.1 + i * 0.06 }}
                  className="relative p-7 sm:p-8 border-r border-b border-slate-200 bg-white transition-all duration-300 flex flex-col justify-between group cursor-default"
                >
                  {/* Micro gradient wash on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: "radial-gradient(circle at 10% 10%, " + feature.color + "0a 0%, transparent 70%)",
                    }}
                  />

                  {/* Corner crosshair for structural elegance */}
                  <div className="absolute top-2.5 right-2.5 text-slate-200 group-hover:text-slate-500 transition-colors font-mono text-[10px] select-none leading-none">
                    +
                  </div>

                  <div>
                    {/* Top Row: Monospaced Index & Icon Container */}
                    <div className="flex items-center justify-between mb-6">
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center border transition-all duration-300 group-hover:scale-105"
                        style={{
                          background: feature.color + "10",
                          borderColor: feature.color + "30",
                        }}
                      >
                        <Icon size={20} style={{ color: feature.color }} />
                      </div>

                      <span className="font-mono text-xs font-bold tracking-widest text-slate-500 group-hover:text-slate-700 transition-colors">
                        {feature.id}
                      </span>
                    </div>

                    {/* Title */}
                    <h4 className="font-display font-bold text-slate-900 text-lg mb-2.5 tracking-tight group-hover:text-[#214ECF] transition-colors">
                      {feature.title}
                    </h4>

                    {/* Description */}
                    <p className="text-sm leading-relaxed text-slate-700 font-normal">
                      {feature.desc}
                    </p>
                  </div>

                  {/* Bottom Accent: Pill tag */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span
                      className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border"
                      style={{
                        background: feature.color + "08",
                        color: feature.color,
                        borderColor: feature.color + "20",
                      }}
                    >
                      {feature.tag}
                    </span>

                    <span className="text-xs text-slate-500 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all">
                      →
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
