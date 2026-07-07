# Event-Driven Architecture

---

## Overview

Airaroots uses an event-driven architecture to decouple domains. When a reservation is created, the Reservation domain emits an event. The Finance domain, Calendar domain, and Communication domain each subscribe to this event and react independently.

This means:
- Adding a new downstream effect (e.g., send a Slack notification) never requires modifying the Reservation service
- Each domain can process events at its own pace
- Failed event processing can be retried without re-running the original action
- Event history provides a full audit trail

---

## Event Bus Implementation

**Phase 1–7:** Lightweight event bus using the `domain_events` table in PostgreSQL + a polling worker.

**Phase 8+:** Evaluate Inngest or Trigger.dev for production-scale event orchestration.

### Phase 1 Implementation

```typescript
// lib/events/event-bus.ts

interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  organizationId: string;
  occurredAt: string;
  version: number;
  payload: T;
}

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  // Register a handler for an event type
  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  // Publish event — persists to DB and invokes in-process handlers
  async publish(event: DomainEvent): Promise<void> {
    // 1. Persist to domain_events table for durability
    await persistEvent(event);

    // 2. Invoke in-process handlers (synchronous path)
    const handlers = this.handlers.get(event.eventType) ?? [];
    await Promise.allSettled(handlers.map(h => h(event)));
  }
}

export const eventBus = new EventBus();
```

### Event Persistence Table

```sql
CREATE TABLE domain_events (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type      text NOT NULL,
  aggregate_id    uuid NOT NULL,
  aggregate_type  text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  version         int NOT NULL DEFAULT 1,
  payload         jsonb NOT NULL,
  processed       boolean NOT NULL DEFAULT false,
  processed_at    timestamptz,
  attempts        int NOT NULL DEFAULT 0,
  error           text
);

CREATE INDEX idx_domain_events_type ON domain_events(event_type);
CREATE INDEX idx_domain_events_unprocessed ON domain_events(processed, occurred_at)
  WHERE processed = false;
CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_id, aggregate_type);
```

---

## Event Registration

At application startup, all event handlers register themselves:

```typescript
// lib/events/register-handlers.ts

import { eventBus } from './event-bus';
import { FinanceEventHandlers } from '@/domains/finance/event-handlers';
import { CalendarEventHandlers } from '@/domains/calendar/event-handlers';
import { HousekeepingEventHandlers } from '@/domains/operations/event-handlers';
import { CommunicationEventHandlers } from '@/domains/communication/event-handlers';

export function registerEventHandlers(): void {
  // Reservation → Finance
  eventBus.subscribe('reservation.created', FinanceEventHandlers.onReservationCreated);
  eventBus.subscribe('reservation.modified', FinanceEventHandlers.onReservationModified);
  eventBus.subscribe('reservation.cancelled', FinanceEventHandlers.onReservationCancelled);

  // Reservation → Calendar
  eventBus.subscribe('reservation.created', CalendarEventHandlers.onReservationCreated);
  eventBus.subscribe('reservation.modified', CalendarEventHandlers.onReservationModified);
  eventBus.subscribe('reservation.cancelled', CalendarEventHandlers.onReservationCancelled);

  // Reservation → Housekeeping
  eventBus.subscribe('reservation.checked_out', HousekeepingEventHandlers.onCheckout);
  eventBus.subscribe('reservation.cancelled', HousekeepingEventHandlers.onCancellation);

  // Reservation → Communication
  eventBus.subscribe('reservation.created', CommunicationEventHandlers.onBookingConfirmation);
  eventBus.subscribe('reservation.checked_out', CommunicationEventHandlers.onCheckoutReviewRequest);
}
```

---

## Reservation Lifecycle — Sequence Diagram

### Airbnb Webhook → Reservation Created

```
Airbnb         Edge Function     EventBus     ReservationSvc    FinanceSvc    HousekeepingSvc    CommSvc
  │                │                │               │               │               │               │
  │ POST /webhook  │                │               │               │               │               │
  ├───────────────►│                │               │               │               │               │
  │                │ validate       │               │               │               │               │
  │                │ signature      │               │               │               │               │
  │                │ queue job      │               │               │               │               │
  │                │◄───────────────│               │               │               │               │
  │ 200 OK         │                │               │               │               │               │
  │◄───────────────│                │               │               │               │               │
  │                │                │               │               │               │               │
  │                │ [job processes]│               │               │               │               │
  │                │ map payload    │               │               │               │               │
  │                ├─processChannel─►               │               │               │               │
  │                │                ├──────────────►│               │               │               │
  │                │                │  checkConflicts               │               │               │
  │                │                │               ├──────────────►│               │               │
  │                │                │               │◄──────────────│               │               │
  │                │                │               │  no conflict  │               │               │
  │                │                │               │  createReservation            │               │
  │                │                │               │───────────────────────────────────────────────│
  │                │                │               │  emit reservation.created     │               │
  │                │                │◄──────────────│               │               │               │
  │                │                │               │               │               │               │
  │                │                ├──────────────────────────────►│               │               │
  │                │                │   FinanceSvc.createRevenueEntry               │               │
  │                │                │               │               │               │               │
  │                │                ├──────────────────────────────────────────────►│               │
  │                │                │   HousekeepingSvc.createCheckoutTask          │               │
  │                │                │               │               │               │               │
  │                │                ├────────────────────────────────────────────────────────────► │
  │                │                │   CommSvc.sendBookingConfirmation             │               │
```

