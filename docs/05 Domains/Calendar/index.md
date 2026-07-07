# Calendar Domain

> Phase: 1
> Status: Not built
> Depends on: Reservation domain

---

## Overview

The Calendar domain manages date blocking, availability, and multi-property calendar views. It listens to reservation events and maintains calendar_blocks accordingly. It is also the domain where manual blocks (owner holds, maintenance closures) are created.

---

## Entities

### CalendarBlock

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | Owning org |
| property_id | uuid | Which property |
| reservation_id | uuid? | Linked reservation (if type = 'reservation') |
| start_date | date | Block start |
| end_date | date | Block end (inclusive) |
| block_type | enum | reservation, owner_hold, maintenance, buffer, seasonal_close |
| reason | text? | Description for holds |
| is_public | boolean | Whether visible in public availability |

### SeasonalRate

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | |
| property_id | uuid | |
| name | text | "Diwali Peak", "Monsoon Off-season" |
| start_date | date | |
| end_date | date | |
| nightly_rate | decimal | Override rate for this period |
| min_nights | int | Minimum stay during this period |
| is_active | boolean | |

---

## Service Interface

```typescript
interface CalendarService {
  // Blocks
  createBlock(input: CreateBlockInput, actorId: string): Promise<CalendarBlock>;
  updateBlock(id: string, input: UpdateBlockInput): Promise<CalendarBlock>;
  deleteBlock(id: string, actorId: string): Promise<void>;

  // Query
  getBlocksForProperty(propertyId: string, from: Date, to: Date): Promise<CalendarBlock[]>;
  getBlocksForOrganization(orgId: string, from: Date, to: Date): Promise<CalendarBlock[]>;

  // Availability
  checkAvailability(propertyId: string, checkIn: Date, checkOut: Date): Promise<AvailabilityResult>;
  getAvailableNights(propertyId: string, month: Date): Promise<Date[]>;

  // Seasonal rates
  getRateForDate(propertyId: string, date: Date): Promise<number>;
  getSeasonalRates(propertyId: string): Promise<SeasonalRate[]>;
  createSeasonalRate(input: CreateSeasonalRateInput): Promise<SeasonalRate>;
}

type AvailabilityResult = {
  available: boolean;
  blockedBy?: CalendarBlock[];
};
```

---

## Event Handlers

```typescript
// src/domains/calendar/event-handlers/index.ts

export const CalendarEventHandlers = {
  // When reservation is created → block those dates
  onReservationCreated: async (event: DomainEvent) => {
    const { reservation } = event.payload;
    await calendarService.createBlock({
      propertyId: reservation.propertyId,
      reservationId: reservation.id,
      startDate: reservation.checkIn,
      endDate: reservation.checkOut,
      blockType: 'reservation',
    }, 'system');
  },

  // When reservation is modified → update block dates
  onReservationModified: async (event: DomainEvent) => {
    const { old: oldRes, new: newRes } = event.payload;
    await calendarService.updateBlockByReservationId(newRes.id, {
      startDate: newRes.checkIn,
      endDate: newRes.checkOut,
    });
  },

  // When reservation is cancelled → remove block
  onReservationCancelled: async (event: DomainEvent) => {
    const { reservation } = event.payload;
    await calendarService.deleteBlockByReservationId(reservation.id);
  },
};
```

---

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/calendar | Get blocks for org (all properties) |
| GET | /api/properties/:id/calendar | Get blocks for single property |
| POST | /api/properties/:id/calendar/block | Create manual block |
| PATCH | /api/properties/:id/calendar/block/:blockId | Update block |
| DELETE | /api/properties/:id/calendar/block/:blockId | Delete block |
| GET | /api/properties/:id/availability | Check availability for dates |
| GET | /api/properties/:id/seasonal-rates | List seasonal rates |
| POST | /api/properties/:id/seasonal-rates | Create seasonal rate |

---

## Calendar Views

### Multi-Property Timeline (Primary View)

```
                     Oct 1    Oct 5    Oct 10   Oct 15   Oct 20   Oct 25   Oct 31
                       │        │        │        │        │        │        │
Sea Breeze Villa   ────┤░░░░░░░░│████████│        │░░░░░░░░│        │████████│
Sunset Cottage     ────┤        │        │████████│        │████████│        │
Palm Grove         ────┤░░░░░░░░│░░░░░░░░│████████│████████│        │        │
Mountain View      ────┤        │████████│        │        │░░░░░░░░│        │

Legend: ████ Airbnb  ░░░░ Direct  ---- Owner Hold  ---- Maintenance
```

**Implementation:** Custom React component using absolute positioning or CSS Grid.
- Each property is a row
- Each day is a column (for month view: 28–31 columns)
- Reservations rendered as colored spans overlaying the grid

### Month View (Single Property)

Standard calendar grid. Each day cell shows:
- Booking indicator (colored dot)
- First 1–2 chars of guest name if booked
- Occupancy status (available / blocked)

### Week View

7-column grid. More detail per day. Shows check-in/check-out times.

---

## Color System for Channels

| Channel | Color | CSS Class |
|---------|-------|-----------|
| Airbnb | `#FF5A5F` (Airbnb red) | `bg-channel-airbnb` |
| Booking.com | `#003580` (Booking.com blue) | `bg-channel-booking` |
| Direct | `#22c55e` (green-500) | `bg-channel-direct` |
| Owner Hold | `#6b7280` (gray-500) | `bg-channel-hold` |
| Maintenance | `#f59e0b` (amber-500) | `bg-channel-maintenance` |
| VRBO | `#1B6FEC` | `bg-channel-vrbo` |

---

## Availability Engine

```typescript
// For a given property and date range:
// 1. Fetch all calendar_blocks that overlap the range
// 2. If any block exists, property is unavailable
// 3. Also check seasonal minimum nights

async function checkAvailability(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<AvailabilityResult> {
  const blocks = await repository.findConflictingBlocks(propertyId, checkIn, checkOut);

  if (blocks.length === 0) {
    return { available: true };
  }

  return {
    available: false,
    blockedBy: blocks,
  };
}
```

---

## iCal Export (Phase 2)

Each property gets a unique iCal URL:
```
https://app.airaroots.com/api/properties/{id}/calendar.ics?token={secret}
```

The endpoint generates a valid `.ics` file with all blocked dates, enabling sync to:
- Google Calendar
- Apple Calendar
- Any other iCal-compatible tool

Token is a property-specific secret stored in `properties.ical_token`.
