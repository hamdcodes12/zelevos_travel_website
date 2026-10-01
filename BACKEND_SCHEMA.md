# Backend Relational Schema & State Machines (BACKEND_SCHEMA.md) — Wayora / Zelevos V1

**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Status:** ACTIVE / AUTHORITATIVE FOR CURRENT V1  
**ORM:** Drizzle ORM (`drizzle-orm` v0.45.1)  
**Dual Database Compatibility:** Embedded PGlite (Local / Tests) & PostgreSQL (Production)  

---

## 1. Database Architecture & Design Principles

The Zelevos database layer is implemented in `lib/db/src/schema/` using Drizzle ORM. The relational model enforces:
1. **Strict Relational Normalization:** Individual tables for separate domain concepts (`hotels`, `transfers`, `activities`, `services`, `bookings`, `booking_services`, `payments`, `refunds`).
2. **Deterministic Foreign Keys:** Cascading deletes on user sessions; restrictive or set-null constraints on primary commercial entities to preserve financial audit trails.
3. **Dual Identification:** UUID primary keys (`id`) for internal indexing combined with human-readable, sequence-based master booking references (`booking_id` format: `ZL{YYMMDD}{seq}`).
4. **Audit Trail Immutability:** Sensitive financial and booking status mutations trigger immutable records in `audit_logs`.

---

## 2. Complete Entity-Relationship Overview

```
                        ┌──────────────┐
                        │  auth.users  │
                        └──────┬───────┘
                               │ 1:N
           ┌───────────────────┼───────────────────┐
           │ 1:1               │ 1:N               │ 1:N
           ▼                   ▼                   ▼
    ┌─────────────┐    ┌───────────────┐    ┌──────────────┐
    │  customers  │    │   bookings    │    │  audit_logs  │
    └─────────────┘    └───────┬───────┘    └──────────────┘
                               │ 1:N
        ┌──────────────────────┼──────────────────────┐
        │ 1:N                  │ 1:N                  │ 1:N
        ▼                      ▼                      ▼
┌────────────────┐     ┌──────────────┐       ┌───────────────┐
│booking_services│     │  travellers  │       │   payments    │
└───────┬────────┘     └──────────────┘       └───────┬───────┘
        │                                             │ 1:1
        │ N:1                                         ▼
        ▼                                     ┌───────────────┐
┌────────────────┐                            │    refunds    │
│    vendors     │                            └───────────────┘
└───────┬────────┘
        │ 1:N
        ▼
┌────────────────┐
│   vouchers     │
└────────────────┘
```

---

## 3. Relational Table Specifications

### 3.1 Authentication & User Access (`lib/db/src/schema/auth.ts`)

#### `users` (Customer and General User Accounts)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `email` (Text, Unique, Not Null)
- `password_hash` (Text, Not Null)
- `full_name` (Text, Not Null)
- `phone` (Text, Nullable)
- `role` (Text, Not Null, Default `"customer"`) — `customer`, `vendor`, `partner`, `booking_executive`, `ops_manager`, `finance`, `support`, `admin`
- `is_email_verified` (Boolean, Default `false`)
- `created_at` (Timestamp with timezone, Default `now()`)
- `updated_at` (Timestamp with timezone, Default `now()`)

#### `admin_users` (Administrative & Operations Team)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `email` (Text, Unique, Not Null)
- `password_hash` (Text, Not Null)
- `full_name` (Text, Not Null)
- `role` (Text, Not Null, Default `"admin"`) — `super_admin`, `admin`, `ops_manager`, `booking_executive`, `finance`, `support`, `content_manager`
- `totp_secret` (Text, Nullable) — Encrypted base32 secret for 2FA
- `totp_enabled` (Boolean, Default `false`)
- `created_at` (Timestamp, Default `now()`)

---

### 3.2 Inventory & Package Catalog (`lib/db/src/schema/inventory.ts`)

#### `destinations` (Regional Catalog)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `name` (Text, Not Null) — e.g. "Kashmir", "Ladakh", "Kerala"
- `slug` (Text, Unique, Not Null) — e.g. "kashmir", "ladakh"
- `country` (Text, Default `"India"`)
- `state` (Text, Nullable)
- `overview` (Text, Not Null)
- `best_time_to_visit` (Text, Nullable)
- `hero_image_url` (Text, Nullable)
- `faq_list` (JSONB, Default `[]`) — Array of `{ question, answer }`
- `created_at` (Timestamp, Default `now()`)

