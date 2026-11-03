import React, { useRef } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO } from "@/hooks/useSEO";
import {
  Globe,
  MapPin,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Users,
  Workflow,
  Cpu,
  ShieldCheck,
  Activity,
  Layers,
  Zap,
  PhoneCall,
  MessageSquare,
  Mail,
  UserCheck,
  ShieldAlert,
  HeartHandshake,
  Clock,
  Calendar,
  Building2,
  TrendingUp,
  Sliders,
  Rocket,
  Check,
  ChevronRight,
  Plane,
  CreditCard,
  Stethoscope,
  ShoppingBag,
  FileCheck2,
  PackageCheck,
  Target,
  ClipboardList,
  ThumbsUp,
  Server,
  Database,
  Bot,
  Network,
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

export default function GlobalDeliveryPage() {
  useSEO({
    title: "Thinkatic | Global Delivery & Business Process Outsourcing",
    description:
      "Thinkatic provides technology-enabled global delivery, customer support, business process outsourcing, and operational solutions designed around business requirements.",
    path: "/global-delivery",
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
          1. HERO SECTION: Global Delivery. Built Around Your Business.
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
              className="lg:col-span-6 max-w-2xl"
            >
              {/* Eyebrow */}
              <motion.div
                variants={fadeUp}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 mb-6 shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-[#214ECF] animate-pulse" />
                <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                  GLOBAL DELIVERY
                </span>
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                variants={fadeUp}
                className="font-display font-black text-3xl sm:text-4xl md:text-5xl lg:text-[54px] text-slate-900 tracking-tight leading-[1.12] mb-6"
              >
                Global Delivery.
                <br />
                <span className="text-[#214ECF]">Built Around Your Business.</span>
              </motion.h1>

              {/* Supporting Copy */}
              <motion.p
                variants={fadeUp}
                className="text-base sm:text-lg text-slate-700 leading-relaxed font-normal mb-4"
              >
                Thinkatic combines India-based delivery capabilities, skilled professionals, structured processes, and technology-enabled operations to support businesses across global markets.
              </motion.p>

              {/* Secondary Copy */}
              <motion.p
                variants={fadeUp}
                className="text-sm sm:text-base text-slate-500 leading-relaxed mb-8 font-normal"
              >
                From customer support and business operations to technology-enabled services, we help businesses build reliable operating capabilities across borders.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-4">
                <Link href="/contact">
                  <button className="h-12 px-7 rounded-xl bg-[#214ECF] text-white font-bold text-sm tracking-wide hover:bg-[#1A43C8] transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer">
                    <span>Talk to Thinkatic</span>
                    <ArrowRight size={16} />
                  </button>
                </Link>

                <button
                  onClick={() => scrollTo("delivery-model")}
                  className="h-12 px-6 rounded-xl border border-slate-200 hover:border-[#214ECF] bg-white hover:bg-slate-50 text-slate-700 hover:text-[#214ECF] font-bold text-sm tracking-wide transition-all shadow-xs hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
                >
                  <span>Explore Our Delivery Model</span>
                  <ArrowDown size={15} />
                </button>
              </motion.div>
            </motion.div>

            {/* Right Hero Visual: India → Global Markets Interactive Network Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease, delay: 0.2 }}
              className="lg:col-span-6 relative"
            >
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                {/* Glow Backdrop */}
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/60 via-slate-100/40 to-blue-50/60 rounded-3xl blur-2xl -z-10" />

                {/* Network Card */}
                <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 sm:p-8 shadow-xl backdrop-blur-sm relative overflow-hidden">
                  {/* Console Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] font-mono uppercase tracking-wider text-slate-700 font-bold">
                        Global Operational Model
                      </span>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[#214ECF] font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                      INDIA → GLOBAL
                    </span>
                  </div>

                  {/* SVG Route Visualization */}
                  <div className="relative rounded-2xl bg-slate-900 border border-slate-800 p-6 text-white overflow-hidden shadow-inner mb-6">
                    {/* Background Dot Grid */}
                    <div
                      className="absolute inset-0 pointer-events-none opacity-25"
                      style={{
                        backgroundImage: "radial-gradient(circle, #60A5FA 1px, transparent 1px)",
                        backgroundSize: "16px 16px",
                      }}
                    />

                    {/* SVG Flight / Data Transmission Arcs */}
                    <svg className="w-full h-44 sm:h-52 relative z-10" viewBox="0 0 500 220" fill="none">
                      <defs>
                        <linearGradient id="routeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#214ECF" />
                          <stop offset="50%" stopColor="#38BDF8" />
                          <stop offset="100%" stopColor="#10B981" />
                        </linearGradient>
                      </defs>

                      {/* Connection Arcs from India (Center Right: x=340, y=140) to US (x=80, y=80), UK (x=210, y=60), Global Clients (x=430, y=70) */}
                      {/* Arc to USA */}
                      <path
                        d="M 340 140 Q 210 20 80 80"
                        stroke="#214ECF"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                        className="opacity-70"
                      />
                      {/* Arc to UK */}
                      <path
                        d="M 340 140 Q 280 40 210 60"
                        stroke="#38BDF8"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                        className="opacity-80"
                      />
                      {/* Arc to Global */}
                      <path
                        d="M 340 140 Q 400 60 430 70"
                        stroke="#10B981"
                        strokeWidth="2.5"
                        strokeDasharray="4 4"
                        className="opacity-70"
                      />

                      {/* HUB: INDIA */}
                      <g className="cursor-pointer">
                        <circle cx="340" cy="140" r="14" fill="#214ECF" fillOpacity="0.25" />
                        <circle cx="340" cy="140" r="8" fill="#214ECF" />
                        <circle cx="340" cy="140" r="3.5" fill="#FFFFFF" />
                        <text x="340" y="172" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="bold" fontFamily="monospace">
                          INDIA HUB
                        </text>
                        <text x="340" y="186" textAnchor="middle" fill="#93C5FD" fontSize="9" fontFamily="monospace">
                          Core Delivery
                        </text>
                      </g>

                      {/* MARKET: UNITED STATES */}
                      <g>
                        <circle cx="80" cy="80" r="10" fill="#214ECF" fillOpacity="0.25" />
                        <circle cx="80" cy="80" r="6" fill="#3B82F6" />
                        <circle cx="80" cy="80" r="2.5" fill="#FFFFFF" />
                        <text x="80" y="106" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="monospace">
                          USA
                        </text>
                        <text x="80" y="119" textAnchor="middle" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">
                          Client Market
                        </text>
                      </g>

                      {/* MARKET: UNITED KINGDOM */}
                      <g>
                        <circle cx="210" cy="60" r="10" fill="#38BDF8" fillOpacity="0.25" />
                        <circle cx="210" cy="60" r="6" fill="#38BDF8" />
                        <circle cx="210" cy="60" r="2.5" fill="#FFFFFF" />
                        <text x="210" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="monospace">
                          UK
                        </text>
                        <text x="210" y="99" textAnchor="middle" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">
                          Client Market
                        </text>
                      </g>

                      {/* MARKET: GLOBAL CLIENTS */}
                      <g>
                        <circle cx="430" cy="70" r="10" fill="#10B981" fillOpacity="0.25" />
                        <circle cx="430" cy="70" r="6" fill="#10B981" />
                        <circle cx="430" cy="70" r="2.5" fill="#FFFFFF" />
                        <text x="430" y="96" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="monospace">
                          GLOBAL
                        </text>
                        <text x="430" y="109" textAnchor="middle" fill="#94A3B8" fontSize="8.5" fontFamily="monospace">
                          Enterprise
                        </text>
                      </g>
                    </svg>

                    {/* Bottom Status Ribbon */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        Continuous Operational Governance
                      </span>
                      <span className="text-[#38BDF8] font-bold">Multi-Timezone</span>
                    </div>
                  </div>

                  {/* 3 Summary Chips */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-mono text-slate-500 uppercase font-bold">Delivery Hub</p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">India Operations</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-mono text-slate-500 uppercase font-bold">Key Markets</p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">US, UK &amp; Global</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-[10px] font-mono text-slate-500 uppercase font-bold">Capability</p>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">BPO &amp; Tech Services</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. GLOBAL DELIVERY INTRODUCTION (People + Process + Technology)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                OPERATIONAL ARCHITECTURE
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              A Global Delivery Model Designed for Scale
            </h2>
            <div className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal space-y-2 max-w-2xl mx-auto">
              <p>Businesses need more than access to people.</p>
              <p>
                They need reliable processes, consistent execution, clear communication, measurable performance, and the ability to scale when demand changes.
              </p>
              <p className="font-medium text-slate-900 pt-2">
                Thinkatic brings these capabilities together through a structured delivery model designed around each client's requirements.
              </p>
            </div>
          </div>

          {/* 3 Premium Foundation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* CARD 1: PEOPLE */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs hover:shadow-lg transition-all text-center flex flex-col items-center group">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all mb-6 shadow-2xs">
                <Users size={30} />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#214ECF] font-bold mb-2">
                CAPABILITY 01
              </span>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-3">
                PEOPLE
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Skilled professionals aligned with defined roles, processes, and service requirements.
              </p>
            </div>

            {/* CARD 2: PROCESS */}
            <div className="bg-white rounded-3xl border-2 border-[#214ECF]/30 p-8 shadow-md hover:shadow-xl transition-all text-center flex flex-col items-center group relative">
              <div className="w-16 h-16 rounded-2xl bg-[#214ECF] text-white flex items-center justify-center mb-6 shadow-xs group-hover:scale-105 transition-transform">
                <Workflow size={30} />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#214ECF] font-bold mb-2">
                CAPABILITY 02
              </span>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-3">
                PROCESS
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Structured workflows designed for consistency, accountability, and operational efficiency.
              </p>
            </div>

            {/* CARD 3: TECHNOLOGY */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs hover:shadow-lg transition-all text-center flex flex-col items-center group">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all mb-6 shadow-2xs">
                <Cpu size={30} />
              </div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#214ECF] font-bold mb-2">
                CAPABILITY 03
              </span>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-3">
                TECHNOLOGY
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Technology-enabled systems, tools, automation, reporting, and operational visibility.
              </p>
            </div>
          </div>

          {/* Visual Concept Flow Strip */}
          <div className="mt-12 max-w-3xl mx-auto rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm font-bold text-slate-800">
            <span className="text-[#214ECF]">People</span>
            <ChevronRight size={16} className="text-slate-300" />
            <span className="text-[#214ECF]">Process</span>
            <ChevronRight size={16} className="text-slate-300" />
            <span className="text-[#214ECF]">Technology</span>
            <ChevronRight size={16} className="text-slate-300" />
            <span className="px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              Global Delivery
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. INDIA → GLOBAL DELIVERY (Major Visual Section)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
                <Globe size={14} className="text-[#214ECF]" />
                <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                  CROSS-BORDER EXECUTION
                </span>
              </div>
              <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
                India-Based Delivery.
                <br />
                <span className="text-[#214ECF]">Global Business Support.</span>
              </h2>
              <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-normal mb-6">
                Thinkatic works with delivery capabilities in India to support businesses serving customers and operating across international markets.
              </p>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 mb-6">
                <p className="text-xs font-mono uppercase tracking-widest text-[#214ECF] font-bold mb-4">
                  OUR DELIVERY MODEL BRINGS TOGETHER:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    "Skilled professionals",
                    "Structured workflows",
                    "Operational management",
                    "Customer support capabilities",
                    "Technology-enabled processes",
                    "Quality management",
                    "Performance reporting",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-800 font-medium">
                      <CheckCircle2 size={16} className="text-[#214ECF] shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Visual: Connected Hub Diagram */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-7 sm:p-9 shadow-sm relative">
                <div className="text-center mb-8">
                  {/* Central India Hub Badge */}
                  <div className="inline-flex flex-col items-center p-5 rounded-2xl bg-[#214ECF] text-white shadow-lg shadow-blue-500/20 max-w-xs w-full">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-blue-200 font-semibold mb-1">
                      PRIMARY DELIVERY HUB
                    </span>
                    <h3 className="font-display font-bold text-xl sm:text-2xl text-white">
                      INDIA DELIVERY HUB
                    </h3>
                    <p className="text-xs text-blue-100 mt-1">
                      Skilled Teams · Governance · Technology Systems
                    </p>
                  </div>
                </div>

                {/* Animated Connecting Lines */}
                <div className="flex items-center justify-center my-4">
                  <div className="w-px h-10 bg-gradient-to-b from-[#214ECF] to-slate-300" />
                </div>

                {/* 3 Supported Geographic Client Markets */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* US Market */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center hover:border-blue-300 hover:shadow-md transition-all">
                    <span className="text-2xl block mb-2">🇺🇸</span>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">UNITED STATES</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Supported Market</p>
                  </div>

                  {/* UK Market */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center hover:border-blue-300 hover:shadow-md transition-all">
                    <span className="text-2xl block mb-2">🇬🇧</span>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">UNITED KINGDOM</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Supported Market</p>
                  </div>

                  {/* Global Clients */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center hover:border-blue-300 hover:shadow-md transition-all">
                    <span className="text-2xl block mb-2">🌎</span>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">GLOBAL CLIENTS</h4>
                    <p className="text-[11px] text-slate-500 font-medium">Enterprise Coverage</p>
                  </div>
                </div>

                <p className="text-center text-[11px] text-slate-400 mt-6 font-mono">
                  * Geographic references represent client markets served by Thinkatic operations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. GLOBAL MARKET COVERAGE (US, UK, Global)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                CLIENT COVERAGE
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Supporting Global Markets
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              Our delivery models are designed around the specific regulatory, linguistic, operational, and customer expectations of each target market.
            </p>
          </div>

          {/* 3 Premium Market Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-10">
            {/* CARD 1: UNITED STATES */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs hover:shadow-xl hover:border-[#214ECF]/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl shadow-2xs">
                    🇺🇸
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#214ECF] font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                    MARKET 01
                  </span>
                </div>
                <h3 className="font-display font-bold text-2xl text-slate-900 mb-3 group-hover:text-[#214ECF] transition-colors">
                  UNITED STATES
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6 font-normal">
                  Support for businesses serving customers and operating in the US market.
                </p>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
                    FOCUS AREAS:
                  </p>
                  <ul className="space-y-2.5" role="list">
                    {[
                      "Customer Support",
                      "Voice Support",
                      "Back-office Operations",
                      "Technology-enabled Operations",
                    ].map((pt) => (
                      <li key={pt} className="flex items-center gap-2 text-xs sm:text-[13px] text-slate-700 font-medium">
                        <CheckCircle2 size={15} className="text-[#214ECF] shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* CARD 2: UNITED KINGDOM */}
            <div className="bg-white rounded-3xl border-2 border-[#214ECF]/30 p-8 shadow-md hover:shadow-xl hover:border-[#214ECF] transition-all flex flex-col justify-between group relative">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl shadow-2xs">
                    🇬🇧
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white font-bold bg-[#214ECF] px-2.5 py-1 rounded-md">
                    MARKET 02
                  </span>
                </div>
                <h3 className="font-display font-bold text-2xl text-slate-900 mb-3 group-hover:text-[#214ECF] transition-colors">
                  UNITED KINGDOM
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6 font-normal">
                  Support for businesses serving customers and operating in the UK market.
                </p>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
                    FOCUS AREAS:
                  </p>
                  <ul className="space-y-2.5" role="list">
                    {[
                      "Customer Experience",
                      "Business Operations",
                      "Back-office Support",
                      "Technology-enabled Services",
                    ].map((pt) => (
                      <li key={pt} className="flex items-center gap-2 text-xs sm:text-[13px] text-slate-700 font-medium">
                        <CheckCircle2 size={15} className="text-[#214ECF] shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* CARD 3: GLOBAL */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs hover:shadow-xl hover:border-[#214ECF]/50 transition-all flex flex-col justify-between group">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl shadow-2xs">
                    🌎
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#214ECF] font-bold bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                    MARKET 03
                  </span>
                </div>
                <h3 className="font-display font-bold text-2xl text-slate-900 mb-3 group-hover:text-[#214ECF] transition-colors">
                  GLOBAL
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6 font-normal">
                  Flexible operating models designed around international business requirements.
                </p>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">
                    FOCUS AREAS:
                  </p>
                  <ul className="space-y-2.5" role="list">
                    {[
                      "Customer Experience",
                      "Business Process Outsourcing",
                      "Digital Operations",
                      "Technology Services",
                    ].map((pt) => (
                      <li key={pt} className="flex items-center gap-2 text-xs sm:text-[13px] text-slate-700 font-medium">
                        <CheckCircle2 size={15} className="text-[#214ECF] shrink-0" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-xs sm:text-sm text-slate-500 font-medium">
            * These cards describe service markets supported by Thinkatic operations, not physical branch offices.
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. HOW GLOBAL DELIVERY WORKS (Interactive 6-Step Timeline)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section id="delivery-model" className="py-20 md:py-28 bg-white border-b border-slate-100 scroll-mt-20">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16 md:mb-20">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                OPERATIONAL TIMELINE
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              How Our Global Delivery Model Works
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              A structured six-step engagement framework ensuring predictability from onboarding to full-scale operations.
            </p>
          </div>

          {/* 6-Step Process Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
            {[
              {
                step: "01",
                title: "UNDERSTAND",
                desc: "We understand your business, customers, workflows, requirements, and objectives.",
              },
              {
                step: "02",
                title: "DESIGN",
                desc: "We design the appropriate operating model, workflows, roles, technology, and performance structure.",
              },
              {
                step: "03",
                title: "BUILD",
                desc: "We establish teams, processes, documentation, systems, and operational requirements.",
              },
              {
                step: "04",
                title: "OPERATE",
                desc: "Trained professionals execute the agreed processes according to defined standards.",
              },
              {
                step: "05",
                title: "MEASURE",
                desc: "Performance can be structured around agreed metrics such as quality, productivity, response time, resolution time, and process accuracy.",
              },
              {
                step: "06",
                title: "SCALE",
                desc: "The operating model can expand as business demand and requirements grow.",
              },
            ].map((st) => (
              <div
                key={st.step}
                className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono font-black text-2xl sm:text-3xl text-[#214ECF]">
                      {st.step}
                    </span>
                    <span className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] text-xs font-bold font-mono">
                      ✓
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-slate-900 mb-2">
                    {st.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {st.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Sequential Timeline Flow Bar */}
          <div className="max-w-4xl mx-auto rounded-2xl bg-slate-50 border border-slate-200 p-5 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs font-mono font-bold text-slate-700">
            <span className="text-[#214ECF]">Understand</span>
            <span>→</span>
            <span className="text-[#214ECF]">Design</span>
            <span>→</span>
            <span className="text-[#214ECF]">Build</span>
            <span>→</span>
            <span className="text-[#214ECF]">Operate</span>
            <span>→</span>
            <span className="text-[#214ECF]">Measure</span>
            <span>→</span>
            <span className="px-3 py-1 rounded bg-[#214ECF] text-white">Scale</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. TIME-ZONE / GLOBAL OPERATIONS
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <Clock size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                OPERATIONAL FLEXIBILITY
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Designed for Global Operations
            </h2>
            <div className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal space-y-2 max-w-2xl mx-auto">
              <p>
                Global businesses often need operations that work across different markets, schedules, and customer expectations.
              </p>
              <p className="font-medium text-slate-900">
                Thinkatic can structure delivery models around the operational requirements of each business.
              </p>
            </div>
          </div>

          {/* 3 Time-Zone Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-10">
            {/* CARD 1 */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs hover:shadow-lg transition-all text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-5 shadow-2xs">
                <Clock size={26} />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-900 mb-3">
                TIME-ZONE ALIGNMENT
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Delivery schedules structured around agreed business and customer requirements.
              </p>
            </div>

            {/* CARD 2 */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs hover:shadow-lg transition-all text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-5 shadow-2xs">
                <Calendar size={26} />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-900 mb-3">
                CUSTOMER COVERAGE
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Support models designed around the hours and channels your customers require.
              </p>
            </div>

            {/* CARD 3 */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xs hover:shadow-lg transition-all text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-5 shadow-2xs">
                <Activity size={26} />
              </div>
              <h3 className="font-display font-bold text-xl text-slate-900 mb-3">
                OPERATIONAL CONTINUITY
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Structured workflows, documentation, reporting, and team processes designed to support consistent operations.
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500 font-mono">
            * Shift schedules and operational hours are established according to individual service level agreements.
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. CUSTOMER EXPERIENCE ACROSS BORDERS (With Flow)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <PhoneCall size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                OMNICHANNEL EXCELLENCE
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Consistent Customer Experience Across Markets
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              Your customers should receive a consistent experience regardless of where your operations are delivered.
            </p>
          </div>

          {/* 7 Channels Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-16 max-w-6xl mx-auto">
            {[
              { icon: PhoneCall, title: "Voice Support" },
              { icon: MessageSquare, title: "Chat Support" },
              { icon: Mail, title: "Email Support" },
              { icon: UserCheck, title: "Customer Onboarding" },
              { icon: ShieldCheck, title: "Query Resolution" },
              { icon: ShieldAlert, title: "Complaint Handling" },
              { icon: HeartHandshake, title: "Retention Support" },
            ].map((ch) => {
              const Icon = ch.icon;
              return (
                <div
                  key={ch.title}
                  className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 shadow-2xs hover:shadow-md hover:border-blue-300 hover:bg-white transition-all text-center flex flex-col items-center justify-between"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-3 shadow-2xs">
                    <Icon size={18} />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    {ch.title}
                  </h3>
                </div>
              );
            })}
          </div>

          {/* Visual Flow: Customer → Thinkatic Delivery → Trained Team → Structured Process → Quality → Better CX */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <p className="text-center text-xs font-mono uppercase tracking-widest text-[#214ECF] font-bold mb-6">
              INTEGRATED CUSTOMER EXPERIENCE PIPELINE
            </p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Input</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1">CUSTOMER</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Platform</p>
                <p className="text-xs sm:text-sm font-bold text-[#214ECF] mt-1">THINKATIC DELIVERY</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Staffing</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1">TRAINED TEAM</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Governance</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1">STRUCTURED PROCESS</p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <p className="text-[10px] font-mono text-slate-400 uppercase">Standards</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-1">QUALITY &amp; PERFORMANCE</p>
              </div>
              <div className="p-3 rounded-xl bg-[#214ECF] text-white shadow-xs">
                <p className="text-[10px] font-mono text-blue-200 uppercase">Outcome</p>
                <p className="text-xs sm:text-sm font-bold text-white mt-1">BETTER EXPERIENCE</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. GLOBAL BPO OPERATIONS (8 Capability Cards)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <Layers size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                OPERATIONAL SCALE
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Operational Support That Scales With You
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              Thinkatic helps businesses move selected operational processes into structured delivery environments so internal teams can focus on strategic priorities.
            </p>
          </div>

          {/* 8 BPO Capability Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Building2,
                title: "BACK-OFFICE OPERATIONS",
                desc: "Reliable management of core administrative tasks, file processing, and day-to-day back-office workflows.",
              },
              {
                icon: FileCheck2,
                title: "DATA PROCESSING",
                desc: "High-accuracy data entry, cleaning, formatting, and database maintenance at enterprise scale.",
              },
              {
                icon: PackageCheck,
                title: "ORDER MANAGEMENT",
                desc: "End-to-end processing of customer orders, logistics coordination, status updates, and exception handling.",
              },
              {
                icon: Target,
                title: "LEAD MANAGEMENT",
                desc: "Inbound lead verification, qualification, CRM updates, and structured handoff to sales pipelines.",
              },
              {
                icon: ShieldCheck,
                title: "VERIFICATION & VALIDATION",
                desc: "Multi-step identity, document, and transactional checks conducted with rigorous adherence to SOPs.",
              },
              {
                icon: ClipboardList,
                title: "ADMINISTRATIVE SUPPORT",
                desc: "Comprehensive executive and operational administrative assistance to keep teams operating smoothly.",
              },
              {
                icon: Sliders,
                title: "PROCESS MANAGEMENT",
                desc: "Systematic execution, oversight, and continuous quality audits of documented business procedures.",
              },
              {
                icon: Activity,
                title: "OPERATIONAL SUPPORT",
                desc: "Flexible capacity and operational coverage tailored to seasonal spikes and growth demands.",
              },
            ].map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs hover:shadow-lg hover:border-[#214ECF]/50 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all mb-5 shadow-2xs">
                      <Icon size={24} />
                    </div>
                    <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#214ECF] mb-2.5">
                      {cap.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {cap.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. QUALITY & PERFORMANCE (Measurable Metrics)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <Activity size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                MEASURABLE GOVERNANCE
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Global Delivery Should Be Measurable
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              A global delivery model needs clear expectations and measurable performance.
            </p>
          </div>

          {/* 7 Performance Categories (Cards without fake stats) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-12">
            {[
              { icon: ShieldCheck, title: "QUALITY", sub: "Adherence to defined QA standards" },
              { icon: TrendingUp, title: "PRODUCTIVITY", sub: "Consistent output & throughput" },
              { icon: Clock, title: "RESPONSE TIME", sub: "Fast initial pickup across channels" },
              { icon: CheckCircle2, title: "RESOLUTION TIME", sub: "Timely and effective case closure" },
              { icon: ThumbsUp, title: "CUSTOMER SATISFACTION", sub: "Positive feedback & sentiment" },
              { icon: Target, title: "PROCESS ACCURACY", sub: "Error-free data & workflows" },
              { icon: Zap, title: "OPERATIONAL EFFICIENCY", sub: "Continuous speed & cost optimization" },
            ].map((met) => {
              const Icon = met.icon;
              return (
                <div
                  key={met.title}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all text-center flex flex-col items-center justify-between"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-3 shadow-2xs">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-900 mb-1">
                      {met.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {met.sub}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Closing Statement */}
          <p className="text-center text-sm sm:text-base font-bold text-slate-800">
            Clear metrics. Transparent performance. Continuous improvement.
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          10. TECHNOLOGY-ENABLED GLOBAL DELIVERY (4 Cards)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <Cpu size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                DIGITAL INFRASTRUCTURE
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Technology Behind the Operation
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              Technology helps connect people, processes, information, and performance across distributed operations.
            </p>
          </div>

          {/* 4 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Server,
                title: "SYSTEMS",
                desc: "Business platforms and operational systems that support day-to-day execution.",
              },
              {
                icon: Zap,
                title: "AUTOMATION",
                desc: "Automation can reduce repetitive work and improve workflow efficiency where appropriate.",
              },
              {
                icon: Database,
                title: "DATA & REPORTING",
                desc: "Operational information can be structured into useful reporting and performance visibility.",
              },
              {
                icon: Bot,
                title: "DIGITAL OPERATIONS",
                desc: "Technology-enabled workflows that help teams work efficiently across distributed environments.",
              },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.title}
                  className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs hover:shadow-lg hover:border-[#214ECF]/50 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] group-hover:scale-105 group-hover:bg-[#214ECF] group-hover:text-white transition-all mb-5 shadow-2xs">
                      <Icon size={24} />
                    </div>
                    <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#214ECF] mb-2.5">
                      {t.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {t.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          11. THINKATIC DELIVERY PARTNER NETWORK (Trusted Partners Flow)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <Network size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                PARTNER ECOSYSTEM
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              A Delivery Model Built Around Trusted Partners
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              Thinkatic can work with verified BPO delivery partners to build operational capacity around client requirements.
            </p>
          </div>

          {/* Visual Flow Strip: CLIENT → THINKATIC → VERIFIED BPO PARTNER → TRAINED AGENTS → OPERATIONS → QUALITY → REPORTING */}
          <div className="max-w-6xl mx-auto rounded-3xl border border-slate-200 bg-slate-50/70 p-6 sm:p-9 mb-12">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
              {[
                { step: "01", title: "CLIENT", role: "Requirements" },
                { step: "02", title: "THINKATIC", role: "Coordination" },
                { step: "03", title: "VERIFIED BPO PARTNER", role: "Audited Facility" },
                { step: "04", title: "TRAINED AGENTS", role: "Skilled Teams" },
                { step: "05", title: "OPERATIONS", role: "SOP Execution" },
                { step: "06", title: "QUALITY", role: "QA Governance" },
                { step: "07", title: "REPORTING", role: "Live Visibility" },
              ].map((item, idx) => (
                <div
                  key={item.title}
                  className={`p-4 rounded-2xl border text-center transition-all ${
                    item.title === "THINKATIC"
                      ? "bg-[#214ECF] text-white border-[#214ECF] shadow-sm"
                      : "bg-white border-slate-200 text-slate-800 shadow-2xs"
                  }`}
                >
                  <span className={`text-[10px] font-mono uppercase tracking-wider block mb-1 font-bold ${
                    item.title === "THINKATIC" ? "text-blue-200" : "text-slate-400"
                  }`}>
                    {item.step}
                  </span>
                  <h3 className={`font-mono font-bold text-xs uppercase leading-tight mb-1 ${
                    item.title === "THINKATIC" ? "text-white" : "text-slate-900"
                  }`}>
                    {item.title}
                  </h3>
                  <p className={`text-[11px] leading-tight ${
                    item.title === "THINKATIC" ? "text-blue-100" : "text-slate-500"
                  }`}>
                    {item.role}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Explanation Box */}
          <div className="max-w-3xl mx-auto rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-xs text-center">
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-normal">
              Thinkatic coordinates requirements, delivery structures, operational standards, and performance visibility while verified delivery partners support execution according to agreed requirements.
            </p>
            <p className="text-xs text-slate-400 mt-4 font-mono">
              * The "Verified BPO Partner" designation applies strictly to partners that have passed Thinkatic's rigorous physical centre and operational audit workflow.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          12. SCALABLE DELIVERY (START → GROW → SCALE)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <TrendingUp size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                FLEXIBLE EXPANSION
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Start With What You Need.
              <br />
              <span className="text-[#214ECF]">Scale When You Need It.</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              Businesses do not always need the same level of operational capacity. Thinkatic's delivery approach can be structured to support businesses as requirements evolve.
            </p>
          </div>

          {/* 3 Stages Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-10">
            {/* STAGE 1: START */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center">
              <span className="text-[11px] font-mono font-bold text-[#214ECF] uppercase tracking-widest block mb-2">
                PHASE 01
              </span>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-3">
                START
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Launch a defined operational process with targeted scope and baseline team resources.
              </p>
            </div>

            {/* STAGE 2: GROW */}
            <div className="bg-white rounded-3xl border-2 border-[#214ECF]/30 p-8 shadow-md hover:shadow-xl transition-all text-center flex flex-col items-center">
              <span className="text-[11px] font-mono font-bold text-[#214ECF] uppercase tracking-widest block mb-2">
                PHASE 02
              </span>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-3">
                GROW
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Increase capacity as demand increases, expanding agent rosters and operational hours.
              </p>
            </div>

            {/* STAGE 3: SCALE */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs hover:shadow-md transition-all text-center flex flex-col items-center">
              <span className="text-[11px] font-mono font-bold text-[#214ECF] uppercase tracking-widest block mb-2">
                PHASE 03
              </span>
              <h3 className="font-display font-bold text-2xl text-slate-900 mb-3">
                SCALE
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Expand the operating model across additional processes, business units, or customer channels.
              </p>
            </div>
          </div>

          {/* Visual Progression Strip */}
          <div className="max-w-2xl mx-auto rounded-2xl bg-white border border-slate-200 p-4 shadow-2xs flex items-center justify-center gap-4 text-xs font-mono font-bold text-slate-800">
            <span className="text-[#214ECF]">START</span>
            <span>→</span>
            <span className="text-[#214ECF]">GROW</span>
            <span>→</span>
            <span className="px-3.5 py-1 rounded-lg bg-[#214ECF] text-white">SCALE</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          13. WHO GLOBAL DELIVERY IS FOR (4 Cards)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-100">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                AUDIENCE SEGMENTS
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Built for Businesses at Different Stages
            </h2>
          </div>

          {/* 4 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Rocket,
                stage: "STARTUPS",
                desc: "Build operational capability without creating every function internally.",
              },
              {
                icon: TrendingUp,
                stage: "GROWING BUSINESSES",
                desc: "Increase capacity while maintaining focus on core business priorities.",
              },
              {
                icon: Sliders,
                stage: "ESTABLISHED BUSINESSES",
                desc: "Optimise existing operations and improve process efficiency.",
              },
              {
                icon: Building2,
                stage: "ENTERPRISES",
                desc: "Structure scalable delivery models around complex operational requirements.",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.stage}
                  className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] mb-5 shadow-2xs">
                      <Icon size={24} />
                    </div>
                    <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#214ECF] mb-2.5">
                      {c.stage}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                      {c.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          14. INDUSTRIES WE SUPPORT (8 Cards)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50/70 border-b border-slate-200/80">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          {/* Header */}
          <div className="max-w-3xl mx-auto text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-50 border border-blue-200 mb-4">
              <Globe size={14} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-[#214ECF] font-bold">
                INDUSTRY VERTICALS
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-4">
              Supporting Different Industries
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
              Thinkatic provides technology-enabled outsourcing and operational solutions tailored to industry-specific workflows.
            </p>
          </div>

          {/* 8 Industry Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
            {[
              { icon: Cpu, name: "Technology" },
              { icon: ShoppingBag, name: "E-commerce" },
              { icon: Plane, name: "Travel" },
              { icon: CreditCard, name: "Financial Services" },
              { icon: Stethoscope, name: "Healthcare" },
              { icon: Users, name: "Consumer Businesses" },
              { icon: Rocket, name: "Startups" },
              { icon: Building2, name: "Enterprises" },
            ].map((ind) => {
              const Icon = ind.icon;
              return (
                <div
                  key={ind.name}
                  className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-blue-300 hover:-translate-y-1 transition-all text-center flex flex-col items-center justify-center group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF] group-hover:bg-[#214ECF] group-hover:text-white transition-all mb-3 shadow-2xs">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-[#214ECF] transition-colors">
                    {ind.name}
                  </h3>
                </div>
              );
            })}
          </div>

          {/* Description Below */}
          <p className="text-center text-xs sm:text-sm text-slate-500 font-medium">
            Solutions can be customised according to industry requirements and process complexity.
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          15. WHY THINKATIC (Deep Navy Section)
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#0B1226] text-white border-b border-slate-800">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <div className="max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center px-3 py-1 rounded-md bg-blue-900/60 border border-blue-500/40 mb-4">
              <span className="text-[11px] font-mono uppercase tracking-[0.25em] text-blue-300 font-bold">
                PARTNERSHIP PHILOSOPHY
              </span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight mb-4">
              More Than a Delivery Provider
            </h2>
            <div className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal space-y-2">
              <p>Thinkatic works as an extension of your business.</p>
              <p>
                We focus on understanding the process, the customer, the operational requirement, and the outcome — not simply completing individual tasks.
              </p>
            </div>
          </div>

          {/* 4 Pillars Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-12">
            {[
              {
                icon: Users,
                title: "PEOPLE",
                desc: "Skilled professionals.",
              },
              {
                icon: Workflow,
                title: "PROCESS",
                desc: "Structured workflows.",
              },
              {
                icon: Cpu,
                title: "TECHNOLOGY",
                desc: "Technology-enabled operations.",
              },
              {
                icon: Activity,
                title: "PERFORMANCE",
                desc: "Clear measurement and continuous improvement.",
              },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-sm text-center flex flex-col items-center justify-between hover:border-blue-500/50 transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-950 border border-blue-800 flex items-center justify-center text-[#38BDF8] mb-5 shadow-2xs">
                    <Icon size={26} />
                  </div>
                  <div>
                    <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-white mb-2">
                      {p.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Closing Summary */}
          <div className="pt-8 border-t border-slate-800/80 max-w-xl mx-auto">
            <p className="text-base sm:text-lg font-bold text-white">
              One connected operating model. Built around your business.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          16. FINAL FULL-WIDTH CTA SECTION
      ────────────────────────────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-slate-50 to-blue-50/60 border-t border-slate-200/80 relative overflow-hidden">
        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="font-display font-black text-3xl sm:text-4xl md:text-5xl text-slate-900 tracking-tight leading-tight mb-6">
              Ready to Build Your Global Delivery Operation?
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal mb-8">
              Whether you need customer support, business process outsourcing, technology-enabled operations, or a scalable delivery model, Thinkatic can help you design an operation built around your business.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/contact">
                <button className="h-12 px-8 rounded-xl bg-[#214ECF] hover:bg-[#1A43C8] text-white font-bold text-sm tracking-wide transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer">
                  <span>Talk to Thinkatic</span>
                  <ArrowRight size={16} />
                </button>
              </Link>
              <Link href="/contact">
                <button className="h-12 px-7 rounded-xl border border-slate-300 hover:border-[#214ECF] bg-white hover:bg-slate-50 text-slate-800 hover:text-[#214ECF] font-bold text-sm tracking-wide transition-all shadow-xs hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer">
                  <span>Request a Consultation</span>
                  <ChevronRight size={16} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
