# Domain-Driven Design

---

## Bounded Contexts

Airaroots is divided into 12 bounded contexts. Each owns its data, services, repositories, and API routes. No cross-domain direct database queries.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AIRAROOTS BOUNDED CONTEXTS                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Organization │  │    Auth /    │  │   Property   │             │
│  │   Context    │◄─►    User      │◄─►   Context    │             │
│  │              │  │   Context    │  │              │             │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘             │
│         │                                    │                     │
│         ▼                                    ▼                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Reservation  │◄─►   Calendar   │  │    Guest     │             │
│  │   Context    │  │   Context    │  │   Context    │             │
│  └──────┬───────┘  └──────────────┘  └──────────────┘             │
│         │                                                          │
│         ├────────────────┬─────────────────┐                      │
│         ▼                ▼                 ▼                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Finance    │  │  Operations  │  │Communication │             │
│  │   Context    │  │   Context    │  │   Context    │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Channel    │  │  Analytics   │  │   Billing    │             │
│  │  Integration │  │   / AI       │  │   Context    │             │
│  │   Context    │  │   Context    │  │              │             │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Context Map: Integration Patterns

| Upstream | Downstream | Integration Type | Description |
|----------|-----------|-----------------|-------------|
| Organization | All contexts | Shared kernel | `organization_id` is universal |
| Auth | All contexts | Open Host | JWT user identity |
| Property | Reservation | Customer/Supplier | Property must exist before reservation |
| Reservation | Finance | Published language | Events: `reservation.created` → revenue_entry |
| Reservation | Operations | Published language | Events: `reservation.checked_out` → housekeeping task |
| Reservation | Calendar | Published language | Events: `reservation.*` → calendar blocks |
| Reservation | Guest | Customer/Supplier | Reservation references guest_id |
| Reservation | Communication | Published language | Events → trigger automated messages |
| Channel | Reservation | Anti-corruption layer | Channel payload translated to canonical reservation |
| Analytics | All contexts | Conformist (read-only) | Reads data from all domains |
| Billing | Organization | Customer/Supplier | Org plan controls feature availability |

---

## Domain Aggregates

### Organization Aggregate
```
Organization (Aggregate Root)
  ├── id
  ├── name, slug, timezone, currency
  ├── settings (JSONB)
  ├── plan (reference to subscription)
  │
  ├── OrganizationMember (Entity)
  │     ├── user_id, role, joined_at
  │
  └── OrganizationInvitation (Entity)
        ├── email, role, token, expires_at
```

### Property Aggregate
```
Property (Aggregate Root)
  ├── id, organization_id
  ├── name, slug, address
  ├── type, bedrooms, bathrooms, max_guests
  ├── check_in_time, check_out_time
  ├── base_rate, weekend_rate
  │
  ├── PropertyOwner (Entity)
  │     ├── name, user_id, ownership_percentage
  │
  ├── PropertySettings (Value Object)
  │     ├── min_nights, max_nights, cleaning_fee
  │
  └── PropertyPhoto (Entity)
        ├── url, is_cover, sort_order
```

### Reservation Aggregate
```
Reservation (Aggregate Root)
  ├── id, organization_id, property_id
  ├── guest_id (reference)
  ├── channel, platform_booking_id
  ├── check_in, check_out, nights
  ├── adults, children, pets
  ├── status (state machine)
  ├── nightly_rate, cleaning_fee, taxes, fees
  ├── gross_revenue, platform_commission, net_payout
  │
  ├── ReservationNote (Entity)
  │     ├── content, is_internal, created_by
  │
  ├── ReservationEvent (Entity) — audit trail
  │     ├── event_type, from_status, to_status, actor
  │
  └── ReservationDocument (Entity)
        ├── type (invoice, contract), url
```

### Guest Aggregate
```
Guest (Aggregate Root)
  ├── id, organization_id
  ├── first_name, last_name, email, phone
  ├── country, id_type, id_number
  ├── tags, notes
  ├── is_blacklisted, blacklist_reason
  │
  └── GuestStay (Value Object — derived)
        ├── reservation_id, property_id, check_in, check_out
```

### Finance Aggregate
```
Finance (Aggregate Root — per property per period)
  ├── property_id, period_month
  │
  ├── RevenueEntry (Entity)
  │     ├── reservation_id, gross_revenue, commission, net
  │     ├── source (airbnb, booking_com, direct)
  │
  ├── Expense (Entity)
  │     ├── type, amount, date, paid_from, owner_id
  │
  ├── AirbnbRow (Entity) — raw imported data
  │
  ├── DirectBooking (Entity) — pre-reservation-engine legacy
  │
  └── Loan (Entity)
        ├── principal, rate, tenure, schedule
```

---

## Domain Events Catalog

All events use this envelope:

```typescript
interface DomainEvent<T> {
  eventId: string;           // UUID
  eventType: string;         // e.g. "reservation.created"
  aggregateId: string;       // The affected entity ID
  aggregateType: string;     // e.g. "reservation"
  organizationId: string;
  occurredAt: string;        // ISO 8601
  version: number;           // Event schema version
  payload: T;
}
```

