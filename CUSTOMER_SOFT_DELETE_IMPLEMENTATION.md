# Zelevos — Real Customer Soft Delete / Archive + Restore System
## Production Implementation, Architectural Specification & Verification Report

---

## 1. Existing Architecture Overview

The Zelevos customer management system centralizes user identity and customer dossiers under the **Admin Operations Console** (`/admin` -> Customers -> User Information & Customer Dossiers).

* **Users Table (`users`)**: Represents all registered users. Each customer possesses an immutable UUID `id`, a unique `customerId` (format: `ZLV-CUS-XXXXXX` or `CUST-XXXXXX`), and status flags.
* **Customer Dossiers**: Comprehensive aggregations linking the customer to all historical entities:
  * **Bookings (`bookings`)**: Flight, package, hotel, and activity reservations.
  * **Payment Transactions (`payment_transactions`)**: Captured/refunded transactions.
  * **Invoices (`invoices`)**: Generated billing records.
  * **Refunds (`refunds`)**: Processing and completed refund requests.
  * **Support Tickets (`support_tickets`) & Messages (`support_messages`)**: Customer service interactions.
  * **Custom Trip Leads & Proposals (`custom_trips`, `trip_proposals`)**: Bespoke itinerary requests and offers.
  * **Audit Logs (`audit_logs`)**: Centralized immutable security events.

Prior to this implementation, the system lacked a soft-delete/lifecycle archiving mechanism; customers could only be active or suspended, and filtering could not segregate inactive/archived accounts from active operational views.

---

## 2. Customer Lifecycle

The customer lifecycle is modeled with explicit states that protect customer identity and historical data:

```
                  ┌──────────────┐
                  │     NEW      │  (Registered within 7 days, active)
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │    ACTIVE    │  (Regular operational customer)
                  └──────┬───────┘
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
      ┌──────────────┐        ┌──────────────┐
      │  SUSPENDED   │        │   ARCHIVED   │  (Soft-deleted lifecycle state)
      └──────────────┘        └──────┬───────┘
                                     │
                                     │ [Admin Restore]
                                     ▼
                              ┌──────────────┐
                              │    ACTIVE    │  (Permanent ID & history intact)
                              └──────────────┘
```

* **NEW**: Registered within the last 7 calendar days, active, badge displayed.
* **ACTIVE**: Standard operational customer eligible for booking, login, and support.
* **SUSPENDED**: Account temporarily restricted for security or policy enforcement.
* **ARCHIVED**: Soft-deleted. Hidden from standard active lists, login prevented, active sessions revoked, complete historical records permanently preserved in the database.

---

## 3. Archive Behavior

When an authorized Administrator initiates the **Archive Customer** action:
1. **Interactive Confirmation**: A confirmation modal displays the customer's permanent Customer ID, name, and email, warning that the customer will be removed from the active operational views while preserving all account history.
2. **Reason Selection & Optional Note**: The Admin must select a mandatory structured reason:
   * *Customer Requested Account Closure*
   * *Duplicate Account*
   * *Inactive Account*
   * *Test Account*
   * *Suspicious/Abusive Account*
   * *Other* (requires custom description)
   * *Admin Internal Note* (optional context).
3. **Server-Side Validation**:
   * Validates Admin authentication (`requireAdmin`).
   * Verifies the target user exists and is not already archived (returns `400 already_archived` if duplicate).
   * Validates archive reason (minimum 3 characters, rejects whitespace).
4. **Database State Mutation (Zero Hard-Delete)**:
   * Updates `users.status = 'archived'`.
   * Sets `users.is_archived = true`.
   * Records `users.archived_at = NOW()`.
   * Records `users.archived_by = req.admin.id`.
   * Stores `users.archive_reason` and `users.archive_note`.
5. **Immediate Active Session Termination**:
   * Purges all active customer sessions from `sessions` table (`DELETE FROM sessions WHERE user_id = $1`).
6. **Immutable Audit Trail**:
   * Emits audit event `CUSTOMER_ARCHIVED` with metadata containing `customerId`, `actorAdminId`, `reason`, and `note`.

---

## 4. Restore Behavior

When an authorized Administrator initiates the **Restore Customer** action:
1. **Interactive Confirmation**: A confirmation modal displays the customer's permanent ID and confirms account reactivation.
2. **Server-Side Validation**:
   * Validates Admin authentication (`requireAdmin`).
   * Verifies the user exists and is currently archived (`400 not_archived` if already active).
3. **Database State Mutation**:
   * Sets `users.status = 'active'`.
   * Sets `users.is_archived = false`.
   * Clears `archived_at = null`, `archived_by = null`, `archive_reason = null`, `archive_note = null`.
   * **Permanent Customer ID (`customerId`), registration timestamp, and all linked records remain completely unaltered.**
4. **Audit Trail**:
   * Emits audit event `CUSTOMER_RESTORED` linking the acting admin and customer.
5. **Operational Recovery**:
   * Customer immediately reappears in normal active views and can authenticate again.

---

## 5. Database Schema & Migration Details

A non-destructive migration was applied to the production PostgreSQL `users` table:

