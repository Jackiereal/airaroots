-- ─────────────────────────────────────────────
-- RENAME PLAN TIERS: starter/growth/pro/enterprise → solo/small/growth/pro/enterprise
--
-- New 5-tier pricing (2026-07-21 CFO pass, see project_pricing_strategy memory):
-- Solo (1 prop) / Small (2-3) / Growth (4-10) / Pro (11-25) / Enterprise (25+).
-- Old 'starter' (5 props) and old 'growth' (25 props) caps are retired — the
-- new 'growth' means something different (4-10, not 25). 'pro' keeps its slug
-- but changes meaning too: old pro was 100-cap/contact-us-adjacent, new pro is
-- 11-25/self-serve.
--
-- Existing rows: any org currently on 'starter' maps to the closest new tier
-- by property count (not blindly to 'solo', since some orgs may have 2-5
-- properties already on a 'starter' trial/plan). Enterprise-grandfathered orgs
-- (plan='enterprise') are untouched — that slug is unchanged.
-- ─────────────────────────────────────────────

-- ── organizations ────────────────────────────────────────────────────────────
alter table organizations drop constraint organizations_plan_check;

-- Remap existing rows by actual property count so nobody gets a cap below
-- what they're already using. Fail-safe default (no properties / unknown) is
-- 'solo', matching the app's fail-closed-to-tightest-tier convention.
update organizations o
set plan = case
  when o.plan = 'enterprise' then 'enterprise'
  when o.plan = 'pro' then 'pro' -- old pro (100 cap) orgs stay pro (now 11-25 meaning) — manual review if any exceed 25
  else (
    select case
      when cnt <= 1 then 'solo'
      when cnt <= 3 then 'small'
      when cnt <= 10 then 'growth'
      else 'pro'
    end
    from (select count(*) as cnt from properties p where p.organization_id = o.id) c
  )
end
where o.plan in ('starter', 'growth', 'pro');

alter table organizations
  alter column plan set default 'solo',
  add constraint organizations_plan_check
    check (plan in ('solo', 'small', 'growth', 'pro', 'enterprise'));

-- ── subscription_plans ───────────────────────────────────────────────────────
-- Drop the constraint FIRST (same pattern as organizations above) so the
-- table is unconstrained while we rename 'starter' rows — then add the
-- tightened constraint last, after data is already migrated.
alter table subscription_plans drop constraint subscription_plans_plan_check;

update subscription_plans set plan = 'solo', is_active = false where plan = 'starter';

alter table subscription_plans
  add constraint subscription_plans_plan_check
    check (plan in ('solo', 'small', 'growth', 'pro', 'enterprise'));

-- Seed/refresh the 4 self-serve tiers. Razorpay plan_ids created 2026-07-21.
-- The old-starter row (now plan='solo', is_active=false) conflicts on the
-- unique plan slug — this upsert reactivates it with the new price/plan_id.
insert into subscription_plans (plan, razorpay_plan_id, billing_period, amount_paise, currency, total_count, is_active)
values
  ('solo',   'plan_TG8Si41WJShLUc', 'monthly', 29900,  'INR', 12, true),
  ('small',  'plan_TG8TqFqVn42K9f', 'monthly', 49900,  'INR', 12, true),
  ('growth', 'plan_TG8U4dSJKD3us5', 'monthly', 199900, 'INR', 12, true),
  ('pro',    'plan_TG8UIud5iH0B8S', 'monthly', 499900, 'INR', 12, true)
on conflict (plan) do update set
  razorpay_plan_id = excluded.razorpay_plan_id,
  amount_paise = excluded.amount_paise,
  is_active = true,
  updated_at = now();

-- ── subscriptions ────────────────────────────────────────────────────────────
alter table subscriptions drop constraint subscriptions_plan_check;
alter table subscriptions
  add constraint subscriptions_plan_check
    check (plan in ('solo', 'small', 'growth', 'pro', 'enterprise'));
-- No data remap needed here: historical subscription rows keep recording
-- whatever plan was actually purchased at the time (a ledger, not live state).

-- ── signup trigger: new orgs default to solo, not starter ───────────────────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, full_name, organization_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.id
  )
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (organization_id, user_id) do nothing;

  insert into public.organizations (id, name, plan, subscription_status, trial_ends_at, owner_user_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'solo',
    'trialing',
    now() + interval '14 days',
    new.id
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
