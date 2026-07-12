-- ─────────────────────────────────────────────
-- ORGANIZATIONS TABLE (Phase 8 minimal scope)
-- Until now there was no `organizations` table at all — `organization_id`
-- was a bare UUID (the owner's auth.users.id) shared across ~16 tables,
-- set by the 014 signup trigger. That's fine for a single internal tool,
-- but once other PMCs can sign up we need a real per-org identity row to
-- hold plan + trial + billing state, and to enforce plan limits.
--
-- Design: this table's `id` EQUALS the existing organization_id (owner's
-- auth uid). That makes every existing organization_id map 1:1 to a row
-- here with zero backfill on the other 16 tables, and no FKs are added to
-- them — the bare-UUID convention stays. Payment integration (Razorpay)
-- is deliberately NOT part of this migration; orgs run on a trial or a
-- manually-set plan for now.
-- ─────────────────────────────────────────────

create table organizations (
  id                  uuid primary key,   -- = organization_id / owner auth uid; set explicitly, no default
  name                text not null,
  plan                text not null default 'starter'
                        check (plan in ('starter', 'growth', 'pro', 'enterprise')),
  subscription_status text not null default 'trialing'
                        check (subscription_status in ('trialing', 'active', 'past_due', 'cancelled')),
  trial_ends_at       timestamptz not null default (now() + interval '14 days'),
  owner_user_id       uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Reuse the shared updated_at trigger function from 001.
create trigger organizations_updated_at
  before update on organizations
  for each row execute function update_updated_at_column();

alter table organizations enable row level security;

-- Any member of the org can read their org row.
create policy "organizations_select_members" on organizations
  for select using (
    id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- Only owner-role members can update. plan/subscription_status are expected
-- to change only via the service-role client (which bypasses RLS) — the app
-- exposes no plan/status write path this phase, so no column-guard is needed
-- yet. No insert/delete policy: rows are created solely by the SECURITY
-- DEFINER signup trigger (021) and the backfill below (service-role).
create policy "organizations_update_owner" on organizations
  for update using (
    id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Backfill: one row per DISTINCT organization_id in organization_members —
-- the authoritative set of live orgs. (user_profiles still holds orphaned
-- solo-org UUIDs from the 017 invite flow, so it is NOT the source here.)
-- Existing orgs are grandfathered to enterprise/active: unlimited
-- properties, no trial — so the live internal PMC org is never capped or
-- trial-expired by this rollout.
insert into organizations (id, name, plan, subscription_status, trial_ends_at, owner_user_id, created_at)
select
  m.organization_id,
  coalesce(up.full_name, 'Organization'),
  'enterprise',
  'active',
  now(),
  owner.user_id,
  now()
from (select distinct organization_id from organization_members) m
left join organization_members owner
  on owner.organization_id = m.organization_id and owner.role = 'owner'
left join user_profiles up on up.id = owner.user_id
on conflict (id) do nothing;
