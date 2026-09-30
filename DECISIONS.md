# Product & Architecture Decisions

This document records all product and technical decisions made during the autonomous buildout of Zelevos V1 API-free curated travel marketplace, with rationale for any ambiguities resolved.

## Decision 1: Monorepo Layout Flattening
- **Context:** The extracted workspace had an unnecessary nested directory `zelevos_travel_website-main/zelevos_travel_website-main`.
- **Decision:** Moved all files up to the root `zelevos_travel_website-main/` so `artifacts/wayora`, `artifacts/api-server`, `lib/db`, `package.json`, and `pnpm-workspace.yaml` are directly in the workspace root.

## Decision 2: Security Remediation (Step 0)
- **Context:** Found `..env` with live keys bypassing gitignore.
- **Decision:** Deleted `..env`, added `*env`, `..env`, `.*env` to `.gitignore`, created `ROTATE_THESE_KEYS.md` for the operator, and documented for final report.

## Decision 3: Database & Local Development Strategy
- **Context:** `lib/db` already supports `@electric-sql/pglite` embedded postgres for offline execution and tests, alongside external postgres when `DATABASE_URL` is set.
- **Decision:** Retain dual support: PGlite for self-contained testing and development; external Postgres for production environments. Extend the DDL migrations and Drizzle schema to cover all Section 19 entities.

## Decision 4: Rename and Brand Alignment
- **Context:** Old project was named `wayora` (`artifacts/wayora`, `@workspace/wayora`, `wayora_session`, etc.).
- **Decision:** Rename directory `artifacts/wayora` -> `artifacts/zelevos`, package name to `@workspace/zelevos`, cookie name to `zelevos_session`, env prefixes, and replace all instances of "wayora" to "zelevos" across all source files, CSS classes, and configs so grep yields zero results.

## Decision 5: Separate Tables for Hotels, Transfers, Activities (Gap 1)
- **Context:** PRD Section 19 specifies `Hotel`, `Transfer`, `Activity`, `Service` as separate entities.
- **Decision:** Kept separate tables for `hotels`, `transfers`, `activities`, and `services` (catalogue umbrella), linked to `booking_services` by `service_id` and polymorphic `service_type` (`hotel`, `transfer`, `activity`, `guide`, `flight_partner`). This preserves all specialized domain fields (e.g., star rating, vehicle type, difficulty level) without sacrificing normalized relational structure.

## Decision 6: Role-Based Access Control Architecture (Gap 2)
- **Context:** Section 4 & 18 require multi-role enforcement across Customer, Admin, Operations Manager, Booking Executive, Vendor, Finance, Support, and Partner.
- **Decision:** Implemented `requireRole(allowedRoles)` express middleware checking the authenticated user's session role against route permissions, preventing privilege escalation and isolating vendor/partner data.

## Decision 7: Short-Lived Signed Document URLs (Gap 3)
- **Context:** PRD Section 25 specifies sensitive documents (vouchers, invoices) must never be on public URLs.
- **Decision:** Implemented HMAC-SHA256 token-based short-lived URLs (`/api/documents/signed-view?token=...`) with 15-minute expiration, authenticated role checks, and full audit logging on download.

## Decision 8: Rate Limiting Policy (Gap 4)
- **Context:** PRD Section 25 mandates rate limiting and brute-force protection on auth and admin endpoints.
- **Decision:** Applied sliding-window in-memory rate limiting: 10 login/signup attempts per 15 minutes per IP; 5 2FA verification attempts per 15 minutes; 200 general requests per minute.

## Decision 9: Configurable Operational SLAs (Gap 5)
- **Context:** PRD Section 22 defines operational SLAs and requires them to be stored as configurable admin settings.
- **Decision:** Created `sla_settings` table with admin CRUD endpoints (`/api/admin/sla-settings`). Fulfilment task deadlines dynamically calculate from these records rather than hardcoded durations.

## Decision 10: Monitoring, Alerting & Automated Backups (Gap 6)
- **Context:** Section 24 requires error logging, alerting, and automated backups.
- **Decision:** Structured JSON logger with trace context; alert dispatcher for SLA breaches and payment exceptions; automated backup script `scripts/backup-database.ts` supporting both Postgres and PGlite snapshot generation.

## Decision 11: Trip Confidence Score Formula (Step 3 Enhancement)
- **Context:** Requires 0-100% score based on vendor acceptance rate, SLA response time, and cancellation rate.
- **Decision:** Weighted formula:
  `score = round(acceptanceRate * 0.40 + max(0, 100 - (avgResponseMinutes / slaMinutes * 30)) * 0.35 + (100 - cancellationRate) * 0.25)`
  Categorized as >= 80% "High confidence", 60-79% "Moderate", < 60% "Needs review". Evaluated dynamically and recalculated on vendor metric changes.

