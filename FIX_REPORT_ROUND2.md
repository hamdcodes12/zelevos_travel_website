# Zelevos — Round 2 Fix Report

Date: 2026-09-27
Branch: `fix/round2` (based on Round-1 `fix/audit-2026-09`, tag `round1-head` = `7da9960`)
Engineer: Claude (Anthropic), verified by running the code — not self-reported.

This round fixes the items an independent re-audit found still open after Round 1
(`FIX_REPORT.md`), plus two data-exposure items (catalog cost leak, support-ticket
booking-linking) found during that same re-audit.

## 1. Summary

| ID | Title | Status | Evidence |
|---|---|---|---|
| R2-01 | `/auth/verify-otp` granted a session for an already-verified email with no real check | FIXED | `audit-evidence2/99-final-round2-replay.txt` |
| R2-02 | Vendor takeover chain: public resubmit, plaintext temp password, login allowed pre-approval | FIXED | same |
| R2-03 | Live-looking credentials in tracked scripts/tests (admin password, Razorpay keys, DB URL) | FIXED (working tree). Git **history** NOT rewritten — see §4. | same |
| R2-04 | `requireAuth` rejected admin-portal sessions on 3 routes (Round-1 regression) | FIXED | same |
| R2-05 | Booking-itinerary UUID regex had an extra group, never matched | FIXED | same |
| R2-06 | Password-reset token returned in the API response / logged | FIXED | same |
| R2-07 | Password-reset e-mail was never actually sent | FIXED | same |
| R2-08 / P1 | Webhook vs `/payments/verify` race could leave a paid booking `PAYMENT_PENDING` | FIXED | `audit-evidence2/payments-p1p2p3-final.txt` |
| R2-09 / P2 | Production could run with the test payment provider / no webhook secret | FIXED | same |
| R2-10 / P3 | Public Google Maps proxy: no rate limit, no cache, no input cap | FIXED | same |
| R2-16 | Test-only signup auto-verify path could theoretically be tripped in prod | Verified already safe | see §3 |
| C1 | Public `/packages`, `/packages/:id`, `/destinations*` leaked cost/markup/vendor data, ignored draft/expired status, ignored members-only locking | FIXED | `audit-evidence2/catalog-c1c2-final.txt` |
| C2 | Public support-ticket form let anyone attach a ticket to someone else's booking and leaked the booking's internal UUID | FIXED | same |

**17 exploit-replay tests** (`audit-round2-replay.test.ts`) — each written to FAIL on
`round1-head` and PASS on this branch. Verified both ways (`00-baseline-round2.txt` = all
fail except one intentional pass; `99-final-round2-replay.txt` = 17/17 pass).

**32 payment tests** (`audit-round2-payments.test.ts`, P1/P2/P3) — 32/32 pass.
**16 catalog tests** (`audit-round2-catalog.test.ts`, C1/C2) — 16/16 pass.

**Full backend suite (final, confirmed green)**: 226 tests, 38 suites, **225 pass, 0
fail**, 1 skipped (the pre-existing, intentionally-parked live-Gemini smoke test — see
`test/live-gemini.test.ts`). Raw output: `audit-evidence2/full-suite-final.txt`. The
first full run found exactly 2 pre-existing tests that needed updating for the new
password-protected supplier endpoints (they were testing the old, insecure API by
design); both fixed in `test/supplier-self-onboarding.test.ts` and reconfirmed green.

**Typecheck**: `pnpm run typecheck` — 0 errors, all 9 workspace packages.
**Builds**: `pnpm --filter @workspace/zelevos build` and
`pnpm --filter @workspace/api-server build` — both exit 0.

## 2. What changed, and why (per item)

### R2-01 — `auth.ts`, `/auth/verify-otp`
The handler returned a valid session for any request where `user.emailVerified` was
already true, regardless of the OTP supplied (or omitted). Removed that branch entirely;
an already-verified account now gets `400 already_verified` and no session.

### R2-02 — `vendors.ts` (register, application-status, resubmit, `/vendor/login`)
- `temporaryPassword` is now always a salted scrypt hash (`hashSupplierPassword` /
  `verifySupplierPassword`), never plaintext, and no hardcoded default
  (`"SupplierPass123!"`) remains anywhere in the request path.
- `GET /suppliers/application-status` is gone (405); the new `POST` requires
  `identifier` + `password` and returns a generic 401 for both "unknown" and "wrong
  password" (a dummy-hash comparison keeps the timing the same either way).
- `PUT /suppliers/application/:id/resubmit` requires the same password proof, and only
  transitions a `CHANGES_REQUESTED` application — the anonymous "resubmit with `{}`"
  approval-bypass no longer changes anything.
