# Zelevos Travel Platform

Zelevos is an India-first curated travel marketplace operating with manual supplier operations, centralized booking engine, vendor portal, and partner network.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/zelevos run dev` — run the Zelevos web app (port 19313)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (optional: defaults to embedded PGlite for local testing)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL / embedded PGlite + Drizzle ORM
- Validation: Zod
- Build: esbuild (CJS/ESM bundle), Vite (Frontend)

## Where things live

- `artifacts/zelevos/src/App.tsx` — Zelevos homepage and interactive product surfaces
- `artifacts/zelevos/src/index.css` — Zelevos design system and responsive layout
- `artifacts/api-server` — shared Express API service
- `lib/db/src/schema` — Drizzle database schema
- `artifacts/api-server/src/services` — internal booking engine, vendor metrics, confidence score, and payment services
- `artifacts/api-server/src/routes` — admin, customer, vendor, partner, finance, operations REST routes

## Architecture decisions

- API-free V1 marketplace architecture with zero external travel API dependencies.
- Dual database support: Embedded PGlite for self-contained testing; external PostgreSQL when `DATABASE_URL` is set.
- Authentication uses server-side email/password accounts with scrypt password hashes, PostgreSQL-backed sessions, and an HTTP-only `zelevos_session` cookie. TOTP 2FA is required for admin and finance users.
- Sensitive documents (vouchers, invoices) are served via HMAC-SHA256 signed URLs with 15-minute expiration, never public static URLs.
- Admin-configurable SLAs dynamically compute task deadlines.
