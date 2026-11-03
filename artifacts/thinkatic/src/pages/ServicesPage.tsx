import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO } from "@/hooks/useSEO";
import PayPalButton from "@/components/ui/PayPalButton";
import {
  SERVICE_CATEGORIES,
  SERVICE_PACKAGES,
  ServiceCategoryKey,
  ServicePackage,
  getPackageById,
  getPackagesByCategory,
  getFeaturedPackages,
  useAuthoritativePlans,
} from "@/data/servicesCatalogue";
import {
  Code2,
  Bot,
  Workflow,
  Users,
  Server,
  ArrowRight,
  ArrowDown,
  CheckCircle2,
  Check,
  Search,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  Clock,
  Briefcase,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  X,
  Lock,
  Mail,
  User,
  Building2,
  AlertCircle,
  Loader2,
  Headphones,
  Cpu,
  Layers,
  ShoppingBag,
  FileCheck2,
} from "lucide-react";

// Animation Variants
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
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const CATEGORY_ICONS: Record<ServiceCategoryKey, React.ComponentType<{ size?: number; className?: string }>> = {
  BUILD: Code2,
  AI: Bot,
  AUTOMATE: Workflow,
  SCALE: Users,
  OPERATE: Server,
};

export default function ServicesPage() {
  const [, setLocation] = useLocation();

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ServiceCategoryKey | "ALL">("ALL");
  const [pricingFilter, setPricingFilter] = useState<"ALL" | "ONE_TIME" | "MONTHLY" | "CUSTOM" | "POPULAR">("ALL");

  // Detail Modal & Get Started Flow State
  const [selectedDetailPackage, setSelectedDetailPackage] = useState<ServicePackage | null>(null);
  const [getStartedPackage, setGetStartedPackage] = useState<ServicePackage | null>(null);

  // Authentication State for Get Started Flow
  const [isAuth, setIsAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Signup/Login Form Fields
  const [authFullName, setAuthFullName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authCompanyName, setAuthCompanyName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authAgreeTerms, setAuthAgreeTerms] = useState(false);

  // Custom Requirement Form Fields (for custom/range pricing)
  const [reqTimeline, setReqTimeline] = useState("1–3 Months");
  const [reqMessage, setReqMessage] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqSuccessRef, setReqSuccessRef] = useState<string | null>(null);

  // Checkout Payment Method Tab
  const [paymentTab, setPaymentTab] = useState<"paypal" | "wire">("paypal");

  const { packages: allPackages, loading: catalogueLoading, error: catalogueError, refetch: refetchCatalogue } = useAuthoritativePlans();

  // Check auth state on mount and url parameters
  useEffect(() => {
    const token = localStorage.getItem("user_token");
    setIsAuth(Boolean(token));

    // Check if user arrived with ?package=... or ?purchase=...
    const params = new URLSearchParams(window.location.search);
    const targetPkgId = params.get("package") || params.get("purchase") || params.get("plan");
    if (targetPkgId && allPackages.length > 0) {
      const match = allPackages.find((p) => p.id === targetPkgId || p.slug === targetPkgId);
      if (match) {
        setGetStartedPackage(match);
      }
    }
  }, [allPackages]);

  useSEO({
    title: "Thinkatic Services | Technology, AI, Automation & BPO",
    description:
      "Explore Thinkatic technology, AI, automation, software development, QA, dedicated developers, maintenance and BPO services.",
    path: "/services",
  });

  const featuredPackages = useMemo(() => {
    const featured = allPackages.filter((p) => p.isFeatured || p.isPopular);
    return featured.length > 0 ? featured.slice(0, 6) : allPackages.slice(0, 6);
  }, [allPackages]);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return allPackages.filter((pkg) => {
      // Category filter
      if (activeCategory !== "ALL" && pkg.category !== activeCategory) {
        return false;
      }

      // Pricing type filter
      if (pricingFilter === "POPULAR" && !pkg.isPopular) return false;
      if (pricingFilter === "ONE_TIME" && pkg.billingCycle !== "one_time") return false;
      if (pricingFilter === "MONTHLY" && pkg.billingCycle !== "monthly") return false;
      if (pricingFilter === "CUSTOM" && pkg.priceType !== "CUSTOM") return false;

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inName = pkg.packageName.toLowerCase().includes(query);
        const inService = pkg.serviceName.toLowerCase().includes(query);
        const inCategory = pkg.category.toLowerCase().includes(query);
        const inDesc = pkg.description.toLowerCase().includes(query);
        const inFeatures = pkg.features.some((f) => f.toLowerCase().includes(query));
        const inTarget = pkg.targetCustomer?.toLowerCase().includes(query);
        if (!inName && !inService && !inCategory && !inDesc && !inFeatures && !inTarget) {
          return false;
        }
      }

      return true;
    });
  }, [allPackages, activeCategory, pricingFilter, searchQuery]);

  // Smooth scroll helper
  const scrollToCategory = (catKey: ServiceCategoryKey) => {
    setActiveCategory(catKey);
    const el = document.getElementById(`category-${catKey.toLowerCase()}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleOpenGetStarted = (pkg: ServicePackage) => {
    setGetStartedPackage(pkg);
    // Persist pending package in session storage
    try {
      sessionStorage.setItem("thinkatic_pending_package", JSON.stringify(pkg));
    } catch {}

    const token = localStorage.getItem("user_token");
    setIsAuth(Boolean(token));
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        if (!authFullName.trim() || authFullName.trim().length < 2) {
          throw new Error("Please enter your full name.");
        }
        if (!authEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail.trim())) {
          throw new Error("Please enter a valid work email address.");
        }
        if (!authCompanyName.trim()) {
          throw new Error("Please enter your company or organization name.");
        }
        if (authPassword.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        if (authPassword !== authConfirmPassword) {
          throw new Error("Passwords do not match. Please verify your password.");
        }
        if (!authAgreeTerms) {
          throw new Error("Please accept the Terms of Service and Privacy Policy to continue.");
        }

        const res = await fetch("/api/user/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail.trim().toLowerCase(),
            password: authPassword,
            fullName: authFullName.trim(),
            companyName: authCompanyName.trim(),
            accountType: "USER",
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.token) {
          throw new Error(data.message || data.error || "Failed to create account.");
        }

        localStorage.setItem("user_token", data.token);
        if (data.profile) {
          localStorage.setItem("user_profile", JSON.stringify(data.profile));
        }
        setIsAuth(true);
        setAuthSuccess("Account created successfully! Continuing with your package...");
      } else {
        // Login mode
        if (!authEmail.trim() || !authPassword) {
          throw new Error("Please enter your email and password.");
        }

        const res = await fetch("/api/user/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authEmail.trim().toLowerCase(),
            password: authPassword,
            accountType: "USER",
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.token) {
          throw new Error(data.message || data.error || "Invalid login credentials.");
        }

        localStorage.setItem("user_token", data.token);
        if (data.profile) {
          localStorage.setItem("user_profile", JSON.stringify(data.profile));
        }
        setIsAuth(true);
        setAuthSuccess("Welcome back! Continuing with your selected package...");
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCustomRequirementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqMessage.trim() || reqMessage.trim().length < 10) {
      alert("Please provide at least 10 characters describing your project requirement.");
      return;
    }

    setReqSubmitting(true);
    try {
      const userProfileStr = localStorage.getItem("user_profile");
      const userProfile = userProfileStr ? JSON.parse(userProfileStr) : {};

      const fullMessage = [
        `Service Package: ${getStartedPackage?.serviceName} — ${getStartedPackage?.packageName}`,
        `Price / Terms: ${getStartedPackage?.priceDisplay}`,
        `Target Timeline: ${reqTimeline}`,
        "",
        "Client Requirement Description:",
        reqMessage.trim(),
      ].join("\n");

      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userProfile.fullName || authFullName || "Client User",
          email: userProfile.email || authEmail || "client@company.com",
          company: userProfile.bpoApplicationDetails?.companyName || authCompanyName || "Enterprise Client",
          budget: getStartedPackage?.priceDisplay || "Custom Consultation",
          message: fullMessage,
          source: "services_page_consultation",
        }),
      });

      const data = await res.json().catch(() => ({}));
      const ref = data.id ? `THK-ENQ-${String(data.id).padStart(4, "0")}` : `THK-SRV-${Date.now().toString().slice(-4)}`;
      setReqSuccessRef(ref);
    } catch (err) {
      console.error("Requirement submission error:", err);
      setReqSuccessRef(`THK-SRV-${Date.now().toString().slice(-4)}`);
    } finally {
      setReqSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/50 pb-24">
        {/* ─────────────────────────────────────────────────────────────────────────────
            1. HERO SECTION (Dark Premium Hero Matching Reference Screenshot)
        ────────────────────────────────────────────────────────────────────────────── */}
        <section className="relative pt-32 sm:pt-36 lg:pt-40 pb-20 lg:pb-28 overflow-hidden text-white border-b border-slate-800"
          style={{
            background: "linear-gradient(135deg, #070D1E 0%, #0B1226 50%, #0D1733 100%)",
          }}
        >
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#214ECF]/15 rounded-full blur-[140px] pointer-events-none -z-0" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none -z-0" />

          {/* Subtle Network Constellation Lines on the Right */}
          <div className="absolute top-1/2 right-4 -translate-y-1/2 w-96 h-96 opacity-20 pointer-events-none hidden lg:block">
            <svg viewBox="0 0 400 400" className="w-full h-full animate-spin-slow">
              <circle cx="200" cy="200" r="160" stroke="#214ECF" strokeWidth="1" strokeDasharray="4 6" fill="none" />
              <circle cx="200" cy="200" r="110" stroke="#47A3FF" strokeWidth="1" strokeDasharray="3 5" fill="none" />
              <circle cx="200" cy="200" r="60" stroke="#214ECF" strokeWidth="1.5" fill="none" />
              <circle cx="200" cy="40" r="5" fill="#47A3FF" />
              <circle cx="340" cy="200" r="5" fill="#214ECF" />
              <circle cx="200" cy="360" r="5" fill="#47A3FF" />
              <circle cx="60" cy="200" r="5" fill="#214ECF" />
            </svg>
          </div>

          <div className="relative z-10 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Heading & Introduction */}
              <div className="lg:col-span-7 xl:col-span-8">
                <motion.div initial="hidden" animate="visible" variants={fadeUp} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-[#47A3FF] mb-5">
                  <span className="w-2 h-2 rounded-full bg-[#47A3FF] animate-pulse" />
                  <span className="text-[11px] font-mono font-bold tracking-widest uppercase">
                    OUR SERVICES
                  </span>
                </motion.div>

                <motion.h1
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.05 }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-white"
                >
                  Technology, AI &amp; Business Process Solutions
                </motion.h1>

                <motion.p
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.1 }}
                  className="text-slate-300 text-base sm:text-lg lg:text-xl max-w-2xl leading-relaxed mb-8"
                >
                  From building your digital presence to scaling your operations, Thinkatic provides technology,
                  customer experience and business process solutions designed around your business requirements.
                </motion.p>

                {/* Hero Action Buttons */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.15 }}
                  className="flex flex-col sm:flex-row gap-3.5 items-stretch sm:items-center"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("catalogue-navigation");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-lg shadow-blue-500/20 inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Explore Services</span>
                    <ArrowDown size={15} />
                  </button>

                  <Link
                    href="/contact"
                    className="px-7 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-200 bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25 transition-all duration-150 inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Talk to Thinkatic</span>
                    <ArrowRight size={15} />
                  </Link>
                </motion.div>
              </div>

              {/* Right Column: 4 Trust Pillars (Matching Reference Screenshot) */}
              <div className="lg:col-span-5 xl:col-span-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-[#47A3FF] flex items-center justify-center mb-3">
                      <Zap size={20} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Cost Effective</h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                      Get world-class technology & talent at competitive rates.
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-[#47A3FF] flex items-center justify-center mb-3">
                      <Globe size={20} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Global Talent</h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                      Skilled teams from India, available worldwide for US & UK shifts.
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-[#47A3FF] flex items-center justify-center mb-3">
                      <Layers size={20} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Flexible & Scalable</h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                      Scale your team and capabilities seamlessly as you grow.
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-[#47A3FF] flex items-center justify-center mb-3">
                      <ShieldCheck size={20} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-white mb-1">Dedicated Support</h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                      Your operational continuity and success is our priority.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
            2. CATEGORY NAVIGATION (Matching Reference Screenshot Category Cards)
        ────────────────────────────────────────────────────────────────────────────── */}
        <section id="catalogue-navigation" className="sticky top-[68px] sm:top-[72px] z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 py-3 shadow-2xs">
          <div className="w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setActiveCategory("ALL")}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  activeCategory === "ALL"
                    ? "bg-[#214ECF] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200/70"
                }`}
              >
                All Categories
              </button>

              {SERVICE_CATEGORIES.map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.key];
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => scrollToCategory(cat.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-[#214ECF] text-white shadow-xs font-bold"
                        : "bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold"
                    }`}
                  >
                    <IconComponent size={14} className={isActive ? "text-white" : "text-[#214ECF]"} />
                    <span>{cat.title}</span>
                    <span className={`text-[10px] hidden sm:inline ${isActive ? "text-blue-100" : "text-slate-400"}`}>
                      ({cat.chips[0]})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
            3. FEATURED PACKAGES SECTION (Matching Reference Screenshot Row)
        ────────────────────────────────────────────────────────────────────────────── */}
        <section className="pt-16 pb-12 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                  FEATURED PACKAGES
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B1226] tracking-tight">
                Start with What You Need. Grow When You're Ready.
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xl">
                Our most popular packages to get you started, with a clear path to scale your business.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("full-service-catalogue");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs font-bold text-[#214ECF] hover:text-[#1A3DB3] inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>View All Services</span>
              <ArrowDown size={14} />
            </button>
          </div>

          {/* 6 Featured Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {featuredPackages.map((pkg) => {
              const IconComp = CATEGORY_ICONS[pkg.category];
              return (
                <div
                  key={pkg.id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-[#214ECF]/50 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#214ECF] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                      <IconComp size={18} />
                    </div>

                    <div className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400 mb-0.5">
                      {pkg.category}
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1226] mb-1 leading-snug">
                      {pkg.serviceName}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                      {pkg.description}
                    </p>
                  </div>

                  <div>
                    <div className="pt-3 border-t border-slate-100 mb-3">
                      <div className="text-lg font-extrabold text-[#0B1226]">
                        {pkg.priceDisplay}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {pkg.priceType === "FIXED" ? "Fixed price" : "Starting from"}
                      </div>
                    </div>

                    <button
                      type="button"
                      data-package-id={pkg.id}
                      data-cta="get-started"
                      onClick={() => handleOpenGetStarted(pkg)}
                      className="w-full py-2.5 rounded-xl font-bold text-xs text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    >
                      <span>Get Started</span>
                      <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
            4. SEARCH & QUICK FILTER BAR
        ────────────────────────────────────────────────────────────────────────────── */}
        <section id="full-service-catalogue" className="pt-8 pb-8 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services (e.g. website, AI, developer, automation)..."
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/10 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Secondary Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
              <span className="text-[11px] font-mono font-bold uppercase text-slate-400 shrink-0 flex items-center gap-1">
                <SlidersHorizontal size={12} />
                Filter:
              </span>
              {[
                { label: "All Pricing", val: "ALL" },
                { label: "One-Time", val: "ONE_TIME" },
                { label: "Monthly", val: "MONTHLY" },
                { label: "Custom Scope", val: "CUSTOM" },
                { label: "Recommended", val: "POPULAR" },
              ].map((f) => (
                <button
                  key={f.val}
                  type="button"
                  onClick={() => setPricingFilter(f.val as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                    pricingFilter === f.val
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
            5. COMPREHENSIVE CATEGORY SECTIONS (ALL 29 PACKAGES)
        ────────────────────────────────────────────────────────────────────────────── */}
        <div className="space-y-20 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          {SERVICE_CATEGORIES.map((category) => {
            const packagesInCat = filteredPackages.filter((p) => p.category === category.key);
            if (packagesInCat.length === 0 && (searchQuery || pricingFilter !== "ALL")) {
              return null; // Don't show empty categories when searching
            }

            const IconComponent = CATEGORY_ICONS[category.key];

            return (
              <section key={category.key} id={`category-${category.key.toLowerCase()}`} className="scroll-mt-28">
                {/* Category Header */}
                <div className="mb-8 pb-4 border-b border-slate-200/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#214ECF] flex items-center justify-center">
                          <IconComponent size={15} />
                        </div>
                        <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                          CATEGORY {category.key}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1226] tracking-tight">
                        {category.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        {category.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {category.chips.map((chip) => (
                        <span key={chip} className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-600">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Package Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {packagesInCat.map((pkg) => (
                    <div
                      key={pkg.id}
                      className={`bg-white rounded-3xl p-6 sm:p-7 border transition-all duration-200 flex flex-col justify-between relative group ${
                        pkg.isPopular
                          ? "border-[#214ECF] shadow-lg shadow-blue-500/5 ring-1 ring-[#214ECF]/20"
                          : "border-slate-200/90 shadow-xs hover:border-[#214ECF]/50 hover:shadow-md"
                      }`}
                    >
                      {/* Merchandising Badge */}
                      {pkg.isPopular && (
                        <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-[#214ECF] text-white text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm">
                          RECOMMENDED PACKAGE
                        </div>
                      )}

                      <div>
                        {/* Service / Category Subtitle */}
                        <div className="text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                          {pkg.serviceName}
                        </div>
                        <h3 className="text-xl font-extrabold text-[#0B1226] mb-2">
                          {pkg.packageName}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed mb-6">
                          {pkg.description}
                        </p>

                        {/* Price Display */}
                        <div className="mb-6 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-baseline justify-between">
                          <div>
                            <span className="text-2xl sm:text-3xl font-extrabold text-[#0B1226] tracking-tight">
                              {pkg.priceDisplay}
                            </span>
                            <span className="block text-[11px] text-slate-400 font-medium mt-0.5">
                              {pkg.priceType === "FIXED"
                                ? pkg.billingCycle === "monthly" ? "Per month subscription" : "One-time investment"
                                : pkg.priceType === "CUSTOM" ? "Scope consultation" : "Starting baseline"}
                            </span>
                          </div>
                          {pkg.deliveryTimeline && (
                            <div className="text-right">
                              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Timeline</span>
                              <span className="text-xs font-bold text-[#214ECF]">{pkg.deliveryTimeline}</span>
                            </div>
                          )}
                        </div>

                        {/* Feature List */}
                        <div className="space-y-2.5 mb-8">
                          <div className="text-[11px] font-mono uppercase font-bold text-slate-400 tracking-wider">
                            INCLUDED IN THIS PLAN
                          </div>
                          {pkg.features.slice(0, 7).map((feat, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 leading-snug">
                              <CheckCircle2 size={15} className="text-[#214ECF] mt-0.5 shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                          {pkg.features.length > 7 && (
                            <button
                              type="button"
                              onClick={() => setSelectedDetailPackage(pkg)}
                              className="text-[11px] font-bold text-[#214ECF] hover:underline pt-1 inline-block cursor-pointer"
                            >
                              + {pkg.features.length - 7} more features...
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          data-package-id={pkg.id}
                          data-cta="get-started"
                          onClick={() => handleOpenGetStarted(pkg)}
                          className="w-full h-11 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>{pkg.ctaLabel}</span>
                          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedDetailPackage(pkg)}
                          className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        >
                          View Plan Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            6. HOW TO GET STARTED (Section 30)
        ────────────────────────────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-16 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#214ECF]" />
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#214ECF]">
                STRUCTURED WORKFLOW
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1226] tracking-tight">
              How It Works
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              From package selection to verified delivery, our onboarding process is transparent and disciplined.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative">
              <div className="text-3xl font-extrabold text-blue-100 font-mono mb-2">01</div>
              <h3 className="text-base font-bold text-[#0B1226] mb-1">CHOOSE</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Explore services and choose the package that aligns with your timeline and business goals.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative">
              <div className="text-3xl font-extrabold text-blue-100 font-mono mb-2">02</div>
              <h3 className="text-base font-bold text-[#0B1226] mb-1">CREATE YOUR ACCOUNT</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Create or log into your Thinkatic client account. Your selected package is preserved seamlessly.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative">
              <div className="text-3xl font-extrabold text-blue-100 font-mono mb-2">03</div>
              <h3 className="text-base font-bold text-[#0B1226] mb-1">START YOUR SERVICE</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Complete checkout for fixed-price packages or submit specific requirements for custom scopes.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs relative">
              <div className="text-3xl font-extrabold text-blue-100 font-mono mb-2">04</div>
              <h3 className="text-base font-bold text-[#0B1226] mb-1">BUILD & DELIVER</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Work directly with Thinkatic engineers and delivery centres through your authorized client portal.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────────────────────
            7. CUSTOM SOLUTIONS & CONTACT CTA (Sections 31 & 32)
        ────────────────────────────────────────────────────────────────────────────── */}
        <section className="pt-12 w-full max-w-[94vw] 2xl:max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="rounded-3xl p-8 sm:p-12 lg:p-16 text-white shadow-xl relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #070D1E 0%, #0B1226 50%, #1A3DB3 100%)",
            }}
          >
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#47A3FF]" />
                <span className="text-xs font-mono font-bold tracking-widest uppercase text-blue-300">
                  CUSTOM SCOPE AVAILABLE
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                Don't See Exactly What You Need?
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Every business is different. If your operational requirement doesn't fit into an existing package,
                our advisory team can discuss a custom solution built specifically for your enterprise.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/contact"
                  className="px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-[#0B1226] bg-white hover:bg-slate-100 transition-all shadow-md inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Talk to Thinkatic</span>
                  <ArrowRight size={14} />
                </Link>
                <Link
                  href="/faqs"
                  className="px-7 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-200 border border-white/20 hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Read FAQs</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. PACKAGE DETAIL MODAL (Opens when clicking 'View Plan Details')
      ────────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDetailPackage && (
          <div id="package-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto relative"
            >
              <button
                type="button"
                onClick={() => setSelectedDetailPackage(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="space-y-6">
                <div>
                  <div className="text-xs font-mono font-bold uppercase text-[#214ECF] mb-1">
                    {selectedDetailPackage.category} / {selectedDetailPackage.serviceName}
                  </div>
                  <h3 className="text-2xl font-extrabold text-[#0B1226]">
                    {selectedDetailPackage.packageName}
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    {selectedDetailPackage.description}
                  </p>
                </div>

                {/* Price Box */}
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-extrabold text-[#0B1226]">
                      {selectedDetailPackage.priceDisplay}
                    </span>
                    <span className="block text-xs text-slate-500 font-medium">
                      {selectedDetailPackage.priceType === "FIXED" ? "Fixed price investment" : "Estimated engagement pricing"}
                    </span>
                  </div>
                  {selectedDetailPackage.deliveryTimeline && (
                    <div className="text-right">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Timeline</span>
                      <span className="text-xs font-bold text-[#214ECF]">{selectedDetailPackage.deliveryTimeline}</span>
                    </div>
                  )}
                </div>

                {/* Inclusions */}
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
                    WHAT IS INCLUDED
                  </h4>
                  <div className="space-y-2">
                    {selectedDetailPackage.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                        <CheckCircle2 size={16} className="text-[#214ECF] mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Support Period & Integrations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                  {selectedDetailPackage.supportPeriod && (
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">Support Period:</span>
                      <span className="text-slate-500">{selectedDetailPackage.supportPeriod}</span>
                    </div>
                  )}
                  {selectedDetailPackage.targetCustomer && (
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">Designed For:</span>
                      <span className="text-slate-500">{selectedDetailPackage.targetCustomer}</span>
                    </div>
                  )}
                </div>

                {selectedDetailPackage.importantNotes && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 leading-relaxed">
                    <strong>Important Note:</strong> {selectedDetailPackage.importantNotes}
                  </div>
                )}

                {/* Modal CTA */}
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const pkg = selectedDetailPackage;
                      setSelectedDetailPackage(null);
                      handleOpenGetStarted(pkg);
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Get Started with {selectedDetailPackage.packageName}</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailPackage(null)}
                    className="px-5 py-3 rounded-xl text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. GET STARTED CLIENT ACCOUNT & CHECKOUT MODAL (Survives Refresh & Login)
      ────────────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {getStartedPackage && (
          <div id="get-started-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto relative"
            >
              <button
                type="button"
                onClick={() => setGetStartedPackage(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              {/* Selected Plan Summary Banner (Never Lost) */}
              <div className="mb-6 p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#214ECF]">SELECTED PACKAGE</span>
                  <div className="text-sm sm:text-base font-extrabold text-[#0B1226]">
                    {getStartedPackage.serviceName} — {getStartedPackage.packageName}
                  </div>
                  <span className="text-xs text-slate-500 font-semibold">{getStartedPackage.priceDisplay}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white text-[#214ECF] flex items-center justify-center shadow-xs">
                  <Check size={16} />
                </div>
              </div>

              {!isAuth ? (
                /* ── STEP A: USER NOT LOGGED IN -> ACCOUNT CREATION / LOGIN ── */
                <div>
                  <div className="text-center mb-6">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-[#0B1226]">
                      {authMode === "signup" ? "Create Your Thinkatic Account" : "Sign In to Your Account"}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      {authMode === "signup"
                        ? "Create your client account to continue with this package."
                        : "Welcome back! Sign in to activate your selected service."}
                    </p>
                  </div>

                  {authError && (
                    <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  {authSuccess && (
                    <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-start gap-2">
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{authSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    {authMode === "signup" && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            Full Name <span className="text-[#214ECF]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={authFullName}
                            onChange={(e) => setAuthFullName(e.target.value)}
                            placeholder="Jane Doe"
                            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/10 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1">
                            Company Name <span className="text-[#214ECF]">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={authCompanyName}
                            onChange={(e) => setAuthCompanyName(e.target.value)}
                            placeholder="Acme Global Inc."
                            className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/10 transition-all"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Work Email <span className="text-[#214ECF]">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="jane@company.com"
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/10 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Password <span className="text-[#214ECF]">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/10 transition-all"
                      />
                    </div>

                    {authMode === "signup" && (
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Confirm Password <span className="text-[#214ECF]">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={authConfirmPassword}
                          onChange={(e) => setAuthConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/10 transition-all"
                        />
                      </div>
                    )}

                    {authMode === "signup" && (
                      <div className="flex items-start gap-2 pt-1">
                        <input
                          id="termsCheck"
                          type="checkbox"
                          checked={authAgreeTerms}
                          onChange={(e) => setAuthAgreeTerms(e.target.checked)}
                          className="mt-1 rounded text-[#214ECF] focus:ring-[#214ECF]"
                        />
                        <label htmlFor="termsCheck" className="text-[11px] text-slate-500 leading-snug">
                          I agree to Thinkatic's{" "}
                          <Link href="/terms" className="text-[#214ECF] font-semibold hover:underline">
                            Terms of Service
                          </Link>{" "}
                          and{" "}
                          <Link href="/privacy-policy" className="text-[#214ECF] font-semibold hover:underline">
                            Privacy Policy
                          </Link>
                          .
                        </label>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-11 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {authLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <span>
                          {authMode === "signup" ? "Create Account & Continue" : "Sign In & Continue"}
                        </span>
                      )}
                    </button>

                    <div className="text-center pt-2 text-xs text-slate-500">
                      {authMode === "signup" ? (
                        <>
                          Already have an account?{" "}
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("login");
                              setAuthError("");
                            }}
                            className="font-bold text-[#214ECF] hover:underline cursor-pointer"
                          >
                            Sign In
                          </button>
                        </>
                      ) : (
                        <>
                          Don't have an account?{" "}
                          <button
                            type="button"
                            onClick={() => {
                              setAuthMode("signup");
                              setAuthError("");
                            }}
                            className="font-bold text-[#214ECF] hover:underline cursor-pointer"
                          >
                            Create One
                          </button>
                        </>
                      )}
                    </div>
                  </form>
                </div>
              ) : getStartedPackage.priceType === "FIXED" ? (
                /* ── STEP B1: AUTHENTICATED USER -> FIXED-PRICE CHECKOUT ── */
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-extrabold text-[#0B1226]">
                      Activate Service Package
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Choose your preferred payment method to activate this service.
                    </p>
                  </div>

                  {/* Payment Tabs */}
                  <div className="flex border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPaymentTab("paypal")}
                      className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                        paymentTab === "paypal"
                          ? "border-[#214ECF] text-[#214ECF]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      PayPal / Card (Instant)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentTab("wire")}
                      className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                        paymentTab === "wire"
                          ? "border-[#214ECF] text-[#214ECF]"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Bank Wire Transfer
                    </button>
                  </div>

                  {paymentTab === "paypal" ? (
                    <div className="space-y-4 pt-1">
                      <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-600 flex items-start gap-2">
                        <ShieldCheck size={16} className="text-[#214ECF] shrink-0 mt-0.5" />
                        <span>
                          Instant Activation: Your order is verified in real-time. Upon completion, this plan appears
                          in your Client Portal.
                        </span>
                      </div>
                      <div className="pt-2">
                        <PayPalButton packageId={getStartedPackage.id} />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1 text-xs">
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <div className="font-bold text-slate-800">Wire / Direct Bank Transfer Details:</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div><span className="text-slate-400">Beneficiary:</span> Thinkatic Technologies Inc.</div>
                          <div><span className="text-slate-400">Bank:</span> JPMorgan Chase Bank, N.A.</div>
                          <div><span className="text-slate-400">Routing (ABA):</span> 021000021</div>
                          <div><span className="text-slate-400">SWIFT / BIC:</span> CHASUS33</div>
                          <div><span className="text-slate-400">Account:</span> 8291048291</div>
                          <div><span className="text-slate-400">Currency:</span> USD</div>
                        </div>
                        <div className="pt-2 border-t border-slate-200 text-[11px]">
                          <span className="text-slate-500">Invoice Reference: </span>
                          <span className="font-mono font-bold text-[#214ECF]">
                            THK-INV-{getStartedPackage.id.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        * Wire transfers are processed upon bank confirmation (1–2 business days). For instant automated
                        activation, please use the PayPal / Card tab.
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                    <button
                      type="button"
                      onClick={() => setLocation(`/dashboard?package=${getStartedPackage.id}`)}
                      className="font-bold text-[#214ECF] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Continue in Client Portal</span>
                      <ExternalLink size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGetStartedPackage(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── STEP B2: AUTHENTICATED USER -> CUSTOM / SCOPE CONSULTATION ── */
                <div>
                  {reqSuccessRef ? (
                    <div className="py-6 text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                        <CheckCircle2 size={28} />
                      </div>
                      <h3 className="text-xl font-extrabold text-[#0B1226]">
                        Requirement Submitted
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                        Your requirement for <strong>{getStartedPackage.packageName}</strong> has been logged into our
                        enterprise review pipeline. Our technical advisory team will reach out directly.
                      </p>
                      <div className="inline-block px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
                        Reference Code: <strong className="text-[#214ECF]">{reqSuccessRef}</strong>
                      </div>
                      <div className="pt-4 flex gap-3 justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setGetStartedPackage(null);
                            setReqSuccessRef(null);
                          }}
                          className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Back to Catalogue
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocation("/dashboard")}
                          className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#214ECF] hover:bg-[#1A3DB3] cursor-pointer"
                        >
                          Go to Client Dashboard
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleCustomRequirementSubmit} className="space-y-4">
                      <div>
                        <h3 className="text-xl font-extrabold text-[#0B1226]">
                          Submit Service Requirement
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Share your desired scope and milestones. Our team will review your objectives and establish a
                          custom commercial arrangement.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Target Project Timeline
                        </label>
                        <select
                          value={reqTimeline}
                          onChange={(e) => setReqTimeline(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-hidden focus:border-[#214ECF]"
                        >
                          <option value="As Soon As Possible">As Soon As Possible</option>
                          <option value="Within 1 Month">Within 1 Month</option>
                          <option value="1–3 Months">1–3 Months</option>
                          <option value="3–6 Months">3–6 Months</option>
                          <option value="Flexible / Exploratory">Flexible / Exploratory</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Requirement Details <span className="text-[#214ECF]">*</span>
                        </label>
                        <textarea
                          rows={4}
                          required
                          value={reqMessage}
                          onChange={(e) => setReqMessage(e.target.value)}
                          placeholder="Outline your team requirements, technology stack, current operational challenges, and desired deliverables..."
                          className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-[#214ECF] leading-relaxed"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={reqSubmitting}
                          className="w-full h-11 rounded-xl font-bold text-xs sm:text-sm text-white bg-[#214ECF] hover:bg-[#1A3DB3] disabled:bg-slate-300 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {reqSubmitting ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <span>Submit Requirement for Review</span>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
