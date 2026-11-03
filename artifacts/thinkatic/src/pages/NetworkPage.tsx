import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO } from "@/hooks/useSEO";
import {
  Network,
  Globe,
  Building2,
  Users,
  Cpu,
  Layers,
  ShieldCheck,
  Shield,
  Lock,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Briefcase,
  FileCheck2,
  BarChart3,
  Activity,
  Zap,
  Check,
  ChevronRight,
  Target,
  Sparkles,
  ClipboardList,
  Eye,
  Sliders,
  Scale,
  Gauge,
  Headphones,
  Laptop,
  HelpCircle,
  Database,
  UserCheck,
  FileText,
  BadgeCheck,
  AlertCircle,
  Clock,
  TrendingUp,
} from "lucide-react";

// ── Motion Animation Variants ──────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

// ── Network Hub Visual Component ──────────────────────────────────────────────
interface SatelliteNode {
  id: string;
  name: string;
  category: string;
  icon: React.ElementType;
  coords: { x: number; y: number }; // Percentage in SVG/container
  desc: string;
}

const SATELLITE_NODES: SatelliteNode[] = [
  {
    id: "clients",
    name: "GLOBAL CLIENTS",
    category: "Demand Layer",
    icon: Building2,
    coords: { x: 18, y: 22 },
    desc: "Businesses defining structured operational requirements, scale, and delivery standards.",
  },
  {
    id: "partners",
    name: "VERIFIED BPO PARTNERS",
    category: "Delivery Layer",
    icon: Users,
    coords: { x: 82, y: 22 },
    desc: "Rigorous onboarding, live centre verification, and vetted operational management.",
  },
  {
    id: "centres",
    name: "DELIVERY CENTRES",
    category: "Infrastructure",
    icon: Building2,
    coords: { x: 86, y: 46 },
    desc: "Physical production facilities equipped with enterprise IT, power, and security controls.",
  },
  {
    id: "agents",
    name: "AGENTS & TEAMS",
    category: "Human Workforce",
    icon: UserCheck,
    coords: { x: 74, y: 68 },
    desc: "Skilled professionals delivering customer experience and structured business workflows.",
  },
  {
    id: "technology",
    name: "TECHNOLOGY",
    category: "Platform Core",
    icon: Cpu,
    coords: { x: 26, y: 68 },
    desc: "Intelligent systems, data integrations, and automated operational management.",
  },
  {
    id: "operations",
    name: "OPERATIONS",
    category: "Execution Layer",
    icon: Activity,
    coords: { x: 14, y: 46 },
    desc: "Consistent shift management, process documentation, and execution workflows.",
  },
  {
    id: "quality",
    name: "QUALITY",
    category: "Governance",
    icon: ShieldCheck,
    coords: { x: 50, y: 12 },
    desc: "Continuous SLA tracking, auditability, scorecard transparency, and human oversight.",
  },
];

// ── How It Works Steps ────────────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "BUSINESS REQUIREMENT",
    actor: "Client Layer",
    description:
      "A client defines the required service, business process, required capacity, languages, shift coverage, and operational objectives.",
    icon: Briefcase,
    highlight: "Clear Scope & KPIs",
  },
  {
    step: "02",
    title: "THINKATIC",
    actor: "Platform & Governance",
    description:
      "Thinkatic understands the requirement and structures the appropriate delivery model, operational frameworks, and compliance guardrails.",
    icon: Network,
    highlight: "Solution Architecture",
  },
  {
    step: "03",
    title: "VERIFIED DELIVERY CAPABILITY",
    actor: "Ecosystem Match",
    description:
      "Suitable verified BPO delivery capabilities can participate according to their verified facilities, skills, and validated capacity.",
    icon: ShieldCheck,
    highlight: "Vetted Capabilities",
  },
  {
    step: "04",
    title: "PROJECT & ALLOCATION",
    actor: "Authorized Workflow",
    description:
      "Approved project allocation is managed through the Thinkatic operating workflow. Authorized human administrators oversee project allocations.",
    icon: FileCheck2,
    highlight: "Human/Admin Governed",
  },
  {
    step: "05",
    title: "DELIVERY",
    actor: "Frontline Execution",
    description:
      "BPO teams and trained agents execute the assigned operational processes under structured supervisor oversight and documented SOPs.",
    icon: Users,
    highlight: "Standardized Operations",
  },
  {
    step: "06",
    title: "QUALITY & REPORTING",
    actor: "Operational Visibility",
    description:
      "Attendance, productivity, quality evaluations, compliance logs, and transparent reporting provide end-to-end operational visibility.",
    icon: BarChart3,
    highlight: "Real-time Metrics",
  },
  {
    step: "07",
    title: "PAYOUT & CONTINUOUS IMPROVEMENT",
    actor: "Financial & Scaling",
    description:
      "Partner financial workflows, reconciled payouts, and systematic operational improvements are managed smoothly through the platform.",
    icon: TrendingUp,
    highlight: "Reliable Settlement",
  },
];

