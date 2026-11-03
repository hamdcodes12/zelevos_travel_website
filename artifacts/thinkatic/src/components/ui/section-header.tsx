/**
 * Thinkatic Design System — SectionHeader
 *
 * The consistent three-part header used at the top of every section:
 *   Eyebrow → Title → Description
 *
 * Use this everywhere instead of hand-rolling heading + label markup.
 */

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow, H2, BodyLg } from '@/design-system/typography';

interface SectionHeaderProps {
  /** Small uppercase label above the title */
  eyebrow?: string;
  /** Main section title (can be a ReactNode for inline gradients) */
  title: ReactNode;
  /** Supporting paragraph */
  description?: ReactNode;
  /** Left-aligned (default) or centred */
  align?: 'left' | 'center';
  /** Extra class on the wrapper */
  className?: string;
  /** Override the eyebrow colour variant */
  eyebrowVariant?: 'default' | 'primary' | 'secondary';
  /** Limit description width on centred layouts */
  descriptionMaxWidth?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  eyebrowVariant = 'primary',
  descriptionMaxWidth,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 mb-12 md:mb-16',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      {eyebrow && (
        <Eyebrow variant={eyebrowVariant} dot>
          {eyebrow}
        </Eyebrow>
      )}

      <H2 className="max-w-3xl">
        {title}
      </H2>

      {description && (
        <BodyLg
          muted
          className={cn(
            'max-w-2xl',
            descriptionMaxWidth,
          )}
        >
          {description}
        </BodyLg>
      )}
    </div>
  );
}

// ─── Compact variant — for cards or tighter contexts ─────────────────────────

interface CardHeaderTextProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function CardHeaderText({ eyebrow, title, description, className }: CardHeaderTextProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {eyebrow && (
        <Eyebrow variant="primary" dot>
          {eyebrow}
        </Eyebrow>
      )}
      <h3 className="font-display font-semibold text-lg leading-snug text-foreground">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
