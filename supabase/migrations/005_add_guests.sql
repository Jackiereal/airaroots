-- ─────────────────────────────────────────────
-- PHASE 1: GUESTS (basic — no full CRM yet)
-- ─────────────────────────────────────────────
create table guests (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  full_name       text not null,
  email           text,
  phone           text,
  nationality     text,
  notes           text,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Deduplication: one guest per email per org
create unique index guests_email_org_unique
  on guests (organization_id, lower(email))
  where email is not null;

create index idx_guests_org on guests (organization_id);
create index idx_guests_email on guests (lower(email)) where email is not null;

create trigger guests_updated_at
  before update on guests
  for each row execute function update_updated_at_column();

alter table guests enable row level security;

create policy "guests_select_org" on guests
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "guests_insert_org" on guests
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "guests_update_org" on guests
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- Add FK from reservations to guests now that guests table exists
alter table reservations
  add constraint reservations_guest_id_fk
  foreign key (guest_id) references guests(id) on delete set null;