// ── Quality Dimensions ─────────────────────────────────────────────────────────
const QUALITY_CATEGORIES = [
  {
    name: "QUALITY ASSURANCE",
    metric: "Process Adherence",
    desc: "Structured quality scoring against approved client guidelines, rubric standards, and interaction samples.",
    icon: BadgeCheck,
  },
  {
    name: "PRODUCTIVITY",
    metric: "Operational Volume",
    desc: "Consistent monitoring of handled contacts, cases processed, and workflow task completion rates.",
    icon: Activity,
  },
  {
    name: "RESPONSE TIME",
    metric: "First Contact Velocity",
    desc: "Tracking speed-to-answer across live voice, digital chat queues, and priority ticketing channels.",
    icon: Clock,
  },
  {
    name: "RESOLUTION TIME",
    metric: "Cycle Efficiency",
    desc: "Measuring end-to-end time required to resolve customer queries or complete complex operational tasks.",
    icon: CheckCircle2,
  },
  {
    name: "CUSTOMER SATISFACTION",
    metric: "Experience Sentiment",
    desc: "Evaluating end-user satisfaction scores, post-interaction feedback, and sentiment trends.",
    icon: Users,
  },
  {
    name: "PROCESS ACCURACY",
    metric: "Defect Prevention",
    desc: "Ensuring zero-error data handling, regulatory compliance adherence, and transactional accuracy.",
    icon: Target,
  },
  {
    name: "OPERATIONAL EFFICIENCY",
    metric: "Resource Utilization",
    desc: "Optimizing agent schedule occupancy, shrinkage management, and infrastructure productivity.",
    icon: Gauge,
  },
];

// ── Journey Timeline ──────────────────────────────────────────────────────────
const JOURNEY_STEPS = [
  {
    stage: "CONNECT",
    label: "Bring the business requirement into the ecosystem with defined scope and targets.",
  },
  {
    stage: "VERIFY",
    label: "Establish trusted delivery capability through rigorous KYC, centre audits, and agreements.",
  },
  {
    stage: "MATCH",
    label: "Identify suitable delivery capabilities based on language, skill sets, and verified capacity.",
  },
  {
    stage: "ALLOCATE",
    label: "Authorized human allocation creates the formal delivery and project relationship.",
  },
  {
    stage: "DELIVER",
    label: "Frontline teams and supervisors execute the approved operational workflows.",
  },
  {
    stage: "MEASURE",
    label: "Track relevant performance metrics, attendance, and quality scorecards in real time.",
  },
  {
    stage: "IMPROVE",
    label: "Identify operational improvements, coaching opportunities, and workflow refinements.",
  },
  {
    stage: "SCALE",
    label: "Expand delivery capability and seat capacity seamlessly as business requirements grow.",
  },
];