### Reservation Events

| Event | Trigger | Downstream Consumers |
|-------|---------|---------------------|
| `reservation.created` | New reservation confirmed | Finance (create revenue_entry), Calendar (block dates), Housekeeping (create checkout task), Communication (send confirmation) |
| `reservation.modified` | Dates or rates changed | Finance (update revenue_entry), Calendar (update blocks) |
| `reservation.cancelled` | Cancellation processed | Finance (void revenue_entry), Calendar (unblock dates), Housekeeping (cancel pending tasks) |
| `reservation.checked_in` | Guest checked in | Communication (send welcome message), Operations (update status) |
| `reservation.checked_out` | Guest checked out | Housekeeping (trigger cleaning task), Communication (send review request) |
| `reservation.conflict_detected` | Overlapping reservation found | Notification (alert manager) |

### Channel Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `channel.reservation_received` | Webhook from Airbnb/Booking.com | Reservation (create/update) |
| `channel.sync_completed` | Scheduled sync finished | Analytics (update sync stats) |
| `channel.sync_failed` | Sync error | Notification (alert admin) |
| `channel.rate_pushed` | Rate update sent to channel | Audit log |

### Operations Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `housekeeping.task_created` | Post-checkout trigger | Notification (alert housekeeper) |
| `housekeeping.task_completed` | Staff marks done | Calendar (mark property clean) |
| `maintenance.request_created` | Staff reports issue | Notification (alert manager) |
| `maintenance.request_resolved` | Issue resolved | Analytics (update maintenance stats) |

### Finance Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `finance.revenue_entry_created` | From reservation.created | Analytics |
| `finance.expense_added` | Manual expense entry | Analytics |
| `finance.anomaly_detected` | AI detects unusual expense | Notification (alert owner) |

---

## Ubiquitous Language

These terms have specific meanings in Airaroots. Use them consistently everywhere — code, comments, UI labels, conversations.

| Term | Meaning |
|------|---------|
| **Organization** | The business entity (PMC, owner) that subscribes to Airaroots |
| **Property** | A single rentable unit (villa, apartment, room) |
| **Reservation** | A confirmed booking from any channel, the canonical record |
| **Channel** | External booking platform (Airbnb, Booking.com, Direct) |
| **Guest** | The person making the reservation |
| **Channel Connection** | The authenticated link between a property and a channel account |
| **Block** | A manual date restriction (owner hold, maintenance closure) |
| **Conflict** | Two reservations with overlapping dates on the same property |
| **Revenue Entry** | A finance record derived from a confirmed reservation |
| **Period** | A billing month, used for finance aggregation (first day of month) |
| **Payout** | Money transferred from Airbnb/Booking.com to the property owner |
| **Net Revenue** | Gross revenue minus platform commission and taxes |
| **OOP (Out-of-Pocket)** | An expense paid by an owner directly, tracked for reimbursement |
| **Owner** | A property owner who receives financial reports via the owner portal |
| **Housekeeper** | Operations staff responsible for cleaning and turnover |
| **Platform Booking ID** | The external reference ID from Airbnb, Booking.com, etc. |
| **Sync** | The process of pulling reservation data from a channel |
| **Rate Push** | Sending updated pricing to a channel |
| **Availability Push** | Sending blocked/open dates to a channel |
| **ADR** | Average Daily Rate (revenue / nights) |
| **RevPAR** | Revenue Per Available Room (a standard hospitality metric) |
| **Occupancy Rate** | Booked nights / available nights × 100 |

---

## Domain Service Contracts

Each domain service exposes a clean interface. Other domains must use this interface — never direct DB access.

### ReservationService interface

```typescript
interface ReservationService {
  create(input: CreateReservationInput): Promise<Reservation>;
  update(id: string, input: UpdateReservationInput): Promise<Reservation>;
  cancel(id: string, reason: string): Promise<Reservation>;
  checkIn(id: string): Promise<Reservation>;
  checkOut(id: string): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  findByProperty(propertyId: string, opts: QueryOptions): Promise<Reservation[]>;
  findByDateRange(propertyId: string, from: Date, to: Date): Promise<Reservation[]>;
  checkConflicts(propertyId: string, checkIn: Date, checkOut: Date, excludeId?: string): Promise<ConflictResult>;
  processChannelReservation(payload: ChannelReservationPayload): Promise<Reservation>;
}
```

### FinanceService interface

```typescript
interface FinanceService {
  createRevenueEntry(reservationId: string): Promise<RevenueEntry>;
  updateRevenueEntry(reservationId: string): Promise<RevenueEntry>;
  voidRevenueEntry(reservationId: string, reason: string): Promise<void>;
  getSummary(propertyId: string, period: Date): Promise<FinanceSummary>;
  getMultiPropertySummary(orgId: string, period: Date): Promise<FinanceSummary[]>;
}
```
