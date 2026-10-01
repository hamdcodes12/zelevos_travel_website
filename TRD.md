# Technical Requirements Document (TRD) — Wayora / Zelevos V1

**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Status:** ACTIVE / AUTHORITATIVE FOR CURRENT V1  
**Architecture:** Monorepo (pnpm workspaces)  
**Database Engine:** Relational (Dual PGlite / PostgreSQL) via Drizzle ORM  
**Security Posture:** Strict RBAC, TOTP 2FA, Signed HMAC Document URLs, Sliding-Window Rate Limiting  

---

## 1. System Architecture Overview

Zelevos is architected as a cohesive, lightweight, high-performance TypeScript monorepo with zero reliance on external travel supplier APIs. All booking decomposition, state transitions, vendor communications, and financial ledgers run on an internal, self-contained business logic tier.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER (SPA)                             │
│                      artifacts/zelevos (React 19 + Vite)                    │
│                                                                             │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │   Customer Web App    │ │ Operations Dashboard  │ │   Vendor Portal   │  │
│  │  (Search, Curated     │ │ (Task Queue, Verif-   │ │ (Request Inbox,   │  │
│  │  Tours, My Trips)     │ │  ication Gate, PNR)   │ │  Doc Upload)      │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │    Partner Portal     │ │   Finance Overview    │ │   Admin Console   │  │
│  │ (Referrals, Ledger)   │ │ (Margins, Refunds)    │ │ (SLA, Packages)   │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / HTTPS (REST JSON)
                                       │ Session Cookie: zelevos_session
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API SERVER LAYER                                 │
│                     artifacts/api-server (Express 5)                        │
│                                                                             │
│  ┌─────────────────────────┐ ┌────────────────────────┐ ┌────────────────┐  │
│  │ Security & RBAC Guards  │ │ Sliding-Window Limiter │ │ Pino Logger    │  │
│  └─────────────────────────┘ └────────────────────────┘ └────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       Internal Business Engines                       │  │
│  │  - Central Booking Engine (ZL{YYMMDD}{seq} Generator & State Machine) │  │
│  │  - Trip Confidence Score Calculator (Vendor SLA & Quality Weights)    │  │
│  │  - Document Security Engine (15-min HMAC-SHA256 Signed URLs)          │  │
│  │  - Multi-Channel Notification Dispatcher (Email active, SMS queued)   │  │
│  │  - Offline Flight Fulfillment Desk (Zero-API internal simulator)     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┬───────────────────┘
                       │                                  │
                       ▼ Drizzle ORM                      ▼ Webhooks / REST
