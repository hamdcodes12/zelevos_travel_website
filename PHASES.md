# V1 Execution Plan & Roadmap (PHASES.md) — Wayora / Zelevos V1

**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Status:** ACTIVE / AUTHORITATIVE FOR CURRENT V1  
**Source of Truth:** `Wayora_PRD_Without_APIs`  
**Execution Rule:** Strictly linear execution. Do not proceed to subsequent phases without explicit user approval and full verification gates.

---

## Roadmap Status Matrix

| Phase | Description | Status | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation / Direction Correction | **COMPLETED** | Monorepo typecheck clean (0 errors), automated tests passing, fresh browser screenshot evidence verified. |
| **Phase 2** | Inventory & Package Management | **COMPLETED** | Admin package CRUD, day-by-day itineraries, supplier net pricing, destination catalogs, search & filters, dynamic confidence scoring, real browser verification of ZL-RAJ-002 lifecycle. |
| **Phase 3** | Booking & Payment Flow | **COMPLETED** | Checkout flow, room configs, flight-without-API checkbox, Razorpay payment, `ZL{YYMMDD}{seq}` generation, 89% Trip Confidence transparency for ZL-RAJ-002. |
| **Phase 4** | Operations & Fulfilment Engine | **COMPLETED** | Operations dashboard KPI widgets, task queue, vendor portal, voucher verification gate, manual flight PNR desk modal. |
| **Phase 5** | Customer Experience & My Trips | **COMPLETED** | Section 11 live timeline, printable digital itinerary, cancellation & refund request flow, support ticket concierge, real browser confirmation `phase5_cancellation_confirmed_png_1789922660792.png`. |
| **Phase 6** | Authorised Partner Network | **COMPLETED** | Partner agency registration (Starlight Voyages India), unique referral codes, booking attribution, real-time commission ledger, browser screenshot `phase6_partner_ledger_1789924284754.png`. |
| **Phase 7** | Finance, Analytics & Security Hardening | **COMPLETED** | Real-time collections, net vendor costs, gross margin reporting, refund authorization queue, HMAC document tokens, browser screenshot `phase7_finance_dashboard_1789924417678.png`. |
| **Phase 8+** | Future AI Travel OS | **PARKED / FUTURE** | Do NOT execute in V1. Speculative conversational AI and autonomous planning. |

---

## PHASE 1 — FOUNDATION / DIRECTION CORRECTION — COMPLETED

### Objective
Realign the project from speculative "AI Travel OS" prototype drift back to the authoritative **API-free curated travel marketplace** specification defined in `Wayora_PRD_Without_APIs`. Park legacy AI features, establish clean monorepo typechecking, and verify the PRD Section 7.1 customer storefront.

### Features Delivered
- **PRD Section 7.1 Homepage Experience:** Destination search hero ("Where do you want to go?"), popular destination pills (`Kashmir`, `Ladakh`, `Kerala`, `Rajasthan`, `Goa`, `Himachal`), and Featured Curated Tours promoted to primary content.
- **Travel Themes Filter Bar:** Integrated themes pills (`Honeymoon`, `Family`, `Adventure`, `Luxury`, `Budget`, `Weekend`, `Pilgrimage`).
- **"Why Zelevos" Value Grid:** Displayed 4 core pillars (*One Booking*, *100% Curated*, *Dedicated 24/7 Ops*, *Transparent Inclusions*).
- **Authorised Partner CTA:** Public banner and live registration modal connecting to `POST /api/partners/register`.
- **AI Component Parking:** Relocated `<Copilot>` and `<Marketplace>` to `src/components/parked/`. Annotated `gemini.ts`, `ai.ts`, `travel-hub.tsx`, and `flight-provider.ts` with architectural classification headers.
- **Flight Provider Audit:** Confirmed zero external travel API dependencies in `flight-provider.ts`; verified as an internal offline mock engine supporting the manual flight desk (KEEP / REFACTOR).
- **Typecheck & Monorepo Fixes:** Configured `.npmrc` with `shamefully-hoist=true` to resolve `@types/express` transitive dependencies. Fixed `static-assets.test.ts` typing.

### Verification & Acceptance Criteria
- [x] `pnpm run typecheck`: **0 errors** across all 5 workspace projects.
- [x] `pnpm run build`: **0 errors** (Vite frontend and ESBuild backend bundles clean).
- [x] Backend test suite: **99 passed**, **0 failed**, **1 skipped** (`live-gemini.test.ts`).
- [x] Real browser verification: Fresh homepage screenshot (`homepage_hero_1789753650005.png`) confirming NO AI hero, NO AI prompt box, NO floating copilot, functional search, working themes, and zero fake buttons.

