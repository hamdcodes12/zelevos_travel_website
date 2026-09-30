# Product Requirements Document (PRD) — Wayora / Zelevos V1

**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Status:** ACTIVE / AUTHORITATIVE FOR CURRENT V1  
**Source of Truth:** `Wayora_PRD_Without_APIs`  
**Brand Identity:** Zelevos (formerly Wayora)  
**Core Target Market:** India  

---

## 1. Executive Summary & Vision

Zelevos is an online travel platform that enables travelers to discover, purchase, and manage complete multi-day travel packages from a single consolidated interface **without relying on direct external travel supplier APIs** in V1. 

### 1.1 Product Vision
> *"Tell Zelevos where you want to go. We'll figure out the rest."*

Unlike speculative AI travel platforms or open-inventory metasearch engines, Zelevos V1 operates on a **curated marketplace model with human-in-the-loop manual supplier fulfillment**. Travelers select handcrafted holiday itineraries, customize basic parameters (dates, travellers, room configurations, and optional flight assistance), pay Zelevos securely, and receive a single consolidated digital itinerary. Behind the scenes, the Zelevos operations team coordinates with contracted local Destination Management Companies (DMCs), hoteliers, and transport operators through structured workflows, strict SLAs, and a dedicated Vendor Portal.

### 1.2 Core Value Proposition
- **One Booking, Entire Journey:** Hotels, transfers, activities, guided sightseeing, and manual flight booking assistance consolidated under a single master reference (`ZL{YYMMDD}{seq}`).
- **100% Curated & Vetted:** Every itinerary is designed and validated by destination specialists and contracted regional suppliers.
- **Dedicated 24/7 Operations Support:** Real-time ground operations assistance managing exceptions, confirmations, and traveler inquiries.
- **Transparent Inclusions:** Clear, plain-English breakdown of what is included and excluded with zero hidden surprise fees.
- **Trip Confidence Score:** An objective, data-backed 0–100% reliability rating displayed on every package and booking, dynamically calculated from real supplier performance metrics.

---

## 2. Product Objectives

1. **Zero External Travel Supplier API Dependency:** Deliver a completely operational travel e-commerce marketplace independent of volatile third-party travel APIs (e.g., Duffel, Hotelbeds, Ignav, Travelpayouts).
2. **Complete Package E-Commerce:** Enable end-to-end online package discovery, configuration, checkout, and payment processing via Razorpay.
3. **Master-to-Child Fulfillment State Machine:** Automatically decompose customer orders into component service tasks (hotels, transfers, activities, flights) with dynamic SLA timers upon payment capture.
4. **Dedicated Operations Control Center:** Provide the operations team with a unified dashboard for task assignment, supplier queue management, manual flight PNR uploads, and customer communications.
5. **Vendor Collaboration Portal:** Enable contracted suppliers to receive booking requests, accept/reject within SLA limits, and upload vouchers/invoices directly.
6. **Customer Transparency & Self-Service:** Provide travelers with a live Section 11 booking timeline in "My Trips" and instant downloads of consolidated digital itineraries.
7. **B2B Authorised Partner Network:** Empower travel agents and affiliate partners to register, generate branded referral links, track bookings, and monitor commission ledgers.
8. **Operational Data Foundation:** Capture granular fulfillment timestamps, vendor response times, and margin variances to inform future automated integrations.

---

## 3. Scope Boundaries & Non-Goals for V1

To ensure rapid execution, zero architectural drift, and commercial viability, the following items are strictly **NON-GOALS** for V1:

- ❌ **No Direct Supplier APIs:** Zero live API integrations for flights, hotels, cabs, or activities.
- ❌ **No Global Dynamic Inventory:** No automated aggregation across hundreds of global supplier feeds.
- ❌ **No Instant Automated Airline Ticketing:** Flights requested at checkout are handled manually via the offline flight fulfillment desk; tickets are issued through B2B partner desks and uploaded manually.
- ❌ **No Open/Self-Publishing Vendor Marketplace:** Vendors cannot self-publish packages directly to the live customer storefront; all packages are curated and published by Zelevos administrators.
- ❌ **No Autonomous AI Booking or Dynamic Packaging:** AI is not permitted to generate speculative bookings or promise inventory outside the curated catalog. (AI features are **PARKED** for future phases).

