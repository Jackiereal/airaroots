# Complete Database Schema

> Status: Authoritative target schema. Current DB is a subset.
> See 05 Migrations.md for the path from current state to this schema.

---

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- For encrypt/decrypt
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- For text search
```

---

## Shared Functions

```sql
-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 1. Identity & Organization Domain

### user_profiles
```sql
CREATE TABLE user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  avatar_url  text,
  phone       text,
  timezone    text DEFAULT 'Asia/Kolkata',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
  -- Note: role column removed from here in Phase 8 (moved to organization_members)
  -- Kept temporarily during migration: role text DEFAULT 'client' CHECK (role IN ('admin','client'))
);
```

### organizations
```sql
CREATE TABLE organizations (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  slug         text UNIQUE NOT NULL,
  timezone     text NOT NULL DEFAULT 'Asia/Kolkata',
  currency     text NOT NULL DEFAULT 'INR',
  logo_url     text,
  settings     jsonb NOT NULL DEFAULT '{}',
  -- settings: { primary_color, support_email, invoice_prefix, gstin, address }
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_organizations_slug ON organizations(slug);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizations_select_member" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );

CREATE POLICY "organizations_update_owner" ON organizations
  FOR UPDATE USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'owner')
  );
```

### organization_members
```sql
CREATE TABLE organization_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
  invited_by      uuid REFERENCES auth.users(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_own" ON organization_members
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  );
```

### organization_invitations
```sql
CREATE TABLE organization_invitations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'viewer',
  token           text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  accepted_at     timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token ON organization_invitations(token);
CREATE INDEX idx_invitations_email ON organization_invitations(email);
```

---

## 2. Property Domain

### properties
```sql
CREATE TABLE properties (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  slug            text NOT NULL,
  address         text,
  city            text,
  state           text,
  country         text DEFAULT 'IN',
  latitude        numeric(10,6),
  longitude       numeric(10,6),
  property_type   text DEFAULT 'villa' CHECK (property_type IN ('villa','apartment','house','room','hostel','resort','other')),
  bedrooms        int DEFAULT 1,
  bathrooms       int DEFAULT 1,
  max_guests      int DEFAULT 2,
  base_rate       numeric(14,2),
  weekend_rate    numeric(14,2),
  check_in_time   time DEFAULT '14:00',
  check_out_time  time DEFAULT '11:00',
  min_nights      int DEFAULT 1,
  max_nights      int DEFAULT 365,
  cleaning_fee    numeric(14,2) DEFAULT 0,
  security_deposit numeric(14,2) DEFAULT 0,
  description     text,
  house_rules     text,
  is_active       boolean NOT NULL DEFAULT true,
  projections_config jsonb DEFAULT '{}',
  -- channels: which platforms this property is listed on
  platform        text DEFAULT 'mixed' CHECK (platform IN ('airbnb','direct','mixed','booking_com')),
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  UNIQUE (organization_id, slug)
);

CREATE INDEX idx_properties_org ON properties(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_active ON properties(organization_id, is_active) WHERE deleted_at IS NULL;
```

### property_owners
```sql
CREATE TABLE property_owners (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  property_id         uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name                text NOT NULL,
  user_id             uuid REFERENCES auth.users(id),
  ownership_percentage numeric(5,2) DEFAULT 100,
  bank_account_details jsonb DEFAULT '{}',  -- encrypted at app layer
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_owners_property ON property_owners(property_id);
```

### property_access
```sql
-- For external owners who get read-only portal access (not org members)
CREATE TABLE property_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, user_id)
);

CREATE INDEX idx_property_access_user ON property_access(user_id);
```

