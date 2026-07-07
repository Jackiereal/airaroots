# Organization Domain

> Phase: 8
> Status: Not built (current system has no org layer)
> Depends on: Nothing (foundational)

---

## Overview

The Organization domain introduces proper multi-tenancy. Currently, the system uses a simple admin/client role on user_profiles. In Phase 8, this is replaced with Organizations, where each business entity has its own data context.

**This is a breaking architectural change. All existing data must be migrated.**

---

## Entities

### Organization

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| name | text | Company/brand name |
| slug | text | URL-safe identifier |
| timezone | text | Default: Asia/Kolkata |
| currency | text | Default: INR |
| logo_url | text? | |
| settings | jsonb | { primary_color, support_email, invoice_prefix, gstin, address } |

### OrganizationMember

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| user_id | uuid | |
| role | enum | owner, admin, manager, viewer |
| invited_by | uuid? | Who invited this member |
| joined_at | timestamptz | |

### OrganizationInvitation

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| email | text | Invitee email |
| role | enum | Role to grant on acceptance |
| token | text | Unique invite token (sent in email link) |
| expires_at | timestamptz | 7 days from creation |
| accepted_at | timestamptz? | Set when accepted |

---

## Service Interface

```typescript
interface OrganizationService {
  create(input: CreateOrganizationInput, founderId: string): Promise<Organization>;
  update(id: string, input: UpdateOrganizationInput): Promise<Organization>;

  invite(orgId: string, email: string, role: OrgRole, invitedBy: string): Promise<Invitation>;
  acceptInvitation(token: string, userId: string): Promise<OrganizationMember>;
  removeMember(orgId: string, userId: string, removedBy: string): Promise<void>;
  updateMemberRole(orgId: string, userId: string, newRole: OrgRole): Promise<OrganizationMember>;

  findById(id: string): Promise<Organization | null>;
  findByUserId(userId: string): Promise<Organization[]>;  // Multi-org support
  getMembers(orgId: string): Promise<OrganizationMember[]>;
}
```

---

## Migration Plan (Phase 8)

See `04 Database/05 Migrations.md` — `010_add_organizations.sql` for full SQL.

Summary:
1. Create `organizations` table
2. Create `organization_members` table
3. For each existing admin user → create a default organization + set as owner
4. Add `organization_id` to `properties`, `reservations`, all finance tables, etc.
5. Backfill `organization_id` from `created_by` → admin → their org
6. Update all RLS policies to use org membership check
7. Deprecate `user_profiles.role` column
8. Update all API routes to resolve org context

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/organizations | Create organization |
| GET | /api/organizations/current | Get active org |
| PATCH | /api/organizations/current | Update org settings |
| GET | /api/organizations/current/members | List members |
| POST | /api/organizations/current/invite | Invite member |
| DELETE | /api/organizations/current/members/:userId | Remove member |
| PATCH | /api/organizations/current/members/:userId | Update role |
| POST | /api/auth/accept-invitation | Accept invitation |
| GET | /api/auth/invitation/:token | Validate invitation token |

---

## Organization Context in Requests

```typescript
// lib/auth/get-org-context.ts

export async function getOrgContext(
  supabase: SupabaseClient,
  userId: string,
  requestedOrgId?: string
): Promise<OrgContext> {
  const memberships = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId);

  if (!memberships.data?.length) {
    throw new ForbiddenError('User has no organization membership');
  }

  // If specific org requested (multi-org users), validate membership
  if (requestedOrgId) {
    const membership = memberships.data.find(m => m.organization_id === requestedOrgId);
    if (!membership) throw new ForbiddenError('Not a member of requested organization');
    return { organizationId: requestedOrgId, role: membership.role as OrgRole };
  }

  // Default: use first org (single-org users)
  const first = memberships.data[0];
  return { organizationId: first.organization_id, role: first.role as OrgRole };
}
```

Multi-org users select active org via `X-Organization-Id` header or org switcher in UI.