---

---

## PHASE 2 — INVENTORY (COMPLETED & VERIFIED)

### Objective
Build and harden the complete package, destination, and catalog management subsystem enabling administrators to manage multi-day holiday packages, pricing architectures, day-wise itineraries, and accommodation tiers with zero third-party API dependencies.

### Features Delivered
- **Admin Package Management UI (`AdminPackagesTab`):** Full CRUD interface supporting status filtering (`All`, `Active`, `Draft`, `Paused`, `Archived`), interactive multi-day itinerary builder, component services editor (Hotels, Transfers, Activities), commercial pricing & markup configuration, policies editor, and media manager.
- **Package Status Lifecycle State Machine:** Explicit transitions: `DRAFT` $\rightarrow$ `ACTIVE` $\leftrightarrow$ `PAUSED` $\rightarrow$ `ARCHIVED`. Strict validation preventing archived packages from returning to active.
- **Zero-Dummy Backoffice Actions:** Dedicated real endpoints:
  - `GET /api/admin/packages` (All packages with component & day counts)
  - `POST /api/admin/packages` (Full Section 8 & Gap 1 persistence)
  - `PUT /api/admin/packages/:id` (Full update of package, days, hotels, transfers, activities)
  - `PATCH /api/admin/packages/:id/status` (Lifecycle transitions)
  - `DELETE /api/admin/packages/:id` (Soft-archive)
- **Component Service Persistence:** Dedicated relational storage and CRUD for `hotelsTable`, `transfersTable`, and `activitiesTable` tied to packages.
- **Admin Preview Mode:** `<PackageDetailModal isPreview={true}>` allowing administrators to preview un-published draft and paused packages with a clear warning banner.
- **Customer Catalog & Discovery:** Dynamic public filter by destination, travel theme, budget range, and duration. Packages display dynamic Trip Confidence Scores computed from contracted supplier SLAs and reliability metrics.
- **Destination Catalog & Admin Controls:** `GET /api/destinations`, `GET /api/destinations/:slug`, `GET /api/admin/destinations`, `POST /api/admin/destinations`, `PUT /api/admin/destinations/:id`, and `DELETE /api/admin/destinations/:id`.
- **Immutable Audit Logging:** All package creations, updates, status transitions, and archiving recorded to `audit_logsTable`.

### Verification & Acceptance Criteria
- [x] `pnpm run typecheck`: **0 errors** across all 5 monorepo projects.
- [x] `pnpm run build`: **0 errors** (Clean production build for both backend ESBuild bundle and frontend Vite SPA).
- [x] Backend automated test suite: **113 passed**, **0 failed**, **1 skipped** (`live-gemini.test.ts`).
  - Added dedicated integration suite `test/inventory-phase2.test.ts` with 14 comprehensive tests covering package CRUD, component persistence, status transitions, search/filter queries, RBAC enforcement, input validation, and audit logging.
- [x] Real browser verification (Recordings & Screenshots):
  - `admin_draft_package_1789800634529.png`: Package created in `DRAFT` mode (`ZL-KASH-009`).
  - `admin_package_preview_draft_1789800983280.png`: Preview modal with "ADMIN PREVIEW MODE — Current Package Status: DRAFT", Trip Confidence Score, days, components, and policies.
  - `admin_package_published_active_1789801391107.png`: Transition to `ACTIVE` status via Publish action.
  - `customer_homepage_new_package_1789801661315.png`: Package live on customer homepage with price ₹50,000, duration 6D/5N, and Trip Confidence Score.
  - `customer_package_detail_modal_1789801819660.png`: Customer modal displaying full day-by-day itinerary, accommodations, transfers, activities, and policies.
  - `admin_package_paused_1789802161585.png`: Transition from `ACTIVE` to `PAUSED`.
  - `admin_package_archived_1789802400243.png`: Transition from `PAUSED` to `ARCHIVED`.
  - `customer_homepage_package_removed_1789802752101.png`: Confirmed immediate removal from public customer catalog upon pause/archive.
  - Video Recording: `phase2_package_lifecycle_1789800004007.webp`.

---

## PHASE 3 — BOOKING

### Objective
Deliver a bulletproof, high-conversion customer booking and checkout pipeline that captures travel configurations, validates party sizes, processes online payments via Razorpay, mints standardized Master Booking IDs (`ZL{YYMMDD}{seq}`), and auto-seeds child fulfillment tasks.

