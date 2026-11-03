import React, { useRef } from "react";
import { Link } from "wouter";
import {
  Linkedin,
  Instagram,
  Twitter,
  Youtube,
  Github,
  Mail,
  MapPin,
  Phone,
  HelpCircle,
  Building2,
  Globe,
  CheckCircle2,
  Network,
  Users,
  FileText,
  MessageSquare,
  ExternalLink,
  Shield,
  Handshake,
  Briefcase,
  Lock,
  Database,
  CheckCircle,
  BadgeCheck,
  CreditCard,
  AlertTriangle,
  Cookie,
  Sparkles,
} from "lucide-react";

// ─── Footer Data ──────────────────────────────────────────────────────────────

const footerCompany = [
  { label: "About Thinkatic", href: "/about", icon: Building2 },
  { label: "How It Works", href: "/#how-it-works", icon: Globe },
  { label: "Industries", href: "/#industries", icon: Globe },
  { label: "Frequently Asked Questions", href: "/faqs", icon: HelpCircle },
];

const footerNetwork = [
  { label: "Delivery Network", href: "/network", icon: Network },
  { label: "Global Delivery", href: "/global-delivery", icon: Globe },
  { label: "BPO Partner Benefits", href: "/bpo-partner-benefits", icon: CheckCircle2 },
  { label: "Become a BPO Partner", href: "/signup?role=bpo", icon: Users },
  { label: "Partner Portal Login", href: "/login", icon: Building2 },
];

const WHATSAPP_LINK =
  "https://wa.me/917263874459?text=Hello%20Thinkatic,%20I%20would%20like%20to%20discuss%20a%20business%20requirement.";

const footerContact = [
  { label: "Talk to Thinkatic", href: "/contact", icon: Mail, isExternal: false },
  { label: "Request Consultation", href: "/contact#contact-form", icon: FileText, isExternal: false },
  {
    label: "WhatsApp Support",
    href: WHATSAPP_LINK,
    icon: MessageSquare,
    isExternal: true,
  },
];

// ─── 12 Canonical Legal Policies & Agreements (19 September 2026 Master Pack) ───

export const legalColumns = [
  {
    columnTitle: "Core Terms & Agreements",
    items: [
      { label: "Privacy Policy", href: "/legal/privacy-policy", icon: Shield },
      { label: "Terms & Conditions", href: "/legal/terms", icon: FileText },
      { label: "Partner Agreement", href: "/legal/partner-agreement", icon: Handshake },
      { label: "Client Agreement", href: "/legal/client-agreement", icon: Briefcase },
    ],
  },
  {
    columnTitle: "Security & Standards",
    items: [
      { label: "NDA / Confidentiality", href: "/legal/nda", icon: Lock },
      { label: "Data Protection", href: "/legal/data-protection", icon: Database },
      { label: "Acceptable Use", href: "/legal/acceptable-use", icon: CheckCircle },
      { label: "Partner Eligibility & Compliance", href: "/legal/partner-eligibility", icon: BadgeCheck },
    ],
  },
  {
    columnTitle: "Commercial & Redressal",
    items: [
      { label: "Payment & Commission", href: "/legal/payment-commission", icon: CreditCard },
      { label: "Termination & Suspension", href: "/legal/termination-suspension", icon: AlertTriangle },
      { label: "Grievance Redressal", href: "/legal/grievance", icon: MessageSquare },
      { label: "Cookie Policy", href: "/legal/cookie-policy", icon: Cookie },
    ],
  },
];

const socials = [
  { icon: Linkedin,  href: "#", label: "LinkedIn" },
  { icon: Twitter,   href: "#", label: "Twitter / X" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Youtube,   href: "#", label: "YouTube" },
  { icon: Github,    href: "#", label: "GitHub" },
];

const contactItems = [
  {
    icon: Mail,
    text: "Thinkaticai@gmail.com",
    href: "mailto:Thinkaticai@gmail.com",
    isExternal: false,
    label: "Email Thinkatic",
  },
  {
    icon: Phone,
    text: "+91 72638 74459",
    href: WHATSAPP_LINK,
    isExternal: true,
    label: "WhatsApp Phone (+91 72638 74459)",
  },
  {
    icon: MapPin,
    text: "Tower B, Magarpatta City, Hadapsar, Pune – 411028",
    href: null,
    isExternal: false,
    label: "Office Address",
  },
];