- `/vendor/login` is an **allowlist**: only `status === "APPROVED"` may log in (was a
  denylist that let `UNDER_REVIEW` through).
- Registration's 409 response no longer echoes `existingVendorId`.
- Every response that could include `vendor` data is now built from an explicit DTO
  (`publicApplication`, `vendorForOwner`) — never a raw row.
- Document upload now sniffs the real file bytes (`sniffDocumentType`) instead of
  trusting the client's declared MIME type, and the file-serving route sends
  `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
- New rate limiters: `vendorLoginRateLimiter`, `supplierRegisterRateLimiter`,
  `supplierApplicationRateLimiter` (keyed by IP **and** application id),
  `supplierUploadRateLimiter`.
- `lib/db/src/index.ts`: `seedPlatformDefaults` no longer falls back to a hardcoded
  admin password; without `ADMIN_PASSWORD` it generates a random one (dev/test only —
  still refuses to seed anything in production without an explicit password). A new
  `hashLegacyVendorPasswords` migration step hashes any pre-existing plaintext
  `temporary_password` value on startup (idempotent — skips rows already hashed).

### R2-03 — secret scrub (working tree)
- Deleted `scripts/capture-razorpay-direct.mjs`, `scripts/capture-razorpay-qr.mjs`,
  `scripts/direct-reset-admin.mjs` (hardcoded live-looking Razorpay key/secret and a
  hardcoded production DB URL + admin password).
- `scripts/seed-admin.ts` (both copies) rewritten: reads `ADMIN_ID`/`ADMIN_PASSWORD`
  from the environment only, refuses to run without them, no `admin`/`admin123`
  fallback account.
- Every test file that hardcoded the leaked admin password now uses a
  test-only literal (`Test-Only-Admin-Pass-2026!`) instead.
- Added `audit-round2-replay.test.ts`'s R2-03 check: walks the tracked tree looking for
  live-looking Razorpay/Resend keys or a `postgres://` URL with a real-looking password,
  excluding obviously-fake fixture values and `.env`/docs. Passes.
- Removed the tracked, empty `admin_cookie.txt` (curl cookie-jar debris, no real
  cookie value in it, but should never have been committed).

### R2-04 — `authMiddleware.ts`, `bookings.ts`, `documents.ts`, `vendors.ts`
Added `requireAuthOrAdmin` (passes if *either* `req.user` or `req.admin` is set) and
put it on the three routes whose handlers already branched on `req.admin` internally
but were gated by `requireAuth` (which only recognises `req.user`), so an admin-portal
session was rejected before the handler ever ran: booking cancel/itinerary,
`GET /documents/tickets/:bookingId`, `GET /suppliers/documents/file/:filename`.

### R2-05 — `bookings.ts`, `documents.ts`
Extracted the correct 8-4-4-4-12 UUID pattern into `lib/ids.ts` (`isUuid`) and replaced
every local copy — including the one with an extra `-4` group that made UUID-based
itinerary lookups always 404.

### R2-06 / R2-07 — `auth.ts`, `email-service.ts`
- `/auth/password/forgot` no longer returns `resetUrl` in the response or logs it; the
  response shape is now byte-for-byte the same whether the account exists or not.
- Added `sendPasswordResetEmail` (mirrors the existing OTP e-mail's Resend integration,
  including its `ALLOW_DEBUG_OTP`-gated local-debug fallback) and wired it in.
- `/auth/password/reset` now also deletes the user's existing sessions on a successful
  reset, so a stolen session doesn't survive a password change.

### R2-08/P1, R2-09/P2 — `booking-engine.ts`, `payment-service.ts`, `travel.ts`
- New `finalizeCapturedPayment()` in `booking-engine.ts`: the **only** place that turns
  a captured payment into a paid booking (payments row, commission, fulfilment tasks).
  Exclusivity comes from one atomic `UPDATE payment_transactions ... WHERE status =
  'CREATED'`; whichever caller's update actually matches is the one that proceeds,
  everyone else (a race, a retry, the same webhook delivered twice) is a no-op.
  `/payments/verify`, `/payments/webhook`, and `POST /bookings/:id/payment` all call it
  instead of each mutating the database their own slightly different way.
- The webhook's signature check no longer goes through the payment provider (which let
  the test provider's magic strings work even when misconfigured); it's now a direct
  HMAC-SHA256 of the raw body, and an unsigned webhook is refused (503) in **every**
  environment, not just production.
- `payment-service.ts`: new `assertProductionPaymentConfig()`, called at server startup
  (`app.ts`) and defensively inside `getPaymentProvider()` — production can no longer
  start (or silently hand back) `PAYMENT_PROVIDER=test`, and requires
  `RAZORPAY_KEY_ID`/`SECRET`/`RAZORPAY_WEBHOOK_SECRET` to be set.
  `TestPaymentProvider`'s constructor also refuses to run in production, defense in depth.

