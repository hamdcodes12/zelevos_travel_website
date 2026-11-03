import { useRef, useState, useEffect } from "react";
import {
  motion, AnimatePresence, useInView, animate,
} from "framer-motion";
import { useLocation } from "wouter";
import {
  Cpu,
  Award,
  ShieldCheck,
  Layers,
  Zap,
  BarChart3,
  RefreshCw,
  UserCheck,
  Globe,
  ArrowUpRight,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  {
    id: "healthcare",
    title: "Healthcare & Life Sciences",
    category: "Medical BPO",
    description:
      "AI-accelerated medical coding, revenue cycle management, and patient engagement that reduce claim denials and compress reimbursement timelines.",
    impact:
      "Health systems and hospitals cut billing errors by 62% and bring A/R days below 30 — without increasing headcount.",
    stats: [
      { value: 62,   suffix: "%",  label: "Fewer Claim Denials"  },
      { value: 30,   suffix: "d",  label: "Avg A/R Days"         },
      { value: 98.4, suffix: "%",  label: "Coding Accuracy"      },
    ],
    cta: "Explore Healthcare BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    accentColor: "rgba(33,78,207,0.14)",
    glowColor:   "rgba(33,78,207,0.18)",
  },
  {
    id: "finance",
    title: "Financial Services & Banking",
    category: "FinTech Operations",
    description:
      "Compliance-ready back-office workflows, real-time fraud signal triage, KYC/AML processing, and loan operations at enterprise scale.",
    impact:
      "Banks and lenders reduce operational costs by 45% while maintaining 99.9% regulatory compliance across every jurisdiction.",
    stats: [
      { value: 45,   suffix: "%",  label: "Cost Reduction"       },
      { value: 99.9, suffix: "%",  label: "Compliance Rate"      },
      { value: 3.1,  suffix: "x",  label: "Processing Speed"     },
    ],
    cta: "Explore Financial BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    accentColor: "rgba(52,211,153,0.14)",
    glowColor:   "rgba(16,185,129,0.2)",
  },
  {
    id: "technology",
    title: "Technology & SaaS",
    category: "Tech Support Ops",
    description:
      "White-glove customer success, 24/7 tier-1 and tier-2 technical support, QA automation, and onboarding operations that scale with your product.",
    impact:
      "SaaS companies achieve sub-2-hour first response and 92% CSAT at a fraction of the cost of an equivalent in-house team.",
    stats: [
      { value: 2,    suffix: "h",  label: "First Response SLA"   },
      { value: 92,   suffix: "%",  label: "CSAT Score"            },
      { value: 60,   suffix: "%",  label: "Cost vs In-House"      },
    ],
    cta: "Explore Tech Support BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    accentColor: "rgba(129,140,248,0.16)",
    glowColor:   "rgba(99,102,241,0.22)",
  },
  {
    id: "insurance",
    title: "Insurance & Risk",
    category: "Claims & Policy",
    description:
      "Intelligent claims adjudication, underwriting support, and policy administration that eliminate backlogs and accelerate settlement cycles.",
    impact:
      "Carriers reduce claims cycle time by 58% and improve adjuster throughput by 3.2× with zero increase in error rate.",
    stats: [
      { value: 58,   suffix: "%",  label: "Faster Claims"         },
      { value: 3.2,  suffix: "x",  label: "Adjuster Throughput"   },
      { value: 94,   suffix: "%",  label: "First-Pass Accuracy"   },
    ],
    cta: "Explore Insurance BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    accentColor: "rgba(251,191,36,0.13)",
    glowColor:   "rgba(245,158,11,0.2)",
  },
  {
    id: "retail",
    title: "Retail & E-Commerce",
    category: "CX Operations",
    description:
      "Omnichannel customer experience, returns and refund management, catalog operations, and order support that turn friction into long-term loyalty.",
    impact:
      "Retailers achieve a 40% reduction in CX costs while lifting Net Promoter Score by 25 points within the first quarter.",
    stats: [
      { value: 40,   suffix: "%",  label: "CX Cost Reduction"     },
      { value: 25,   suffix: "pt", label: "NPS Increase"          },
      { value: 98,   suffix: "%",  label: "Order Accuracy"        },
    ],
    cta: "Explore Retail BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    ),
    accentColor: "rgba(251,113,133,0.13)",
    glowColor:   "rgba(244,63,94,0.18)",
  },
  {
    id: "realestate",
    title: "Real Estate & PropTech",
    category: "Property Operations",
    description:
      "AI-powered lead qualification, CRM management, property listing support, and tenant operations that convert faster and retain longer.",
    impact:
      "Real estate firms convert 2.8× more qualified leads while cutting administrative overhead by 50% across portfolio teams.",
    stats: [
      { value: 2.8,  suffix: "x",  label: "Lead Conversion"      },
      { value: 50,   suffix: "%",  label: "Admin Reduction"       },
      { value: 48,   suffix: "h",  label: "Response SLA"         },
    ],
    cta: "Explore Real Estate BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    accentColor: "rgba(71,163,255,0.16)",
    glowColor:   "rgba(37,99,235,0.22)",
  },
  {
    id: "education",
    title: "Education & EdTech",
    category: "Student Success",
    description:
      "Enrollment support, student success operations, content moderation, and LMS management at institutional scale — across every time zone.",
    impact:
      "EdTech platforms improve enrollment completion by 35% and reduce student churn by 28% in the first semester.",
    stats: [
      { value: 35,   suffix: "%",  label: "Enrollment Completion" },
      { value: 28,   suffix: "%",  label: "Churn Reduction"       },
      { value: 24,   suffix: "/7", label: "Support Coverage"      },
    ],
    cta: "Explore EdTech BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
      </svg>
    ),
    accentColor: "rgba(167,139,250,0.15)",
    glowColor:   "rgba(139,92,246,0.2)",
  },
  {
    id: "logistics",
    title: "Logistics & Supply Chain",
    category: "Supply Chain Ops",
    description:
      "Shipment tracking, carrier management, freight audit, dispute resolution, and last-mile coordination powered by AI-driven operational intelligence.",
    impact:
      "Logistics providers cut exception-handling time by 65% and push on-time delivery rates above 97% at scale.",
    stats: [
      { value: 65,   suffix: "%",  label: "Exception Reduction"   },
      { value: 97,   suffix: "%",  label: "On-Time Delivery"      },
      { value: 40,   suffix: "%",  label: "Ops Cost Savings"      },
    ],
    cta: "Explore Logistics BPO",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 5v4h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
    accentColor: "rgba(52,211,153,0.15)",
    glowColor:   "rgba(16,185,129,0.2)",
  },
] as const;

