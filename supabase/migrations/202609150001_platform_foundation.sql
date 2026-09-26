-- Supabase production migration. Apply with Supabase CLI or the SQL editor.
-- This migration is additive and does not overwrite existing application data.

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  provider text not null,
  provider_order_id text,
  provider_payment_id text,
  amount integer not null,
  currency text not null default 'INR',
  requested_amount integer not null,
  captured_amount integer,
  status text not null default 'CREATED',
  refund_status text not null default 'NONE',
  refund_amount integer not null default 0,
  failure_reason text,
  webhook_event_id text,
  webhook_event_type text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_trip_requests add column if not exists proposal_itinerary jsonb not null default '[]'::jsonb;
alter table public.custom_trip_requests add column if not exists proposal_notes text;
alter table public.custom_trip_requests add column if not exists customer_accepted_at timestamptz;
alter table public.custom_trip_requests add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_admin_id uuid references public.admin_users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  ip_address text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  purpose text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_transactions_user_id_idx on public.payment_transactions(user_id);
create index if not exists payment_transactions_booking_id_idx on public.payment_transactions(booking_id);
create unique index if not exists payment_transactions_user_idempotency_idx on public.payment_transactions(user_id, idempotency_key);
create unique index if not exists payment_transactions_provider_order_idx on public.payment_transactions(provider, provider_order_id);
create unique index if not exists payment_transactions_webhook_event_idx on public.payment_transactions(webhook_event_id);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at);
create index if not exists auth_tokens_user_purpose_idx on public.auth_tokens(user_id, purpose);

alter table public.payment_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.auth_tokens enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_sessions enable row level security;

drop policy if exists "users can read their payment transactions" on public.payment_transactions;
drop policy if exists "users can read their notifications" on public.notifications;
drop policy if exists "users can update their notifications" on public.notifications;
drop policy if exists "users cannot read audit logs" on public.audit_logs;
drop policy if exists "users cannot read auth tokens" on public.auth_tokens;
drop policy if exists "users can read their own profile" on public.users;
drop policy if exists "users can update their own profile" on public.users;
drop policy if exists "users can manage their traveller profile" on public.traveller_profiles;
drop policy if exists "users can manage their trips" on public.generated_trips;
drop policy if exists "users can manage their bookings" on public.bookings;
drop policy if exists "admin tables are server-only" on public.admin_users;
drop policy if exists "admin sessions are server-only" on public.admin_sessions;

-- These policies apply to Supabase Auth JWT clients. The Express service uses
-- the server-only key/database connection and enforces the same ownership rules.
create policy "users can read their payment transactions"
  on public.payment_transactions for select
  using (user_id = auth.uid());

create policy "users can read their notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "users can update their notifications"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users cannot read audit logs"
  on public.audit_logs for select
  using (false);

create policy "users cannot read auth tokens"
  on public.auth_tokens for select
  using (false);

create policy "admin tables are server-only"
  on public.admin_users for all
  using (false)
  with check (false);

create policy "admin sessions are server-only"
  on public.admin_sessions for all
  using (false)
  with check (false);

-- Existing application data also needs database-level ownership protection.
alter table public.users enable row level security;
alter table public.traveller_profiles enable row level security;
alter table public.generated_trips enable row level security;
alter table public.bookings enable row level security;

create policy "users can read their own profile"
  on public.users for select
  using (id = auth.uid());

create policy "users can update their own profile"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can manage their traveller profile"
  on public.traveller_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can manage their trips"
  on public.generated_trips for all
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

create policy "users can manage their bookings"
  on public.bookings for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
