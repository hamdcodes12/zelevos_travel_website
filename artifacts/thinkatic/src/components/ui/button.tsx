/**
 * Thinkatic Design System — Button
 *
 * Variants:
 *   default    — primary filled (electric blue)
 *   cta        — gradient pill, premium call-to-action
 *   glass      — glass panel surface
 *   gradient   — gradient border, transparent fill
 *   destructive — danger
 *   outline    — border only, inherits bg
 *   secondary  — deep indigo fill
 *   ghost      — transparent
 *   link       — underline text
 *
 * Sizes: sm | default | lg | xl | icon
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    'hover-elevate active-elevate-2',
  ].join(' '),
  {
    variants: {
      variant: {
        // Primary — electric blue fill
        default:
          'bg-primary text-primary-foreground border border-primary-border rounded-lg',

        // Premium gradient pill — the strongest CTA on the page
        cta:
          [
            'bg-gradient-to-r from-primary to-secondary text-foreground font-semibold',
            'rounded-full border-0',
            'shadow-[0_0_24px_rgba(33,78,207,0.24)]',
            'hover:shadow-[0_0_36px_rgba(71,163,255,0.45)] hover:scale-[1.02]',
          ].join(' '),

        // Glass panel surface
        glass:
          'glass-panel text-foreground rounded-lg hover:bg-white/[0.08] transition-colors',

        // Gradient border, transparent fill
        gradient:
          'gradient-border bg-transparent text-foreground rounded-lg border-transparent',

        destructive:
          'bg-destructive text-destructive-foreground shadow-sm border border-destructive-border rounded-lg',

        outline:
          'border [border-color:var(--button-outline)] shadow-xs active:shadow-none rounded-lg',

        secondary:
          'bg-secondary text-secondary-foreground border border-secondary-border rounded-lg',

        ghost:
          'border border-transparent rounded-lg',

        link:
          'text-primary underline-offset-4 hover:underline border-0 shadow-none',
      },

      size: {
        sm:      'min-h-8 h-8 px-3 text-xs rounded-md',
        default: 'min-h-9 h-9 px-4 py-2 text-sm',
        lg:      'min-h-10 h-10 px-6 text-sm',
        xl:      'min-h-12 h-12 px-8 text-base',
        icon:    'h-9 w-9',
        'icon-sm': 'h-8 w-8',
        'icon-lg': 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