### property_amenities
```sql
CREATE TABLE property_amenities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category    text NOT NULL,  -- 'basics', 'kitchen', 'outdoor', 'safety', 'entertainment'
  name        text NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### property_photos
```sql
CREATE TABLE property_photos (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url         text NOT NULL,
  caption     text,
  is_cover    boolean DEFAULT false,
  sort_order  int DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

---

## 3. Reservation Domain

### reservations
```sql
CREATE TABLE reservations (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  property_id           uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  guest_id              uuid REFERENCES guests(id) ON DELETE SET NULL,
  -- Channel info
  channel               text NOT NULL CHECK (channel IN ('airbnb','booking_com','direct','vrbo','expedia','other')),
  platform_booking_id   text,  -- External booking ref (Airbnb confirmation code)
  platform_listing_id   text,  -- External listing ID
  -- Dates
  check_in              date NOT NULL,
  check_out             date NOT NULL,
  nights                int GENERATED ALWAYS AS (check_out - check_in) STORED,
  -- Guests
  adults                int NOT NULL DEFAULT 1,
  children              int NOT NULL DEFAULT 0,
  pets                  int NOT NULL DEFAULT 0,
  -- Status
  status                text NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('inquiry','confirmed','checked_in','checked_out','cancelled','conflict','no_show')),
  -- Finance fields
  nightly_rate          numeric(14,2) NOT NULL DEFAULT 0,
  cleaning_fee          numeric(14,2) NOT NULL DEFAULT 0,
  taxes                 numeric(14,2) NOT NULL DEFAULT 0,
  other_fees            numeric(14,2) NOT NULL DEFAULT 0,
  gross_revenue         numeric(14,2) GENERATED ALWAYS AS (
                          nightly_rate * (check_out - check_in) + cleaning_fee + taxes + other_fees
                        ) STORED,
  platform_commission   numeric(14,2) NOT NULL DEFAULT 0,
  net_payout            numeric(14,2) GENERATED ALWAYS AS (
                          nightly_rate * (check_out - check_in) + cleaning_fee - platform_commission
                        ) STORED,
  -- Guest info (denormalized for speed, linked via guest_id)
  guest_name            text,
  guest_email           text,
  guest_phone           text,
  -- Internal
  notes                 text,
  raw_payload           jsonb,  -- Original channel payload, never modified
  -- Metadata
  created_by            uuid REFERENCES auth.users(id),
  updated_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,
  UNIQUE (property_id, platform_booking_id) NULLS NOT DISTINCT,
  CONSTRAINT chk_dates CHECK (check_out > check_in)
);

CREATE INDEX idx_reservations_org ON reservations(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reservations_property ON reservations(property_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reservations_property_dates ON reservations(property_id, check_in, check_out) WHERE deleted_at IS NULL;
CREATE INDEX idx_reservations_channel ON reservations(channel, platform_booking_id);
CREATE INDEX idx_reservations_status ON reservations(status, organization_id);
CREATE INDEX idx_reservations_guest ON reservations(guest_id);
CREATE INDEX idx_reservations_check_in ON reservations(check_in) WHERE deleted_at IS NULL;

CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### reservation_events (audit trail)
```sql
CREATE TABLE reservation_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_type      text NOT NULL,  -- 'status_change', 'rate_modified', 'dates_modified', 'note_added'
  from_status     text,
  to_status       text,
  from_value      jsonb,
  to_value        jsonb,
  actor_id        uuid REFERENCES auth.users(id),
  actor_type      text DEFAULT 'user',  -- 'user', 'system', 'channel'
  occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_res_events_reservation ON reservation_events(reservation_id);
```

### reservation_notes
```sql
CREATE TABLE reservation_notes (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  content         text NOT NULL,
  is_internal     boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## 4. Guest Domain

### guests
```sql
CREATE TABLE guests (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  first_name        text NOT NULL,
  last_name         text,
  email             text,
  phone             text,
  country           text DEFAULT 'IN',
  id_type           text,  -- 'aadhaar', 'passport', 'driving_license', 'pan'
  id_number         text,  -- encrypted at app layer
  tags              text[] DEFAULT '{}',  -- ['vip', 'repeat', 'problematic']
  internal_notes    text,
  is_blacklisted    boolean NOT NULL DEFAULT false,
  blacklist_reason  text,
  channel_guest_ids jsonb DEFAULT '{}',  -- { airbnb: 'user_id', booking_com: 'guest_id' }
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guests_org ON guests(organization_id);
CREATE INDEX idx_guests_email ON guests(organization_id, email) WHERE email IS NOT NULL;
CREATE INDEX idx_guests_phone ON guests(organization_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_guests_search ON guests USING gin(to_tsvector('english', first_name || ' ' || coalesce(last_name,'') || ' ' || coalesce(email,'') || ' ' || coalesce(phone,'')));
```

---

## 5. Calendar & Availability Domain

### calendar_blocks
```sql
CREATE TABLE calendar_blocks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reservation_id  uuid REFERENCES reservations(id) ON DELETE CASCADE,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  block_type      text NOT NULL CHECK (block_type IN ('reservation','owner_hold','maintenance','buffer','seasonal_close')),
  reason          text,
  is_public       boolean DEFAULT false,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_block_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_calendar_blocks_property_dates ON calendar_blocks(property_id, start_date, end_date);
CREATE INDEX idx_calendar_blocks_org_dates ON calendar_blocks(organization_id, start_date, end_date);
```

### seasonal_rates
```sql
CREATE TABLE seasonal_rates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id     uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name            text NOT NULL,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  nightly_rate    numeric(14,2) NOT NULL,
  min_nights      int DEFAULT 1,
  is_active       boolean DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seasonal_rates_property ON seasonal_rates(property_id, start_date, end_date);
```

---

## 6. Channel Integration Domain

### channel_connections
```sql
CREATE TABLE channel_connections (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       uuid NOT NULL REFERENCES organizations(id),
  property_id           uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  channel               text NOT NULL CHECK (channel IN ('airbnb','booking_com','vrbo','expedia')),
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','connected','disconnected','error')),
  external_listing_id   text,  -- The listing/property ID on the channel
  external_account_id   text,  -- The account ID on the channel
  credentials_encrypted jsonb,  -- Encrypted OAuth tokens
  sync_enabled          boolean NOT NULL DEFAULT true,
  rate_push_enabled     boolean NOT NULL DEFAULT false,
  last_synced_at        timestamptz,
  last_sync_status      text,
  sync_from_date        date DEFAULT (CURRENT_DATE - interval '90 days'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, channel)
);

CREATE INDEX idx_channel_connections_org ON channel_connections(organization_id);
CREATE INDEX idx_channel_connections_sync ON channel_connections(channel, status, last_synced_at)
  WHERE sync_enabled = true AND status = 'connected';
```

### channel_sync_logs
```sql
CREATE TABLE channel_sync_logs (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       uuid NOT NULL REFERENCES organizations(id),
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

CREATE INDEX idx_sync_logs_connection ON channel_sync_logs(channel_connection_id, started_at DESC);
```

### channel_webhook_logs
```sql
CREATE TABLE channel_webhook_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel         text NOT NULL,
  event_type      text NOT NULL,
  raw_payload     jsonb NOT NULL,
  signature_valid boolean,
  job_id          uuid,  -- Reference to background_jobs if queued
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_channel ON channel_webhook_logs(channel, created_at DESC);
```

---

## 7. Finance Domain

### revenue_entries (canonical revenue derived from reservations)
```sql
CREATE TABLE revenue_entries (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id     uuid NOT NULL REFERENCES properties(id),
  reservation_id  uuid NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
  period_month    date NOT NULL,  -- First day of the month
  source          text NOT NULL CHECK (source IN ('airbnb','booking_com','direct','vrbo','other')),
  gross_revenue   numeric(14,2) NOT NULL,
  platform_commission numeric(14,2) NOT NULL DEFAULT 0,
  cleaning_fee    numeric(14,2) NOT NULL DEFAULT 0,
  taxes           numeric(14,2) NOT NULL DEFAULT 0,
  net_revenue     numeric(14,2) NOT NULL,
  nights          int NOT NULL,
  adr             numeric(14,2),  -- average daily rate
  status          text DEFAULT 'confirmed' CHECK (status IN ('confirmed','voided')),
  voided_at       timestamptz,
  voided_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_revenue_entries_property_period ON revenue_entries(property_id, period_month);
CREATE INDEX idx_revenue_entries_reservation ON revenue_entries(reservation_id);
```

### property_finance_expenses (existing — kept, add organization_id)
```sql
-- Existing table — add organization_id in migration
ALTER TABLE property_finance_expenses ADD COLUMN organization_id uuid REFERENCES organizations(id);
```

### property_finance_airbnb_rows (existing — kept)
```sql
-- Existing table — add organization_id in migration
ALTER TABLE property_finance_airbnb_rows ADD COLUMN organization_id uuid REFERENCES organizations(id);
```

### property_finance_direct_bookings (existing — migrate to reservations)
```sql
-- Kept for backward compatibility
-- New direct bookings should create reservation records instead
-- Old records remain here, accessible from finance module
```

### property_finance_loans (existing — kept)

---

## 8. Operations Domain

### housekeeping_staff
```sql
CREATE TABLE housekeeping_staff (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  phone           text,
  email           text,
  status          text DEFAULT 'active' CHECK (status IN ('active','inactive')),
  user_id         uuid REFERENCES auth.users(id),  -- If they have app access
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### housekeeping_tasks
```sql
CREATE TABLE housekeeping_tasks (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
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
  checklist       jsonb DEFAULT '[]',  -- Array of { item, completed, notes }
  notes           text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_housekeeping_tasks_property_date ON housekeeping_tasks(property_id, scheduled_date);
CREATE INDEX idx_housekeeping_tasks_org_date ON housekeeping_tasks(organization_id, scheduled_date);
CREATE INDEX idx_housekeeping_tasks_assigned ON housekeeping_tasks(assigned_to, scheduled_date)
  WHERE status NOT IN ('completed','cancelled');
```

### housekeeping_photos
```sql
CREATE TABLE housekeeping_photos (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     uuid NOT NULL REFERENCES housekeeping_tasks(id) ON DELETE CASCADE,
  url         text NOT NULL,
  caption     text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### maintenance_requests
```sql
CREATE TABLE maintenance_requests (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id     uuid NOT NULL REFERENCES properties(id),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE SET NULL,
  title           text NOT NULL,
  description     text,
  category        text,  -- 'plumbing', 'electrical', 'appliance', 'structural', 'other'
  priority        text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status          text NOT NULL DEFAULT 'reported'
                  CHECK (status IN ('reported','assigned','in_progress','resolved','closed')),
  reported_by     uuid REFERENCES auth.users(id),
  assigned_to     uuid REFERENCES auth.users(id),
  vendor_id       uuid REFERENCES vendors(id),
  estimated_cost  numeric(14,2),
  actual_cost     numeric(14,2),
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_property ON maintenance_requests(property_id, status);
CREATE INDEX idx_maintenance_org ON maintenance_requests(organization_id, created_at DESC);
```

### maintenance_photos
```sql
CREATE TABLE maintenance_photos (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  uuid NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  url         text NOT NULL,
  caption     text,
  taken_by    uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### vendors
```sql
CREATE TABLE vendors (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  category        text,  -- 'plumbing', 'electrical', 'cleaning', 'landscaping', 'other'
  phone           text,
  email           text,
  address         text,
  notes           text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### inventory_items
```sql
CREATE TABLE inventory_items (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id     uuid NOT NULL REFERENCES properties(id),
  name            text NOT NULL,
  category        text,  -- 'linen', 'toiletry', 'kitchen', 'cleaning', 'electronics'
  unit            text DEFAULT 'unit',
  quantity        int NOT NULL DEFAULT 0,
  reorder_level   int DEFAULT 0,
  cost_per_unit   numeric(14,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## 9. Communication Domain

### communication_templates
```sql
CREATE TABLE communication_templates (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  name            text NOT NULL,
  trigger_event   text NOT NULL,
  -- trigger_events: booking_confirmation, pre_arrival_48h, check_in, checkout, review_request, payment_reminder
  channels        text[] DEFAULT ARRAY['email'],  -- ['email','whatsapp','sms']
  subject         text,  -- for email
  body_whatsapp   text,
  body_email      text,
  body_sms        text,
  variables       text[] DEFAULT '{}',  -- Variables used: ['guest_name', 'check_in_date', ...]
  is_active       boolean DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### communication_logs
```sql
CREATE TABLE communication_logs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id     uuid REFERENCES properties(id),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id        uuid REFERENCES guests(id) ON DELETE SET NULL,
  template_id     uuid REFERENCES communication_templates(id),
  channel         text NOT NULL CHECK (channel IN ('whatsapp','email','sms','push')),
  direction       text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  recipient       text NOT NULL,  -- phone or email
  subject         text,
  body            text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','delivered','failed','read')),
  provider_msg_id text,  -- External message ID from WhatsApp/email provider
  sent_at         timestamptz,
  delivered_at    timestamptz,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comm_logs_reservation ON communication_logs(reservation_id);
CREATE INDEX idx_comm_logs_org_date ON communication_logs(organization_id, created_at DESC);
```

---

## 10. AI & Analytics Domain

### ai_insights
```sql
CREATE TABLE ai_insights (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  property_id     uuid REFERENCES properties(id),
  insight_type    text NOT NULL,  -- 'pricing', 'occupancy', 'expense_anomaly', 'health_score'
  title           text NOT NULL,
  summary         text NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}',
  confidence      numeric(4,3),  -- 0.000 to 1.000
  is_dismissed    boolean DEFAULT false,
  is_applied      boolean DEFAULT false,
  applied_at      timestamptz,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

CREATE INDEX idx_ai_insights_org ON ai_insights(organization_id, generated_at DESC);
CREATE INDEX idx_ai_insights_active ON ai_insights(organization_id, insight_type)
  WHERE is_dismissed = false AND (expires_at IS NULL OR expires_at > now());
```

### ai_pricing_recommendations
```sql
CREATE TABLE ai_pricing_recommendations (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     uuid NOT NULL REFERENCES organizations(id),
  property_id         uuid NOT NULL REFERENCES properties(id),
  target_date         date NOT NULL,
  current_rate        numeric(14,2),
  recommended_rate    numeric(14,2) NOT NULL,
  min_rate            numeric(14,2),
  max_rate            numeric(14,2),
  reason              text,
  confidence          numeric(4,3),
  signals             jsonb DEFAULT '{}',  -- { occupancy_forecast, market_rate, season_factor }
  is_applied          boolean DEFAULT false,
  applied_at          timestamptz,
  applied_rate        numeric(14,2),
  generated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, target_date)
);
```

---

## 11. Billing Domain

### subscription_plans
```sql
CREATE TABLE subscription_plans (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text NOT NULL,
  slug              text UNIQUE NOT NULL,  -- 'starter','growth','pro','enterprise'
  price_monthly     numeric(14,2) NOT NULL,
  price_annual      numeric(14,2) NOT NULL,
  max_properties    int,  -- NULL = unlimited
  max_users         int,  -- NULL = unlimited
  features          text[] DEFAULT '{}',  -- Array of feature flag names
  is_active         boolean DEFAULT true,
  sort_order        int DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  plan_id               uuid NOT NULL REFERENCES subscription_plans(id),
  status                text NOT NULL DEFAULT 'trialing'
                        CHECK (status IN ('trialing','active','past_due','cancelled','expired')),
  billing_cycle         text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  trial_start           timestamptz,
  trial_end             timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancelled_at          timestamptz,
  cancel_at_period_end  boolean DEFAULT false,
  razorpay_sub_id       text,
  stripe_sub_id         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(status) WHERE status IN ('trialing','active');
```

### invoices
```sql
CREATE TABLE invoices (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   uuid NOT NULL REFERENCES organizations(id),
  subscription_id   uuid REFERENCES subscriptions(id),
  amount            numeric(14,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'INR',
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','failed','void')),
  due_date          date,
  paid_at           timestamptz,
  invoice_number    text UNIQUE,
  razorpay_order_id text,
  stripe_invoice_id text,
  pdf_url           text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

---

## 12. Platform Domain

### background_jobs
```sql
CREATE TABLE background_jobs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  queue           text NOT NULL DEFAULT 'default',
  type            text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','completed','failed','dead')),
  priority        int NOT NULL DEFAULT 5,
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 3,
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  failed_at       timestamptz,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_pending ON background_jobs(status, scheduled_at, priority)
  WHERE status = 'pending';
```

### feature_flags
```sql
CREATE TABLE feature_flags (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                text UNIQUE NOT NULL,
  description         text,
  enabled             boolean NOT NULL DEFAULT false,
  rollout_percentage  int DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  conditions          jsonb DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flag_overrides (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_id         uuid NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled         boolean NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (organization_id IS NOT NULL OR user_id IS NOT NULL)
);
```

### audit_log (existing — extend)
```sql
-- Existing table, add organization_id
ALTER TABLE audit_log ADD COLUMN organization_id uuid REFERENCES organizations(id);
CREATE INDEX idx_audit_log_org ON audit_log(organization_id, created_at DESC);
```

### domain_events
```sql
CREATE TABLE domain_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type      text NOT NULL,
  aggregate_id    uuid NOT NULL,
  aggregate_type  text NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  version         int NOT NULL DEFAULT 1,
  payload         jsonb NOT NULL,
  processed       boolean NOT NULL DEFAULT false,
  processed_at    timestamptz,
  attempts        int NOT NULL DEFAULT 0,
  error           text
);

CREATE INDEX idx_domain_events_unprocessed ON domain_events(processed, occurred_at)
  WHERE processed = false;
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_id, aggregate_type);
```