### Features & Scope
- **Interactive Checkout Interface:** Step-by-step modal/page capturing travel dates, traveler details, and room configurations.
- **Flight-Without-API Assistance Checkbox:** Explicit option: `[x] Flight Required (Subject to confirmation)` with origin airport and baggage details.
- **Live Price Calculation:** Dynamic real-time calculation of party size multipliers, add-ons, and taxes.
- **Razorpay Payment Integration:** Order generation, modal checkout, and server-side HMAC-SHA256 signature verification.
- **Master Booking ID Generator:** Sequential daily format `ZL{YYMMDD}{seq}` (e.g. `ZL2609190001`).
- **Automatic Fulfillment Decomposition:** Auto-generates child tasks in `booking_services` upon payment capture.

### Technical Deliverables
- **Pages & UI:** `<PackageCheckoutModal>`, `/checkout/:packageId`, Booking Confirmation View.
- **Backend Endpoints:**
  - `POST /api/bookings` (Order creation)
  - `POST /api/bookings/:id/pay` (Signature verification & task auto-generation)
- **Database Tables:** `bookings`, `booking_services`, `travellers`, `payments`.
- **Tests:** Razorpay signature tamper tests, sequence generation concurrency tests, and automatic child task creation assertions.

### Acceptance Criteria
- Customer can configure and book any active package.
- Payment captures successfully and mints valid `ZL{YYMMDD}{seq}` ID.
- Database contains matching rows in `paymentsTable` and `booking_servicesTable` (Hotel, Transfer, Activity, Flight Desk).

---

## PHASE 4 — OPERATIONS

### Objective
Provide the operations team with a unified command center to manage supplier fulfillment tasks, track SLA deadlines, assign contracted vendors, verify confirmation vouchers, and handle manual flight bookings with an unbreachable verification gate.

