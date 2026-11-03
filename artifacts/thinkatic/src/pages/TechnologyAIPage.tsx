import React, { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO } from "@/hooks/useSEO";
import {
  Cpu,
  Bot,
  Brain,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
  Workflow,
  CheckCircle2,
  Users,
  Building2,
  HeadphonesIcon,
  Mic,
  Calendar,
  FileText,
  Database,
  Globe,
  Lock,
  Eye,
  Server,
  Code,
  Activity,
  ChevronRight,
  Clock,
  Check,
  Sliders,
  Send,
  UserCheck,
  TrendingUp,
  MessageSquare,
  Network,
  Share2,
  Radio,
  FileCheck,
  Briefcase,
  AlertCircle,
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

// ── 1. Technology Services (6 Cards) ──────────────────────────────────────────
const TECH_SERVICES = [
  {
    icon: Code,
    title: "SOFTWARE & APPLICATION SUPPORT",
    description: "Support for business applications, modern software environments, and day-to-day technology operations.",
  },
  {
    icon: HeadphonesIcon,
    title: "TECHNICAL SUPPORT",
    description: "Professional technical assistance and structured resolution designed around user and business requirements.",
  },
  {
    icon: Server,
    title: "IT OPERATIONS",
    description: "Technology-enabled operational support for distributed systems, administrative users, and infrastructure requirements.",
  },
  {
    icon: Zap,
    title: "AUTOMATION",
    description: "Workflow automation designed to reduce repetitive tasks, eliminate manual friction, and improve operational efficiency.",
  },
  {
    icon: Database,
    title: "DATA & PROCESS MANAGEMENT",
    description: "Structured data pipelines, reporting repositories, and process handling designed around business specifications.",
  },
  {
    icon: Globe,
    title: "DIGITAL OPERATIONS",
    description: "Technology-supported workflows and digital frameworks that help modern businesses manage digital processes across borders.",
  },
];

// ── 2. AI Services (4 Cards with Exact Authoritative Pricing) ─────────────────
const AI_SERVICES = [
  {
    id: "ai-starter",
    tier: "AI STARTER",
    price: "$999",
    timeline: "7–10 days",
    badge: "ESSENTIAL",
    description: "A practical AI chatbot solution for businesses starting their AI journey.",
    includes: [
      "Website AI chatbot",
      "Company knowledge base",
      "FAQ automation",
      "Lead collection",
      "Basic conversation flows",
      "Email notifications",
      "Analytics",
      "Deployment",
    ],
    ctaText: "Talk to Thinkatic",
    ctaLink: "/contact",
    highlight: false,
  },
  {
    id: "ai-business",
    tier: "AI BUSINESS",
    price: "$2,499",
    timeline: "2–3 weeks",
    badge: "POPULAR",
    description: "Advanced AI capabilities designed for businesses that need deeper customer and operational automation.",
    includes: [
      "Everything in AI Starter",
      "Advanced AI agent",
      "Document / knowledge-base integration",
      "Lead qualification",
      "Appointment booking",
      "CRM integration",
      "WhatsApp integration",
      "Email integration",
      "Analytics",
      "Workflow automation",
    ],
    ctaText: "Explore AI Business",
    ctaLink: "/contact",
    highlight: true,
  },
  {
    id: "ai-enterprise",
    tier: "AI ENTERPRISE",
    price: "From $5,000+",
    timeline: "Custom / requirement-based",
    badge: "ENTERPRISE",
    description: "Custom AI solutions designed for complex business requirements and larger operational environments.",
    includes: [
      "Multiple AI agents",
      "Voice AI",
      "Customer-support automation",
      "Sales automation",
      "CRM / ERP integration",
      "Custom APIs",
      "Advanced workflows",
      "Admin dashboard",
      "Human handoff",
      "Monitoring",
    ],
    ctaText: "Discuss Enterprise AI",
    ctaLink: "/contact",
    highlight: false,
  },
  {
    id: "ai-automation",
    tier: "AI AUTOMATION",
    price: "Custom Pricing",
    timeline: "Requirement-based",
    badge: "WORKFLOWS",
    description: "AI-enabled workflow automation designed around specific business processes and operational requirements.",
    includes: [
      "Workflow automation",
      "Customer operations",
      "Lead workflows",
      "Knowledge workflows",
      "Internal process automation",
      "Human handoff workflows",
      "Business-system integrations",
    ],
    ctaText: "Discuss AI Automation",
    ctaLink: "/contact",
    highlight: false,
  },
  {
    id: "voice-ai",
    tier: "VOICE AI",
    price: "Custom Pricing / Included in AI Enterprise",
    timeline: "Requirement-based",
    badge: "CONVERSATIONAL",
    description: "AI-powered voice interactions for customer workflows, inquiries, and telephony with human oversight.",
    includes: [
      "Voice support",
      "Customer assistance",
      "Workflow automation",
      "Human handoff",
      "Telephony & CRM integration",
      "Custom business workflows",
    ],
    ctaText: "Discuss Voice AI",
    ctaLink: "/contact",
    highlight: false,
  },
];

// ── 3. Voice AI Cards (4 Cards) ───────────────────────────────────────────────
const VOICE_AI_CARDS = [
  {
    icon: Mic,
    title: "VOICE SUPPORT",
    description: "AI-powered voice interactions for supported customer workflows and inquiries.",
  },
  {
    icon: HeadphonesIcon,
    title: "CUSTOMER ASSISTANCE",
    description: "Handle defined customer questions, order status, and structured requests through natural voice experiences.",
  },
  {
    icon: Workflow,
    title: "WORKFLOW AUTOMATION",
    description: "Connect inbound voice interactions directly with appropriate business workflows, CRMs, and databases.",
  },
  {
    icon: UserCheck,
    title: "HUMAN HANDOFF",
    description: "Allow supported workflows to smoothly transition to human professionals when required.",
  },
];

// ── 4. AI Use Cases (8 Cards) ─────────────────────────────────────────────────
const AI_USE_CASES = [
  {
    icon: HeadphonesIcon,
    title: "CUSTOMER SUPPORT",
    description: "Assist customers with common questions, ticket routing, and round-the-clock support workflows.",
  },
  {
    icon: Users,
    title: "LEAD MANAGEMENT",
    description: "Capture, qualify, and route leads according to defined business criteria and operational workflows.",
  },
  {
    icon: Database,
    title: "KNOWLEDGE MANAGEMENT",
    description: "Connect business documentation and standard operating procedures with intelligent query experiences.",
  },
  {
    icon: Calendar,
    title: "APPOINTMENT BOOKING",
    description: "Support scheduling workflows, calendar synchronization, and automated confirmation reminders.",
  },
  {
    icon: FileText,
    title: "DOCUMENT & INFORMATION ACCESS",
    description: "Help team members and customers quickly interact with approved business manuals and files.",
  },
  {
    icon: TrendingUp,
    title: "SALES SUPPORT",
    description: "Assist defined sales discovery, customer onboarding workflows, and inquiry enrichment.",
  },
  {
    icon: Activity,
    title: "OPERATIONS",
    description: "Support repetitive operational workflows, batch data handling, and administrative tasks.",
  },
  {
    icon: UserCheck,
    title: "HUMAN HANDOFF",
    description: "Move conversations to trained professionals when human intervention, empathy, or review is required.",
  },
];

// ── 5. AI Implementation Process (6 Steps) ────────────────────────────────────
const IMPLEMENTATION_STEPS = [
  {
    step: "01",
    tag: "UNDERSTAND",
    title: "Understand Requirements",
    description: "Understand the core business problem, user expectations, operational workflows, and desired outcomes.",
  },
  {
    step: "02",
    tag: "DESIGN",
    title: "Design Experience",
    description: "Define the AI persona, knowledge requirements, integration touchpoints, and guardrail workflows.",
  },
  {
    step: "03",
    tag: "BUILD",
    title: "Build & Configure",
    description: "Develop the custom model configurations, conversation trees, prompt layers, and core logic.",
  },
  {
    step: "04",
    tag: "INTEGRATE",
    title: "Integrate Systems",
    description: "Connect approved enterprise systems, CRM software, knowledge bases, and business APIs.",
  },
  {
    step: "05",
    tag: "TEST",
    title: "Test & Validate",
    description: "Validate conversation behavior, accuracy, edge-case routing, security, and operational compliance.",
  },
  {
    step: "06",
    tag: "DEPLOY & OPTIMISE",
    title: "Deploy & Scale",
    description: "Launch the solution into production and continuously improve it based on real operational telemetry.",
  },
];

// ── 6. Technology Stack / Capabilities (6 Categories) ──────────────────────────
const TECH_CAPABILITIES = [
  {
    icon: Globe,
    title: "WEB & APPLICATIONS",
    description: "Modern web applications, client dashboards, and responsive digital platforms engineered for performance.",
  },
  {
    icon: Network,
    title: "APIs & INTEGRATIONS",
    description: "Custom business-system integrations, webhook architectures, and secure API gateways.",
  },
  {
    icon: Zap,
    title: "AUTOMATION",
    description: "End-to-end workflow automation engines that connect legacy databases and modern cloud systems.",
  },
  {
    icon: Database,
    title: "DATA & ANALYTICS",
    description: "Structured data pipelines, business intelligence dashboards, and performance reporting telemetry.",
  },
  {
    icon: Bot,
    title: "AI CAPABILITIES",
    description: "AI assistants, autonomous task agents, natural language processing, and semantic search systems.",
  },
  {
    icon: Server,
    title: "CLOUD INFRASTRUCTURE",
    description: "Cloud-enabled operational infrastructure, containerized deployments, and high-availability hosting.",
  },
];

// ── 7. Business Automation (6 Cards) ──────────────────────────────────────────
const BUSINESS_AUTOMATION_CARDS = [
  {
    icon: Workflow,
    title: "WORKFLOW AUTOMATION",
    description: "Connect multi-step business procedures into seamless, automated execution pipelines.",
  },
  {
    icon: Database,
    title: "DATA AUTOMATION",
    description: "Eliminate repetitive manual data entry, file reconciliation, and batch synchronization.",
  },
  {
    icon: Users,
    title: "LEAD AUTOMATION",
    description: "Support defined lead-management workflows from initial capture to CRM dispatch.",
  },
  {
    icon: HeadphonesIcon,
    title: "CUSTOMER OPERATIONS",
    description: "Automate suitable repetitive customer-service tasks, status inquiries, and ticket updates.",
  },
  {
    icon: Activity,
    title: "INTERNAL OPERATIONS",
    description: "Streamline recurring internal notifications, status reports, and administrative approvals.",
  },
  {
    icon: Share2,
    title: "SYSTEM INTEGRATIONS",
    description: "Connect business tools, ERPs, and operational systems for unified data movement.",
  },
];

// ── 8. Security & Responsible AI (5 Cards) ────────────────────────────────────
const SECURITY_CARDS = [
  {
    icon: Lock,
    title: "SECURITY",
    description: "Protect systems, infrastructure, and proprietary business information with enterprise encryption.",
  },
  {
    icon: ShieldCheck,
    title: "ACCESS CONTROL",
    description: "Ensure only authorised users and authenticated roles access sensitive operational workflows.",
  },
  {
    icon: Database,
    title: "DATA PROTECTION",
    description: "Handle customer and corporate data according to applicable confidentiality and governance requirements.",
  },
  {
    icon: UserCheck,
    title: "HUMAN OVERSIGHT",
    description: "Keep trained professionals actively in control where human judgement and empathy are essential.",
  },
  {
    icon: Eye,
    title: "AUDITABILITY",
    description: "Maintain transparent operational logs, decision visibility, and complete historical audit trails.",
  },
];

export default function TechnologyAIPage() {
  useSEO({
    title: "Thinkatic | Technology & AI Solutions",
    description:
      "Thinkatic provides technology services, AI solutions, automation, customer experience technology and business process solutions designed around real business requirements.",
    path: "/technology-ai",
  });

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Layout>
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. HERO SECTION: Technology That Works. AI That Creates Value.
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 bg-white overflow-hidden border-b border-slate-100">
        {/* Soft background ambient gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[560px] bg-gradient-to-b from-blue-50/80 via-blue-50/20 to-transparent pointer-events-none rounded-full blur-3xl -z-10" />

        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Content */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="lg:col-span-6 space-y-6"
            >
              {/* Eyebrow */}
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-[#214ECF] text-xs font-semibold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-[#214ECF] animate-pulse" />
                TECHNOLOGY & AI
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                variants={fadeUp}
                className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold text-[#0B1226] tracking-tight leading-[1.12]"
              >
                Technology That Works. <br />
                AI That Creates Value.
              </motion.h1>

              {/* Supporting Copy */}
              <motion.p variants={fadeUp} className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
                Thinkatic combines technology, automation, AI capabilities, skilled professionals, and structured business processes to help organisations operate smarter and serve customers better.
              </motion.p>

              <motion.p variants={fadeUp} className="text-sm sm:text-base text-slate-500 leading-relaxed font-normal">
                From software and digital operations to AI-powered customer experiences and intelligent automation, we design technology solutions around real business requirements.
              </motion.p>

              {/* Dual CTAs */}
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#214ECF] text-white font-semibold text-sm sm:text-base hover:bg-[#1B40AB] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                >
                  Talk to Thinkatic
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  onClick={() => scrollTo("ai-services")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-slate-200 text-[#0B1226] font-semibold text-sm sm:text-base hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                >
                  Explore AI Services
                </button>
              </motion.div>
            </motion.div>

            {/* Right Column: Hero Visual Concept Flow */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease }}
              className="lg:col-span-6 relative"
            >
              <div className="relative mx-auto max-w-lg lg:max-w-none bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 text-white overflow-hidden">
                {/* Circuit ambient glow */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-[#214ECF]/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-xs font-mono font-medium text-slate-300">THINKATIC VALUE ARCHITECTURE</span>
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400 bg-cyan-400/10 border border-cyan-400/30 px-2 py-0.5 rounded">
                      INTEGRATED ENGINE
                    </span>
                  </div>

                  {/* Flow pipeline */}
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">01</span>
                        <span className="text-white font-semibold">BUSINESS REQUIREMENT</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">Domain & Goals</span>
                    </div>

                    <div className="flex justify-center text-slate-600 text-xs">↓</div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">02</span>
                        <span className="text-white font-semibold">DATA & KNOWLEDGE</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">Structured SOPs</span>
                    </div>

                    <div className="flex justify-center text-slate-600 text-xs">↓</div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#214ECF]/20 border border-[#214ECF]/50">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded bg-[#214ECF] text-white flex items-center justify-center font-bold text-xs">03</span>
                        <span className="text-white font-semibold">TECHNOLOGY & AI AGENTS</span>
                      </div>
                      <span className="text-cyan-300 text-[11px]">Intelligent Automation</span>
                    </div>

                    <div className="flex justify-center text-slate-600 text-xs">↓</div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">04</span>
                        <span className="text-white font-semibold">PEOPLE & HUMAN OVERSIGHT</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">Judgement & Empathy</span>
                    </div>

                    <div className="flex justify-center text-slate-600 text-xs">↓</div>

                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-900/60 to-slate-900 border border-blue-500/40 text-center">
                      <span className="text-[10px] text-blue-300 uppercase tracking-widest block font-bold">MEASURABLE OUTCOME</span>
                      <span className="text-sm font-bold text-white mt-0.5 block">Smarter Operations & Better Customer Experience</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. TECHNOLOGY + AI INTRODUCTION: Technology, AI & People Working Together
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F0F5FF]/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              OPERATIONAL SYNERGY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Technology, AI & People Working Together
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              Technology can improve how businesses operate. AI can help businesses automate repetitive work, understand information, support customers, and create new operational capabilities. But technology works best when it is designed around real business requirements and supported by people and processes.
            </p>
          </div>

          {/* 4 Connected Cards: Technology, AI, People, Process */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1226] tracking-tight">TECHNOLOGY</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Platforms, software, systems, integrations, and digital operations that form the technical backbone of your business.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 text-xs font-semibold text-[#214ECF]">
                Digital Foundation
              </div>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1226] tracking-tight">AI</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  AI-powered assistants, agents, automation, and intelligent workflows applied where appropriate for maximum leverage.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 text-xs font-semibold text-[#214ECF]">
                Intelligent Automation
              </div>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1226] tracking-tight">PEOPLE</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Skilled professionals who provide domain expertise, operational oversight, customer support, and human decision-making.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 text-xs font-semibold text-[#214ECF]">
                Human Expertise
              </div>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                  <Workflow className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1226] tracking-tight">PROCESS</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Structured workflows designed for consistency, accountability, operational efficiency, and measurable outcomes.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 text-xs font-semibold text-[#214ECF]">
                Structured Delivery
              </div>
            </div>
          </div>

          {/* Connection flow strip */}
          <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 text-center text-xs font-mono text-slate-700 flex flex-wrap items-center justify-center gap-2">
            <span className="font-bold text-[#214ECF]">TECHNOLOGY</span>
            <span>→</span>
            <span className="font-bold text-[#214ECF]">AI</span>
            <span>→</span>
            <span className="font-bold text-[#214ECF]">PEOPLE</span>
            <span>→</span>
            <span className="font-bold text-[#214ECF]">PROCESS</span>
            <span>→</span>
            <span className="font-bold text-emerald-600">MEASURABLE OUTCOME</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. TECHNOLOGY SERVICES (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              ENTERPRISE CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Technology Services
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Technology should solve business problems, simplify operations and create reliable digital capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {TECH_SERVICES.map((srv, idx) => {
              const Icon = srv.icon;
              return (
                <motion.div
                  key={idx}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="group relative bg-white p-7 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#214ECF] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white transition-colors duration-300 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#0B1226] tracking-tight group-hover:text-[#214ECF] transition-colors">
                      {srv.title}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed font-normal">
                      {srv.description}
                    </p>
                  </div>

                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-[#214ECF] gap-1 group-hover:translate-x-1 transition-transform">
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#214ECF] text-white font-semibold text-sm hover:bg-[#1B40AB] transition-colors shadow-md cursor-pointer"
            >
              Discuss Your Technology Requirements
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. AI SERVICES: Authoritative Pricing & Solution Architecture
      ────────────────────────────────────────────────────────────────────────────── */}
      <section id="ai-services" className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              AI PACKAGES & WORKFLOWS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              AI Solutions Built Around Your Business
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              AI should be applied where it creates meaningful business value. Thinkatic provides AI services designed around customer experience, business workflows, knowledge management, automation and operational requirements.
            </p>
          </div>

          {/* 5 Premium AI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {AI_SERVICES.map((tier) => (
              <div
                key={tier.id}
                className={`relative bg-white rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 border ${
                  tier.highlight
                    ? "border-[#214ECF] shadow-xl ring-2 ring-[#214ECF]/20"
                    : "border-slate-200/80 shadow-xs hover:shadow-lg hover:border-blue-300"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#214ECF] text-white text-[11px] font-bold px-3 py-0.5 rounded-full tracking-wider uppercase font-mono shadow-sm">
                    MOST POPULAR
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                      {tier.badge}
                    </span>
                    <span className="text-xs font-mono text-slate-400 text-right">
                      {tier.timeline}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-[#0B1226] tracking-tight">{tier.tier}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-[#0B1226]">{tier.price}</span>
                      {tier.price.includes("$") && !tier.price.includes("+") && (
                        <span className="text-xs text-slate-500">one-time</span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {tier.description}
                  </p>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Includes:</div>
                    <ul className="space-y-1.5 text-xs text-slate-600">
                      {tier.includes.map((inc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-[#214ECF] flex-shrink-0 mt-0.5" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100">
                  <Link
                    href={tier.ctaLink}
                    className={`w-full py-2.5 rounded-xl font-semibold text-xs text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      tier.highlight
                        ? "bg-[#214ECF] text-white hover:bg-[#1B40AB] shadow-sm"
                        : "bg-slate-100 text-[#0B1226] hover:bg-slate-200"
                    }`}
                  >
                    <span>{tier.ctaText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. VOICE AI (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#214ECF] text-xs font-semibold font-mono uppercase">
              <Mic className="w-3.5 h-3.5" />
              VOICE AUTOMATION
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Voice AI
            </h2>
            <h3 className="text-xl font-semibold text-slate-700">
              AI-Powered Voice Experiences With Human Oversight
            </h3>
            <p className="text-base text-slate-600 leading-relaxed font-normal">
              Voice AI can support customer interactions, information handling and operational workflows where voice automation is appropriate.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VOICE_AI_CARDS.map((v, idx) => {
              const Icon = v.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold text-[#0B1226]">{v.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {v.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-6 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#0B1226]">Pricing: Custom Pricing / Included in AI Enterprise</div>
              <div className="text-xs text-slate-600">Included as a capability within AI Enterprise where applicable based on call concurrency and telephony routes.</div>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#214ECF] text-white font-semibold text-xs sm:text-sm hover:bg-[#1B40AB] transition-colors cursor-pointer flex-shrink-0"
            >
              Discuss Voice AI
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. AI USE CASES (Light Blue #F0F5FF)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F0F5FF]/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              HIGH-IMPACT APPLICATIONS
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Where AI Can Create Business Value
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Applied intelligence across essential customer and operational touchpoints.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {AI_USE_CASES.map((uc, idx) => {
              const Icon = uc.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all space-y-2.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1226] tracking-tight">{uc.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {uc.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">Governance Guardrail:</span> Thinkatic designs AI solutions for workflow acceleration, information retrieval, and assisted customer handling. Sensitive corporate judgements, compliance rulings, and financial settlements remain under explicit human supervision.
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. AI + HUMAN COLLABORATION (Deep Navy #0B1226)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1226] text-white border-b border-slate-800">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-16 space-y-4">
            <span className="text-xs font-bold text-cyan-400 tracking-widest uppercase">
              RESPONSIBLE AUGMENTATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              AI Doesn't Replace the Operation. <br />
              It Enhances It.
            </h2>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              Thinkatic believes AI works best when technology and people operate together. AI can handle suitable repetitive tasks. People provide judgement, empathy, expertise and accountability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="p-7 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">AI</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Speed, automated data lookup, preliminary triage, and repetitive task execution around the clock.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">PEOPLE</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Domain expertise, empathetic engagement, nuanced problem-solving, and authoritative human decisions.
              </p>
            </div>

            <div className="p-7 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Workflow className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">OPERATIONS</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Structured workflows, continuous quality benchmarks, robust documentation, and measurable execution.
              </p>
            </div>
          </div>

          {/* Visual connected strip */}
          <div className="mt-8 p-4 rounded-xl bg-slate-900 border border-slate-700 text-center font-mono text-xs text-slate-300 flex flex-wrap items-center justify-center gap-2">
            <span className="text-cyan-400 font-bold">AI + HUMAN</span>
            <span>↓</span>
            <span className="text-blue-300 font-bold">BETTER CUSTOMER EXPERIENCE</span>
            <span>↓</span>
            <span className="text-emerald-400 font-bold">BETTER OPERATIONS</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. HUMAN HANDOFF (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-4">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              SEAMLESS ESCALATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              When Human Support Matters, People Stay in Control
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              AI-enabled workflows can be designed with human handoff so customers or operational cases can move to trained professionals when required.
            </p>
          </div>

          {/* Flow visual */}
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-10 text-white border border-slate-800 shadow-xl space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-center text-center font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
                01. CUSTOMER
              </div>
              <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300">
                02. AI ASSISTANCE
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
                03. UNDERSTAND REQUEST
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
                04. SOLVE IF APPROPRIATE
              </div>
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                05. HUMAN HANDOFF
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                06. RESOLUTION
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 text-center">
              Context, conversation history, and customer profile transfer instantly to trained human agents without lost information.
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. AI IMPLEMENTATION PROCESS: 6-Step Timeline (Light Blue #F8FAFC)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-16 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              STRUCTURED DEPLOYMENT
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              From Business Requirement to AI Solution
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Our 6-step deployment methodology ensures intelligent models deliver reliable, audited business value.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {IMPLEMENTATION_STEPS.map((step, idx) => (
              <div
                key={idx}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-[#214ECF] bg-blue-50 px-2 py-0.5 rounded">
                      {step.step}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                      {step.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#0B1226] mb-1 tracking-tight">
                    {step.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {step.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Phase {idx + 1}</span>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>

          {/* Sequence bar */}
          <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 text-center font-mono text-xs text-slate-600 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[#214ECF] font-bold">UNDERSTAND</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">DESIGN</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">BUILD</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">INTEGRATE</span>
            <span>→</span>
            <span className="text-[#214ECF] font-bold">TEST</span>
            <span>→</span>
            <span className="text-emerald-600 font-bold">DEPLOY & OPTIMISE</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          10. TECHNOLOGY STACK / CAPABILITIES (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              ENGINEERING FOUNDATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Technology Behind the Experience
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Modern digital engineering categories that power Thinkatic's technology solutions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TECH_CAPABILITIES.map((cap, idx) => {
              const Icon = cap.icon;
              return (
                <div
                  key={idx}
                  className="p-7 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-lg transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#0B1226]">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {cap.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          11. BUSINESS AUTOMATION (Light Blue #F0F5FF)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F0F5FF]/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              EFFICIENCY & ACCELERATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Automate the Work That Slows You Down
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Automation can reduce repetitive work, improve consistency and help teams focus on higher-value activities.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BUSINESS_AUTOMATION_CARDS.map((ac, idx) => {
              const Icon = ac.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 hover:border-blue-300 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#0B1226]">{ac.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {ac.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#214ECF] text-white font-semibold text-xs sm:text-sm hover:bg-[#1B40AB] transition-colors shadow-md cursor-pointer"
            >
              Discuss Automation
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          12. SECURITY & RESPONSIBLE AI (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              TRUST & GOVERNANCE
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Built With Security and Responsibility in Mind
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Technology and AI solutions should be designed with security, privacy, access control and operational accountability in mind.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {SECURITY_CARDS.map((sc, idx) => {
              const Icon = sc.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-md transition-all space-y-2.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-[#214ECF] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0B1226] uppercase font-mono">{sc.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {sc.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          13. AI FOR CUSTOMER EXPERIENCE (Light Blue #F8FAFC)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F8FAFC] border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              CX ELEVATION
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Transform Customer Experience With Technology
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Elevate every touchpoint across chat, voice, and email with immediate intelligent assistance.
            </p>
          </div>

          {/* CX Flow Strip */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 mb-8 font-mono text-xs text-slate-600 flex flex-wrap items-center justify-center gap-2 text-center">
            <span>CUSTOMER</span>
            <span>↓</span>
            <span className="text-[#214ECF] font-bold">CHAT / VOICE / EMAIL</span>
            <span>↓</span>
            <span className="text-[#214ECF] font-bold">AI ASSISTANCE</span>
            <span>↓</span>
            <span>KNOWLEDGE</span>
            <span>↓</span>
            <span>WORKFLOW</span>
            <span>↓</span>
            <span className="text-[#214ECF] font-bold">HUMAN SUPPORT</span>
            <span>↓</span>
            <span className="text-emerald-600 font-bold">RESOLUTION</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">FASTER RESPONSES</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Provide instant answers for supported customer questions without queue delays.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">CONSISTENT INFORMATION</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect responses directly to verified business knowledge bases for accurate policy adherence.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">LEAD CAPTURE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Capture prospective customer intent, qualifying criteria, and contact records automatically.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">HUMAN HANDOFF</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Escalate complex cases smoothly to trained customer support representatives.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          14. TECHNOLOGY + BPO: Technology Meets Operations (White)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              UNIFIED DELIVERY
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Technology Meets Operations
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Thinkatic combines technology capabilities with business process outsourcing to help businesses build connected operating models.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">TECHNOLOGY SERVICES</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Software, engineering, infrastructure, and technical assistance.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">AI SERVICES</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Intelligent chatbots, voice assistants, and automated workflows.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">CUSTOMER EXPERIENCE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dedicated omnichannel voice, chat, and email support professionals.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <h3 className="text-base font-bold text-[#0B1226]">BUSINESS PROCESS OUTSOURCING</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Back-office execution, data processing, and order management.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs sm:text-sm text-slate-700">
              <span className="font-semibold text-[#0B1226]">Integrated Operating Formula:</span> Technology + AI + People + Process → Customer Experience + Business Operations → Measurable Outcomes.
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#214ECF] text-white font-semibold text-xs sm:text-sm hover:bg-[#1B40AB] transition-colors cursor-pointer flex-shrink-0"
            >
              Explore Our Services
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          15. WHO WE HELP: Built for Businesses at Different Stages (Light Blue #F0F5FF)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#F0F5FF]/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-3xl mb-14 space-y-3">
            <span className="text-xs font-bold text-[#214ECF] tracking-widest uppercase">
              SCALABILITY MATRIX
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1226] tracking-tight">
              Built for Businesses at Different Stages
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Modular solutions designed to meet your current technical maturity and scale alongside growth.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                01
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">STARTUPS</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Build digital and operational capabilities without creating every engineering and support function internally.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                02
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">GROWING BUSINESSES</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Use technology and automation to support increasing operational requirements without linear headcount costs.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                03
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">ESTABLISHED BUSINESSES</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Improve existing workflows, eliminate bottleneck manual processes, and modernise technology-enabled operations.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center font-bold">
                04
              </div>
              <h3 className="text-base font-bold text-[#0B1226]">ENTERPRISES</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-normal">
                Design larger technology, AI, and distributed operational solutions tailored around complex multi-regional requirements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          16. INTERNAL AI GOVERNANCE SEPARATION (White Callout Box)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="p-6 sm:p-8 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#214ECF] flex items-center justify-center flex-shrink-0 mt-1">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-[#214ECF] uppercase">PLATFORM GOVERNANCE CLARIFICATION</div>
                <h4 className="text-base font-bold text-[#0B1226]">Responsible Platform Operations</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Thinkatic's AI services describe solutions delivered to client organizations. Internal Thinkatic platform governance—including BPO partner approvals, capacity evaluations, project allocations, and financial payouts—remains strictly human-governed by authorized administrators.
                </p>
              </div>
            </div>
            <Link
              href="/about"
              className="text-xs font-semibold text-[#214ECF] hover:underline whitespace-nowrap"
            >
              Learn about our governance →
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          17. FINAL HIGH-IMPACT CTA: Ready to Put Technology and AI to Work? (Deep Navy / Blue)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="relative py-20 md:py-28 bg-[#0B1226] text-white overflow-hidden">
        {/* Ambient backlight glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-[#214ECF]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <span className="inline-block text-xs font-bold text-cyan-400 tracking-widest uppercase">
              ACCELERATE YOUR BUSINESS
            </span>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Ready to Put Technology and AI to Work?
            </h2>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              Whether you need software support, automation, AI agents, Voice AI, customer experience technology, or a complete technology-enabled operating model, Thinkatic can help you design a solution around your business.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/contact"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#214ECF] text-white font-semibold text-base hover:bg-[#1B40AB] transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5 cursor-pointer"
              >
                Talk to Thinkatic
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/services"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-slate-800/80 border border-slate-700 text-white font-semibold text-base hover:bg-slate-700 transition-all cursor-pointer"
              >
                Explore Our Services
              </Link>

              <Link
                href="/contact"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-slate-300 hover:text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Request a Consultation →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
