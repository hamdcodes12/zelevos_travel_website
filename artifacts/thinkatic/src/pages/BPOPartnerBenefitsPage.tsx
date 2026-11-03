import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO } from "@/hooks/useSEO";
import {
  ShieldCheck,
  Building2,
  Users,
  Briefcase,
  Globe,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  DollarSign,
  FileText,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  Eye,
  FileCheck,
  Video,
  Award,
  Clock,
  MessageSquare,
  Bell,
  HeadphonesIcon,
  Check,
  CreditCard,
  Target,
  Workflow,
  Cpu,
  Shield,
  HelpCircle,
  FileSpreadsheet,
  AlertCircle,
  UserCheck,
  Radio,
} from "lucide-react";

// ── Motion Animation Variants ──────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// ── Trust Strip Capabilities (No fake numbers) ────────────────────────────────
const TRUST_CAPABILITIES = [
  { label: "VERIFIED PARTNER NETWORK", desc: "Rigorous onboarding & live verification" },
  { label: "GLOBAL PROJECT OPPORTUNITIES", desc: "Access to international business requirements" },
  { label: "STRUCTURED OPERATIONS", desc: "Standardized workflows & quality frameworks" },
  { label: "TRANSPARENT PAYOUTS", desc: "Detailed remittance statements & dispute tracking" },
  { label: "PARTNER GROWTH", desc: "Scalable capacity & multi-project opportunities" },
];

// ── Why Partner With Thinkatic: 9 Cards ───────────────────────────────────────
const WHY_PARTNER_CARDS = [
  {
    icon: Globe,
    title: "GLOBAL BUSINESS ACCESS",
    description:
      "Connect your centre with business opportunities from clients looking for structured delivery capabilities across global markets.",
  },
  {
    icon: Briefcase,
    title: "PROJECT OPPORTUNITIES",
    description:
      "Discover available projects through the Thinkatic Project Marketplace aligned with your team's operational strengths.",
  },
  {
    icon: ShieldCheck,
    title: "VERIFIED PARTNER POSITIONING",
    description:
      "Complete Thinkatic's verification and onboarding process to establish your centre as an officially verified delivery partner.",
  },
  {
    icon: Layers,
    title: "CAPACITY UTILISATION",
    description:
      "Show available delivery capacity and participate in projects specifically aligned with your centre's operational capabilities.",
  },
  {
    icon: Building2,
    title: "CENTRE MANAGEMENT",
    description:
      "Manage your centre information, workforce, capacity, documents, projects, and operational activities through the Partner Portal.",
  },
  {
    icon: Eye,
    title: "PROJECT VISIBILITY",
    description:
      "Access project requirements, applications, allocations, assignments, and operational information directly through the platform.",
  },
  {
    icon: DollarSign,
    title: "PAYOUT VISIBILITY",
    description:
      "Track partner earnings, payout statements, payment status, withdrawals, and disputes through the unified Partner Portal.",
  },
  {
    icon: Activity,
    title: "PERFORMANCE MANAGEMENT",
    description:
      "Use operational reporting, productivity, attendance, quality, and compliance information to manage delivery consistently.",
  },
  {
    icon: TrendingUp,
    title: "LONG-TERM GROWTH",
    description:
      "Build a stronger delivery operation and expand capacity as your business grows alongside our expanding client network.",
  },
];

