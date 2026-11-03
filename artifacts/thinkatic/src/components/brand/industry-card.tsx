/**
 * Thinkatic Design System — IndustryCard
 *
 * Displays an industry vertical with optional KPI stat.
 */

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export interface IndustryCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Featured metric for this industry (e.g. "40%") */
  stat?: string;
  /** Label for the stat (e.g. "Faster resolution") */
  statLabel?: string;
  /** Optional accent colour override (Tailwind arbitrary, e.g. "#4F46E5") */
  accentColor?: string;
  className?: string;
  onClick?: () => void;
}

export function IndustryCard({
  icon,
  title,
  description,
  stat,
  statLabel,
  accentColor,
  className,
  onClick,
}: IndustryCardProps) {
  return (
    <Card
      variant="glass"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-4 p-6 h-full',
        'transition-all duration-300',
        'hover:border-primary/20 hover:shadow-[0_0_32px_rgba(33,78,207,0.1)]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {/* Colour accent line */}
      {accentColor && (
        <span
          className="absolute top-0 left-6 right-6 h-[1px] rounded-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }}
          aria-hidden="true"
        />
      )}

      {/* Icon */}
      {icon && (
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#F4F7FF] text-primary shrink-0 group-hover:bg-primary/10 transition-colors duration-200"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {/* Text */}
      <div className="flex-1">
        <h3 className="font-display font-semibold text-base text-foreground leading-snug mb-1.5">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Stat */}
      {stat && (
        <div className="flex items-baseline gap-1.5 mt-auto pt-3 border-t border-[#DCE5FF]">
          <span className="font-mono font-bold text-xl text-primary leading-none">
            {stat}
          </span>
          {statLabel && (
            <span className="text-xs text-muted-foreground">
              {statLabel}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
