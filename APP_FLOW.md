# Application Flow & User Journeys (APP_FLOW.md) — Wayora / Zelevos V1

**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Status:** ACTIVE / AUTHORITATIVE FOR CURRENT V1  
**Rule:** ZERO-DUMMY RULE — Every button, modal, form submission, and link across all user roles must execute a real backend-backed action resulting in validated state transitions.

---

## Overview of User Roles & Portals

| Role | Access URL | Primary Objective |
| :--- | :--- | :--- |
| **Customer** | `/`, `/packages`, `/trips` | Discover curated tours, customize parameters, pay online, track live fulfillment progress, and download itineraries. |
| **Admin** | `/admin`, `/admin/packages`, `/admin/sla` | Overall platform governance, package CRUD, SLA configuration, vendor onboarding, and audit inspection. |
| **Operations** | `/admin/operations`, `/admin/tasks` | Fulfill booking components, assign tasks to local suppliers, upload manual flight PNRs, and verify vouchers. |
| **Vendor** | `/vendor/login`, `/vendor/portal` | Review incoming component booking requests, accept/reject within SLA, and upload vouchers/invoices. |
| **Finance** | `/admin/finance`, `/admin/refunds` | Reconcile collections, track supplier payables, monitor gross margins, and approve customer refunds. |
| **Partner** | `/partner/login`, `/partner/portal` | Generate unique referral links, track referred customer bookings, and monitor payable commissions. |

---

## 1. Customer User Journeys

### Flow C1: Destination Search & Popular Discovery
1. **Page:** Homepage (`/`)
2. **Action:** Traveler enters destination in hero search bar (e.g., *"Kashmir"*) or clicks a popular destination pill (`Kashmir`, `Ladakh`, `Kerala`, `Rajasthan`, `Goa`, `Himachal`).
3. **Trigger:** Clicks *"Search Packages"* button or popular pill.
4. **Route:** In-page smooth scroll to `#packages-section`.
5. **Backend Action:** `GET /api/packages?destination=Kashmir`
6. **Database Query:** `SELECT * FROM packages WHERE destination_id = :kashmirId AND status = 'ACTIVE'`
7. **Result:** Package listing updates dynamically to display all matching curated holiday packages.

---

### Flow C2: Travel Theme Filtering
1. **Page:** Curated Tours Section (`/#packages-section`)
2. **Action:** Traveler clicks a theme pill on the themes bar (`Honeymoon`, `Family`, `Adventure`, `Luxury`, `Budget`, `Weekend`, `Pilgrimage`).
3. **Trigger:** Click on theme button.
4. **Route:** In-place state update.
5. **Backend Action:** `GET /api/packages?theme=honeymoon`
6. **Database Query:** `SELECT * FROM packages WHERE theme = 'honeymoon' AND status = 'ACTIVE'`
7. **Result:** Displays only curated packages tagged with the selected travel theme. Clicking *"All Themes"* resets the view.

---

### Flow C3: Package Detail & Trip Confidence Inspection
1. **Page:** Package Card (`/#packages-section`)
2. **Action:** Traveler clicks *"View & Book"* on a package card (e.g., *Kashmir Enchantment: Lakes, Pines & Peaks*).
3. **Trigger:** Click event opens `<PackageDetailModal>`.
4. **Route:** Modal overlay over current page.
5. **Backend Action:** `GET /api/packages/:packageId` & `GET /api/packages/:packageId/confidence`
6. **Database Query:** Queries `packages`, `package_days`, `services`, and runs `computeTripConfidenceScore()` across assigned vendor metrics (`acceptance_rate`, `response_time`, `cancellation_rate`).
7. **Result:** Renders hero gallery, day-by-day itinerary accordions, inclusions/exclusions checklist, and the dynamic **Trip Confidence Score badge** (e.g., *"92% High Confidence"*).

---

### Flow C4: Checkout & Flight Assistance Option
1. **Page:** Package Detail Modal
2. **Action:** Traveler clicks *"Book This Holiday"*.
3. **Trigger:** Transitions modal view to `<PackageCheckoutModal>`.
4. **Input Fields:**
   - Travel start date.
   - Traveler count (Adults, Children, Infants).
   - Room configuration (e.g., 1 Double Room).
   - Traveler contact info (Full Name, Email, Phone, Origin City).
   - Checkbox: `[x] Flight Required (Subject to confirmation)`.
   - Special dietary/mobility requests.
5. **Result:** Live price calculation updates to reflect total costs, taxes, and add-ons.

---

