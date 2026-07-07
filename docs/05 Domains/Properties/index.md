# Property Domain

> Phase: Existing + Phase 1 extensions
> Status: Basic CRUD built — needs extensions

---

## Overview

The Property domain manages the fundamental unit of the platform: a single rentable property. Properties are owned by organizations and serve as the anchor for reservations, finance, and operations.

---

## Current State

**Built:**
- Create/list/get properties
- Property owners (co-owners for OOP tracking)
- Property access (client portal grant)
- Airbnb/direct/mixed platform type
- Projections config (JSONB)

**Needs in Phase 1:**
- Check-in/checkout time
- Min/max nights
- Bedroom/bathroom/max guest count
- Base rate and weekend rate
- Property deactivation (is_active flag)

**Needs in Phase 3:**
- Property photos
- Amenities

---

## Entity Extensions (Phase 1)

```sql
-- Add to properties table in migration
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS bedrooms int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bathrooms int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_guests int DEFAULT 2,
  ADD COLUMN IF NOT EXISTS check_in_time time DEFAULT '14:00',
  ADD COLUMN IF NOT EXISTS check_out_time time DEFAULT '11:00',
  ADD COLUMN IF NOT EXISTS min_nights int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_nights int DEFAULT 365,
  ADD COLUMN IF NOT EXISTS cleaning_fee numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS security_deposit numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_rate numeric(14,2),
  ADD COLUMN IF NOT EXISTS weekend_rate numeric(14,2),
  ADD COLUMN IF NOT EXISTS property_type text DEFAULT 'villa',
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS house_rules text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
```

---

## Service Interface

```typescript
interface PropertyService {
  create(input: CreatePropertyInput, actorId: string): Promise<Property>;
  update(id: string, input: UpdatePropertyInput): Promise<Property>;
  deactivate(id: string): Promise<Property>;
  activate(id: string): Promise<Property>;

  findById(id: string): Promise<Property | null>;
  findByOrganization(orgId: string): Promise<Property[]>;
  findAccessible(userId: string): Promise<Property[]>;  // For client portal

  // Owners
  addOwner(propertyId: string, input: AddOwnerInput): Promise<PropertyOwner>;
  removeOwner(propertyId: string, ownerId: string): Promise<void>;
  grantClientAccess(propertyId: string, userId: string, grantedBy: string): Promise<void>;
  revokeClientAccess(propertyId: string, userId: string): Promise<void>;
}
```

---

## API Routes (Existing + Extended)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/properties | List all accessible properties |
| POST | /api/properties | Create property |
| GET | /api/properties/:id | Get property detail |
| PATCH | /api/properties/:id | Update property |
| POST | /api/properties/:id/deactivate | Deactivate |
| GET | /api/properties/:id/owners | List co-owners |
| POST | /api/properties/:id/owners | Add co-owner |
| DELETE | /api/properties/:id/owners/:ownerId | Remove co-owner |
| POST | /api/admin/property-access | Grant client portal access |
| DELETE | /api/admin/property-access | Revoke access |

---

## Property Type Enum

```
villa        — Standalone villa
apartment    — Apartment in a building
house        — Full house
room         — Individual room (hostel/guesthouse)
resort       — Resort unit / cottage
hostel       — Hostel bed (niche)
other        — Custom
```

---

## Validation Rules

1. `check_out_time` must be before `check_in_time` (e.g., 11am checkout, 2pm check-in)
2. `min_nights` must be ≥ 1
3. `max_nights` must be ≥ `min_nights`
4. `max_guests` must be ≥ 1
5. `base_rate` must be > 0 if property is connected to channels
6. Property cannot be deleted if it has active (non-cancelled) reservations
