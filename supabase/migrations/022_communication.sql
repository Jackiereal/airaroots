-- ─────────────────────────────────────────────
-- NOTIFICATIONS (Automation-platform slice 1)
-- Airaroots is an automation platform, not a messaging provider. It detects
-- events, runs automation, creates tasks, and queues notifications — but
-- delivery happens through each org's OWN channels (BYOP). Airaroots never
-- owns messaging infra or bills per message.
--
-- This migration is the data model for that: customizable per-org
-- notification templates, a delivery-attempt log, and a (minimal, mostly
-- future) per-org provider-config table. Phase-1 delivery is free wa.me
-- click-to-chat links + stubbed email; real provider adapters (Meta Cloud
-- API, Twilio, SMTP, …) plug in later behind the same interface, using
-- ENCRYPTED credentials stored per org.
--
-- Standard conventions: bare organization_id UUID (no FK), RLS via
-- organization_members, shared update_updated_at_column() from 001.
-- ─────────────────────────────────────────────

create table communication_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trigger         text not null check (trigger in (
                    'housekeeping_assignment', 'housekeeping_reminder',
                    'vendor_dispatch', 'reservation_confirmed', 'checkout_thankyou')),
  channel         text not null check (channel in ('whatsapp', 'email', 'sms', 'push')),
  subject         text,               -- email/push only; null for whatsapp/sms
  body            text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, trigger, channel)
);

create index idx_communication_templates_org on communication_templates (organization_id);

create trigger communication_templates_updated_at
  before update on communication_templates
  for each row execute function update_updated_at_column();

alter table communication_templates enable row level security;

create policy "communication_templates_select_members" on communication_templates
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "communication_templates_write_staff" on communication_templates
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
  ) with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
  );

-- ─── Notification delivery log ───────────────────────────────────────────────
-- One row per delivery attempt, decoupled from any single aggregate — the
-- source (reservation/task/etc.) lives in `context` jsonb. Inserted only by
-- the NotificationService via the service-role client; org members read.
create table notification_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trigger         text not null,
  channel         text not null,
  recipient       text,
  rendered_body   text,
  provider_type   text,               -- null for wa.me links / stubbed
  delivery_status text not null check (delivery_status in (
                    'queued', 'link_generated', 'sent', 'failed', 'stubbed', 'skipped')),
  link            text,               -- wa.me click-to-chat URL, when applicable
  error           text,
  context         jsonb not null default '{}'::jsonb,  -- { reservation_id, task_id, ... }
  attempts        integer not null default 1,
  created_at      timestamptz not null default now()
);

create index idx_notification_log_org on notification_log (organization_id, created_at);

alter table notification_log enable row level security;

create policy "notification_log_select_members" on notification_log
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

-- ─── Per-org provider config (BYOP) ──────────────────────────────────────────
-- Which provider an org uses per channel. Mostly future: Phase-1 works with
-- zero rows (defaults = wa.me link for whatsapp, stubbed email). When a real
-- API adapter lands, `config` holds the connection settings — and any secret
-- MUST be encrypted at rest before storage (hard requirement for that slice).
create table org_notification_providers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  channel         text not null check (channel in ('whatsapp', 'email', 'sms', 'push')),
  provider_type   text not null,      -- 'wa_link' | 'meta_cloud' | 'twilio' | 'smtp' | ...
  config          jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, channel)
);

create index idx_org_notification_providers_org on org_notification_providers (organization_id);

create trigger org_notification_providers_updated_at
  before update on org_notification_providers
  for each row execute function update_updated_at_column();

alter table org_notification_providers enable row level security;

create policy "org_notification_providers_select_members" on org_notification_providers
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "org_notification_providers_write_staff" on org_notification_providers
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
  ) with check (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin', 'manager')
    )
  );