#### `packages` (Curated Holiday Packages)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `title` (Text, Not Null) — e.g. "Kashmir Enchantment: Lakes, Pines & Peaks"
- `slug` (Text, Unique, Not Null)
- `destination_id` (UUID, Foreign Key $\rightarrow$ `destinations.id`)
- `duration_days` (Integer, Not Null)
- `duration_nights` (Integer, Not Null)
- `theme` (Text, Not Null) — `honeymoon`, `family`, `adventure`, `luxury`, `budget`, `weekend`, `pilgrimage`
- `suitability` (JSONB, Default `[]`) — e.g. `["couples", "families"]`
- `base_supplier_cost` (Integer, Not Null) — Total expected wholesale supplier cost in paise or ₹
- `selling_price` (Integer, Not Null) — Retail customer starting price
- `markup_amount` (Integer, Not Null)
- `max_inventory` (Integer, Default `50`)
- `inclusions` (JSONB, Default `[]`) — Array of included item strings
- `exclusions` (JSONB, Default `[]`) — Array of excluded item strings
- `policies` (JSONB, Default `{}`) — Cancellation rules, payment terms
- `trip_confidence_score` (Integer, Default `90`) — Dynamic score (0–100)
- `status` (Text, Not Null, Default `"ACTIVE"`) — `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`
- `hero_image_url` (Text, Nullable)
- `gallery_urls` (JSONB, Default `[]`)
- `created_at` (Timestamp, Default `now()`)

#### `package_days` (Day-by-Day Itineraries)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `package_id` (UUID, Foreign Key $\rightarrow$ `packages.id`, On Delete Cascade)
- `day_number` (Integer, Not Null)
- `title` (Text, Not Null) — e.g. "Arrival in Srinagar & Dal Lake Shikara Ride"
- `narrative` (Text, Not Null)
- `stay_location` (Text, Nullable) — e.g. "Srinagar (Deluxe Houseboat)"
- `meals_included` (JSONB, Default `[]`) — e.g. `["Breakfast", "Dinner"]`
- `activities` (JSONB, Default `[]`)

#### `hotels`, `transfers`, `activities`, `services` (Normalized Catalog Components)
- `hotels`: `id`, `name`, `destination_id`, `star_rating`, `room_type`, `base_net_rate`, `contact_phone`, `location`
- `transfers`: `id`, `vehicle_type`, `capacity`, `destination_id`, `base_net_rate`, `operator_name`
- `activities`: `id`, `title`, `destination_id`, `duration_hours`, `base_net_rate`, `guide_included`
- `services`: Umbrella catalogue table polymorphic over `service_type` (`hotel`, `transfer`, `activity`, `guide`, `flight_partner`)

---

### 3.3 Bookings & Service Decomposition (`lib/db/src/schema/bookings.ts`)

#### `bookings` (Master Customer Orders)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `booking_id` (Text, Unique, Not Null) — Master Reference: `ZL{YYMMDD}{seq}` (e.g. `ZL2609190001`)
- `customer_id` (UUID, Foreign Key $\rightarrow$ `users.id`, On Delete Cascade)
- `package_id` (UUID, Foreign Key $\rightarrow$ `packages.id`, On Delete Set Null)
- `partner_id` (UUID, Foreign Key $\rightarrow$ `partners.id`, Nullable)
- `status` (Text, Not Null, Default `"PAYMENT_PENDING"`) — See Section 4.1 for State Machine
- `travel_date` (Text, Not Null) — YYYY-MM-DD
- `adults_count` (Integer, Not Null, Default `1`)
- `children_count` (Integer, Default `0`)
- `infants_count` (Integer, Default `0`)
- `rooms_count` (Integer, Default `1`)
- `room_configuration` (JSONB, Default `[]`)
- `selected_addons` (JSONB, Default `[]`)
- `special_requests` (Text, Nullable)
- `flight_required` (Boolean, Not Null, Default `false`)
- `flight_requirement_details` (JSONB, Nullable) — `{ preferredRoute, preferredDates, passengerNames, baggageRequirements }`
- `flight_pnr` (Text, Nullable) — Manual airline PNR uploaded by operations
- `flight_ticket_url` (Text, Nullable) — Private storage URL for airline e-ticket
- `total_price` (Integer, Not Null) — Customer price in ₹
- `base_supplier_cost` (Integer, Not Null, Default `0`)
- `markup_amount` (Integer, Not Null, Default `0`)
- `tax_amount` (Integer, Not Null, Default `0`)
- `refund_amount` (Integer, Not Null, Default `0`)
- `trip_confidence_score` (Integer, Default `90`)
- `email_sent_at` (Timestamp, Nullable)
- `email_error` (Text, Nullable)
- `created_at` (Timestamp, Default `now()`)
- `updated_at` (Timestamp, Default `now()`)

