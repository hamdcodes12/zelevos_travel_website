# UI/UX Design Brief & Design System — Wayora / Zelevos V1

**Document Version:** 1.0.0 (Phase 1 Baseline)  
**Status:** ACTIVE / AUTHORITATIVE FOR CURRENT V1  
**Design Philosophy:** Human-Crafted Travel, Calm Clarity, Premium Trust  

---

## 1. Design Philosophy & Visual Identity

Zelevos is a curated travel marketplace operating in India. The design language rejects cluttered, banner-heavy legacy booking portals and hyper-gimmicky "AI OS" interfaces. Instead, it projects **calm authority, regional authenticity, and operational transparency**.

### 1.1 Core Tenets
1. **Curated & Human-First:** Photography and copy spotlight real landscapes, verified hoteliers, and local specialists rather than algorithmic prompts.
2. **Transparent Clarity:** Inclusions, exclusions, flight policies, and pricing are displayed in clear, unambiguous line items with zero hidden fees.
3. **Calm Confidence:** Dynamic **Trip Confidence Scores (0–100%)** provide travelers with immediate, objective quality validation.
4. **Zero-Dummy Responsiveness:** Every element (buttons, pills, search bars, modals) responds instantly with real state transitions.

---

## 2. Design System Tokens & Style Guide

### 2.1 Color Palette
The color system relies on rich, tailored HSL tokens calibrated for high contrast and modern elegance:

```css
:root {
  /* Brand Accents */
  --brand-primary: #2563eb;       /* Royal Indigo: primary interactive buttons & links */
  --brand-primary-hover: #1d4ed8; /* Darker blue on hover */
  --brand-accent: #f59e0b;        /* Warm Amber: Trip Confidence score, alerts, highlight badges */
  --brand-accent-light: #fef3c7;  /* Soft Amber tint for badges */
  
  /* Canvas & Surfaces */
  --bg-page: #f8fafc;             /* Crisp cool gray background */
  --bg-surface: #ffffff;          /* Pure white card and modal containers */
  --bg-surface-subtle: #f1f5f9;   /* Secondary surface for inputs and table headers */
  --bg-hero-overlay: rgba(15, 23, 42, 0.75); /* Dark cinematic hero overlay */

  /* Text & Typography */
  --text-main: #0f172a;           /* Deep slate: headers, titles, high-emphasis text */
  --text-muted: #475569;          /* Medium slate: body copy, descriptions, secondary notes */
  --text-tertiary: #94a3b8;       /* Light slate: captions, micro-labels, breadcrumbs */
  --text-inverse: #ffffff;        /* White text for dark hero and badges */

  /* Semantic Feedback */
  --success: #10b981;             /* Emerald: confirmed status, paid badges, inclusions */
  --success-bg: #ecfdf5;          /* Emerald wash for success alerts */
  --warning: #f59e0b;             /* Amber: processing status, subject-to-confirmation */
  --warning-bg: #fffbeb;          /* Amber wash */
  --danger: #ef4444;              /* Coral Red: cancellations, exclusions, errors */
  --danger-bg: #fef2f2;           /* Red wash */
  
  /* Borders & Dividers */
  --border: #e2e8f0;              /* Subtle border for cards, inputs, and dividers */
  --border-focus: #3b82f6;        /* Vibrant blue border on focused inputs */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-modal: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
```

### 2.2 Typography Scale
Uses modern sans-serif typography (`Inter`, `system-ui`, `-apple-system`, `sans-serif`) with strict optical weights:
- **Hero Display Header (H1):** `48px` (`3rem`), font-weight `800`, line-height `1.15`, letter-spacing `-0.025em`.
- **Section Heading (H2):** `32px` (`2rem`), font-weight `700`, line-height `1.25`, letter-spacing `-0.02em`.
- **Card / Modal Title (H3):** `20px` (`1.25rem`), font-weight `700`, line-height `1.4`.
- **Subheadings / Lead Copy:** `16px` (`1rem`), font-weight `500`, line-height `1.6`.
- **Body Text:** `14px` (`0.875rem`), font-weight `400`, line-height `1.5`.
- **Eyebrow / Category Tag:** `12px` (`0.75rem`), font-weight `700`, text-transform `uppercase`, letter-spacing `0.075em`.
- **Micro-Badges / Timestamps:** `11px`, font-weight `600`.

---

## 3. Homepage Architecture (PRD Section 7.1)

