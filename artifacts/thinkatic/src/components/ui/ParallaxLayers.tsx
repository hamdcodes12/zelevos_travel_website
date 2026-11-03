import { motion } from "framer-motion";

// ── Moving grid – GPU-accelerated via transform translate ─────────────────────
export function MovingGrid({
  opacity = 0.04,
  size = 44,
  duration = 22,
  color = "71,163,255",
}: {
  opacity?: number;
  size?: number;
  duration?: number;
  color?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute"
        style={{
          inset: `-${size}px`,
          backgroundImage: `linear-gradient(rgba(${color},${opacity}) 1px, transparent 1px), linear-gradient(90deg, rgba(${color},${opacity}) 1px, transparent 1px)`,
          backgroundSize: `${size}px ${size}px`,
        }}
      />
    </div>
  );
}

// ── Ambient floating particles ────────────────────────────────────────────────
export function AmbientParticles({
  count = 24,
  color = "rgba(71,163,255,0.45)",
  seed = 0,
}: {
  count?: number;
  color?: string;
  seed?: number;
}) {
  void count;
  void color;
  void seed;
  return null;
}

// ── Ambient glow orb with optional parallax motion value ─────────────────────
export function GlowOrb({
  x,
  y,
  size = 600,
  color = "rgba(37,99,235,0.07)",
  blur = 80,
  animate: animateProps,
  duration = 7,
  delay = 0,
  className = "",
}: {
  x: string;
  y: string;
  size?: number;
  color?: string;
  blur?: number;
  animate?: { scale?: number[]; opacity?: number[] };
  duration?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
        filter: `blur(${blur}px)`,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

// ── Neural lines – SVG animated connection lines ───────────────────────────────
export function NeuralLines({ opacity = 0.06 }: { opacity?: number }) {
  const paths = [
    "M 0 30 L 25 60 L 50 20 L 75 50 L 100 35",
    "M 0 70 L 20 40 L 45 75 L 70 30 L 100 55",
    "M 10 0 L 35 45 L 60 15 L 85 60 L 100 80",
  ];
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity }}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="#214ECF"
          strokeWidth="0.15"
          fill="none"
          strokeDasharray="3 5"
          opacity={0.8}
        />
      ))}
      {[[15, 45], [50, 20], [80, 55], [30, 75], [65, 35]].map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r="0.6"
          fill="#214ECF"
          opacity={0.7}
        />
      ))}
    </svg>
  );
}