type Industry = typeof INDUSTRIES[number];

const REASONS = [
  {
    id: "01",
    title: "AI-first approach",
    icon: Cpu,
    tag: "CORE ARCHITECTURE",
    highlight: "Autonomous agents & neural models",
  },
  {
    id: "02",
    title: "Highly trained professionals",
    icon: Award,
    tag: "TOP 1% TALENT",
    highlight: "Domain-certified operators",
  },
  {
    id: "03",
    title: "Enterprise-grade security",
    icon: ShieldCheck,
    tag: "SOC2 & ISO 27001",
    highlight: "Zero-trust & air-gapped data",
  },
  {
    id: "04",
    title: "Flexible engagement models",
    icon: Layers,
    tag: "MODULAR SLAs",
    highlight: "Dedicated pods & hybrid teams",
  },
  {
    id: "05",
    title: "Rapid team scaling",
    icon: Zap,
    tag: "RAPID SCALE",
    highlight: "Production ready in <14 days",
  },
  {
    id: "06",
    title: "Transparent reporting",
    icon: BarChart3,
    tag: "REAL-TIME BI",
    highlight: "Audited telemetry & live dashboards",
  },
  {
    id: "07",
    title: "Continuous process improvement",
    icon: RefreshCw,
    tag: "KAIZEN VELOCITY",
    highlight: "Iterative sprint optimization",
  },
  {
    id: "08",
    title: "Dedicated account management",
    icon: UserCheck,
    tag: "EXECUTIVE LIAISON",
    highlight: "Named director & technical leads",
  },
  {
    id: "09",
    title: "Global delivery capabilities",
    icon: Globe,
    tag: "25+ COUNTRIES",
    highlight: "24/7/365 multi-shore resiliency",
  },
] as const;