The homepage is organized in a clear, descending hierarchy designed to take the traveler from high-level intent to concrete package discovery:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STICKY NAVBAR: Brand Logo | Navigation Links | Build My Trip | Auth Button │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                            DESTINATION SEARCH HERO                          │
│                   Eyebrow: CURATED TRAVEL MARKETPLACE · INDIA               │
│       Title: Discover Handcrafted Travel Packages. Fulfilled by Local Pros. │
│                                                                             │
│    ┌───────────────────────────────────────────────┐ ┌───────────────────┐  │
│    │ [Icon] Where do you want to go? (e.g. Kashmir)│ │  Search Packages  │  │
│    └───────────────────────────────────────────────┘ └───────────────────┘  │
│                                                                             │
│    Popular Destinations: [Kashmir] [Ladakh] [Kerala] [Rajasthan] [Goa]      │
│                                                                             │
│    Value Pills: [✔ Verified Suppliers] [✔ Dynamic Confidence] [✔ 24/7 Ops]  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FEATURED CURATED TOURS SECTION                        │
│             Title: Handcrafted Holiday Packages for Indian Travelers        │
│                                                                             │
│  Themes Bar: [All] [Honeymoon] [Family] [Adventure] [Luxury] [Budget]       │
│                                                                             │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ Package Card 1        │ │ Package Card 2        │ │ Package Card 3    │  │
│  │ Image (16:10 ratio)   │ │ Image (16:10 ratio)   │ │ Image (16:10)     │  │
│  │ 6D / 5N · Kashmir     │ │ 7D / 6N · Ladakh      │ │ 5D / 4N · Kerala  │  │
│  │ 92% High Confidence   │ │ 88% High Confidence   │ │ 95% High Conf.    │  │
│  │ ₹56,000 / person      │ │ ₹48,500 / person      │ │ ₹38,000 / person  │  │
│  │ [ View & Book ]       │ │ [ View & Book ]       │ │ [ View & Book ]   │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         "WHY ZELEVOS" VALUE GRID                            │
│                                                                             │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────┐  │
│  │ One Central Booking   │ │ 100% Curated Stays    │ │ Dedicated Ops Desk│  │
│  │ Stays, transfers &    │ │ Handpicked boutique   │ │ 24/7 live ground  │  │
│  │ activities unified.   │ │ properties & routes.  │ │ human assistance. │  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Transparent Inclusions: Plain-English terms with zero hidden fees.    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AUTHORISED PARTNER PROGRAM BANNER                       │
│  "Become a Zelevos Authorised Partner — Earn verified booking commissions" │
│  [ Apply as an Authorised Partner ] ──> Opens Live Registration Modal       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│           FOOTER: Direct Links, Legal Terms, Support, Admin Portal          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Design Specifications

### 4.1 Package Cards
- **Image Container:** Fixed aspect ratio `16:10` with subtle zoom on card hover (`transform: scale(1.03)`).
- **Duration Badge:** Floating translucent pill in top-left corner (e.g., `6 Days / 5 Nights`).
- **Confidence Rating Badge:** Top-right corner (e.g., `92% Confidence` with green dot indicator).
- **Body Content:**
  - Destination subtitle in uppercase muted font.
  - Package title in bold 18px text.
  - Key highlights bullet row (e.g., `Shikara Ride`, `Pahalgam Valley`, `Private Cab`).
- **Footer Strip:**
  - Starting price clearly labeled: `₹56,000` in 20px bold font with `/ person` suffix.
  - Action button: `View & Book` with forward arrow icon.

### 4.2 Package Detail Modal
- **Layout:** Two-column desktop layout (`60% / 40%`) transitioning to stacked vertical scroll on mobile.
- **Left Column:**
  - Hero image with thumbnail gallery strip.
  - Overview paragraph and traveler suitability badges.
  - Day-by-day itinerary accordions: expand/collapse with day numbers, titles, morning/afternoon/evening details, and stay locations.
  - Side-by-side **Inclusions** (green checkmark icons) and **Exclusions** (red cross icons).
  - Cancellation policy tier breakdown table.
- **Right Sticky Column:**
  - Pricing summary box.
  - **Trip Confidence Score Card:** Prominent widget explaining the score:
    - *Supplier Acceptance Rate:* `98%`
    - *Avg. Confirmation Speed:* `42 mins (SLA: 120 mins)`
    - *Trip Completion Rate:* `99.2%`
  - Primary CTA: Large `Book This Holiday` button.
  - Secondary CTA: `Request Customization` link.

### 4.3 Checkout Flow UX
- **Structured Sections:**
  1. *Travel Window:* Interactive date picker with seasonal notices.
  2. *Party Size:* Stepper controls for Adults (`18+`), Children (`2–11`), and Infants (`< 2`).
  3. *Room Configuration:* Single, Double, or Twin bed selections.
  4. *Flight Assistance Checkbox:* High-contrast card with toggle:
     `[x] Include Flight Assistance — Subject to confirmation` with origin airport dropdown and baggage requirements.
  5. *Lead Traveler Information:* Name, Email, Phone, and City with instant inline validation.
  6. *Order Summary Card:* Transparent line-item breakdown:
     - Package Base (2 Adults): `₹1,12,000`
     - Flight Desk Handling: `₹0 (Billed upon confirmation)`
     - GST (5%): `₹5,600`
     - **Total Payable:** `₹1,17,600`
  7. *Submit Action:* `Proceed to Secure Payment` button loading Razorpay modal.

