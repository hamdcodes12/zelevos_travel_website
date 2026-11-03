/**
 * Thinkatic Design System — ServiceCard
 *
 * Used on the Services page and homepage BPO section to display
 * an individual service offering.
 */

import { type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ServiceCardProps {
  /** Icon or illustration — rendered in the icon slot */
  icon?: ReactNode;
  /** Service name */
  title: string;
  /** One or two sentence summary */
  description: string;
  /** Optional taxonomy tags */
  tags?: string[];
  /** Optional link — renders an arrow + makes card interactive */
  href?: string;
  /** Accent number (e.g. "01") rendered top-right in muted mono */
  index?: string | number;
  /** Highlight this card (e.g. featured service) */
  featured?: boolean;
  className?: string;
}

export function ServiceCard({
  icon,
  title,
  description,
  tags,
  href,
  index,
  featured,
  className,
}: ServiceCardProps) {
  const isInteractive = Boolean(href);

  const inner = (
    <Card
      variant={featured ? 'glow' : 'glass'}
      className={cn(
        'group relative flex flex-col gap-5 p-6 h-full',
        isInteractive && 'cursor-pointer',
        className,
      )}
    >
      {/* Index number */}
      {index !== undefined && (
        <span className="absolute top-5 right-5 font-mono text-xs text-muted-foreground/40 select-none" aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
      )}

      {/* Icon */}
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center w-11 h-11 rounded-xl shrink-0',
            featured
              ? 'bg-primary/10 text-primary'
              : 'bg-white/[0.05] text-primary',
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      {/* Text */}
      <div className="flex flex-col gap-2 flex-1">
        <h3 className="font-display font-semibold text-base leading-snug text-foreground">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {description}
        </p>
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="label" className="text-[10px] py-0.5 px-2">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Arrow — shown on hover when card is a link */}
      {isInteractive && (
        <div className="flex items-center gap-1 text-xs font-medium text-primary mt-auto pt-2 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all duration-200">
          Learn more
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
      )}
    </Card>
  );

  if (href) {
    return (
      <a href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
        {inner}
      </a>
    );
  }

  return inner;
}