---

## 4. User Roles & Permission Matrix

The platform implements strict Role-Based Access Control (RBAC) across 8 distinct user roles:

| Role | Target Audience | Core Platform Permissions |
| :--- | :--- | :--- |
| **Customer** | End travelers | Browse curated packages, search destinations, book packages, pay via Razorpay, track live booking progress in My Trips, download consolidated itineraries, request cancellations/refunds, submit "Build My Trip" custom requests. |
| **Admin (Super Admin)** | Platform founders & leadership | Full system access: manage users, configure operational SLAs, approve vendors, manage partner accounts, view platform-wide audit logs, manage 2FA settings, access all financial reports. |
| **Operations Manager** | Ops leadership & supervisors | Supervise all bookings and service tasks, reassign suppliers, handle escalated customer exceptions, manage SLA breach alerts, verify vendor confirmation documents. |
| **Booking Executive** | Ops ground staff & coordinators | Process individual service fulfillment tasks, dispatch supplier requests, communicate with DMCs, upload manual flight PNRs and e-tickets. |
| **Vendor** | Contracted DMCs, hoteliers, cab operators | Secure portal login, view assigned booking requests, accept/reject requests within SLA, upload confirmation numbers, vouchers, and tax invoices, review payable ledger. |
| **Finance** | Accounts & finance team | Monitor payment reconciliation, track supplier payables, review and approve refund requests, analyze gross booking values, supplier costs, and net margins. |
| **Support** | Customer care representatives | Read-only visibility into customer bookings, service statuses, customer notes, and issue ticket escalation. |
| **Partner / Agent** | Registered B2B travel agents & affiliates | Dedicated partner portal, unique referral links, manual lead creation, commission tracking, referral booking status monitoring. |

---

## 5. Business & Pricing Model

Zelevos operates on a **merchant/package margin model**:
1. **Net Supplier Negotiation:** Zelevos contracts services (hotel rooms, vehicle transfers, guided tours) from regional suppliers at wholesale net rates.
2. **Retail Packaging:** Zelevos packages these components into comprehensive holiday experiences with a transparent retail price.
3. **Pricing Architecture:**
   $$\text{Customer Price} = \text{Base Supplier Cost} + \text{Zelevos Markup} + \text{Service Fee} + \text{Applicable Taxes}$$
4. **Margin Tracking:**
   $$\text{Expected Margin} = \text{Selling Price} - \text{Expected Supplier Net Cost}$$
   $$\text{Actual Margin} = \text{Actual Customer Collections} - \text{Actual Supplier Invoices Settled} - \text{Partner Commissions}$$
5. **Partner Commissions:** A configurable percentage (default 5–10%) or fixed fee paid to Authorised Partners on completed trips attributed to their referral code.

---

## 6. End-to-End Customer Journey

```
[ Landing Page / Hero Search ]
            │
            ▼
[ Curated Package Discovery / Themes ]
            │
            ▼
[ Package Detail Page ] ──> Inspects Itinerary, Inclusions, Trip Confidence Score
            │
            ▼
[ Checkout Form ] ──> Dates, Travellers, Room Config, [x] Flight Required Assistance
            │
            ▼
[ Razorpay Online Payment ]
            │
            ▼
[ Master Booking Created: ZL{YYMMDD}{seq} ] ──> Initial Status: PAID
            │
            ▼
[ Background Fulfilment Engine ] ──> Creates Child Service Tasks (Hotel, Transfer, Activity, Flight)
            │
            ▼
[ Operations Dashboard ] ──> Assigns Tasks to Contracted Vendors with SLA Timers
            │
            ▼
[ Vendor Portal ] ──> Vendor Accepts Request & Uploads Confirmation Documents
            │
            ▼
[ Operations Verification Gate ] ──> Ops Validates Vouchers (Customer Status Still PROCESSING)
            │
            ▼
[ All Services Verified ] ──> Master Booking Transitions to CONFIRMED
            │
            ▼
[ Customer "My Trips" ] ──> Real-time Timeline Updated; Consolidated Digital Itinerary Issued
```

