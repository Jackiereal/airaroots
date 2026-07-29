-- ─────────────────────────────────────────────
-- housekeeping_checklist_templates was created ad-hoc (not in any
-- prior tracked migration) and never got RLS enabled — confirmed via
-- `select rowsecurity from pg_tables where tablename =
-- 'housekeeping_checklist_templates'` returning false. Not currently
-- exploitable (app code only queries it service-role, always scoped
-- by property_id, behind requirePropertyAccess/-Write), but any
-- future RLS-respecting-client read would be wide open. Bring it in
-- line with the same property_access-based policy shape used for
-- housekeeping_staff/housekeeping_tasks/etc in migration 015.
-- ─────────────────────────────────────────────

alter table housekeeping_checklist_templates enable row level security;

create policy "housekeeping_checklist_templates_select_access" on housekeeping_checklist_templates
  for select using (
    exists (select 1 from property_access pa where pa.property_id = housekeeping_checklist_templates.property_id and pa.user_id = auth.uid())
  );

create policy "housekeeping_checklist_templates_write_access_admin" on housekeeping_checklist_templates
  for all using (
    exists (select 1 from property_access pa where pa.property_id = housekeeping_checklist_templates.property_id and pa.user_id = auth.uid() and pa.role = 'admin')
  )
  with check (
    exists (select 1 from property_access pa where pa.property_id = housekeeping_checklist_templates.property_id and pa.user_id = auth.uid() and pa.role = 'admin')
  );
