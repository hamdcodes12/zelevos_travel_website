/**
 * Thinkatic Design System — StatsCard
 *
 * KPI / metric display card. Three visual variants:
 *   default — glass card, large mono number
 *   compact — horizontal layout, for dashboard grids
 *   hero    — oversized number, for hero/section highlights
 */

import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { LiveDot } from '@/components/ui/badge';

export interface StatsCardProps {
  /** Displayed metric value (e.g. "12,847" or "99.8%") */
  value: string;
  /** Human-readable label beneath the value */
  label: string;
  /** Optional change indicator (e.g. "+18%") */
  change?: string;
  changeDirection?: 'up' | 'down' | 'neutral';
  /** Optional sub-label (e.g. "this quarter") */
  subLabel?: string;
  /** Optional icon for context */
  icon?: ReactNode;
  /** Show a live animated pulse dot */
  live?: boolean;
  /** Visual variant */
  variant?: 'default' | 'compact' | 'hero';
  className?: string;
}

const changeIcons = {
  up:      <TrendingUp className="w-3.5 h-3.5" />,
  down:    <TrendingDown className="w-3.5 h-3.5" />,
  neutral: <Minus className="w-3.5 h-3.5" />,
};

const changeColors = {
  up:      'text-success',
  down:    'text-destructive',
  neutral: 'text-muted-foreground',
};

export function StatsCard({
  value,
  label,
  change,
  changeDirection = 'neutral',
  subLabel,
  icon,
  live,
  variant = 'default',
  className,
}: StatsCardProps) {

  if (variant === 'compact') {
    return (
      <Card
        variant="glass"
        className={cn('flex items-center gap-4 p-4', className)}
      >
        {icon && (
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0" aria-hidden="true">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="font-mono font-bold text-xl text-foreground leading-tight">{value}</p>
        </div>
        {change && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium shrink-0', changeColors[changeDirection])}>
            {changeIcons[changeDirection]}
            {change}
          </span>
        )}
      </Card>
    );
  }

  if (variant === 'hero') {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <p className="font-mono font-black text-gradient text-[clamp(2rem,4vw,3.5rem)] leading-none">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  // Default
  return (
    <Card
      variant="glass"
      className={cn('flex flex-col gap-3 p-5', className)}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        {icon && (
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground" aria-hidden="true">
            {icon}
            <span className="truncate">{label}</span>
          </div>
        )}
        {live && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto" aria-label="Live data">
            <LiveDot />
            <span className="font-mono uppercase tracking-widest text-[10px]">Live</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex flex-col gap-0.5">
        <p className="font-mono font-bold text-2xl text-foreground leading-none tracking-tight">
          {value}
        </p>
        {!icon && (
          <p className="text-xs text-muted-foreground">{label}</p>
        )}
      </div>

      {/* Change */}
      {(change || subLabel) && (
        <div className="flex items-center gap-2">
          {change && (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', changeColors[changeDirection])}>
              {changeIcons[changeDirection]}
              {change}
            </span>
          )}
          {subLabel && (
            <span className="text-xs text-muted-foreground">{subLabel}</span>
          )}
        </div>
      )}
    </Card>
  );
}