---

## 7. Website / Customer Application Specification

### 7.1 Homepage (Section 7.1)
- **Destination Search Hero:** Plain input field with prompt: *"Where do you want to go? (e.g. Kashmir, Ladakh, Kerala)"* with an active *"Search Packages"* button.
- **Popular Destination Quick-Pills:** Instant clickable pills (`Kashmir`, `Ladakh`, `Kerala`, `Rajasthan`, `Goa`, `Himachal`) that automatically filter the package catalog.
- **Featured Curated Tours:** Primary section directly below the hero showcasing multi-day holiday packages with transparent starting prices, duration badges, and Trip Confidence ratings.
- **Travel Themes Bar:** Filter pills allowing customers to filter packages by theme: `Honeymoon`, `Family`, `Adventure`, `Luxury`, `Budget`, `Weekend`, `Pilgrimage`.
- **"Why Zelevos" Value Pillars:**
  1. *One Booking, Entire Journey:* Stays, cabs, and sightseeing combined under one booking reference.
  2. *100% Curated Experiences:* Handcrafted itineraries vetted by regional travel specialists.
  3. *24/7 Dedicated Local Support:* Ground assistance and active operations coordination.
  4. *Transparent Inclusions:* Clear line items detailing exact inclusions with zero surprise surcharges.
- **Partner Call-to-Action:** Dedicated banner: *"Become a Zelevos Authorised Partner"* with a working modal to register agency details directly into the partner system.
- **Header Navigation:** Real links to `Home`, `Packages`, `Why Zelevos`, `Partner Program`, `Trips`, `Flights`, `Build My Trip`, `Support`, and `Admin`.

### 7.2 Destination Catalog Page (Section 7.2)
- Destination overview, best travel season, weather guidance, and cultural highlights.
- Curated packages filtered by destination with duration, pricing, and hotel tier filters.
- Frequently Asked Questions (FAQs) addressing regional travel requirements, permits, and baggage.

### 7.3 Package Detail Page (Section 7.3)
- High-resolution hero image gallery and package overview.
- Suitability badges (e.g., *Couples*, *Families*, *Adventure Seekers*).
- Day-by-day interactive itinerary accordions detailing morning, afternoon, and evening plans.
- Detailed breakdown of accommodation tiers, vehicle types, guided tours, and meal plans.
- Comprehensive checklists of **Inclusions** (green checkmarks) and **Exclusions** (red crosses).
- Cancellation and modification policies with transparent refund timelines.
- **Trip Confidence Score Widget:** Prominently displayed near the price, showing the 0–100% score with a breakdown of vendor acceptance rate, SLA speed, and completion history.
- CTAs: *"Book Now"* (triggers checkout flow) and *"Request Customization"* (triggers Build My Trip).

### 7.4 Checkout Flow (Section 7.4)
- Travel date selection and traveler counts (Adults, Children, Infants).
- Room requirement configuration (Single, Double, Extra Bed).
- Primary lead traveler contact details (Name, Email, Phone, City).
- Optional *"Flight Required"* assistance checkbox.
- Special requests and dietary requirements.
- Line-item price summary showing base price, taxes, discounts, and total payable amount.
- Secure payment integration via Razorpay modal.

### 7.5 Customer "My Trips" Portal (Section 14)
- Summary card displaying Master Booking ID (`ZL{YYMMDD}{seq}`).
- Real-time **Section 11 Lifecycle Timeline** showing step-by-step progress:
  - *Booking Created* -> *Payment Received* -> *Hotel Requested* -> *Hotel Confirmed* -> *Transfer Requested* -> *Transfer Confirmed* -> *Activity Confirmed* -> *Final Itinerary Issued*.
