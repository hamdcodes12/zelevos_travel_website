# Permanent Project Memory & Knowledge Base (MEMORY.md) — Zelevos V1

**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Last Updated:** 2026-09-19T10:45:00+05:30  
**Current Phase:** Phase 1 (Foundation / Direction Correction) COMPLETED $\rightarrow$ Ready for Phase 2 (Inventory)  

---

## 1. Permanent Project Rules (MANDATORY & UNBREAKABLE)

### Rule 1: Single Source of Truth
> **"Do not implement features from Wayora_AI_Travel_OS_PRD in the current V1 unless the user explicitly requests a future AI phase."**
> Wayora_PRD_Without_APIs is the sole authoritative source of truth for the active V1 product.

### Rule 2: Zero-Dummy Rule
Every button, link, form, modal, and user-facing interactive control must execute a real backend-backed API call resulting in a validated state transition or database mutation. Never use toast-only placeholders, fake timers, or dead buttons.

### Rule 3: Zero Direct External Travel APIs
No live integrations with Duffel, Hotelbeds, Ignav, Travelpayouts, Amadeus, Sabre, or other travel supplier APIs. Zelevos operates entirely on curated inventory, contracted wholesale DMCs, and internal manual operations fulfillment.

### Rule 4: Park, Don't Delete AI Components
Legacy AI Travel OS prototype modules (`<Copilot>`, `<Marketplace>`, `<TravelHub>`, `gemini.ts`, `ai.ts`) are **PARKED** and isolated in `artifacts/zelevos/src/components/parked/` and annotated with architectural headers. They must never be part of the active V1 customer journey, booking, payment, operations, vendor, or My Trips flows.

### Rule 5: Truthful Verification Standard
Never assume test counts or fabricate completion claims. Run actual test commands and report exact PASS / FAIL / SKIPPED counts. If a feature or flow has not been verified in the live browser or test suite, mark it explicitly as **NOT VERIFIED** or **PENDING**.

---

## 2. Current Project State & Completed Work

### Overall Status
- **Current Phase:** Phase 2 — Inventory (**COMPLETED & VERIFIED**).
- **Next Phase:** Phase 3 — Booking (**READY FOR IMPLEMENTATION**).
- **Typecheck Status:** **0 errors** across all 5 workspace projects (`pnpm run typecheck`).
- **Production Build Status:** **0 errors** (Vite frontend in `artifacts/zelevos/dist/public` and ESBuild server in `artifacts/api-server/dist/index.mjs`).
- **Backend Test Suite:** **113 PASSED**, **0 FAILED**, **1 SKIPPED** (`live-gemini.test.ts`).
  - Added dedicated Phase 2 suite `artifacts/api-server/test/inventory-phase2.test.ts` with 14 comprehensive tests covering package CRUD, component persistence, status transitions, search/filters, RBAC, and audit logging.
- **Real Browser Verification:** Live browser verification completed (`phase2_package_lifecycle_1789800004007.webp`), fresh screenshots recorded:
  - `admin_draft_package_1789800634529.png` (Draft package creation)
  - `admin_package_preview_draft_1789800983280.png` (Admin preview mode)
  - `admin_package_published_active_1789801391107.png` (Publication to Active)
  - `customer_homepage_new_package_1789801661315.png` (Customer discovery card ₹50,000)
  - `customer_package_detail_modal_1789801819660.png` (Customer package details)
  - `admin_package_paused_1789802161585.png` (Pause sales transition)
  - `admin_package_archived_1789802400243.png` (Archive transition)
  - `customer_homepage_package_removed_1789802752101.png` (Instant removal from public view)

---

## 3. Architecture & Monorepo Structure

```
zelevos_travel_website-main/
├── artifacts/
│   ├── api-server/              # Express 5 REST API backend
│   │   ├── src/
│   │   │   ├── routes/          # REST endpoints (auth, bookings, operations, vendor, finance, etc.)
│   │   │   ├── services/        # Engines (booking-engine, email-service, totp-service, etc.)
│   │   │   └── middlewares/     # Security guards (authMiddleware, rbac, rate-limiter)
│   │   └── test/                # 24 test suites / 100 tests (E2E, security, unit)
│   └── zelevos/                 # React 19 + Vite Customer & Backoffice SPA
│       ├── src/
│       │   ├── components/      # UI components (curated packages, partner modal, etc.)
│       │   ├── components/parked/# ISOLATED LEGACY AI CODE (Copilot, Marketplace)
│       │   └── pages/           # Customer and administrative portal views
│       └── dist/public/         # Production static assets served by api-server
├── lib/
│   ├── db/                      # Relational schema (22+ entities) via Drizzle ORM
│   ├── api-zod/                 # Shared runtime Zod validation schemas
│   └── api-client-react/        # React Query API client bindings
├── scripts/                     # Operational utilities (backup-database.ts)
└── [Master Documentation]       # PRD.md, TRD.md, APP_FLOW.md, UI_UX_DESIGN_BRIEF.md, BACKEND_SCHEMA.md, PHASES.md, MEMORY.md
```

---

## 4. Scope Boundaries & Non-Goals for V1

- ❌ **No Direct Travel Supplier APIs:** Zero Duffel/Hotelbeds/Ignav/Travelpayouts integrations.
- ❌ **No Global Real-Time Inventory:** Only contracted packages and vetted suppliers.
- ❌ **No Instant Airline Issuance:** All flights are handled via the offline flight fulfillment desk.
- ❌ **No Open Vendor Self-Publishing:** Administrators curate and publish all catalog items.
- ❌ **No AI Booking Agents:** AI does not make commitments or touch financial ledgers.

