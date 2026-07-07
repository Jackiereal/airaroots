-- ─────────────────────────────────────────────
-- PHASE 1: LINK RESERVATIONS TO FINANCE
-- ─────────────────────────────────────────────
-- Allow system-generated finance entries (no actor) by making created_by nullable
alter table property_finance_direct_bookings
  alter column created_by drop not null;

-- Link direct booking rows to the reservation that generated them
alter table property_finance_direct_bookings
  add column if not exists reservation_id uuid references reservations(id) on delete set null,
  add column if not exists source text default 'manual' check (source in ('manual', 'reservation_engine'));

create unique index pf_direct_bookings_reservation_unique
  on property_finance_direct_bookings (reservation_id)
  where reservation_id is not null;

create index idx_pf_direct_bookings_reservation on property_finance_direct_bookings (reservation_id)
  where reservation_id is not null;
