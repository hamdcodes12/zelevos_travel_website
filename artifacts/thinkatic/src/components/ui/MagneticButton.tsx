import { useState } from "react";
import { motion } from "framer-motion";

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  strength?: number;
}

export function MagneticButton({
  children,
  className = "",
  variant = "primary",
  strength = 0.4,
  ...props
}: MagneticButtonProps) {
  const [hovered, setHovered] = useState(false);

  const handleMouseLeave = () => {
    setHovered(false);
  };

  const variants = {
    primary:
      "bg-primary text-foreground hover:shadow-[0_0_40px_rgba(33,78,207,0.38)]",
    secondary:
      "bg-secondary text-foreground hover:shadow-[0_0_40px_rgba(99,102,241,0.5)]",
    outline:
      "border border-primary/50 text-foreground hover:bg-primary/10 hover:shadow-[0_0_30px_rgba(33,78,207,0.18)]",
  };

  return (
    <motion.div
      style={{ display: "inline-block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      <button
        className={`relative px-8 py-4 rounded-full font-medium tracking-wide transition-shadow duration-300 overflow-hidden ${variants[variant]} ${className}`}
        data-strength={strength}
        {...props}
      >
        {/* Shimmer sweep on hover */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ x: "-100%", opacity: 0 }}
          animate={hovered ? { x: "200%", opacity: 1 } : { x: "-100%", opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(33,78,207,0.12), transparent)",
          }}
        />
        <motion.span className="relative z-10 block">
          {children}
        </motion.span>
      </button>
    </motion.div>
  );
}
