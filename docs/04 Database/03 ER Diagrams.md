# ER Diagrams

> Text-based ER diagrams showing relationships between all entities.

---

## Core Entity Relationships

```
organizations ──────────────────────────────────────────────────┐
  │ 1:N                                                          │
  ├──► organization_members (user_id → auth.users)              │
  ├──► organization_invitations                                  │
  ├──► subscriptions ──► subscription_plans                     │
  ├──► properties ─────────────────────────────────────────────►│
  │      │ 1:N                                                   │
  │      ├──► property_owners (user_id → auth.users)           │
  │      ├──► property_access (user_id → auth.users)           │
  │      ├──► property_amenities                                │
  │      ├──► property_photos                                   │
  │      ├──► seasonal_rates                                    │
  │      ├──► channel_connections                               │
  │      │      └──► channel_sync_logs                          │
  │      ├──► calendar_blocks (reservation_id → reservations)  │
  │      ├──► reservations ──────────────────────────────────► │
  │      │      │ 1:N                                           │
  │      │      ├──► reservation_events                         │
  │      │      ├──► reservation_notes                          │
  │      │      ├──► revenue_entries                            │
  │      │      ├──► housekeeping_tasks                         │
  │      │      ├──► maintenance_requests                       │
  │      │      └──► communication_logs                         │
  │      │      │ N:1                                           │
  │      │      └──► guests                                     │
  │      ├──► property_finance_expenses                         │
  │      ├──► property_finance_airbnb_rows                      │
  │      ├──► property_finance_direct_bookings                  │
  │      ├──► property_finance_loans                            │
  │      ├──► housekeeping_staff                                │
  │      ├──► inventory_items                                   │
  │      └──► vendors                                           │
  ├──► guests                                                   │
  ├──► communication_templates                                  │
  ├──► ai_insights                                              │
  ├──► ai_pricing_recommendations                               │
  ├──► background_jobs                                          │
  ├──► domain_events                                            │
  └──► audit_log                                                │
```

---

## Reservation Central Diagram

Reservation is the hub that connects all domains:

```
                         ┌─────────────────────┐
                         │      reservation     │
                         │  ─────────────────  │
                         │  id                  │
                         │  organization_id     │
                         │  property_id         │
                         │  guest_id            │
                         │  channel             │
                         │  check_in            │
                         │  check_out           │
                         │  status              │
                         │  nightly_rate        │
                         │  gross_revenue       │
                         │  net_payout          │
                         └──────────┬──────────┘
                                    │
           ┌────────────────────────┼─────────────────────────┐
           │                        │                          │
           ▼                        ▼                          ▼
   ┌───────────────┐       ┌────────────────┐       ┌──────────────────┐
   │ revenue_entry │       │housekeeping_   │       │communication_log │
   │ (finance)     │       │task (ops)      │       │(comm)            │
   └───────────────┘       └────────────────┘       └──────────────────┘
           │                        │
           ▼                        ▼
   ┌───────────────┐       ┌────────────────┐
   │ P&L aggregate │       │housekeeping_   │
   │ (reporting)   │       │photos          │
   └───────────────┘       └────────────────┘
```

---

## Channel Sync Flow Diagram

```
channel_connections ──► channel_sync_logs
        │
        │ sync pulls reservation data
        ▼
channel_webhook_logs ──► background_jobs
        │
        │ job processes
        ▼
    reservations ──► calendar_blocks
```

---

## Finance Domain Diagram

```
reservations (1) ──► revenue_entries (N)
                           │
                           └──► P&L aggregation
                                  (period_month)

properties (1) ──► property_finance_expenses (N)
                         │
                         └──► P&L aggregation

properties (1) ──► property_finance_loans (N)
                         │
                         └──► Cash flow projection

properties (1) ──► property_finance_airbnb_rows (N)
                         │  (legacy — CSV import)
                         └──► Revenue aggregation

All ──► Finance summary per property per month
```

---

## Operations Domain Diagram

```
reservations ──► housekeeping_tasks ──► housekeeping_staff
                         │
                         └──► housekeeping_photos

properties ──► maintenance_requests ──► vendors
                         │         └──► maintenance_photos
                         └──► assigned to user

properties ──► inventory_items
```

---

## Multi-Tenancy Isolation Diagram

```
User A (org-1)                User B (org-2)
     │                               │
     ▼                               ▼
 JWT token                       JWT token
     │                               │
     ▼                               ▼
RLS policy: auth.uid() ──► org_member ──► organization_id

User A sees:                    User B sees:
  org-1's properties              org-2's properties
  org-1's reservations            org-2's reservations
  org-1's finance                 org-2's finance
                ↕
        ZERO OVERLAP
   (enforced at DB layer)
```

---

## Key Cardinalities

| Relationship | Cardinality |
|-------------|-------------|
| Organization → Properties | 1:N (1 to 500) |
| Property → Reservations | 1:N (up to ~500/year) |
| Reservation → Guest | N:1 (many reservations, one guest) |
| Guest → Reservations | 1:N (one guest, many stays) |
| Property → Channel Connections | 1:N (1 per channel) |
| Reservation → Revenue Entries | 1:1 (one revenue entry per reservation) |
| Reservation → Housekeeping Tasks | 1:N (checkout + optional mid-stay) |
| Property → Expenses | 1:N (many per month) |
| Organization → Members | 1:N (2 to unlimited by plan) |
| Subscription Plan → Subscriptions | 1:N |
| Organization → Subscription | 1:1 (one active subscription) |
