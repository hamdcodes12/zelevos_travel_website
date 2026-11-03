---
name: Design System
description: What was built in Phase 1, where things live, and what remains.
---

# Thinkatic Design System — Phase 1

## What was built

**Typography** — `src/design-system/typography.tsx`  
Display, DisplaySm, H1–H4, BodyLg, Body, BodySm, LabelText, Eyebrow, MonoText.  
All use fluid `clamp()` sizing. Barrel at `src/design-system/index.ts`.

**Enhanced primitives** (drop-in replacements, fully backward-compatible):
- `src/components/ui/button.tsx` — added `cta` (gradient pill), `glass`, `gradient`, `xl` size, `icon-sm/lg` sizes
- `src/components/ui/badge.tsx` — added `glow`, `success`, `warning`, `info`, `label`, `live`; plus `LiveDot` and `StatusBadge` sub-components
- `src/components/ui/card.tsx` — added `glass` / `surface` / `glow` / `outline` variants; added `padding` prop (none/sm/md/lg/xl)

**Layout primitives:**
- `src/components/ui/section.tsx` — `Section` (semantic, spacing variants), `Container` (size variants sm–2xl), `Grid`
- `src/components/ui/section-header.tsx` — `SectionHeader` (eyebrow+H2+BodyLg), `CardHeaderText`

**Brand components** — `src/components/brand/`:
- `service-card.tsx` — ServiceCard (glass/glow, icon, tags, arrow on hover)
- `industry-card.tsx` — IndustryCard (icon, stat/statLabel, accentColor)
- `stats-card.tsx` — StatsCard (default/compact/hero variants, live dot, change indicators)
- `testimonial-card.tsx` — TestimonialCard (rating stars, avatar initials fallback, featured variant)
- `process-card.tsx` — ProcessCard (default/timeline variants, step connectors)
- `cta-banner.tsx` — CTABanner (default/gradient/split variants)
- `index.ts` — barrel export

**New CSS tokens in `src/index.css`:**
- Surface hierarchy: `--surface-0/1/2/3`
- Glow: `--glow-primary`, `--glow-primary-md/lg`, `--shadow-glow-sm/md/lg`
- Status: `--success/warning/info` + foreground + border
- Section spacing: `--section-y` variants
- Container widths: `--container-sm` through `--container-2xl`
- Radius: `--radius-card/button/badge/pill`

**SEO fix** — `artifacts/thinkatic/index.html`: real description, og:image, og:url, canonical, Twitter image, removed unused Inter font load.

## What remains (see UPGRADE_ROADMAP.md)

- Phase 2: Delete duplicate Navbar/Footer/sections components
- Phase 3: Replace hardcoded hex colors with CSS variables
- Phase 4: Accessibility pass (aria-labels, form associations)
- Phase 5: Per-route SEO with react-helmet-async
- Phase 6: Break up monolith components (AdminDashboardPage 1321 lines, Hero 674 lines)
- Phase 7: Enforce typography components site-wide
- Phase 8: Performance (lazy Three.js, Suspense boundaries, bundle audit)

**Why:** The existing codebase had no shared abstractions — every section reinvented glass cards, buttons, and section headers. This system gives a single source of truth so future page work is consistent and fast.
