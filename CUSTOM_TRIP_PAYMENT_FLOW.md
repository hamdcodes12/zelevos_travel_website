# ZELEVOS — Custom Trip Payment & Acceptance Architecture
**Technical Specification & API Reference for Custom Trip Proposals, Razorpay Checkout & Receipt Fulfillment**

---

## 1. Overview & State Machine

The Custom Trip lifecycle transitions through strict, auditable state machine phases:

```
[Customer Request] ─────────► PENDING
                                  │ (Admin creates proposal)
                                  ▼
                            PROPOSAL_SENT
                                  │ (Customer accepts proposal)
                                  ▼
                               ACCEPTED
                       (booking.paymentStatus: PENDING)
                                  │ (Razorpay payment captured & verified)
                                  ▼
                                 PAID
                     (booking.paymentStatus: SUCCESSFUL)
```

---

## 2. Step-by-Step API Contracts

### Step 1: Proposal Acceptance & Booking Materialization
- **Endpoint:** `POST /api/custom-trips/:id/accept`
- **Authentication:** Required (`customer`)
- **Headers:** `Cookie: session=...`
- **Request Body:** `{}` (no body required)
- **Security & Authorization:**
  - Validates that `custom_trip_requests.id` belongs to the requesting user's `userId` or `customerEmail`.
  - Rejects foreign users with `HTTP 404` (IDOR protection).
  - Validates that current status is `PROPOSAL_SENT`.
- **Idempotency Guarantee:**
  - If `lead.bookingId` is already set (e.g. rapid double-clicking "Accept"), the endpoint returns the existing booking with `HTTP 200` without creating duplicate records.
- **Database Operations (Atomic Transaction):**
  - Generates sequential Master Booking ID (format: `ZL{YYMMDD}{seq}`, e.g., `ZL260928001`).
  - Inserts row into `bookingsTable`:
    ```json
    {
      "bookingId": "ZL260928001",
      "customerId": "<user_uuid>",
      "ownerId": "<user_uuid>",
      "totalPrice": 90000,
      "amount": 90000,
      "providerReference": "",
      "bookingReference": "ZL260928001",
      "status": "DRAFT",
      "paymentStatus": "PENDING",
      "customTripRequestId": "<lead_uuid>"
    }
    ```
  - Updates `custom_trip_requests`: sets `status: "ACCEPTED"`, `bookingId: booking.id`.
  - Logs immutable audit action: `CUSTOM_TRIP_ACCEPTED`.
- **Response (`HTTP 200`):**
  ```json
  {
    "status": "success",
    "message": "Custom trip proposal accepted successfully.",
    "booking": {
      "id": "e0b9...",
      "bookingId": "ZL260928001",
      "totalPrice": 90000,
      "paymentStatus": "PENDING"
    },
    "lead": {
      "id": "d998...",
      "status": "ACCEPTED"
    }
  }
  ```

---

### Step 2: Server-Authoritative Razorpay Order Creation
- **Endpoint:** `POST /api/payments/order`
- **Authentication:** Required (`customer`)
- **Headers:** `Content-Type: application/json`, `Cookie: session=...`
- **Request Body:**
  ```json
  {
    "bookingId": "e0b9...", 
    "idempotencyKey": "custom-trip-d998...-e0b9..."
  }
  ```
- **Security & Anti-Tampering:**
  - Even if the client sends an arbitrary `"amount": 1`, the server fetches the booking record directly from the database and uses `booking.totalPrice` as the sole authority.
  - Checks booking ownership (`booking.ownerId === req.user.id || booking.customerId === req.user.id`).
  - Verifies that `booking.paymentStatus === "PENDING"`.
- **Provider Interaction:**
  - Converts amount to subunits (paise): `Math.round(totalPrice * 100)`.
  - Calls Razorpay Orders API: `POST https://api.razorpay.com/v1/orders`.
  - Inserts transaction record in `payment_transactions` (`provider: "razorpay"`, `status: "CREATED"`).
  - Updates `bookings.paymentOrderId` with the created order ID.