export default function NetworkPage() {
  useSEO({
    title: "Thinkatic | Global BPO & Delivery Network",
    description:
      "Explore the Thinkatic global delivery network connecting businesses, verified BPO partners, delivery centres, skilled teams and technology-enabled operations.",
    path: "/network",
  });

  const [activeNode, setActiveNode] = useState<SatelliteNode>(SATELLITE_NODES[0]);
  const [activeStep, setActiveStep] = useState<number>(0);

  return (
    <Layout>
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HERO SECTION: Connected Network Visualization
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 bg-gradient-to-b from-[#F0F5FF]/60 via-white to-white overflow-hidden border-b border-slate-200/80">
        {/* Subtle background tech grid */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#214ECF 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left text column */}
            <motion.div
              className="lg:col-span-6 space-y-6"
              initial="hidden"
              animate="visible"
              variants={fadeUp}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/70 text-[#214ECF] text-xs font-bold uppercase tracking-wider">
                <Network className="w-3.5 h-3.5" />
                <span>THINKATIC NETWORK</span>
              </div>

              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold text-[#0B1226] tracking-tight leading-[1.12]">
                A Connected Network. <br />
                <span className="text-[#214ECF]">Built for Global Delivery.</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal">
                Thinkatic connects businesses with verified delivery capabilities, skilled teams, structured processes and technology-enabled operations to create a scalable global delivery ecosystem.
              </p>

              <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-xl font-normal">
                Our network brings together clients, Thinkatic operations, verified BPO partners, delivery centres and frontline teams through a connected operating model.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-4 sm:items-center">
                <Link
                  href="/signup?role=bpo"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#214ECF] text-white font-semibold text-sm hover:bg-[#1a3fa8] transition-all shadow-md hover:shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  <span>Join the Network</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[#0B1226] border border-slate-300 font-semibold text-sm hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-xs cursor-pointer"
                >
                  <span>Talk to Thinkatic</span>
                </Link>
              </div>

              {/* Core ecosystem indicators */}
              <div className="pt-6 grid grid-cols-3 gap-3 border-t border-slate-200/80 max-w-lg">
                <div>
                  <div className="text-xs font-mono font-bold text-[#214ECF] uppercase">Vetted Centres</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">Physical Verification</div>
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-[#214ECF] uppercase">Governance</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">Human Authorized</div>
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-[#214ECF] uppercase">Delivery</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">End-to-End SLAs</div>
                </div>
              </div>
            </motion.div>

            {/* Right: Interactive Connected Network Visual */}
            <motion.div
              className="lg:col-span-6 relative flex justify-center"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease, delay: 0.15 }}
            >
              <div className="relative w-full max-w-[540px] aspect-square rounded-3xl bg-white border border-slate-200/80 shadow-xl p-4 sm:p-6 overflow-hidden flex flex-col justify-between">
                {/* SVG connection lines connecting all satellites to center (50%, 50%) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="netGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#214ECF" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#214ECF" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  {SATELLITE_NODES.map((node) => (
                    <g key={node.id}>
                      <line
                        x1="50%"
                        y1="44%"
                        x2={`${node.coords.x}%`}
                        y2={`${node.coords.y}%`}
                        stroke={activeNode.id === node.id ? "#214ECF" : "#CBD5E1"}
                        strokeWidth={activeNode.id === node.id ? "2.5" : "1.25"}
                        strokeDasharray={activeNode.id === node.id ? "none" : "4 4"}
                        className="transition-all duration-300"
                      />
                      {activeNode.id === node.id && (
                        <circle
                          cx={`${node.coords.x * 0.75 + 50 * 0.25}%`}
                          cy={`${node.coords.y * 0.75 + 44 * 0.25}%`}
                          r="3"
                          fill="#214ECF"
                          className="animate-ping"
                        />
                      )}
                    </g>
                  ))}
                </svg>

                {/* Satellite interactive nodes placed by percentage */}
                {SATELLITE_NODES.map((node) => {
                  const Icon = node.icon;
                  const isActive = activeNode.id === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setActiveNode(node)}
                      style={{ left: `${node.coords.x}%`, top: `${node.coords.y}%` }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-2xl transition-all duration-300 z-20 flex items-center gap-2 group cursor-pointer ${
                        isActive
                          ? "bg-[#214ECF] text-white shadow-lg ring-4 ring-[#214ECF]/20 scale-110"
                          : "bg-white text-slate-700 border border-slate-200 hover:border-[#214ECF] shadow-sm hover:scale-105"
                      }`}
                      aria-label={`Inspect ${node.name}`}
                    >
                      <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isActive ? "text-white" : "text-[#214ECF]"}`} />
                      <span className="hidden sm:inline text-[11px] font-bold tracking-tight whitespace-nowrap">
                        {node.name.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}

                {/* Central Hub: THINKATIC */}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 text-center pointer-events-none"
                  style={{ left: "50%", top: "44%" }}
                >
                  <div className="relative pointer-events-auto">
                    <div
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full text-white flex flex-col items-center justify-center p-2 shadow-2xl border-4 border-white ring-8 ring-[#214ECF]/15"
                      style={{ background: "linear-gradient(135deg, #0B1226 0%, #1E293B 100%)" }}
                    >
                      <div className="w-2 h-2 rounded-full bg-emerald-400 mb-1 animate-pulse" />
                      <div className="font-extrabold text-[12px] sm:text-xs tracking-wider uppercase font-mono text-[#60A5FA]">
                        THINKATIC
                      </div>
                      <div className="text-[10px] text-slate-300 font-medium">Operating Hub</div>
                    </div>
                  </div>
                </div>

                {/* Active node detail panel at bottom */}
                <div className="mt-auto relative z-30 bg-slate-50/90 backdrop-blur-xs border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 transition-all duration-300">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-[#214ECF] uppercase tracking-wider bg-blue-100/70 px-2 py-0.5 rounded">
                        {activeNode.category}
                      </span>
                      <h2 className="text-xs sm:text-sm font-bold text-[#0B1226]">{activeNode.name}</h2>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">Click nodes to explore</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{activeNode.desc}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. NETWORK AT A GLANCE: 5 Connected Pillars
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              ECOSYSTEM ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              One Connected Delivery Ecosystem
            </h2>
            <p className="text-base text-slate-600">
              Each component of the Thinkatic network fulfills a dedicated operational role, bound together by structured workflows, transparency, and strict governance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              {
                title: "CLIENTS",
                icon: Building2,
                role: "Demand & Specification",
                description:
                  "Businesses looking for reliable technology-enabled outsourcing, CX modernization, and structured operational capabilities.",
              },
              {
                title: "THINKATIC",
                icon: Network,
                role: "Platform & Governance",
                description:
                  "The central platform and operating layer connecting business requirements with delivery capabilities and authorized oversight.",
              },
              {
                title: "BPO PARTNERS",
                icon: Users,
                role: "Verified Capacity",
                description:
                  "Verified delivery centres providing operational capacity, secure physical infrastructure, and experienced local management.",
              },
              {
                title: "AGENTS & TEAMS",
                icon: UserCheck,
                role: "Operational Execution",
                description:
                  "Frontline professionals executing customer support, back-office workflows, and business processes with measurable quality.",
              },
              {
                title: "TECHNOLOGY",
                icon: Cpu,
                role: "Digital Operating Layer",
                description:
                  "Platforms, workflows, automation, SLA dashboards, reporting, and digital tools supporting the continuous operation.",
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={idx}
                  className="group relative bg-[#F8FAFC] hover:bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="w-11 h-11 rounded-xl bg-white group-hover:bg-blue-50 border border-slate-200 group-hover:border-blue-200 text-[#214ECF] flex items-center justify-center transition-colors">
                      <Icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-[#214ECF] font-bold uppercase tracking-wider mb-1">
                        {card.role}
                      </div>
                      <h3 className="text-base font-bold text-[#0B1226] tracking-tight">{card.title}</h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{card.description}</p>
                  </div>

                  <div className="pt-4 mt-6 border-t border-slate-200/60 flex items-center text-xs font-semibold text-[#214ECF] group-hover:translate-x-0.5 transition-transform">
                    <span>Ecosystem Member</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. HOW THE THINKATIC NETWORK WORKS: 7-Step Interactive Flow
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              OPERATIONAL LIFECYCLE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              How the Thinkatic Network Works
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              A transparent, 7-stage workflow connecting demand, authorized allocation, standardized frontline delivery, and audited performance.
            </p>
          </div>

          {/* Interactive Step Navigator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Step Selection List */}
            <div className="lg:col-span-5 space-y-2.5">
              {WORKFLOW_STEPS.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = activeStep === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-3.5 cursor-pointer ${
                      isSelected
                        ? "bg-white border-[#214ECF] shadow-md ring-1 ring-[#214ECF]/20"
                        : "bg-white/60 hover:bg-white border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-mono font-bold text-xs ${
                        isSelected ? "bg-[#214ECF] text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0B1226] tracking-tight truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-[#214ECF] uppercase font-semibold">
                          {item.actor}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.highlight}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Step Detailed Canvas */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-extrabold font-mono text-[#214ECF]">
                      {WORKFLOW_STEPS[activeStep].step}
                    </span>
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        STAGE {WORKFLOW_STEPS[activeStep].step} OF 07
                      </span>
                      <span className="text-xs font-semibold text-[#214ECF]">
                        {WORKFLOW_STEPS[activeStep].actor}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-[#214ECF] text-xs font-mono font-bold">
                    {WORKFLOW_STEPS[activeStep].highlight}
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-extrabold text-[#0B1226] tracking-tight">
                    {WORKFLOW_STEPS[activeStep].title}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-600 leading-relaxed mt-3">
                    {WORKFLOW_STEPS[activeStep].description}
                  </p>
                </div>

                {/* Governance Guardrail Highlight for Step 4 */}
                {activeStep === 3 && (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Human Governance Guaranteed:</span> Thinkatic does not claim automatic partner selection or project awards. Authorized administrators evaluate capabilities, verified facilities, and client specifications to make responsible allocation decisions.
                    </div>
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Thinkatic Operating Protocol</span>
                  <div className="flex items-center gap-1.5">
                    {WORKFLOW_STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === activeStep ? "w-6 bg-[#214ECF]" : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. GLOBAL CLIENT NETWORK: Connecting Demand to Delivery
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              CLIENT REACH & SOLUTIONS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Connecting Businesses With Delivery Capability
            </h2>
            <p className="text-base text-slate-600">
              Thinkatic is designed to connect businesses with structured delivery capabilities across customer experience, business operations and technology-enabled services.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "CUSTOMER EXPERIENCE",
                icon: Headphones,
                badge: "Frontline Support",
                description:
                  "Voice, chat, email, onboarding, technical assistance and customer support operations delivered with trained communication skills.",
                points: ["Omnichannel ticketing", "24/7 coverage", "Native English & bilingual", "CSAT & FCR optimization"],
              },
              {
                title: "BUSINESS OPERATIONS",
                icon: Briefcase,
                badge: "Back-Office Engine",
                description:
                  "Back-office, data processing, order management, lead management, validation, reconciliation, and administrative operations.",
                points: ["Structured data handling", "Order fulfillment workflows", "Lead qualification", "KYC & compliance review"],
              },
              {
                title: "TECHNOLOGY-ENABLED OPERATIONS",
                icon: Cpu,
                badge: "Digital Acceleration",
                description:
                  "Technology, automation, digital operations, and technology-supported customer service built around defined business rules.",
                points: ["API & CRM integration", "Workflow automation", "Intelligent reporting", "Agent-assist augmentation"],
              },
            ].map((srv, idx) => {
              const Icon = srv.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F8FAFC] hover:bg-white rounded-2xl p-7 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-200/60">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                        {srv.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-[#0B1226] tracking-tight">{srv.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed mt-2 font-normal">
                        {srv.description}
                      </p>
                    </div>

                    <ul className="space-y-2 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
                      {srv.points.map((pt, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-[#214ECF] flex-shrink-0" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-200/60">
                    <Link
                      href="/services"
                      className="text-xs font-semibold text-[#214ECF] hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Explore Capability</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/services"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#214ECF] text-white font-semibold text-xs hover:bg-[#1a3fa8] transition-colors shadow-sm cursor-pointer"
            >
              <span>Explore What We Do</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. VERIFIED BPO PARTNER NETWORK: Dark Navy Section
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1226] text-white relative overflow-hidden border-b border-slate-800">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#60A5FA 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#60A5FA] tracking-widest uppercase font-mono">
              VETTED DELIVERY HUBS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Network Built Around Verified Delivery Partners
            </h2>
            <p className="text-base text-slate-300">
              Thinkatic works with BPO centres that complete the required onboarding and verification process before becoming approved delivery partners.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "BUSINESS VERIFICATION",
                icon: Building2,
                step: "Phase 01",
                description:
                  "Business and company legal registration, tax IDs, and corporate records are reviewed through the structured onboarding process.",
              },
              {
                title: "CENTRE VERIFICATION",
                icon: ShieldCheck,
                step: "Phase 02",
                description:
                  "Office facilities, biometric access, workstation photos, and required live office verification evidence are rigorously reviewed.",
              },
              {
                title: "DOCUMENTATION",
                icon: FileCheck2,
                step: "Phase 03",
                description:
                  "Required KYC, corporate statutory documents, operational policies, and supporting compliance certificates are audited.",
              },
              {
                title: "AGREEMENT & APPROVAL",
                icon: BadgeCheck,
                step: "Phase 04",
                description:
                  "The required formal Partner Agreement and human approval workflow must be completed before any partner activation.",
              },
            ].map((v, idx) => {
              const Icon = v.icon;
              return (
                <div
                  key={idx}
                  className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-[#60A5FA]/60 hover:bg-slate-900 transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#60A5FA] flex items-center justify-center border border-blue-500/20">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                        {v.step}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight">{v.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">{v.description}</p>
                  </div>

                  <div className="pt-4 mt-6 border-t border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mandatory Gate</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-300">
              <span className="font-bold text-white">Trust & Verification Policy:</span> Verified partners provide delivery capacity within the Thinkatic operating ecosystem. Registration does not automatically equal verified status.
            </div>
            <Link
              href="/signup?role=bpo"
              className="px-5 py-2.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
            >
              Start Partner Onboarding
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. DELIVERY CENTRES: Dashboard-Style Facility Console
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              OPERATIONAL NODES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              From Delivery Centre to Global Operations
            </h2>
            <p className="text-base text-slate-600">
              Each verified BPO centre can contribute operational capacity based on its workforce, capabilities, processes and available resources.
            </p>
          </div>

          {/* Interface-style Dashboard Illustration */}
          <div className="bg-[#F8FAFC] rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 overflow-hidden">
            {/* Console Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#214ECF] text-white flex items-center justify-center font-bold font-mono">
                  DC
                </div>
                <div>
                  <div className="text-sm font-bold text-[#0B1226]">DELIVERY CENTRE WORKSPACE</div>
                  <div className="text-xs text-slate-500 font-mono">Verified Facility Protocol · Interface Preview</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Facility Active & Verified
                </span>
              </div>
            </div>

            {/* Dashboard 11 Interface Modules Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5 pt-6">
              {[
                { label: "Company Information", category: "Legal Profile", icon: Building2 },
                { label: "Centre Information", category: "Facility Specs", icon: Globe },
                { label: "Workforce", category: "Headcount & Tier", icon: Users },
                { label: "Capacity", category: "Seat Availability", icon: Gauge },
                { label: "Projects", category: "Allocated Workflows", icon: Briefcase },
                { label: "Agents", category: "Active Rosters", icon: UserCheck },
                { label: "Attendance", category: "Biometric & Shift", icon: Clock },
                { label: "Productivity", category: "Throughput & SLAs", icon: Activity },
                { label: "Quality", category: "Audit Scores", icon: BadgeCheck },
                { label: "Compliance", category: "Security Controls", icon: ShieldCheck },
                { label: "Payouts", category: "Financial Ledger", icon: TrendingUp },
                { label: "SLA Monitoring", category: "Live Performance", icon: BarChart3 },
              ].map((mod, i) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs hover:border-[#214ECF] hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className="w-4 h-4 text-[#214ECF]" />
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{mod.category}</span>
                    </div>
                    <div className="text-xs font-bold text-[#0B1226] leading-tight">{mod.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">Audited & Managed</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Governance Note:</span> Illustrative interface model. Actual operational partner metrics and documents are protected under role-based tenant isolation.
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. CAPACITY NETWORK: Turning Capacity Into Opportunity
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              DYNAMIC CAPACITY ALIGNMENT
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Turning Capacity Into Opportunity
            </h2>
            <p className="text-base text-slate-600">
              Thinkatic provides a structured environment where verified partners can maintain their capacity information and participate in suitable project opportunities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "CAPACITY",
                badge: "Resource Dimension",
                icon: Gauge,
                description:
                  "Maintain accurate, verified information about available workstation seats, languages, shift windows, and operational bandwidth.",
              },
              {
                title: "CAPABILITY",
                badge: "Skills & Domain",
                icon: Cpu,
                description:
                  "Represent the specific business processes, tech stacks, CRM platforms, and service capabilities your centre is verified to support.",
              },
              {
                title: "OPPORTUNITY",
                badge: "Project Engagement",
                icon: Target,
                description:
                  "Participate in suitable enterprise project opportunities according to validated requirements, client standards, and verified scale.",
              },
            ].map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-7 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-200 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#214ECF] uppercase tracking-wider">
                    {c.badge}
                  </span>
                  <h3 className="text-lg font-bold text-[#0B1226] mt-1 mb-2">{c.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{c.description}</p>
                </div>
              );
            })}
          </div>

          {/* Formula banner with Governance Notice */}
          <div className="mt-8 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold text-[#0B1226]">
              <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#214ECF] border border-blue-200">CAPACITY</span>
              <span>+</span>
              <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#214ECF] border border-blue-200">CAPABILITY</span>
              <span>+</span>
              <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#214ECF] border border-blue-200">PROJECT REQUIREMENT</span>
              <span>→</span>
              <span className="px-3.5 py-1.5 rounded-lg bg-[#214ECF] text-white">DELIVERY OPPORTUNITY</span>
            </div>

            <div className="text-xs text-slate-500 max-w-md">
              <span className="font-bold text-slate-700">Governance Guardrail:</span> Capacity analysis is informational. It does not automatically award, allocate, or reserve capacity. Final decisions remain strictly subject to authorized human administration.
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. AGENT & WORKFORCE NETWORK: People Power the Network
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              HUMAN WORKFORCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              People Power the Network
            </h2>
            <p className="text-base text-slate-600">
              Technology connects the ecosystem, but trained professionals deliver the customer and operational experience.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "AGENT ONBOARDING",
                icon: UserCheck,
                description:
                  "Structured agent registration, background documentation, identity verification, and role assignments.",
              },
              {
                title: "TRAINING & READINESS",
                icon: Laptop,
                description:
                  "SOP training modules, customer journey simulations, and domain-specific knowledge verification.",
              },
              {
                title: "ATTENDANCE & SHIFTS",
                icon: Clock,
                description:
                  "Workforce shift scheduling, biometric login sync, break tracking, and reliable presence records.",
              },
              {
                title: "PRODUCTIVITY",
                icon: Activity,
                description:
                  "Real-time operational productivity visibility, active handle times, and completed case counts.",
              },
              {
                title: "QUALITY EVALUATION",
                icon: BadgeCheck,
                description:
                  "Calibrated interaction audits, supervisor feedback, scorecard history, and coaching logs.",
              },
              {
                title: "COMPLIANCE",
                icon: ShieldCheck,
                description:
                  "Operational data privacy training, NDA compliance, and security policy verification.",
              },
            ].map((w, idx) => {
              const Icon = w.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F8FAFC] hover:bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#214ECF] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#0B1226] mb-1">{w.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{w.description}</p>
                </div>
              );
            })}
          </div>

          {/* Visual hierarchy flow */}
          <div className="mt-10 p-5 rounded-2xl bg-blue-50/60 border border-blue-200/70 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-bold text-[#0B1226]">
            <span className="px-3 py-1 rounded bg-white border border-slate-200">BPO CENTRE</span>
            <span>↓</span>
            <span className="px-3 py-1 rounded bg-white border border-slate-200">SUPERVISOR</span>
            <span>↓</span>
            <span className="px-3 py-1 rounded bg-[#214ECF] text-white">AGENTS & TEAMS</span>
            <span>↓</span>
            <span className="px-3 py-1 rounded bg-white border border-slate-200">CUSTOMERS / OPERATIONS</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. TECHNOLOGY LAYER: Technology Connects the Network
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              DIGITAL BACKBONE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Technology Connects the Network
            </h2>
            <p className="text-base text-slate-600">
              Thinkatic uses technology-enabled workflows to connect business requirements, partners, projects, people and operational information.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              {
                title: "PROJECTS",
                icon: Briefcase,
                desc: "Project requirement documentation, scopes of work, milestones, and delivery workflows.",
              },
              {
                title: "CAPACITY",
                icon: Gauge,
                desc: "Capacity visibility, facility attributes, seat status, and compatibility analysis.",
              },
              {
                title: "WORKFORCE",
                icon: Users,
                desc: "Agent profiles, credential validation, shift assignments, and skills management.",
              },
              {
                title: "OPERATIONS",
                icon: Activity,
                desc: "Attendance tracking, productivity monitors, quality audits, and compliance records.",
              },
              {
                title: "FINANCIALS",
                icon: TrendingUp,
                desc: "Verified payouts, billing statements, balance tracking, and dispute resolution workflows.",
              },
            ].map((t, idx) => {
              const Icon = t.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-200/60">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1226] tracking-tight">{t.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{t.desc}</p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-100 text-[10px] font-mono text-[#214ECF] uppercase font-bold">
                    Connected Layer
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          10. PROJECT MARKETPLACE CONNECTION & GLOBAL DELIVERY FLOW
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              END-TO-END FLOW
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              From Business Demand to Delivery Opportunity
            </h2>
            <p className="text-base text-slate-600">
              Thinkatic creates a structured connection between business requirements and delivery capabilities.
            </p>
          </div>

          {/* Premium visual flow ribbon */}
          <div className="bg-[#F8FAFC] rounded-3xl p-6 sm:p-10 border border-slate-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-2 items-center text-center">
              {[
                { label: "CLIENT REQUIREMENT", sub: "Defined Need" },
                { label: "THINKATIC", sub: "Solution Hub" },
                { label: "PROJECT", sub: "Formal SOW" },
                { label: "VERIFIED BPO PARTNER", sub: "Vetted Centre" },
                { label: "DELIVERY CENTRE", sub: "Physical Plant" },
                { label: "AGENTS & TEAMS", sub: "Trained Staff" },
                { label: "CUSTOMER / OPERATION", sub: "Live Execution" },
                { label: "REPORTING", sub: "Transparent SLAs" },
              ].map((step, idx) => (
                <div key={idx} className="relative">
                  <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs">
                    <span className="text-[10px] font-mono text-[#214ECF] font-bold block">0{idx + 1}</span>
                    <span className="text-xs font-bold text-[#0B1226] block leading-tight mt-1">
                      {step.label}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">{step.sub}</span>
                  </div>
                  {idx < 7 && (
                    <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-300 font-bold">
                      →
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-600 text-center sm:text-left">
                Want to learn how global delivery operates across international time zones and India delivery hubs?
              </p>
              <Link
                href="/global-delivery"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#214ECF] text-white font-semibold text-xs hover:bg-[#1a3fa8] transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Explore Global Delivery</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          11. QUALITY & PERFORMANCE: 7 Measurable Dimensions
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              OPERATIONAL BENCHMARKS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              A Network Built Around Measurable Operations
            </h2>
            <p className="text-base text-slate-600">
              Strong delivery networks require visibility into operational performance across all operational categories.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {QUALITY_CATEGORIES.map((q, idx) => {
              const Icon = q.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-200">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                        {q.metric}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#0B1226] tracking-tight">{q.name}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{q.desc}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] font-mono text-[#214ECF] font-semibold flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Audited Parameter</span>
                  </div>
                </div>
              );
            })}

            {/* Final Summary Card */}
            <div
              className="text-white rounded-2xl p-6 flex flex-col justify-between border border-slate-800 shadow-md"
              style={{ background: "linear-gradient(135deg, #0B1226 0%, #1E293B 100%)" }}
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-[#60A5FA] font-bold uppercase tracking-wider">
                  CONTINUOUS IMPROVEMENT
                </span>
                <h3 className="text-base font-bold text-white">Objective Standards</h3>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Standardized scorecards and audit logs guarantee uniform operational quality across all participating delivery facilities.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-800 text-xs font-semibold text-slate-200">
                Clear metrics. <br />
                Transparent performance. <br />
                Continuous improvement.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          12. NETWORK GOVERNANCE: Built With Structured Governance
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1226] text-white border-b border-slate-800">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#60A5FA] tracking-widest uppercase font-mono">
              OVERSIGHT & INTEGRITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built With Structured Governance
            </h2>
            <p className="text-base text-slate-300">
              Technology provides visibility, but responsible human governance ensures accountability, security, and quality across every engagement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              {
                title: "VERIFICATION",
                icon: ShieldCheck,
                desc: "Delivery partners complete required multi-point verification steps before receiving ecosystem status.",
              },
              {
                title: "AUTHORIZATION",
                icon: Lock,
                desc: "Access and actions are strictly controlled according to validated role and tenant permissions.",
              },
              {
                title: "TRANSPARENCY",
                icon: Eye,
                desc: "Operational activities can be tracked through immutable records, attendance logs, and reporting.",
              },
              {
                title: "HUMAN OVERSIGHT",
                icon: Scale,
                desc: "Important partner onboarding, project award, and financial payout decisions remain subject to authorized human control.",
              },
              {
                title: "AUDITABILITY",
                icon: FileCheck2,
                desc: "Relevant platform actions, configuration modifications, and operational changes are recorded for accountability.",
              },
            ].map((g, idx) => {
              const Icon = g.icon;
              return (
                <div
                  key={idx}
                  className="bg-slate-900/80 rounded-2xl p-6 border border-slate-800 hover:border-[#60A5FA] transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#60A5FA] flex items-center justify-center border border-blue-500/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-tight">{g.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">{g.desc}</p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-800/80 text-[10px] font-mono text-emerald-400">
                    Mandatory Standard
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          13. NETWORK SECURITY: Controlled Access Across the Ecosystem
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              DATA PRIVACY & PROTECTION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Security Across the Ecosystem
            </h2>
            <p className="text-base text-slate-600">
              Thinkatic's platform is designed around controlled access and strict separation between clients, partners, agents and administrators.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              {
                title: "ROLE-BASED ACCESS",
                icon: Shield,
                desc: "Users access platform functionality and data strictly according to their designated operational role.",
              },
              {
                title: "TENANT ISOLATION",
                icon: Layers,
                desc: "Client proprietary data and partner confidential records remain completely separated across instances.",
              },
              {
                title: "SECURE DOCUMENTS",
                icon: FileCheck2,
                desc: "Private operational contracts, KYC files, and audit records are never publicly indexed or exposed.",
              },
              {
                title: "CONTROLLED DATA",
                icon: Lock,
                desc: "Sensitive operational and financial information is available only to authenticated, authorized users.",
              },
              {
                title: "AUDIT LOGGING",
                icon: Activity,
                desc: "Critical platform transactions, user activities, and data modifications are logged for traceability.",
              },
            ].map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-[#214ECF] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1226] tracking-tight">{s.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{s.desc}</p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-200 text-[10px] font-mono text-slate-400">
                    Enterprise Protected
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          14. NETWORK GROWTH: Built to Grow With Business Demand
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              ELASTIC EXPANSION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Built to Grow With Business Demand
            </h2>
            <p className="text-base text-slate-600">
              As business requirements evolve, the network can expand through additional verified delivery capabilities and operational capacity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "PHASE 01",
                title: "MORE CLIENT DEMAND",
                desc: "Enterprises identify new workflows, volume surges, or international support requirements.",
              },
              {
                step: "PHASE 02",
                title: "MORE DELIVERY OPPORTUNITIES",
                desc: "Thinkatic structures matching project specifications and opens participation for suitable centres.",
              },
              {
                step: "PHASE 03",
                title: "MORE VERIFIED CAPACITY",
                desc: "Vetted BPO centres dedicate qualified agents and physical workstations to support the scope.",
              },
              {
                step: "PHASE 04",
                title: "SCALABLE OPERATIONS",
                desc: "Delivery scales smoothly without requiring clients to construct internal overseas operations.",
              },
            ].map((p, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:border-[#214ECF] hover:shadow-md transition-all"
              >
                <span className="text-xs font-mono font-bold text-[#214ECF]">{p.step}</span>
                <h3 className="text-sm font-bold text-[#0B1226] mt-2 mb-2 tracking-tight">{p.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          15. WHO IS PART OF THE NETWORK? 5 Ecosystem Roles
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              COLLABORATING PARTIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              A Network Built Around Different Roles
            </h2>
            <p className="text-base text-slate-600">
              Clear accountabilities and dedicated permissions make the entire delivery ecosystem trustworthy and synchronized.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              {
                role: "CLIENT",
                icon: Building2,
                desc: "Defines business requirements, approves operational SOPs, and receives authorized live reporting.",
              },
              {
                role: "THINKATIC",
                icon: Network,
                desc: "Coordinates the platform, operating model, verification protocols, and customer relationship.",
              },
              {
                role: "BPO PARTNER",
                icon: Users,
                desc: "Provides verified delivery capability, physical workstations, local supervisors, and operational capacity.",
              },
              {
                role: "AGENT",
                icon: UserCheck,
                desc: "Executes assigned customer communications or back-office processes under documented SOP standards.",
              },
              {
                role: "ADMIN / OPERATIONS",
                icon: ShieldCheck,
                desc: "Provides governance, verification auditing, authorized project allocations, and platform oversight.",
              },
            ].map((r, idx) => {
              const Icon = r.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F8FAFC] rounded-2xl p-6 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1226] tracking-tight">{r.role}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed font-normal">{r.desc}</p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-200 text-[10px] font-mono text-[#214ECF] font-bold">
                    Defined Scope
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          16. NETWORK JOURNEY: 8-Phase Animated Timeline
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              COLLABORATION HORIZON
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              From Connection to Long-Term Delivery
            </h2>
            <p className="text-base text-slate-600">
              The lifecycle of an engagement moves methodically from initial requirement discovery to sustained, scalable execution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {JOURNEY_STEPS.map((step, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:border-[#214ECF] hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded">
                      STEP 0{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Phase {idx + 1}</span>
                  </div>
                  <h3 className="text-base font-bold text-[#0B1226] mb-2">{step.stage}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{step.label}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center text-[10px] font-mono font-semibold text-slate-400">
                  <span>Structured Milestone</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          17. WHY THE NETWORK MODEL MATTERS: 4 Core Advantages
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-white border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              STRATEGIC ADVANTAGES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Why a Connected Network Matters
            </h2>
            <p className="text-base text-slate-600">
              The network model eliminates isolated operational silos and replaces them with unified, measurable capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "FLEXIBILITY",
                icon: Zap,
                description:
                  "Businesses can access specialized delivery capabilities and technical skills without constructing every operational function internally.",
              },
              {
                title: "CAPACITY",
                icon: Gauge,
                description:
                  "Verified BPO partners can contribute audited operational capacity to suitable enterprise requirements and grow their business sustainably.",
              },
              {
                title: "VISIBILITY",
                icon: Eye,
                description:
                  "Projects, frontline workforce attendance, and operational information are tracked through structured, transparent digital workflows.",
              },
              {
                title: "SCALABILITY",
                icon: TrendingUp,
                description:
                  "Delivery capabilities can expand across multiple verified centres and time zones seamlessly as business volume increases.",
              },
            ].map((adv, idx) => {
              const Icon = adv.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#F8FAFC] rounded-2xl p-7 border border-slate-200/80 hover:border-[#214ECF] hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-200 mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#0B1226] mb-2 tracking-tight">{adv.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">{adv.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          18. JOIN THE NETWORK: Dual-Path Pathways
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase font-mono">
              GET INVOLVED
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Join the Thinkatic Network
            </h2>
            <p className="text-base text-slate-600">
              Select your pathway to connect with our global delivery ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: For Businesses */}
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center border border-blue-200">
                  <Building2 className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-bold text-[#214ECF] uppercase tracking-wider block">
                  FOR ENTERPRISES & BUSINESSES
                </span>
                <h3 className="text-2xl font-extrabold text-[#0B1226]">
                  Need customer support, BPO, or technology-enabled operations?
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Engage with Thinkatic to design a customized operating model supported by verified delivery centres, trained specialists, and continuous quality oversight.
                </p>
              </div>

              <div className="pt-8 mt-8 border-t border-slate-100">
                <Link
                  href="/contact"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#214ECF] text-white font-semibold text-sm hover:bg-[#1a3fa8] transition-colors cursor-pointer"
                >
                  <span>Talk to Thinkatic</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: For BPO Centres */}
            <div
              className="text-white rounded-3xl p-8 sm:p-10 border border-slate-800 shadow-md flex flex-col justify-between hover:border-[#60A5FA]/60 transition-colors"
              style={{ background: "linear-gradient(135deg, #0B1226 0%, #1E293B 100%)" }}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-[#60A5FA] flex items-center justify-center border border-blue-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-bold text-[#60A5FA] uppercase tracking-wider block">
                  FOR BPO CENTRES & FACILITIES
                </span>
                <h3 className="text-2xl font-extrabold text-white">
                  Want to become part of the Thinkatic delivery network?
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Complete our transparent onboarding and facility verification to provide audited operational capacity for global enterprise projects.
                </p>
              </div>

              <div className="pt-8 mt-8 border-t border-slate-800">
                <Link
                  href="/signup?role=bpo"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#214ECF] text-white font-semibold text-sm hover:bg-[#1a3fa8] transition-colors cursor-pointer"
                >
                  <span>Become a BPO Partner</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          19. FINAL CTA: Full-Width High-Impact Navy Section
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1226] text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#60A5FA 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <span className="text-xs font-bold text-[#60A5FA] tracking-widest uppercase font-mono">
              START TODAY
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Build Your Place in the Thinkatic Network
            </h2>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Whether you're a business looking for delivery capability or a BPO centre looking to participate in a structured global delivery ecosystem, Thinkatic connects the right capabilities around real business requirements.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#214ECF] hover:bg-[#1a3fa8] text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
              >
                Talk to Thinkatic
              </Link>
              <Link
                href="/signup?role=bpo"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-semibold text-sm transition-colors cursor-pointer"
              >
                Become a BPO Partner
              </Link>
            </div>

            <div className="pt-10 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-mono">
              <span>Verified Delivery Hubs</span>
              <span>·</span>
              <span>Authorized Human Governance</span>
              <span>·</span>
              <span>Transparent Reporting</span>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
