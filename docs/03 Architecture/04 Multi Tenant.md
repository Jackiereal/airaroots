# Multi-Tenant Architecture

---

## Tenancy Model

Airaroots uses a **shared database, shared schema, row-level isolation** multi-tenancy model.

All organizations share the same PostgreSQL database and same table schemas. Data isolation is enforced via:
1. `organization_id` column on every tenant-scoped table
2. Row Level Security (RLS) policies that restrict access to the current user's organization
3. Application-layer checks as secondary defense

This model is chosen over separate schemas or separate databases because:
- Lower operational overhead (one database to manage)
- Simpler migrations (run once, applies to all tenants)
- Supabase RLS makes it safe and correct
- Cost-effective at current scale

---

## Organization Hierarchy

```
Organization
  ├── Members (users with roles)
  ├── Properties (1 to 500)
  │     ├── Reservations
  │     ├── Finance records
  │     └── Operations
  └── Subscription (plan, billing)
```

A user can be a member of multiple organizations (e.g., a consultant working with multiple PMCs).

When a user logs in, the app detects their organization memberships and lets them switch context. All data queries are scoped to the currently active organization.

---

## Role Hierarchy

```
Organization Roles (descending authority):
  owner    → Full access. Can manage billing, invite/remove members, delete org.
  admin    → All data access. Cannot manage billing or delete org.
  manager  → Access to assigned properties. Cannot manage users.
  viewer   → Read-only on assigned properties.

System-Level Roles (outside org context):
  platform_admin → Airaroots staff. Can see all organizations (support access).
```

### Role Permission Matrix

| Action | owner | admin | manager | viewer |
|--------|-------|-------|---------|--------|
| View all properties | Y | Y | Assigned only | Assigned only |
| Create property | Y | Y | N | N |
| Create reservation | Y | Y | Y | N |
| Edit reservation | Y | Y | Y | N |
| Delete reservation | Y | Y | N | N |
| Manage expenses | Y | Y | Y | N |
| View finance | Y | Y | Assigned | Assigned |
| Manage housekeeping | Y | Y | Y | N |
| View housekeeping | Y | Y | Y | Y |
| Create maintenance request | Y | Y | Y | Y |
| Manage users | Y | Y | N | N |
| Manage billing | Y | N | N | N |
| Connect channels | Y | Y | N | N |
| View AI insights | Y | Y | Y | N |
| Access owner portal | — | — | — | — (owners use separate portal) |

---

## Owner Portal vs Staff Portal

Two separate access paradigms:

**Staff Portal (`/dashboard/**`):**
- For organization members (owner, admin, manager, viewer)
- Full operational access per their role
- Current implementation lives here

**Owner Portal (`/client/**`):**
- For property owners who are NOT organization staff
- Read-only view of their properties
- Shows revenue, occupancy, expense summary, upcoming reservations
- Cannot see other owners' properties
- Cannot make any changes

Access control:
```
Staff portal: user must have organization_member record
Owner portal: user must have property_access record (property_owners table)
```

---

## Organization Onboarding Flow

```
1. User signs up → user_profiles record created (no org yet)

2. User creates organization → organizations record + organization_members record (role: owner)

3. User adds properties → properties linked to organization_id

4. User invites team → organization_invitations record created
   → Invitation email sent with unique token
   → Invitee clicks link, signs up / logs in
   → organization_members record created with specified role

5. User grants property access to external owners →
   → property_access record created
   → Owner portal access enabled for that user
```

---

## RLS Architecture

Every table that stores tenant data must have:

1. `organization_id` column (UUID, not null, references organizations)
2. RLS enabled (`ALTER TABLE x ENABLE ROW LEVEL SECURITY`)
3. Policies for each operation (SELECT, INSERT, UPDATE, DELETE)

### RLS Policy Pattern

```sql
-- Pattern 1: Organization member can access all org data
CREATE POLICY "org_member_select" ON reservations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Pattern 2: Manager role restricted to assigned properties
CREATE POLICY "manager_property_select" ON reservations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
    OR (
      property_id IN (
        SELECT property_id FROM property_assignments
        WHERE user_id = auth.uid()
      )
      AND organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
        AND role IN ('manager', 'viewer')
      )
    )
  );

-- Pattern 3: Owner portal access (read-only, assigned properties)
CREATE POLICY "owner_portal_select" ON reservations
  FOR SELECT USING (
    property_id IN (
      SELECT property_id FROM property_access
      WHERE user_id = auth.uid()
    )
  );

-- Pattern 4: Insert must match user's organization
CREATE POLICY "org_member_insert" ON reservations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );
```

---

## Current Schema Gap (Migration Required)

Current schema does NOT have `organizations` table or multi-tenancy. The existing implementation uses:
- `user_profiles.role` = 'admin' or 'client' (global roles, not per-org)
- `property_access` table for client→property mapping
- No organization_id on any table

**Migration plan for Phase 8 (Organizations):**

1. Create `organizations` table
2. Create `organization_members` table
3. Create a default organization for all existing users
4. Add `organization_id` to `properties`, `reservations`, and all other tables
5. Backfill `organization_id` from existing data
6. Update RLS policies
7. Update all queries to include `organization_id` filter
8. Deprecate the old `user_profiles.role` system

See `04 Database/05 Migrations.md` for detailed migration SQL.

---

## Subscription-Gated Features

Feature availability is controlled by the organization's subscription plan:

```typescript
// lib/subscription/check-feature.ts

interface FeatureCheck {
  organizationId: string;
  feature: FeatureFlag;
}

async function canUseFeature(check: FeatureCheck): Promise<boolean> {
  const subscription = await getActiveSubscription(check.organizationId);
  if (!subscription) return false;

  const plan = PLAN_FEATURES[subscription.plan_slug];
  return plan.features.includes(check.feature);
}

// Usage in API route:
const canUseWhatsApp = await canUseFeature({
  organizationId: user.organizationId,
  feature: 'whatsapp_automation'
});
if (!canUseWhatsApp) {
  return Response.json({ error: 'Upgrade to Growth plan to use WhatsApp automation' }, { status: 403 });
}
```

---

## Data Isolation Verification

The following queries must NEVER return rows from a different organization:

```sql
-- This query must only return reservations for org X
-- even if the attacker knows a reservation ID from org Y
EXPLAIN ANALYZE
SELECT * FROM reservations
WHERE id = '[known-id-from-org-Y]';
-- Expected: 0 rows (RLS filters it out)
```

Test this in staging after every RLS policy change.

---

## White Label (Phase 8)

Enterprise customers get white-label capability:

```
custom_domains table:
  id, organization_id, domain, verified, ssl_provisioned

Organization branding:
  organizations.settings JSONB:
    logo_url, primary_color, company_name, support_email

At runtime:
  Request comes in on client's custom domain
  Middleware reads domain → looks up organization
  UI renders with organization's branding
  All data scoped to that organization
```
