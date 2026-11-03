import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { TiltCard } from "@/components/ui/TiltCard";

const cases = [
  {
    id: "01",
    title: "Healthcare Process Optimization",
    result: 60,
    suffix: "%",
    resultLabel: "Reduction in processing time",
    tag: "Healthcare BPO",
    color: "#214ECF",
    description: "Streamlined patient intake and claims processing for a US-based health network.",
  },
  {
    id: "02",
    title: "Customer Support Transformation",
    result: 45,
    suffix: "%",
    resultLabel: "Improved response time",
    tag: "Customer Support",
    color: "#214ECF",
    description: "AI-assisted agents cut resolution times across 12 support channels.",
  },
  {
    id: "03",
    title: "AI Automation Implementation",
    result: 70,
    suffix: "%",
    resultLabel: "Reduction in manual work",
    tag: "AI-Powered BPO",
    color: "#214ECF",
    description: "End-to-end RPA deployment across back-office functions in 90 days.",
  },
  {
    id: "04",
    title: "Software Modernization",
    result: 100,
    suffix: "%",
    resultLabel: "Cloud migration achieved",
    tag: "IT Services",
    color: "#214ECF",
    description: "Legacy monolith rebuilt into microservices and fully migrated to AWS.",
  },
];

function useCountUp(target: number, active: boolean, duration = 1.6) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const startTime = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return value;
}

function CaseCard({ study, index }: { study: (typeof cases)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const count = useCountUp(study.result, inView, 1.8);
  const [hovered, setHovered] = useState(false);
  return (
    <div>
      <TiltCard maxTilt={5} liftY={0} disabled={hovered}>
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 50 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: index * 0.13 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="group relative rounded-2xl p-8 border border-border bg-[#FFFFFF] flex flex-col gap-6 overflow-hidden cursor-default"
          style={{
            transition: "border-color 0.2s, box-shadow 0.2s",
            borderColor: hovered ? `${study.color}40` : "rgba(33,78,207,0.06)",
            boxShadow: hovered ? `0 10px 28px rgba(33,78,207,0.10)` : "0 0 0 transparent",
          }}
        >
          {/* Corner gradient on hover */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{ opacity: hovered ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            style={{ background: `radial-gradient(ellipse at 0% 100%, ${study.color}10 0%, transparent 55%)` }}
          />

          {/* Top gradient stripe */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            animate={{ opacity: hovered ? 1 : 0, scaleX: hovered ? 1 : 0 }}
            transition={{ duration: 0.5 }}
            style={{
              background: `linear-gradient(90deg, transparent, ${study.color}, transparent)`,
              transformOrigin: "left",
            }}
          />

          {/* Header */}
          <div className="flex items-start justify-between relative z-10">
            <motion.span
              className="text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full border"
              animate={{
                borderColor: hovered ? `${study.color}60` : `${study.color}40`,
                backgroundColor: hovered ? `${study.color}18` : `${study.color}10`,
              }}
              transition={{ duration: 0.3 }}
              style={{ color: study.color }}
            >
              {study.tag}
            </motion.span>
            <span className="text-xs font-mono" style={{ color: "#4B5563" }}>
              {study.id}
            </span>
          </div>

          {/* Title */}
          <div className="overflow-hidden relative z-10">
            <motion.h3
              initial={{ y: "100%", opacity: 0 }}
              animate={inView ? { y: 0, opacity: 1 } : {}}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: index * 0.13 + 0.2 }}
              className="font-display font-bold text-foreground leading-[1.1]"
              style={{ fontSize: "clamp(1.1rem, 1.8vw, 1.4rem)" }}
            >
              {study.title}
            </motion.h3>
          </div>

          {/* Description */}
          <p className="text-xs leading-relaxed relative z-10" style={{ color: "#4B5563" }}>
            {study.description}
          </p>

          {/* Metric – count-up preserved as-is */}
          <div className="flex flex-col gap-2 relative z-10 mt-auto">
            <div className="relative h-1 rounded-full overflow-hidden mb-2" style={{ background: "rgba(33,78,207,0.04)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={inView ? { width: `${study.result}%` } : {}}
                transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: index * 0.13 + 0.4 }}
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${study.color}, ${study.color}80)` }}
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={inView ? { x: "300%" } : {}}
                transition={{ duration: 1.2, ease: "easeInOut", delay: index * 0.13 + 1 }}
                className="absolute top-0 left-0 h-full w-1/3 pointer-events-none"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
              />
            </div>

            <div className="flex items-baseline gap-1">
              <motion.span
                className="font-display font-bold tabular-nums"
                style={{
                  fontSize: "clamp(2.8rem, 5vw, 4rem)",
                  color: study.color,
                  lineHeight: 1,
                  textShadow: hovered ? `0 0 30px ${study.color}60` : "none",
                  transition: "text-shadow 0.4s",
                }}
              >
                {count}
              </motion.span>
              <span
                className="font-display font-bold"
                style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", color: `${study.color}80`, lineHeight: 1 }}
              >
                {study.suffix}
              </span>
            </div>
            <p className="text-sm" style={{ color: "#4B5563" }}>
              {study.resultLabel}
            </p>
          </div>
        </motion.div>
      </TiltCard>
    </div>
  );
}

export function CaseStudiesSection() {
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });

  return (
    <section className="py-32 relative overflow-hidden" style={{ background: "#FFFFFF" }}>
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(33,78,207,0.04) 50%, transparent)" }}
      />


      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6 }}
              className="text-xs font-mono uppercase tracking-[0.25em] mb-4"
              style={{ color: "#4B5563" }}
            >
              Case Studies · Results That Speak
            </motion.p>
            <div ref={headingRef} className="overflow-hidden">
              <motion.h2
                initial={{ y: "100%", opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-bold text-foreground leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}
              >
                AI Meets Human Excellence
              </motion.h2>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="rounded-xl px-6 py-4 border border-border overflow-hidden"
            style={{ background: "#FFFFFF" }}
          >
            {["Businesses need more than outsourcing.", "They need intelligent operations."].map((line, i) => (
              <div key={i} className="overflow-hidden">
                <motion.p
                  initial={{ y: "100%", opacity: 0 }}
                  animate={inView ? { y: 0, opacity: 1 } : {}}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.3 + i * 0.12 }}
                  className="text-sm leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  {line}
                </motion.p>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cases.map((c, i) => (
            <CaseCard key={c.id} study={c} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