- Consolidated digital itinerary viewer with day-wise details and contact vouchers.
- Authenticated, signed 15-minute download links for hotel vouchers, cab driver slips, and flight e-tickets.
- Booking cancellation and modification request button with automatic penalty computation.

---

## 8. Tour & Package Management System (Admin CRUD)

Administrators manage packages with zero external API dependencies. Every package requires:
- **Package ID:** Unique internal identifier (UUID).
- **Title & Slug:** SEO-friendly name and URL slug.
- **Destination:** Country, State, City, and regional coverage tags.
- **Duration:** Days and Nights count.
- **Theme:** Family, Honeymoon, Luxury, Adventure, Budget, Weekend, Pilgrimage.
- **Commercial Financials:** Base Net Supplier Cost, Markup (% or fixed ₹), Selling Price.
- **Inventory Control:** Maximum sellable seats/rooms per departure date.
- **Day-by-Day Itinerary:** Day number, title, detailed narrative, meal plan, stay location.
- **Component Service Mapping:** Associated hotel tiers, vehicle categories, and included activities.
- **Policies:** Explicit cancellation rules, child policies, and payment milestone rules.
- **Media Gallery:** Image URLs, captions, and featured thumbnail.
- **Lifecycle Status:** `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`.

---

## 9. Vendor Management System

A comprehensive backoffice subsystem for contracting and tracking local suppliers:
- **Vendor Profiles:** Business name, registration/GSTIN, KYC documents, primary contacts, and operating territories.
- **Service Categories:** Accommodations (Hotels/Resorts), Transports (Cabs/Tempo Travellers), Activities, Guides, DMCs.
- **Commercial Contracts:** Agreed net rates, blackout dates, and payment settlement terms.
- **Vendor Portal:** Dedicated login interface (`/vendor/login`) providing:
  - Booking Request Inbox with incoming order details and component requirements.
  - One-click *Accept* or *Reject* actions governed by SLA timers.
  - Document upload facility for hotel confirmation vouchers, transport dispatch slips, and tax invoices.
- **Performance Tracking & Analytics:** Real-time tracking of:
  - **Acceptance Rate (%):** Proportion of requests accepted.
  - **Average Response Time (Minutes):** Time taken to respond to new requests.
  - **Cancellation Rate (%):** Supplier-initiated cancellations.
  - These metrics feed directly into the **Trip Confidence Score** calculation.

---

## 10. Centralized Booking Engine

### 10.1 Identifier Architecture
Every customer order generates a standardized Master Booking ID:
$$\text{Booking ID} = \text{ZL} + \text{YYMMDD} + \text{4-Digit Sequence} \quad (\text{e.g., } \text{ZL2609190001})$$

### 10.2 Master-to-Child Entity Decomposition
Upon payment, the master booking decomposes into independent `booking_services` child records:
- $\text{ZL2609190001} \rightarrow \text{Hotel Service Task (Assigned to Hotel Vendor)}$
- $\text{ZL2609190001} \rightarrow \text{Transfer Service Task (Assigned to Cab Vendor)}$
- $\text{ZL2609190001} \rightarrow \text{Sightseeing Service Task (Assigned to Activity Vendor)}$
- $\text{ZL2609190001} \rightarrow \text{Flight Fulfillment Desk Task (Assigned to Ops Flight Desk)}$

### 10.3 Master Booking Lifecycle State Machine
```
[ PAYMENT_PENDING ] ──(Payment Captured)──> [ PAID ]
                                               │
                                       (Tasks Created)
                                               │
                                               ▼
[ ACTION_REQUIRED ] <──(Exception)─── [ PROCESSING ]
        │                                      │
        │                            (Components Confirming)
        │                                      │
        ▼                                      ▼
[ CANCEL_REQUESTED ] ─────────────> [ PARTIALLY_CONFIRMED ]
        │                                      │
        │                             (All Tasks Verified)
        ▼                                      │
  [ CANCELLED ]                                ▼
        │                                [ CONFIRMED ]
(Refund Initiated)
        │
        ▼
[ REFUND_PENDING ] ──(Settled)──> [ REFUNDED ]
```

