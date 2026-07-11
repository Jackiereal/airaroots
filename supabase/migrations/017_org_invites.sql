-- ─────────────────────────────────────────────
-- ORG INVITES
-- Every signup currently bootstraps a solo personal org (014's
-- handle_new_user trigger) — there's no way to invite a teammate onto an
-- EXISTING org. This is the gap flagged in 014's own comment and confirmed
-- blocking multi-user usage this session.
--
-- Flow: org staff (owner/admin/manager) generates a link-based invite with
-- a chosen role. Invitee (new or existing user) visits /invite/{token},
-- signs in with Google as normal — the 014 trigger still fires and gives
-- them a solo org, that's unavoidable within Google OAuth's constraints —
-- then a post-login accept step moves them into the inviter's org and
-- deletes the now-empty solo org. Property access is NOT granted by the
-- invite; that's a separate step via the existing property_access flow,
-- consistent with the org-membership-does-not-imply-property-visibility
-- model from migration 015.
-- ─────────────────────────────────────────────

create table org_invites (
  id              uuid primary key default gen_random_uuid(),
  token           uuid not null default gen_random_uuid() unique,
  organization_id uuid not null,
  role            text not null check (role in ('owner', 'admin', 'manager', 'viewer')),
  created_by      uuid not null references auth.users(id),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  used_at         timestamptz,
  used_by         uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

create index idx_org_invites_org on org_invites (organization_id);
create index idx_org_invites_token on org_invites (token) where used_at is null;

alter table org_invites enable row level security;

-- Org staff (owner/admin/manager) can see and create invites for their own org.
create policy "org_invites_select_org_staff" on org_invites
  for select using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
  );

create policy "org_invites_insert_org_staff" on org_invites
  for insert with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
    and created_by = auth.uid()
  );

create policy "org_invites_delete_org_staff" on org_invites
  for delete using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
  );

-- Anyone authenticated can look up a single invite by its token to preview
-- it before accepting (org name, role) — token is the access control here,
-- not org membership. Consumption (marking used_at) happens through a
-- SECURITY DEFINER function below, not a direct UPDATE policy, so a bare
-- "can I see this row" grant doesn't also mean "can I redeem it."
create policy "org_invites_select_by_token" on org_invites
  for select using (used_at is null and expires_at > now());

-- Redeem an invite: moves the calling user into the invite's org with the
-- invite's role, marks the invite used, and deletes the user's old
-- personal org membership + org_members row (their solo org from 014's
-- trigger becomes orphaned/empty — harmless, not deleted here to avoid
-- touching the properties/other tables that might reference it; a
-- follow-up cleanup job can garbage-collect empty orgs later).
create or replace function accept_org_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite org_invites%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_invite from org_invites
  where token = p_token and used_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'invite not found or expired';
  end if;

  update org_invites set used_at = now(), used_by = v_uid where id = v_invite.id;

  update user_profiles set organization_id = v_invite.organization_id where id = v_uid;

  insert into organization_members (organization_id, user_id, role)
  values (v_invite.organization_id, v_uid, v_invite.role)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  return jsonb_build_object('organization_id', v_invite.organization_id, 'role', v_invite.role);
end;
$$;
