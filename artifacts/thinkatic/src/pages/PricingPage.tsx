import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Link, useLocation } from "wouter";
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Search,
  Layers,
  Code2,
  Bot,
  Cpu,
  Users,
  Server,
  Zap,
  Clock,
  ShieldCheck,
  Check,
  Building2,
  ArrowUpRight,
  MessageSquare,
  Filter,
} from "lucide-react";
import {
  SERVICE_CATEGORIES,
  SERVICE_PACKAGES,
  type ServiceCategoryKey,
  type ServicePackage,
  useAuthoritativePlans,
} from "@/data/servicesCatalogue";
import { useSEO } from "@/hooks/useSEO";

const smoothEase = [0.22, 1, 0.36, 1] as const;

const CATEGORY_ICONS: Record<ServiceCategoryKey, React.ComponentType<{ size?: number; className?: string }>> = {
  BUILD: Code2,
  AI: Bot,
  AUTOMATE: Cpu,
  SCALE: Users,
  OPERATE: Server,
};

export default function PricingPage() {
  const [, setLocation] = useLocation();

  useSEO({
    title: "Thinkatic | Service Packages & Authoritative Pricing",
    description:
      "Explore Thinkatic's 9 core service categories and 29 packages with authoritative pricing across Websites, AI Agents, Shopify, Custom Software, Business Automation, QA, Dedicated Developers, Website Maintenance, and BPO Support.",
    path: "/pricing",
  });

  const { packages: allPackages, loading: catalogueLoading, error: catalogueError } = useAuthoritativePlans();

  const [activeCategory, setActiveCategory] = useState<ServiceCategoryKey | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter packages based on category and search
  const filteredPackages = useMemo(() => {
    return allPackages.filter((pkg) => {
      const matchCategory = activeCategory === "ALL" || pkg.category === activeCategory;
      const matchSearch =
        searchQuery.trim() === "" ||
        pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.targetCustomer && pkg.targetCustomer.toLowerCase().includes(searchQuery.toLowerCase())) ||
        pkg.features.some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [allPackages, activeCategory, searchQuery]);

  // Category counts from live authoritative dataset
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: allPackages.length,
      BUILD: 0,
      AI: 0,
      AUTOMATE: 0,
      SCALE: 0,
      OPERATE: 0,
    };
    for (const p of allPackages) {
      if (counts[p.category] !== undefined) {
        counts[p.category]++;
      }
    }
    return counts;
  }, [allPackages]);

  const handleStartPackage = (pkg: ServicePackage) => {
    try {
      sessionStorage.setItem("thinkatic_pending_package", JSON.stringify(pkg));
    } catch {}
    setLocation(`/services?package=${pkg.id}&start=true`);
  };

  return (
    <Layout>
      <div className="pt-28 pb-28 min-h-screen text-slate-900 bg-white relative">
        {/* Ambient top light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_at_top,rgba(33,78,207,0.10),transparent_70%)] pointer-events-none" />

        <div className="w-full max-w-[94vw] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10">
          {/* ── Top Header ── */}
          <div className="flex flex-col items-center text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 mb-5">
              <Sparkles size={13} className="text-[#214ECF]" />
              <span className="text-[11px] font-mono tracking-[0.2em] uppercase text-[#214ECF] font-bold">
                Authoritative Service Catalogue
              </span>
            </div>

            <h1 className="font-display font-black text-3xl sm:text-5xl md:text-6xl tracking-tight leading-[1.08] mb-5 text-slate-900">
              Clear Services &amp; <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#214ECF] via-[#214ECF] to-[#2D5FE8] bg-clip-text text-transparent">
                Transparent Pricing
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed mb-8">
              Explore Thinkatic&apos;s authoritative service packages across 5 core pillars. Predictable investment, defined deliverables, and enterprise-grade execution.
            </p>

            {/* Search Filter Box */}
            <div className="w-full max-w-md relative mb-8">
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by package, technology, or feature..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-full text-xs sm:text-sm bg-white border border-[#DCE5FF] shadow-xs focus:outline-none focus:border-[#214ECF] focus:ring-2 focus:ring-[#214ECF]/15 transition-all text-slate-900 placeholder:text-slate-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory("ALL")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeCategory === "ALL"
                    ? "bg-[#214ECF] text-white shadow-sm"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>All Packages</span>
                <span>({categoryCounts.ALL})</span>
              </button>
              {SERVICE_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.key] || Layers;
                const isActive = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveCategory(cat.key)}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#214ECF] text-white shadow-sm"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <Icon size={13} />
                    <span>
                      {cat.title} ({categoryCounts[cat.key] ?? 0})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Packages Grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch mb-20">
            {filteredPackages.map((pkg, idx) => {
              const isFixed = pkg.priceType === "FIXED" && pkg.price > 0;
              const Icon = CATEGORY_ICONS[pkg.category] || Layers;

              return (
                <motion.article
                  key={pkg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: smoothEase, delay: Math.min(idx * 0.03, 0.3) }}
                  className={`bg-white rounded-2xl border p-7 sm:p-8 flex flex-col justify-between transition-all duration-300 relative ${
                    pkg.isPopular
                      ? "border-[#214ECF] shadow-lg ring-2 ring-[#214ECF]/15"
                      : "border-slate-200 shadow-2xs hover:border-blue-300 hover:shadow-md"
                  }`}
                >
                  {pkg.isPopular && (
                    <div className="absolute -top-3 left-6 bg-[#214ECF] text-white text-[10px] font-bold px-3 py-0.5 rounded-full tracking-wider uppercase font-mono shadow-xs">
                      MOST POPULAR
                    </div>
                  )}

                  <div>
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200/60 text-[#214ECF] text-[10px] font-mono font-bold uppercase tracking-wider">
                        <Icon size={12} />
                        <span>{pkg.category}</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {pkg.serviceName}
                      </span>
                    </div>

                    {/* Package Name */}
                    <h3 className="font-display font-black text-xl sm:text-2xl text-slate-900 tracking-tight mb-2">
                      {pkg.packageName}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5 min-h-[2.5rem]">
                      {pkg.description}
                    </p>

                    {/* Price Display */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-6">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                          {pkg.priceDisplay}
                        </span>
                        {isFixed && (
                          <span className="text-xs text-slate-500 font-medium">
                            {pkg.billingCycle === "monthly" ? "" : "one-time"}
                          </span>
                        )}
                      </div>
                      {pkg.importantNotes && (
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                          {pkg.importantNotes}
                        </p>
                      )}
                    </div>

                    {/* Specifications */}
                    {(pkg.deliveryTimeline || pkg.supportPeriod) && (
                      <div className="space-y-1.5 text-xs text-slate-600 mb-6 pb-5 border-b border-slate-100">
                        {pkg.deliveryTimeline && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <Clock size={12} />
                              <span>Timeline:</span>
                            </span>
                            <span className="font-semibold text-slate-800">{pkg.deliveryTimeline}</span>
                          </div>
                        )}
                        {pkg.supportPeriod && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1.5">
                              <ShieldCheck size={12} />
                              <span>Support:</span>
                            </span>
                            <span className="font-semibold text-slate-800">{pkg.supportPeriod}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Deliverables Checklist */}
                    <div className="space-y-2 text-xs text-slate-700 mb-8">
                      <span className="text-[11px] font-mono uppercase text-slate-400 font-bold block mb-2 tracking-wider">
                        Key Inclusions:
                      </span>
                      {pkg.features.map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-start gap-2.5">
                          <Check size={14} className="text-[#214ECF] shrink-0 mt-0.5" />
                          <span className="leading-snug">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    {isFixed ? (
                      <button
                        type="button"
                        onClick={() => handleStartPackage(pkg)}
                        className="w-full py-3 rounded-xl bg-[#214ECF] hover:bg-[#1B40AB] text-white font-bold text-xs sm:text-sm tracking-wide transition-all shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
                      >
                        <span>Get Started</span>
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <Link href={`/contact?service=${pkg.id}`}>
                        <button
                          type="button"
                          className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm tracking-wide transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                        >
                          <span>{pkg.ctaLabel || "Schedule Consultation"}</span>
                          <ArrowRight size={14} />
                        </button>
                      </Link>
                    )}

                    <Link href={`/services/${pkg.serviceSlug}/${pkg.slug}`}>
                      <button
                        type="button"
                        className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-[#214ECF] transition-colors cursor-pointer"
                      >
                        View Full Package Details →
                      </button>
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>

          {filteredPackages.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-200 mb-20">
              <p className="text-base text-slate-600 mb-4">
                No packages found matching &quot;{searchQuery}&quot;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("ALL");
                }}
                className="px-5 py-2.5 rounded-xl bg-[#214ECF] text-white font-bold text-xs cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          )}

          {/* ── Enterprise Custom Scope Consultation Banner ── */}
          <div className="rounded-3xl bg-[#0B1226] text-white p-8 sm:p-12 border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#214ECF]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-[#47A3FF] text-xs font-mono font-bold uppercase tracking-wider mb-4">
                ENTERPRISE &amp; BESPOKE WORKFLOWS
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-4 text-white">
                Need a Custom Scope or Enterprise SLA?
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8">
                For organizations with multi-system integrations, dedicated engineering squads, or specialized compliance requirements, our solutions team designs tailored architectures with SLA governance.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/contact">
                  <button
                    type="button"
                    className="px-6 py-3 rounded-xl bg-[#214ECF] hover:bg-[#1B40AB] text-white font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>Schedule Enterprise Consultation</span>
                    <ArrowRight size={14} />
                  </button>
                </Link>
                <Link href="/services">
                  <button
                    type="button"
                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/15 transition-all cursor-pointer"
                  >
                    Explore Public Services Catalogue
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