#### `booking_services` (Child Component Fulfillment Tasks)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `booking_id` (UUID, Foreign Key $\rightarrow$ `bookings.id`, On Delete Cascade)
- `service_type` (Text, Not Null) — `hotel`, `transfer`, `activity`, `guide`, `flight_desk`
- `assigned_vendor_id` (UUID, Foreign Key $\rightarrow$ `vendors.id`, Nullable)
- `status` (Text, Not Null, Default `"PENDING"`) — See Section 4.2 for Task State Machine
- `deadline` (Timestamp, Nullable) — Dynamic SLA timer calculated from `sla_settings`
- `supplier_confirmation_code` (Text, Nullable) — Vendor's internal reference
- `voucher_id` (UUID, Foreign Key $\rightarrow$ `vouchers.id`, Nullable)
- `supplier_cost` (Integer, Not Null, Default `0`)
- `notes` (Text, Nullable)
- `created_at` (Timestamp, Default `now()`)
- `updated_at` (Timestamp, Default `now()`)

#### `travellers` (`lib/db/src/schema/traveller.ts`)
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `booking_id` (UUID, Foreign Key $\rightarrow$ `bookings.id`, On Delete Cascade)
- `first_name` (Text, Not Null)
- `last_name` (Text, Not Null)
- `age` (Integer, Not Null)
- `gender` (Text, Not Null)
- `is_lead` (Boolean, Default `false`)

---

### 3.4 Vendors, KYC & Vouchers (`lib/db/src/schema/vendors.ts`)

#### `vendors`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, Foreign Key $\rightarrow$ `users.id`, Unique) — Dedicated login credentials
- `business_name` (Text, Not Null)
- `contact_name` (Text, Not Null)
- `email` (Text, Unique, Not Null)
- `phone` (Text, Not Null)
- `service_category` (Text, Not Null) — `DMC`, `HOTEL`, `TRANSPORT`, `ACTIVITY`
- `operating_regions` (JSONB, Default `[]`)
- `acceptance_rate` (Integer, Default `100`) — Percent (0–100)
- `avg_response_minutes` (Integer, Default `30`) — Operational turnaround
- `cancellation_rate` (Integer, Default `0`) — Percent (0–100)
- `is_approved` (Boolean, Default `false`)
- `created_at` (Timestamp, Default `now()`)

#### `vouchers`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `booking_id` (UUID, Foreign Key $\rightarrow$ `bookings.id`)
- `vendor_id` (UUID, Foreign Key $\rightarrow$ `vendors.id`)
- `document_type` (Text, Not Null) — `HOTEL_VOUCHER`, `CAB_SLIP`, `ACTIVITY_PASS`, `AIRLINE_TICKET`
- `file_path` (Text, Not Null) — Non-public private file reference
- `confirmation_reference` (Text, Not Null)
- `created_at` (Timestamp, Default `now()`)

---

### 3.5 Payments & Financial Ledger (`lib/db/src/schema/finance.ts`)

#### `payments`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `booking_id` (UUID, Foreign Key $\rightarrow$ `bookings.id`, On Delete Cascade)
- `razorpay_order_id` (Text, Unique, Not Null)
- `razorpay_payment_id` (Text, Unique, Nullable)
- `razorpay_signature` (Text, Nullable)
- `amount` (Integer, Not Null) — In ₹
- `currency` (Text, Default `"INR"`)
- `status` (Text, Not Null, Default `"INITIATED"`) — `INITIATED`, `SUCCESSFUL`, `FAILED`, `REFUNDED`
- `created_at` (Timestamp, Default `now()`)

#### `refunds`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `booking_id` (UUID, Foreign Key $\rightarrow$ `bookings.id`, On Delete Cascade)
- `payment_id` (UUID, Foreign Key $\rightarrow$ `payments.id`, Nullable)
- `amount` (Integer, Not Null)
- `reason` (Text, Not Null)
- `status` (Text, Not Null, Default `"REQUESTED"`) — `REQUESTED`, `APPROVED`, `PROCESSING`, `PROCESSED`, `REJECTED`
- `approved_by` (UUID, Foreign Key $\rightarrow$ `admin_users.id`, Nullable)
- `processed_at` (Timestamp, Nullable)
- `created_at` (Timestamp, Default `now()`)

---

### 3.6 Partners & Commissions (`lib/db/src/schema/partners.ts`)

#### `partners`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, Foreign Key $\rightarrow$ `users.id`, Nullable)
- `agency_name` (Text, Not Null)
- `contact_person` (Text, Not Null)
- `email` (Text, Unique, Not Null)
- `phone` (Text, Not Null)
- `referral_code` (Text, Unique, Not Null) — e.g. `ZELAPEXTR40`
- `commission_rate` (Integer, Default `5`) — Percent (5%)
- `status` (Text, Default `"ACTIVE"`) — `PENDING`, `ACTIVE`, `SUSPENDED`
- `created_at` (Timestamp, Default `now()`)