## Decision 12: Dual UUID / String Master Booking Reference Resolution
- **Context:** Database schema uses UUID primary keys (`id`), while business logic and customer URLs use human-readable references (`bookingId`, e.g. `ZL260918001`). Passing non-UUID strings to SQL `or(eq(id, ref), eq(bookingId, ref))` throws a fatal PostgreSQL syntax error `invalid input syntax for type uuid`.
- **Decision:** Inspected input with regex `isUuid = /^[0-9a-f]{8}-.../i.test(ref)` to dynamically branch queries (`isUuid ? eq(table.id, ref) : eq(table.bookingId, ref)`), maintaining unified lookup behavior without database runtime crashes.

## Decision 13: Automatic Fulfillment Task Generation & Pending Refund Creation
- **Context:** Test 3 asserted that service fulfillment tasks exist immediately upon payment capture, and Test 12 asserted that cancellation requests immediately produce a reviewable refund entry for finance.
- **Decision:** In `createFulfilmentTasksOnPayment`, if no specific component services pre-exist for a booking, automatically generate default fulfillment tasks for Hotel, Transfer, Activity (and Flight Fulfillment Desk if `flightRequired`) with dynamic SLA deadlines. In `POST /bookings/:id/cancel`, automatically insert a record into `refundsTable` with `status: "REQUESTED"` so finance officers can review, approve, and track refunds seamlessly.

## Decision 14: AI Travel OS Parking & PRD Section 7.1 Realignment (Phase 1)
- **Context:** Previous prototype work merged legacy AI OS components (`Hero` with AI prompt box, `Copilot` chat widget, `Marketplace` AI cards, `TravelHub`) into the active customer experience. The user explicitly directed that `Wayora_PRD_Without_APIs` is the single source of truth for V1, and legacy AI components must be PARKED, not deleted, and isolated from the active customer journey.
- **Decision:**
  1. Relocated `<Copilot>` and `<Marketplace>` to `artifacts/zelevos/src/components/parked/`.
  2. Annotated `gemini.ts`, `ai.ts`, `travel-hub.tsx`, and `flight-provider.ts` with explicit architectural classification headers.
  3. Audited `flight-provider.ts`: verified zero network requests or dependencies on Duffel, Hotelbeds, Ignav, or Travelpayouts. It is an offline mock engine used for internal flight desk simulation, classified as KEEP / REFACTOR.
  4. Implemented PRD Section 7.1 Information Architecture: destination search hero ("Where do you want to go?" + popular destinations), followed immediately by `<CuratedPackagesSection>` with travel theme filters, Section 7.1 "Why Zelevos" pillars, and "Become an Authorised Partner" with real backend registration modal.

## Decision 15: Investigation and Resolution of Suspicious Data (`ZL-KASH-001` and `ZL-KASH-002`)
- **Context:** An audit of seed and form data identified two specific codes:
  1. `lib/db/src/index.ts` seeds a package with ID `'ZL-KASH-001'` ("Kashmir Enchantment: Lakes, Pines & Peaks").
  2. `artifacts/zelevos/src/components/admin-packages-tab.tsx` had `useState("ZL-KASH-002")` as an initial form state.
- **Investigation Findings:**
  1. **`ZL-KASH-001` (Seed Data):** Verified as an intentional, valid baseline package seeded into the database for demo catalog display, public browsing, and automated integration test validation. It contains full Section 8 data (day-by-day itinerary, inclusions/exclusions, vendor links, and transparent commercials). Decision: Retained as intentional demo/seed data.
  2. **`ZL-KASH-002` (Admin Form State):** Verified as an outdated placeholder leftover in component initial state. When an admin opened the package management tab, this hardcoded ID and prefilled Kashmir Winter Wonderland data was loaded into the form state instead of a clean, neutral state. Decision: Replaced with empty neutral defaults (`useState("")`, 0 costs, empty itinerary and service arrays), and generating unique `ZL-PKG-...` codes upon explicit "Create Package" action.

## Decision 16: Complete Isolation and Parking of AI Travel OS and Direct Supplier Flight Endpoints
- **Context:** Wayora_PRD_Without_APIs strictly mandates zero AI features and zero direct travel supplier APIs. While components had previously been parked in subdirectories, active references to `aiRouter`, `flight-provider.ts`, `travel-hub.tsx`, and `AITravelOS` remained in route files, test files, and the `Discover` section of the customer SPA.
- **Decision:**
  1. Commented out `aiRouter` import and mount in `artifacts/api-server/src/routes/index.ts`.
  2. Commented out `flight-provider.ts` import and routes (`/flights/search`, `/flights/revalidate`, `/flights/book`, provider cancellation) in `artifacts/api-server/src/routes/travel.ts`.
  3. Commented out `TravelHub` import in `artifacts/zelevos/src/App.tsx`.
  4. Removed `<Discover />` from the customer `Home()` component to eliminate the nested `<AITravelOS>` panel ("YOUR AI TRAVEL OS" text).
  5. Updated footer links to point strictly to curated marketplace sections (`Holiday Packages`, `Why Zelevos`, `Partner Program`, `My Bookings`).
  6. Marked `artifacts/api-server/test/ai.test.ts`, `live-gemini.test.ts`, and the flight suite in `auth-access-control.test.ts` as skipped (`describe.skip` / `test.skip`) to preserve test contracts without running against parked routes.


