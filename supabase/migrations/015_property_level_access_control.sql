-- ─────────────────────────────────────────────
-- PROPERTY-LEVEL ACCESS CONTROL
-- Bug: "admin" has always meant global admin (user_profiles.role='admin'),
-- never property-scoped. 001's properties_admin_all/pf_*_admin_all/
-- property_owners_admin_all policies bypass property_access entirely for
-- any global admin. 013 added org scoping but kept the same shape — an
-- org member sees every property in the org via properties_select_org's
-- org-membership OR clause, and every operational table (housekeeping,
-- maintenance, vendors, inventory, reservations, calendar, channels)
-- only ever checked org membership, never property_access at all.
--
-- Model going forward (two independent axes):
--   organization_members.role (owner/admin/manager/viewer) = org staff
--   hierarchy. Governs org-level actions: create properties, manage
--   billing, grant/revoke property_access. Does NOT grant property data
--   visibility by itself.
--
--   property_access.role (admin/client), new column here = per-property
--   grant. admin = read/write on that property's data. client = read
--   only. No grant = no visibility, full stop, regardless of org role.
--   Multiple admins can be granted the same property; an admin granted
--   only property A never sees property B even if both are in-org.
-- ─────────────────────────────────────────────

-- 1. property_access gets a role column.
alter table property_access
  add column if not exists role text not null default 'client' check (role in ('admin', 'client'));

-- 1b. Backfill: every existing property's creator gets an admin grant on
-- their own property. Without this, existing properties (property_access
-- has 0 rows today) become invisible to everyone once the org-membership
-- OR clause is removed below — including the person who made them.
insert into property_access (property_id, user_id, granted_by, role)
select p.id, p.created_by, p.created_by, 'admin'
from properties p
on conflict (property_id, user_id) do update set role = 'admin';

-- 2. Drop every policy that reads user_profiles.role (the dead global-admin
-- bypass) or grants org-wide visibility without a property_access check.
drop policy if exists "properties_admin_all" on properties;
drop policy if exists "properties_client_select" on properties;
drop policy if exists "properties_select_org" on properties;
drop policy if exists "properties_insert_org" on properties;
drop policy if exists "properties_update_org" on properties;
drop policy if exists "properties_delete_org" on properties;

drop policy if exists "property_owners_admin_all" on property_owners;
drop policy if exists "property_owners_client_select" on property_owners;

drop policy if exists "property_access_admin_all" on property_access;
drop policy if exists "property_access_client_select_own" on property_access;

drop policy if exists "pf_expenses_admin_all" on property_finance_expenses;
drop policy if exists "pf_expenses_client_select" on property_finance_expenses;
drop policy if exists "pf_direct_bookings_admin_all" on property_finance_direct_bookings;
drop policy if exists "pf_direct_bookings_client_select" on property_finance_direct_bookings;
drop policy if exists "pf_airbnb_rows_admin_all" on property_finance_airbnb_rows;
drop policy if exists "pf_airbnb_rows_client_select" on property_finance_airbnb_rows;
drop policy if exists "pf_loans_admin_all" on property_finance_loans;
drop policy if exists "pf_loans_client_select" on property_finance_loans;

drop policy if exists "housekeeping_staff_select_org" on housekeeping_staff;
drop policy if exists "housekeeping_staff_insert_org" on housekeeping_staff;
drop policy if exists "housekeeping_staff_update_org" on housekeeping_staff;
drop policy if exists "housekeeping_staff_delete_org" on housekeeping_staff;

drop policy if exists "housekeeping_tasks_select_org" on housekeeping_tasks;
drop policy if exists "housekeeping_tasks_insert_org" on housekeeping_tasks;
drop policy if exists "housekeeping_tasks_update_org" on housekeeping_tasks;
drop policy if exists "housekeeping_tasks_delete_org" on housekeeping_tasks;

drop policy if exists "housekeeping_photos_select_org" on housekeeping_photos;
drop policy if exists "housekeeping_photos_insert_org" on housekeeping_photos;

drop policy if exists "maintenance_requests_select_org" on maintenance_requests;
drop policy if exists "maintenance_requests_insert_org" on maintenance_requests;
drop policy if exists "maintenance_requests_update_org" on maintenance_requests;
drop policy if exists "maintenance_requests_delete_org" on maintenance_requests;

drop policy if exists "maintenance_photos_select_org" on maintenance_photos;
drop policy if exists "maintenance_photos_insert_org" on maintenance_photos;

drop policy if exists "inventory_items_select_org" on inventory_items;
drop policy if exists "inventory_items_insert_org" on inventory_items;
drop policy if exists "inventory_items_update_org" on inventory_items;
drop policy if exists "inventory_items_delete_org" on inventory_items;

drop policy if exists "inventory_transactions_select_org" on inventory_transactions;
drop policy if exists "inventory_transactions_insert_org" on inventory_transactions;