// ── What Thinkatic Provides: 10 Operational Modules ────────────────────────────
const PORTAL_MODULES = [
  {
    id: "marketplace",
    name: "PROJECT MARKETPLACE",
    icon: Briefcase,
    summary: "Discover available projects and submit applications.",
    detail: "Explore process types, shifts, geography requirements, capacity criteria, and payout rates to submit targeted centre applications.",
  },
  {
    id: "centre",
    name: "CENTRE MANAGEMENT",
    icon: Building2,
    summary: "Maintain centre information and verification status.",
    detail: "Keep physical office addresses, floor layouts, shift schedules, and operational infrastructure verified and compliant.",
  },
  {
    id: "agents",
    name: "AGENT MANAGEMENT",
    icon: Users,
    summary: "Manage agents, onboarding, training, attendance and workforce information.",
    detail: "Assign agents to approved projects, monitor role onboarding, and oversee personnel profiles in one unified ledger.",
  },
  {
    id: "capacity",
    name: "CAPACITY MARKETPLACE",
    icon: Layers,
    summary: "Show available capacity and participate in compatible opportunities.",
    detail: "Signal active workstation availability, voice and non-voice seats, and operational language skills for client consideration.",
  },
  {
    id: "documents",
    name: "DOCUMENT MANAGEMENT",
    icon: FileText,
    summary: "Manage required business, compliance and operational documents.",
    detail: "Store, upload, and update incorporation certificates, KYC records, tax registrations, and security audit verifications.",
  },
  {
    id: "meetings",
    name: "MEETINGS",
    icon: Video,
    summary: "View and participate in authorised Thinkatic meetings.",
    detail: "Join scheduled kickoff sessions, operational reviews, and administrative alignment briefings with Thinkatic coordinators.",
  },
  {
    id: "productivity",
    name: "PRODUCTIVITY",
    icon: Activity,
    summary: "Track workforce productivity and operational performance.",
    detail: "Monitor shift throughput, task completion rates, handling time distributions, and team efficiency benchmarks.",
  },
  {
    id: "quality",
    name: "QUALITY & COMPLIANCE",
    icon: Award,
    summary: "Manage quality and compliance information.",
    detail: "Track quality monitoring scores, process compliance logs, customer experience standards, and corrective action workflows.",
  },
  {
    id: "payouts",
    name: "PAYOUTS",
    icon: CreditCard,
    summary: "Track earnings, payout statements, withdrawals and payment status.",
    detail: "Review structured disbursement timelines, download detailed line-item remittance statements, and file payout queries.",
  },
  {
    id: "reports",
    name: "REPORTS",
    icon: BarChart3,
    summary: "Access relevant operational and performance reporting.",
    detail: "Generate automated reports for client deliveries, agent attendance summaries, and month-over-month capacity metrics.",
  },
];

// ── How the Partnership Works: 7 Steps ─────────────────────────────────────────
const PARTNERSHIP_STEPS = [
  {
    step: "01",
    tag: "REGISTER",
    title: "Register Your Centre",
    description: "Submit your BPO centre, registered legal entity, and business contact information through our structured portal.",
  },
  {
    step: "02",
    tag: "VERIFY",
    title: "Business Verification",
    description: "Provide required company registration, centre information, KYC details, operational credentials, and supporting documents.",
  },
  {
    step: "03",
    tag: "CENTRE VERIFICATION",
    title: "Live Centre Audit",
    description: "Submit physical office information, workstation photographs, and required live office verification evidence.",
  },
  {
    step: "04",
    tag: "AGREEMENT",
    title: "Partner Agreement",
    description: "Review the Thinkatic Global Delivery Partner Agreement, complete the formal signing process, and submit the executed copy.",
  },
  {
    step: "05",
    tag: "ACTIVATE",
    title: "Partner Activation",
    description: "After required verification and approval steps are concluded, your verified partner access is officially unlocked.",
  },
  {
    step: "06",
    tag: "DISCOVER PROJECTS",
    title: "Explore Marketplace",
    description: "Explore available project opportunities through the Project Marketplace aligned with your workforce strengths.",
  },
  {
    step: "07",
    tag: "DELIVER & GROW",
    title: "Deliver & Scale",
    description: "Execute assigned projects, manage your workforce, maintain defined performance standards, and expand capacity.",
  },
];

