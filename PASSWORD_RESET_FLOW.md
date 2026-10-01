# ZELEVOS — Secure Customer Password Reset Architecture & Flow

This document details the complete end-to-end security architecture and technical flow implemented for Zelevos Customer Password Recovery.

---

## 1. Architectural Flowchart

```
                 ┌─────────────────────────────────┐
                 │         CUSTOMER LOGIN          │
                 │   [ Email Address ]             │
                 │   [ Password      ]             │
                 │   [ Forgot password? ]─────────┐│
                 └────────────────────────────────┼┘
                                                  │ Click
                                                  ▼
                 ┌─────────────────────────────────┐
                 │      STEP 1: FORGOT PASSWORD    │
                 │   "Forgot your password?"       │
                 │   [ Enter registered email ]    │
                 │   [ Send OTP Button ]           │
                 └────────────────┬────────────────┘
                                  │ POST /api/auth/password/forgot
                                  ▼
                 ┌─────────────────────────────────┐
                 │     SERVER: SAFETY & TOKEN GEN  │
                 │ • Normalize email               │
                 │ • Check account exists & active │
                 │ • If active:                    │
                 │     Generate secure 6-digit OTP │
                 │     Generate 32-byte direct tok │
                 │     Hash with SHA-256           │
                 │     Store in auth_tokens        │
                 │     Audit: RESET_REQUESTED      │
                 │     Send via SMTP / Resend      │
                 │ • If not found:                 │
                 │     Perform constant-time dummy │
                 │ • Account Enumeration Defense:  │
                 │     Return generic 200 response │
                 └────────────────┬────────────────┘
                                  │
                                  ▼
                 ┌─────────────────────────────────┐
                 │      STEP 2: OTP VERIFICATION   │
                 │   "Verify your email"           │
                 │   [ _ _ _ _ _ _ ] 6-digit code  │
                 │   Resend countdown (60s timer)  │
                 │   [ Verify OTP Button ]         │
                 └────────────────┬────────────────┘
                                  │ POST /api/auth/password/verify-otp
                                  ▼
                 ┌─────────────────────────────────┐
                 │   SERVER: OTP ATTEMPT CHECK     │
                 │ • Locate active token by email  │
                 │ • Check expiry (10 min lifetime)│
                 │ • Check attempt_count < 5       │
                 │ • Constant-time hash compare    │
                 │                                 │
                 │   WRONG OTP      CORRECT OTP    │
                 │   ┌───────┐      ┌────────────┐ │
                 │   │Incr   │      │Consume OTP │ │
                 │   │Attempt│      │Issue 15-min│ │
                 │   │Count  │      │Auth Token  │ │
                 │   │Show   │      │Audit Log   │ │
                 │   │Error  │      │status: 200 │ │
                 │   └───────┘      └──────┬─────┘ │
                 └─────────────────────────┼───────┘
                                           │
                                           ▼
                 ┌─────────────────────────────────┐
                 │     STEP 3: NEW PASSWORD        │
                 │   "Create a new password"       │
                 │   [ New Password ] (min 8)      │
                 │   [ Confirm Password ]          │
                 │   [ Reset Password Button ]     │
                 └────────────────┬────────────────┘
                                  │ POST /api/auth/password/reset
                                  ▼
                 ┌─────────────────────────────────┐
                 │   SERVER: SECURE PASSWORD RESET │
                 │ • Validate reset authorization  │
                 │ • Check auth token unconsumed   │
                 │ • Validate password complexity  │
                 │ • Verify matching passwords     │
                 │ • Hash with scrypt (16B salt)   │
                 │ • Update user in users table    │
                 │ • Consume reset auth token      │
                 │ • Invalidate user tokens & OTPs │
                 │ • Revoke active user sessions   │
                 │ • Audit: RESET_SUCCESS          │
                 │ • Non-blocking notice email     │
                 └────────────────┬────────────────┘
                                  │
                                  ▼
                 ┌─────────────────────────────────┐
                 │   STEP 4: SUCCESS CONFIRMATION  │
                 │   "Password Reset Successful"   │
                 │   [ Continue to Login Button ]  │
                 └────────────────┬────────────────┘
                                  │ Redirect
                                  ▼
                 ┌─────────────────────────────────┐
                 │   STEP 5: LOGIN WITH NEW PASS   │
                 │   [ Email Address ]             │
                 │   [ NEW Password  ]             │
                 │   [ Log In Button ]             │
                 │                                 │
                 │ • Old password FAILS (401)      │
                 │ • NEW password SUCCEEDS (200)   │
                 │ • Clean customer session issued │
                 └─────────────────────────────────┘
```