### R2-10/P3 — `google-maps.ts`, `travel.ts`, `rate-limiter.ts`, `app.ts`
- `input`/`origin`/`destination` capped at 200 chars (rejected before any lookup).
- A bounded, TTL (10 min) in-memory cache for autocomplete results, routes, and static
  map images, keyed by a case/whitespace-normalised query — a static-map request reuses
  a cached route instead of re-fetching it.
- New `mapsRateLimiter` (30/min per IP, one shared budget across all three endpoints).
- The endpoints stay public (used by logged-out visitors) but fail closed with 503 and
  never touch the network when `GOOGLE_MAPS_API_KEY` is unset.

### C1 — `packages.ts`, `destinations.ts` (public catalog)
Public list/detail responses are now built from explicit DTOs
(`toPublicPackageCard`, `toPublicPackageDetail`, `toPublicDestination`) that exclude
`baseCost`, `markupType`/`markupValue`, `assignedVendorIds`, and full component cost
breakdowns. Draft/paused/archived/offer-expired packages and non-active destinations
404 on the public routes (admin routes are unaffected — they keep the full row).
A members-only package is a locked teaser (no price/itinerary) for anonymous or
non-signed-in callers; price-based sort/filter can't be used to infer a locked price
(masked to `NULL`, sorted last). The destination-detail route (`/destinations/:slug`)
had never been touched in Round 1's partial catalog work — this round fixed it too.

### C2 — `operations.ts` (`POST /support/tickets`)
A `bookingId` is now only attached when the caller is authenticated **and** owns that
booking; an anonymous submission, or one citing someone else's booking, is stored
unlinked with the same response shape either way (no existence oracle). The response
no longer echoes the internal booking UUID. Staff (`GET /support/tickets`, resolve)
are unaffected.

## 3. R2-16 (signup auto-verify) — re-checked, no change needed
The `isTestMode` branch in `POST /auth/signup` already requires
`process.env.NODE_ENV !== "production"` as part of its own condition
(`process.env.NODE_ENV !== "production" && (process.env.NODE_ENV === "test" || ...)`),
so it is unreachable when `NODE_ENV=production` regardless of `SKIP_EMAIL_OTP`.
Verified with a dedicated test (`R2-16` in the replay suite): production +
`SKIP_EMAIL_OTP=true` still requires real OTP verification. No production code change
was needed here.

## 4. What this round did **not** do (be honest about it)

- **Git history was not rewritten.** The real Razorpay live key, the real Supabase DB
  password, and the real admin password that leaked in Round 1's commits are still
  present in older commits on this branch's history (they are gone from the current
  working tree, per R2-03). Rewriting history (`git filter-repo`) is a destructive,
  hard-to-reverse operation on a branch I don't own the remote for — I did not do it
  without being asked. **Rotating those three credentials at the provider makes the old
  history harmless regardless of whether it's rewritten**, so treat that as the priority,
  not the history rewrite.
- I did not attempt a `git filter-repo`/BFG pass, a CI secret-scanning hook, or a
  `scripts/scan-secrets.mjs` standalone script — the equivalent check lives inside the
  R2-03 test instead, which is run every time the suite runs.
- Two Round-1-owned test files (`operations-vendor-reassign-rbac.test.ts`,
  `zelevos-v1-e2e.test.ts`) still pass unmodified.

## 5. Manual actions for the owner (cannot be done from inside this environment)

1. Rotate the Razorpay live key + secret (Razorpay Dashboard → Settings → API Keys).
2. Reset the Supabase database password (Supabase → Project Settings → Database).
3. Rotate the Resend API key.
4. Change the real admin account's password (the one that leaked in `scripts/seed-admin.ts`
   and multiple `.mjs` capture scripts in Round 1's history) — run the rewritten
   `scripts/seed-admin.ts` with `ADMIN_ID`/`ADMIN_PASSWORD` set to a new value.
5. Delete the leftover `.env` copies outside this repo (the original zip, and the
   "…deleted node module" folder on the Desktop) — they still hold the live credentials.
6. Do not push this branch anywhere until 1–4 are done.
7. On existing Supabase/production data: any vendor row with a plaintext
   `temporary_password` will be hashed automatically the next time the server starts
   against that database (see `hashLegacyVendorPasswords`); no manual migration step
   needed, but it does mean **any vendor who never logged in yet must use the
   password they set at registration** — if that value doesn't exist for very old
   test/demo rows, they'll need to go through "forgot password" once support builds a
   supplier-facing reset flow (not part of this round's scope).