#### `commissions`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `partner_id` (UUID, Foreign Key $\rightarrow$ `partners.id`, On Delete Cascade)
- `booking_id` (UUID, Foreign Key $\rightarrow$ `bookings.id`, On Delete Cascade)
- `amount` (Integer, Not Null)
- `status` (Text, Default `"ACCRUED"`) — `ACCRUED`, `SETTLED`, `CANCELLED`
- `settled_at` (Timestamp, Nullable)
- `created_at` (Timestamp, Default `now()`)

---

### 3.7 Operations, SLAs & Platform Audit (`lib/db/src/schema/operations.ts`, `platform.ts`)

#### `sla_settings`
- `key` (Text, Primary Key) — e.g. `standard_supplier_confirmation`
- `title` (Text, Not Null)
- `duration_minutes` (Integer, Not Null) — Dynamic SLA limit in minutes
- `updated_by` (UUID, Nullable)
- `updated_at` (Timestamp, Default `now()`)

#### `custom_trip_requests`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `destination` (Text, Not Null)
- `travel_dates` (Text, Not Null)
- `duration_days` (Integer, Default `5`)
- `travellers_count` (Integer, Default `2`)
- `budget_range` (Text, Not Null)
- `preferences` (JSONB, Default `{}`)
- `contact_email` (Text, Not Null)
- `contact_phone` (Text, Not Null)
- `status` (Text, Default `"LEAD_SUBMITTED"`) — `LEAD_SUBMITTED`, `PROPOSAL_SENT`, `BOOKED`, `CLOSED`
- `created_at` (Timestamp, Default `now()`)

#### `audit_logs`
- `id` (UUID, Primary Key, default `gen_random_uuid()`)
- `user_id` (UUID, Nullable)
- `action` (Text, Not Null) — e.g. `BOOKING_CREATED`, `PAYMENT_CAPTURED`, `TASK_VERIFIED`
- `resource_type` (Text, Not Null) — `booking`, `payment`, `refund`, `sla`
- `resource_id` (Text, Not Null)
- `payload` (JSONB, Default `{}`)
- `created_at` (Timestamp, Default `now()`)

---

## 4. State Machines & Lifecycle Enums

### 4.1 Master Booking Lifecycle (`BOOKING_STATUSES`)

```
[ PAYMENT_PENDING ]
        │
(Razorpay Signature Verified)
        │
        ▼
     [ PAID ] 
        │
(Auto-generate Child Fulfillment Tasks)
        │
        ▼
  [ PROCESSING ] <──────────────────────────────────────┐
        │                                               │
(First Component Confirmed)                             │ (Operations
        │                                               │  Reassignment)
        ▼                                               │
[ PARTIALLY_CONFIRMED ]                                 │
        │                                               │
(All Mandatory Component Tasks VERIFIED by Ops)         │
        │                                               │
        ▼                                               │
   [ CONFIRMED ]                                        │
        │                                               │
        │ (Customer Request)                            │
        ▼                                               │
[ CANCEL_REQUESTED ] ──(Exception Review)───────────────┤
        │                                               │
        ▼ (Refund Approved)                             ▼
  [ CANCELLED ]                                [ ACTION_REQUIRED ]
        │
        ▼
[ REFUND_PENDING ] ──(Disbursed)──> [ REFUNDED ]
```

### 4.2 Component Service Task Lifecycle (`SERVICE_TASK_STATUSES`)

```
[ PENDING ] ──(Ops Assigns Supplier)──> [ ASSIGNED ] ──(Notification Sent)──> [ REQUESTED ]
                                                                                   │
                   ┌───────────────────────────────────────────────────────────────┴───────────────┐
                   ▼ (Vendor Declines / SLA Breached)                                              ▼ (Vendor Accepts)
             [ REJECTED ]                                                                     [ ACCEPTED ]
                   │                                                                               │
           (Ops Reassigns)                                                                 (Vendor Uploads Voucher)
                   │                                                                               │
                   ▼                                                                               ▼
              [ ASSIGNED ]                                                           [ VERIFIED (Ops Review Gate) ]
                                                                                                   │
                                                                                                   ▼
                                                                                             [ CONFIRMED ]
```

---

## 5. Parked AI Database Entities (Future Reference)

The following database entity is **PARKED** and excluded from the active V1 customer marketplace:

#### `generated_trips` (`lib/db/src/schema/generated-trips.ts`) — **PARKED**
- Stores speculative AI-generated itineraries from natural language prompt sessions.
- Excluded from V1 checkout, payments, and operations fulfillment. Preserved exclusively for future AI Travel OS phases.
