---
name: External DB Connection Issue
description: An external Railway PostgreSQL instance is unreachable
---

# External Database Connection

## The Rule
Do not attempt to run drizzle-kit push or any DB migrations without first confirming the Railway database is reachable.

## Why
The Railway proxy at yamanote.proxy.rlwy.net:38280 has an open TCP port, but PostgreSQL handshake fails with ECONNRESET / "server closed connection unexpectedly". psql also fails. The issue is likely stale credentials or a paused Railway instance.

## How to Apply
If a task requires database access, ask the user to either:
1. Restore/update the Railway connection with fresh credentials
2. Or explicitly ask to switch to Replit's built-in PostgreSQL

The API server starts fine on port 8080 but logs a DrizzleQueryError on startup when trying to seed the plans table.