drop policy if exists "vendors_select_org" on vendors;
drop policy if exists "vendors_insert_org" on vendors;
drop policy if exists "vendors_update_org" on vendors;
drop policy if exists "vendors_delete_org" on vendors;

drop policy if exists "reservations_select_org" on reservations;
drop policy if exists "reservations_insert_org" on reservations;
drop policy if exists "reservations_update_org" on reservations;

drop policy if exists "calendar_blocks_select_org" on calendar_blocks;
drop policy if exists "calendar_blocks_insert_org" on calendar_blocks;
drop policy if exists "calendar_blocks_update_org" on calendar_blocks;
drop policy if exists "calendar_blocks_delete_org" on calendar_blocks;

drop policy if exists "seasonal_rates_select_org" on seasonal_rates;
drop policy if exists "seasonal_rates_insert_org" on seasonal_rates;
drop policy if exists "seasonal_rates_update_org" on seasonal_rates;
drop policy if exists "seasonal_rates_delete_org" on seasonal_rates;

drop policy if exists "channel_connections_select_org" on channel_connections;
drop policy if exists "channel_connections_insert_org" on channel_connections;
drop policy if exists "channel_connections_update_org" on channel_connections;
drop policy if exists "channel_connections_delete_org" on channel_connections;

drop policy if exists "channel_sync_logs_select_org" on channel_sync_logs;
drop policy if exists "channel_sync_logs_insert_org" on channel_sync_logs;

-- 3. property_access itself: visible to the grantee (their own row) and to
-- org staff (manager+) for any property in their org. Grant/revoke is an
-- org-staff action, not a property_access-holder action — a property admin
-- does not automatically get to add other people to that property.
create policy "property_access_select_own_or_org_staff" on property_access
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from properties p
      join organization_members om on om.organization_id = p.organization_id
      where p.id = property_access.property_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
  );

