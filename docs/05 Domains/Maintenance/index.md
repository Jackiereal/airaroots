# Maintenance Domain

> Phase: 4
> Status: Not built
> Depends on: Property domain

---

## Overview

Maintenance tracks issues reported at properties. Any staff member (including housekeeping staff during cleaning) can create a maintenance request. Managers assign requests to vendors or internal staff, track progress, and log costs.

---

## Entities

### MaintenanceRequest

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| property_id | uuid | |
| reservation_id | uuid? | If issue discovered during a stay |
| title | text | Short description |
| description | text? | Detailed description |
| category | text | plumbing, electrical, appliance, structural, hvac, pest, other |
| priority | enum | low, medium, high, urgent |
| status | enum | reported, assigned, in_progress, resolved, closed |
| reported_by | uuid? | Staff who reported |
| assigned_to | uuid? | Staff assigned to fix |
| vendor_id | uuid? | External vendor assigned |
| estimated_cost | decimal? | |
| actual_cost | decimal? | |
| resolved_at | timestamptz? | |

### MaintenancePhoto

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| request_id | uuid | |
| url | text | Supabase Storage URL |
| caption | text? | |
| taken_by | uuid? | |
| created_at | timestamptz | |

---

## Status State Machine

```
reported → assigned → in_progress → resolved → closed

Any status → closed (admin override)
```

---

## Priority Definitions

| Priority | Response Time | Example |
|----------|--------------|---------|
| low | This week | Minor cosmetic issue |
| medium | Within 48hrs | Non-critical appliance issue |
| high | Within 24hrs | AC not working, blocked drain |
| urgent | Same day | No water, security issue, structural damage |

Urgent priority triggers immediate push notification to property manager.

---

## Service Interface

```typescript
interface MaintenanceService {
  create(input: CreateMaintenanceInput, reportedBy: string): Promise<MaintenanceRequest>;
  assign(id: string, assigneeId: string | null, vendorId: string | null): Promise<MaintenanceRequest>;
  updateStatus(id: string, status: MaintenanceStatus, actorId: string): Promise<MaintenanceRequest>;
  resolve(id: string, actualCost?: number): Promise<MaintenanceRequest>;
  close(id: string): Promise<MaintenanceRequest>;

  addPhoto(requestId: string, url: string, caption?: string, uploadedBy?: string): Promise<void>;

  getByProperty(propertyId: string, opts?: FilterOptions): Promise<MaintenanceRequest[]>;
  getByOrganization(orgId: string, opts?: FilterOptions): Promise<MaintenanceRequest[]>;
  getOpenRequests(orgId: string): Promise<MaintenanceRequest[]>;
}
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/maintenance | List all requests (org-scoped) |
| POST | /api/maintenance | Create request |
| GET | /api/maintenance/:id | Get detail |
| PATCH | /api/maintenance/:id | Update |
| POST | /api/maintenance/:id/assign | Assign to staff/vendor |
| POST | /api/maintenance/:id/resolve | Mark resolved |
| POST | /api/maintenance/:id/photos | Upload photo |
| GET | /api/maintenance/open | All open requests |
| GET | /api/vendors | List vendors |
| POST | /api/vendors | Add vendor |
| PATCH | /api/vendors/:id | Update vendor |
