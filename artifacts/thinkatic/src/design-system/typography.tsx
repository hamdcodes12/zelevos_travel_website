/**
 * Thinkatic Design System — Typography
 *
 * An enterprise-grade type scale built on:
 *   - Plus Jakarta Sans → Headings & Display moments (geometric, bold, commanding)
 *   - Inter             → Body prose & UI interface (clean, open, hyper-readable)
 *   - JetBrains Mono    → Telemetry numbers, status badges, code & metadata
 *
 * Scale:
 *   Display    → hero / massive brand moments
 *   H1–H4      → page / section / card headings
 *   Body       → prose content (lg / base / sm)
 *   Label      → UI labels, eyebrows, captions
 *   Mono       → numbers, codes, metadata
 */

import { type ReactNode, type ElementType } from 'react';
import { cn } from '@/lib/utils';

// ─── Shared interface ─────────────────────────────────────────────────────────

interface TypographyProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  gradient?: boolean; // applies .text-gradient
  gradientBlue?: boolean; // applies .text-gradient-blue
  muted?: boolean;
}

// ─── Display ─────────────────────────────────────────────────────────────────
// Intended for hero-level headings. Clamp ensures fluid scaling.

export function Display({ children, className, as: Tag = 'h1', gradient, gradientBlue, muted }: TypographyProps) {
  return (
    <Tag
      className={cn(
        'font-display font-extrabold tracking-[-0.038em] leading-[0.98]',
        'text-[clamp(2.75rem,6vw,5rem)] text-slate-900',
        muted && 'text-slate-600',
        gradient && 'text-gradient',
        gradientBlue && 'text-gradient-blue',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── DisplaySm ───────────────────────────────────────────────────────────────

export function DisplaySm({ children, className, as: Tag = 'h1', gradient, gradientBlue, muted }: TypographyProps) {
  return (
    <Tag
      className={cn(
        'font-display font-extrabold tracking-[-0.032em] leading-[1.02]',
        'text-[clamp(2rem,4.5vw,3.75rem)] text-slate-900',
        muted && 'text-slate-600',
        gradient && 'text-gradient',
        gradientBlue && 'text-gradient-blue',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── H1 ──────────────────────────────────────────────────────────────────────

export function H1({ children, className, as: Tag = 'h1', gradient, gradientBlue, muted }: TypographyProps) {
  return (
    <Tag
      className={cn(
        'font-display font-bold tracking-[-0.03em] leading-[1.05]',
        'text-[clamp(1.875rem,3.5vw,3rem)] text-slate-900',
        muted && 'text-slate-600',
        gradient && 'text-gradient',
        gradientBlue && 'text-gradient-blue',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── H2 ──────────────────────────────────────────────────────────────────────

export function H2({ children, className, as: Tag = 'h2', gradient, gradientBlue, muted }: TypographyProps) {
  return (
    <Tag
      className={cn(
        'font-display font-bold tracking-[-0.028em] leading-[1.08]',
        'text-[clamp(1.5rem,2.5vw,2.5rem)] text-slate-900',
        muted && 'text-slate-600',
        gradient && 'text-gradient',
        gradientBlue && 'text-gradient-blue',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── H3 ──────────────────────────────────────────────────────────────────────

export function H3({ children, className, as: Tag = 'h3', gradient, gradientBlue, muted }: TypographyProps) {
  return (
    <Tag
      className={cn(
        'font-display font-bold tracking-[-0.02em] leading-[1.18]',
        'text-[clamp(1.125rem,1.75vw,1.625rem)] text-slate-900',
        muted && 'text-slate-600',
        gradient && 'text-gradient',
        gradientBlue && 'text-gradient-blue',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── H4 ──────────────────────────────────────────────────────────────────────

export function H4({ children, className, as: Tag = 'h4', gradient, gradientBlue, muted }: TypographyProps) {
  return (
    <Tag
      className={cn(
        'font-display font-semibold tracking-[-0.015em] leading-[1.28]',
        'text-[clamp(1rem,1.5vw,1.25rem)] text-slate-900',
        muted && 'text-slate-600',
        gradient && 'text-gradient',
        gradientBlue && 'text-gradient-blue',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── BodyLg ──────────────────────────────────────────────────────────────────

export function BodyLg({ children, className, as: Tag = 'p', muted }: Omit<TypographyProps, 'gradient' | 'gradientBlue'>) {
  return (
    <Tag
      className={cn(
        'font-sans text-lg md:text-xl leading-relaxed font-normal tracking-[-0.01em]',
        muted ? 'text-slate-500' : 'text-slate-600',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────

export function Body({ children, className, as: Tag = 'p', muted }: Omit<TypographyProps, 'gradient' | 'gradientBlue'>) {
  return (
    <Tag
      className={cn(
        'font-sans text-base leading-relaxed font-normal tracking-[-0.008em]',
        muted ? 'text-slate-500' : 'text-slate-600',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── BodySm ───────────────────────────────────────────────────────────────────

export function BodySm({ children, className, as: Tag = 'p', muted }: Omit<TypographyProps, 'gradient' | 'gradientBlue'>) {
  return (
    <Tag
      className={cn(
        'font-sans text-sm leading-relaxed font-normal',
        muted ? 'text-slate-500' : 'text-slate-600',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────
// UI labels — uppercase, tight tracking, small size.

interface LabelTypographyProps extends TypographyProps {
  size?: 'xs' | 'sm';
}

export function LabelText({ children, className, as: Tag = 'span', size = 'xs', muted }: LabelTypographyProps) {
  return (
    <Tag
      className={cn(
        'font-mono font-bold uppercase tracking-[0.2em]',
        size === 'xs' ? 'text-xs' : 'text-sm',
        muted ? 'text-slate-500' : 'text-slate-700',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

// ─── Eyebrow ──────────────────────────────────────────────────────────────────
// The tiny category label that floats above section headings.

interface EyebrowProps extends TypographyProps {
  dot?: boolean; // prepend a glowing dot
  variant?: 'default' | 'primary' | 'secondary';
}

export function Eyebrow({ children, className, as: Tag = 'span', dot, variant = 'primary' }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        'inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.22em]',
        variant === 'default' && 'text-slate-600',
        variant === 'primary' && 'text-[#214ECF]',
        variant === 'secondary' && 'text-[#059669]',
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'primary' ? 'bg-[#214ECF] shadow-[0_0_6px_rgba(33,78,207,0.6)]' : 'bg-slate-400',
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </Tag>
  );
}

// ─── Mono ─────────────────────────────────────────────────────────────────────
// Numbers, codes, metadata.

export function MonoText({ children, className, as: Tag = 'span', muted }: Omit<TypographyProps, 'gradient' | 'gradientBlue'>) {
  return (
    <Tag
      className={cn(
        'font-mono text-sm tracking-tight tabular-nums',
        muted ? 'text-slate-500' : 'text-slate-800',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