```sql
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "archived_by" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "archive_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "archive_note" TEXT;

CREATE INDEX IF NOT EXISTS "users_is_archived_idx" ON "users" ("is_archived");
CREATE INDEX IF NOT EXISTS "users_archived_at_idx" ON "users" ("archived_at");
```

Drizzle ORM definition updated in [lib/db/src/schema/auth.ts](file:///c:/Users/navin/OneDrive/Desktop/zelevos_travel_website-main/lib/db/src/schema/auth.ts):
```ts
isArchived: boolean("is_archived").notNull().default(false),
archivedAt: timestamp("archived_at", { withTimezone: true }),
archivedBy: uuid("archived_by").references(() => adminUsersTable.id, { onDelete: "set null" }),
archiveReason: text("archive_reason"),
archiveNote: text("archive_note"),
```

---

## 6. API Changes

All endpoints enforce strict Admin RBAC (`requireAdmin`) and return sanitized error responses.

| Endpoint | Method | Description | Security |
| :--- | :--- | :--- | :--- |
| `/api/admin/customers` | `GET` | Fetches customer list. Default filter excludes archived accounts (`isArchived = false`). Supports `status=archived`, `status=new`, `status=active`, `status=suspended`, `status=all`. Resolves `archivedByName`. | Admin session required |
| `/api/admin/customers/:id` | `GET` | Retrieves full customer details including archive metadata and `archivedByName`. | Admin session required |
| `/api/admin/customers/:id/archive` | `POST` | Soft-deletes/archives customer. Accepts `{ reason: string, note?: string }`. Purges sessions, updates status, writes audit log. | Admin session required |
| `/api/admin/customers/:id/restore` | `POST` | Restores customer to `status = 'active'`. Clears archival flags, writes audit log. | Admin session required |
| `/api/admin/users/search` | `GET` | Autocomplete / customer search. Excludes archived customers by default unless explicit filter `status=archived` is supplied. | Admin session required |
| `/api/admin/users/:userId/dossier` | `GET` | Returns full dossier for active or archived customers. Appends archival banner metadata and timeline event. | Admin session required |

---

## 7. Authentication Behavior & Session Revocation

To prevent archived users from maintaining access or authenticating:
1. **Login Blockade (`POST /api/auth/login`)**:
   * Evaluates `user.isArchived` and `user.status === 'archived'`.
   * Rejects authentication with HTTP `403 Forbidden`:
     ```json
     {
       "error": "account_unavailable",
       "message": "Your account is currently unavailable. Please contact Zelevos Support."
     }
     ```
2. **Session Guard (`userFromRequest` in `artifacts/api-server/src/lib/auth.ts`)**:
   * When an existing session token is verified, if the user record has `isArchived: true` or `status === 'archived'`, the session is deleted from `sessionsTable` and the caller is treated as unauthenticated (`null`).
3. **Session Creation Guard (`createSession`)**:
   * Throws `account_unavailable` if a session creation attempt is made for an archived user.
4. **Session Purge on Archive**:
   * Archiving immediately deletes all rows in `sessionsTable` where `userId = user.id`.

---

## 8. Historical Data Preservation

Under NO circumstances is customer data deleted or unlinked. Archiving a customer strictly preserves:

* **Customer ID**: Permanent identifier (`ZLV-CUS-XXXXXX`) remains unchanged forever.
* **Bookings**: All flight, hotel, package, and custom bookings remain in their current state (`CONFIRMED`, `PAID`, etc.). No bookings are automatically cancelled.
* **Payments & Transactions**: All historical charges, captured payments, and payment records remain intact for financial reconciliation.
* **Invoices & Receipts**: Billing documents remain unchanged and accessible to Admin Finance.
* **Refunds**: All processed or pending refund records remain historically auditable.
* **Support Tickets & Messages**: All historical customer support interactions remain intact and accessible in the dossier.
* **Custom Trips & Proposals**: Custom trip leads, quotes, and proposals remain fully attached.
* **Notifications**: Notification delivery records remain preserved.
* **Audit Trail**: Every customer event remains permanently in `audit_logs`.

---

## 9. Audit Logging

Both lifecycle transitions generate structured, immutable records in `audit_logs`:

### `CUSTOMER_ARCHIVED`
```json
{
  "action": "CUSTOMER_ARCHIVED",
  "actorRole": "admin",
  "actorAdminId": "admin-uuid",
  "actorName": "zelevos-travelai00",
  "resourceType": "user",
  "resourceId": "user-uuid",
  "metadata": {
    "customerId": "ZLV-CUS-000085",
    "customerEmail": "customer@example.com",
    "customerName": "John Doe",
    "reason": "Customer Requested Account Closure",
    "note": "Customer requested closure via email ticket"
  }
}
```

### `CUSTOMER_RESTORED`
```json
{
  "action": "CUSTOMER_RESTORED",
  "actorRole": "admin",
  "actorAdminId": "admin-uuid",
  "actorName": "zelevos-travelai00",
  "resourceType": "user",
  "resourceId": "user-uuid",
  "metadata": {
    "customerId": "ZLV-CUS-000085",
    "customerEmail": "customer@example.com",
    "customerName": "John Doe",
    "previousStatus": "archived"
  }
}
```

---

## 10. Security & IDOR Protections

1. **Role-Based Access Control (RBAC)**: Only authenticated `adminUsers` can call archive or restore APIs. Standard customers and anonymous visitors receive `401 Unauthorized` or `403 Forbidden`.
2. **Server-Side Derivation**: Admin identities (`archivedBy`, audit actor) are extracted from verified server-side session cookies, never trusted from client request bodies.
3. **No Cascade Deletions**: No foreign keys are deleted; zero `DELETE FROM users` or cascading triggers exist for this feature.
4. **Sanitized Error Reporting**: Database constraint violations, internal errors, or SQL queries are never leaked to client responses. Safe user-facing error messages are returned uniformly.

---

## 11. UI Changes in Admin Panel

### Customer Table (`artifacts/zelevos/src/pages/admin.tsx`)
1. **Status Dropdown Filter**:
   * *All Active Customers* (default: excludes archived)
   * *New Customers (Last 7 Days)*
   * *Active Customers*
   * *Suspended Customers*
   * *Archived Customers*
2. **Table Header & Column Dynamism**:
   * **Active View**: Customer ID, Full Name, Email Address, Phone, Registered, Last Login, Bookings, Total Spend, Status, Action.
   * **Archived Customers View (Requirement 14)**: Customer ID, Full Name, Email, Phone, Registered Date, Archived Date, Archived By, Archive Reason, Bookings, Total Spend, Status, Action.
3. **Three-Dot Action Menu (⋮)**:
   * Active Customer: `View Dossier`, `Archive Customer`.
   * Archived Customer: `View Dossier`, `Restore Customer`.
   * Context-aware: Archive and Restore are never displayed simultaneously when inappropriate.
4. **Archive Customer Modal**:
   * Displays customer identifier banner.
   * Clarifies data preservation policy.
   * Structured reason selector with custom reason support.
   * Optional Admin internal notes textarea.
5. **Restore Customer Modal**:
   * Confirmation dialog detailing account reactivation while affirming historical continuity.

### Customer Dossier Modal (`artifacts/zelevos/src/components/admin-user-dossier-modal.tsx`)
1. **Header**: Prominent `ARCHIVED` rose badge and contextual `Restore Customer` / `Archive Customer` quick action button.
2. **Archival Context Banner**: Overview tab shows an alert banner with:
   * Archived On (formatted timestamp)
   * Archived By (resolved Admin ID/Name)
   * Archive Reason
   * Admin Internal Note (if present)
   * Safety reassurance notice confirming historical bookings and finances are fully retained.
3. **Integrated Action Modals**: Admins can archive or restore directly from within the dossier without having to return to the list.

---

## 12. Final Customer Archive & Restore Flow

```text
ACTIVE CUSTOMER
      ↓
ADMIN → ARCHIVE
      ↓
CONFIRMATION
      ↓
REASON + OPTIONAL NOTE
      ↓
SERVER VALIDATION
      ↓
STATUS = ARCHIVED
      ↓
AUDIT LOG
      ↓
HIDDEN FROM ACTIVE LIST
      ↓
DATABASE RECORD PRESERVED
      ↓
HISTORY PRESERVED
      ↓
ARCHIVED CUSTOMERS
      ↓
VIEW DOSSIER
      ↓
RESTORE
      ↓
STATUS = ACTIVE
```

---

## 13. Verification Results

### Static & Code-Level Verification:
* **TypeScript Typecheck (`pnpm run typecheck`)**:
  * Scanned 4 workspace packages (`@workspace/api-server`, `@workspace/zelevos`, `@workspace/mockup-sandbox`, `scripts`).
  * **Result: 0 errors (PASSED)**.
* **Production Build (`pnpm run build`)**:
  * Bundled API server backend (`dist/index.mjs`).
  * Bundled Zelevos client frontend (`dist/public/assets/`).
  * Bundled Mockup sandbox (`dist/assets/`).
  * **Result: Exit code 0 (PASSED)**.
* **Targeted Automated Integration Tests (`customer-archive.test.ts`)**:
  * 11 comprehensive test cases:
    1. `✔ enforces admin authentication on archive and restore endpoints (RBAC/IDOR)`
    2. `✔ verifies active customer appears in default active customer list`
    3. `✔ validates archive reason input (rejects empty or too short reasons)`
    4. `✔ archives customer without deleting customer or history (soft delete)`
    5. `✔ prevents archiving an already archived customer`
    6. `✔ hides archived customer from default active list, shows in archived view`
    7. `✔ rejects login for archived customer with safe message`
    8. `✔ allows authorized Admin to access complete historical dossier of archived customer`
    9. `✔ restores customer to active status while preserving permanent Customer ID and history`
    10. `✔ allows restored customer to authenticate again`
    11. `✔ verifies audit log entries were recorded for both archive and restore`
  * **Result: 11 passed, 0 failed, 0 cancelled (PASSED)**.

### Browser Status:
* **NOT RUN — per user instruction.**
