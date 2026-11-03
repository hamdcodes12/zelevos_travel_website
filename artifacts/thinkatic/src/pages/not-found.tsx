import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight, Home, Search, LayoutGrid } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const QUICK_LINKS = [
  { label: "Services", href: "/services", desc: "BPO & Technology" },
  { label: "About Us", href: "/about", desc: "Who we are" },
  { label: "Contact", href: "/contact", desc: "Get in touch" },
  { label: "Careers", href: "/careers", desc: "Join the team" },
];

export default function NotFound() {
  useSEO({
    title: "Page Not Found",
    description: "The page you're looking for doesn't exist.",
    noIndex: true,
    path: "/404",
  });

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "#FFFFFF" }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 40%, rgba(71,163,255,0.07) 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-xl w-full text-center">
        {/* 404 number */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease }}
        >
          <p
            className="font-display font-black text-foreground/[0.06] select-none leading-none mb-2"
            style={{ fontSize: "clamp(7rem,20vw,14rem)" }}
            aria-hidden="true"
          >
            404
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease }}
          className="-mt-8 sm:-mt-12"
        >
          <p className="text-xs font-mono uppercase tracking-[0.22em] mb-4" style={{ color: "#214ECF" }}>
            Page not found
          </p>
          <h1 className="font-display font-black text-foreground leading-tight mb-4"
            style={{ fontSize: "clamp(1.8rem,4vw,2.5rem)" }}>
            This page doesn't exist
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-10 max-w-sm mx-auto">
            The URL may have changed, or the page was removed. Try navigating from the home page or one of the links below.
          </p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-12"
          >
            <Link href="/">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-sm text-foreground"
                style={{ background: "linear-gradient(135deg,#214ECF,#214ECF)", boxShadow: "0 0 24px rgba(71,163,255,0.25)" }}
              >
                <Home size={14} aria-hidden="true" />
                Back to Home
              </motion.button>
            </Link>
            <Link href="/contact">
              <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-medium text-sm text-muted-foreground hover:text-foreground border border-border hover:border-white/25 transition-all">
                <Search size={14} aria-hidden="true" />
                Contact Support
              </button>
            </Link>
          </motion.div>

          {/* Quick links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45, ease }}
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center justify-center gap-2">
              <LayoutGrid size={10} aria-hidden="true" />
              Quick Links
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_LINKS.map(link => (
                <Link key={link.href} href={link.href}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex flex-col items-center gap-1 p-3 rounded-xl border text-center cursor-pointer transition-all duration-200 group"
                    style={{ background: "rgba(255,255,255,0.025)", borderColor: "rgba(255,255,255,0.07)" }}
                  >
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {link.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground group-hover:text-muted-foreground transition-colors">
                      {link.desc}
                    </span>
                    <ArrowRight
                      size={11}
                      className="text-foreground/20 group-hover:text-[#214ECF] mt-0.5 transition-colors"
                      aria-hidden="true"
                    />
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
