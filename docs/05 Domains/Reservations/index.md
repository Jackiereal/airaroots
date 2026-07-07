# Reservation Domain

> Phase: 1 (Priority: P0)
> Status: Not built

---

## Overview

The Reservation domain is the core of Airaroots. Everything else derives from it. A reservation represents a single confirmed stay at a property — regardless of which channel it came from.

**Do not start building any other domain until the Reservation domain is complete and tested.**

---

## Entities

### Reservation (Aggregate Root)

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Owning organization |
| property_id | uuid | Which property |
| guest_id | uuid? | Linked guest record |
| channel | enum | airbnb, booking_com, direct, vrbo, expedia, other |
| platform_booking_id | text? | External booking reference (e.g., Airbnb confirmation code) |
| check_in | date | Check-in date |
| check_out | date | Check-out date |
| nights | int (computed) | check_out - check_in |
| adults | int | Adult guests |
| children | int | Child guests |
| pets | int | Pets |
| status | enum | See state machine below |
| nightly_rate | decimal | Per-night rate charged |
| cleaning_fee | decimal | One-time cleaning fee |
| taxes | decimal | Total taxes collected |
| other_fees | decimal | Other fees |
| gross_revenue | decimal (computed) | nightly_rate × nights + fees |
| platform_commission | decimal | Amount taken by channel (e.g., Airbnb service fee) |
| net_payout | decimal (computed) | gross - commission |
| guest_name | text | Denormalized for quick display |
| guest_email | text | Denormalized |
| guest_phone | text | Denormalized |
| notes | text? | Internal notes |
| raw_payload | jsonb? | Original channel payload (immutable) |

### Status State Machine

```
         ┌──────────┐
         │ inquiry  │  (optional — for unconfirmed)
         └────┬─────┘
              │ confirm
              ▼
         ┌──────────┐
    ┌───►│confirmed │◄────── channel sync creates in this state
    │    └────┬─────┘
    │         │ check_in action
    │         ▼
    │    ┌──────────┐
    │    │checked_in│
    │    └────┬─────┘
    │         │ check_out action
    │         ▼
    │    ┌──────────────┐
    │    │ checked_out  │  ← triggers housekeeping task
    │    └──────────────┘
    │
    │ cancel (from confirmed or checked_in)
    ▼
┌──────────┐
│cancelled │
└──────────┘

Also:
confirmed → conflict  (when duplicate booking detected)
any → no_show         (guest never arrives)
```

---

## Service Interface

```typescript
// src/domains/reservation/services/reservation.service.ts

interface ReservationService {
  // Create a manual reservation (admin/manager action)
  create(input: CreateReservationInput, actorId: string): Promise<Reservation>;

  // Process a reservation from a channel (system action)
  processChannelReservation(payload: ChannelReservationPayload): Promise<Reservation>;

  // Update reservation details
  update(id: string, input: UpdateReservationInput, actorId: string): Promise<Reservation>;

  // Cancel a reservation
  cancel(id: string, reason: string, actorId: string): Promise<Reservation>;

  // Status transitions
  checkIn(id: string, actorId: string): Promise<Reservation>;
  checkOut(id: string, actorId: string): Promise<Reservation>;
  markNoShow(id: string, actorId: string): Promise<Reservation>;

  // Query
  findById(id: string): Promise<Reservation | null>;
  findByProperty(propertyId: string, opts?: QueryOptions): Promise<PaginatedResult<Reservation>>;
  findByOrganization(orgId: string, opts?: QueryOptions): Promise<PaginatedResult<Reservation>>;
  findByDateRange(propertyId: string, from: Date, to: Date): Promise<Reservation[]>;

  // Conflict detection
  checkConflicts(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string
  ): Promise<ConflictResult>;
}

type ConflictResult = {
  hasConflict: boolean;
  conflicts: Array<{ id: string; checkIn: string; checkOut: string; guestName: string | null }>;
};
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/reservations | List reservations (org-scoped) |
| POST | /api/reservations | Create reservation |
| GET | /api/reservations/:id | Get reservation detail |
| PATCH | /api/reservations/:id | Update reservation |
| POST | /api/reservations/:id/cancel | Cancel reservation |
| POST | /api/reservations/:id/check-in | Mark checked in |
| POST | /api/reservations/:id/check-out | Mark checked out |
| GET | /api/reservations/:id/events | Get reservation event history |
| GET | /api/properties/:id/reservations | List reservations for a property |
| GET | /api/properties/:id/reservations/upcoming | Next 30 days |

---

## Conflict Detection Logic

```typescript
// src/domains/reservation/services/conflict-detection.service.ts

async check(propertyId: string, checkIn: Date, checkOut: Date, excludeId?: string): Promise<ConflictResult> {
  // A conflict exists when any existing confirmed reservation's date range overlaps with the new one.
  // Overlap condition: existing.check_in < new.check_out AND existing.check_out > new.check_in
  //
  // This covers:
  // - New reservation starts during existing reservation
  // - New reservation ends during existing reservation
  // - New reservation fully contains existing reservation
  // - Existing reservation fully contains new reservation
  //
  // No conflict when:
  // - Existing check_out === new check_in (back-to-back is allowed)
  // - Existing check_in === new check_out (back-to-back is allowed)

  const conflicts = await this.repository.findConflicts(propertyId, checkIn, checkOut, excludeId);
  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map(r => ({
      id: r.id,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      guestName: r.guestName ?? null,
    })),
  };
}
```

---

## Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `reservation.created` | New reservation confirmed | Full reservation object |
| `reservation.modified` | Dates or rates changed | Old + new reservation |
| `reservation.cancelled` | Cancellation processed | Reservation + reason |
| `reservation.checked_in` | Status → checked_in | Reservation |
| `reservation.checked_out` | Status → checked_out | Reservation |
| `reservation.conflict_detected` | Overlapping booking found | Both conflicting reservations |
| `reservation.no_show` | Status → no_show | Reservation |

---

## Domain Events Consumed

| Event | From | Action |
|-------|------|--------|
| `channel.reservation_received` | Channel domain | Call `processChannelReservation()` |

---

## Key Business Rules

1. **No overlapping reservations** — conflict detection is mandatory, not optional
2. **Channel reservations are idempotent** — syncing the same Airbnb booking twice creates/updates, never duplicates (use `platform_booking_id` for deduplication)
3. **Cancellation does not delete** — sets `status = 'cancelled'` and `deleted_at` — record retained forever
4. **Nights computed automatically** — never accept `nights` as input; derive from check_in and check_out
5. **Financial fields set at creation** — rates are locked in at booking time; do not recalculate automatically if property base_rate changes later
6. **Status transitions are validated** — cannot go from `checked_out` to `confirmed`

---

## Implementation Checklist (Phase 1)

- [ ] Create `reservations` table migration (003_add_reservations.sql)
- [ ] Create `reservation_events` table migration
- [ ] Build `ReservationRepository`
- [ ] Build `ConflictDetectionService`
- [ ] Build `ReservationService`
- [ ] Write unit tests for service (conflict detection scenarios)
- [ ] Build API routes (GET, POST, PATCH, cancel, check-in, check-out)
- [ ] Write integration tests for API routes
- [ ] Build `ReservationCalendar` component (multi-property timeline)
- [ ] Build `ReservationForm` component (modal)
- [ ] Build `ReservationDetail` panel (sidebar)
- [ ] Connect calendar to API
- [ ] Wire up Supabase Realtime for live calendar updates
- [ ] Test: create reservation → verify calendar blocks
- [ ] Test: create conflicting reservation → verify error
- [ ] Test: cancel reservation → verify unblocked
