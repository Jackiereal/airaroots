# Migration Plan

> Numbered migrations, in order. Never run out of sequence. Never run on prod without staging test.

---

## Current State (Done)

| Migration | Status | Description |
|-----------|--------|-------------|
| 001_initial_schema.sql | Done | user_profiles, properties, property_access, expenses, direct_bookings, airbnb_rows, loans, audit_log |
| 002_add_projections_config.sql | Done | projections_config JSONB on properties |

---

## Phase 1 Migrations (Reservation Engine)

### 003_add_reservations.sql

```sql
-- Enable required extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- GUESTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid REFERENCES organizations(id),
  -- NOTE: organization_id nullable until Phase 8 org migration
  -- For now, link via property_id
  property_id       uuid REFERENCES properties(id),
  first_name        text NOT NULL,
  last_name         text,
  email             text,
  phone             text,
  country           text DEFAULT 'IN',
  tags              text[] DEFAULT '{}',
  internal_notes    text,
  is_blacklisted    boolean NOT NULL DEFAULT false,
  blacklist_reason  text,
  channel_guest_ids jsonb DEFAULT '{}',
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone) WHERE phone IS NOT NULL;

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guests_admin_all" ON guests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "guests_client_select" ON guests
  FOR SELECT USING (
    property_id IN (SELECT property_id FROM property_access WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- RESERVATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  organization_id       uuid REFERENCES organizations(id),
  -- nullable until Phase 8
  guest_id              uuid REFERENCES guests(id) ON DELETE SET NULL,
  channel               text NOT NULL DEFAULT 'direct'
                        CHECK (channel IN ('airbnb','booking_com','direct','vrbo','expedia','other')),
  platform_booking_id   text,
  platform_listing_id   text,
  check_in              date NOT NULL,
  check_out             date NOT NULL,
  adults                int NOT NULL DEFAULT 1,
  children              int NOT NULL DEFAULT 0,
  pets                  int NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('inquiry','confirmed','checked_in','checked_out','cancelled','conflict','no_show')),
  nightly_rate          numeric(14,2) NOT NULL DEFAULT 0,
  cleaning_fee          numeric(14,2) NOT NULL DEFAULT 0,
  taxes                 numeric(14,2) NOT NULL DEFAULT 0,
  other_fees            numeric(14,2) NOT NULL DEFAULT 0,
  platform_commission   numeric(14,2) NOT NULL DEFAULT 0,
  guest_name            text,
  guest_email           text,
  guest_phone           text,
  notes                 text,
  raw_payload           jsonb,
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,
  CONSTRAINT chk_dates CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_reservations_property ON reservations(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_property_dates ON reservations(property_id, check_in, check_out) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_channel_booking ON reservations(channel, platform_booking_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status, property_id);

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_admin_all" ON reservations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "reservations_client_select" ON reservations
  FOR SELECT USING (
    property_id IN (SELECT property_id FROM property_access WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- RESERVATION EVENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservation_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  event_type      text NOT NULL,
  from_status     text,
  to_status       text,
  from_value      jsonb,
  to_value        jsonb,
  actor_id        uuid REFERENCES auth.users(id),
  actor_type      text DEFAULT 'user',
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_res_events_reservation ON reservation_events(reservation_id);

ALTER TABLE reservation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "res_events_admin_all" ON reservation_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "res_events_client_select" ON reservation_events
  FOR SELECT USING (
    reservation_id IN (
      SELECT r.id FROM reservations r
      JOIN property_access pa ON pa.property_id = r.property_id
      WHERE pa.user_id = auth.uid()
    )
  );
```

### 004_add_calendar_blocks.sql

```sql
-- ─────────────────────────────────────────────
-- CALENDAR BLOCKS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_blocks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id  uuid REFERENCES reservations(id) ON DELETE CASCADE,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  block_type      text NOT NULL DEFAULT 'owner_hold'
                  CHECK (block_type IN ('reservation','owner_hold','maintenance','buffer','seasonal_close')),
  reason          text,
  is_public       boolean DEFAULT false,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_block_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_blocks_property_dates
  ON calendar_blocks(property_id, start_date, end_date);

ALTER TABLE calendar_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_blocks_admin_all" ON calendar_blocks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE p.id = calendar_blocks.property_id AND up.role = 'admin'
    )
  );

CREATE POLICY "calendar_blocks_client_select" ON calendar_blocks
  FOR SELECT USING (
    property_id IN (SELECT property_id FROM property_access WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- SEASONAL RATES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seasonal_rates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name            text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  nightly_rate    numeric(14,2) NOT NULL,
  min_nights      int DEFAULT 1,
  is_active       boolean DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seasonal_rates_property_dates
  ON seasonal_rates(property_id, start_date, end_date) WHERE is_active = true;

ALTER TABLE seasonal_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seasonal_rates_admin_all" ON seasonal_rates
  FOR ALL USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE up.role = 'admin'
    )
  );

CREATE POLICY "seasonal_rates_client_select" ON seasonal_rates
  FOR SELECT USING (
    property_id IN (SELECT property_id FROM property_access WHERE user_id = auth.uid())
  );
```

---

## Phase 2 Migrations (Channel Manager)

### 005_add_channel_connections.sql

