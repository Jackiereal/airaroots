-- ─────────────────────────────────────────────
-- SIGNUP TRIGGER: BOOTSTRAP ORGANIZATIONS ROW (Phase 8)
-- 020 added the organizations table + backfilled existing orgs. New
-- signups also need an organizations row created alongside their
-- user_profiles + organization_members rows. Re-declare handle_new_user()
-- (Postgres has no partial function replace) keeping 014's two existing
-- inserts and adding a third, all in the same transaction.
--
-- New orgs start on a Starter 14-day trial. The trigger is idempotent
-- (on conflict do nothing) and unchanged in trigger wiring — only the
-- function body is swapped, so the existing on_auth_user_created trigger
-- from 001/014 keeps pointing at it.
-- ─────────────────────────────────────────────

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
    new.id -- personal org bootstrap; org_invites (017) will move invited users onto an existing org
  )
  on conflict (id) do nothing;

  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (organization_id, user_id) do nothing;

  -- Phase 8: bootstrap the org identity/trial row. Starter, 14-day trial.
  -- An invited user's solo org still gets a row here, then the invite flow
  -- (017) moves them onto the inviter's org, leaving this solo org row
  -- orphaned — harmless, consistent with the existing orphaned solo-org
  -- behavior; cleanup deferred.
  insert into public.organizations (id, name, plan, subscription_status, trial_ends_at, owner_user_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'starter',
    'trialing',
    now() + interval '14 days',
    new.id
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;