---

## 2. API Endpoint Sequence & Specifications

### Endpoint 1: Request Password Reset OTP
- **URL**: `POST /api/auth/password/forgot` (aliases: `/api/auth/forgot-password`, `/api/auth/password/resend-otp`, `/api/auth/resend-password-reset-otp`)
- **Rate Limit**: Authoritative `authRateLimiter` (10 requests per 15 min by IP + account email).
- **Request Body**:
  ```json
  {
    "email": "customer@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "status": "otp_sent",
    "message": "If an account exists for this email, we’ll send a verification code."
  }
  ```
- **Security Guarantees**:
  - Constant-time dummy hashing when user does not exist.
  - Zero account enumeration: Registered and unregistered emails receive identical status and message.
  - OTP and reset token are NEVER returned in response payloads or headers.
  - Re-request invalidates prior unconsumed challenges for that user.

---

### Endpoint 2: Verify Password Reset OTP
- **URL**: `POST /api/auth/password/verify-otp` (alias: `/api/auth/verify-password-reset-otp`)
- **Rate Limit**: Authoritative `authRateLimiter`.
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "otp": "482731"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "status": "otp_verified",
    "resetToken": "c2VjdXJlX3Nob3J0X2xpdmVkX3Rva2VuXzMyX2J5dGVz",
    "message": "Verification code confirmed. You can now set a new password."
  }
  ```
- **Error Responses**:
  - `400 Invalid / Expired`: `{"success": false, "status": "invalid_code", "message": "The verification code is invalid or expired."}`
  - `429 Max Attempts Exceeded`: `{"success": false, "status": "too_many_attempts", "message": "Too many failed attempts. Please request a new verification code."}`
- **Security Guarantees**:
  - Cryptographic timing-safe comparison (`crypto.timingSafeEqual`).
  - Brute-force protection: Tracks `attempt_count` on `auth_tokens`. At 5 failed attempts, the OTP is invalidated immediately.
  - Single-use: Verified OTP is marked `consumed_at = NOW()` immediately upon issuance of authorization token.
  - Short-lived authorization token: 15-minute validity, purpose `PASSWORD_RESET_AUTH`.

---

### Endpoint 3: Commit New Password
- **URL**: `POST /api/auth/password/reset` (alias: `/api/auth/reset-password`)
- **Rate Limit**: Authoritative `authRateLimiter`.
- **Request Body**:
  ```json
  {
    "resetToken": "c2VjdXJlX3Nob3J0X2xpdmVkX3Rva2VuXzMyX2J5dGVz",
    "password": "NewSecurePassword2026!",
    "confirmPassword": "NewSecurePassword2026!"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "status": "password_updated",
    "message": "Your password has been reset successfully. You can now log in with your new password."
  }
  ```
- **Security Guarantees**:
  - Independent server-side password validation (minimum 8 characters, exact match).
  - Uses existing production password hashing (`scryptSync` with 16-byte random hex salt).
  - Atomically marks the authorization token consumed (`consumed_at = NOW()`).
  - Atomically consumes all remaining pending tokens/OTPs for that user.
  - Session revocation: Deletes all active sessions from `sessionsTable` for that user.
  - Writes `PASSWORD_RESET_SUCCESS` audit event.
  - Sends security confirmation email notice to user inbox.