### Flow C5: Razorpay Payment & Master Booking Generation
1. **Page:** Package Checkout Modal
2. **Action:** Traveler clicks *"Proceed to Payment"*.
3. **Route:** Modal opens Razorpay checkout frame.
4. **Backend Action 1:** `POST /api/bookings`
   - Validates input via Zod.
   - Mints Master Booking ID: `ZL{YYMMDD}{seq}` (e.g., `ZL2609190001`).
   - Calls Razorpay API to create an order: `amount`, `currency: INR`.
   - Inserts row in `bookingsTable` with status `PAYMENT_PENDING`.
5. **Customer Action:** Enters test/live payment details in Razorpay modal and completes authorization.
6. **Backend Action 2:** `POST /api/bookings/ZL2609190001/pay`
   - Verifies HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
   - Inserts row in `paymentsTable` with status `SUCCESSFUL`.
   - Updates `bookingsTable` status: `PAYMENT_PENDING` $\rightarrow$ `PAID`.
   - Calls `createFulfilmentTasksOnPayment()`: automatically creates child fulfillment tasks in `booking_servicesTable` for Hotel, Transfer, Activity, and Flight Desk.
   - Dispatches `BOOKING_RECEIVED` and `PAYMENT_SUCCESSFUL` emails.
7. **Result:** Checkout modal displays booking confirmation screen with Master Booking ID and button to open "My Trips".

---

### Flow C6: My Trips & Live Section 11 Timeline Tracking
1. **Page:** Navigation Header
2. **Action:** Traveler clicks *"Trips"* or opens direct link.
3. **Route:** `/trips`
4. **Backend Action:** `GET /api/bookings/my-trips` (authenticated via `zelevos_session` cookie).
5. **Database Query:** `SELECT * FROM bookings WHERE customer_id = :customerId ORDER BY created_at DESC`
6. **Result:** Displays trip overview card with live **Section 11 Lifecycle Timeline**:
   - `Booking Created` (Completed)
   - `Payment Received` (Completed)
   - `Hotel Fulfillment` (Pending / In Progress / Confirmed)
   - `Transfer Fulfillment` (Pending / In Progress / Confirmed)
   - `Activity Fulfillment` (Pending / In Progress / Confirmed)
   - `Flight Arrangement` (If selected: "Subject to confirmation" until PNR uploaded)
   - `Final Itinerary Issued` (Unlocks when all verified)

---

### Flow C7: Consolidated Itinerary & Signed Document Download
1. **Page:** Trip Details (`/trips`)
2. **Action:** Traveler clicks *"Download Consolidated Itinerary"* or *"View Hotel Voucher"*.
3. **Route:** Triggers document retrieval.
4. **Backend Action:** `POST /api/documents/sign`
   - Validates user ownership of the requested booking.
   - Generates 15-minute HMAC-SHA256 signed view token.
5. **Browser Action:** Opens `/api/documents/signed-view?token={token}` in new tab.
6. **Database Query:** Logs access event in `audit_logsTable`.
7. **Result:** Browser renders high-resolution printable PDF / voucher with zero sensitive credentials in public URLs.

---

### Flow C8: Booking Cancellation & Refund Request
1. **Page:** Trip Details (`/trips`)
2. **Action:** Traveler clicks *"Request Cancellation"*.
3. **Trigger:** Opens cancellation modal with policy reminder.
4. **Backend Action:** `POST /api/bookings/ZL2609190001/cancel`
   - Validates cancellation policy based on departure date.
   - Updates `bookingsTable` status to `CANCEL_REQUESTED`.
   - Automatically inserts a record in `refundsTable` with status `REQUESTED` and calculated refund amount.
   - Writes event to `audit_logsTable`.
5. **Result:** Customer timeline updates to *"Cancellation Requested — Under Review"*.

---

### Flow C9: "Build My Trip" Custom Vacation Concierge
1. **Page:** Navigation Header
2. **Action:** Traveler clicks *"Build My Trip"* button.
3. **Trigger:** Opens `<CustomTripModal>`.
4. **Input Fields:** Destination, travel dates, traveler counts, budget tier, hotel preference, vehicle preference, custom notes, phone number.
5. **Backend Action:** `POST /api/custom-trips`
   - Validates input.
   - Inserts row in `custom_trip_requestsTable` with status `LEAD_SUBMITTED`.
   - Generates lead reference: `LEAD-{YYMMDD}-{seq}`.
6. **Result:** Displays confirmation modal with lead reference; notifies operations team.

---

## 2. Admin & Catalog Management Journeys

### Flow A1: Admin Login & Two-Factor Authentication (TOTP)
1. **Page:** Admin Portal Login (`/admin`)
2. **Step 1:** Enters Admin Email and Password $\rightarrow$ clicks *"Sign In"*.
3. **Backend Action 1:** `POST /api/auth/login`
   - Validates credentials against `admin_usersTable`.
   - Detects `totp_enabled = true`; returns `{ require2fa: true, tempToken: "..." }`.
