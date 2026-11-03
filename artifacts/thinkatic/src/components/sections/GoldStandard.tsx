import { motion } from "framer-motion";
import { Link } from "wouter";

function Shape3DRing({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={className} style={style}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background: "transparent",
          border: "28px solid transparent",
          backgroundImage:
            "linear-gradient(#FFFFFF, #FFFFFF), linear-gradient(135deg, #214ECF 0%, #4A7BFF 45%, #93C5FD 100%)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          boxShadow: "0 0 60px rgba(29,233,182,0.15), inset 0 0 40px rgba(0,0,0,0.5)",
          transform: "rotate(-15deg)",
        }}
      />
    </div>
  );
}

function Shape3DBlob({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        ...style,
        borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%",
        background:
          "linear-gradient(135deg, #214ECF 0%, #4A7BFF 55%, #93C5FD 100%)",
        boxShadow:
          "0 20px 80px rgba(29,233,182,0.2), 0 0 120px rgba(69,39,160,0.3), inset 0 0 60px rgba(0,0,0,0.4)",
        filter: "brightness(1.1)",
      }}
    />
  );
}

function Shape3DPetal({ className, style, rotate = 0 }: { className?: string; style?: React.CSSProperties; rotate?: number }) {
  return (
    <div
      className={className}
      style={{
        ...style,
        transform: `rotate(${rotate}deg)`,
        borderRadius: "70% 30% 70% 30% / 30% 70% 30% 70%",
        background:
          "linear-gradient(160deg, #93C5FD 0%, #4A7BFF 35%, #214ECF 100%)",
        boxShadow: "0 10px 60px rgba(0,172,193,0.3), inset 0 0 40px rgba(0,0,0,0.5)",
        filter: "brightness(1.05)",
      }}
    />
  );
}

function Shape3DInnerOrb({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={className}
      style={{
        ...style,
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 35% 35%, #FFFFFF 0%, #93C5FD 25%, #4A7BFF 55%, #214ECF 100%)",
        boxShadow: "0 0 80px rgba(77,208,225,0.25), inset 0 0 50px rgba(0,0,0,0.6)",
      }}
    />
  );
}

export function GoldStandard() {
  return (
    <section
      className="relative min-h-[100vh] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(150deg, #FFFFFF 0%, #F4F7FF 45%, #EEF3FF 100%)",
      }}
    >
      {/* Subtle radial glow behind shapes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 65% 50%, rgba(29,233,182,0.12) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 50% 50%, rgba(100,60,220,0.18) 0%, transparent 60%)",
        }}
      />

      {/* — TOP-LEFT RING — */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          willChange: "transform",
          top: "-8%",
          left: "-4%",
          width: "clamp(180px, 22vw, 320px)",
          height: "clamp(180px, 22vw, 320px)",
        }}
      >
        <Shape3DRing className="w-full h-full" />
      </motion.div>

      {/* — TOP-RIGHT SPHERE — */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          willChange: "transform",
          top: "-12%",
          right: "-2%",
          width: "clamp(140px, 18vw, 260px)",
          height: "clamp(140px, 18vw, 260px)",
        }}
      >
        <Shape3DInnerOrb className="w-full h-full" />
      </motion.div>

      {/* — CENTER-RIGHT LARGE ABSTRACT — */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          willChange: "transform",
          right: "clamp(-60px, -3%, 0px)",
          bottom: "-5%",
          width: "clamp(260px, 38vw, 580px)",
          height: "clamp(260px, 38vw, 580px)",
        }}
      >
        <div className="relative w-full h-full">
          <Shape3DPetal
            className="absolute"
            style={{ width: "75%", height: "85%", top: "5%", left: "15%", opacity: 0.75 }}
            rotate={-30}
          />
          <Shape3DPetal
            className="absolute"
            style={{ width: "70%", height: "80%", top: "15%", left: "5%", opacity: 0.85 }}
            rotate={20}
          />
          <Shape3DBlob
            className="absolute"
            style={{ width: "55%", height: "55%", top: "22%", left: "22%", opacity: 0.9 }}
          />
          <Shape3DInnerOrb
            className="absolute"
            style={{ width: "35%", height: "35%", top: "32%", left: "32%", opacity: 0.7 }}
          />
        </div>
      </motion.div>

      {/* — BOTTOM-LEFT ACCENT PETAL — */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "-10%",
          left: "2%",
          width: "clamp(100px, 13vw, 180px)",
          height: "clamp(100px, 13vw, 180px)",
          opacity: 0.6,
        }}
      >
        <Shape3DPetal className="w-full h-full" rotate={45} />
      </div>

      {/* ─── Text Content ─── */}
      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-8 md:px-16 flex flex-col items-center justify-center text-center"
        style={{ opacity: 1 }}
      >
        <motion.h2
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="font-display font-bold text-foreground leading-[1.05] mb-8"
          style={{ fontSize: "clamp(2.8rem, 6.5vw, 6rem)" }}
          data-testid="gold-standard-heading"
        >
          The Gold Standard in UX + AI
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-lg md:text-xl leading-relaxed mb-6 max-w-xl"
          style={{ color: "rgba(255,255,255,0.65)" }}
        >
          We've been designing AI experiences since 2017, and we're dominating.
          We've tackled FinTech, HealthTech, LegalTech, SalesTech, Media, and more.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-base mb-10"
          style={{ color: "#4B5563" }}
        >
          Want to see how we do it?
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.4 }}
        >
          <Link href="/case-studies" data-testid="button-ux-ai-innovations">
            <button
              className="group relative flex items-center gap-3 px-8 py-4 rounded-full border border-white/30 bg-white/5 backdrop-blur-sm text-foreground text-sm font-bold tracking-[0.2em] uppercase transition-all duration-300 hover:border-white/60 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]"
            >
              Check Our UX + AI Innovations Here
              <span className="text-base transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                ↗
              </span>
            </button>
          </Link>
        </motion.div>
      </motion.div>

      {/* Vignette edges */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(to right, rgba(3,0,30,0.5) 0%, transparent 20%, transparent 80%, rgba(3,0,30,0.5) 100%)"
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(to bottom, rgba(3,0,30,0.6) 0%, transparent 20%, transparent 80%, rgba(3,0,30,0.6) 100%)"
      }} />
    </section>
  );
}