// ── What You Need To Become a Partner: 7 Checklist Items ───────────────────────
const APPLICATION_CHECKLIST = [
  {
    title: "BUSINESS INFORMATION",
    desc: "Registered company name, incorporation details, tax identifiers, and authorised corporate representative contact.",
  },
  {
    title: "CENTRE INFORMATION",
    desc: "Physical office/centre address, workstation capacity, network infrastructure, and primary operating hours.",
  },
  {
    title: "OFFICE VERIFICATION",
    desc: "Office photographs, facility walkthrough imagery, and live timestamped office verification evidence.",
  },
  {
    title: "KYC DOCUMENTS",
    desc: "Authorised director identification, corporate registration certificates, and verified operational proof documents.",
  },
  {
    title: "BANK DETAILS",
    desc: "Official corporate bank account information for electronic disbursement and verified payout processing.",
  },
  {
    title: "CAPACITY INFORMATION",
    desc: "Active workforce counts, language proficiencies, shift coverage capabilities, and operational domain expertise.",
  },
  {
    title: "AGREEMENT",
    desc: "Thorough review and electronic execution of the formal Thinkatic Global Delivery Partner Agreement.",
  },
];

// ── 9-Stage Partner Journey ────────────────────────────────────────────────────
const PARTNER_JOURNEY_STAGES = [
  { stage: "01", name: "APPLICATION", text: "Submit your centre details and required operational information." },
  { stage: "02", name: "VERIFICATION", text: "Complete business, centre facility, and supporting KYC checks." },
  { stage: "03", name: "PARTNER APPROVAL", text: "Receive official verified status once diligence checks conclude." },
  { stage: "04", name: "PROJECT DISCOVERY", text: "Explore available project opportunities on the marketplace." },
  { stage: "05", name: "PROJECT ALLOCATION", text: "Participate in structured allocation for suitable engagements." },
  { stage: "06", name: "DELIVERY", text: "Manage assigned workflows through your centre and dedicated workforce." },
  { stage: "07", name: "PERFORMANCE", text: "Monitor attendance, productivity, quality metrics, and SLA compliance." },
  { stage: "08", name: "PAYOUT", text: "Track transparent earnings, remittance statements, and withdrawal requests." },
  { stage: "09", name: "GROWTH", text: "Expand delivery capacity and participate in additional enterprise opportunities." },
];

