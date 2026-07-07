# Staff Domain

> Phase: 4
> Status: Not built
> Note: Housekeeping staff covered in Housekeeping domain. This covers general staff scheduling.

---

## Overview

Staff management covers scheduling for all operations staff: housekeepers, maintenance workers, property managers. Initially simple — who is assigned where, on which day.

---

## Entities

### StaffMember (part of Housekeeping domain schema, extended here)
General staff member record for operations.

### StaffSchedule

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| staff_id | uuid | |
| property_id | uuid? | Which property |
| date | date | |
| shift_start | time | |
| shift_end | time | |
| notes | text? | |

---

## Phase 4 Scope

- View staff roster per property per week
- Assign staff to properties for specific dates
- Track hours (basic)

Full payroll and HR features are out of scope for Airaroots.
