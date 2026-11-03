/**
 * Thinkatic Design System — Section & Container
 *
 * Section  — semantic <section> wrapper with consistent vertical rhythm.
 * Container — max-width + horizontal padding, multiple width variants.
 * Grid      — 12-col responsive grid utility.
 */

import { type ReactNode, type ElementType } from 'react';
import { cn } from '@/lib/utils';

// ─── Container ────────────────────────────────────────────────────────────────

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  size?: ContainerSize;
  /** Remove horizontal padding (useful when nesting containers) */
  noPad?: boolean;
}

const containerSizes: Record<ContainerSize, string> = {
  sm:   'max-w-2xl',
  md:   'max-w-3xl',
  lg:   'max-w-5xl',
  xl:   'max-w-7xl',
  '2xl':'max-w-[1400px]',
  full: 'max-w-none',
};

export function Container({ children, className, size = 'xl', noPad }: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        containerSizes[size],
        !noPad && 'px-4 sm:px-6 lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export type SectionSpacing = 'sm' | 'md' | 'lg' | 'xl' | 'none';

interface SectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
  as?: ElementType;
  spacing?: SectionSpacing;
  /** Stretch to full bleed (no container inside) */
  fullBleed?: boolean;
}

const sectionSpacing: Record<SectionSpacing, string> = {
  none: '',
  sm:   'py-16',
  md:   'py-24',
  lg:   'py-32',
  xl:   'py-40',
};

export function Section({ children, id, className, as: Tag = 'section', spacing = 'md', fullBleed }: SectionProps) {
  return (
    <Tag
      id={id}
      className={cn(
        'relative w-full',
        sectionSpacing[spacing],
        className,
      )}
    >
      {fullBleed ? children : (
        <Container>{children}</Container>
      )}
    </Tag>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

interface GridProps {
  children: ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg';
}

const gridCols: Record<NonNullable<GridProps['cols']>, string> = {
  1:  'grid-cols-1',
  2:  'grid-cols-1 sm:grid-cols-2',
  3:  'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4:  'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  6:  'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  12: 'grid-cols-12',
};

const gridGap: Record<NonNullable<GridProps['gap']>, string> = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
};

export function Grid({ children, className, cols = 3, gap = 'md' }: GridProps) {
  return (
    <div className={cn('grid', gridCols[cols], gridGap[gap], className)}>
      {children}
    </div>
  );
}