4. **Step 2:** Form renders 6-digit TOTP input $\rightarrow$ Admin enters code from Google Authenticator.
5. **Backend Action 2:** `POST /api/admin/2fa/verify`
   - Verifies 6-digit token using Speakeasy against encrypted base32 secret.
   - Issues full administrative `zelevos_session` cookie with role `admin`.
6. **Result:** Redirects to Operations Control Center.

---

### Flow A2: Package Creation & Publishing CRUD
1. **Page:** Admin Package Manager (`/admin/packages`)
2. **Action:** Admin clicks *"Create New Package"*.
3. **Form Fields:** Title, Destination ID, Duration Days/Nights, Theme, Base Supplier Cost, Markup %, Selling Price, Day-wise Itinerary lines, Inclusions, Exclusions, Policies.
4. **Backend Action:** `POST /api/packages`
   - Inserts row in `packagesTable` with status `ACTIVE`.
   - Inserts associated rows in `package_daysTable`.
   - Writes `PACKAGE_CREATED` in `audit_logsTable`.
5. **Result:** Package immediately appears on live customer storefront with zero build restarts.

---

### Flow A3: Configurable SLA Settings Modification
1. **Page:** Admin SLA Settings (`/admin/sla`)
2. **Action:** Admin updates *"Standard Supplier Response SLA"* from 120 minutes to 90 minutes $\rightarrow$ clicks *"Save SLAs"*.
3. **Backend Action:** `PUT /api/admin/sla-settings/standard_supplier_confirmation`
   - Updates `sla_settingsTable` value to `90`.
   - Writes `SLA_UPDATED` to `audit_logsTable`.
4. **Result:** All new service fulfillment tasks calculate deadlines dynamically using the updated 90-minute limit.

---

## 3. Operations Management Journeys

### Flow O1: Operations Task Queue & Supplier Assignment
1. **Page:** Operations Dashboard (`/admin/operations`)
2. **Action:** Ops Manager views *"Unassigned Tasks"* queue.
3. **Selection:** Selects Hotel Task for Booking `ZL2609190001` $\rightarrow$ selects local DMC *"Gulmarg Highland Tours"* from dropdown $\rightarrow$ clicks *"Assign & Dispatch"*.
4. **Backend Action:** `POST /api/operations/tasks/:taskId/assign`
   - Updates `booking_servicesTable`: `assigned_vendor_id = :vendorId`, `status = 'ASSIGNED'`.
   - Sets `deadline = now + slaMinutes`.
   - Writes `TASK_ASSIGNED` to `audit_logsTable`.
5. **Result:** Dispatches notification to vendor; moves task to *"Awaiting Supplier Confirmation"* queue.

---

### Flow O2: Manual Flight Fulfillment Desk
1. **Page:** Operations Booking View (`/admin/operations/bookings/ZL2609190001`)
2. **Action:** Ops Executive books flight offline via airline portal $\rightarrow$ clicks *"Upload Flight PNR"*.
3. **Form Fields:** Airline Name, Flight Number, Departure Time, Arrival Time, PNR Code (e.g., `6E-9428`), and uploads PDF e-ticket.
4. **Backend Action:** `POST /api/operations/bookings/ZL2609190001/flight-pnr`
   - Updates `booking_servicesTable` (Flight task) with PNR and file path.
   - Transitions task status to `CONFIRMED`.
   - Writes `FLIGHT_PNR_UPLOADED` to `audit_logsTable`.
5. **Result:** Removes "subject to confirmation" badge from customer My Trips view; displays live PNR and e-ticket download button.

---

### Flow O3: Supplier Confirmation Verification Gate
1. **Page:** Operations Verification Queue (`/admin/operations/verification`)
2. **Context:** Vendor has uploaded confirmation voucher for a hotel booking.
3. **Action:** Ops Executive reviews uploaded document, verifies confirmation number $\rightarrow$ clicks *"Verify Confirmation"*.
4. **Backend Action:** `POST /api/operations/tasks/:taskId/verify`
   - Updates `booking_servicesTable` status: `ACCEPTED` $\rightarrow$ `VERIFIED`.
   - Checks if all mandatory components for `ZL2609190001` are now `VERIFIED`.
   - If all verified: updates `bookingsTable` status to `CONFIRMED`.
   - Dispatches `TRIP_CONFIRMED` email with final digital itinerary.
   - Recalculates vendor performance metrics.
5. **Result:** Customer status changes to `CONFIRMED` **only after this operational verification step**.

---