export default function BPOPartnerBenefitsPage() {
  useSEO({
    title: "Thinkatic | BPO Partner Benefits & Global Delivery Partnership",
    description:
      "Partner with Thinkatic as a verified BPO delivery centre and access structured project opportunities, operational tools, capacity management, performance visibility and payout management.",
    path: "/bpo-partner-benefits",
  });

  const [activeModule, setActiveModule] = useState(PORTAL_MODULES[0]);

  return (
    <Layout>
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HERO SECTION: Grow Your BPO Business With Thinkatic
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 bg-white overflow-hidden border-b border-slate-100">
        {/* Soft background ambient gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[560px] bg-gradient-to-b from-blue-50/80 via-blue-50/20 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Heading & CTAs */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="lg:col-span-6 space-y-6"
            >
              {/* Eyebrow */}
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#214ECF] text-xs font-semibold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-[#214ECF] animate-pulse" />
                BPO PARTNER PROGRAM
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#0B1226] tracking-tight leading-[1.12]"
              >
                Grow Your BPO Business With Thinkatic
              </motion.h1>

              {/* Paragraphs */}
              <motion.p variants={fadeUp} className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                Join a structured global delivery network designed to connect verified BPO centres with business opportunities, operational workflows, and long-term growth opportunities.
              </motion.p>

              <motion.p variants={fadeUp} className="text-sm sm:text-base text-slate-500 leading-relaxed font-normal">
                Thinkatic works with verified BPO partners to build reliable delivery capacity for customer support, business operations, and technology-enabled services across global markets.
              </motion.p>

              {/* Dual CTAs */}
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 pt-3">
                <Link
                  href="/signup?role=bpo"
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#214ECF] text-white font-semibold text-sm sm:text-base hover:bg-[#1B40AB] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                >
                  Become a BPO Partner
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-200 text-[#0B1226] font-semibold text-sm sm:text-base hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 cursor-pointer"
                >
                  Talk to Thinkatic
                </Link>
              </motion.div>
            </motion.div>

            {/* Right Column: Hero Visual Concept Flow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease }}
              className="lg:col-span-6 relative"
            >
              <div className="relative mx-auto max-w-lg lg:max-w-none bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800 text-white overflow-hidden">
                {/* Background circuit glow */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-[#214ECF]/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs font-mono font-medium text-slate-300">THINKATIC DELIVERY ENGINE</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#214ECF] bg-[#214ECF]/10 border border-[#214ECF]/30 px-2 py-0.5 rounded">
                      VERIFIED PARTNERSHIP
                    </span>
                  </div>

                  {/* Connected visual path */}
                  <div className="space-y-2.5 font-mono text-xs">
                    {/* Step 1 */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                          01
                        </div>
                        <div>
                          <div className="text-white font-semibold text-xs tracking-wider">YOUR BPO CENTRE</div>
                          <div className="text-[11px] text-slate-400">Workforce & Operational Capacity</div>
                        </div>
                      </div>
                      <span className="text-emerald-400 text-[10px] font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        VERIFIED
                      </span>
                    </div>

                    <div className="flex justify-center text-slate-600 text-xs">↓</div>

                    {/* Step 2 */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#214ECF]/20 border border-[#214ECF]/40 hover:border-[#214ECF] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-[#214ECF] text-white flex items-center justify-center font-bold text-xs">
                          02
                        </div>
                        <div>
                          <div className="text-white font-semibold text-xs tracking-wider">THINKATIC PLATFORM</div>
                          <div className="text-[11px] text-blue-200">Governance, Technology & Routing</div>
                        </div>
                      </div>
                      <span className="text-blue-300 text-[10px] font-mono">ECOSYSTEM</span>
                    </div>

                    <div className="flex justify-center text-slate-600 text-xs">↓</div>

                    {/* Step 3 */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 hover:border-blue-500/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                          03
                        </div>
                        <div>
                          <div className="text-white font-semibold text-xs tracking-wider">GLOBAL CLIENTS & PROJECTS</div>
                          <div className="text-[11px] text-slate-400">US, UK & International Business Needs</div>
                        </div>
                      </div>
                      <span className="text-cyan-400 text-[10px] font-mono">MARKETS</span>
                    </div>

                    <div className="flex justify-center text-slate-600 text-xs">↓</div>

                    {/* Step 4 */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-center">
                        <div className="text-[10px] text-slate-400 uppercase">MEASURED DELIVERY</div>
                        <div className="text-xs font-bold text-white mt-0.5">SLA & Quality Rigor</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-center">
                        <div className="text-[10px] text-slate-400 uppercase">TRANSPARENT VALUE</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">Reliable Payouts</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. HERO TRUST STRIP: 5 Horizontal Capabilities (No fake numbers)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 border-b border-slate-800 py-6 text-white overflow-x-auto">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8 items-center text-center sm:text-left">
            {TRUST_CAPABILITIES.map((cap, i) => (
              <div key={i} className="flex flex-col space-y-1">
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <CheckCircle2 className="w-4 h-4 text-[#214ECF] flex-shrink-0" />
                  <span className="text-xs font-bold tracking-wider uppercase text-slate-100 font-mono">
                    {cap.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. INTRODUCTION: More Than a BPO Vendor
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <span className="inline-block text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              NETWORK FOUNDATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              More Than a BPO Vendor. <br className="hidden sm:inline" />
              Become Part of the Thinkatic Delivery Network.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Thinkatic is building a structured ecosystem connecting businesses with verified BPO delivery centres. As a Thinkatic BPO Partner, your centre can participate in a structured operating environment where projects, capacity, agents, documents, performance, and payouts can be managed through one connected platform.
            </p>

            <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-100 text-left sm:text-center mt-8">
              <p className="text-base sm:text-lg font-medium text-[#0B1226] leading-relaxed">
                <span className="font-semibold text-[#214ECF]">Your centre</span> brings the people and operational capability.{" "}
                <br className="hidden sm:inline" />
                <span className="font-semibold text-[#214ECF]">Thinkatic</span> brings the platform, project opportunities, structure, and global business connection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. WHY PARTNER WITH THINKATIC: 3x3 Card Grid (Light Blue)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F0F5FF]/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-16 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              PARTNER ADVANTAGE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Why Partner With Thinkatic?
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              A structured operating framework engineered to elevate verified delivery centres into trusted enterprise vendors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {WHY_PARTNER_CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="group relative bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                >
                  {/* Left accent bar on hover */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#214ECF] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white transition-colors duration-300 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6" />
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#0B1226] tracking-tight group-hover:text-[#214ECF] transition-colors">
                      {card.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed font-normal">
                      {card.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-[#214ECF] gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Explore Capability</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. WHAT THINKATIC PROVIDES: Dashboard Console View (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              OPERATIONAL INFRASTRUCTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              We Give Your Centre the Infrastructure to Operate
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Access the actual digital tooling, workflow management, and operational systems built into the Thinkatic Partner Portal.
            </p>
          </div>

          {/* Interactive Console Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: 10 Capability Module Tabs */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {PORTAL_MODULES.map((mod) => {
                const Icon = mod.icon;
                const isSelected = activeModule.id === mod.id;
                return (
                  <button
                    key={mod.id}
                    onClick={() => setActiveModule(mod)}
                    className={`text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex items-start gap-3.5 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/80 border-[#214ECF] shadow-xs"
                        : "bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? "bg-[#214ECF] text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`text-xs sm:text-sm font-bold tracking-tight ${isSelected ? "text-[#214ECF]" : "text-[#0B1226]"}`}>
                        {mod.name}
                      </div>
                      <div className="text-[12px] text-slate-500 line-clamp-1 mt-0.5">
                        {mod.summary}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Active Module Focus Panel */}
            <div className="lg:col-span-7 sticky top-28">
              <div className="bg-slate-900 rounded-2xl p-6 sm:p-8 text-white border border-slate-800 shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#214ECF] text-white flex items-center justify-center">
                      <activeModule.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-mono text-[#214ECF] uppercase">PORTAL MODULE</span>
                      <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight">{activeModule.name}</h4>
                    </div>
                  </div>
                  <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
                    LIVE WORKSPACE
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">PURPOSE & CAPABILITY</h5>
                    <p className="text-sm sm:text-base text-slate-200 mt-1 leading-relaxed">
                      {activeModule.summary}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                    <h5 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">OPERATIONAL DETAIL</h5>
                    <p className="text-sm text-slate-300 leading-relaxed font-mono text-[13px]">
                      {activeModule.detail}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <div className="text-[11px] text-slate-400 uppercase">ACCESS PERMISSION</div>
                      <div className="text-xs font-semibold text-emerald-400 mt-0.5">Verified BPO Partner</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <div className="text-[11px] text-slate-400 uppercase">SYNCHRONIZATION</div>
                      <div className="text-xs font-semibold text-cyan-400 mt-0.5">Real-time Unified Ledger</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Included in the Thinkatic Partner Operating Suite</span>
                  <Link
                    href="/signup?role=bpo"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#214ECF] px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    <span>Apply for Access</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. HOW THE PARTNERSHIP WORKS: 7-Step Animated Timeline
      ────────────────────────────────────────────────────────────────────────────── */}
      <section id="partnership-process" className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-16 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              STRUCTURED ONBOARDING
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              How the Thinkatic BPO Partnership Works
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              A transparent 7-step process from initial registration to executing international projects and scaling capacity.
            </p>
          </div>

          {/* Timeline flow: Register → Verify → Centre Verified → Agreement → Approved → Projects → Delivery */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 lg:gap-3">
            {PARTNERSHIP_STEPS.map((item, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded">
                      {item.step}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#0B1226] mb-1.5 tracking-tight">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                  <span>Stage {idx + 1} of 7</span>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Process sequence bar */}
          <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-slate-600">
            <span className="text-[#214ECF] font-bold">REGISTER</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">VERIFY</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">CENTRE VERIFIED</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">AGREEMENT</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">APPROVED</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">PROJECTS</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">DELIVERY</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. WHAT YOU NEED TO BECOME A PARTNER: Checklist (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
                APPLICATION REQUIREMENTS
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
                Ready to Become a Thinkatic BPO Partner?
              </h2>
              <p className="text-base text-slate-600 leading-relaxed font-normal">
                Build your application with the information required for verification. Our diligence ensures a trusted, enterprise-grade delivery network for all participants.
              </p>

              <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 leading-relaxed space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  DATA PRIVACY GUARANTEE
                </div>
                <p>
                  All submitted business documents, facility records, and banking coordinates are encrypted and audited through confidential administrative workflows.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/signup?role=bpo"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#214ECF] text-white font-semibold text-sm hover:bg-[#1B40AB] transition-colors shadow-md cursor-pointer"
                >
                  Start Your Partner Application
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Checklist Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {APPLICATION_CHECKLIST.map((item, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-md transition-all space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-[#214ECF] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <h3 className="text-xs font-bold text-[#0B1226] tracking-wider uppercase font-mono">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pl-8">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. PARTNER JOURNEY: 9-Stage Journey Map (Deep Navy #0B1226)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1226] text-white border-b border-slate-800">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-16 space-y-3">
            <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">
              LIFECYCLE ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Your Journey With Thinkatic
            </h2>
            <p className="text-base sm:text-lg text-slate-300">
              From onboarding diligence to high-performance delivery and reliable financial settlement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PARTNER_JOURNEY_STAGES.map((st, idx) => (
              <div
                key={idx}
                className="p-6 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-[#214ECF] transition-all space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                    STAGE {st.stage}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">FLOW</span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight group-hover:text-blue-400 transition-colors">
                  {st.name}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  {st.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. PROJECT MARKETPLACE (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              OPPORTUNITY DISCOVERY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Access Project Opportunities
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Thinkatic's Project Marketplace provides verified BPO partners with visibility into available business opportunities that may match their centre's capabilities and capacity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">PROJECT DISCOVERY</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Explore available projects and business requirements submitted by verified international clients.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">PROJECT REQUIREMENTS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review process type, shift, geography, capacity requirements, payout information and relevant specifications.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <FileCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">APPLICATION</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Submit your centre's formal application detailing available capacity and team readiness for suitable opportunities.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <Workflow className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">ALLOCATION</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Approved project allocations are structured and governed through the Thinkatic operating workflow.
              </p>
            </div>
          </div>

          <div className="mt-10 p-6 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#0B1226]">Verified Access Only</div>
              <div className="text-xs text-slate-600">The live marketplace is authenticated to ensure enterprise security and verified capacity integrity.</div>
            </div>
            <Link
              href="/signup?role=bpo"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#214ECF] text-white font-semibold text-xs sm:text-sm hover:bg-[#1B40AB] transition-colors cursor-pointer flex-shrink-0"
            >
              Explore Partner Opportunities
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          10. CAPACITY MANAGEMENT (Light Blue #F0F5FF)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F0F5FF]/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              WORKFORCE UTILISATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Turn Available Capacity Into Opportunity
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Your centre's available capacity can become part of a structured delivery network.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#0B1226]">AVAILABLE CAPACITY</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Maintain accurate records about active seats, shift availability, and operational bandwidth within your portal.
              </p>
            </div>

            <div className="bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#0B1226]">CAPABILITY MATCHING</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Participate in business opportunities specifically aligned with your centre's supported capabilities and operational domain.
              </p>
            </div>

            <div className="bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#0B1226]">SCALABLE DELIVERY</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Increase delivery capacity and onboard additional agents as your business and project requirements grow.
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">Governance Note:</span> Thinkatic's capacity analysis is informational and aids in matching suitable delivery partners. All project allocations remain governed by mutual agreement, administrative oversight, and client specification.
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          11. WORKFORCE MANAGEMENT (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              TEAM ADMINISTRATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Manage Your Delivery Workforce
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Thinkatic provides partner-side tools to help centres manage workforce information and operational activity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">AGENTS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Maintain agent profiles, role designations, project assignments, and platform activation credentials.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">TRAINING</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track relevant process training, product documentation mastery, and certification status across your team.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">ATTENDANCE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Manage workforce attendance sessions, shift schedules, historical logs, and coverage continuity.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">PRODUCTIVITY</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Monitor operational productivity, throughput metrics, and SLA benchmark adherence in real time.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">QUALITY</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track relevant quality scores, QA audit reviews, and customer resolution metrics across active workflows.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">COMPLIANCE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Maintain operational compliance, security standard guidelines, and data confidentiality certifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          12. EARNINGS & PAYOUTS: 5 Premium Cards (Light Blue #F8FAFC)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              FINANCIAL GOVERNANCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Clear Visibility Into Your Earnings
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Thinkatic provides partner-side visibility into approved earnings, payout statements, payment status, withdrawals and disputes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1226]">EARNINGS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Track partner earnings and project-related financial information transparently on your dashboard.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1226]">PAYOUT STATEMENTS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review remittance statements, billable cycles, and downloadable settlement documentation.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1226]">PAYMENT STATUS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                See whether payouts are pending, processing, approved or paid in an audited chronological log.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <ArrowRight className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1226]">WITHDRAWALS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Submit and track authorised withdrawal requests directly to your verified corporate bank account.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#0B1226]">DISPUTES</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Raise and track payout-related queries and adjustments systematically through the platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          13. PARTNER PORTAL: One Connected Workspace (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              ALL-IN-ONE OPERATING SUITE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              One Partner Portal. Your Operations in One Place.
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Manage your Thinkatic partnership through one connected operational workspace.
            </p>
          </div>

          {/* Interactive Portal Visual Feature Grid */}
          <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white border border-slate-800 shadow-2xl space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
              {[
                "Dashboard",
                "Projects",
                "Centres",
                "Capacity",
                "Agents",
                "Attendance",
                "Documents",
                "Office Verification",
                "Legal & Agreements",
                "Meetings",
                "Training",
                "Productivity",
                "Quality",
                "Compliance",
                "Payouts",
                "Reports",
                "Notifications",
                "Tickets",
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300 hover:text-white hover:border-[#214ECF] transition-colors"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400 text-center sm:text-left">
                Unified governance. Standardized operating tools for modern BPO centres.
              </div>
              <Link
                href="/signup?role=bpo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#214ECF] text-white font-semibold text-xs sm:text-sm hover:bg-blue-600 transition-colors cursor-pointer"
              >
                Become a BPO Partner
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          14. SUPPORT & COMMUNICATION (Light Blue #F0F5FF)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F0F5FF]/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              RESPONSIVE ASSISTANCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Support When You Need It
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Thinkatic provides structured communication and support channels for partner operations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <Video className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">MEETINGS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Participate in authorised business, kickoff, and operational alignment meetings.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">NOTIFICATIONS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Receive timely platform updates, verification status alerts, and operational advisories.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <HeadphonesIcon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">SUPPORT TICKETS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Raise and track operational and administrative support requests through dedicated ticketing.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">PROJECT CHANNELS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Access authorised project-related communications, guidance, and client brief clarifications.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          15. PARTNER SUCCESS PRINCIPLES (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              OPERATIONAL EXCELLENCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Built Around Strong Delivery Partnerships
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              The four foundational pillars defining every successful Thinkatic delivery centre relationship.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                01
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">QUALITY</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Focus on consistent service delivery, defined SLA standards, and meticulous adherence to process briefs.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                02
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">RELIABILITY</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Build dependable operational processes, disciplined workforce structures, and uninterrupted shift continuity.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                03
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">TRANSPARENCY</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Maintain open visibility into project tracking, performance metrics, and financial reporting.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                04
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">GROWTH</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Develop your centre's operational capabilities, expand trained workforce seat capacity, and scale over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          16. WHO SHOULD PARTNER (Light Blue #F8FAFC)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              NETWORK ELIGIBILITY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Who Is Thinkatic Looking For?
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              We welcome operational excellence across diverse BPO operational profiles.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">ESTABLISHED BPO CENTRES</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Centres with existing management teams, certified infrastructure, and established operational capabilities.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">GROWING BPO BUSINESSES</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Centres seeking to expand their international project pipeline and maximize active seat utilization.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">SPECIALISED CENTRES</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Centres with targeted proficiencies in voice support, back-office workflows, data processing, or tech services.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                <Workflow className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">SCALING OPERATORS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Businesses looking to structure scalable and measurable operations within a recognized enterprise ecosystem.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          17. PARTNER EXPECTATIONS (Deep Navy #0B1226)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1226] text-white border-b border-slate-800">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">
                MUTUAL COMMITMENT
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                What We Expect From Our Partners
              </h2>
              <p className="text-base text-slate-300 leading-relaxed font-normal">
                Thinkatic partnerships are built around reliable delivery and operational discipline. We hold our network to enterprise-grade standards.
              </p>
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 leading-relaxed">
                <span className="font-semibold text-blue-400">Core Principle:</span> Strong partnerships are built through reliable operations, clear communication, and consistent performance.
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                "Accurate business information",
                "Required verification documents",
                "Valid centre information",
                "Appropriate workforce records",
                "Agreed operational standards",
                "Accurate reporting",
                "Professional customer handling",
                "Compliance with applicable requirements",
                "Timely communication",
                "Accurate financial information",
              ].map((exp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 text-xs text-slate-200"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{exp}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          18. GLOBAL DELIVERY CONNECTION: Bridge to /global-delivery (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-14">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              CROSS-BORDER IMPACT
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Your Centre Can Become Part of a Global Delivery Model
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Connecting verified delivery infrastructure in India with international enterprise requirements in the US, UK, and beyond.
            </p>
          </div>

          {/* Visual connected pipeline */}
          <div className="max-w-4xl mx-auto bg-slate-900 rounded-3xl p-6 sm:p-10 text-white border border-slate-800 shadow-xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2 items-center text-center font-mono text-xs">
              <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 font-bold">
                YOUR BPO CENTRE
              </div>
              <div className="text-slate-500 hidden sm:block">→</div>
              <div className="p-3 rounded-xl bg-[#214ECF] text-white font-bold">
                THINKATIC
              </div>
              <div className="text-slate-500 hidden sm:block">→</div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
                GLOBAL REQUIREMENTS
              </div>
              <div className="text-slate-500 hidden sm:block">→</div>
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                PAYOUT & SCALE
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-400">Discover our full international delivery capabilities & market coverage.</span>
              <Link
                href="/global-delivery"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0B1226] font-semibold text-xs sm:text-sm hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Explore Global Delivery
                <ArrowRight className="w-4 h-4 text-[#214ECF]" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          19. FINAL CTA: Ready to Grow Your BPO Business With Thinkatic? (Deep Navy / Blue)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="relative py-20 md:py-28 bg-[#0B1226] text-white overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-[#214ECF]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <span className="inline-block text-xs font-bold text-blue-400 tracking-widest uppercase">
              START YOUR PARTNERSHIP
            </span>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Ready to Grow Your BPO Business With Thinkatic?
            </h2>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              Join a structured delivery network designed to connect verified BPO centres with business opportunities, operational tools, and scalable delivery capabilities.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/signup?role=bpo"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#214ECF] text-white font-semibold text-base hover:bg-blue-600 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer"
              >
                Become a BPO Partner
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/contact"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-800/80 border border-slate-700 text-white font-semibold text-base hover:bg-slate-700 transition-all cursor-pointer"
              >
                Talk to Thinkatic
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
