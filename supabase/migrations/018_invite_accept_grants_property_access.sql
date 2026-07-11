-- ─────────────────────────────────────────────
-- INVITE ACCEPT NOW GRANTS PROPERTY ACCESS
-- Bug found after 017 shipped: accepting an org invite only wrote
-- organization_members.role + user_profiles.organization_id, never a
-- property_access row (by design per 017's own comment — org membership
-- was meant to stay decoupled from property visibility, per 015's model).
-- In practice this meant a freshly-invited owner had zero property_access
-- rows, so hasAnyPropertyAccess() (lib/auth.ts) returned false and every
-- route gated on it (app/page.tsx, app/dashboard/layout.tsx,
-- app/properties/layout.tsx) sent them to /client/dashboard — a
-- read-only landing page — despite being org owner.
--
-- Fix: accept_org_invite() now also grants property_access on every
-- existing property in the org, mapped from the invited org role:
--   owner/admin/manager -> property_access.role = 'admin' (read/write)
--   viewer               -> property_access.role = 'client' (read-only)
-- This matches who could already create/manage properties at the org
-- level (owner/admin/manager) versus who's read-only (viewer). Future
-- properties created after the invite still need their own grant, same
-- as any other org member — this only backfills what exists at accept
-- time.
-- ─────────────────────────────────────────────

create or replace function accept_org_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite org_invites%rowtype;
  v_uid uuid := auth.uid();
  v_property_role text;
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

  v_property_role := case when v_invite.role = 'viewer' then 'client' else 'admin' end;

  insert into property_access (property_id, user_id, granted_by, role)
  select p.id, v_uid, v_invite.created_by, v_property_role
  from properties p
  where p.organization_id = v_invite.organization_id
  on conflict (property_id, user_id) do update set role = excluded.role;

  return jsonb_build_object('organization_id', v_invite.organization_id, 'role', v_invite.role);
end;
$$;
