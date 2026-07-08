-- ─────────────────────────────────────────────
-- PHASE 4: OPERATIONS
-- housekeeping_staff, housekeeping_tasks, housekeeping_photos
-- vendors, maintenance_requests, maintenance_photos
-- inventory_items, inventory_transactions
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- HOUSEKEEPING STAFF
-- Non-auth users (no login). Contacted via WhatsApp.
-- ─────────────────────────────────────────────
create table housekeeping_staff (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  name            text not null,
  phone           text,
  email           text,
  status          text not null default 'active' check (status in ('active', 'inactive')),
  -- If staff ever gets app access in a future phase
  user_id         uuid references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_housekeeping_staff_org on housekeeping_staff (organization_id);
create index idx_housekeeping_staff_active on housekeeping_staff (organization_id, status) where status = 'active';

create trigger housekeeping_staff_updated_at
  before update on housekeeping_staff
  for each row execute function update_updated_at_column();

alter table housekeeping_staff enable row level security;

create policy "housekeeping_staff_select_org" on housekeeping_staff
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "housekeeping_staff_insert_org" on housekeeping_staff
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "housekeeping_staff_update_org" on housekeeping_staff
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "housekeeping_staff_delete_org" on housekeeping_staff
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- VENDORS
-- External service providers (plumbers, electricians, etc.)
-- ─────────────────────────────────────────────
create table vendors (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  name            text not null,
  category        text check (category in ('plumbing', 'electrical', 'cleaning', 'carpentry', 'hvac', 'pest_control', 'landscaping', 'security', 'other')),
  phone           text,
  email           text,
  address         text,
  rate_per_visit  numeric(14, 2),  -- typical call-out rate, for estimates
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_vendors_org on vendors (organization_id);
create index idx_vendors_active on vendors (organization_id, is_active) where is_active = true;

create trigger vendors_updated_at
  before update on vendors
  for each row execute function update_updated_at_column();

alter table vendors enable row level security;

create policy "vendors_select_org" on vendors
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "vendors_insert_org" on vendors
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "vendors_update_org" on vendors
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "vendors_delete_org" on vendors
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- HOUSEKEEPING TASKS
-- Created automatically on reservation.checked_in.
-- Also created manually for deep_clean / inspection (no reservation).
-- ─────────────────────────────────────────────
create table housekeeping_tasks (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  property_id     uuid not null references properties(id) on delete cascade,

  -- Linked reservation (null for manual tasks like deep_clean)
  reservation_id  uuid references reservations(id) on delete set null,

  task_type       text not null check (task_type in ('checkout_clean', 'mid_stay', 'inspection', 'deep_clean')),
  status          text not null default 'pending'
                  check (status in ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),

  assigned_to     uuid references housekeeping_staff(id) on delete set null,

  scheduled_date  date not null,
  scheduled_time  time,               -- target completion time (e.g. 14:00)

  -- Pricing
  -- custom_price overrides org default rate for this task type
  custom_price    numeric(14, 2),
  price_type      text default 'standard' check (price_type in ('standard', 'deep_clean', 'inspection', 'mid_stay')),

  -- Checklist: [{item: text, category: text, completed: bool, notes: text}]
  checklist       jsonb not null default '[]',

  notes           text,

  -- Timestamps
  started_at      timestamptz,
  completed_at    timestamptz,

  -- Public token for housekeeper mobile page (/hk/[access_token])
  -- No auth required — token is the credential
  access_token    uuid not null default uuid_generate_v4(),

  -- Reminders
  -- Tracks whether morning-of reminder was sent
  reminder_sent_at timestamptz,

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_housekeeping_tasks_property_date on housekeeping_tasks (property_id, scheduled_date);
create index idx_housekeeping_tasks_org_date on housekeeping_tasks (organization_id, scheduled_date);
create index idx_housekeeping_tasks_assigned on housekeeping_tasks (assigned_to, scheduled_date)
  where status not in ('completed', 'cancelled');
create index idx_housekeeping_tasks_status on housekeeping_tasks (organization_id, status)
  where status not in ('completed', 'cancelled');
-- Unique index for token lookups (public pages)
create unique index idx_housekeeping_tasks_token on housekeeping_tasks (access_token);

create trigger housekeeping_tasks_updated_at
  before update on housekeeping_tasks
  for each row execute function update_updated_at_column();

alter table housekeeping_tasks enable row level security;

create policy "housekeeping_tasks_select_org" on housekeeping_tasks
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "housekeeping_tasks_insert_org" on housekeeping_tasks
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "housekeeping_tasks_update_org" on housekeeping_tasks
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "housekeeping_tasks_delete_org" on housekeeping_tasks
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- HOUSEKEEPING PHOTOS
-- Uploaded via token page (no auth). Stored in Supabase Storage.
-- ─────────────────────────────────────────────
create table housekeeping_photos (
  id          uuid primary key default uuid_generate_v4(),
  task_id     uuid not null references housekeeping_tasks(id) on delete cascade,
  url         text not null,
  caption     text,
  -- null when uploaded via public token page (no user session)
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_housekeeping_photos_task on housekeeping_photos (task_id);

alter table housekeeping_photos enable row level security;

create policy "housekeeping_photos_select_org" on housekeeping_photos
  for select using (
    task_id in (
      select id from housekeeping_tasks where organization_id in (
        select organization_id from organization_members where user_id = auth.uid()
      )
    )
  );

create policy "housekeeping_photos_insert_org" on housekeeping_photos
  for insert with check (
    task_id in (
      select id from housekeeping_tasks where organization_id in (
        select organization_id from organization_members where user_id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────
-- MAINTENANCE REQUESTS
-- Reported by staff. Assigned to internal user or vendor.
-- actual_cost flows into property expenses on resolve.
-- ─────────────────────────────────────────────
create table maintenance_requests (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  property_id     uuid not null references properties(id) on delete cascade,

  -- Linked reservation (if issue found during a stay)
  reservation_id  uuid references reservations(id) on delete set null,

  -- Linked housekeeping task (if reported during a clean)
  housekeeping_task_id uuid references housekeeping_tasks(id) on delete set null,

  title           text not null,
  description     text,
  category        text check (category in ('plumbing', 'electrical', 'appliance', 'structural', 'hvac', 'pest', 'furniture', 'other')),
  priority        text not null default 'medium'
                  check (priority in ('low', 'medium', 'high', 'urgent')),
  status          text not null default 'reported'
                  check (status in ('reported', 'assigned', 'in_progress', 'resolved', 'closed')),

  -- Who reported (auth user — manager or staff)
  reported_by     uuid references auth.users(id) on delete set null,

  -- Internal staff assignment (optional, for in-house fixes)
  assigned_to     uuid references auth.users(id) on delete set null,

  -- External vendor assignment
  vendor_id       uuid references vendors(id) on delete set null,

  estimated_cost  numeric(14, 2),
  actual_cost     numeric(14, 2),

  resolved_at     timestamptz,

  -- Public token for vendor mobile page (/maintenance/[access_token])
  access_token    uuid not null default uuid_generate_v4(),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_maintenance_property on maintenance_requests (property_id, status);
create index idx_maintenance_org on maintenance_requests (organization_id, created_at desc);
create index idx_maintenance_open on maintenance_requests (organization_id, priority, status)
  where status not in ('resolved', 'closed');
-- For alert queries: open high/urgent issues with upcoming reservations
create index idx_maintenance_urgent on maintenance_requests (property_id, status, priority)
  where priority in ('high', 'urgent') and status not in ('resolved', 'closed');
create unique index idx_maintenance_token on maintenance_requests (access_token);

create trigger maintenance_requests_updated_at
  before update on maintenance_requests
  for each row execute function update_updated_at_column();

alter table maintenance_requests enable row level security;

create policy "maintenance_requests_select_org" on maintenance_requests
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "maintenance_requests_insert_org" on maintenance_requests
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "maintenance_requests_update_org" on maintenance_requests
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "maintenance_requests_delete_org" on maintenance_requests
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- MAINTENANCE PHOTOS
-- ─────────────────────────────────────────────
create table maintenance_photos (
  id          uuid primary key default uuid_generate_v4(),
  request_id  uuid not null references maintenance_requests(id) on delete cascade,
  url         text not null,
  caption     text,
  taken_by    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_maintenance_photos_request on maintenance_photos (request_id);

alter table maintenance_photos enable row level security;

create policy "maintenance_photos_select_org" on maintenance_photos
  for select using (
    request_id in (
      select id from maintenance_requests where organization_id in (
        select organization_id from organization_members where user_id = auth.uid()
      )
    )
  );

create policy "maintenance_photos_insert_org" on maintenance_photos
  for insert with check (
    request_id in (
      select id from maintenance_requests where organization_id in (
        select organization_id from organization_members where user_id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────
-- INVENTORY ITEMS
-- Per-property consumable and capital items.
-- Alert fires when quantity <= reorder_level.
-- ─────────────────────────────────────────────
create table inventory_items (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  property_id     uuid not null references properties(id) on delete cascade,
  name            text not null,
  category        text check (category in ('linen', 'toiletry', 'kitchen', 'cleaning', 'electronics', 'furniture', 'other')),
  unit            text not null default 'unit',  -- unit, roll, bottle, set, kg, litre
  quantity        int not null default 0,
  reorder_level   int not null default 0,        -- alert threshold
  cost_per_unit   numeric(14, 2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_inventory_items_property on inventory_items (property_id);
create index idx_inventory_items_org on inventory_items (organization_id);
-- For low-stock alert queries
create index idx_inventory_low_stock on inventory_items (organization_id, property_id)
  where quantity <= reorder_level;

create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function update_updated_at_column();

alter table inventory_items enable row level security;

create policy "inventory_items_select_org" on inventory_items
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "inventory_items_insert_org" on inventory_items
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "inventory_items_update_org" on inventory_items
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "inventory_items_delete_org" on inventory_items
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- INVENTORY TRANSACTIONS
-- Every use / restock / damage logged here.
-- quantity on inventory_items updated via trigger or service.
-- cost of restock flows into property expenses (via service).
-- ─────────────────────────────────────────────
create table inventory_transactions (
  id          uuid primary key default uuid_generate_v4(),
  item_id     uuid not null references inventory_items(id) on delete cascade,
  -- task_id links usage to specific housekeeping task
  task_id     uuid references housekeeping_tasks(id) on delete set null,
  type        text not null check (type in ('restock', 'used', 'damaged', 'audit')),
  -- positive for restock/audit-up, negative for used/damaged
  quantity    int not null,
  -- cost applies to restock transactions only
  cost        numeric(14, 2),
  notes       text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index idx_inventory_transactions_item on inventory_transactions (item_id, created_at desc);
create index idx_inventory_transactions_task on inventory_transactions (task_id) where task_id is not null;

alter table inventory_transactions enable row level security;

create policy "inventory_transactions_select_org" on inventory_transactions
  for select using (
    item_id in (
      select id from inventory_items where organization_id in (
        select organization_id from organization_members where user_id = auth.uid()
      )
    )
  );

create policy "inventory_transactions_insert_org" on inventory_transactions
  for insert with check (
    item_id in (
      select id from inventory_items where organization_id in (
        select organization_id from organization_members where user_id = auth.uid()
      )
    )
  );