create policy "property_access_insert_org_staff" on property_access
  for insert with check (
    exists (
      select 1 from properties p
      join organization_members om on om.organization_id = p.organization_id
      where p.id = property_access.property_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
  );

create policy "property_access_delete_org_staff" on property_access
  for delete using (
    exists (
      select 1 from properties p
      join organization_members om on om.organization_id = p.organization_id
      where p.id = property_access.property_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin', 'manager')
    )
  );

-- 4. properties: visibility and writes both require an explicit
-- property_access grant. Org membership alone no longer grants anything.
-- INSERT stays org-scoped (creating a property is an org action; the
-- creating route is responsible for inserting the creator's own
-- property_access admin row in the same transaction — see app code).
create policy "properties_select_access" on properties
  for select using (
    exists (
      select 1 from property_access pa
      where pa.property_id = properties.id and pa.user_id = auth.uid()
    )
  );

create policy "properties_insert_org" on properties
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "properties_update_access_admin" on properties
  for update using (
    exists (
      select 1 from property_access pa
      where pa.property_id = properties.id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  );

create policy "properties_delete_access_admin" on properties
  for delete using (
    exists (
      select 1 from property_access pa
      where pa.property_id = properties.id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  );

-- 5. property_owners: same shape as properties (read = any grant, write = admin grant).
create policy "property_owners_select_access" on property_owners
  for select using (
    exists (
      select 1 from property_access pa
      where pa.property_id = property_owners.property_id and pa.user_id = auth.uid()
    )
  );

create policy "property_owners_write_access_admin" on property_owners
  for all using (
    exists (
      select 1 from property_access pa
      where pa.property_id = property_owners.property_id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from property_access pa
      where pa.property_id = property_owners.property_id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  );

-- 6. Finance tables: read = any grant, write = admin grant. Same shape x4.
do $$
declare
  t text;
begin
  foreach t in array array[
    'property_finance_expenses',
    'property_finance_direct_bookings',
    'property_finance_airbnb_rows',
    'property_finance_loans'
  ]
  loop
    execute format(
      'create policy "%s_select_access" on %I for select using (exists (select 1 from property_access pa where pa.property_id = %I.property_id and pa.user_id = auth.uid()))',
      t, t, t
    );
    execute format(
      'create policy "%s_write_access_admin" on %I for all using (exists (select 1 from property_access pa where pa.property_id = %I.property_id and pa.user_id = auth.uid() and pa.role = ''admin'')) with check (exists (select 1 from property_access pa where pa.property_id = %I.property_id and pa.user_id = auth.uid() and pa.role = ''admin''))',
      t, t, t, t
    );
  end loop;
end;
$$;

-- 7. Operational tables with a direct, NOT NULL property_id: same shape.
-- (reservations, calendar_blocks, seasonal_rates, channel_connections,
-- housekeeping_staff, housekeeping_tasks, maintenance_requests,
-- inventory_items). Read = any grant, write = admin grant.
do $$
declare
  t text;
begin
  foreach t in array array[
    'reservations',
    'calendar_blocks',
    'seasonal_rates',
    'channel_connections',
    'housekeeping_staff',
    'housekeeping_tasks',
    'maintenance_requests',
    'inventory_items'
  ]
  loop
    execute format(
      'create policy "%s_select_access" on %I for select using (exists (select 1 from property_access pa where pa.property_id = %I.property_id and pa.user_id = auth.uid()))',
      t, t, t
    );
    execute format(
      'create policy "%s_write_access_admin" on %I for all using (exists (select 1 from property_access pa where pa.property_id = %I.property_id and pa.user_id = auth.uid() and pa.role = ''admin'')) with check (exists (select 1 from property_access pa where pa.property_id = %I.property_id and pa.user_id = auth.uid() and pa.role = ''admin''))',
      t, t, t, t
    );
  end loop;
end;
$$;

-- 8. vendors: property_id is nullable (org-wide vendors allowed per 011).
-- NULL property_id -> org-membership gate (any org member can see/use a
-- shared vendor). Non-null -> property_access gate like everything else.
create policy "vendors_select_access" on vendors
  for select using (
    (property_id is null and organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    ))
    or (property_id is not null and exists (
      select 1 from property_access pa where pa.property_id = vendors.property_id and pa.user_id = auth.uid()
    ))
  );

create policy "vendors_write_access_admin" on vendors
  for all using (
    (property_id is null and organization_id in (
      select organization_id from organization_members where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    ))
    or (property_id is not null and exists (
      select 1 from property_access pa where pa.property_id = vendors.property_id and pa.user_id = auth.uid() and pa.role = 'admin'
    ))
  ) with check (
    (property_id is null and organization_id in (
      select organization_id from organization_members where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    ))
    or (property_id is not null and exists (
      select 1 from property_access pa where pa.property_id = vendors.property_id and pa.user_id = auth.uid() and pa.role = 'admin'
    ))
  );

-- 9. Joined-through tables: gate via the parent's property_id.
create policy "housekeeping_photos_select_access" on housekeeping_photos
  for select using (
    exists (
      select 1 from housekeeping_tasks ht
      join property_access pa on pa.property_id = ht.property_id
      where ht.id = housekeeping_photos.task_id and pa.user_id = auth.uid()
    )
  );
create policy "housekeeping_photos_insert_access" on housekeeping_photos
  for insert with check (
    exists (
      select 1 from housekeeping_tasks ht
      join property_access pa on pa.property_id = ht.property_id
      where ht.id = housekeeping_photos.task_id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  );

create policy "maintenance_photos_select_access" on maintenance_photos
  for select using (
    exists (
      select 1 from maintenance_requests mr
      join property_access pa on pa.property_id = mr.property_id
      where mr.id = maintenance_photos.request_id and pa.user_id = auth.uid()
    )
  );
create policy "maintenance_photos_insert_access" on maintenance_photos
  for insert with check (
    exists (
      select 1 from maintenance_requests mr
      join property_access pa on pa.property_id = mr.property_id
      where mr.id = maintenance_photos.request_id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  );

create policy "inventory_transactions_select_access" on inventory_transactions
  for select using (
    exists (
      select 1 from inventory_items ii
      join property_access pa on pa.property_id = ii.property_id
      where ii.id = inventory_transactions.item_id and pa.user_id = auth.uid()
    )
  );
create policy "inventory_transactions_insert_access" on inventory_transactions
  for insert with check (
    exists (
      select 1 from inventory_items ii
      join property_access pa on pa.property_id = ii.property_id
      where ii.id = inventory_transactions.item_id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  );

create policy "channel_sync_logs_select_access" on channel_sync_logs
  for select using (
    exists (
      select 1 from channel_connections cc
      join property_access pa on pa.property_id = cc.property_id
      where cc.id = channel_sync_logs.connection_id and pa.user_id = auth.uid()
    )
  );
create policy "channel_sync_logs_insert_access" on channel_sync_logs
  for insert with check (
    exists (
      select 1 from channel_connections cc
      join property_access pa on pa.property_id = cc.property_id
      where cc.id = channel_sync_logs.connection_id and pa.user_id = auth.uid() and pa.role = 'admin'
    )
  );

-- 10. audit_log_admin_select was the last RLS policy reading user_profiles.role;
-- repoint it at organization_members.
drop policy if exists "audit_log_admin_select" on audit_log;
create policy "audit_log_select_org_staff" on audit_log
  for select using (
    exists (
      select 1 from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
  );

-- NOTE: user_profiles.role ('admin'/'client') is NOT dropped here.
-- app code (lib/auth.ts requireAdmin/requirePropertyAccess, 4 layout
-- redirects, app/page.tsx's ad-hoc post-login routing query, and the
-- admin/users role-management UI + its PATCH route) still reads/writes
-- it. Column becomes dead weight only after that follow-up pass lands —
-- drop it in a later migration, not this one.