// ─── Column Link List ─────────────────────────────────────────────────────────

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; icon?: React.ElementType; isExternal?: boolean }[];
}) {
  return (
    <div className="flex flex-col">
      <h3
        className="text-[11px] font-mono tracking-[0.22em] uppercase font-bold mb-4"
        style={{ color: "#0F172A" }}
      >
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5" role="list">
        {links.map((item) => {
          const Icon = item.icon;
          const linkContent = (
            <span className="group inline-flex items-center gap-2 text-[13px] text-[#334155] hover:text-[#214ECF] transition-all duration-200">
              {Icon && (
                <Icon
                  size={12}
                  className="shrink-0 text-[#214ECF] group-hover:text-[#214ECF] transition-colors"
                  aria-hidden="true"
                />
              )}
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                {item.label}
              </span>
              {item.isExternal && (
                <ExternalLink
                  size={10}
                  className="opacity-50 group-hover:opacity-100 transition-opacity ml-0.5 text-[#214ECF]"
                  aria-hidden="true"
                />
              )}
            </span>
          );

          return (
            <li key={item.label}>
              {item.isExternal ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block"
                  aria-label={item.label}
                >
                  {linkContent}
                </a>
              ) : item.href.startsWith("/#") || item.href.includes("#") ? (
                <a href={item.href} className="inline-block" aria-label={item.label}>
                  {linkContent}
                </a>
              ) : (
                <Link href={item.href} className="inline-block" aria-label={item.label}>
                  {linkContent}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Main Footer Component ────────────────────────────────────────────────────

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  return (
    <footer
      ref={footerRef}
      id="thinkatic-footer"
      className="relative overflow-hidden border-t bg-[#FFFFFF]"
      style={{
        backgroundColor: "#FFFFFF",
        borderColor: "#E2E8F0",
        color: "#334155",
      }}
    >
      {/* Light Clean Tech Atmosphere */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Subtle geometric grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#214ECF 1px, transparent 1px), linear-gradient(90deg, #214ECF 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Thinkatic Blue soft radial glows */}
        <div
          className="absolute top-[20%] left-[10%] w-[500px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(33,78,207,0.03) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute bottom-[20%] right-[10%] w-[420px] h-[420px] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(33,78,207,0.02) 0%, transparent 70%)",
            filter: "blur(50px)",
          }}
        />
      </div>

      {/* Top Shimmer Line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[1px] pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(33,78,207,0.3) 50%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Large THINKATIC Background Watermark */}
      <div
        className="absolute inset-0 flex items-end justify-center pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
        style={{ paddingBottom: "75px" }}
      >
        <span
          className="font-display font-black tracking-tighter uppercase select-none pointer-events-none"
          style={{
            fontSize: "clamp(5.5rem, 17vw, 17rem)",
            lineHeight: 0.8,
            color: "rgba(33, 78, 207, 0.05)",
          }}
        >
          THINKATIC
        </span>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-8">
        {/* ── Top Section: Brand Identity & Contact Details ── */}
        <div
          className="flex flex-col lg:flex-row items-start justify-between gap-10 mb-12 pb-12"
          style={{ borderBottom: "1px solid #E2E8F0" }}
        >
          {/* Brand Identity */}
          <div className="flex flex-col gap-4 max-w-md">
            <Link
              href="/"
              aria-label="Thinkatic – Home"
              className="inline-flex items-center gap-3 w-fit group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#214ECF]/10 border border-[#214ECF]/20 p-1 flex items-center justify-center shrink-0">
                <img
                  src="/Thinkatic.png"
                  alt="Thinkatic Logo"
                  className="w-full h-full object-contain block select-none"
                />
              </div>
              <span className="font-display font-black text-2xl tracking-tight text-[#0F172A] group-hover:text-[#214ECF] transition-colors">
                Thinkatic
              </span>
            </Link>

            <div>
              <p className="text-sm font-bold text-[#0F172A] leading-snug">
                Technology &amp; Business Process Outsourcing
              </p>
              <p className="text-xs font-semibold text-[#214ECF] leading-relaxed mt-1">
                Think Smarter. Operate Better. Scale Faster.
              </p>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-2 pt-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    color: "#214ECF",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#214ECF";
                    e.currentTarget.style.color = "#FFFFFF";
                    e.currentTarget.style.backgroundColor = "#214ECF";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E2E8F0";
                    e.currentTarget.style.color = "#214ECF";
                    e.currentTarget.style.backgroundColor = "#F8FAFC";
                  }}
                  aria-label={s.label}
                >
                  <s.icon size={13} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Contact Details (Email, WhatsApp/Phone, Address) */}
          <div
            className="flex flex-col gap-3 rounded-2xl p-5 w-full sm:w-auto"
            style={{
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
              minWidth: "290px",
            }}
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-[#64748B] mb-0.5">
              Direct Contact
            </p>
            {contactItems.map((c) => {
              const Icon = c.icon;
              const inner = (
                <div className="flex items-start gap-3 group">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                    style={{ backgroundColor: "rgba(33, 78, 207, 0.08)" }}
                  >
                    <Icon
                      size={13}
                      className="text-[#214ECF] group-hover:scale-110 transition-transform"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <span className="text-[13px] font-medium text-[#1E293B] group-hover:text-[#214ECF] transition-colors block">
                      {c.text}
                    </span>
                    {c.isExternal && (
                      <span className="text-[10px] text-[#214ECF] group-hover:underline block font-semibold mt-0.5">
                        Open WhatsApp Chat →
                      </span>
                    )}
                  </div>
                </div>
              );

              return c.href ? (
                <a
                  key={c.text}
                  href={c.href}
                  target={c.isExternal ? "_blank" : undefined}
                  rel={c.isExternal ? "noopener noreferrer" : undefined}
                  className="w-fit"
                  title={c.label}
                >
                  {inner}
                </a>
              ) : (
                <div key={c.text}>{inner}</div>
              );
            })}
          </div>
        </div>

        {/* ── Top Navigation Row: Company, Network, Contact, Standards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          <FooterColumn
            title="Company"
            links={footerCompany}
          />
          <FooterColumn
            title="Network"
            links={footerNetwork}
          />
          <FooterColumn
            title="Contact"
            links={footerContact}
          />
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
            <div>
              <div className="flex items-center gap-2 mb-2 text-[#214ECF]">
                <Shield size={16} />
                <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#0F172A]">
                  Enterprise Governance
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Comprehensive 12-pillar BPO legal, compliance, data-protection and operational governance architecture.
              </p>
            </div>
            <div className="pt-3 border-t border-blue-100 flex items-center justify-between text-[11px] font-mono text-[#214ECF]">
              <span>Effective: 19 Sep 2026</span>
              <Link href="/legal/privacy-policy" className="font-bold hover:underline">
                Explore Index →
              </Link>
            </div>
          </div>
        </div>

        {/* ── EXPANDED ENTERPRISE LEGAL DIRECTORY BLOCK ── */}
        <div className="pt-8 pb-10 border-t border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-[#214ECF]/10 flex items-center justify-center text-[#214ECF]">
                <Shield size={13} />
              </div>
              <div>
                <h3 className="text-[11px] font-mono tracking-[0.22em] uppercase font-bold text-[#0F172A]">
                  LEGAL
                </h3>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Thinkatic BPO Legal &amp; Policy Master Pack • Effective 19 September 2026
            </div>
          </div>

          {/* Desktop 3-Column Clean Grid / Mobile Responsive Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            {legalColumns.map((col) => (
              <div key={col.columnTitle} className="flex flex-col gap-2.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                  {col.columnTitle}
                </span>
                <ul className="flex flex-col gap-2" role="list">
                  {col.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="group inline-flex items-center gap-2 text-[13px] text-[#334155] hover:text-[#214ECF] transition-all duration-200 py-0.5"
                        >
                          <Icon
                            size={13}
                            className="shrink-0 text-[#214ECF] group-hover:scale-110 transition-transform duration-200"
                            aria-hidden="true"
                          />
                          <span className="group-hover:translate-x-1 group-hover:underline transition-all duration-200 font-medium">
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom Bar ── */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t"
          style={{ borderColor: "#E2E8F0" }}
        >
          {/* Copyright */}
          <p className="text-xs order-2 sm:order-1 text-[#64748B] font-normal">
            © 2026 Thinkatic Private Limited. All rights reserved.
          </p>

          {/* Quick Legal Links */}
          <div className="flex flex-wrap items-center gap-3 order-1 sm:order-2 text-xs">
            <Link
              href="/legal/privacy-policy"
              className="text-[#64748B] hover:text-[#214ECF] transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/legal/terms"
              className="text-[#64748B] hover:text-[#214ECF] transition-colors"
            >
              Terms &amp; Conditions
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/legal/partner-agreement"
              className="text-[#64748B] hover:text-[#214ECF] transition-colors"
            >
              Partner Agreement
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/legal/cookie-policy"
              className="text-[#64748B] hover:text-[#214ECF] transition-colors"
            >
              Cookie Policy
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              href="/legal/grievance"
              className="text-[#64748B] hover:text-[#214ECF] transition-colors"
            >
              Grievance Redressal
            </Link>
          </div>

          {/* Built with AI by Thinkatic */}
          <div className="flex items-center gap-1.5 order-3 hidden md:flex text-xs text-[#64748B]">
            <span>Built with</span>
            <span className="font-bold text-[#214ECF]">AI</span>
            <span>by Thinkatic</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
