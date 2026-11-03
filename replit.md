# Thinkatic — AI Agency Website

A full-stack web app for Thinkatic, an AI-native digital agency. It includes a marketing/landing site, an enterprise pricing page backed by Supabase, and a contact/lead management flow.

## Stack

- **Frontend** (`artifacts/thinkatic`): React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Three.js / GSAP / Framer Motion + Supabase JS Client
- **API server** (`artifacts/api-server`): Express 5 + Supabase
- **Shared libs** (`lib/`): `db` (Supabase client & repositories), `api-zod` (generated Zod types), `api-client-react` (generated React Query hooks), `api-spec` (Orval config)
- **Package manager**: pnpm workspaces

## Initial setup (on first import)

```bash
# Install all workspace dependencies
pnpm install
```

## Running locally

| Service | Workflow | Port |
|---|---|---|
| Frontend | `artifacts/thinkatic: web` | 23363 (mapped to :80) |
| API server | `artifacts/api-server: API Server` | 8080 |

Both workflows start automatically. The frontend proxies `/api/*` requests to the API server.

## Environment variables / secrets

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon client key |
| `SUPABASE_SECRET_KEY` | Supabase service role secret key (backend server only) |
| `PAYPAL_CLIENT_ID` | PayPal SDK client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal SDK client secret |
| `SESSION_SECRET` | Express session signing secret |

## Database schema & Migrations

Managed in Supabase. Migration file is located at `supabase/migrations/20260904000000_create_schema.sql` and mirrored in `lib/db/supabase-schema.sql`.
To apply to Supabase, run the SQL script in your Supabase Dashboard SQL Editor or via Supabase CLI.
