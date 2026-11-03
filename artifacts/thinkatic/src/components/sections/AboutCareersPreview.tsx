import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import { TiltCard } from "@/components/ui/TiltCard";

const coreValues = ["Innovation", "Integrity", "Ownership", "Customer Success", "Continuous Learning", "Speed", "Excellence"];

const openRoles = [
  { role: "Customer Support Executive", dept: "Operations", type: "Full-time" },
  { role: "Healthcare Process Associate", dept: "Healthcare BPO", type: "Full-time" },
  { role: "Call Transfer Specialist", dept: "Operations", type: "Full-time" },
  { role: "Sales Development Representative", dept: "Sales", type: "Full-time" },
  { role: "AI Engineer", dept: "Technology", type: "Full-time" },
  { role: "Software Developer", dept: "Technology", type: "Full-time" },
];

export function AboutPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-32 relative overflow-hidden" style={{ background: "#FFFFFF" }}>
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(33,78,207,0.04) 50%, transparent)" }}
      />
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 20% 50%, rgba(37,99,235,0.04) 0%, transparent 60%)" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div ref={ref}>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-xs font-mono uppercase tracking-[0.25em] mb-5"
              style={{ color: "#4B5563" }}
            >
              About Us
            </motion.p>

            <div className="overflow-hidden mb-6">
              <motion.h2
                initial={{ y: "100%", opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="font-display font-bold text-foreground leading-[1.05]"
                style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)" }}
              >
                Building The Future Of<br />
                <span style={{ color: "#214ECF" }}>Intelligent Business Operations</span>
              </motion.h2>
            </div>

            {[
              "Thinkatic is a next-generation AI-powered BPO and technology company helping businesses transform operations through outsourcing, automation, and software innovation.",
              "We believe technology should empower people — not replace them.",
            ].map((line, i) => (
              <div key={i} className="overflow-hidden mb-4">
                <motion.p
                  initial={{ y: "100%", opacity: 0 }}
                  animate={inView ? { y: 0, opacity: 1 } : {}}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 + i * 0.12 }}
                  className="text-base leading-relaxed"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {line}
                </motion.p>
              </div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="mt-8"
            >
              <Link href="/about">
                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: "0 0 35px rgba(33,78,207,0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-foreground text-sm tracking-wide"
                  style={{
                    background: "linear-gradient(135deg, #214ECF 0%, #214ECF 100%)",
                    boxShadow: "0 0 20px rgba(33,78,207,0.18)",
                    letterSpacing: "0.04em",
                  }}
                >
                  Learn About Thinkatic
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </motion.button>
              </Link>
            </motion.div>
          </div>

          {/* Right – Mission, Vision, Values with TiltCard */}
          <div className="flex flex-col gap-4">
            {[
              {
                label: "Mission",
                color: "#214ECF",
                text: "To build intelligent business operations that create measurable value through people, technology, and innovation.",
              },
              {
                label: "Vision",
                color: "#214ECF",
                text: "To transform businesses through intelligent and future-ready AI technology.",
              },
            ].map((card, i) => (
              <TiltCard key={card.label} maxTilt={5} liftY={4}>
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.25 + i * 0.12 }}
                  className="group rounded-2xl p-7 border border-border bg-[#FFFFFF] relative overflow-hidden cursor-default"
                  style={{ transition: "border-color 0.35s" }}
                >
                  <div
                    className="absolute top-0 right-0 w-px h-0 group-hover:h-full transition-all duration-500"
                    style={{ background: card.color, opacity: 0.3 }}
                  />
                  <span className="text-xs font-mono tracking-[0.2em] uppercase mb-2 block" style={{ color: card.color }}>
                    {card.label}
                  </span>
                  <p className="font-medium text-foreground leading-relaxed text-sm">{card.text}</p>
                </motion.div>
              </TiltCard>
            ))}

            {/* Core Values */}
            <TiltCard maxTilt={3} liftY={3}>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
                className="rounded-2xl p-7 border border-border bg-[#FFFFFF]"
              >
                <span className="text-xs font-mono tracking-[0.2em] uppercase mb-4 block" style={{ color: "#4B5563" }}>
                  Core Values
                </span>
                <div className="flex flex-wrap gap-2">
                  {coreValues.map((v, i) => (
                    <motion.span
                      key={v}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={inView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ duration: 0.35, delay: 0.55 + i * 0.06 }}
                      whileHover={{ scale: 1.04, color: "#214ECF", borderColor: "rgba(37,99,235,0.4)" }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border font-medium cursor-default"
                      style={{ color: "rgba(255,255,255,0.65)", background: "rgba(244,247,255,0.8)", transition: "all 0.25s" }}
                    >
                      {v}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            </TiltCard>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleRow({
  role,
  index,
  inView,
}: {
  role: { role: string; dept: string; type: string };
  index: number;
  inView: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group flex items-center justify-between rounded-xl px-6 py-5 border border-border bg-[#FFFFFF] cursor-pointer relative overflow-hidden"
      style={{
        transition: "border-color 0.35s, background 0.35s, transform 0.3s",
        borderColor: hovered ? "rgba(37,99,235,0.3)" : "rgba(33,78,207,0.06)",
        background: hovered ? "rgba(8,27,58,0.2)" : "#FFFFFF",
        transform: hovered ? "translateX(6px)" : "translateX(0)",
      }}
    >
      <motion.div
        className="absolute left-0 top-0 bottom-0 w-[2px] rounded-l-xl"
        animate={{ scaleY: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{ background: "#214ECF", transformOrigin: "top" }}
      />

      <div className="flex items-center gap-5">
        <motion.span
          className="text-xs font-mono tabular-nums"
          animate={{ color: hovered ? "rgba(37,99,235,0.8)" : "rgba(255,255,255,0.2)" }}
          transition={{ duration: 0.3 }}
        >
          0{index + 1}
        </motion.span>
        <div>
          <motion.p
            className="font-medium text-sm"
            animate={{ color: hovered ? "#fff" : "rgba(255,255,255,0.85)" }}
            transition={{ duration: 0.25 }}
          >
            {role.role}
          </motion.p>
          <p className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "rgba(33,78,207,0.22)" }}>
            {role.dept}
            <span className="inline-block w-1 h-1 rounded-full bg-white/20" />
            {role.type}
          </p>
        </div>
      </div>

      <motion.div
        className="flex items-center gap-2 text-xs font-bold"
        animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : 8 }}
        transition={{ duration: 0.25 }}
        style={{ color: "#214ECF" }}
      >
        Apply Now
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </motion.div>
    </motion.div>
  );
}

export function CareersPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="py-32 relative overflow-hidden" style={{ background: "#FFFFFF" }}>
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(33,78,207,0.04) 50%, transparent)" }}
      />
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute bottom-0 left-1/4 w-[400px] h-[300px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.04) 0%, transparent 70%)", filter: "blur(40px)" }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div ref={ref}>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="text-xs font-mono uppercase tracking-[0.25em] mb-4"
              style={{ color: "#4B5563" }}
            >
              Careers
            </motion.p>
            <div className="overflow-hidden">
              <motion.h2
                initial={{ y: "100%", opacity: 0 }}
                animate={inView ? { y: 0, opacity: 1 } : {}}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="font-display font-bold text-foreground"
                style={{ fontSize: "clamp(2rem, 4vw, 3.4rem)" }}
              >
                Grow with Thinkatic.
              </motion.h2>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link href="/about">
              <motion.span
                className="flex items-center gap-2 text-sm font-medium cursor-pointer"
                whileHover={{ gap: "12px" }}
                style={{ color: "#214ECF" }}
              >
                View All Positions
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </motion.span>
            </Link>
          </motion.div>
        </div>

        <div className="flex flex-col gap-2">
          {openRoles.map((role, i) => (
            <RoleRow key={role.role} role={role} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
