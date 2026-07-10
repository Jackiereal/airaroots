-- ─────────────────────────────────────────────
-- PHASE: PROPERTIES ORG SCOPING
-- properties table predates the org bridge (008) and still gates
-- access by user_profiles.role = 'admin'. This migration moves it
-- onto organization_id like housekeeping/vendors/inventory already are.
-- ─────────────────────────────────────────────

-- 1. Add organization_id (nullable first, backfill, then lock down)
-- No FK to an `organizations` table — none exists yet (008's bridge is a
-- stub: organization_id is just a UUID shared across user_profiles /
-- organization_members / housekeeping_staff / vendors / etc).
alter table properties
  add column if not exists organization_id uuid;

-- 2. Backfill from creator's personal org (set up by 008's bridge trigger)
update properties p
set organization_id = up.organization_id
from user_profiles up
where p.created_by = up.id
  and p.organization_id is null;

-- 3. Any property whose creator has no org (shouldn't happen post-008,
-- but guard against orphaned rows) gets a personal org bootstrapped
-- the same way 008's handle_new_user_org does (org_id = user_id).
do $$
declare
  r record;
begin
  for r in
    select id, created_by from properties where organization_id is null
  loop
    update user_profiles set organization_id = r.created_by where id = r.created_by;

    insert into organization_members (organization_id, user_id, role)
    values (r.created_by, r.created_by, 'owner')
    on conflict (organization_id, user_id) do nothing;

    update properties set organization_id = r.created_by where id = r.id;
  end loop;
end;
$$;

-- 4. Lock down now that every row is backfilled
alter table properties alter column organization_id set not null;

create index if not exists idx_properties_org on properties (organization_id);

-- 5. Replace admin-role RLS with org-scoped RLS (matches housekeeping/vendors pattern)
drop policy if exists "properties_admin_all" on properties;
drop policy if exists "properties_client_select" on properties;

create policy "properties_select_org" on properties
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
    or exists (select 1 from property_access where property_id = properties.id and user_id = auth.uid())
  );

create policy "properties_insert_org" on properties
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "properties_update_org" on properties
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "properties_delete_org" on properties
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
