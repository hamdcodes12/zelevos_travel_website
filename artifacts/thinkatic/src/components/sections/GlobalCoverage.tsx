import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Globe,
  Clock,
  Languages,
  Shield,
  Wifi,
  CheckCircle2,
  Radio,
  Server,
  Activity,
  Layers,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { icon: Globe,     value: "25+",   label: "Countries",         color: "#214ECF" },
  { icon: Clock,     value: "24/7",  label: "Global Coverage",   color: "#214ECF" },
  { icon: Languages, value: "14",    label: "Languages",          color: "#059669" },
  { icon: Wifi,      value: "99.9%", label: "Uptime SLA",        color: "#7C3AED" },
  { icon: Shield,    value: "ISO",   label: "27001 Certified",   color: "#D97706" },
];

// Hub locations: { label, x %, y %, desc, size, color }
const HUBS = [
  { label: "New York",     x: 23, y: 34, desc: "Americas HQ",       size: "lg", color: "#214ECF", tz: "UTC-5" },
  { label: "Toronto",      x: 24, y: 29, desc: "Canada Hub",        size: "sm", color: "#2D5FE8", tz: "UTC-5" },
  { label: "São Paulo",    x: 32, y: 68, desc: "LATAM Hub",         size: "md", color: "#F59E0B", tz: "UTC-3" },
  { label: "London",       x: 48, y: 26, desc: "EMEA HQ",           size: "lg", color: "#214ECF", tz: "UTC+0" },
  { label: "Frankfurt",    x: 51, y: 24, desc: "EU Data Center",    size: "sm", color: "#818CF8", tz: "UTC+1" },
  { label: "Cairo",        x: 54, y: 39, desc: "MENA Hub",          size: "sm", color: "#38BDF8", tz: "UTC+2" },
  { label: "Dubai",        x: 60, y: 38, desc: "Middle East Hub",   size: "md", color: "#10B981", tz: "UTC+4" },
  { label: "Mumbai",       x: 66, y: 44, desc: "South Asia Hub",    size: "md", color: "#F59E0B", tz: "UTC+5.5" },
  { label: "Bangalore",    x: 67, y: 49, desc: "Tech & AI Center",  size: "md", color: "#214ECF", tz: "UTC+5.5" },
  { label: "Singapore",    x: 77, y: 53, desc: "SE Asia Hub",       size: "md", color: "#A78BFA", tz: "UTC+8" },
  { label: "Manila",       x: 82, y: 48, desc: "APAC Operations",   size: "lg", color: "#10B981", tz: "UTC+8" },
  { label: "Sydney",       x: 88, y: 72, desc: "ANZ Hub",           size: "sm", color: "#214ECF", tz: "UTC+11" },
];

// Major transmission arcs linking primary enterprise nodes
const NETWORK_ARCS = [
  { from: { x: 23, y: 34 }, to: { x: 48, y: 26 } }, // NY -> London
  { from: { x: 48, y: 26 }, to: { x: 60, y: 38 } }, // London -> Dubai
  { from: { x: 60, y: 38 }, to: { x: 67, y: 49 } }, // Dubai -> Bangalore
  { from: { x: 67, y: 49 }, to: { x: 77, y: 53 } }, // Bangalore -> Singapore
  { from: { x: 77, y: 53 }, to: { x: 82, y: 48 } }, // Singapore -> Manila
  { from: { x: 82, y: 48 }, to: { x: 88, y: 72 } }, // Manila -> Sydney
  { from: { x: 23, y: 34 }, to: { x: 32, y: 68 } }, // NY -> São Paulo
  { from: { x: 48, y: 26 }, to: { x: 54, y: 39 } }, // London -> Cairo
];

const REGIONS = [
  {
    name: "Americas",
    flag: "🌎",
    offices: ["New York", "Toronto", "São Paulo"],
    timezone: "UTC−8 to UTC−3",
    languages: ["English", "Spanish", "Portuguese"],
    accent: "#214ECF",
    leadHub: "New York HQ",
  },
  {
    name: "EMEA",
    flag: "🌍",
    offices: ["London", "Frankfurt", "Dubai", "Cairo"],
    timezone: "UTC+0 to UTC+4",
    languages: ["English", "German", "Arabic", "French"],
    accent: "#214ECF",
    leadHub: "London HQ",
  },
  {
    name: "APAC",
    flag: "🌏",
    offices: ["Manila", "Bangalore", "Mumbai", "Singapore", "Sydney"],
    timezone: "UTC+5.5 to UTC+11",
    languages: ["English", "Tagalog", "Hindi", "Mandarin"],
    accent: "#059669",
    leadHub: "Manila Operations",
  },
];

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// ─── Map Pin Component ────────────────────────────────────────────────────────

function MapPin({
  hub,
  index,
  mapInView,
}: {
  hub: typeof HUBS[0];
  index: number;
  mapInView: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isLg = hub.size === "lg";
  const size = isLg ? 10 : hub.size === "md" ? 8 : 6;

  return (
    <motion.div
      className="absolute group cursor-pointer z-20"
      style={{ left: `${hub.x}%`, top: `${hub.y}%`, transform: "translate(-50%, -50%)" }}
      initial={{ scale: 0, opacity: 0 }}
      animate={mapInView ? { scale: 1, opacity: 1 } : {}}
      transition={{ duration: 0.5, ease, delay: 0.15 + index * 0.03 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Outer Pulse Ring */}
      <div
        className="absolute rounded-full pointer-events-none -inset-2 animate-ping opacity-30"
        style={{
          border: `1px solid ${hub.color}`,
          animationDuration: isLg ? "2.5s" : "3.5s",
        }}
      />

      {/* Target Crosshair / Ring */}
      <div
        className="absolute rounded-full pointer-events-none transition-transform duration-300"
        style={{
          width: size * 2.8,
          height: size * 2.8,
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${hovered ? 1.4 : 1})`,
          border: `1px solid ${hub.color}80`,
          background: `${hub.color}15`,
        }}
      />

      {/* Center Core Dot */}
      <div
        className="relative rounded-full z-10 transition-transform duration-200"
        style={{
          width: size,
          height: size,
          background: "#FFFFFF",
          border: `2px solid ${hub.color}`,
          boxShadow: `0 0 14px ${hub.color}`,
          transform: hovered ? "scale(1.3)" : "scale(1)",
        }}
      />

      {/* Label for major hubs */}
      {isLg && (
        <span
          className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold tracking-wider text-slate-400 pointer-events-none uppercase whitespace-nowrap px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700/60"
        >
          {hub.label}
        </span>
      )}

      {/* Command Tooltip */}
      <motion.div
        initial={false}
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? -10 : 0, scale: hovered ? 1 : 0.95 }}
        transition={{ duration: 0.18, ease }}
        className="absolute bottom-[130%] left-1/2 -translate-x-1/2 pointer-events-none z-30"
        style={{ minWidth: "140px" }}
      >
        <div
          className="px-3.5 py-2.5 rounded-xl text-left bg-slate-950/95 border border-slate-700 shadow-2xl backdrop-blur-md"
          style={{ boxShadow: `0 12px 30px rgba(0,0,0,0.8), 0 0 16px ${hub.color}25` }}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-white font-bold text-xs leading-none">{hub.label}</p>
            <span className="text-[9px] font-mono text-emerald-400 font-semibold">{hub.tz}</span>
          </div>
          <p className="text-[10px] font-mono font-medium" style={{ color: hub.color }}>
            {hub.desc}
          </p>
          <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Active NOC Node</span>
          </div>
        </div>
        <div
          className="w-2.5 h-2.5 rotate-45 mx-auto -mt-1 bg-slate-950 border border-slate-700"
          style={{ borderTop: "none", borderLeft: "none" }}
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Region Card Component ──────────────────────────────────────────────────

function RegionCard({ region, index }: { region: typeof REGIONS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease, delay: index * 0.1 }}
      className="rounded-2xl border border-slate-200/90 bg-white p-7 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:shadow-[0_12px_32px_-8px_rgba(15,23,42,0.08)] transition-all duration-300 flex flex-col justify-between group"
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2 rounded-xl bg-slate-50 border border-slate-200/60 leading-none">
              {region.flag}
            </span>
            <div>
              <h3 className="text-slate-900 font-display font-bold text-xl tracking-tight leading-snug">
                {region.name}
              </h3>
              <p className="text-xs font-mono font-medium text-slate-500 mt-0.5">{region.timezone}</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-50 text-[#214ECF] border border-blue-200/80 shrink-0">
            {region.offices.length} offices
          </span>
        </div>

        {/* Strategic Hubs */}
        <div className="mb-5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 mb-2.5">
            Strategic Operating Hubs
          </p>
          <div className="flex flex-wrap gap-1.5">
            {region.offices.map((office) => (
              <span
                key={office}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-50 text-slate-800 border border-slate-200/80 flex items-center gap-1.5 group-hover:border-slate-300 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#214ECF]" />
                {office}
              </span>
            ))}
          </div>
        </div>

        {/* Native Languages */}
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 mb-2.5">
            Language Coverage
          </p>
          <div className="flex flex-wrap gap-1.5">
            {region.languages.map((lang) => (
              <span
                key={lang}
                className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-blue-50/70 text-[#214ECF] border border-blue-200/60"
              >
                {lang}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer SLA Verification */}
      <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span className="flex items-center gap-1.5 text-slate-700 font-medium">
          <CheckCircle2 size={13} className="text-emerald-600" />
          24/7 Redundant Dispatch
        </span>
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
          Tier-1 SLAs
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function GlobalCoverage() {
  const headingRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });
  const mapInView = useInView(mapRef, { once: true, margin: "-40px" });

  return (
    <section
      className="relative py-28 md:py-36 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 50%, #FFFFFF 100%)" }}
    >
      {/* Background Micro Hairline Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(30,64,175,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(30,64,175,0.02) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">

        {/* ── Header ── */}
        <div ref={headingRef} className="mb-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50/80 border border-blue-200/60 mb-5"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#214ECF]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.28em] text-[#214ECF]">
              Global Delivery
            </span>
          </motion.div>

          <div className="overflow-hidden mb-5">
            <motion.h2
              initial={{ y: "100%", opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.85, ease, delay: 0.05 }}
              className="font-display font-black text-slate-900 leading-[1.04] tracking-tight"
              style={{ fontSize: "clamp(2.4rem, 4.8vw, 4.4rem)" }}
            >
              Wherever you operate,
              <br />
              <span className="text-[#214ECF]">
                we're already there.
              </span>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
            className="text-base md:text-lg max-w-2xl mx-auto text-slate-600 font-normal leading-relaxed"
          >
            With operations across 25 countries and three global delivery regions, Thinkatic provides round-the-clock BPO coverage in every major market.
          </motion.p>
        </div>

        {/* ── Precision Telemetry Console Ribbon (Stats) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.25 }}
          className="rounded-2xl border border-slate-200/90 bg-slate-200/80 p-[1px] shadow-[0_10px_35px_-10px_rgba(15,23,42,0.06)] overflow-hidden mb-12"
        >
          <div className="grid grid-cols-2 md:grid-cols-5 gap-[1px]">
            {STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white p-5 md:p-6 text-center flex flex-col items-center justify-center group hover:bg-[#FBFDFF] transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 transition-transform duration-200 group-hover:scale-105"
                    style={{ background: `${stat.color}10`, border: `1px solid ${stat.color}25` }}
                  >
                    <Icon size={18} style={{ color: stat.color }} />
                  </div>
                  <span className="font-display font-black text-slate-900 text-2xl md:text-3xl tracking-tight leading-none">
                    {stat.value}
                  </span>
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 mt-1.5">
                    {stat.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Global Network Operations Center (NOC) Command Console ── */}
        <motion.div
          ref={mapRef}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.3 }}
          className="relative w-full rounded-2xl border border-slate-800 bg-[#0A0F1D] shadow-[0_25px_60px_-15px_rgba(15,23,42,0.4)] overflow-hidden mb-12"
        >
          {/* Top NOC HUD Status Bar */}
          <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] font-bold text-slate-200 uppercase tracking-widest">
                [ NETWORK OPERATIONS CENTER // MULTI-SHORE FABRIC ]
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                LATENCY: &lt;28ms CROSS-REGION
              </span>
              <span>·</span>
              <span className="text-emerald-400 font-semibold">STATUS: 100% OPERATIONAL</span>
            </div>
          </div>

          {/* Map Surface */}
          <div
            className="relative w-full overflow-hidden"
            style={{ minHeight: "440px", aspectRatio: "21/9" }}
          >
            {/* Latitude / Longitude lines */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-1/4 inset-x-0 h-px border-b border-dashed border-blue-400/40" />
              <div className="absolute top-2/4 inset-x-0 h-px border-b border-dashed border-blue-400/60" />
              <div className="absolute top-3/4 inset-x-0 h-px border-b border-dashed border-blue-400/40" />
              <div className="absolute left-1/4 inset-y-0 w-px border-r border-dashed border-blue-400/40" />
              <div className="absolute left-2/4 inset-y-0 w-px border-r border-dashed border-blue-400/40" />
              <div className="absolute left-3/4 inset-y-0 w-px border-r border-dashed border-blue-400/40" />
            </div>

            {/* Precision Dot Lattice Texture */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(96,165,250,0.25) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
                maskImage: "radial-gradient(ellipse 95% 85% at 50% 50%, black 50%, transparent 100%)",
              }}
            />

            {/* Continental landmass glowing vector silhouettes */}
            <div className="absolute inset-0 pointer-events-none opacity-40">
              {/* North America */}
              <div className="absolute" style={{ left: "8%", top: "14%", width: "24%", height: "42%", background: "radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%)" }} />
              {/* South America */}
              <div className="absolute" style={{ left: "22%", top: "52%", width: "16%", height: "38%", background: "radial-gradient(ellipse, rgba(59,130,246,0.15) 0%, transparent 70%)" }} />
              {/* Europe */}
              <div className="absolute" style={{ left: "44%", top: "12%", width: "16%", height: "30%", background: "radial-gradient(ellipse, rgba(59,130,246,0.2) 0%, transparent 70%)" }} />
              {/* Africa */}
              <div className="absolute" style={{ left: "45%", top: "36%", width: "18%", height: "42%", background: "radial-gradient(ellipse, rgba(59,130,246,0.14) 0%, transparent 70%)" }} />
              {/* Asia */}
              <div className="absolute" style={{ left: "57%", top: "12%", width: "32%", height: "50%", background: "radial-gradient(ellipse, rgba(59,130,246,0.22) 0%, transparent 70%)" }} />
              {/* Australia */}
              <div className="absolute" style={{ left: "78%", top: "58%", width: "16%", height: "24%", background: "radial-gradient(ellipse, rgba(59,130,246,0.16) 0%, transparent 70%)" }} />
            </div>

            {/* SVG Flight / Data Transmission Arcs */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#214ECF" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#2D5FE8" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              {NETWORK_ARCS.map((arc, i) => {
                const midX = (arc.from.x + arc.to.x) / 2;
                const midY = Math.min(arc.from.y, arc.to.y) - 6;
                const pathD = `M ${arc.from.x} ${arc.from.y} Q ${midX} ${midY} ${arc.to.x} ${arc.to.y}`;
                return (
                  <g key={i}>
                    {/* Background Static Arc */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="rgba(59,130,246,0.2)"
                      strokeWidth="0.4"
                    />
                    {/* Animated Pulsing Data Stream */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="url(#arcGlow)"
                      strokeWidth="0.6"
                      strokeDasharray="2 3"
                      className="opacity-75"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hub Pins */}
            {HUBS.map((hub, i) => (
              <MapPin key={hub.label} hub={hub} index={i} mapInView={mapInView} />
            ))}

            {/* Bottom HUD bar within map */}
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-slate-400 pointer-events-none">
              <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700/60 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                <span className="font-semibold text-slate-200">{HUBS.length} Strategic Hubs Connected</span>
              </div>
              <div className="hidden md:flex items-center gap-3 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-700/60 backdrop-blur-sm">
                <span className="text-slate-500">Active Zones:</span>
                <span className="text-blue-400 font-semibold">Americas</span>
                <span className="text-slate-500">·</span>
                <span className="text-indigo-400 font-semibold">EMEA</span>
                <span className="text-slate-500">·</span>
                <span className="text-emerald-400 font-semibold">APAC</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Region Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REGIONS.map((region, i) => (
            <RegionCard key={region.name} region={region} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
