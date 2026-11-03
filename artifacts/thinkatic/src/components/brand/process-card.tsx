/**
 * Thinkatic Design System — ProcessCard
 *
 * A numbered step card for process / how-it-works sections.
 * Supports a vertical connector line between steps via `isLast`.
 *
 * Variants:
 *   default — glass card with step number
 *   timeline — horizontal connector layout
 */

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export interface ProcessCardProps {
  step: number | string;
  title: string;
  description: string;
  icon?: ReactNode;
  /** Hide the bottom connector line on the last card */
  isLast?: boolean;
  variant?: 'default' | 'timeline';
  className?: string;
}

export function ProcessCard({
  step,
  title,
  description,
  icon,
  isLast,
  variant = 'default',
  className,
}: ProcessCardProps) {
  const stepNum = String(step).padStart(2, '0');

  if (variant === 'timeline') {
    return (
      <div className={cn('relative flex gap-4', className)}>
        {/* Connector column */}
        <div className="flex flex-col items-center shrink-0">
          {/* Step circle */}
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-mono text-xs font-bold ring-1 ring-primary/20 shrink-0 z-10"
            aria-label={`Step ${stepNum}`}
          >
            {stepNum}
          </div>
          {/* Connector line */}
          {!isLast && (
            <div
              className="w-px flex-1 mt-2 bg-gradient-to-b from-primary/20 to-transparent min-h-[2rem]"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1.5 pb-8">
          <div className="flex items-center gap-2">
            {icon && (
              <span className="text-primary" aria-hidden="true">{icon}</span>
            )}
            <h3 className="font-display font-semibold text-base text-foreground leading-snug">
              {title}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <Card
      variant="glass"
      className={cn('relative flex flex-col gap-4 p-6 h-full', className)}
    >
      {/* Step number — top-left accent */}
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-xs font-bold text-primary bg-primary/10 rounded-md px-2 py-0.5"
          aria-label={`Step ${stepNum}`}
        >
          {stepNum}
        </span>
        {icon && (
          <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
        )}
      </div>

      {/* Text */}
      <div className="flex flex-col gap-2">
        <h3 className="font-display font-semibold text-base text-foreground leading-snug">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {/* Bottom connector dot (not last) */}
      {!isLast && (
        <div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary/30"
          aria-hidden="true"
        />
      )}
    </Card>
  );
}