// ─── Animated stat number ─────────────────────────────────────────────────────

function StatNumber({ value, suffix, label, trigger }: {
  value: number; suffix: string; label: string; trigger: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!trigger || !ref.current) return;
    const isFloat = value % 1 !== 0;
    const ctrl = animate(0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      onUpdate(v) {
        if (ref.current) ref.current.textContent = (isFloat ? v.toFixed(1) : Math.floor(v)) + suffix;
      },
    });
    return () => ctrl.stop();
  }, [trigger, value, suffix]);

  return (
    <div className="flex flex-col gap-1">
      <span
        ref={ref}
        className="text-2xl md:text-3xl font-bold font-display"
        style={{
          background: "linear-gradient(135deg,#ffffff 0%,#214ECF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        0{suffix}
      </span>
      <span className="text-[9px] uppercase tracking-[0.18em] font-mono"
        style={{ color: "rgba(33,78,207,0.22)" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Industry card ────────────────────────────────────────────────────────────

interface IndustryCardProps {
  industry: Industry;
  index: number;
  isActive: boolean;
  onActivate: (id: string) => void;
}

function IndustryCard({ industry, index, isActive, onActivate }: IndustryCardProps) {
  const [, setLocation] = useLocation();
  const cardRef   = useRef<HTMLDivElement>(null);
  const inView    = useInView(cardRef, { once: true, margin: "-60px" });

  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 44 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.07, duration: 0.65, ease }}
      onClick={() => onActivate(industry.id)}
      className="relative overflow-hidden cursor-pointer select-none"
      style={{ borderRadius: 16 }}
    >
      {/* Card base */}
      <motion.div
        className="absolute inset-0"
        style={{
          borderRadius: 12,
          border: "1px solid",
          background: isActive ? "#F8FAFC" : "#FFFFFF",
          borderColor: isActive ? "#93C5FD" : "#E2E8F0",
          boxShadow: isActive ? "0 10px 25px -5px rgba(15, 23, 42, 0.06)" : "0 1px 3px rgba(15, 23, 42, 0.03)",
        }}
      />

      <div className="relative z-10">
        {/* ── Collapsed header — always visible ── */}
        <div className="flex items-center gap-5 px-6 md:px-8 min-h-[76px] py-4">
          {/* Icon container */}
          <div
            style={{
              background: isActive ? "rgba(30,64,175,0.08)" : "rgba(30,64,175,0.03)",
              borderColor: isActive ? "#93C5FD" : "#E2E8F0",
              color: isActive ? "#214ECF" : "#334155",
            }}
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border"
          >
            {industry.icon}
          </div>

          {/* Title + category */}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-base md:text-lg leading-snug truncate text-slate-900">
              {industry.title}
            </h3>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-[#214ECF]">
              {industry.category}
            </span>
          </div>

          {/* Expand chevron */}
          <motion.div
            animate={{ rotate: isActive ? 45 : 0, opacity: isActive ? 1 : 0.6 }}
            transition={{ duration: 0.35, ease }}
            className="flex-shrink-0 w-7 h-7 rounded-md border flex items-center justify-center border-slate-200"
            style={{
              background: isActive ? "rgba(30,64,175,0.08)" : "transparent",
              color: isActive ? "#214ECF" : "#475569",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </motion.div>
        </div>

        {/* ── Expanded content ── */}
        <AnimatePresence initial={false}>
          {isActive && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5, ease }}
              style={{ overflow: "hidden" }}
            >
              <div className="px-6 md:px-8 pb-8 pt-1">
                {/* Divider */}
                <div className="mb-6 h-px bg-slate-200" />

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-start">
                  {/* Left — text content */}
                  <div>
                    <motion.p
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08, duration: 0.5, ease }}
                      className="text-sm md:text-base leading-relaxed mb-5 text-slate-700 font-normal"
                    >
                      {industry.description}
                    </motion.p>

                    {/* Impact callout */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.14, duration: 0.5, ease }}
                      className="relative rounded-xl px-4 py-3.5 mb-7 bg-slate-50 border border-slate-200"
                    >
                      <p className="text-[13px] leading-relaxed font-normal text-slate-800">
                        <span style={{ color: "#214ECF", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", marginRight: 8, fontWeight: 700 }}>
                          Business Impact
                        </span>
                        <br className="sm:hidden" />
                        {industry.impact}
                      </p>
                    </motion.div>

                    {/* CTA */}
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22, duration: 0.45, ease }}
                      whileHover={{ y: -1 }}
                      whileTap={{ y: 0 }}
                      onClick={(e) => { e.stopPropagation(); setLocation("/contact"); }}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all shadow-xs cursor-pointer"
                    >
                      {industry.cta}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </motion.button>
                  </div>

                  {/* Right — animated stats */}
                  <motion.div
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1, duration: 0.55, ease }}
                    className="flex flex-row md:flex-col gap-6 md:gap-5 md:min-w-[160px]"
                  >
                    {industry.stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="relative rounded-xl px-4 py-3.5 flex-1 md:flex-none overflow-hidden"
                        style={{
                          background: "rgba(244,247,255,0.8)",
                          border: "1px solid rgba(33,78,207,0.08)",
                        }}
                      >
                        <div className="absolute top-0 left-0 right-0 h-px"
                          style={{ background: "linear-gradient(90deg,transparent,rgba(33,78,207,0.18),transparent)" }} />
                        <StatNumber
                          value={stat.value}
                          suffix={stat.suffix}
                          label={stat.label}
                          trigger={isActive}
                        />
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Precision Reason Card ───────────────────────────────────────────────────

function ReasonCard({ reason, index }: { reason: typeof REASONS[number]; index: number }) {
  const Icon = reason.icon;
  const col = index % 3;
  const row = Math.floor(index / 3);
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: row * 0.08 + col * 0.04 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative bg-white hover:bg-[#FBFDFF] p-6 md:p-7 flex flex-col justify-between transition-all duration-300 cursor-default"
    >
      {/* Micro grid watermark on hover */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          backgroundImage: "linear-gradient(rgba(30,64,175,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.03) 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
      />

      {/* Top row: Index badge and Icon */}
      <div>
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-[11px] text-[#214ECF] bg-blue-50/90 border border-blue-200/60 px-2 py-0.5 rounded tracking-wider">
              {reason.id}
            </span>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">
              {reason.tag}
            </span>
          </div>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105"
            style={{
              background: hovered ? "rgba(30,64,175,0.12)" : "rgba(30,64,175,0.06)",
              border: "1px solid rgba(30,64,175,0.15)",
            }}
          >
            <Icon size={16} className="text-[#214ECF] transition-colors" />
          </div>
        </div>

        {/* Title */}
        <h4 className="text-slate-900 font-bold text-base md:text-lg tracking-tight leading-snug group-hover:text-[#214ECF] transition-colors relative z-10">
          {reason.title}
        </h4>
      </div>

      {/* Bottom row: Operational Verification */}
      <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[11px] font-mono text-slate-600 font-medium">
            {reason.highlight}
          </span>
        </div>
        <ArrowUpRight size={13} className="text-slate-500 group-hover:text-[#214ECF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </motion.div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function IndustriesSection() {
  const [activeId, setActiveId] = useState<string>(INDUSTRIES[0].id);
  const sectionRef  = useRef<HTMLElement>(null);
  const headingRef  = useRef<HTMLDivElement>(null);
  const inView      = useInView(headingRef, { once: true, margin: "-80px" });
  const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

  return (
    <section ref={sectionRef} className="py-28 md:py-36 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg,#FFFFFF 0%,#F5F8FF 50%,#FFFFFF 100%)" }}>

      {/* Background depth layer */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(ellipse,rgba(37,99,235,0.05) 0%,transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(ellipse,rgba(37,99,235,0.04) 0%,transparent 70%)" }} />
        {/* Fine grid */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(71,163,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(71,163,255,0.025) 1px,transparent 1px)",
            backgroundSize: "55px 55px",
            maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%,black 30%,transparent 100%)",
          }} />
      </div>

      <div className="max-w-5xl mx-auto px-6 relative z-10">

        {/* ── Section header ── */}
        <div ref={headingRef} className="mb-16 md:mb-20">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease }}
            className="text-[10px] font-mono uppercase tracking-[0.28em] mb-5 text-center"
            style={{ color: "#214ECF" }}
          >
            Industries We Serve
          </motion.p>
          <div className="overflow-hidden text-center">
            <motion.h2
              initial={{ y: "100%", opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.85, ease }}
              className="font-display font-bold text-foreground leading-[1.05]"
              style={{ fontSize: "clamp(2rem,4vw,3.4rem)" }}
            >
              Global Reach Across Every Sector
            </motion.h2>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.6, ease }}
            className="text-center text-sm md:text-base max-w-xl mx-auto mt-4"
            style={{ color: "#4B5563" }}
          >
            Explore how Thinkatic's AI-powered operations transform performance across the industries that drive global enterprise.
          </motion.p>
        </div>

        {/* ── Interactive industry accordion ── */}
        <div className="flex flex-col gap-2.5 mb-28">
          {INDUSTRIES.map((industry, i) => (
            <IndustryCard
              key={industry.id}
              industry={industry}
              index={i}
              isActive={activeId === industry.id}
              onActivate={setActiveId}
            />
          ))}
        </div>

        {/* ── Divider ── */}
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.2, ease }}
          className="mb-24 h-px origin-center"
          style={{ background: "linear-gradient(90deg,transparent,rgba(33,78,207,0.06) 50%,transparent)" }}
        />

        {/* ── Why Thinkatic ── */}
        <div>
          {/* Header block */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, ease }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50/80 border border-blue-200/60 mb-4"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#214ECF]" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#214ECF]">
                  Why businesses choose Thinkatic
                </span>
              </motion.div>

              <div className="overflow-hidden">
                <motion.h3
                  initial={{ y: "100%", opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.75, ease }}
                  className="font-display font-black text-slate-900 leading-[1.1]"
                  style={{ fontSize: "clamp(2rem,3.4vw,3.2rem)" }}
                >
                  Nine Reasons to Choose Intelligent Operations
                </motion.h3>
              </div>
            </div>

            {/* Verification telemetry HUD indicator */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease, delay: 0.2 }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200/90 bg-white shadow-2xs self-start md:self-auto"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-left">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Architecture Standard</p>
                <p className="text-xs font-mono font-bold text-[#0F172A]">9/9 Protocols Active</p>
              </div>
            </motion.div>
          </div>

          {/* Precision 3x3 Architectural Lattice */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, ease }}
            className="rounded-2xl border border-slate-200/90 bg-slate-200/80 p-[1px] shadow-[0_10px_35px_-10px_rgba(15,23,42,0.06)] overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[1px]">
              {REASONS.map((r, i) => (
                <ReasonCard key={r.id} reason={r} index={i} />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
