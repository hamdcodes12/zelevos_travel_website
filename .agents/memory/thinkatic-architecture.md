---
name: Thinkatic Site Architecture
description: Key facts about the Thinkatic monorepo structure, ports, and design system
---

# Thinkatic Architecture

## Stack
- pnpm workspace monorepo (`pnpm-workspace.yaml`)
- Frontend: `artifacts/thinkatic` — React 19 + Vite + Tailwind v4 + Framer Motion + GSAP + Lenis + Three.js
- API: `artifacts/api-server` — Express 5 + Drizzle ORM + PostgreSQL
- Shared libs: `lib/db`, `lib/api-zod`, `lib/api-client-react`, `lib/api-spec`

## Ports
- Frontend: port 23363 (mapped to :80 externally)
- API: port 8080

## Motion Setup
- Lenis smooth scroll initialized in `hooks/useLenis.ts`, called inside `Layout.tsx`
- GSAP ScrollTrigger registered in `lib/gsap.ts`, synced with Lenis via `lenis.on('scroll', ScrollTrigger.update)` and `gsap.ticker.add((time) => lenis.raf(time * 1000))`
- Framer Motion used for component-level animations (whileInView, variants)

## Design Tokens
- Background: near-black (#050505 / 0 0% 2%)
- Primary: Electric Blue #47A3FF / #2563EB (hsl 217 100% 63%)
- Font: Satoshi (from fontshare CDN)
- Noise texture on body via SVG filter in CSS

## Brand (from PDF Spec)
- Thinkatic = AI-Powered BPO & Technology Solutions company
- 70% BPO / 30% IT positioning
- Colors: Deep Navy #081B3A, Electric Blue #2563EB, White, Cyan accent
- Homepage flow: Hero → BPO Services → Industries → AI-Powered BPO → Why Thinkatic → IT Services → Case Studies → About → Careers → Contact