---

## 11. Operations Dashboard

A real-time command center for the operations team:
- **KPI Metrics Strip:** Today's New Bookings, Bookings Awaiting Supplier Confirmation, Bookings Approaching SLA Deadlines, Partially Confirmed Trips, Payment Exceptions, Active Cancellation/Refund Cases.
- **Task Assignment Queue:** Interactive list of unassigned fulfillment tasks with quick-assign vendor dropdowns and SLA countdown timers.
- **Literal Booking Timeline:** Interactive visual timeline tracking each component state:
  $$\text{Created} \rightarrow \text{Paid} \rightarrow \text{Requested} \rightarrow \text{Supplier Confirmed} \rightarrow \text{Ops Verified} \rightarrow \text{Final Itinerary Issued}$$
- **Verification Gate:** Operations staff review uploaded vendor vouchers and verify confirmation numbers. **Customer status does not update to confirmed until operations explicitly verifies.**

---

## 12. Flight Handling Without Supplier APIs

Zelevos eliminates brittle airline GDS/Duffel integrations while fulfilling traveler demand for flight packages:
1. Customer checks *"Flight Required"* at checkout and specifies origin airport and baggage needs.
2. The booking engine creates a specialized flight service task assigned to the internal **Flight Fulfillment Desk**.
3. The booking displays under My Trips with the explicit status notice: **"Flight arrangement requested — Subject to confirmation"**.
4. Operations staff book the flight through contracted B2B consolidators, corporate portals, or direct airline desks.
5. Staff enter the airline PNR, flight number, departure times, and upload the official airline PDF ticket into the booking record.
6. The booking updates immediately in the customer portal, replacing the notice with confirmed flight details and ticket download links.

---

## 13. Payments & Financial Reconciliation

- **Payment Gateway:** Razorpay integrated for UPI, credit/debit cards, and netbanking.
- **Live Signature Verification:** Server-side HMAC-SHA256 signature verification preventing payment forgery.
- **Supplier Payables Ledger:** Automatic calculation of payables upon task verification.
- **Margin Engine:** Continuous comparison of expected markup vs. actual settled invoices.
- **Refund Management:** Multi-step refund workflow (`REQUESTED` $\rightarrow$ `APPROVED` $\rightarrow$ `PROCESSING` $\rightarrow$ `PROCESSED`) with reason logging in `refundsTable`.
- **Financial Reporting:** Real-time dashboards summarizing Gross Bookings Value (GBV), Net Revenue, Supplier Costs, Gross Margins, and Partner Commission Liabilities.

---

## 14. Authorised Partner Program (B2B Affiliate)

- Self-service partner registration modal and dedicated partner dashboard.
- Partner approval and automated assignment of unique referral codes (e.g., `ZELAPEXTR40`).
- Seamless referral tracking: bookings created using a partner code or link automatically attribute to the partner.
- Commission Ledger: Real-time calculation of payable commissions based on package eligibility.
- Commission settlement tracking linked to completed trip dates.

---

## 15. Notifications System

Comprehensive multi-channel notification dispatcher supporting 10 mandatory lifecycle events:
1. `BOOKING_RECEIVED`: Instant confirmation of order placement.
2. `PAYMENT_SUCCESSFUL`: Receipt and transaction confirmation.
3. `BOOKING_UNDER_CONFIRMATION`: Notice that operations has initiated supplier fulfillment.
4. `SUPPLIER_CONFIRMATION_RECEIVED`: Individual component confirmation update.
5. `ACTION_REQUIRED`: Customer notification for passport details, preferences, or payment issues.
6. `TRIP_CONFIRMED`: Master booking confirmation and digital itinerary link.
7. `VOUCHERS_AVAILABLE`: Downloadable hotel and transfer vouchers ready.
8. `UPCOMING_TRIP_REMINDER`: Pre-trip preparation guidelines dispatched 48h prior to departure.
9. `REFUND_UPDATE`: Status updates on cancellation and refund disbursement.
10. `SLA_BREACH_ALERT`: Internal high-priority ops alert for overdue vendor tasks.

