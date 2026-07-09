-- ─────────────────────────────────────────────
-- PHASE 3: PROPERTY-SCOPE STAFF & VENDORS
-- Staff work at one specific property (location-bound).
-- Vendors may serve one property or the whole org (nullable = org-wide).
-- ─────────────────────────────────────────────

-- Housekeeping staff are physically at a property — required scope.
-- No existing rows carry a property today, so clear before adding NOT NULL.
delete from housekeeping_staff;

alter table housekeeping_staff
  add column property_id uuid not null references properties(id) on delete cascade;

create index idx_housekeeping_staff_property on housekeeping_staff (property_id, status)
  where status = 'active';

-- Vendors may or may not be property-specific — nullable, null = org-wide.
alter table vendors
  add column property_id uuid references properties(id) on delete cascade;

create index idx_vendors_property on vendors (property_id) where property_id is not null;