---

## 5. Summary of Key Architectural Decisions

- **Decision 1 (Monorepo Layout):** Workspace directory flattened up to root (`zelevos_travel_website-main/`).
- **Decision 2 (Security Remediation):** Deleted leaked `..env` file, added `*env` to `.gitignore`, created `ROTATE_THESE_KEYS.md`.
- **Decision 3 (Dual Database Strategy):** Maintained dual support for embedded PGlite (local/tests) and external PostgreSQL (production).
- **Decision 4 (Brand Realignment):** Replaced legacy `wayora` references with `zelevos` across directories, packages, and cookies.
- **Decision 5 (Normalized Schema Entities):** Created separate tables for `hotels`, `transfers`, `activities`, and catalog `services`.
- **Decision 6 (RBAC Enforcement):** Built `requireRole(allowedRoles)` express middleware supporting 8 discrete roles.
- **Decision 7 (Signed Document Security):** Implemented HMAC-SHA256 15-minute expiring signed view URLs (`/api/documents/signed-view`).
- **Decision 8 (Rate Limiting):** Sliding-window in-memory rate limiter on auth (10/15m), 2FA (5/15m), and general API (200/m).
- **Decision 9 (Configurable SLAs):** Stored operational SLAs in `sla_settingsTable` with admin CRUD endpoints.
- **Decision 10 (Backups & Logging):** Structured Pino JSON logger with trace IDs and `scripts/backup-database.ts`.
- **Decision 11 (Trip Confidence Score):** Weighted quality formula ($40\%$ acceptance, $35\%$ response speed vs SLA, $25\%$ completion).
- **Decision 12 (Dual UUID/String Query Resolution):** Regex inspection `isUuid` preventing PostgreSQL fatal syntax errors when resolving Master Booking IDs (`ZL...`).
- **Decision 13 (Fulfillment Auto-Seeding & Refunds):** `createFulfilmentTasksOnPayment` auto-decomposes child tasks; booking cancellation auto-logs pending refunds.
- **Decision 14 (AI Travel OS Parking & PRD 7.1 Alignment):** Parked legacy AI modules in `src/components/parked/`; audited `flight-provider.ts` as 100% offline internal simulator (KEEP / REFACTOR); aligned homepage strictly with PRD 7.1.
- **Decision 15 (Phase 2 Inventory & Lifecycle Architecture):** Implemented strict 4-state package lifecycle (`DRAFT` $\rightarrow$ `ACTIVE` $\leftrightarrow$ `PAUSED` $\rightarrow$ `ARCHIVED`) preventing invalid status regressions; normalized component persistence (`hotelsTable`, `transfersTable`, `activitiesTable`); dynamic Trip Confidence calculation on all package details; admin preview isolation using `?preview=true` gate; and real-time reflection of catalog mutations on customer frontpage.

---

## 6. Parked AI Features Inventory

The following items are officially classified as **PARKED / FUTURE**:
- `artifacts/zelevos/src/components/parked/copilot.tsx`: Legacy "Ask Zelevos" conversational AI chat widget.
- `artifacts/zelevos/src/components/parked/marketplace.tsx`: Legacy AI prompt card marketplace.
- `artifacts/zelevos/src/components/travel-hub.tsx`: Legacy prototype hub.
- `artifacts/api-server/src/services/gemini.ts`: Internal Gemini client wrapper.
- `artifacts/api-server/src/routes/ai.ts`: Internal AI experimental routes.
- `lib/db/src/schema/generated-trips.ts`: AI speculative trip database entity.

---

## 7. Security Posture & Secrets Management

- **Credential Rotation Notice:** Leaked keys from `..env` are cataloged in `ROTATE_THESE_KEYS.md` for external operator rotation.
- **Two-Factor Authentication (2FA):** Mandatory TOTP-based two-factor authentication for Admin and Finance accounts.
- **Document Security:** Vouchers, driver slips, and invoices are never served on public URLs.
- **Payment Signature Verification:** Server-side HMAC-SHA256 verification of all Razorpay payment payloads.

---

## 8. Verification & Test Commands

To verify the codebase at any time, execute the following standard commands:

```powershell
# 1. Full Monorepo Typecheck (must pass with 0 errors across all 5 projects)
$env:CI="true"; pnpm run typecheck

# 2. Production Monorepo Build (must cleanly bundle client and server)
pnpm run build

# 3. Backend Test Suite (must report 99 passed, 0 failed, 1 skipped)
pnpm --filter @workspace/api-server test

# 4. End-to-End Test Suite Execution
pnpm --filter @workspace/api-server exec tsx --test test/zelevos-v1-e2e.test.ts

# 5. Static Asset Verification Test
pnpm --filter @workspace/api-server exec tsx --test test/static-assets.test.ts
```

---

## 9. Remaining V1 Work & Next Phase

- **Completed:** Phase 1 — Foundation / Direction Correction.
- **Next Phase:** **PHASE 2 — INVENTORY**.
- **Phase 2 Scope:** Admin package creation, day-by-day itinerary management, destination catalog CRUD, wholesale net pricing, and markup configuration.
- **Hold Gate:** Execution must **STOP** here. Do NOT proceed to Phase 2 automatically without explicit user authorization.
