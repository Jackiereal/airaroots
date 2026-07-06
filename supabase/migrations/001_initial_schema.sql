-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Trigger function for updated_at (shared)
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────
-- USER PROFILES
-- ─────────────────────────────────────────────
create table user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client' check (role in ('admin', 'client')),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on new user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS
alter table user_profiles enable row level security;
create policy "user_profiles_select_own" on user_profiles
  for select using (auth.uid() = id);
create policy "user_profiles_update_own" on user_profiles
  for update using (auth.uid() = id);

-- ─────────────────────────────────────────────
-- PROPERTIES
-- ─────────────────────────────────────────────
create table properties (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  address     text,
  description text,
  platform    text not null default 'airbnb' check (platform in ('airbnb', 'direct', 'mixed')),
  created_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now()
);

alter table properties enable row level security;

-- Admins: full access; clients: read via property_access
create policy "properties_admin_all" on properties
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );

create policy "properties_client_select" on properties
  for select using (
    exists (select 1 from property_access where property_id = properties.id and user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- PROPERTY OWNERS (co-owners for OOP tracking)
-- ─────────────────────────────────────────────
create table property_owners (
  id          uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  name        text not null,
  user_id     uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

alter table property_owners enable row level security;
create policy "property_owners_admin_all" on property_owners
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );
create policy "property_owners_client_select" on property_owners
  for select using (
    exists (select 1 from property_access where property_id = property_owners.property_id and user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- PROPERTY ACCESS (client → property mapping)
-- ─────────────────────────────────────────────
create table property_access (
  id          uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  granted_by  uuid not null references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (property_id, user_id)
);

alter table property_access enable row level security;
create policy "property_access_admin_all" on property_access
  for all using (
    exists (select 1 from user_profiles where id = auth.uid() and role = 'admin')
  );
create policy "property_access_client_select_own" on property_access
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- PROPERTY FINANCE EXPENSES
-- ─────────────────────────────────────────────
create table property_finance_expenses (
  id            uuid primary key default uuid_generate_v4(),
  property_id   uuid not null references properties(id) on delete cascade,
  period_month  date not null,
  expense_type  text not null,
  amount        numeric(14,2) not null check (amount >= 0),
  expense_date  date,
  notes         text,
  paid_from     text not null default 'self' check (paid_from in ('self', 'out_of_pocket')),
  owner_id      uuid references property_owners(id),
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  constraint chk_oop check (
    (paid_from = 'self' and owner_id is null) or
    (paid_from = 'out_of_pocket' and owner_id is not null)
  )
);

create index idx_pf_expenses_property_period on property_finance_expenses(property_id, period_month);

alter table property_finance_expenses enable row level security;
create policy "pf_expenses_admin_all" on property_finance_expenses
  for all using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "pf_expenses_client_select" on property_finance_expenses
  for select using (exists (select 1 from property_access where property_id = property_finance_expenses.property_id and user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- PROPERTY FINANCE DIRECT BOOKINGS
-- ─────────────────────────────────────────────
create table property_finance_direct_bookings (
  id            uuid primary key default uuid_generate_v4(),
  property_id   uuid not null references properties(id) on delete cascade,
  period_month  date not null,
  guest_name    text,
  amount        numeric(14,2),
  guest_count   int,
  guest_phone   text,
  received_date date,
  check_in      date,
  check_out     date,
  nights        int,
  notes         text,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now()
);

create index idx_pf_direct_bookings_property_period on property_finance_direct_bookings(property_id, period_month);
create index idx_pf_direct_bookings_check_in on property_finance_direct_bookings(check_in);

alter table property_finance_direct_bookings enable row level security;
create policy "pf_direct_bookings_admin_all" on property_finance_direct_bookings
  for all using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "pf_direct_bookings_client_select" on property_finance_direct_bookings
  for select using (exists (select 1 from property_access where property_id = property_finance_direct_bookings.property_id and user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- PROPERTY FINANCE AIRBNB ROWS
-- ─────────────────────────────────────────────
create table property_finance_airbnb_rows (
  id                   uuid primary key default uuid_generate_v4(),
  property_id          uuid not null references properties(id) on delete cascade,
  period_month         date not null,
  row_date             date,
  arriving_by_date     date,
  row_type             text,
  confirmation_code    text,
  booking_date         date,
  start_date           date,
  end_date             date,
  nights               int,
  guest                text,
  listing              text,
  details              text,
  reference_code       text,
  currency             text,
  amount               numeric(14,2),
  paid_out             numeric(14,2),
  service_fee          numeric(14,2),
  fast_pay_fee         numeric(14,2),
  cleaning_fee         numeric(14,2),
  gross_earnings       numeric(14,2),
  airbnb_remitted_tax  numeric(14,2),
  earnings_year        text,
  guest_count          int,
  raw                  jsonb,
  created_by           uuid not null references auth.users(id),
  created_at           timestamptz not null default now()
);

create index idx_pf_airbnb_rows_property_period on property_finance_airbnb_rows(property_id, period_month);
create index idx_pf_airbnb_rows_type on property_finance_airbnb_rows(row_type);

alter table property_finance_airbnb_rows enable row level security;
create policy "pf_airbnb_rows_admin_all" on property_finance_airbnb_rows
  for all using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "pf_airbnb_rows_client_select" on property_finance_airbnb_rows
  for select using (exists (select 1 from property_access where property_id = property_finance_airbnb_rows.property_id and user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- PROPERTY FINANCE LOANS
-- ─────────────────────────────────────────────
create table property_finance_loans (
  id              uuid primary key default uuid_generate_v4(),
  property_id     uuid not null references properties(id) on delete cascade,
  name            text not null,
  principal       numeric(14,2),
  annual_rate     numeric(6,4),
  tenure_months   int,
  start_date      date,
  status          text not null default 'active' check (status in ('active', 'closed')),
  created_by      uuid not null references auth.users(id),
  created_at      timestamptz not null default now()
);

alter table property_finance_loans enable row level security;
create policy "pf_loans_admin_all" on property_finance_loans
  for all using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "pf_loans_client_select" on property_finance_loans
  for select using (exists (select 1 from property_access where property_id = property_finance_loans.property_id and user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- AUDIT LOG
-- ─────────────────────────────────────────────
create table audit_log (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id),
  property_id    uuid references properties(id) on delete set null,
  action         text not null,
  resource_type  text not null,
  resource_id    text,
  before_state   jsonb,
  after_state    jsonb,
  created_at     timestamptz not null default now()
);

create index idx_audit_log_property on audit_log(property_id);
create index idx_audit_log_created_at on audit_log(created_at desc);

alter table audit_log enable row level security;
create policy "audit_log_admin_select" on audit_log
  for select using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
create policy "audit_log_insert_any_authed" on audit_log
  for insert with check (auth.uid() is not null);
