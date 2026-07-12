-- ─────────────────────────────────────────────
-- AUTOMATION ENGINE
-- One business event fans out to MULTIPLE configurable actions per org.
-- Today the automation is hardcoded in three event handlers (calendar,
-- finance, housekeeping). This makes trigger→[actions] data-driven: a PMC
-- can configure "when a reservation is created, block the calendar AND
-- create a housekeeping task AND notify the cleaner" without a code change.
--
-- Slice 1 is CREATE-SIDE ONLY: additive actions on reservation.created and
-- reservation.checked_in. Stateful update/cancel logic (reschedule, move
-- block dates, zero finance) stays in the existing handlers for now.
--
-- conditions/actions are jsonb (ordered, heterogeneous action list — no
-- relational win from child tables; precedent = org_notification_providers
-- .config). Shape is validated by Zod on write + defensively in the engine.
--
-- Standard conventions: bare organization_id UUID (no FK), RLS via
-- organization_members, shared update_updated_at_column() from 001.
-- ─────────────────────────────────────────────

create table automation_rules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name            text not null,
  trigger         text not null check (trigger in (
                    'reservation.created', 'reservation.checked_in')),
  -- [{ field, op, value }] — ALL must pass (implicit AND). Empty [] = always.
  conditions      jsonb not null default '[]'::jsonb,
  -- ordered [{ type, params }] — array index is the execution order.
  actions         jsonb not null default '[]'::jsonb,
  is_active       boolean not null default true,
  -- seeded default rule: protected from delete, re-created by seedDefaults.
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- one system rule per (org, trigger, name) so seedDefaults is idempotent.
  unique (organization_id, trigger, name)
);

create index idx_automation_rules_org_trigger
  on automation_rules (organization_id, trigger) where is_active;

create trigger automation_rules_updated_at
  before update on automation_rules
  for each row execute function update_updated_at_column();

alter table automation_rules enable row level security;

create policy "automation_rules_select_members" on automation_rules
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

create policy "automation_rules_write_staff" on automation_rules
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

-- ─── Automation run log ──────────────────────────────────────────────────────
-- One row per action execution attempt. Inserted only by the RuleEngineService
-- via the service-role client; org members read. NO write policy (like
-- notification_log). The unique index on successful runs is the idempotency
-- guard: a re-published event (same event_id) cannot re-fire an action that
-- already succeeded for the same rule + action_index.
create table automation_run_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_id         uuid,                 -- nullable: rule may be deleted later
  trigger         text not null,
  event_id        text not null,        -- DomainEvent.eventId (dedup key)
  aggregate_id    text,                 -- reservation id
  action_type     text not null,
  action_index    integer not null,
  status          text not null check (status in ('success', 'skipped', 'failed')),
  detail          jsonb not null default '{}'::jsonb,  -- { resolvedParams, resultId, error }
  created_at      timestamptz not null default now()
);

create index idx_automation_run_log_org on automation_run_log (organization_id, created_at desc);

-- Idempotency: at most one SUCCESSFUL run per (event, rule, action).
create unique index uq_automation_run_dedup
  on automation_run_log (event_id, rule_id, action_index) where status = 'success';

alter table automation_run_log enable row level security;

create policy "automation_run_log_select_members" on automation_run_log
  for select using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );
