-- ─────────────────────────────────────────────
-- COLLAPSE SOLO + SMALL INTO ONE "OWNER" TIER
--
-- CFO re-analysis: the solo(1 prop)/small(2-3 prop) split at ₹299/₹499
-- was over-segmentation — a ₹200/mo gap distinguishing 1 property from
-- 3 isn't two products, and pure 1-property owners are the weakest
-- segment (lowest WTP, worst retention, highest support-cost-per-rupee).
-- Collapsing to a single Owner tier (1-3 properties, ₹499/mo) and
-- concentrating go-to-market on 2-3 property owners + small PMCs.
--
-- No live paying subscribers exist on 'solo' or 'small' (confirmed with
-- product owner before writing this migration) — clean schema change,
-- no subscriber remapping/consent flow needed. New live-mode Razorpay
-- plan IDs created fresh for all three self-serve tiers (Owner/Growth/
-- Pro), not reusing the old test-mode IDs from migration 025.
--
-- Resulting 4 tiers: owner (1-3) / growth (4-10) / pro (11-25) /
-- enterprise (25+, custom, no subscription_plans row — contact-us only,
-- same as before this migration).
-- ─────────────────────────────────────────────

-- ── organizations ────────────────────────────────────────────────────────────
alter table organizations drop constraint organizations_plan_check;

update organizations set plan = 'owner' where plan in ('solo', 'small');

alter table organizations
  alter column plan set default 'owner',
  add constraint organizations_plan_check
    check (plan in ('owner', 'growth', 'pro', 'enterprise'));

-- ── subscription_plans ───────────────────────────────────────────────────────
-- Drop constraint first (same pattern as organizations above). The old
-- solo/small catalog rows are deleted outright rather than renamed —
-- 'plan' is unique, so two rows can't both become 'owner', and there's
-- no FK from subscriptions into subscription_plans (subscriptions is a
-- ledger that records the plan value directly, not a reference — see
-- migration 025's own comment on this).
alter table subscription_plans drop constraint subscription_plans_plan_check;

delete from subscription_plans where plan in ('solo', 'small', 'growth', 'pro');

alter table subscription_plans
  add constraint subscription_plans_plan_check
    check (plan in ('owner', 'growth', 'pro', 'enterprise'));

-- Fresh live-mode Razorpay plan IDs (created 2026-07-29).
insert into subscription_plans (plan, razorpay_plan_id, billing_period, amount_paise, currency, total_count, is_active)
values
  ('owner',  'plan_TJPbhs7jy9tMV3', 'monthly', 49900,  'INR', 12, true),
  ('growth', 'plan_TJPc1POUYUrxQt', 'monthly', 199900, 'INR', 12, true),
  ('pro',    'plan_TJPcDiVsaPtNZM', 'monthly', 499900, 'INR', 12, true);

-- ── subscriptions ────────────────────────────────────────────────────────────
-- Ledger table — historical rows keep recording whatever plan was
-- actually purchased at the time. Widen the constraint to accept the
-- new slug but keep old slugs valid for existing history (no data remap).
alter table subscriptions drop constraint subscriptions_plan_check;
alter table subscriptions
  add constraint subscriptions_plan_check
    check (plan in ('owner', 'growth', 'pro', 'enterprise', 'solo', 'small'));

-- ── signup trigger: new orgs default to owner, not solo ──────────────────────
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
    'owner',
    'trialing',
    now() + interval '14 days',
    new.id
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
