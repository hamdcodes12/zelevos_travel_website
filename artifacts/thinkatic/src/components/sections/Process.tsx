import { useRef, useState } from "react";
import { motion, useInView, useScroll, useSpring } from "framer-motion";
import {
  Compass, Layout, Database, Cpu, Plug, Rocket, BarChart2,
  ArrowRight, CheckCircle2, Terminal, Activity, Layers, Sparkles
} from "lucide-react";
import { Link } from "wouter";

// ─── Data (100% Content Locked) ──────────────────────────────────────────────

const STEPS = [
  {
    number: "01",
    title: "Discovery & Strategy",
    phaseName: "Strategic Alignment",
    desc: "We map your business goals, identify automation opportunities, and define measurable success criteria before writing a single line of code.",
    tags: ["Stakeholder Interviews", "ROI Modeling", "Feasibility Analysis"],
    icon: Compass,
    accent: "#214ECF",
    benchmark: "Phase 01 · Inception",
  },
  {
    number: "02",
    title: "AI Architecture Design",
    phaseName: "System Blueprint",
    desc: "Selecting the right LLMs, vector databases, orchestration layers, and data pipelines for your specific use case and compliance requirements.",
    tags: ["Model Selection", "Vector DB", "Pipeline Design"],
    icon: Layout,
    accent: "#214ECF",
    benchmark: "Phase 02 · Engineering",
  },
  {
    number: "03",
    title: "Data Engineering",
    phaseName: "Knowledge Pipeline",
    desc: "Cleaning, structuring, chunking, and embedding your proprietary data to create knowledge bases that make AI responses accurate and contextual.",
    tags: ["ETL Pipelines", "Embedding", "Knowledge Graphs"],
    icon: Database,
    accent: "#059669",
    benchmark: "Phase 03 · Foundation",
  },
  {
    number: "04",
    title: "Model Development",
    phaseName: "Intelligence Tuning",
    desc: "Fine-tuning, prompt engineering, RLHF, and extensive red-team testing to ensure models are accurate, safe, and aligned with your brand voice.",
    tags: ["Fine-tuning", "Prompt Engineering", "RLHF"],
    icon: Cpu,
    accent: "#7C3AED",
    benchmark: "Phase 04 · Optimization",
  },
  {
    number: "05",
    title: "Integration & Testing",
    phaseName: "Production Hardening",
    desc: "Connecting AI capabilities into your existing CRM, ERP, or product stack via secure APIs — with rigorous QA, load testing, and user acceptance validation.",
    tags: ["API Integration", "Load Testing", "UAT"],
    icon: Plug,
    accent: "#D97706",
    benchmark: "Phase 05 · Verification",
  },
  {
    number: "06",
    title: "Deployment & Scaling",
    phaseName: "Global Rollout",
    desc: "Zero-downtime production launch on your preferred cloud infrastructure with auto-scaling, CDN, monitoring, and incident response in place from day one.",
    tags: ["Cloud Deploy", "Auto-scaling", "Zero Downtime"],
    icon: Rocket,
    accent: "#214ECF",
    benchmark: "Phase 06 · Production",
  },
  {
    number: "07",
    title: "Ongoing Optimization",
    phaseName: "Continuous Intelligence",
    desc: "Continuous monitoring of model drift, accuracy decay, and user feedback loops — plus monthly reviews to retrain, improve, and expand capabilities.",
    tags: ["Drift Monitoring", "Retraining", "Monthly Reviews"],
    icon: BarChart2,
    accent: "#059669",
    benchmark: "Phase 07 · Governance",
  },
];

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── Step Card Component ─────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  isLast,
  isActive,
  onHover,
}: {
  step: (typeof STEPS)[0];
  index: number;
  isLast: boolean;
  isActive: boolean;
  onHover: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-80px" });
  const Icon = step.icon;

  return (
    <div
      ref={cardRef}
      id={`process-step-${index}`}
      onMouseEnter={onHover}
      className="relative flex gap-5 sm:gap-8 group"
    >
      {/* ── Left Rail: Step Node & Continuous Conduit ── */}
      <div className="flex flex-col items-center flex-shrink-0 relative w-12 sm:w-14">
        {/* Numbered Node Anchor */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          className={`relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition-all duration-300 ${
            isActive
              ? "border-[#214ECF] bg-[#214ECF] text-white shadow-md"
              : "border-slate-200 bg-white text-slate-800 shadow-2xs group-hover:border-[#93C5FD] group-hover:shadow-xs"
          }`}
        >
          <span
            className={`font-mono font-bold text-xs sm:text-sm tracking-wider ${
              isActive ? "text-white" : "text-[#214ECF]"
            }`}
          >
            {step.number}
          </span>
          <span
            className={`text-[8px] font-mono uppercase tracking-widest hidden sm:block ${
              isActive ? "text-blue-100" : "text-slate-500"
            }`}
          >
            STEP
          </span>
        </motion.div>

        {/* Continuous Spine Line */}
        {!isLast && (
          <div className="flex-1 w-[2px] bg-slate-200 my-2 relative overflow-hidden min-h-[48px]">
            {/* Animated signal line */}
            <motion.div
              className="absolute top-0 left-0 w-full bg-gradient-to-b from-[#214ECF] via-[#214ECF] to-transparent"
              initial={{ height: "0%" }}
              animate={inView ? { height: "100%" } : {}}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            />
          </div>
        )}
      </div>

      {/* ── Right Content: Architectural Module ── */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.65, ease: EASE, delay: 0.1 }}
        className={`flex-1 rounded-xl border p-6 sm:p-7 mb-6 transition-all duration-300 relative overflow-hidden bg-white ${
          isActive
            ? "border-[#93C5FD] shadow-md ring-2 ring-blue-500/10"
            : "border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs"
        }`}
      >
        {/* Subtle radial wash on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 10% 10%, ${step.accent}0a 0%, transparent 65%)`,
          }}
        />

        {/* Corner registration mark */}
        <div className="absolute top-2.5 right-2.5 text-slate-200 group-hover:text-slate-500 transition-colors font-mono text-[10px] select-none leading-none">
          +
        </div>

        {/* Card Header: Icon + Title + Stage Tag */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-slate-200 bg-slate-50 transition-colors group-hover:border-[#93C5FD] group-hover:bg-blue-50/50"
            >
              <Icon size={18} className="text-[#214ECF]" />
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#214ECF] block">
                STAGE {step.number} // {step.phaseName}
              </span>
              <h3 className="font-display font-bold text-slate-900 text-lg sm:text-xl leading-tight">
                {step.title}
              </h3>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-mono font-semibold self-start sm:self-center">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: step.accent }} />
            <span>{step.benchmark}</span>
          </div>
        </div>

        {/* Description Text */}
        <p className="text-sm leading-relaxed text-slate-700 font-normal mb-5">
          {step.desc}
        </p>

        {/* Tags / Deliverables row */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mr-1">
            Deliverables:
          </span>
          {step.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs"
            >
              <CheckCircle2 size={11} className="text-[#214ECF] shrink-0" />
              <span>{tag}</span>
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────────────────

export function Process() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const scrollToStep = (index: number) => {
    setActiveStepIndex(index);
    const element = document.getElementById(`process-step-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <section
      id="process"
      ref={sectionRef}
      className="relative py-28 md:py-36 bg-white overflow-hidden"
      aria-label="Our Process"
    >
      {/* ── Background Architectural Lattice & Atmospheric Depth ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Soft atmospheric gradient behind timeline */}
        <div
          className="absolute top-1/3 right-10 w-[600px] h-[600px] opacity-40"
          style={{
            background: "radial-gradient(circle at center, rgba(30, 64, 175, 0.06) 0%, rgba(5, 150, 105, 0.03) 50%, transparent 70%)",
            filter: "blur(70px)",
          }}
        />

        {/* Hairline Technical Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(#0F172A 1px, transparent 1px), linear-gradient(90deg, #0F172A 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Hairline dividers */}
        <div className="absolute top-0 inset-x-0 h-px bg-slate-200" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-slate-200" />
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 md:px-12 relative z-10">

        {/* ── Section Main Grid Layout (Asymmetric 12-col composition) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">

          {/* ═══════════════════════════════════════════════════════════════════
              LEFT COLUMN: Sticky Strategic Mission & Telemetry Hub (5 cols)
          ═══════════════════════════════════════════════════════════════════ */}
          <div ref={headingRef} className="lg:col-span-5 lg:sticky lg:top-24 self-start">
            {/* Eyebrow badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, ease: EASE }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-blue-200/80 bg-blue-50/60 mb-5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#214ECF] animate-pulse" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[#214ECF]">
                How We Work
              </span>
            </motion.div>

            {/* Monumental Headline */}
            <div className="overflow-hidden mb-6">
              <motion.h2
                initial={{ y: 24, opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.75, ease: EASE, delay: 0.05 }}
                className="font-display font-black text-slate-900 leading-[1.02] tracking-tight text-3xl sm:text-4xl lg:text-5xl"
              >
                Our battle-tested <br />
                <span className="bg-gradient-to-r from-[#214ECF] via-[#214ECF] to-[#2D5FE8] bg-clip-text text-transparent">
                  7-step process.
                </span>
              </motion.h2>
            </div>

            {/* Narrative Body Copy */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, ease: EASE, delay: 0.15 }}
              className="text-base leading-relaxed mb-8 text-slate-700 font-normal max-w-md"
            >
              A rigorous, repeatable methodology that ships reliable AI and delivers measurable business outcomes — every engagement, every time.
            </motion.p>

            {/* Primary CTA and Timeline Badge */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, ease: EASE, delay: 0.25 }}
              className="flex flex-col sm:flex-row lg:flex-col items-start gap-4 mb-8"
            >
              <Link href="/contact">
                <button
                  className="inline-flex items-center gap-2.5 h-12 px-7 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all shadow-xs hover:shadow-sm cursor-pointer"
                >
                  <span>Start Your Journey</span>
                  <ArrowRight size={15} />
                </button>
              </Link>

              {/* Timeline Duration Badge */}
              <div
                className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50/80 shadow-2xs"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-semibold text-slate-700">
                  MVP delivery in 4–8 weeks
                </span>
              </div>
            </motion.div>

            {/* ── Interactive Process Navigator (HUD) ── */}
            <div className="hidden lg:block rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
                <div className="flex items-center gap-1.5">
                  <Activity size={13} className="text-[#214ECF]" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-600">
                    Execution Telemetry
                  </span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-slate-500">
                  Phase {STEPS[activeStepIndex].number} of 07
                </span>
              </div>

              {/* Step progression buttons */}
              <div className="grid grid-cols-7 gap-1">
                {STEPS.map((s, idx) => (
                  <button
                    key={s.number}
                    onClick={() => scrollToStep(idx)}
                    className={`py-1.5 px-1 rounded text-center transition-all cursor-pointer ${
                      activeStepIndex === idx
                        ? "bg-[#214ECF] text-white font-bold shadow-2xs"
                        : "bg-white text-slate-600 border border-slate-200/80 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    <span className="text-[10px] font-mono block">{s.number}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              RIGHT COLUMN: Interactive 7-Step Architectural Pipeline (7 cols)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7">
            {STEPS.map((step, i) => (
              <StepCard
                key={step.number}
                step={step}
                index={i}
                isLast={i === STEPS.length - 1}
                isActive={activeStepIndex === i}
                onHover={() => setActiveStepIndex(i)}
              />
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
