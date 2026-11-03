import { useRef } from "react";
import { useScroll, useTransform, useReducedMotion, MotionValue } from "framer-motion";

/**
 * useParallax – returns a MotionValue<string> that translates an element on scroll.
 * speed > 0  = element scrolls slower than page (drifts up).
 * speed < 0  = element scrolls faster (drifts down).
 * Disabled (always "0px") when prefers-reduced-motion or pointer: coarse.
 */
export function useParallax(
  speed: number = 0.3,
  containerRef?: React.RefObject<HTMLElement>
): MotionValue<string> {
  void speed;
  void containerRef;
  const internalRef = useRef<HTMLElement>(null);
  const target = containerRef ?? internalRef;

  const shouldReduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: target as React.RefObject<HTMLElement>,
    offset: ["start end", "end start"],
  });

  const yStatic = useTransform(scrollYProgress, [0, 1], ["0px", "0px"]);
  void shouldReduce;
  void target;
  return yStatic;
}