```sql
CREATE TABLE IF NOT EXISTS channel_connections (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id           uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel               text NOT NULL CHECK (channel IN ('airbnb','booking_com','vrbo','expedia')),
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','connected','disconnected','error')),
  external_listing_id   text,
  external_account_id   text,
  credentials_encrypted jsonb,
  sync_enabled          boolean NOT NULL DEFAULT true,
  rate_push_enabled     boolean NOT NULL DEFAULT false,
  last_synced_at        timestamptz,
  last_sync_status      text,
  sync_from_date        date DEFAULT (CURRENT_DATE - interval '90 days'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_property
  ON channel_connections(property_id);

CREATE TABLE IF NOT EXISTS channel_sync_logs (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_connection_id uuid NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  sync_type             text NOT NULL CHECK (sync_type IN ('full','incremental','webhook')),
  status                text NOT NULL CHECK (status IN ('running','completed','failed')),
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  reservations_created  int DEFAULT 0,
  reservations_updated  int DEFAULT 0,
  reservations_cancelled int DEFAULT 0,
  conflicts_detected    int DEFAULT 0,
  error                 text,
  raw_response          jsonb
);

CREATE TABLE IF NOT EXISTS channel_webhook_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel         text NOT NULL,
  event_type      text NOT NULL,
  raw_payload     jsonb NOT NULL,
  signature_valid boolean,
  job_id          uuid,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## Phase 3 Migrations (Guest CRM)

### 006_extend_guests.sql

```sql
-- Add ID fields and additional guest fields
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS id_type text,
  ADD COLUMN IF NOT EXISTS id_number text,  -- encrypted at app layer
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add text search index
CREATE INDEX IF NOT EXISTS idx_guests_search ON guests
  USING gin(to_tsvector('english',
    first_name || ' ' ||
    coalesce(last_name,'') || ' ' ||
    coalesce(email,'') || ' ' ||
    coalesce(phone,'')
  ));
```

---

## Phase 4 Migrations (Operations)

### 007_add_operations.sql

```sql
-- Housekeeping staff
CREATE TABLE IF NOT EXISTS housekeeping_staff (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     uuid REFERENCES properties(id),
  -- Phase 8: add organization_id
  name            text NOT NULL,
  phone           text,
  email           text,
  status          text DEFAULT 'active' CHECK (status IN ('active','inactive')),
  user_id         uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Housekeeping tasks
CREATE TABLE IF NOT EXISTS housekeeping_tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     uuid NOT NULL REFERENCES properties(id),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE SET NULL,
  task_type       text NOT NULL CHECK (task_type IN ('checkout_clean','mid_stay','inspection','deep_clean')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','assigned','in_progress','completed','cancelled')),
  assigned_to     uuid REFERENCES housekeeping_staff(id),
  scheduled_date  date NOT NULL,
  scheduled_time  time,
  started_at      timestamptz,
  completed_at    timestamptz,
  checklist       jsonb DEFAULT '[]',
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_property_date
  ON housekeeping_tasks(property_id, scheduled_date);

-- Maintenance requests
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id     uuid NOT NULL REFERENCES properties(id),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  category        text,
  priority        text NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
  status          text NOT NULL DEFAULT 'reported'
                  CHECK (status IN ('reported','assigned','in_progress','resolved','closed')),
  reported_by     uuid REFERENCES auth.users(id),
  assigned_to     uuid REFERENCES auth.users(id),
  estimated_cost  numeric(14,2),
  actual_cost     numeric(14,2),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  category        text,
  phone           text,
  email           text,
  notes           text,
  is_active       boolean DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## Phase 8 Migration (Organizations)

### 010_add_organizations.sql

This is the most critical migration. Must be done with extreme care.

```sql
-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  slug         text UNIQUE NOT NULL,
  timezone     text NOT NULL DEFAULT 'Asia/Kolkata',
  currency     text NOT NULL DEFAULT 'INR',
  logo_url     text,
  settings     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

-- 2. Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'admin'
                  CHECK (role IN ('owner','admin','manager','viewer')),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- 3. Create a default organization for every existing admin user
INSERT INTO organizations (name, slug)
SELECT
  coalesce(up.full_name, split_part(au.email, '@', 1)) || '''s Organization',
  lower(replace(coalesce(up.full_name, split_part(au.email, '@', 1)), ' ', '-'))
    || '-' || substr(gen_random_uuid()::text, 1, 8)
FROM auth.users au
JOIN user_profiles up ON up.id = au.id
WHERE up.role = 'admin';

-- 4. Add every admin user as owner of their default org
INSERT INTO organization_members (organization_id, user_id, role)
SELECT o.id, up.id, 'owner'
FROM organizations o
JOIN user_profiles up ON o.slug LIKE lower(replace(coalesce(up.full_name,''), ' ', '-')) || '%'
WHERE up.role = 'admin';

-- 5. Add organization_id to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- 6. Backfill: link each property to its creator's organization
UPDATE properties p
SET organization_id = (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = p.created_by
  AND om.role = 'owner'
  LIMIT 1
);

-- 7. Make organization_id NOT NULL after backfill
ALTER TABLE properties ALTER COLUMN organization_id SET NOT NULL;

-- 8. Add organization_id to reservations (similar backfill pattern)
-- 9. Add organization_id to all finance tables
-- 10. Update RLS policies to use organization_id
-- See individual domain migration files for each table
```

---

## Migration Best Practices

1. **Always test on staging first** — never run untested migrations on production
2. **Wrap in transactions** — each migration file should be idempotent (IF NOT EXISTS, IF EXISTS)
3. **Separate DDL from DML** — schema changes in one migration, data backfills in another
4. **Index CONCURRENTLY for large tables** — prevents table locks
5. **Monitor after migration** — check query performance and RLS behavior

```sql
-- Add index without locking (for tables with data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_new
  ON reservations(organization_id, check_in);
```
