import { motion, Variants } from "framer-motion";

interface SplitTextProps {
  text: string;
  className?: string;
  once?: boolean;
  delay?: number;
  stagger?: number;
  mode?: "words" | "chars";
  variants?: Variants;
  viewport?: { once?: boolean; margin?: string };
}

const defaultWordVariants: Variants = {
  hidden: { y: "110%", opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.75,
      ease: [0.22, 1, 0.36, 1],
      delay: i * 0.06,
    },
  }),
};

const defaultCharVariants: Variants = {
  hidden: { y: "110%", opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      delay: i * 0.03,
    },
  }),
};

export function SplitText({
  text,
  className = "",
  once = true,
  delay = 0,
  mode = "words",
  variants,
  viewport,
}: SplitTextProps) {
  const vp = viewport ?? { once, margin: "-60px" };

  if (mode === "chars") {
    const chars = text.split("");
    return (
      <motion.span
        className={`inline-flex flex-wrap ${className}`}
        initial="hidden"
        whileInView="visible"
        viewport={vp}
      >
        {chars.map((char, i) => (
          <span key={i} className="inline-block overflow-hidden">
            <motion.span
              className="inline-block"
              custom={i + delay / 0.03}
              variants={variants ?? defaultCharVariants}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          </span>
        ))}
      </motion.span>
    );
  }

  const words = text.split(" ");
  return (
    <motion.span
      className={`inline-flex flex-wrap gap-x-[0.28em] ${className}`}
      initial="hidden"
      whileInView="visible"
      viewport={vp}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden">
          <motion.span
            className="inline-block"
            custom={i + delay / 0.06}
            variants={variants ?? defaultWordVariants}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

// Line-by-line reveal for paragraphs
interface LineRevealProps {
  lines: string[];
  className?: string;
  lineClassName?: string;
  once?: boolean;
  baseDelay?: number;
}

export function LineReveal({
  lines,
  className = "",
  lineClassName = "",
  once = true,
  baseDelay = 0,
}: LineRevealProps) {
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <div key={i} className="overflow-hidden">
          <motion.p
            className={`leading-relaxed ${lineClassName}`}
            initial={{ y: "100%", opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once, margin: "-40px" }}
            transition={{
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
              delay: baseDelay + i * 0.1,
            }}
          >
            {line}
          </motion.p>
        </div>
      ))}
    </div>
  );
}
