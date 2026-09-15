# Wayora Travel OS

Wayora is an India-first AI travel operating system that turns a travel idea into a planned, monitored, and adaptable trip.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/wayora run dev` — run the Wayora web app (port 19313)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/wayora/src/App.tsx` — Wayora homepage and interactive product surfaces
- `artifacts/wayora/src/index.css` — Wayora blue/white design system and responsive layout
- `artifacts/api-server` — shared Express API service
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema` — Drizzle database schema
- `artifacts/api-server/src/services/providers.ts` — replaceable flight, hotel, activity, transport and payment adapters
- `artifacts/api-server/src/routes/profile.ts` — persisted traveller memory and preference APIs
- `artifacts/api-server/src/routes/operations.ts` — trip-aware concierge, monitoring and approval-gated replanning APIs

## Architecture decisions

- Gemini is called only by the Express API through `GEMINI_API_KEY`; the React/Vite client calls `/api/ai/chat` and never receives the key.
- The default Gemini model is `gemini-3.1-flash-lite` for reliable low-latency planner and copilot responses; `GEMINI_MODEL` can override it server-side.
- `/api/ai/health` performs a minimal live Gemini request and returns connection status, provider, and model without exposing credentials.
- The concierge uses `/api/concierge` and server-built trip context when the user is authenticated; Gemini credentials never reach the browser.
- Travel inventory and payments are provider-adapter based. Without client credentials, responses are explicitly `DEMO` / `NOT_CONFIGURED`; demo selections create records but do not claim supplier reservations or charge money.
- Monitoring is currently a demo event simulator. Replanning returns a proposal first and only mutates the saved itinerary after explicit approval.

## Product

The web experience includes AI trip planning, destination discovery, Trip OS itinerary views, saved generated trips, budget and price intelligence, travel safety, marketplace experiences, Wayora Wallet, traveller memory, monitoring/replanning simulation, notification center, emergency assistance, business operations summary, and an AI copilot. Users can sign up, log in, log out, and manage private saved trips from the My Trips section.
- Authentication uses server-side email/password accounts with scrypt password hashes, PostgreSQL-backed sessions, and an HTTP-only `wayora_session` cookie. Trip ownership is derived from the authenticated session; the client-controlled `X-Wayora-Owner-Id` header is no longer used.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Vite builds require `PORT` and `BASE_PATH`; the managed Wayora workflow supplies them automatically.
- If dependencies are missing after import, use `pnpm install --frozen-lockfile` from the workspace root before running package scripts.
- Gemini requires the shared `GEMINI_API_KEY` secret; the API service must be restarted after changing secrets.
- Account-backed trips require the `SESSION_SECRET` secret and the `users` / `sessions` tables. Run `pnpm --filter @workspace/db run push` after schema changes in development.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