### Manual Reservation Creation

```
User         API Route        ReservationSvc      ConflictCheck     EventBus
 │               │                  │                  │               │
 │ POST /api/    │                  │                  │               │
 │ reservations  │                  │                  │               │
 ├──────────────►│                  │                  │               │
 │               │ validate Zod     │                  │               │
 │               │ check session    │                  │               │
 │               ├─────────────────►│                  │               │
 │               │                  ├─────────────────►│               │
 │               │                  │  checkConflicts  │               │
 │               │                  │◄─────────────────│               │
 │               │                  │  no conflict     │               │
 │               │                  │  insert DB row   │               │
 │               │                  ├─────────────────────────────────►│
 │               │                  │  emit reservation.created        │
 │               │                  │◄─────────────────────────────────│
 │               │◄─────────────────│                  │               │
 │               │  reservation obj │                  │               │
 │◄──────────────│                  │                  │               │
 │ 201 Created   │                  │                  │               │
```

### Conflict Detection Flow

```
ReservationSvc
  │
  ├─► SELECT FROM reservations
  │     WHERE property_id = $1
  │     AND status NOT IN ('cancelled')
  │     AND deleted_at IS NULL
  │     AND (
  │       (check_in < $checkout AND check_out > $checkin)
  │     )
  │
  ├─► If results.length === 0:
  │     └─► No conflict → proceed
  │
  └─► If results.length > 0:
        ├─► Set new reservation status = 'conflict'
        ├─► Emit reservation.conflict_detected event
        └─► Return ConflictResult with conflicting reservation details
```

---

## Background Job Queue

### Job Types

| Job Type | Trigger | Description |
|----------|---------|-------------|
| `channel.sync_reservations` | Scheduled (every 15min) | Pull new/updated reservations from channels |
| `channel.push_rates` | On rate change | Push updated rates to connected channels |
| `channel.push_availability` | On block/unblock | Push availability changes to channels |
| `reservation.send_confirmation` | reservation.created | Send booking confirmation to guest |
| `reservation.pre_arrival_message` | 48hr before check_in | Send pre-arrival WhatsApp/email |
| `reservation.checkout_message` | At checkout time | Send checkout instructions |
| `reservation.review_request` | 24hr after checkout | Request review from guest |
| `housekeeping.create_checkout_task` | reservation.checked_out | Create housekeeping task |
| `finance.create_revenue_entry` | reservation.created | Create revenue record |
| `reports.generate_monthly` | 1st of month, midnight | Generate monthly owner reports |
| `ai.run_pricing_analysis` | Weekly, Sunday midnight | Generate pricing recommendations |
| `ai.run_occupancy_forecast` | Weekly, Sunday midnight | Update occupancy forecasts |

### Job Processing

```typescript
// lib/jobs/job-processor.ts

interface Job {
  id: string;
  queue: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  max_attempts: number;
  scheduled_at: Date;
  started_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  error?: string;
}

async function processJob(job: Job): Promise<void> {
  const handler = jobHandlers.get(job.type);
  if (!handler) throw new Error(`No handler for job type: ${job.type}`);

  await markJobStarted(job.id);
  try {
    await handler(job.payload);
    await markJobCompleted(job.id);
  } catch (error) {
    await markJobFailed(job.id, error.message);
    if (job.attempts < job.max_attempts) {
      await scheduleRetry(job.id, backoffDelay(job.attempts));
    } else {
      await moveToDeadLetterQueue(job.id);
      await alertAdminOfDeadLetter(job);
    }
  }
}

// Exponential backoff: 1min, 5min, 30min, 2hr, 8hr
function backoffDelay(attempt: number): number {
  return Math.pow(5, attempt) * 60 * 1000;
}
```

---

## Retry & Dead Letter Strategy

| Scenario | Max Attempts | Backoff | Dead Letter Action |
|----------|-------------|---------|-------------------|
| Channel reservation sync | 5 | Exponential (1m, 5m, 30m, 2h, 8h) | Alert admin, mark sync failed |
| Rate push to channel | 3 | Linear (5m, 10m, 15m) | Alert admin, log failure |
| Guest communication | 3 | Exponential (5m, 30m, 2h) | Log failed, mark manual send required |
| Finance revenue entry | 5 | Exponential | Alert admin, lock reservation until resolved |
| Housekeeping task creation | 3 | Linear | Alert admin |
| Monthly report generation | 3 | Linear (10m, 30m, 1h) | Alert admin |

---

## Realtime Events (WebSockets)

Supabase Realtime enables live updates for:

| Channel | Payload | Consumers |
|---------|---------|-----------|
| `reservations:org_id` | Reservation created/updated | Calendar view auto-refresh |
| `housekeeping_tasks:property_id` | Task status change | Operations dashboard |
| `maintenance_requests:property_id` | Request status change | Operations dashboard |
| `notifications:user_id` | New notification | Notification bell |

```typescript
// In calendar component
supabase
  .channel(`reservations:${orgId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'reservations',
    filter: `organization_id=eq.${orgId}`
  }, (payload) => {
    queryClient.invalidateQueries(['reservations', orgId]);
  })
  .subscribe();
```
