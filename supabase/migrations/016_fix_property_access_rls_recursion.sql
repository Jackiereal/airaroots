-- ─────────────────────────────────────────────
-- FIX: infinite recursion in property_access RLS
-- 015's property_access_select_org_staff (and insert/delete variants) join
-- through properties to check org-staff role. But properties' own SELECT
-- policy queries property_access. Any query touching both tables in the
-- same planning pass hits Postgres error 42P17 (infinite recursion
-- detected in policy for relation "property_access"). This silently broke
-- every RLS-client read that joins reservations/calendar_blocks/etc. to
-- properties, since those queries implicitly evaluate properties' policy,
-- which evaluates property_access's policy, which evaluates properties'
-- policy again.
--
-- Fix: a SECURITY DEFINER function that looks up org-staff status without
-- going through RLS at all, breaking the cycle. Policies call this
-- function instead of joining properties directly.
-- ─────────────────────────────────────────────

create or replace function is_org_staff_for_property(p_property_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from properties p
    join organization_members om on om.organization_id = p.organization_id
    where p.id = p_property_id
      and om.user_id = p_user_id
      and om.role in ('owner', 'admin', 'manager')
  );
$$;

drop policy if exists "property_access_select_own_or_org_staff" on property_access;
drop policy if exists "property_access_insert_org_staff" on property_access;
drop policy if exists "property_access_delete_org_staff" on property_access;

create policy "property_access_select_own_or_org_staff" on property_access
  for select using (
    user_id = auth.uid()
    or is_org_staff_for_property(property_id, auth.uid())
  );

create policy "property_access_insert_org_staff" on property_access
  for insert with check (
    is_org_staff_for_property(property_id, auth.uid())
  );

create policy "property_access_delete_org_staff" on property_access
  for delete using (
    is_org_staff_for_property(property_id, auth.uid())
  );