### Flow O4: Custom Trip Proposal Generation
1. **Page:** Custom Trip Inquiries (`/admin/custom-trips`)
2. **Action:** Ops Manager reviews Lead `LEAD-260919-001` $\rightarrow$ clicks *"Assemble Proposal"*.
3. **Form Fields:** Curated day-by-day plan, pricing breakdown, validity date.
4. **Backend Action:** `POST /api/admin/custom-trips/:id/proposal`
   - Inserts custom proposal record.
   - Generates unique one-click checkout link.
   - Dispatches proposal email to customer.
5. **Result:** Customer receives formal proposal email with direct booking link.

---

## 4. Vendor Portal Journeys

### Flow V1: Vendor Login & Booking Request Inbox
1. **Page:** Vendor Login (`/vendor/login`)
2. **Action:** Local hotelier enters Vendor ID and password $\rightarrow$ clicks *"Access Portal"*.
3. **Backend Action:** `POST /api/auth/login` (checks role `vendor`).
4. **Route:** Redirects to Vendor Portal (`/vendor/portal`).
5. **Backend Action:** `GET /api/vendor/requests`
6. **Result:** Renders inbox of pending requests with active SLA countdown timers (e.g., *"Expires in 1h 45m"*).

---

### Flow V2: Request Acceptance & Document Upload
1. **Page:** Vendor Request Details (`/vendor/portal`)
2. **Action 1:** Vendor clicks *"Accept Booking Request"*.
3. **Form Fields:** Enters Supplier Internal Confirmation Code (e.g., `HTL-CONF-8821`).
4. **Backend Action 1:** `POST /api/vendor/requests/:taskId/accept`
   - Updates `booking_servicesTable` status to `ACCEPTED`.
   - Records vendor response timestamp (used for Trip Confidence calculation).
5. **Action 2:** Vendor uploads hotel confirmation voucher PDF $\rightarrow$ clicks *"Upload Voucher"*.
6. **Backend Action 2:** `POST /api/vendor/requests/:taskId/voucher`
   - Stores file securely in private document storage.
   - Creates row in `vouchersTable`.
7. **Result:** Moves task to Ops verification queue; updates vendor payable ledger.

---

## 5. Finance & Reconciliation Journeys

### Flow F1: Finance Overview & Margin Inspection
1. **Page:** Finance Overview (`/admin/finance`)
2. **Action:** Finance Manager navigates to finance dashboard.
3. **Backend Action:** `GET /api/finance/overview`
4. **Database Aggregation:** Computes:
   - Total Gross Bookings Value (GBV).
   - Total Supplier Payables Settled.
   - Total Partner Commissions Accrued.
   - Net Platform Gross Margin.
5. **Result:** Renders margin health widgets, revenue graphs, and settlement calendars.

---

### Flow F2: Refund Review & Disbursement
1. **Page:** Refund Management (`/admin/refunds`)
2. **Action:** Finance Officer reviews pending refund for cancelled booking `ZL2609190001` $\rightarrow$ verifies supplier cancellation fee deduction $\rightarrow$ clicks *"Approve & Process Refund"*.
3. **Backend Action:** `POST /api/finance/refunds/:refundId/process`
   - Validates financial permissions.
   - Initiates refund transaction through Razorpay Refund API.
   - Updates `refundsTable` status: `REQUESTED` $\rightarrow$ `PROCESSED`.
   - Updates `bookingsTable` status: `REFUND_PENDING` $\rightarrow$ `REFUNDED`.
   - Dispatches `REFUND_UPDATE` customer notification.
   - Writes `REFUND_PROCESSED` in `audit_logsTable`.
4. **Result:** Updates financial ledger; sends customer email confirmation with transaction reference.

---

## 6. Partner Network Journeys

### Flow P1: Authorised Partner Registration
1. **Page:** Homepage Banner / Partner Modal
2. **Action:** Travel agency owner clicks *"Become a Zelevos Authorised Partner"*.
3. **Form Fields:** Agency Name, Contact Person, Email, Phone Number, Operating City.
4. **Backend Action:** `POST /api/partners/register`
   - Validates payload.
   - Inserts row into `partnersTable` with status `ACTIVE`.
   - Generates unique referral code (e.g., `ZELAPEXTR40`).
5. **Result:** Modal displays instant activation confirmation with assigned Partner ID and referral code.

---

### Flow P2: Referral Tracking & Commission Attribution
1. **Customer Action:** Traveler books holiday using URL `https://zelevos.com/?ref=ZELAPEXTR40` or enters code at checkout.
2. **Backend Action:** `POST /api/bookings`
   - Resolves referral code against `partnersTable`.
   - Attaches `partner_id` to `bookingsTable`.
3. **Payment Completion:** When customer payment succeeds:
   - Calculates commission (e.g., 5% of package base).
   - Inserts row into `commissionsTable` with status `ACCRUED`.
4. **Result:** Commission appears immediately in partner's ledger as pending settlement.
