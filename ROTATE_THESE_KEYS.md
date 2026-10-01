# CRITICAL SECURITY NOTICE: CREDENTIALS REQUIRING IMMEDIATE ROTATION

During security auditing, a file named `..env` (two leading dots) was identified at the repository root. This file contained live third-party API credentials, database connection strings, and payment secrets that bypassed previous `.gitignore` rules.

The `..env` file has been **completely deleted** from the working tree, and `.gitignore` has been updated to prevent any files matching `*env` or `..env` from ever being tracked.

Because these credentials may have been committed or exposed, the operator **MUST immediately rotate or revoke** all of the following credentials in their respective service dashboards:

| Credential / Variable Name | Service / Provider | Recommended Immediate Action |
|---|---|---|
| `RAZORPAY_KEY_ID` | Razorpay | Regenerate API Key ID & Secret in Razorpay Dashboard -> Settings -> API Keys |
| `RAZORPAY_KEY_SECRET` | Razorpay | Invalidate immediately alongside Key ID |
| `DATABASE_URL` | Supabase / PostgreSQL | Change database password in Supabase Project Settings -> Database |
| `SUPABASE_URL` | Supabase | Verify project access / review audit logs |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase | Rotate API keys in Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Update alongside Supabase config |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | Rotate API keys |
| `VITE_SUPABASE_URL` | Supabase | Update alongside Supabase config |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase | Rotate API keys |
| `GEMINI_API_KEY` | Google AI Studio / GCP | Revoke and generate new API key in Google AI Studio |
| `GOOGLE_MAPS_API_KEY` | Google Cloud Console | Restrict/rotate API key in GCP Credentials |
| `TRAVELPAYOUTS_API_TOKEN` | Travelpayouts | Revoke token in Travelpayouts Dashboard |
| `IGNAV_API_KEY` | Ignav | Invalidate API key |
| `HOTELBEDS_HOTEL_API_KEY` | Hotelbeds | Invalidate API key |
| `HOTELBEDS_HOTEL_SECRET` | Hotelbeds | Invalidate secret |
| `HOTELBEDS_HOTEL_BASE_URL` | Hotelbeds | Decommission/remove |

> [!WARNING]
> None of the third-party keys listed above can be rotated programmatically from inside this development environment. They must be revoked and regenerated directly in their respective cloud/vendor consoles.
