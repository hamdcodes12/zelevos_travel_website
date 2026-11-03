import React from "react";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxTilt?: number;
  liftY?: number;
  disabled?: boolean;
}

/**
 * Lightweight, GPU-accelerated Hover Card.
 * Ultra smooth 60fps performance without CPU-bound mouse tracking or frame drops.
 */
export function TiltCard({
  children,
  className = "",
  style,
  maxTilt: _maxTilt,
  liftY: _liftY,
  disabled = false,
}: TiltCardProps) {
  if (disabled) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
