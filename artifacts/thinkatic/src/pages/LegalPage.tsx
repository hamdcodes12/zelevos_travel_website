import React, { useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { useSEO } from "@/hooks/useSEO";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DISCLAIMER_TEXT,
  getLegalDocument,
  type LegalDocument,
  type LegalSection,
} from "@/data/legalDocuments";
import {
  Shield,
  FileText,
  Handshake,
  Briefcase,
  Lock,
  Database,
  CheckCircle,
  BadgeCheck,
  CreditCard,
  AlertTriangle,
  MessageSquare,
  Cookie,
  Calendar,
  ChevronRight,
  ChevronDown,
  Printer,
  ExternalLink,
  Check,
  X,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  LifeBuoy,
} from "lucide-react";

export interface LegalPageProps {
  forcedSlug?: string;
  [key: string]: any;
}

export default function LegalPage(props?: LegalPageProps) {
  const forcedSlug = props?.forcedSlug;
  const [, params] = useRoute("/legal/:slug");
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine active slug
  let activeSlug = forcedSlug || params?.slug || "";
  if (!activeSlug) {
    if (location.includes("privacy")) activeSlug = "privacy-policy";
    else if (location.includes("terms")) activeSlug = "terms";
    else if (location.includes("cookie")) activeSlug = "cookie-policy";
    else activeSlug = "privacy-policy";
  }

  const currentDoc: LegalDocument =
    getLegalDocument(activeSlug) || LEGAL_DOCUMENTS[0];

  // Find index for prev/next
  const currentIndex = LEGAL_DOCUMENTS.findIndex(
    (d) => d.slug === currentDoc.slug
  );
  const prevDoc =
    currentIndex > 0 ? LEGAL_DOCUMENTS[currentIndex - 1] : null;
  const nextDoc =
    currentIndex < LEGAL_DOCUMENTS.length - 1
      ? LEGAL_DOCUMENTS[currentIndex + 1]
      : null;

  useSEO({
    title: `${currentDoc.seoTitle} | Thinkatic`,
    description: currentDoc.seoDescription,
    path: currentDoc.path,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileMenuOpen(false);
  }, [currentDoc.slug]);

  const CurrentIcon = currentDoc.icon;

  return (
    <Layout>
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Top Hero Banner */}
        <section className="relative pt-32 pb-16 md:pt-40 md:pb-20 bg-gradient-to-b from-white via-blue-50/30 to-[#F8FAFC] border-b border-slate-200 overflow-hidden">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(#214ECF 1px, transparent 1px), linear-gradient(90deg, #214ECF 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          {/* Decorative ambient radial glow */}
          <div
            className="absolute -top-24 right-1/4 w-96 h-96 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(33,78,207,0.08) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />

          <div className="relative max-w-7xl mx-auto px-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-6 uppercase tracking-wider">
              <Link href="/" className="hover:text-[#214ECF] transition-colors">
                Home
              </Link>
              <ChevronRight size={12} className="text-slate-400" />
              <Link
                href="/legal/privacy-policy"
                className="hover:text-[#214ECF] transition-colors"
              >
                Legal Center
              </Link>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="text-[#214ECF] font-bold">
                {currentDoc.shortTitle}
              </span>
            </div>

            {/* Title Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-[#214ECF] text-xs font-mono font-bold uppercase tracking-wider mb-4">
                  <CurrentIcon size={13} className="text-[#214ECF]" />
                  <span>{currentDoc.badge}</span>
                  <span className="text-slate-300">•</span>
                  <span>Effective: {currentDoc.effectiveDate}</span>
                </div>

                <h1 className="text-3xl md:text-5xl font-display font-black text-[#0F172A] tracking-tight mb-4">
                  {currentDoc.title}
                </h1>

                <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl">
                  {currentDoc.subtitle}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:border-[#214ECF] hover:text-[#214ECF] transition-all shadow-sm"
                  title="Print this document"
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#214ECF] text-white text-xs font-semibold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                >
                  <LifeBuoy size={14} />
                  <span>Legal Inquiries</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Sticky Selector */}
        <div className="lg:hidden sticky top-20 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3 shadow-sm">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-left font-medium text-slate-800 text-sm"
          >
            <div className="flex items-center gap-2.5 truncate">
              <CurrentIcon size={16} className="text-[#214ECF] shrink-0" />
              <span className="truncate font-semibold">{currentDoc.title}</span>
            </div>
            <ChevronDown
              size={16}
              className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                mobileMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-2 p-2 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-80 overflow-y-auto"
              >
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 px-3 py-1 font-bold">
                  All Legal Policies &amp; Agreements
                </div>
                {LEGAL_DOCUMENTS.map((doc) => {
                  const Icon = doc.icon;
                  const isActive = doc.slug === currentDoc.slug;
                  return (
                    <Link
                      key={doc.slug}
                      href={doc.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#214ECF] text-white font-bold"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Icon
                        size={14}
                        className={isActive ? "text-white" : "text-[#214ECF]"}
                      />
                      <span className="truncate">{doc.title}</span>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main Document & Sidebar Layout */}
        <div className="max-w-7xl mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-start">
            {/* Desktop Left Sticky Navigation */}
            <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-28 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm">
                <div className="flex items-center gap-2 px-3 pb-3 mb-2 border-b border-slate-100">
                  <Shield size={14} className="text-[#214ECF]" />
                  <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-900">
                    Thinkatic Legal Index
                  </span>
                </div>

                <nav className="flex flex-col gap-1" role="list">
                  {LEGAL_DOCUMENTS.map((doc, idx) => {
                    const Icon = doc.icon;
                    const isActive = doc.slug === currentDoc.slug;
                    return (
                      <Link
                        key={doc.slug}
                        href={doc.path}
                        className={`group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all ${
                          isActive
                            ? "bg-blue-50 text-[#214ECF] font-bold border-l-4 border-[#214ECF]"
                            : "text-slate-600 hover:text-[#0F172A] hover:bg-slate-50 border-l-4 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            size={14}
                            className={`shrink-0 transition-colors ${
                              isActive
                                ? "text-[#214ECF]"
                                : "text-slate-400 group-hover:text-[#214ECF]"
                            }`}
                          />
                          <span className="truncate">{doc.shortTitle}</span>
                        </div>
                        <span className="text-[10px] font-mono font-medium text-slate-400 shrink-0">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Legal Council / Template Disclaimer Card */}
              <div className="bg-blue-50/60 rounded-2xl border border-blue-200/60 p-4 text-xs text-slate-600 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                  <AlertCircle size={14} className="text-[#214ECF]" />
                  <span>Important Note</span>
                </div>
                <p className="leading-relaxed text-[11px] text-slate-600">
                  {LEGAL_DISCLAIMER_TEXT}
                </p>
                <div className="pt-2 text-[10px] font-mono text-[#214ECF] font-bold">
                  Effective: 19 September 2026
                </div>
              </div>
            </aside>

            {/* Right Main Legal Document */}
            <main className="lg:col-span-8 xl:col-span-9 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 md:p-14 shadow-sm space-y-10">
              {/* Document Overview Header */}
              <div className="space-y-4 pb-8 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#214ECF]">
                    <CurrentIcon size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] tracking-tight">
                      {currentDoc.title}
                    </h2>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mt-0.5">
                      <Calendar size={12} className="text-[#214ECF]" />
                      <span>Effective Date: {currentDoc.effectiveDate}</span>
                      <span>•</span>
                      <span>Version 2.0 (Thinkatic Master Documentation)</span>
                    </div>
                  </div>
                </div>

                {currentDoc.intro && (
                  <p className="text-sm md:text-base text-slate-700 leading-relaxed bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                    {currentDoc.intro}
                  </p>
                )}
              </div>

              {/* Sections rendering */}
              <div className="space-y-8">
                {currentDoc.sections.map((section, idx) => (
                  <LegalSectionRenderer
                    key={`${section.number}-${section.title}`}
                    section={section}
                    index={idx}
                  />
                ))}
              </div>

              {/* Closing Notes / Additional Notice */}
              {currentDoc.closingNote && (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs md:text-sm text-slate-600 leading-relaxed italic">
                  {currentDoc.closingNote}
                </div>
              )}

              {/* Legal Disclaimer Box */}
              <div className="rounded-2xl p-6 bg-slate-50/70 border border-slate-200 space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-900 flex items-center gap-2">
                  <Shield size={14} className="text-[#214ECF]" />
                  <span>Thinkatic Legal Notice &amp; Compliance Policy</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {LEGAL_DISCLAIMER_TEXT}
                </p>
                <div className="text-[11px] text-slate-500 font-mono">
                  Thinkatic Private Limited • Corporate Office: Tower B, Magarpatta City, Hadapsar, Pune – 411028
                </div>
              </div>

              {/* Prev / Next Document Switcher */}
              <div className="pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {prevDoc ? (
                  <Link
                    href={prevDoc.path}
                    className="group p-4 rounded-2xl border border-slate-200 hover:border-[#214ECF] bg-white hover:bg-blue-50/30 transition-all text-left flex items-start gap-3"
                  >
                    <ArrowLeft
                      size={16}
                      className="text-slate-400 group-hover:text-[#214ECF] group-hover:-translate-x-1 transition-all mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                        Previous Policy
                      </div>
                      <div className="text-sm font-bold text-[#0F172A] group-hover:text-[#214ECF] transition-colors truncate">
                        {prevDoc.title}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div />
                )}

                {nextDoc ? (
                  <Link
                    href={nextDoc.path}
                    className="group p-4 rounded-2xl border border-slate-200 hover:border-[#214ECF] bg-white hover:bg-blue-50/30 transition-all text-right flex items-start justify-end gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                        Next Policy
                      </div>
                      <div className="text-sm font-bold text-[#0F172A] group-hover:text-[#214ECF] transition-colors truncate">
                        {nextDoc.title}
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-slate-400 group-hover:text-[#214ECF] group-hover:translate-x-1 transition-all mt-0.5 shrink-0"
                    />
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Individual Section Renderer Component ─────────────────────────────────────

function LegalSectionRenderer({
  section,
  index,
}: {
  section: LegalSection;
  index: number;
}) {
  const isProhibited = section.type === "prohibited";
  const isChecklist = section.type === "checklist";
  const isSteps = section.type === "steps";
  const isCards = section.type === "cards";

  return (
    <div
      id={`section-${section.number}`}
      className={`space-y-4 rounded-2xl transition-all ${
        section.highlight
          ? "p-6 bg-blue-50/40 border border-blue-100"
          : "p-0"
      }`}
    >
      {/* Section Header */}
      <div className="flex items-baseline gap-3">
        <span className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-[#214ECF] text-xs font-mono font-bold flex items-center justify-center shrink-0">
          {section.number}
        </span>
        <h3 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">
          {section.title}
        </h3>
      </div>

      {/* Body text */}
      {section.body && (
        <p className="text-sm md:text-[14.5px] text-[#334155] leading-relaxed pl-10">
          {section.body}
        </p>
      )}

      {/* Bullets with specialized styling */}
      {section.bullets && section.bullets.length > 0 && (
        <div className="pl-10">
          {isProhibited ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-4 rounded-2xl bg-red-50/50 border border-red-100">
              {section.bullets.map((b, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-xs md:text-sm text-red-900"
                >
                  <X size={14} className="text-red-600 mt-0.5 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          ) : isChecklist ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {section.bullets.map((b, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs md:text-sm text-slate-800"
                >
                  <Check
                    size={14}
                    className="text-[#214ECF] mt-0.5 shrink-0 font-bold"
                  />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          ) : isSteps ? (
            <div className="space-y-3">
              {section.bullets.map((b, i) => {
                const parts = b.split("—");
                const stepLabel = parts[0]?.trim() || `Step ${i + 1}`;
                const stepDesc = parts.slice(1).join("—").trim() || b;
                return (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm"
                  >
                    <div className="px-3 py-1 rounded-md bg-blue-50 text-[#214ECF] text-xs font-mono font-bold shrink-0 w-fit">
                      {stepLabel}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-700 leading-snug">
                      {stepDesc}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isCards ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {section.bullets.map((b, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs md:text-sm text-slate-700 font-medium"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#214ECF] mt-2 shrink-0" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {section.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700"
                >
                  <span className="text-[#214ECF] font-bold mt-0.5">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Special Callout */}
      {section.callout && (
        <div className="ml-10 p-4 rounded-xl bg-blue-50 border-l-4 border-[#214ECF] text-xs sm:text-sm text-blue-950 font-medium leading-relaxed">
          {section.callout}
        </div>
      )}
    </div>
  );
}
