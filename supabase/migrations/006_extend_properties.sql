-- ─────────────────────────────────────────────
-- PHASE 1: EXTEND PROPERTIES TABLE
-- ─────────────────────────────────────────────
alter table properties
  add column if not exists bedrooms          integer,
  add column if not exists bathrooms         numeric(3,1),
  add column if not exists max_guests        integer,
  add column if not exists check_in_time     time default '15:00',
  add column if not exists check_out_time    time default '11:00',
  add column if not exists base_nightly_rate numeric(12,2),
  add column if not exists cleaning_fee_default numeric(12,2) default 0,
  add column if not exists ical_token        uuid unique default uuid_generate_v4();

-- Every property gets a unique iCal token for Phase 2 export
-- Backfill any existing rows without a token
update properties set ical_token = uuid_generate_v4() where ical_token is null;
