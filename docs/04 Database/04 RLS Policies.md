# RLS Policies

> Complete Row Level Security policy specification for all tables.

---

## RLS Philosophy

1. **Default deny** — RLS enabled on all tables means no access unless explicitly granted
2. **Three access tiers** — Organization members, Owner portal users, Platform admins
3. **Role-based within orgs** — owners/admins see all; managers/viewers see assigned properties
4. **No service role in client** — Never use the Supabase service role key in browser code

---

## Helper Functions

```sql
-- Check if current user is a member of an organization
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's role in an organization
CREATE OR REPLACE FUNCTION get_org_role(org_id uuid)
RETURNS text AS $$
  SELECT role FROM organization_members
  WHERE organization_id = org_id AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is org admin or owner
CREATE OR REPLACE FUNCTION is_org_admin(org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get all organization IDs the current user belongs to
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get property IDs accessible to current user (for manager/viewer scoped access)
CREATE OR REPLACE FUNCTION get_accessible_property_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    -- Admin/owner: all org properties
    SELECT p.id FROM properties p
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE om.user_id = auth.uid() AND om.role IN ('owner','admin')
    UNION
    -- Manager/viewer: assigned properties via property_access
    SELECT pa.property_id FROM property_access pa
    WHERE pa.user_id = auth.uid()
    UNION
    -- Owner portal: properties with explicit access grant
    SELECT pa2.property_id FROM property_access pa2
    WHERE pa2.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

## RLS Policy Matrix

### organizations

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can read their organizations
CREATE POLICY "org_select_member" ON organizations
  FOR SELECT USING (id = ANY(get_user_org_ids()));

-- Only owner can update
CREATE POLICY "org_update_owner" ON organizations
  FOR UPDATE USING (is_org_admin(id));

-- Only authenticated users can create (handled at app layer, not RLS)
CREATE POLICY "org_insert_auth" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

### organization_members

```sql
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Members can see other members of their organizations
CREATE POLICY "members_select_org" ON organization_members
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

-- Only admins/owners can insert (invite)
CREATE POLICY "members_insert_admin" ON organization_members
  FOR INSERT WITH CHECK (is_org_admin(organization_id));

-- Only admins/owners can update (change role)
CREATE POLICY "members_update_admin" ON organization_members
  FOR UPDATE USING (is_org_admin(organization_id));

-- Only admins/owners can delete (remove member)
CREATE POLICY "members_delete_admin" ON organization_members
  FOR DELETE USING (is_org_admin(organization_id));
```

### properties

```sql
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Any org member or portal user can view accessible properties
CREATE POLICY "properties_select" ON properties
  FOR SELECT USING (id = ANY(get_accessible_property_ids()));

-- Only admins can create properties
CREATE POLICY "properties_insert_admin" ON properties
  FOR INSERT WITH CHECK (is_org_admin(organization_id));

-- Only admins can update properties
CREATE POLICY "properties_update_admin" ON properties
  FOR UPDATE USING (is_org_admin(organization_id));

-- Only owners can delete (soft delete via deleted_at)
CREATE POLICY "properties_delete_owner" ON properties
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
```

### reservations

```sql
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Any org member with property access can view reservations
CREATE POLICY "reservations_select" ON reservations
  FOR SELECT USING (
    property_id = ANY(get_accessible_property_ids())
    AND organization_id = ANY(get_user_org_ids())
  );

-- Admins and managers can create reservations
CREATE POLICY "reservations_insert" ON reservations
  FOR INSERT WITH CHECK (
    organization_id = ANY(get_user_org_ids())
    AND (
      is_org_admin(organization_id)
      OR EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = reservations.organization_id
        AND user_id = auth.uid()
        AND role = 'manager'
      )
    )
  );

-- Admins and managers can update
CREATE POLICY "reservations_update" ON reservations
  FOR UPDATE USING (
    organization_id = ANY(get_user_org_ids())
    AND (
      is_org_admin(organization_id)
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = reservations.organization_id
        AND om.user_id = auth.uid()
        AND om.role = 'manager'
      )
    )
  );
```

### revenue_entries

```sql
ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revenue_select" ON revenue_entries
  FOR SELECT USING (
    organization_id = ANY(get_user_org_ids())
    AND property_id = ANY(get_accessible_property_ids())
  );

