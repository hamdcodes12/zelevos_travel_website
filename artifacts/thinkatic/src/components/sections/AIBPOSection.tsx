import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { TiltCard } from "@/components/ui/TiltCard";

const solutions = [
  { id: "01", name: "AI Voice Agents", desc: "Intelligent agents that handle calls with human-like conversation." },
  { id: "02", name: "AI Chatbots", desc: "Context-aware bots that resolve queries without human escalation." },
  { id: "03", name: "Workflow Automation", desc: "End-to-end process automation removing manual bottlenecks." },
  { id: "04", name: "Quality Assurance Governance", desc: "Standardized human scorecard audits and calibrations across operational interactions." },
  { id: "05", name: "Knowledge Enablement", desc: "Curated SOPs and operational guidelines that empower human agents during customer interactions." },
  { id: "06", name: "Intelligent Call Routing", desc: "Smart routing that matches customers with the right specialist." },
  { id: "07", name: "Process Automation", desc: "RPA-powered automation for repetitive, high-volume tasks." },
  { id: "08", name: "Knowledge Management", desc: "AI-curated knowledge base that evolves with your operations." },
];

function NetworkCanvas() {
  const nodes = [
    { xr: 0.08, yr: 0.5, label: "INPUT", isHub: false },
    { xr: 0.25, yr: 0.25, label: "VOICE", isHub: false },
    { xr: 0.25, yr: 0.75, label: "DATA", isHub: false },
    { xr: 0.5, yr: 0.5, label: "AI ENGINE", isHub: true },
    { xr: 0.5, yr: 0.18, label: "NLP", isHub: false },
    { xr: 0.5, yr: 0.82, label: "RPA", isHub: false },
    { xr: 0.75, yr: 0.28, label: "ROUTE", isHub: false },
    { xr: 0.75, yr: 0.72, label: "REPORT", isHub: false },
    { xr: 0.92, yr: 0.5, label: "OUTPUT", isHub: false },
  ];

  const connections: [number, number][] = [
    [0, 1], [0, 2],
    [1, 3], [1, 4],
    [2, 3], [2, 5],
    [3, 6], [3, 7],
    [4, 6],
    [5, 7],
    [6, 8], [7, 8],
  ];

  return (
    <div className="absolute inset-0 w-full h-full opacity-90 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {connections.map(([a, b], index) => {
          const start = nodes[a];
          const end = nodes[b];
          return (
            <line
              key={`${a}-${b}-${index}`}
              x1={start.xr * 100}
              y1={start.yr * 100}
              x2={end.xr * 100}
              y2={end.yr * 100}
              stroke="rgba(37,99,235,0.22)"
              strokeWidth="0.35"
            />
          );
        })}
      </svg>

      {nodes.map((node) => (
        <div
          key={node.label}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${node.xr * 100}%`, top: `${node.yr * 100}%` }}
        >
          {node.isHub ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full border border-[#214ECF]/30 bg-[radial-gradient(circle,#214ECF_0%,#214ECF_60%,#214ECF_100%)] flex items-center justify-center shadow-[0_0_24px_rgba(37,99,235,0.18)]">
                <span className="text-[10px] font-bold text-foreground">AI</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-[#214ECF] shadow-[0_0_10px_rgba(71,163,255,0.22)]" />
              <span className="text-[7px] font-mono tracking-[0.18em] text-muted-foreground whitespace-nowrap">{node.label}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Solution card with TiltCard hover ────────────────────────────────────────
function SolutionCard({ s, i }: { s: (typeof solutions)[0]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <TiltCard maxTilt={7} liftY={5}>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
        className="group relative rounded-xl p-6 border border-[#DDE7FF] bg-white cursor-default overflow-hidden h-full shadow-[0_8px_28px_rgba(33,78,207,0.05)]"
        style={{ transition: "border-color 0.35s, box-shadow 0.35s" }}
      >
        {/* Hover glow */}
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 0% 0%, rgba(37,99,235,0.1) 0%, transparent 60%)" }}
        />
        {/* Top border reveal */}
        <div
          className="absolute top-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500 pointer-events-none"
          style={{ background: "linear-gradient(90deg, #214ECF, transparent)" }}
        />

        <div className="flex items-center gap-2 mb-3 relative z-10">
          <span className="text-xs font-mono" style={{ color: "rgba(37,99,235,0.6)" }}>{s.id}</span>
          <motion.div
            className="h-px flex-1"
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 + 0.2 }}
            style={{ background: "rgba(33,78,207,0.15)", transformOrigin: "left" }}
          />
        </div>

        <h3
          className="font-bold text-slate-900 mb-2 leading-tight relative z-10 group-hover:text-[#214ECF] transition-colors duration-300"
          style={{ fontSize: "0.95rem" }}
        >
          {s.name}
        </h3>
        <p className="text-xs leading-relaxed relative z-10" style={{ color: "#4B5563" }}>
          {s.desc}
        </p>
      </motion.div>
    </TiltCard>
  );
}

export function AIBPOSection() {
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });

  return (
    <section
      className="py-32 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FFFFFF 0%, #F5F9FF 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "linear-gradient(rgba(71,163,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(71,163,255,1) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(33,78,207,0.08) 0%, transparent 68%)", filter: "blur(20px)" }}
        />
        <div
          className="absolute top-1/4 right-1/4 w-[360px] h-[260px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(71,163,255,0.04) 0%, transparent 68%)", filter: "blur(24px)" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="text-xs font-mono uppercase tracking-[0.3em] mb-5"
            style={{ color: "rgba(37,99,235,0.9)" }}
          >
            AI-Powered BPO · The Premium Pillar
          </motion.p>

          <div ref={headingRef} className="overflow-hidden">
            <motion.h2
              initial={{ y: "100%", opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-bold text-foreground leading-[1.0]"
              style={{ fontSize: "clamp(2.4rem, 5.5vw, 4.5rem)" }}
            >
              The Future of Outsourcing
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #214ECF 0%, #214ECF 60%, #214ECF 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Is Already Here
              </span>
            </motion.h2>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="mt-6 text-base max-w-2xl mx-auto"
            style={{ color: "#4B5563" }}
          >
            Human expertise, amplified by AI. Every solution combines trained professionals
            with intelligent automation to deliver measurable business outcomes.
          </motion.p>
        </div>

        {/* Network visualization */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          className="relative rounded-2xl overflow-hidden mb-20"
          style={{
            height: "320px",
            background: "linear-gradient(135deg, #F8FBFF 0%, #EEF4FF 100%)",
            border: "1px solid rgba(33,78,207,0.12)",
            boxShadow: "0 0 32px rgba(33,78,207,0.06)",
          }}
        >
          <div className="absolute top-0 left-0 w-12 h-12 pointer-events-none" style={{
            background: "linear-gradient(135deg, rgba(33,78,207,0.18) 0%, transparent 100%)"
          }} />
          <div className="absolute bottom-0 right-0 w-12 h-12 pointer-events-none" style={{
            background: "linear-gradient(315deg, rgba(33,78,207,0.18) 0%, transparent 100%)"
          }} />

          <NetworkCanvas />

          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-8" style={{ background: "rgba(37,99,235,0.4)" }} />
              <span className="text-[9px] font-mono tracking-[0.25em] rotate-0" style={{ color: "rgba(37,99,235,0.7)" }}>INPUT</span>
            </div>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-8" style={{ background: "rgba(37,99,235,0.4)" }} />
              <span className="text-[9px] font-mono tracking-[0.25em]" style={{ color: "rgba(37,99,235,0.7)" }}>OUTPUT</span>
            </div>
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
            <span className="text-[9px] font-mono tracking-[0.3em] uppercase" style={{ color: "rgba(33,78,207,0.14)" }}>
              THINKATIC AI WORKFLOW ENGINE
            </span>
          </div>
        </motion.div>

        {/* 8 Solutions grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {solutions.map((s, i) => (
            <SolutionCard key={s.id} s={s} i={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
