# Vendors Domain

> Phase: 4
> Status: Not built

---

## Overview

Vendor management tracks external service providers: plumbers, electricians, cleaning services, landscapers. Vendors are assigned to maintenance requests and their costs tracked.

---

## Entities

### Vendor

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| name | text | |
| category | text | plumbing, electrical, cleaning, landscaping, hvac, security, other |
| phone | text? | |
| email | text? | |
| address | text? | |
| notes | text? | Specialties, rates, reliability rating |
| rating | int? | Internal 1–5 star rating |
| is_active | boolean | |

---

## Service Interface

```typescript
interface VendorService {
  create(input: CreateVendorInput, orgId: string): Promise<Vendor>;
  update(id: string, input: UpdateVendorInput): Promise<Vendor>;
  deactivate(id: string): Promise<Vendor>;
  findById(id: string): Promise<Vendor | null>;
  findByOrganization(orgId: string, category?: string): Promise<Vendor[]>;
  getMaintenanceHistory(vendorId: string): Promise<MaintenanceSummary[]>;
}
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/vendors | List vendors (org-scoped) |
| POST | /api/vendors | Add vendor |
| GET | /api/vendors/:id | Get vendor detail |
| PATCH | /api/vendors/:id | Update vendor |
| DELETE | /api/vendors/:id | Deactivate vendor |
| GET | /api/vendors/:id/history | Maintenance jobs done by vendor |
