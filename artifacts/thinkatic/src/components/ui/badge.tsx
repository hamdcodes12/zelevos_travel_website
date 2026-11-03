/**
 * Thinkatic Design System — Badge
 *
 * Variants:
 *   default     — primary filled
 *   secondary   — indigo filled
 *   destructive — red
 *   outline     — border only (subtle, dark)
 *   glow        — primary fill + blue glow ring
 *   success     — green status
 *   warning     — amber status
 *   info        — cyan status
 *   label       — uppercase monospace, muted — for taxonomy labels
 *   live        — animated green dot + "LIVE" label
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  [
    'whitespace-nowrap inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5',
    'text-xs font-semibold transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground shadow-xs',

        secondary:
          'border-transparent bg-secondary text-secondary-foreground',

        destructive:
          'border-transparent bg-destructive text-destructive-foreground shadow-xs',

        outline:
          'text-foreground border [border-color:var(--badge-outline)]',

        // Primary with blue glow — for featured/highlighted items
        glow:
          [
            'border-transparent bg-primary text-primary-foreground',
            'shadow-[0_0_12px_rgba(71,163,255,0.45)]',
          ].join(' '),

        // Status variants
        success:
          'bg-success/10 text-success border border-[var(--success-border)]',

        warning:
          'bg-warning/10 text-warning border border-[var(--warning-border)]',

        info:
          'bg-info/10 text-info border border-[var(--info-border)]',

        // Taxonomy label — monospace uppercase, muted
        label:
          'bg-transparent border border-white/[0.08] text-muted-foreground font-mono uppercase tracking-widest',

        // Live indicator — use with the LiveDot sub-component
        live:
          'bg-transparent border border-white/[0.08] text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

// ─── LiveDot — animated pulse dot for "LIVE" badges ─────────────────────────

function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-1.5 w-1.5 shrink-0', className)} aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
    </span>
  );
}

// ─── StatusBadge — convenience wrapper ───────────────────────────────────────

interface StatusBadgeProps {
  status: 'live' | 'active' | 'pending' | 'error' | 'inactive';
  label?: string;
  className?: string;
}

const statusMap: Record<StatusBadgeProps['status'], { variant: BadgeProps['variant']; dot: string; defaultLabel: string }> = {
  live:     { variant: 'success', dot: 'bg-success', defaultLabel: 'Live' },
  active:   { variant: 'success', dot: 'bg-success', defaultLabel: 'Active' },
  pending:  { variant: 'warning', dot: 'bg-warning', defaultLabel: 'Pending' },
  error:    { variant: 'destructive', dot: 'bg-destructive', defaultLabel: 'Error' },
  inactive: { variant: 'outline',  dot: 'bg-muted-foreground', defaultLabel: 'Inactive' },
};

function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusMap[status];
  return (
    <Badge variant={config.variant} className={className}>
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', config.dot)} aria-hidden="true" />
      {label ?? config.defaultLabel}
    </Badge>
  );
}

export { Badge, badgeVariants, LiveDot, StatusBadge };