*Channel Status:* Email active via verified SMTP/Resend. WhatsApp/SMS channels are architecturally defined behind a standard interface and explicitly labeled **"coming soon"** in logs until SMS gateway contracts are finalized.

---

## 16. Custom Trip Requests ("Build My Trip")

A dedicated concierge workflow for non-standard holiday requests:
- Customer submits destination, travel window, traveler counts, budget range, accommodation preferences, and special requirements.
- Generates an internal lead record in `custom_trip_requests`.
- Operations staff review the lead, assemble a tailored package, and submit a formal proposal with a custom pricing link.
- Customer receives an email proposal with a one-click checkout link.

---

## 17. Operational SLAs (Configurable)

Operational SLAs are stored in the database (`sla_settings`) and editable by administrators:
- **New Booking Acknowledgement:** Immediate / Automated (< 1 minute).
- **Initial Supplier Request Dispatch:** Within 15 minutes of payment capture during operating hours.
- **Standard Supplier Response SLA:** Within 2 hours.
- **Final Itinerary Issuance:** Within 24 hours of full supplier confirmation.
- **Customer Support Initial Response:** Within 15 minutes.
- **Refund Processing Window:** Within 48 hours of cancellation approval.

---

## 18. Step 3 Enhancement: Trip Confidence Score

To build customer trust without live APIs, Zelevos displays a dynamic **Trip Confidence Score (0–100%)** on every package and booking detail view:
- **Formula:**
  $$\text{Score} = \text{round}\left( \text{AcceptanceRate} \times 0.40 + \max\left(0, 100 - \frac{\text{AvgResponseMinutes}}{\text{SlaMinutes}} \times 30\right) \times 0.35 + (100 - \text{CancellationRate}) \times 0.25 \right)$$
- **Score Categorization:**
  - **$\ge 80\%$:** *High Confidence* (green badge) — High supplier reliability, instant fulfillment history.
  - **$60\% - 79\%$:** *Moderate Confidence* (amber badge) — Standard turnaround, dependable delivery.
  - **$< 60\%$:** *Needs Review* (blue/gray badge) — Complex customized logistics requiring manual ops oversight.

---

## 19. Security & Compliance Requirements

1. **Authentication & Session Management:** Secure bcrypt password hashing, HTTP-only session cookies (`zelevos_session`), CSRF protection, and automatic session expiration.
2. **Two-Factor Authentication (2FA):** Mandatory TOTP-based two-factor authentication for Admin, Operations, and Finance roles.
3. **Short-Lived Signed Document URLs:** Vouchers, invoices, and tickets are strictly protected from public access; served exclusively via HMAC-SHA256 signed URLs with 15-minute validity (`/api/documents/signed-view?token=...`).
4. **Rate Limiting & Brute Force Protection:** In-memory sliding-window limiters enforcing 10 attempts/15 min on auth, 5 attempts/15 min on 2FA, and 200 requests/min on general APIs.
5. **Immutable Audit Trail:** Mandatory logging of every state-changing, booking-altering, and financial action in `audit_logs` recording timestamp, actor ID, action type, and payload diffs.
6. **Automated Database Backups:** Automated database backup script (`scripts/backup-database.ts`) generating timestamped snapshots.

---

## 20. Parked AI Architecture (Future Reference)

The legacy "AI Travel OS" prototype components are officially **PARKED** and isolated outside the active V1 customer journey:
- `artifacts/zelevos/src/components/parked/copilot.tsx`: Legacy conversational chat widget.
- `artifacts/zelevos/src/components/parked/marketplace.tsx`: Legacy AI prompt card marketplace.
- `artifacts/zelevos/src/components/travel-hub.tsx`: Legacy prototype hub.
- `artifacts/api-server/src/services/gemini.ts`: Internal Gemini service client.
- `artifacts/api-server/src/routes/ai.ts`: Internal AI routes.

*Rule:* Parked AI components must never interfere with active V1 booking, package, checkout, operations, vendor, finance, partner, or My Trips flows.
