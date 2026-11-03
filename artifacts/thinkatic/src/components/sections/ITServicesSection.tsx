import { useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { TiltCard } from "@/components/ui/TiltCard";

const groups = [
  {
    id: "01",
    title: "Artificial Intelligence",
    services: [
      "Custom AI Solutions", "LLM Integration", "Private AI", "Generative AI",
      "AI Agents", "Computer Vision", "Natural Language Processing", "Machine Learning",
    ],
    accent: "#214ECF",
  },
  {
    id: "02",
    title: "Software Development",
    services: [
      "Custom Software", "Enterprise Applications", "CRM Development", "ERP Solutions",
      "SaaS Platforms", "Web Applications", "Mobile Applications", "API Development",
    ],
    accent: "#214ECF",
  },
  {
    id: "03",
    title: "Cloud & DevOps",
    services: [
      "Cloud Migration", "AWS", "Azure", "Google Cloud",
      "CI/CD", "Infrastructure Automation", "Monitoring", "Containerization",
    ],
    accent: "#214ECF",
  },
  {
    id: "04",
    title: "Automation",
    services: [
      "Business Process Automation", "Robotic Process Automation",
      "Workflow Automation", "Enterprise Integration",
    ],
    accent: "#214ECF",
  },
  {
    id: "05",
    title: "Data & Analytics",
    services: [
      "Business Intelligence", "Dashboards", "Data Warehousing",
      "Predictive Analytics", "Reporting",
    ],
    accent: "#214ECF",
  },
];

const stages = [
  { label: "Discover", desc: "Understand your operations" },
  { label: "Analyze", desc: "Identify opportunities" },
  { label: "Design", desc: "Architect the solution" },
  { label: "Develop", desc: "Build and integrate" },
  { label: "Deploy", desc: "Launch to production" },
  { label: "Optimize", desc: "Continuous improvement" },
];

const models = [
  "Dedicated Teams",
  "Managed Services",
  "Project-Based",
  "Outcome-Based",
  "Staff Augmentation",
];

function GroupCard({ group, index }: { group: (typeof groups)[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [hovered, setHovered] = useState(false);

  return (
    <TiltCard maxTilt={6} liftY={5}>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="group relative rounded-2xl p-7 border border-border bg-[#FFFFFF] cursor-default overflow-hidden h-full"
        style={{
          transition: "border-color 0.4s, box-shadow 0.4s",
          borderColor: hovered ? `${group.accent}35` : "rgba(33,78,207,0.06)",
          boxShadow: hovered ? `0 16px 50px rgba(0,0,0,0.3), 0 0 30px ${group.accent}0a` : "none",
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          style={{ background: `radial-gradient(ellipse at 0% 0%, ${group.accent}08 0%, transparent 60%)` }}
        />
        <motion.div
          className="absolute top-0 left-0 h-px pointer-events-none"
          animate={{ width: hovered ? "100%" : "0%" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ background: `linear-gradient(90deg, ${group.accent}, transparent)` }}
        />

        <div className="flex items-start justify-between mb-5">
          <div>
            <span className="text-xs font-mono tracking-[0.2em] uppercase block mb-1.5" style={{ color: group.accent }}>
              {group.id}
            </span>
            <h3 className="font-display font-bold text-foreground" style={{ fontSize: "clamp(1rem, 1.5vw, 1.2rem)" }}>
              {group.title}
            </h3>
          </div>
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.2)" }}>
            {group.services.length} services
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {group.services.map((s, si) => (
            <motion.span
              key={s}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.3, delay: index * 0.08 + si * 0.04 + 0.15 }}
              className="text-xs px-3 py-1.5 rounded-full border transition-all duration-250"
              style={{
                color: hovered ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)",
                background: hovered ? `${group.accent}06` : "rgba(33,78,207,0.02)",
                borderColor: hovered ? `${group.accent}25` : "rgba(33,78,207,0.06)",
                transition: "all 0.3s",
              }}
            >
              {s}
            </motion.span>
          ))}
        </div>
      </motion.div>
    </TiltCard>
  );
}

function AIFramework() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const inView = useInView(timelineRef, { once: true, margin: "-80px" });
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const shouldReduce = useReducedMotion();

  // Scroll-scrubbed timeline line using useScroll on the container
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 80%", "start 20%"],
  });
  const lineScaleX = useTransform(scrollYProgress, [0, 1], shouldReduce ? [1, 1] : [0, 1]);

  return (
    <div className="mt-24">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6 }}
        className="text-xs font-mono uppercase tracking-[0.25em] mb-4"
        style={{ color: "#4B5563" }}
      >
        AI Transformation Framework
      </motion.p>
      <div className="overflow-hidden mb-12">
        <motion.h3
          initial={{ y: "100%", opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="font-display font-bold text-foreground"
          style={{ fontSize: "clamp(1.6rem, 2.5vw, 2.4rem)" }}
        >
          Six Stages to Full AI Transformation
        </motion.h3>
      </div>

      <div ref={timelineRef} className="relative">
        {/* Scroll-progress–driven connecting line (desktop) */}
        <div className="hidden lg:block absolute top-6 left-[4%] right-[4%] h-px" style={{ background: "rgba(33,78,207,0.04)" }}>
          <motion.div
            className="absolute inset-0 origin-left"
            style={{
              scaleX: lineScaleX,
              background: "linear-gradient(90deg, #214ECF 0%, #214ECF 60%, rgba(33,78,207,0.24) 100%)",
            }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, y: 25 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 + i * 0.1 }}
              className="flex flex-col items-center gap-4 text-center pt-2 cursor-default"
              onMouseEnter={() => setActiveStep(i)}
              onMouseLeave={() => setActiveStep(null)}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.35 + i * 0.1, type: "spring", stiffness: 200 }}
                whileHover={shouldReduce ? {} : { scale: 1.2 }}
                className="relative w-12 h-12 rounded-full flex items-center justify-center border z-10"
                style={{
                  background: activeStep === i
                    ? "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)"
                    : "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)",
                  borderColor: activeStep === i ? "rgba(71,163,255,0.6)" : "rgba(37,99,235,0.4)",
                  boxShadow: activeStep === i
                    ? "0 0 30px rgba(33,78,207,0.38), 0 0 60px rgba(33,78,207,0.15)"
                    : "0 0 20px rgba(37,99,235,0.3)",
                  transition: "all 0.3s ease",
                }}
              >
                <span className="text-xs font-bold text-foreground font-mono">0{i + 1}</span>
              </motion.div>

              <div>
                <motion.p
                  className="text-sm font-bold transition-colors duration-300"
                  style={{ color: activeStep === i ? "#214ECF" : "rgba(255,255,255,0.9)" }}
                >
                  {stage.label}
                </motion.p>
                <p className="text-xs mt-1 leading-tight" style={{ color: "rgba(33,78,207,0.22)" }}>
                  {stage.desc}
                </p>
              </div>

              {i < stages.length - 1 && (
                <div className="lg:hidden flex justify-center">
                  <motion.svg
                    width="10" height="16" viewBox="0 0 10 16" fill="none"
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    <path d="M5 0v12M1 8l4 6 4-6" stroke="#214ECF" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                  </motion.svg>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-16">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="text-xs font-mono uppercase tracking-[0.25em] mb-5"
          style={{ color: "#4B5563" }}
        >
          Engagement Models
        </motion.p>
        <div className="flex flex-wrap gap-3">
          {models.map((m, i) => (
            <motion.span
              key={m}
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
              whileHover={shouldReduce ? {} : {
                scale: 1.05,
                borderColor: "rgba(37,99,235,0.5)",
                backgroundColor: "rgba(33,78,207,0.08)",
                color: "rgba(255,255,255,1)",
              }}
              className="px-5 py-2.5 rounded-full border border-border text-sm font-medium cursor-default"
              style={{ color: "rgba(255,255,255,0.65)", transition: "all 0.25s" }}
            >
              {m}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ITServicesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const inView = useInView(headingRef, { once: true, margin: "-80px" });
  const shouldReduce = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], shouldReduce ? ["0px", "0px"] : ["50px", "-50px"]);

  return (
    <section ref={sectionRef} className="py-32 relative overflow-hidden" style={{ background: "#FFFFFF" }}>
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(33,78,207,0.04) 50%, transparent)" }}
      />
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: bgY }}>
        <div
          className="absolute bottom-0 right-0 w-[600px] h-[400px]"
          style={{ background: "radial-gradient(ellipse at 100% 100%, rgba(37,99,235,0.05) 0%, transparent 60%)", filter: "blur(40px)" }}
        />
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-5">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6 }}
              className="text-xs font-mono uppercase tracking-[0.25em] mb-4"
              style={{ color: "#4B5563" }}
            >
              IT & Technology Services · 30%
            </motion.p>
            <div ref={headingRef} className="overflow-hidden">
              <motion.h2
                initial={{ y: "100%", opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-bold text-foreground leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}
              >
                Enterprise Technology<br />
                <span style={{ color: "#214ECF" }}>Solutions That Scale</span>
              </motion.h2>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <Link
              href="/services"
              className="group flex items-center gap-2 text-sm font-medium transition-all duration-300 hover:gap-3"
              style={{ color: "#214ECF" }}
            >
              View All Technology Services
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </motion.div>
        </div>

        <div className="mb-14 h-px relative overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="absolute top-0 left-0 h-full origin-left w-full"
            style={{ background: "linear-gradient(90deg, #214ECF 0%, rgba(33,78,207,0.12) 30%, transparent 100%)" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.slice(0, 3).map((g, i) => <GroupCard key={g.id} group={g} index={i} />)}
          <div className="md:col-span-1 lg:col-span-1">
            <GroupCard group={groups[3]} index={3} />
          </div>
          <div className="md:col-span-1 lg:col-span-2">
            <GroupCard group={groups[4]} index={4} />
          </div>
        </div>

        <AIFramework />
      </div>
    </section>
  );
}
