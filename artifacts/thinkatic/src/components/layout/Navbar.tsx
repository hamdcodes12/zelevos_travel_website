import { useLocation, Link } from "wouter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User } from "lucide-react";
import BrandLogo from "@/components/layout/BrandLogo";

interface NavItem {
  label: string;
  href: string;
  isAnchor?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Global Delivery", href: "/global-delivery" },
  { label: "BPO Partner Benefits", href: "/bpo-partner-benefits" },
  { label: "Technology & AI", href: "/technology-ai" },
  { label: "Network", href: "/network" },
  { label: "FAQs", href: "/faqs" },
  { label: "Contact", href: "/contact" },
];

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.includes("#how-it-works")) {
      const element = document.getElementById("how-it-works");
      if (element) {
        e.preventDefault();
        element.scrollIntoView({ behavior: "smooth" });
        setMobileOpen(false);
      }
    }
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all duration-200 h-[68px] sm:h-[72px]"
        role="banner"
      >
        <div className="w-full max-w-[98vw] 2xl:max-w-[1800px] mx-auto px-3 sm:px-4 xl:px-4 2xl:px-8 flex items-center justify-between h-full">
          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 hover:opacity-90 transition-opacity inline-flex items-center justify-center h-full"
            aria-label="Thinkatic Home"
          >
            <BrandLogo larger />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-0.5 2xl:gap-1.5" aria-label="Main Navigation">
            {NAV_ITEMS.map((item) => {
              const isHome = item.href === "/";
              const isTech = item.href === "/technology-ai" && (location.startsWith("/technology-ai") || location.startsWith("/technology"));
              const isFaq = item.href === "/faqs" && (location.startsWith("/faqs") || location.startsWith("/faq"));
              const isActive = isHome ? location === "/" : isTech || isFaq || location.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={(e) => item.isAnchor && handleAnchorClick(e, item.href)}
                  className={`inline-flex items-center justify-center h-10 px-2.5 2xl:px-3.5 text-xs 2xl:text-[13px] font-medium transition-all duration-200 rounded-lg whitespace-nowrap select-none leading-none shrink-0 ${
                    isActive
                      ? "bg-[#214ECF] text-white font-semibold shadow-xs"
                      : "text-slate-700 hover:text-[#214ECF] hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-2 xl:gap-2.5 2xl:gap-3 shrink-0">
            {/* Portal Button: Direct entry to authenticated experience or login */}
            <Link href="/login" className="inline-flex items-center justify-center shrink-0">
              <button
                className="h-10 inline-flex items-center justify-center gap-1.5 px-2.5 2xl:px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap leading-none"
                aria-label="Portal"
              >
                <User size={13} className="text-[#214ECF]" />
                Portal
              </button>
            </Link>

            {/* Public "Become a BPO Partner" Action */}
            <Link href="/signup?role=bpo" className="inline-flex items-center justify-center shrink-0">
              <button
                className="h-10 inline-flex items-center justify-center px-3 2xl:px-4 rounded-lg font-semibold text-xs transition-all duration-150 cursor-pointer shadow-2xs text-[#214ECF] border border-[#214ECF] bg-white hover:bg-blue-50/80 whitespace-nowrap leading-none"
              >
                Become a BPO Partner
              </button>
            </Link>

            {/* "Talk to Thinkatic" — Solid blue button */}
            <Link href="/contact" className="inline-flex items-center justify-center shrink-0">
              <button
                className="h-10 inline-flex items-center justify-center px-3.5 2xl:px-4.5 rounded-lg font-bold text-xs text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-all duration-150 shadow-xs cursor-pointer whitespace-nowrap leading-none"
              >
                Talk to Thinkatic
              </button>
            </Link>
          </div>

          {/* Mobile/Tablet Hamburger Button */}
          <div className="flex items-center gap-2 xl:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center justify-center"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X size={22} className="text-slate-900" />
              ) : (
                <div className="space-y-1.5">
                  <span className="block w-5 h-[2px] bg-slate-800 rounded-full" />
                  <span className="block w-5 h-[2px] bg-slate-800 rounded-full" />
                  <span className="block w-3.5 h-[2px] bg-slate-800 rounded-full ml-auto" />
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[68px] sm:top-[72px] bg-white border-b border-slate-200 shadow-xl z-40 xl:hidden px-6 py-6"
          >
            <nav className="flex flex-col space-y-2 mb-6" aria-label="Mobile Navigation">
              {NAV_ITEMS.map((item) => {
                const isHome = item.href === "/";
                const isTech = item.href === "/technology-ai" && (location.startsWith("/technology-ai") || location.startsWith("/technology"));
                const isFaq = item.href === "/faqs" && (location.startsWith("/faqs") || location.startsWith("/faq"));
                const isActive = isHome ? location === "/" : isTech || isFaq || location.startsWith(item.href);

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                      if (item.isAnchor) handleAnchorClick(e, item.href);
                      setMobileOpen(false);
                    }}
                    className={`px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[#214ECF] text-white font-semibold shadow-xs"
                        : "text-slate-800 hover:bg-slate-50 hover:text-[#214ECF]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <button className="w-full h-11 rounded-lg font-semibold text-xs text-slate-800 border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                  <User size={14} className="text-[#214ECF]" />
                  Portal
                </button>
              </Link>

              <Link href="/signup?role=bpo" onClick={() => setMobileOpen(false)}>
                <button
                  className="w-full h-11 rounded-lg font-semibold text-xs transition-colors shadow-2xs text-[#214ECF] border border-[#214ECF] bg-white hover:bg-blue-50"
                >
                  Become a BPO Partner
                </button>
              </Link>

              <Link href="/contact" onClick={() => setMobileOpen(false)}>
                <button className="w-full h-11 rounded-lg font-bold text-xs text-white bg-[#214ECF] hover:bg-[#1A3DB3] transition-colors shadow-xs">
                  Talk to Thinkatic
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
