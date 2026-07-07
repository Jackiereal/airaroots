-- ─────────────────────────────────────────────
-- PHASE 1: CALENDAR BLOCKS + SEASONAL RATES
-- ─────────────────────────────────────────────

create type calendar_block_type as enum (
  'reservation', 'owner_hold', 'maintenance', 'buffer', 'seasonal_close'
);

-- ─────────────────────────────────────────────
-- CALENDAR BLOCKS
-- ─────────────────────────────────────────────
create table calendar_blocks (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  property_id     uuid not null references properties(id) on delete cascade,
  reservation_id  uuid references reservations(id) on delete cascade,

  start_date      date not null,
  end_date        date not null,  -- inclusive
  block_type      calendar_block_type not null default 'reservation',
  reason          text,
  is_public       boolean not null default true,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint calendar_blocks_end_after_start check (end_date >= start_date)
);

-- For fetching all blocks in a date range for a property
create index idx_calendar_blocks_property_dates
  on calendar_blocks (property_id, start_date, end_date);

-- For fetching all blocks in a date range for an org (multi-property calendar)
create index idx_calendar_blocks_org_dates
  on calendar_blocks (organization_id, start_date, end_date);

-- Unique: one block per reservation (prevents duplicate blocks)
create unique index calendar_blocks_reservation_unique
  on calendar_blocks (reservation_id)
  where reservation_id is not null;

create trigger calendar_blocks_updated_at
  before update on calendar_blocks
  for each row execute function update_updated_at_column();

alter table calendar_blocks enable row level security;

create policy "calendar_blocks_select_org" on calendar_blocks
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "calendar_blocks_insert_org" on calendar_blocks
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "calendar_blocks_update_org" on calendar_blocks
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "calendar_blocks_delete_org" on calendar_blocks
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- SEASONAL RATES
-- ─────────────────────────────────────────────
create table seasonal_rates (
  id            uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  property_id   uuid not null references properties(id) on delete cascade,
  name          text not null,
  start_date    date not null,
  end_date      date not null,
  nightly_rate  numeric(12,2) not null,
  min_nights    integer not null default 1,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint seasonal_rates_end_after_start check (end_date >= start_date),
  constraint seasonal_rates_min_nights_positive check (min_nights >= 1),
  constraint seasonal_rates_rate_positive check (nightly_rate > 0)
);

create index idx_seasonal_rates_property_dates
  on seasonal_rates (property_id, start_date, end_date)
  where is_active = true;

create trigger seasonal_rates_updated_at
  before update on seasonal_rates
  for each row execute function update_updated_at_column();

alter table seasonal_rates enable row level security;

create policy "seasonal_rates_select_org" on seasonal_rates
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "seasonal_rates_insert_org" on seasonal_rates
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "seasonal_rates_update_org" on seasonal_rates
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "seasonal_rates_delete_org" on seasonal_rates
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
