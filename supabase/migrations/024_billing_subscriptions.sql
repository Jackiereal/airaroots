-- ─────────────────────────────────────────────
-- BILLING SUBSCRIPTIONS (Razorpay recurring subscriptions — Model A)
--
-- Builds on migration 020. organizations.plan + organizations.subscription_status
-- are the ENFORCEMENT source of truth read by POST /api/properties (via
-- getOrgPlan). Nothing reads a subscriptions table for gating. So the webhook's
-- job is to MIRROR Razorpay state onto those two organizations columns — that
-- mirror is what lifts/drops the property cap.
--
-- This migration adds:
--   subscription_plans  — product-global plan catalog (our Plan enum → Razorpay
--                          plan id, which embeds price; no rupee amounts in code)
--   subscriptions       — per-org subscription record (Razorpay-native status)
--   billing_events      — idempotent event ledger + charge record (dedup key)
--
-- Money-table WRITES happen only through the service-role client (the subscribe
-- route + the webhook, which has no auth.uid()). Member write policies are
-- intentionally OMITTED — they'd be dead code and a footgun. Members may SELECT
-- their own org's rows for history/UI.
--
-- Conventions: bare organization_id uuid (no FK); update_updated_at_column()
-- from migration 001; RLS via organization_members. Applied MANUALLY in the
-- Supabase SQL editor.
-- ─────────────────────────────────────────────

-- ── Plan catalog (PRODUCT-GLOBAL, not org-scoped) ────────────────────────────
-- Maps our Plan enum → the Razorpay Plan ID (created in the Razorpay dashboard,
-- price embedded there). amount_paise is display-only and optional — the source
-- of truth for the charge amount is Razorpay. Seeded by hand after creating the
-- plans in the dashboard; no rupee amounts are hardcoded in app code.
create table subscription_plans (
  id                uuid primary key default gen_random_uuid(),
  plan              text not null unique
                      check (plan in ('starter', 'growth', 'pro', 'enterprise')),
  razorpay_plan_id  text not null,                 -- e.g. 'plan_ABC123'
  billing_period    text not null default 'monthly'
                      check (billing_period in ('monthly', 'yearly')),
  amount_paise      integer,                        -- display only, nullable
  currency          text not null default 'INR',
  total_count       integer not null default 12,    -- mandate cycles (12 monthly = 1yr)
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger subscription_plans_updated_at
  before update on subscription_plans
  for each row execute function update_updated_at_column();

alter table subscription_plans enable row level security;

-- Any authenticated org member may read the catalog (to render the plan picker).
-- No write policy: seeded/updated via service-role / SQL editor only.
create policy "subscription_plans_select_members" on subscription_plans
  for select using (
    exists (select 1 from organization_members where user_id = auth.uid())
  );

-- ── Per-org subscription record ──────────────────────────────────────────────
create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null,
  plan                     text not null
                             check (plan in ('starter', 'growth', 'pro', 'enterprise')),
  razorpay_subscription_id text not null unique,
  razorpay_plan_id         text not null,
  -- Mirrors the Razorpay subscription entity status; superset of org statuses.
  status                   text not null default 'created'
                             check (status in ('created', 'authenticated', 'active',
                               'pending', 'halted', 'cancelled', 'completed', 'expired')),
  short_url                text,                     -- hosted checkout link
  current_period_end       timestamptz,             -- extended on subscription.charged
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_subscriptions_org on subscriptions (organization_id, created_at desc);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at_column();

alter table subscriptions enable row level security;

create policy "subscriptions_select_members" on subscriptions
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
-- No member write policy: subscribe route + webhook use service-role.

-- ── Idempotent event ledger + charge record ──────────────────────────────────
-- One row per verified Razorpay webhook event. razorpay_event_id (the
-- x-razorpay-event-id header, stable across retries) is the dedup key: the
-- webhook inserts here first; a unique-violation (23505) means "already
-- processed" → ack 200 and skip. Also the payment/invoice ledger for
-- subscription.charged events (amount_paise + payment id).
create table billing_events (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid,                    -- resolved from notes.organization_id; nullable if unknown
  razorpay_event_id        text not null unique,    -- dedup key
  event_type               text not null,
  razorpay_subscription_id text,
  razorpay_payment_id      text,
  amount_paise             integer,
  payload                  jsonb not null default '{}'::jsonb,
  processed_at             timestamptz not null default now()
);

create index idx_billing_events_org on billing_events (organization_id, processed_at desc);
create index idx_billing_events_sub on billing_events (razorpay_subscription_id);

alter table billing_events enable row level security;

create policy "billing_events_select_members" on billing_events
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
-- No member write policy: written only by the webhook via service-role.
