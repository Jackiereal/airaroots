-- ─────────────────────────────────────────────
-- COMMUNICATION (Phase 5 foundation)
-- Automated guest messaging across the reservation lifecycle. This
-- migration is the data model only — templates + a send log. Actual
-- sending is stubbed in the app layer (no WhatsApp/email provider wired
-- yet), so every dispatch currently lands in communication_log with
-- status='stubbed'. When a real provider is added, nothing here changes.
--
-- Two org-scoped tables following the standard convention: bare
-- organization_id UUID (no FK), RLS via organization_members, shared
-- update_updated_at_column() trigger from migration 001.
-- ─────────────────────────────────────────────

create table communication_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trigger         text not null check (trigger in ('booking_confirmation', 'checkin_welcome', 'checkout_thankyou')),
  channel         text not null check (channel in ('whatsapp', 'email')),
  subject         text,               -- email only; null for whatsapp
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

-- Org members read their org's templates; owner/admin/manager write.
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

-- ─── Send log ────────────────────────────────────────────────────────────────
-- One row per dispatch attempt. Inserted only by the CommunicationHandler
-- via the service-role client (RLS-bypassing), so there is no insert policy
-- — org members can only read.
create table communication_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reservation_id  uuid not null,
  property_id     uuid,
  trigger         text not null,
  channel         text not null,
  recipient       text,               -- phone or email actually used
  rendered_body   text,
  status          text not null check (status in ('stubbed', 'sent', 'failed', 'skipped')),
  provider        text,               -- null while stubbed
  error           text,
  created_at      timestamptz not null default now()
);

create index idx_communication_log_reservation on communication_log (reservation_id);
create index idx_communication_log_org on communication_log (organization_id, created_at);

alter table communication_log enable row level security;

create policy "communication_log_select_members" on communication_log
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