### Features & Scope
- **Operations Dashboard:** Live KPI widgets (Today's Bookings, Approaching Deadlines, Unassigned Tasks, Exceptions).
- **Task Assignment Queue:** Interface to assign tasks to specific DMCs/vendors with dynamic SLA countdown timers.
- **Vendor Portal Interface:** Dedicated vendor login (`/vendor/login`) to review incoming requests, accept/reject within SLA, and upload confirmation vouchers.
- **Manual Flight Fulfillment Desk:** Dedicated modal for operations staff to enter airline PNR, flight schedule, and upload e-ticket PDF.
- **Verification Gate:** Operations staff verify supplier vouchers; customer status transitions to `CONFIRMED` only after verification.

### Technical Deliverables
- **Pages & UI:** `/admin/operations`, `/admin/tasks`, `/admin/operations/bookings/:id`, `/vendor/portal`.
- **Backend Endpoints:**
  - `GET /api/operations/dashboard`, `GET /api/operations/tasks`
  - `POST /api/operations/tasks/:id/assign`, `POST /api/operations/tasks/:id/verify`
  - `POST /api/operations/bookings/:id/flight-pnr`
  - `POST /api/vendor/requests/:id/accept`, `POST /api/vendor/requests/:id/reject`, `POST /api/vendor/requests/:id/voucher`
- **Database Tables:** `booking_services`, `vendors`, `vouchers`, `sla_settings`.
- **Tests:** Vendor accept/reject SLA state machine tests, flight PNR upload validation, and verification gate assertions.

### Acceptance Criteria
- Operations can assign vendors and update statuses.
- Vendor can log in, accept requests, and upload documents.
- Customer booking status remains `PROCESSING` until operations explicitly verifies supplier confirmations.

---

## PHASE 5 — CUSTOMER EXPERIENCE (COMPLETED & VERIFIED)

### Objective
Empower travelers with complete post-booking self-service, real-time transparency into manual fulfillment progress, secure document downloads, cancellation handling, and a custom holiday concierge.

### Features Delivered
- **"My Trips" Customer Portal:** Comprehensive trip management dashboard displaying active and historical bookings.
- **Live Section 11 Timeline:** Visual progress stepper tracking each component: Created $\rightarrow$ Paid $\rightarrow$ Hotel Confirmed $\rightarrow$ Transfer Confirmed $\rightarrow$ Activity Confirmed $\rightarrow$ Final Itinerary Issued.
- **Consolidated Digital Itinerary:** Downloadable/printable multi-day travel plan (`GET /api/bookings/:id/itinerary`, `/download`) with cancellation policies, emergency contacts, and 24/7 ops phone line.
- **15-Minute Signed Document URLs:** Secure, short-lived download links for hotel vouchers and flight tickets with HMAC signature checks.
- **Cancellation & Refund Request:** In-app cancellation flow (`POST /api/bookings/:id/cancel`) computing penalties and submitting refund requests to finance queue.
- **"Build My Trip" Custom Vacation Concierge:** Lead capture interface for bespoke requests (`POST /api/custom-trips`), ops proposal creation, and custom checkout links.
- **Customer Support & Concierge Tickets:** In-app ticket submission and resolution flow with operations desk queue.

### Verification & Acceptance Criteria
- [x] Customer can track live booking fulfillment progress step-by-step.
- [x] Itinerary printable/downloadable with clear cancellation rules and 24/7 ops contacts.
- [x] Document links expire after 15 minutes and verify cryptographically.
- [x] In-app cancellation creates refund record and transitions status to `CANCEL_REQUESTED`.
- [x] Real browser verification screenshot: `phase5_cancellation_confirmed_png_1789922660792.png`.

---

## PHASE 6 — PARTNER NETWORK (COMPLETED & VERIFIED)

### Objective
Establish a high-performing B2B travel agent and affiliate network enabling registered partners to refer travelers, generate bookings, and track commission ledgers with automatic attribution.

### Features Delivered
- **Public Partner Registration:** Self-service modal on homepage capturing agency name, contact person, email, and phone (`POST /api/partners/register`).
- **Admin Partner Approval Workflow:** Administrative verification (`POST /api/admin/partners/:id/approve`) and automated assignment of unique referral codes (e.g. `STARLIGHT10`, `VOYAGE10`).
- **Automated Attribution Engine:** Associates bookings created via referral links/codes (`?ref=...` or checkout input) with partner records.
- **Partner Commission Ledger:** Real-time ledger table (`GET /api/partners/ledger`) calculating and crediting 5% commissions upon booking payment.

### Verification & Acceptance Criteria
- [x] Partner "Starlight Voyages India" registered and approved.
- [x] Booking with referral code automatically creates commission record in ledger.
- [x] Admin partner tab renders live Partner Commission Ledger with agency, booking amount, and 5% cut.
- [x] Real browser verification screenshot: `phase6_partner_ledger_1789924284754.png`.

---

## PHASE 7 — FINANCE, ANALYTICS & SECURITY (COMPLETED & VERIFIED)

### Objective
Provide executive leadership, finance officers, and operations managers with comprehensive business intelligence, automated margin reconciliation, SLA compliance reporting, and refund authorization.

### Features Delivered
- **Executive Finance Dashboard:** Real-time metrics for Total Collections, Net Vendor Costs, Gross Margin %, and Pending Refunds count.
- **Line-Item Margin Ledger:** Per-booking financial audit comparing selling prices, supplier net costs, and gross margins.
- **Refund Approval Queue:** Multi-step refund review, approval, and authorization queue (`POST /api/finance/refunds/:id/approve`).
- **Security & Integrity Hardening:** Signed document HMAC tokens, zero dummy buttons, strict vendor/admin RBAC isolation, dual database engine (PGlite/PostgreSQL).

### Verification & Acceptance Criteria
- [x] Finance dashboard displays live financial collections, net costs, and calculated gross margin.
- [x] Refunds reviewed and approved directly in UI (status updates to `APPROVED`).
- [x] Sensitive documents protected by cryptographic HMAC expiration tokens.
- [x] Real browser verification screenshot: `phase7_finance_dashboard_1789924417678.png`.

---

## PHASE 8+ — FUTURE AI TRAVEL OS (PARKED / DO NOT EXECUTE)

> [!WARNING]
> **STRICT ARCHITECTURAL BOUNDARY:**
> The following phase is **PARKED** and represents speculative future capabilities. **DO NOT EXECUTE, IMPLEMENT, OR WIRE ANY PART OF THIS PHASE IN CURRENT V1.**

### Conceptual Future Roadmap
1. **Conversational Multi-Modal Copilot:** An intelligent assistant capable of understanding unstructured natural language trip requirements.
2. **Autonomous Supplier Negotiation Agents:** Automated agent-to-agent negotiations with local DMCs for custom itinerary quotes.
3. **Dynamic Multi-Destination Packaging:** Real-time combinatorial itinerary construction across regional multi-day circuits.
4. **Predictive Travel Disruption Handling:** Proactive automated flight re-accommodation and weather-adaptive tour rescheduling.