┌──────────────────────────────────────────────┐ ┌────────────────────────────┐
│                DATABASE LAYER                │ │   EXTERNAL INTEGRATIONS    │
│            lib/db (Drizzle Schema)           │ │     (NON-SUPPLIER ONLY)    │
│                                              │ │                            │
│  - Dual-Mode Engine Support:                 │ │  - Razorpay Payment Gateway│
│    * Embedded PGlite (Offline / Tests / CI)  │ │    (Orders, Webhooks, HMAC)│
│    * PostgreSQL (Production via DATABASE_URL)│ │  - Resend / SMTP Email     │
│  - 22+ Normalized Relational Tables          │ │    (Booking notifications) │
│  - Immutable Audit Log Trail                 │ │                            │
└──────────────────────────────────────────────┘ └────────────────────────────┘
```

---

## 2. Technology Stack & Tools

| Subsystem | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime Environment** | Node.js | `>= 20.0.0` (active v24) | High-performance server execution. |
| **Package Manager** | pnpm | `11.10.0` | Strict monorepo workspace package management. |
| **Backend Framework** | Express | `5.2.1` | REST API routing and middleware pipeline. |
| **Frontend Framework** | React | `19.0.0` | Reactive component UI rendering. |
| **Build Tools** | Vite / ESBuild | Vite `7.3.6`, ESBuild `0.28.2` | Ultra-fast bundling for client SPA and server bundle. |
| **Database ORM** | Drizzle ORM | `0.45.1` | Type-safe SQL query builder and schema management. |
| **Embedded Database** | `@electric-sql/pglite` | `0.4.0` | In-process embedded Postgres for instant offline testing. |
| **Production Database** | PostgreSQL | `>= 15.0` | Robust ACID-compliant relational data store. |
| **Validation** | Zod | `3.25.1` (catalog) | Runtime schema validation for request payloads and DTOs. |
| **Payment Gateway** | Razorpay SDK | REST / Webhook HMAC | Secure payment collection and signature verification. |
| **Logging** | Pino & Pino-HTTP | Pino `9.14.0` | Ultra-low-overhead structured JSON logging. |
| **Two-Factor Auth** | `speakeasy` / `qrcode` | Built-in crypto TOTP | RFC 6238 compliant TOTP token generation and verification. |
| **Testing Engine** | Node Test Runner (`tsx --test`) | TSX `catalog` | Native ESM TypeScript unit and E2E test execution. |

---

## 3. Database Architecture & Dual-Engine Strategy

The database layer in `lib/db` is architected with a **dual-engine strategy** to enable frictionless offline development, hermetic CI testing, and enterprise production deployments without configuration divergence:

1. **Embedded Mode (`PGlite`):** When `DATABASE_URL` is omitted, the application initializes `@electric-sql/pglite` in memory or in a local directory (`.pglite`). This runs a complete WebAssembly/C PostgreSQL instance locally without requiring Docker or a running daemon.
2. **Production Mode (`node-postgres`):** When `DATABASE_URL` is provided, Drizzle binds to standard connection pools connected to external PostgreSQL (e.g., Supabase, RDS).
3. **DDL Migrations:** Schema definitions in `lib/db/src/schema/` automatically synchronize across both engines using standardized Drizzle DDL operations.

---

## 4. Authentication, Sessions & RBAC

### 4.1 Session Security
- **Bcrypt Password Hashing:** 12-round salted password hashes stored in `users.passwordHash` and `admin_users.passwordHash`.
- **Session Cookies:** Signed, HTTP-only cookies (`zelevos_session`) with `SameSite: Lax` and `Secure` attributes enabled.
- **Session Lifespan:** 7-day rolling window with automatic revocation on explicit logout.

### 4.2 Role-Based Access Control (RBAC) Middleware
The API server enforces access through the `requireRole(allowedRoles: UserRole[])` guard:
```typescript
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user && !req.admin) {
      res.status(401).json({ status: "unauthorized", message: "Authentication required" });
      return;
    }
    const currentRole = req.admin ? "admin" : (req.user?.role ?? "customer");
    if (!allowedRoles.includes(currentRole as UserRole)) {
      res.status(403).json({ status: "forbidden", message: `Access denied for role: ${currentRole}` });
      return;
    }
    next();
  };
}
```

### 4.3 Two-Factor Authentication (TOTP Engine)
- **Target Roles:** Mandatory for `admin`, `operations`, and `finance`.
- **Implementation:** RFC 6238 time-based one-time password algorithm (`totp-service.ts`) using cryptographic random 32-character base32 secrets.
- **Verification:** 6-digit tokens validated with a 1-step drift window (30-second skew tolerance).
- **Session Escalation:** Admin login returns `require2fa: true` until `POST /api/admin/2fa/verify` validates the active TOTP code.

---

## 5. Internal APIs vs. External Integrations

To prevent architectural drift, the system strictly isolates internal business APIs from external utility services, and **prohibits direct travel supplier APIs**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             WAYORA / ZELEVOS APIS                           │
│                      (Internal Business REST Endpoints)                     │
│                                                                             │
│  /api/auth/*          -> Authentication, sessions, recovery, 2FA            │
│  /api/packages/*      -> Curated package discovery, search, admin CRUD      │
│  /api/destinations/*  -> Regional catalog, highlights, destination FAQs     │
│  /api/bookings/*      -> Master booking lifecycle, payments, my-trips       │
│  /api/operations/*    -> Ops dashboard KPIs, task assignment, verification  │
│  /api/vendor/*        -> Vendor portal inbox, request acceptance, vouchers  │
│  /api/finance/*       -> Margin tracking, supplier payables, refund queue   │
│  /api/partners/*      -> B2B partner registration, referral link tracking  │
│  /api/custom-trips/*  -> "Build My Trip" lead capture and ops proposals     │
│  /api/documents/*     -> 15-minute HMAC signed document serving             │
│  /api/admin/*         -> Configurable SLA settings, audit log inspection    │
│  /api/flights/*       -> Offline internal flight desk simulation            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────┬──────────────────────────────────────┐
│        ALLOWED EXTERNAL APIS         │       FORBIDDEN SUPPLIER APIS        │
│          (Utility & Billing)         │          (STRICTLY REMOVED)          │
│                                      │                                      │
│  ✔ Razorpay Orders & Verification    │  ❌ Duffel Flight API (Removed)     │
│  ✔ Nodemailer / Resend Email Relay   │  ❌ Hotelbeds Hotel API (Removed)   │
│  ✔ Supabase Postgres Connection      │  ❌ Ignav Flight Popups (Removed)   │
│                                      │  ❌ Travelpayouts Widgets (Removed)  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 6. Complete Internal API Blueprint

### 6.1 Authentication (`/api/auth`)
- `POST /api/auth/register`: Register traveler account.
- `POST /api/auth/login`: Authenticate customer/staff session.
- `POST /api/auth/logout`: Invalidate session cookie.
- `GET /api/auth/me`: Current session status and user profile.
- `POST /api/auth/forgot-password`: Generate password recovery token.
- `POST /api/auth/reset-password`: Commit new password via token.
- `POST /api/auth/2fa/setup`: Generate TOTP secret and data URL QR code.
- `POST /api/auth/2fa/enable`: Commit TOTP secret upon valid initial code.
- `POST /api/auth/2fa/verify`: Submit TOTP token during two-step login.

### 6.2 Packages & Catalog (`/api/packages`, `/api/destinations`)
- `GET /api/packages`: List curated packages with filters (destination, theme, budget, duration).
- `GET /api/packages/:id`: Retrieve full package details with day-wise itinerary and Trip Confidence Score.
- `POST /api/packages`: `[Admin]` Create new curated package.
- `PUT /api/packages/:id`: `[Admin]` Update package itinerary, pricing, and policies.
- `DELETE /api/packages/:id`: `[Admin]` Archive package.
- `GET /api/destinations`: List available destinations with meta descriptions.
- `GET /api/destinations/:id`: Destination overview, highlights, and FAQ list.

### 6.3 Bookings & Payments (`/api/bookings`)
- `POST /api/bookings`: Create booking draft; returns `bookingId` (`ZL{YYMMDD}{seq}`) and Razorpay order.
- `POST /api/bookings/:id/pay`: Submit Razorpay payment signature; captures payment, transitions status to `PAID`, triggers auto-generation of component fulfillment tasks.
- `GET /api/bookings/:id`: Retrieve booking details, live timeline, and component vouchers.
- `GET /api/bookings/my-trips`: Retrieve traveler's active and historical trips.
- `POST /api/bookings/:id/cancel`: Submit cancellation request; calculates policy penalties and records pending refund.
- `GET /api/bookings/:id/itinerary`: Generate consolidated digital itinerary.

### 6.4 Operations Management (`/api/operations`)
- `GET /api/operations/dashboard`: Real-time KPI counts (pending tasks, approaching SLAs, exceptions).
- `GET /api/operations/tasks`: List service fulfillment tasks with filtering by status and vendor.
- `POST /api/operations/tasks/:taskId/assign`: Assign specific supplier to fulfillment task.
- `POST /api/operations/tasks/:taskId/verify`: Operations verification gate; validates supplier voucher and unlocks confirmation.
- `POST /api/operations/bookings/:bookingId/flight-pnr`: Upload manual airline PNR, flight schedule, and e-ticket PDF.

### 6.5 Vendor Portal (`/api/vendor`)
- `GET /api/vendor/requests`: List assigned booking requests with SLA countdown.
- `POST /api/vendor/requests/:taskId/accept`: Vendor accepts service assignment; enters confirmation reference.
- `POST /api/vendor/requests/:taskId/reject`: Vendor rejects service assignment; triggers ops reassignment.
- `POST /api/vendor/requests/:taskId/voucher`: Upload confirmation voucher, driver slip, or tax invoice.
- `GET /api/vendor/ledger`: Review settled and pending vendor payables.

### 6.6 Finance & Reconciliation (`/api/finance`)
- `GET /api/finance/overview`: Financial metrics (GBV, Net Revenue, Settled Payables, Gross Margins).
- `GET /api/finance/bookings-ledger`: Line-item accounting ledger comparing expected vs. actual margins.
- `GET /api/finance/refunds`: List active refund requests.
- `POST /api/finance/refunds/:id/process`: Approve and disburse customer refund.

### 6.7 Partner Network (`/api/partners`)
- `POST /api/partners/register`: Public registration modal for B2B partners.
- `GET /api/partners/me`: Partner profile, unique referral link, and commission metrics.
- `GET /api/partners/commissions`: Line-item ledger of commissions attributed to partner bookings.

### 6.8 Custom Trips ("Build My Trip") (`/api/custom-trips`)
- `POST /api/custom-trips`: Customer submits bespoke holiday inquiry.
- `GET /api/admin/custom-trips`: `[Ops]` View incoming custom trip leads.
- `POST /api/admin/custom-trips/:id/proposal`: `[Ops]` Dispatch finalized itinerary proposal and payment link.

### 6.9 Document Security (`/api/documents`)
- `POST /api/documents/sign`: Generate a 15-minute HMAC-SHA256 signed access token for a voucher or invoice.
- `GET /api/documents/signed-view`: Stream document binary upon valid token verification; logs access in `audit_logs`.

---

## 7. Flight-Without-API Architecture

The file `artifacts/api-server/src/services/flight-provider.ts` has been audited and classified as **KEEP / REFACTOR**:
- **Zero External Calls:** Contains zero network requests and zero credentials for Duffel, Ignav, or Travelpayouts.
- **Internal Offline Flight Engine:** Generates deterministic flight numbers (`6E-xxx`, `AI-xxx`), departure/arrival schedules, and realistic fare estimates for popular Indian trunk routes (`DEL-SXR`, `BOM-GOI`, `BLR-COK`).
- **Operational Integration:** Used exclusively to provide baseline flight schedules when travelers select *"Flight Required"* at checkout.
- **Manual Fulfillment Gate:** Customer bookings remain explicitly labeled **"subject to confirmation"** until operations staff manually book the seat and upload the true airline PNR via `POST /api/operations/bookings/:bookingId/flight-pnr`.

---

## 8. Payment Gateway Integration (Razorpay)

1. **Order Creation:** When checkout is submitted, `createPaymentOrder()` calls Razorpay's API to mint an order tied to the `ZL{YYMMDD}{seq}` identifier.
2. **Signature Verification:** On payment completion, `verifyPaymentSignature()` validates the payload server-side:
   $$\text{Expected Signature} = \text{HMAC-SHA256}(\text{order\_id} + "|" + \text{payment\_id}, \text{RAZORPAY\_KEY\_SECRET})$$
3. **Anti-Tampering:** Signature checks strictly reject mock signatures in production mode.
4. **Secrets Protection:** Raw Razorpay secret keys are never serialized in client responses or public API DTOs.

---

## 9. Document & File Security Architecture

Vouchers, driver slips, and invoices contain sensitive traveler PII (names, phone numbers, hotel room numbers) and must never be exposed publicly:
1. **Private Storage:** Document files are stored in local protected storage or private S3 buckets.
2. **HMAC Signed URLs:** URLs are generated with short-lived tokens:
   $$\text{Token Payload} = \text{base64url}(\{ \text{docId}, \text{userId}, \text{expiresAt}: \text{now} + 15\text{min} \})$$
   $$\text{Token} = \text{Payload} + "." + \text{HMAC-SHA256}(\text{Payload}, \text{DOCUMENT\_SIGNING\_SECRET})$$
3. **Access Enforcement:** The `/api/documents/signed-view` endpoint validates expiration and cryptographic integrity before streaming content, writing an entry to `audit_logs`.

---

## 10. Rate Limiting & Brute Force Defense

An in-memory sliding-window limiter (`rate-limiter.ts`) protects public endpoints:
- **Authentication Routes (`/api/auth/login`, `/register`):** 10 requests per 15 minutes per IP.
- **2FA Verification Routes (`/api/auth/2fa/verify`):** 5 attempts per 15 minutes per IP.
- **Sensitive Operations Routes (`/api/documents/sign`):** 30 requests per minute per IP.
- **General API Routes:** 200 requests per minute per IP.
- **HTTP Response:** Returns `429 Too Many Requests` with `Retry-After` header.

---

## 11. Multi-Channel Notification Dispatcher

The notification engine (`email-service.ts`) handles critical lifecycle alerts:
- **Active Channel (Email):** Connects via standard SMTP or Resend API (`RESEND_API_KEY`). Sends responsive HTML transactional templates for all 10 PRD Section 17 events.
- **Future Channels (WhatsApp / SMS):** Implemented behind the `NotificationProvider` TypeScript interface. The service layer records log dispatches as `status: "COMING_SOON"`, preventing false delivery claims while maintaining full code readiness.

---

## 12. Monitoring, Structured Logging & Audit Trail

1. **Structured Logging:** `pino` structured JSON logger tracks request IDs, HTTP status, and response latency.
2. **CORS Enforcement:** Scoped strictly to approved origins (`localhost:8080`, `localhost:3000`, and production domain).
3. **Audit Trail:** Table `audit_logs` records every critical database state mutation with columns `userId`, `action`, `resourceType`, `resourceId`, `previousState`, `newState`, and `timestamp`.

---

## 13. Automated Backup Architecture

A stand-alone operational backup script (`scripts/backup-database.ts`) supports dual-engine backup:
- **PostgreSQL:** Invokes `pg_dump` with gzip compression to output timestamped `.sql.gz` snapshots.
- **PGlite:** Exports raw SQLite/datadir binary snapshots into timestamped backup directories.

---

## 14. Testing Framework & Test Suite Architecture

The backend test suite is executed using Node's native test runner via `tsx`:
```powershell
pnpm --filter @workspace/api-server test
```
- **Concurrency:** Strictly `--test-concurrency=1` to guarantee deterministic state transitions across database fixtures.
- **Test Inventory:** 24 test suites containing 100 tests.
- **Current Verified Results:** **99 PASSED**, **0 FAILED**, **1 SKIPPED** (`live-gemini.test.ts` skipped as expected when optional live Gemini key is not supplied).
- **Static Assets Test:** `test/static-assets.test.ts` validates 5/5 static asset routes, immutable cache headers, and SPA index fallbacks.

---

## 15. Build, Asset Pipeline & Production Serving

- **Client Production Bundle:** Built via Vite (`vite build --config vite.config.ts`) into `artifacts/zelevos/dist/public`.
- **Server Production Bundle:** Built via ESBuild (`node ./build.mjs`) into `artifacts/api-server/dist/index.mjs`.
- **Static Asset Serving:** Express static middleware mounts `dist/public` at root, serving hashed assets (`/assets/*.js`, `*.css`) with `Cache-Control: public, max-age=31536000, immutable`, and serves `index.html` for unknown frontend routes with `Cache-Control: no-cache`.

---

## 16. Parked AI Architecture

All legacy AI Travel OS prototype code is completely decoupled from active V1 customer execution:
- Parked components reside in `artifacts/zelevos/src/components/parked/`.
- No active customer route imports or renders parked AI modules.
- The Gemini service (`gemini.ts`) and AI route (`ai.ts`) remain isolated internal utilities, with zero active dependency on customer checkout or manual ops workflows.

---

## 17. Database Backup & Disaster Recovery Procedure (PRD Section 25)

The database backup procedure executes a clean, atomic snapshot of all 11 core tables (`usersTable`, `packagesTable`, `destinationsTable`, `vendorsTable`, `bookingsTable`, `bookingServicesTable`, `paymentsTable`, `refundsTable`, `partnersTable`, `slaSettingsTable`, `auditLogsTable`) and exports them with checksum metadata to the `backups/` directory:
```powershell
pnpm exec tsx scripts/backup-database.ts
```
Snapshots are serialized in ISO-timestamped JSON format (`backups/zelevos-backup-YYYY-MM-DDTHH-mm-ss.json`) containing table row counts and payload integrity verification, supporting rapid point-in-time recovery without external database dependencies.