### 4.4 Customer "My Trips" & Section 11 Timeline UI
- **Master Header:** Prominent Master Booking ID (`ZL2609190001`) with copy-to-clipboard button.
- **Visual Section 11 Timeline:** Horizontal stepper on desktop / vertical progress line on mobile:
  - Step 1: `Booking Created` (Green Checkmark)
  - Step 2: `Payment Captured` (Green Checkmark)
  - Step 3: `Hotel Confirmed` (Active / Completed)
  - Step 4: `Transfer Confirmed` (Active / Completed)
  - Step 5: `Activity Confirmed` (Active / Completed)
  - Step 6: `Flight PNR Uploaded` (Subject to confirmation $\rightarrow$ Confirmed)
  - Step 7: `Final Itinerary Issued` (Green Checkmark)
- **Voucher Action Cards:** Download buttons with lock/signature indicators for verified vouchers.

---

## 5. Backoffice Portals & Dashboard UX

### 5.1 Operations Dashboard
- **Top Metrics Row:** 4 clean metric cards with colored top borders:
  - *New Bookings (Today):* Count + trend indicator.
  - *Pending Supplier SLA:* Count with amber pulsing badge if $< 30$ mins remaining.
  - *Exceptions / Action Required:* Red badge counter.
  - *Fulfilled Trips (This Month):* Green badge counter.
- **Task Queue Table:**
  - Columns: Booking ID, Service Type (Hotel/Cab/Guide/Flight), Assigned Supplier, SLA Countdown Timer, Actions.
  - Quick action modal: `Assign Supplier`, `Verify Confirmation`, `Upload Flight PNR`.

### 5.2 Vendor Portal
- **Distraction-Free Inbox:** Clean list of incoming requests.
- **Urgent SLA Timer:** Countdown clock in bold red/amber text.
- **Action Buttons:** Large `Accept Booking` (green) and `Decline` (subtle gray) buttons.
- **Drag-and-Drop Document Uploader:** Dedicated dropzone for voucher PDFs and tax invoices.

### 5.3 Finance Ledger View
- **Ledger Table:** Monospaced numerical columns for easy financial scanning:
  - Booking ID | Customer Paid (A) | Supplier Cost (B) | Partner Comm (C) | Gross Margin (A - B - C) | Margin %
  - Color coded margin: Green ($> 15\%$), Amber ($5–14\%$), Red ($< 5\%$).

---

## 6. Form States, Modals & Micro-Interactions

1. **Input States:**
   - *Default:* `1px solid var(--border)` with `4px` padding.
   - *Focus:* `2px solid var(--brand-primary)` with subtle blue glow (`box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1)`).
   - *Error:* `1.5px solid var(--danger)` with red error caption below the field.
   - *Disabled:* Muted background with `cursor: not-allowed`.
2. **Modal Architecture:**
   - Semi-transparent backdrop blur (`backdrop-filter: blur(4px); background: rgba(15, 23, 42, 0.6)`).
   - Smooth entrance scale animation (`transform: scale(0.98) -> scale(1.0)` over 150ms).
   - Sticky header with clear title and close icon button (`X`).
3. **Zero Toast-Only Rule:** Status notifications (toasts) may inform the user of completed actions, but buttons must never trigger toasts without executing real backend mutations.

---

## 7. Responsive Breakpoints & Accessibility

- **Mobile (< 768px):**
  - Navigation collapses into hamburger slide-out drawer.
  - Hero search stack vertically: input on top, full-width search button below.
  - Package cards display full-width single column.
  - Timeline displays as vertical timeline with left-aligned date markers.
- **Tablet (768px – 1024px):**
  - Two-column package card grid.
- **Desktop (> 1024px):**
  - Three-column package card grid.
  - Fixed-width max container (`1280px`) with centered margins.
- **Accessibility (WCAG 2.1 AA):**
  - All text meets minimum contrast ratio of `4.5:1` against backgrounds.
  - Interactive elements have explicit `aria-label` attributes where text is omitted.
  - Keyboard focus rings are clearly visible on all interactive pills, buttons, and inputs.

---

## 8. Parked AI UI Elements (Future Isolation)

The following UI elements from the speculative prototype are **PARKED** and excluded from the active customer viewport:
- Floating "Ask Zelevos" chat copilot button.
- "AI TRAVEL OS" badges and headers.
- Multi-line AI prompt input textareas with sparkles icons.
- Autonomous itinerary generator widgets.
