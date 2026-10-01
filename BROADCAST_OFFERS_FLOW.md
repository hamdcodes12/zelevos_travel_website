# ZELEVOS BROADCASTS & OFFERS LIFECYCLE FLOW

```
ADMIN
  │
  ▼
CREATE BROADCAST
  │
  ▼
SELECT TARGET
  │
  ▼
ALL CUSTOMERS / SPECIFIC CUSTOMER ID
  │
  ▼
VALIDATE TARGET (Server-authoritative database check: ZLV-CUS-XXXXXX)
  │
  ▼
CREATE BROADCAST
  │
  ▼
SET START + EXPIRY (Server-authoritative expiresAt timestamp)
  │
  ▼
SEND
  │
  ▼
REAL CUSTOMER NOTIFICATION (Persisted notification + broadcast_recipients row)
  │
  ▼
ACTIVE
  │
  ├───────────────────────────────┬───────────────────────────────┐
  ▼                               ▼                               ▼
EXPIRED                        REVOKED                         ARCHIVED
  │                               │                               │
  ▼                               ▼                               ▼
Time reached:                  Admin action:                   Admin history action:
CURRENT_TIME >= expiresAt      POST /broadcasts/:id/revoke     POST /broadcasts/:id/archive
Auto-swept by cron/API         Customer offer disabled         Hidden from normal history
CTAs blocked server-side       CTAs blocked server-side        Can be restored if desired
  │                               │                               │
  └───────────────────────────────┼───────────────────────────────┘
                                  │
                                  ▼
                      DATABASE RECORD PRESERVED
                        (Zero Hard Deletion)
                                  │
                                  ▼
                              AUDIT LOG
       (BROADCAST_CREATED, BROADCAST_TARGETED_TO_CUSTOMER,
        BROADCAST_SENT, BROADCAST_REVOKED, BROADCAST_EXPIRED,
        BROADCAST_ARCHIVED, BROADCAST_RESTORED)
```

---

## Detailed State Transition Matrix

| Current State | Event / Trigger | Target State | DB Row Modified | Customer View | Admin Actions Available |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DRAFT** | Admin submits for dispatch | **SENT** | `status = 'SENT'`, `sent_at = NOW()` | Visible in notification center | View, Recipients, Revoke, Archive |
| **DRAFT** | Admin sets future `scheduledAt` | **SCHEDULED** | `status = 'SCHEDULED'`, `scheduled_at = ...` | Not visible yet | View, Edit, Cancel, Archive |
| **SCHEDULED** | Clock reaches `scheduledAt` | **SENT** | `status = 'SENT'`, `sent_at = NOW()` | Visible in notification center | View, Recipients, Revoke, Archive |
| **SENT** | Clock reaches `expiresAt` | **EXPIRED** | `status = 'EXPIRED'` | Alert banner shown; CTA disabled with 410 rejection | View, Recipients, Archive |
| **SENT** | Admin clicks "Revoke Offer" | **REVOKED** | `status = 'REVOKED'`, `revoked_at = NOW()`, `revoked_by_admin_id = ...` | `🚫 Offer Revoked` alert banner; CTA disabled with 410 rejection | View, Recipients, Archive |
| **ANY ACTIVE** | Admin clicks "Remove / Archive" | **ARCHIVED** (`is_archived: true`) | `is_archived = true`, `archived_at = NOW()`, `archived_by_admin_id = ...` | Customer state unaltered (preserves audit integrity) | View, Restore |
| **ARCHIVED** | Admin clicks "Restore" | **RESTORED** (`is_archived: false`) | `is_archived = false`, `archived_at = null`, `archived_by_admin_id = null` | Customer state reflects underlying lifecycle (REVOKED remains REVOKED) | View, Recipients, Revoke, Archive |
