/**
 * Thinkatic Design System — TestimonialCard
 *
 * Used in the Testimonials section.
 * Variants: default (glass card) | featured (glow, larger quote)
 */

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  company: string;
  /** URL to avatar image */
  avatar?: string;
  /** 1–5 star rating */
  rating?: number;
  /** Make this card visually prominent */
  featured?: boolean;
  className?: string;
}

export function TestimonialCard({
  quote,
  author,
  role,
  company,
  avatar,
  rating,
  featured,
  className,
}: TestimonialCardProps) {
  return (
    <Card
      variant={featured ? 'glow' : 'glass'}
      className={cn(
        'flex flex-col gap-5 p-6 h-full',
        featured && 'border-primary/20',
        className,
      )}
    >
      {/* Rating stars */}
      {rating !== undefined && (
        <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                'w-3.5 h-3.5',
                i < rating ? 'fill-primary text-primary' : 'fill-muted text-muted',
              )}
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {/* Quote */}
      <blockquote className="flex-1 text-sm leading-relaxed text-foreground/80 italic">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Author */}
      <footer className="flex items-center gap-3 pt-4 border-t border-[#DCE5FF]">
        {avatar ? (
          <img
            src={avatar}
            alt={`${author} avatar`}
            className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 shrink-0"
          />
        ) : (
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0"
            aria-hidden="true"
          >
            {author.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-none truncate">{author}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {role}, <span className="text-foreground/60">{company}</span>
          </p>
        </div>
      </footer>
    </Card>
  );
}
