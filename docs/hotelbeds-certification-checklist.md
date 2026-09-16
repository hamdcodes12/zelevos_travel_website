# Hotelbeds Certification Checklist

This checklist records implementation evidence without claiming Hotelbeds certification or live booking approval.

## Automated implementation coverage

| Area | Status | Evidence |
| --- | --- | --- |
| Availability | PASS | TEST adapter and route tests cover availability normalization. |
| CheckRate | PASS | RECHECK rates call `/checkrates`; BOOKABLE rates are supported. |
| RECHECK | PASS | Adapter tests cover RECHECK to BOOKABLE conversion. |
| Booking | PASS | Booking is gated behind verified payment and supplier claim state. |
| Multi-room | PASS | Occupancies and room-specific guests are covered by tests. |
| Children ages | PASS | Child counts and ages are validated and sent as child pax data. |
| Pax roomId | PASS | Booking pax records are normalized to their room IDs. |
| Cancellation policies | PASS | Policies are normalized, persisted, and included in vouchers. |
| Rate comments | PASS | Rate comment IDs/details are supported and tested. |
| Hotel content | PASS | Content endpoint normalization is implemented. |
| Images | PASS | Hotelbeds content image paths are normalized to photo URLs. |
| Facilities | PASS | Facilities are normalized and returned to the client. |
| Room types | PASS | Room code/name/facility data is normalized. |
| Board types | PASS | Board code/name data is normalized. |
| Voucher | PASS | Voucher data and PDF generation are implemented and tested. |
| Booking timeout >= 60 seconds | PASS | Supplier booking timeout is 60,000 ms. |
| Payment-before-supplier-booking | PASS | Supplier booking occurs only after verified payment. |
| Refund handling | PASS | Supplier failure triggers refund processing. |
| Reconciliation | PASS | Ambiguous supplier/refund states enter reconciliation without retry. |
| Duplicate protection | PASS | Database idempotency and concurrent supplier claim are tested. |
| Admin reconciliation | PASS | Admin-only reconciliation endpoint is implemented. |
| Security | PASS | Credentials stay server-side; rate keys are removed from public booking data. |
| TEST/LIVE endpoint switching | PASS | The configured Hotelbeds base URL determines reported TEST/LIVE environment. |

## Not verified or blocked

| Item | Status | Required evidence |
| --- | --- | --- |
| Hotelbeds certification approval | NOT VERIFIED | Official Hotelbeds certification/approval from Hotelbeds. |
| LIVE credentials | BLOCKED | Legitimate LIVE API key and secret supplied through deployment secrets. |
| LIVE availability | NOT VERIFIED | Controlled test using approved LIVE credentials. |
| LIVE CheckRate | NOT VERIFIED | Controlled test using approved LIVE credentials. |
| LIVE booking | NOT VERIFIED | Explicitly authorized controlled transaction; none was performed. |
| LIVE cancellation/refund | NOT VERIFIED | Controlled post-certification verification; none was performed. |
| LIVE voucher | NOT VERIFIED | Controlled LIVE booking result; none was performed. |

## Required TEST configuration

```text
HOTELBEDS_HOTEL_API_KEY=
HOTELBEDS_HOTEL_SECRET=
HOTELBEDS_HOTEL_BASE_URL=https://api.test.hotelbeds.com
```

Switching to LIVE requires only legitimate credentials and the approved endpoint:

```text
HOTELBEDS_HOTEL_API_KEY=<LIVE_KEY>
HOTELBEDS_HOTEL_SECRET=<LIVE_SECRET>
HOTELBEDS_HOTEL_BASE_URL=https://api.hotelbeds.com
```

No LIVE Hotelbeds booking was created during this validation.