-- Only system (service role) creates revenue entries — not direct user insert
-- Revenue entries are created by background jobs using service role
```

### property_finance_expenses

```sql
ALTER TABLE property_finance_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_admin_all" ON property_finance_expenses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM properties p
      JOIN organization_members om ON om.organization_id = p.organization_id
      WHERE p.id = property_finance_expenses.property_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin')
    )
  );

CREATE POLICY "expenses_client_select" ON property_finance_expenses
  FOR SELECT USING (
    property_id IN (
      SELECT property_id FROM property_access WHERE user_id = auth.uid()
    )
  );
```

### housekeeping_tasks

```sql
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;

-- Org members can see tasks for accessible properties
CREATE POLICY "hk_tasks_select" ON housekeeping_tasks
  FOR SELECT USING (
    organization_id = ANY(get_user_org_ids())
    AND property_id = ANY(get_accessible_property_ids())
  );

-- Admins and managers can create tasks
CREATE POLICY "hk_tasks_insert" ON housekeeping_tasks
  FOR INSERT WITH CHECK (is_org_member(organization_id));

-- Assigned housekeeper can update task status (if they have user_id)
-- Also admins/managers
CREATE POLICY "hk_tasks_update" ON housekeeping_tasks
  FOR UPDATE USING (
    organization_id = ANY(get_user_org_ids())
    OR assigned_to IN (
      SELECT id FROM housekeeping_staff WHERE user_id = auth.uid()
    )
  );
```

### maintenance_requests

```sql
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Any org member can view maintenance requests for accessible properties
CREATE POLICY "maintenance_select" ON maintenance_requests
  FOR SELECT USING (
    organization_id = ANY(get_user_org_ids())
    AND property_id = ANY(get_accessible_property_ids())
  );

-- Any org member can create a maintenance request
CREATE POLICY "maintenance_insert" ON maintenance_requests
  FOR INSERT WITH CHECK (is_org_member(organization_id));

-- Admins and managers can update
CREATE POLICY "maintenance_update" ON maintenance_requests
  FOR UPDATE USING (is_org_admin(organization_id));
```

### guests

```sql
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guests_select" ON guests
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

CREATE POLICY "guests_insert" ON guests
  FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "guests_update" ON guests
  FOR UPDATE USING (is_org_admin(organization_id));
```

### channel_connections

```sql
ALTER TABLE channel_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels_select" ON channel_connections
  FOR SELECT USING (organization_id = ANY(get_user_org_ids()));

-- Only admins can manage channel connections
CREATE POLICY "channels_admin_all" ON channel_connections
  FOR ALL USING (is_org_admin(organization_id));
```

### subscriptions

```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Only org owners can see billing info
CREATE POLICY "subscriptions_owner_select" ON subscriptions
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );
```

### audit_log

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view audit log
CREATE POLICY "audit_admin_select" ON audit_log
  FOR SELECT USING (is_org_admin(organization_id));

-- Any authenticated user can insert (system events)
CREATE POLICY "audit_insert_authed" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

### background_jobs

```sql
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- Jobs are only managed by service role (admin tool only)
-- No client access needed — only admins via admin dashboard
CREATE POLICY "jobs_admin_select" ON background_jobs
  FOR SELECT USING (
    organization_id IS NULL -- system jobs
    OR is_org_admin(organization_id)
  );
```

### feature_flags

```sql
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read feature flags
CREATE POLICY "flags_select_authed" ON feature_flags
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only platform admins can modify (via service role in admin panel)
```

---

## Legacy Tables (existing — transition policies)

### For tables without organization_id (temporary during migration):

```sql
-- properties_admin_all (existing)
CREATE POLICY "properties_admin_all" ON properties
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- properties_client_select (existing)
CREATE POLICY "properties_client_select" ON properties
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM property_access WHERE property_id = properties.id AND user_id = auth.uid())
  );
```

These policies are replaced in Phase 8 when organization_id is added to properties.

---

## Testing RLS Policies

Always test RLS policies in staging:

```sql
-- Switch to a test user
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"user-A-id"}';

-- This should return 0 rows for User A if they don't belong to org-B
SELECT COUNT(*) FROM reservations WHERE organization_id = 'org-B-id';
-- Expected: 0

-- This should return reservations for org-A
SELECT COUNT(*) FROM reservations WHERE organization_id = 'org-A-id';
-- Expected: >0 (if user A belongs to org-A)

RESET ROLE;
```
