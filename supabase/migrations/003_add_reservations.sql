-- ─────────────────────────────────────────────
-- PHASE 1: RESERVATIONS + RESERVATION EVENTS
-- ─────────────────────────────────────────────

-- Channel enum
create type reservation_channel as enum (
  'airbnb', 'booking_com', 'direct', 'vrbo', 'expedia', 'other'
);

-- Status enum
create type reservation_status as enum (
  'inquiry', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'conflict'
);

-- ─────────────────────────────────────────────
-- RESERVATIONS
-- ─────────────────────────────────────────────
create table reservations (
  id                   uuid primary key default uuid_generate_v4(),
  organization_id      uuid not null,
  property_id          uuid not null references properties(id) on delete restrict,
  guest_id             uuid,  -- FK added after guests table created (migration 005)

  -- Channel
  channel              reservation_channel not null default 'direct',
  platform_booking_id  text,  -- External booking reference (Airbnb confirmation code, etc.)

  -- Dates
  check_in             date not null,
  check_out            date not null,
  nights               integer generated always as (check_out - check_in) stored,

  -- Guests
  adults               integer not null default 1,
  children             integer not null default 0,
  pets                 integer not null default 0,

  -- Status
  status               reservation_status not null default 'confirmed',

  -- Financials (locked at booking time)
  nightly_rate         numeric(12,2) not null default 0,
  cleaning_fee         numeric(12,2) not null default 0,
  taxes                numeric(12,2) not null default 0,
  other_fees           numeric(12,2) not null default 0,
  gross_revenue        numeric(12,2) generated always as (
                         nightly_rate * (check_out - check_in) + cleaning_fee + taxes + other_fees
                       ) stored,
  platform_commission  numeric(12,2) not null default 0,
  net_payout           numeric(12,2) generated always as (
                         nightly_rate * (check_out - check_in) + cleaning_fee + taxes + other_fees - platform_commission
                       ) stored,

  -- Denormalized guest info for quick display
  guest_name           text,
  guest_email          text,
  guest_phone          text,

  -- Metadata
  notes                text,
  raw_payload          jsonb,  -- Original channel payload — immutable

  -- Audit
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,  -- Soft delete only

  -- Constraints
  constraint reservations_checkout_after_checkin check (check_out > check_in),
  constraint reservations_adults_positive check (adults >= 1)
);

-- Unique: one platform booking ID per organization (prevents duplicate sync)
create unique index reservations_platform_booking_id_unique
  on reservations (organization_id, platform_booking_id)
  where platform_booking_id is not null and deleted_at is null;

-- Indexes for common queries
create index idx_reservations_property_checkin
  on reservations (property_id, check_in)
  where deleted_at is null;

create index idx_reservations_org_status
  on reservations (organization_id, status)
  where deleted_at is null;

create index idx_reservations_guest_id
  on reservations (guest_id)
  where guest_id is not null and deleted_at is null;

-- Conflict detection index: find overlapping reservations fast
create index idx_reservations_conflict_check
  on reservations (property_id, check_in, check_out)
  where deleted_at is null and status not in ('cancelled', 'no_show');

-- updated_at trigger
create trigger reservations_updated_at
  before update on reservations
  for each row execute function update_updated_at_column();

-- RLS
alter table reservations enable row level security;

-- Users can read reservations belonging to their organization
create policy "reservations_select_org" on reservations
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "reservations_insert_org" on reservations
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "reservations_update_org" on reservations
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- No delete policy — soft delete only

-- ─────────────────────────────────────────────
-- RESERVATION EVENTS (audit log)
-- ─────────────────────────────────────────────
create table reservation_events (
  id             uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  organization_id uuid not null,
  event_type     text not null,  -- 'created', 'status_changed', 'modified', 'cancelled', etc.
  from_status    reservation_status,
  to_status      reservation_status,
  actor_id       uuid references auth.users(id) on delete set null,
  notes          text,
  metadata       jsonb,
  occurred_at    timestamptz not null default now()
);

create index idx_reservation_events_reservation
  on reservation_events (reservation_id, occurred_at desc);

alter table reservation_events enable row level security;

create policy "reservation_events_select_org" on reservation_events
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "reservation_events_insert_org" on reservation_events
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
