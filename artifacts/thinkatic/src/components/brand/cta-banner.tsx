/**
 * Thinkatic Design System — CTABanner
 *
 * Full-width call-to-action section. Three visual variants:
 *   default  — centred text + 2 buttons on dark glass surface
 *   gradient — gradient background strip
 *   split    — left text + right button (wide layout)
 */

import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Eyebrow } from '@/design-system/typography';

export interface CTAAction {
  label: string;
  href: string;
}

export interface CTABannerProps {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  primaryAction?: CTAAction;
  secondaryAction?: CTAAction;
  variant?: 'default' | 'gradient' | 'split';
  className?: string;
}

export function CTABanner({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'default',
  className,
}: CTABannerProps) {

  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      {primaryAction && (
        <Button variant="cta" size="xl" asChild>
          <a href={primaryAction.href}>
            {primaryAction.label}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
        </Button>
      )}
      {secondaryAction && (
        <Button variant="outline" size="xl" asChild>
          <a href={secondaryAction.href}>
            {secondaryAction.label}
          </a>
        </Button>
      )}
    </div>
  );

  if (variant === 'gradient') {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl px-8 py-16 text-center',
          'bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent',
          'border border-primary/20',
          className,
        )}
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-center gap-6">
          {eyebrow && <Eyebrow variant="primary" dot>{eyebrow}</Eyebrow>}
          <h2 className="font-display font-bold text-[clamp(1.75rem,3vw,2.75rem)] leading-tight tracking-tight max-w-2xl">
            {title}
          </h2>
          {description && (
            <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
              {description}
            </p>
          )}
          {actions}
        </div>
      </div>
    );
  }

  if (variant === 'split') {
    return (
      <div
        className={cn(
          'flex flex-col md:flex-row md:items-center md:justify-between gap-8',
          'glass-card gradient-border rounded-2xl px-8 py-10',
          className,
        )}
      >
        <div className="flex flex-col gap-3 max-w-xl">
          {eyebrow && <Eyebrow variant="primary" dot>{eyebrow}</Eyebrow>}
          <h2 className="font-display font-bold text-2xl leading-snug tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <div className="shrink-0">{actions}</div>
      </div>
    );
  }

  // Default — centred
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-6 text-center',
        'glass-card gradient-border rounded-3xl px-8 py-16',
        className,
      )}
    >
      {eyebrow && <Eyebrow variant="primary" dot>{eyebrow}</Eyebrow>}
      <h2 className="font-display font-bold text-[clamp(1.75rem,3vw,2.75rem)] leading-tight tracking-tight max-w-2xl">
        {title}
      </h2>
      {description && (
        <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
          {description}
        </p>
      )}
      {actions}
    </div>
  );
}