- **Response (`HTTP 201`):**
  ```json
  {
    "orderId": "order_Qa7V9...",
    "amount": 90000,
    "amountSubunits": 9000000,
    "currency": "INR",
    "keyId": "rzp_live_...",
    "provider": "razorpay"
  }
  ```

---

### Step 3: Payment Verification & Ledger Finalization
- **Endpoint:** `POST /api/payments/verify`
- **Authentication:** Required (`customer`)
- **Headers:** `Content-Type: application/json`, `Cookie: session=...`
- **Request Body:**
  ```json
  {
    "orderId": "order_Qa7V9...",
    "paymentId": "pay_Qa7XYZ...",
    "signature": "3a7b8c..."
  }
  ```
- **Cryptographic Verification:**
  - Computes `HMAC-SHA256` of `${orderId}|${paymentId}` using the secret `RAZORPAY_KEY_SECRET`.
  - Performs constant-time comparison `crypto.timingSafeEqual` between expected and actual signature.
  - Rejects tampered signatures with `HTTP 400` (`verification_failed`).
- **Database Transition (`finalizeCapturedPayment`):**
  - Updates `payment_transactions`: sets `status: "CAPTURED"`, `providerPaymentId: paymentId`.
  - Updates `bookings`: sets `status: "PROCESSING"`, `paymentStatus: "SUCCESSFUL"`, `paymentId: paymentId`.
  - Detects linked custom trip:
    ```ts
    await db
      .update(customTripRequestsTable)
      .set({ status: "PAID", updatedAt: new Date() })
      .where(eq(customTripRequestsTable.bookingId, booking.id));
    ```
  - Emits `CUSTOM_TRIP_PAID` audit log.
  - Dispatches in-app notification to the customer with direct link to download the payment receipt.
- **Response (`HTTP 200`):**
  ```json
  {
    "verified": true,
    "orderId": "order_Qa7V9...",
    "paymentId": "pay_Qa7XYZ..."
  }
  ```

---

### Step 4: Official Receipt Generation & Download
- **Endpoints:**
  - `GET /api/bookings/:idOrBookingId/receipt` (Interactive View / JSON if `?format=json`)
  - `GET /api/bookings/:idOrBookingId/receipt/download` (Clean HTML Document or Attachment if `?download=true`)
- **Authentication:** Required (`customer` owner or `admin`)
- **IDOR Protection:**
  - Fetches booking by UUID or Master Booking ID (`ZL...`).
  - Verifies `booking.ownerId === req.user.id || booking.customerId === req.user.id || req.user.role === 'admin'`.
  - Rejects unauthorized users with `HTTP 403` or `HTTP 404`.
  - Ensures booking is confirmed and paid (`paymentStatus === "SUCCESSFUL"`).
- **Invoice Content:**
  - Official Header with Zelevos Branding, Tax Reg No, and Contact details.
  - Receipt Number (`REC-ZL260928001`) and Date.
  - Customer ID (`ZLV-CUS-000086`), Full Name, Email, and Phone.
  - Verified Payment Details:
    - Payment Method: Razorpay
    - Transaction / Payment ID (`pay_...`)
    - Order Reference (`order_...`)
    - Payment Status: `PAID (CONFIRMED)`
  - Itemized Pricing breakdown (Package / Custom Itinerary base amount, GST/taxes, Total Paid).
  - Print button & Direct file download trigger.

---

## 3. Security Highlights

1. **Anti-Tampering:** Client cannot alter the trip price during order creation; server reads directly from the database record.
2. **Strict IDOR Mitigation:** All lead viewing, proposal acceptance, and receipt endpoints strictly enforce authorization against the authenticated session user.
3. **Database Constraints Resiliency:** Legacy `NOT NULL` columns on the `bookings` table are migrated with defaults and handled cleanly in all insert queries.
4. **Idempotent Double-Click Safety:** Re-submitting an acceptance request safely returns the existing booking record rather than spawning duplicate entries or database conflicts.
