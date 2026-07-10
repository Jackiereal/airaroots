-- ─────────────────────────────────────────────
-- SIGNUP TRIGGER CONSOLIDATION
-- Before: two chained triggers (on_auth_user_created -> handle_new_user,
-- then on_user_profile_created -> handle_new_user_org) plus the app's
-- /auth/callback route ALSO manually inserts user_profiles as a fallback.
-- Three writers racing on the same row. The callback's existence check
-- (select-then-insert) races the trigger, so "is this a new signup"
-- can't be answered reliably from the app side -> new users sometimes
-- skip /onboarding.
--
-- After: a single trigger on auth.users does profile + org bootstrap in
-- one transaction. The app never inserts user_profiles itself.
-- ─────────────────────────────────────────────

-- 1. Drop the second-hop trigger/function (008) — folded into handle_new_user below.
drop trigger if exists on_user_profile_created on public.user_profiles;
drop function if exists handle_new_user_org();

-- 2. Replace handle_new_user (001) with the consolidated version.
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
    new.id -- personal org bootstrap; org_invites (015) will move invited users onto an existing org
  )
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (organization_id, user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger already exists from 001 (on_auth_user_created); create or replace
-- function is enough, but re-assert in case it was ever dropped manually.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 3. Helper the callback route can call instead of select-then-insert:
-- true only on the exact row the trigger just created (created_at within
-- the current transaction's clock skew window), so the app can tell new
-- vs returning signups without racing the trigger.
create or replace function is_new_signup(p_user_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from user_profiles
    where id = p_user_id
    and created_at > now() - interval '10 seconds'
  )
$$;
