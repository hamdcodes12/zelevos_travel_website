import { useRef } from "react";
import { motion, useInView, useScroll, useTransform, useReducedMotion, type Variants } from "framer-motion";

const phases = [
  {
    number: "01",
    label: "Discovery & Strategy",
    steps: [
      "Strategy workshops",
      "Requirements analysis",
      "Market research",
      "Technical feasibility",
      "Data assessment",
      "Architecture planning",
    ],
  },
  {
    number: "02",
    label: "UX Design",
    steps: ["User flows", "Prototyping"],
  },
  {
    number: "03",
    label: "AI Development",
    steps: ["Model selection", "Fine-tuning", "Integration"],
  },
  {
    number: "04",
    label: "Delivery",
    steps: ["Testing & QA", "Deployment", "Monitoring"],
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

function PhaseCard({ phase, index }: { phase: (typeof phases)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      transition={{ delay: index * 0.12 }}
      className="flex flex-col"
    >
      <div className="mb-6">
        <span
          className="text-xs font-mono font-bold tracking-[0.2em] uppercase"
          style={{ color: "#214ECF" }}
        >
          {phase.number}
        </span>
        <h3
          className="text-foreground font-bold text-lg leading-tight mt-1"
          style={{ fontFamily: "inherit" }}
        >
          {phase.label}
        </h3>
      </div>

      <div className="flex flex-col gap-2.5">
        {phase.steps.map((step, si) => (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -10 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
              delay: index * 0.12 + si * 0.06,
            }}
            className="flex items-center gap-3"
          >
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-foreground"
              style={{ background: "#214ECF" }}
            >
              {si + 1}
            </span>
            <span className="text-sm text-muted-foreground leading-tight">{step}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function AIDevelopmentProcess() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });
  const shouldReduce = useReducedMotion();

  // Section-level parallax for background
  const { scrollYProgress: sectionScroll } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(sectionScroll, [0, 1], shouldReduce ? ["0px", "0px"] : ["40px", "-40px"]);

  // Scroll-progress–driven horizontal connecting line
  const { scrollYProgress: lineProgress } = useScroll({
    target: timelineContainerRef,
    offset: ["start 75%", "start 25%"],
  });
  const lineScaleX = useTransform(lineProgress, [0, 1], shouldReduce ? [1, 1] : [0, 1]);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 overflow-hidden"
      style={{ background: "#FFFFFF" }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(33,78,207,0.06) 50%, transparent 100%)" }}
      />

      {/* Parallax background glow */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(71,163,255,0.04) 0%, transparent 70%)", filter: "blur(60px)" }}
        />
      </motion.div>

      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {/* Header */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20 items-start">
          <motion.div
            ref={headingRef}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            variants={fadeUp}
          >
            <p
              className="text-xs font-bold tracking-[0.25em] uppercase mb-4"
              style={{ color: "rgba(33,78,207,0.22)" }}
            >
              How we work
            </p>
            <h2
              className="font-display font-bold text-foreground leading-[1.05]"
              style={{ fontSize: "clamp(2.2rem, 4vw, 3.5rem)" }}
            >
              AI development process
            </h2>
          </motion.div>

          <div className="flex flex-col gap-5">
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              transition={{ delay: 0.1 }}
              className="text-base leading-relaxed"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              We do not take on projects that involve blind conformity or building out of context. We won't ship an AI system that is misaligned with your product and business strategy.
            </motion.p>
            <motion.p
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={fadeUp}
              transition={{ delay: 0.18 }}
              className="text-base leading-relaxed"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Instead, we create scalable AI products ensuring long-term sustainability and measurable ROI.
            </motion.p>
          </div>
        </div>

        {/* Flow steps */}
        <div ref={timelineContainerRef} className="relative">
          {/* Horizontal connecting line (desktop only) – scroll-progress driven scaleX */}
          <div
            className="hidden lg:block absolute top-[38px] left-0 right-0 h-px"
            style={{ background: "rgba(33,78,207,0.08)" }}
          >
            <motion.div
              className="absolute inset-0 origin-left"
              style={{ scaleX: lineScaleX }}
            >
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, transparent 0%, rgba(33,78,207,0.12) 20%, rgba(33,78,207,0.12) 80%, transparent 100%)" }}
              />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {phases.map((phase, i) => (
              <div key={phase.label} className="relative flex flex-col">
                {/* Top connector dot */}
                <div
                  className="hidden lg:block absolute -top-[3px] left-0 w-1.5 h-1.5 rounded-full"
                  style={{ background: "#214ECF", boxShadow: "0 0 8px rgba(33,78,207,0.72)" }}
                />

                <div
                  className="rounded-2xl p-6 flex flex-col gap-6 border h-full"
                  style={{
                    background: "rgba(244,247,255,0.8)",
                    borderColor: "rgba(255,255,255,0.07)",
                  }}
                >
                  <PhaseCard phase={phase} index={i} />
                </div>

                {i < phases.length - 1 && (
                  <div className="flex sm:hidden justify-center my-2">
                    <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
                      <path d="M6 0v16M1 11l5 7 5-7" stroke="#214ECF" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden lg:grid grid-cols-4 gap-8 mt-6">
            {phases.map((phase, i) => (
              <div key={phase.label} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: i === 0 ? "#214ECF" : "rgba(255,255,255,0.2)" }}
                />
                {i < phases.length - 1 && (
                  <div className="flex-1 h-px" style={{ background: "rgba(33,78,207,0.06)" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(33,78,207,0.06) 50%, transparent 100%)" }}
      />
    </section>
  );
}
