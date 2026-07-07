-- ─────────────────────────────────────────────
-- PHASE 2: CHANNEL MANAGER
-- channel_connections, channel_sync_logs, channel_webhook_logs, background_jobs
-- ─────────────────────────────────────────────

create type channel_sync_status as enum ('pending', 'running', 'success', 'failed', 'partial');
create type channel_connection_status as enum ('active', 'paused', 'error', 'disconnected');
create type background_job_status as enum ('pending', 'running', 'done', 'failed', 'cancelled');

-- ─────────────────────────────────────────────
-- CHANNEL CONNECTIONS
-- One row per property-channel link (e.g. Property A ↔ Airbnb iCal URL)
-- ─────────────────────────────────────────────
create table channel_connections (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null,
  property_id     uuid not null references properties(id) on delete cascade,
  channel         reservation_channel not null,

  -- iCal import URL (Airbnb / Booking.com provide this)
  ical_url        text,

  -- Webhook verification token (for push-based channels)
  webhook_secret  text,

  status          channel_connection_status not null default 'active',
  last_sync_at    timestamptz,
  last_error      text,

  -- iCal export token (same as properties.ical_token — denormalized for convenience)
  export_token    uuid not null default uuid_generate_v4(),

  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (property_id, channel)
);

create index idx_channel_connections_org on channel_connections (organization_id);
create index idx_channel_connections_property on channel_connections (property_id);
create index idx_channel_connections_status on channel_connections (status) where status = 'active';

create trigger channel_connections_updated_at
  before update on channel_connections
  for each row execute function update_updated_at_column();

alter table channel_connections enable row level security;

create policy "channel_connections_select_org" on channel_connections
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "channel_connections_insert_org" on channel_connections
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "channel_connections_update_org" on channel_connections
  for update using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "channel_connections_delete_org" on channel_connections
  for delete using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- CHANNEL SYNC LOGS
-- One row per sync run (cron or manual)
-- ─────────────────────────────────────────────
create table channel_sync_logs (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null,
  connection_id       uuid not null references channel_connections(id) on delete cascade,
  property_id         uuid not null references properties(id) on delete cascade,
  channel             reservation_channel not null,

  status              channel_sync_status not null default 'pending',
  triggered_by        text not null default 'cron' check (triggered_by in ('cron', 'manual', 'webhook')),

  -- Results
  reservations_found  integer default 0,
  reservations_created integer default 0,
  reservations_updated integer default 0,
  reservations_cancelled integer default 0,
  conflicts_detected  integer default 0,

  error_message       text,
  raw_response_size   integer,  -- bytes, for monitoring

  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create index idx_channel_sync_logs_connection on channel_sync_logs (connection_id, started_at desc);
create index idx_channel_sync_logs_org on channel_sync_logs (organization_id, started_at desc);
create index idx_channel_sync_logs_status on channel_sync_logs (status) where status in ('pending', 'running');

alter table channel_sync_logs enable row level security;

create policy "channel_sync_logs_select_org" on channel_sync_logs
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "channel_sync_logs_insert_org" on channel_sync_logs
  for insert with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- CHANNEL WEBHOOK LOGS
-- Raw inbound webhook payloads — immutable audit trail
-- ─────────────────────────────────────────────
create table channel_webhook_logs (
  id              uuid primary key default uuid_generate_v4(),
  channel         reservation_channel not null,
  headers         jsonb,
  payload         jsonb,
  signature_valid boolean,
  processed       boolean not null default false,
  error_message   text,
  received_at     timestamptz not null default now()
);

-- Retention index: prune old logs in Phase 3+
create index idx_webhook_logs_received on channel_webhook_logs (received_at desc);
create index idx_webhook_logs_unprocessed on channel_webhook_logs (processed, received_at)
  where processed = false;

-- No RLS — service role only, never exposed to users

-- ─────────────────────────────────────────────
-- BACKGROUND JOBS
-- Simple job queue for async work (sync, export, etc.)
-- ─────────────────────────────────────────────
create table background_jobs (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  job_type        text not null,  -- 'ical_sync', 'conflict_check', 'ical_export'
  payload         jsonb not null default '{}',
  status          background_job_status not null default 'pending',
  priority        integer not null default 5,  -- 1=highest, 10=lowest
  attempts        integer not null default 0,
  max_attempts    integer not null default 3,
  error_message   text,
  scheduled_at    timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_background_jobs_queue on background_jobs (status, priority, scheduled_at)
  where status in ('pending', 'failed') and attempts < max_attempts;

create index idx_background_jobs_org on background_jobs (organization_id, created_at desc)
  where organization_id is not null;

-- No RLS — service role only
