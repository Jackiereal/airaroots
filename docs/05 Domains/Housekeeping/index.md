# Housekeeping Domain

> Phase: 4
> Status: Not built
> Depends on: Reservation domain (Phase 1)

---

## Overview

Housekeeping manages cleaning tasks triggered by reservations. When a guest checks out, the system automatically creates a housekeeping task for that property. Housekeeping staff receive tasks on their mobile device, complete a checklist, and upload photos as proof.

---

## Entities

### HousekeepingTask

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| property_id | uuid | |
| reservation_id | uuid? | Which checkout triggered this |
| task_type | enum | checkout_clean, mid_stay, inspection, deep_clean |
| status | enum | pending, assigned, in_progress, completed, cancelled |
| assigned_to | uuid? | Housekeeping staff ID |
| scheduled_date | date | When to clean |
| scheduled_time | time? | Target completion time |
| started_at | timestamptz? | When staff started |
| completed_at | timestamptz? | When marked complete |
| checklist | jsonb | [{item: "Change bed linens", completed: false, notes: ""}] |
| notes | text? | |

### HousekeepingStaff

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| organization_id | uuid | |
| name | text | |
| phone | text? | |
| email | text? | |
| status | enum | active, inactive |
| user_id | uuid? | If staff has app access |

### HousekeepingPhoto

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| task_id | uuid | |
| url | text | Supabase Storage URL |
| caption | text? | |
| uploaded_by | uuid? | |

---

## Task Auto-Creation Flow

```typescript
// Triggered by reservation.checked_out event

export const HousekeepingEventHandlers = {
  onCheckout: async (event: DomainEvent<{ reservation: Reservation }>) => {
    const { reservation } = event.payload;

    // Get default checklist for property
    const checklist = await getDefaultChecklist(reservation.propertyId);

    // Find next-checkin time (for scheduling urgency)
    const nextCheckin = await reservationService.getNextCheckIn(
      reservation.propertyId,
      reservation.checkOut
    );

    await housekeepingService.createTask({
      propertyId: reservation.propertyId,
      organizationId: reservation.organizationId,
      reservationId: reservation.id,
      taskType: 'checkout_clean',
      scheduledDate: new Date(reservation.checkOut),
      scheduledTime: nextCheckin ? subtractHours(nextCheckin, 2) : '14:00',
      checklist,
    });
  },

  onCancellation: async (event: DomainEvent) => {
    const { reservation } = event.payload;
    // Cancel any pending housekeeping tasks for this reservation
    await housekeepingService.cancelTasksForReservation(reservation.id);
  },
};
```

---

## Default Checklist Template

```json
[
  { "item": "Remove all guest items / lost & found check", "category": "general" },
  { "item": "Change all bed linens", "category": "bedroom" },
  { "item": "Replace towels (bath, hand, face)", "category": "bathroom" },
  { "item": "Clean and disinfect bathroom surfaces", "category": "bathroom" },
  { "item": "Clean toilet", "category": "bathroom" },
  { "item": "Restock toiletries (shampoo, soap, toilet paper)", "category": "bathroom" },
  { "item": "Mop bathroom floor", "category": "bathroom" },
  { "item": "Clean kitchen countertops", "category": "kitchen" },
  { "item": "Wash and dry dishes", "category": "kitchen" },
  { "item": "Clean stovetop and microwave", "category": "kitchen" },
  { "item": "Empty refrigerator of perishables", "category": "kitchen" },
  { "item": "Restock kitchen supplies (coffee, tea, sugar)", "category": "kitchen" },
  { "item": "Vacuum all carpeted areas", "category": "cleaning" },
  { "item": "Mop all hard floors", "category": "cleaning" },
  { "item": "Wipe down all surfaces and mirrors", "category": "cleaning" },
  { "item": "Empty all trash bins", "category": "cleaning" },
  { "item": "Check all appliances work (AC, TV, WiFi)", "category": "check" },
  { "item": "Lock all doors and windows", "category": "security" },
  { "item": "Take completion photos", "category": "documentation" }
]
```

---

## Service Interface

```typescript
interface HousekeepingService {
  createTask(input: CreateTaskInput): Promise<HousekeepingTask>;
  updateTask(id: string, input: UpdateTaskInput): Promise<HousekeepingTask>;
  assignTask(id: string, staffId: string): Promise<HousekeepingTask>;
  startTask(id: string, staffId: string): Promise<HousekeepingTask>;
  completeTask(id: string, staffId: string, completedChecklist: ChecklistItem[]): Promise<HousekeepingTask>;
  cancelTask(id: string, reason: string): Promise<HousekeepingTask>;
  cancelTasksForReservation(reservationId: string): Promise<void>;

  addPhoto(taskId: string, url: string, caption?: string, uploadedBy?: string): Promise<HousekeepingPhoto>;

  getTodaysTasks(orgId: string, date: Date): Promise<HousekeepingTask[]>;
  getTasksByProperty(propertyId: string, date: Date): Promise<HousekeepingTask[]>;
  getStaffWorkload(orgId: string, date: Date): Promise<StaffWorkload[]>;
}
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/housekeeping/tasks | List tasks (org-scoped, today by default) |
| POST | /api/housekeeping/tasks | Create manual task |
| GET | /api/housekeeping/tasks/:id | Task detail |
| PATCH | /api/housekeeping/tasks/:id | Update task |
| POST | /api/housekeeping/tasks/:id/assign | Assign to staff |
| POST | /api/housekeeping/tasks/:id/start | Mark started |
| POST | /api/housekeeping/tasks/:id/complete | Mark completed |
| POST | /api/housekeeping/tasks/:id/photos | Upload photo |
| GET | /api/housekeeping/staff | List staff |
| POST | /api/housekeeping/staff | Add staff member |
| PATCH | /api/housekeeping/staff/:id | Update staff |

---

## Mobile Interface Requirements

The housekeeping mobile interface must work on:
- Low-end Android phones (512MB RAM)
- Offline or poor network conditions (tasks loaded, checklist works offline)
- Simple touch targets (44px minimum)
- Photo upload from camera or gallery

Key screens:
1. **My Tasks Today** — list of assigned tasks with property name and time
2. **Task Detail** — checklist, notes, photo upload
3. **Report Issue** — quick maintenance request from within task
