import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Link, useParams, useLocation } from "wouter";
import Layout from "@/components/layout/Layout";
import { services, BLUE, BLUE_DIM, BLUE_BORDER } from "@/data/services-data";
import {
  SERVICE_PACKAGES,
  ServicePackage,
  getPackagesByCategory,
  useAuthoritativePlans,
} from "@/data/servicesCatalogue";
import NotFound from "@/pages/not-found";
import { useSEO } from "@/hooks/useSEO";
import {
  CheckCircle2,
  ArrowRight,
  Clock,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Zap,
  Info,
  Layers,
  Check,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

function Badge({ text }: { text: string }) {
  return (
    <span
      className="px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: BLUE_DIM,
        border: `1px solid ${BLUE_BORDER}`,
        color: BLUE,
      }}
    >
      {text}
    </span>
  );
}

function WhiteBadge({ text }: { text: string }) {
  return (
    <span
      className="px-3 py-1.5 rounded-full text-xs font-medium"
      style={{
        background: "rgba(33,78,207,0.08)",
        border: "1px solid rgba(33,78,207,0.2)",
        color: "#214ECF",
      }}
    >
      {text}
    </span>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}` }}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5l2.5 2.5L8 3"
            stroke={BLUE}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-sm text-muted-foreground leading-snug">{text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dedicated Package Detail View Component
// ─────────────────────────────────────────────────────────────────────────────
function PackageDetailView({ pkg }: { pkg: ServicePackage }) {
  const [, setLocation] = useLocation();

  useSEO({
    title: `${pkg.serviceName} — ${pkg.packageName} | Thinkatic Services`,
    description: `${pkg.description} Starting at ${pkg.priceDisplay}. Full inclusions, timeline, and enterprise support.`,
    path: `/services/${pkg.serviceSlug}/${pkg.slug}`,
  });

  const relatedPackages = useMemo(() => {
    return getPackagesByCategory(pkg.category)
      .filter((p) => p.id !== pkg.id)
      .slice(0, 3);
  }, [pkg]);

  const handleStartPackage = () => {
    try {
      sessionStorage.setItem("thinkatic_pending_package", JSON.stringify(pkg));
    } catch {}
    setLocation(`/services?package=${pkg.id}&start=true`);
  };

  return (
    <Layout>
      {/* Dark Premium Hero Section matching reference design */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 bg-[#0B1226] text-white overflow-hidden border-b border-white/10">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 75% 15%, rgba(33,78,207,0.30) 0%, transparent 65%)",
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Breadcrumb Navigation */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center gap-2 mb-8 text-xs font-mono flex-wrap"
          >
            <Link
              href="/services"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={13} />
              <span>All Services</span>
            </Link>
            <ChevronRight size={12} className="text-slate-600" />
            <span className="text-slate-400 uppercase tracking-widest">{pkg.category}</span>
            <ChevronRight size={12} className="text-slate-600" />
            <span className="text-slate-400">{pkg.serviceName}</span>
            <ChevronRight size={12} className="text-slate-600" />
            <span className="text-[#47A3FF] font-bold">{pkg.packageName}</span>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column: Heading, Badges, Overview */}
            <div className="lg:col-span-8">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="flex items-center gap-3 mb-4 flex-wrap"
              >
                <span className="px-3 py-1 rounded-md bg-blue-500/20 border border-blue-400/30 text-[#47A3FF] text-[11px] font-mono font-bold uppercase tracking-wider">
                  CATEGORY: {pkg.category}
                </span>
                {pkg.isPopular && (
                  <span className="px-3 py-1 rounded-md bg-[#214ECF] text-white text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-sm">
                    <Sparkles size={11} />
                    <span>RECOMMENDED PACKAGE</span>
                  </span>
                )}
                {pkg.priceType === "FIXED" && (
                  <span className="px-2.5 py-1 rounded-md bg-white/10 text-slate-300 text-[11px] font-mono font-medium">
                    FIXED PRICE
                  </span>
                )}
              </motion.div>

              <motion.h1
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.05 }}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-5 text-white"
              >
                {pkg.serviceName}
                <span className="block text-[#47A3FF] text-2xl sm:text-3xl lg:text-4xl font-bold mt-2">
                  {pkg.packageName} Package
                </span>
              </motion.h1>

              <motion.p
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.1 }}
                className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-3xl"
              >
                {pkg.description}
              </motion.p>

              {/* Target Customer Callout */}
              {pkg.targetCustomer && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeUp}
                  transition={{ delay: 0.15 }}
                  className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 mb-8 backdrop-blur-xs flex items-start gap-3.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-[#47A3FF] flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-mono uppercase tracking-widest text-[#47A3FF] font-bold block mb-1">
                      IDEAL FOR
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 font-medium">
                      {pkg.targetCustomer}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Key Specs Row */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-white/5 border border-white/10"
              >
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider mb-1">
                    Price Structure
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-white">
                    {pkg.priceDisplay}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {pkg.billingCycle === "monthly" ? "Billed monthly" : "One-time project"}
                  </span>
                </div>

                {pkg.deliveryTimeline && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider mb-1">
                      Estimated Timeline
                    </span>
                    <div className="text-xl sm:text-2xl font-extrabold text-[#47A3FF]">
                      {pkg.deliveryTimeline}
                    </div>
                    <span className="text-[11px] text-slate-400">Standard delivery</span>
                  </div>
                )}

                {pkg.supportPeriod && (
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block tracking-wider mb-1">
                      Post-Launch Support
                    </span>
                    <div className="text-xl sm:text-2xl font-extrabold text-white">
                      {pkg.supportPeriod}
                    </div>
                    <span className="text-[11px] text-slate-400">Direct engineering assistance</span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Right Column: Sticky Summary & Action Card */}
            <div className="lg:col-span-4">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-3xl p-6 sm:p-8 text-[#0B1226] shadow-2xl border border-slate-100 sticky top-28"
              >
                <div className="text-xs font-mono uppercase font-bold text-slate-400 mb-1">
                  Selected Package
                </div>
                <h3 className="text-2xl font-extrabold text-[#0B1226] mb-3">
                  {pkg.packageName}
                </h3>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-6">
                  <div className="text-3xl font-extrabold text-[#0B1226] tracking-tight">
                    {pkg.priceDisplay}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {pkg.priceType === "FIXED"
                      ? "Authoritative fixed pricing"
                      : "Custom scope consultation"}
                  </div>
                </div>

                {/* Primary CTA Button */}
                <button
                  type="button"
                  onClick={handleStartPackage}
                  className="w-full py-4 px-6 rounded-xl bg-[#214ECF] hover:bg-[#1A3DB3] text-white font-bold text-sm tracking-wide shadow-lg shadow-blue-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mb-3 group"
                >
                  <span>{pkg.ctaLabel}</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>

                <Link href="/contact" className="block text-center">
                  <button
                    type="button"
                    className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Request Custom Scope Consultation
                  </button>
                </Link>

                <div className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-[#214ECF]" />
                    <span>Selected plan preserved through sign up</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#214ECF]" />
                    <span>No surprise billing or hidden setup fees</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area (White background) */}
      <section className="py-20 md:py-28 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Detailed Feature Checklist */}
            <div className="lg:col-span-8">
              <div className="mb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-100 text-[#214ECF] text-xs font-mono font-bold uppercase mb-3">
                  <Check size={13} />
                  <span>COMPLETE SPECIFICATIONS</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1226] tracking-tight mb-4">
                  What is included in this package
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Every deliverable is managed by Thinkatic engineers and subject-matter specialists to ensure enterprise-grade reliability and security.
                </p>
              </div>

              {/* Inclusions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
                {pkg.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-start gap-3 hover:border-blue-200 transition-colors"
                  >
                    <CheckCircle2 size={18} className="text-[#214ECF] mt-0.5 shrink-0" />
                    <span className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Integrations (if present) */}
              {pkg.includedIntegrations && pkg.includedIntegrations.length > 0 && (
                <div className="mb-12 p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200/80">
                  <h3 className="text-lg font-bold text-[#0B1226] mb-3 flex items-center gap-2">
                    <Layers size={18} className="text-[#214ECF]" />
                    <span>Included Third-Party Integrations</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Pre-tested API connectors and enterprise platforms supported in this tier:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pkg.includedIntegrations.map((tool) => (
                      <span
                        key={tool}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Important Notes / Guarantees */}
              {pkg.importantNotes && (
                <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex items-start gap-3 mb-12">
                  <Info size={18} className="text-[#214ECF] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-mono uppercase font-bold text-[#214ECF] block mb-1">
                      Important Terms & Clarity
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-normal">
                      {pkg.importantNotes}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Overview */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80">
                <h4 className="text-sm font-bold text-[#0B1226] uppercase font-mono tracking-wider mb-4">
                  How Onboarding Works
                </h4>
                <ol className="space-y-4 text-xs text-slate-600">
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#214ECF] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-slate-900 block">Select Package</strong>
                      Click Get Started to initiate your account and preserve this plan.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#214ECF] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-slate-900 block">Client Account Access</strong>
                      Instant setup inside your private Thinkatic Client Portal.
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#214ECF] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="text-slate-900 block">Kickoff & Delivery</strong>
                      Dedicated project manager and transparent milestone tracking.
                    </div>
                  </li>
                </ol>
              </div>

              {/* Consultation Card */}
              <div className="p-6 rounded-3xl bg-[#0B1226] text-white">
                <h4 className="text-base font-bold mb-2">Have Custom Questions?</h4>
                <p className="text-xs text-slate-300 leading-relaxed mb-5">
                  Need to adjust scope or discuss enterprise service level agreements?
                </p>
                <Link href="/contact">
                  <button
                    type="button"
                    className="w-full py-2.5 px-4 rounded-xl bg-white text-[#0B1226] font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Schedule a Consultation
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Related Packages from same Category */}
          {relatedPackages.length > 0 && (
            <div className="mt-20 pt-16 border-t border-slate-200">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-xs font-mono font-bold text-[#214ECF] uppercase tracking-wider block mb-1">
                    OTHER PACKAGES IN {pkg.category}
                  </span>
                  <h3 className="text-2xl font-extrabold text-[#0B1226]">
                    Compare Alternative Solutions
                  </h3>
                </div>
                <Link
                  href="/services"
                  className="text-xs font-bold text-[#214ECF] hover:underline flex items-center gap-1"
                >
                  <span>View Full Catalogue</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPackages.map((rel) => (
                  <div
                    key={rel.id}
                    className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-[#214ECF] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-1">
                        {rel.serviceName}
                      </div>
                      <h4 className="text-lg font-extrabold text-[#0B1226] mb-2">
                        {rel.packageName}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        {rel.description}
                      </p>
                      <div className="text-xl font-extrabold text-[#0B1226] mb-4">
                        {rel.priceDisplay}
                      </div>
                    </div>

                    <Link href={`/services/${rel.serviceSlug}/${rel.slug}`}>
                      <button
                        type="button"
                        className="w-full py-2.5 rounded-xl border border-slate-200 hover:border-[#214ECF] bg-slate-50 hover:bg-blue-50 text-[#214ECF] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span>View Details</span>
                        <ArrowRight size={13} />
                      </button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Router / Resolver
// ─────────────────────────────────────────────────────────────────────────────
export default function ServiceDetailPage() {
  const params = useParams<{
    slug?: string;
    serviceSlug?: string;
    packageSlug?: string;
  }>();

  const { packages: allPackages } = useAuthoritativePlans();

  // 1. First check if this URL points to a ServicePackage in the new catalogue
  const packageMatch = useMemo(() => {
    if (params.serviceSlug && params.packageSlug) {
      return (
        allPackages.find(
          (p) =>
            (p.serviceSlug === params.serviceSlug ||
              (params.serviceSlug && p.category.toLowerCase() === params.serviceSlug.toLowerCase())) &&
            (p.slug === params.packageSlug || p.id === params.packageSlug)
        ) ||
        allPackages.find(
          (p) => p.slug === params.packageSlug || p.id === params.packageSlug
        )
      );
    }
    if (params.slug) {
      return allPackages.find(
        (p) => p.slug === params.slug || p.id === params.slug
      );
    }
    return undefined;
  }, [allPackages, params.serviceSlug, params.packageSlug, params.slug]);

  if (packageMatch) {
    return <PackageDetailView pkg={packageMatch} />;
  }

  // 2. Legacy service route fallback
  const aliasMap: Record<string, string> = {
    "custom-ai": "ai-starter",
    "generative-ai": "ai-business",
    "ai-automation": "ai-automation",
    "machine-learning": "ai-enterprise",
    "cloud-devops": "cloud-modernization",
    "healthcare-bpo": "enterprise-transformation",
    "customer-support": "bpo-agent",
    "sales-lead-generation": "ai-starter",
    "back-office": "data-foundation",
    "ai-powered-bpo": "ai-enterprise",
  };

  const targetId = params.slug ? aliasMap[params.slug] || params.slug : "";
  const svc = services.find((s) => s.id === targetId);

  if (!svc) return <NotFound />;

  useSEO({
    title: `${svc.title} — Enterprise Technology Architecture`,
    description: svc.description,
    path: `/services/${svc.id}`,
  });

  const related = services.filter((s) => s.id !== svc.id).slice(0, 3);

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-44 pb-24 bg-background overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#214ECF05_1px,transparent_1px),linear-gradient(to_bottom,#214ECF05_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 60% 0%, rgba(71,163,255,0.10) 0%, transparent 65%)",
          }}
        />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          {/* Breadcrumb */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex items-center gap-2 mb-10 text-xs font-mono"
          >
            <Link
              href="/services"
              className="text-muted-foreground hover:text-muted-foreground transition-colors"
            >
              Services
            </Link>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(33,78,207,0.3)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span style={{ color: BLUE }}>{svc.title}</span>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="flex items-center gap-3 mb-6"
              >
                <span
                  className="text-xs font-mono font-bold tracking-[0.25em]"
                  style={{ color: BLUE }}
                >
                  {svc.number}
                </span>
                <div className="h-px w-10" style={{ background: BLUE_BORDER }} />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Service
                </span>
              </motion.div>

              <motion.h1
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.05 }}
                className="font-display font-bold text-foreground leading-[1.05] mb-5"
                style={{ fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}
              >
                {svc.title}
              </motion.h1>

              <motion.p
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.1 }}
                className="text-base font-medium mb-6"
                style={{ color: BLUE }}
              >
                {svc.tagline}
              </motion.p>

              <motion.p
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.15 }}
                className="text-muted-foreground text-base leading-relaxed mb-10 max-w-xl"
              >
                {svc.description}
              </motion.p>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-3"
              >
                <Link href="/contact">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-foreground text-sm tracking-wide"
                    style={{
                      background:
                        "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)",
                    }}
                  >
                    Start a Project
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </motion.button>
                </Link>
                <Link href="/services">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm"
                    style={{
                      background: "rgba(33,78,207,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    View All Services
                  </motion.button>
                </Link>
              </motion.div>
            </div>

            {/* Architecture Preview Box */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              transition={{ delay: 0.25 }}
              className="p-8 rounded-2xl bg-card border border-border"
            >
              <h3 className="text-lg font-bold text-foreground mb-4">Enterprise Capabilities</h3>
              <div className="space-y-3">
                {svc.whatWeBuild.map((item, idx: number) => (
                  <CheckItem key={idx} text={item.title} />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
