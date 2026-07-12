import { eventBus } from './event-bus';

// Import handlers lazily to avoid circular deps at module init time.
// Call registerAllHandlers() once at app startup or in API route bootstrap.

export async function registerAllHandlers(): Promise<void> {
  const { calendarHandler } = await import('../../domains/reservation/event-handlers/calendar.handler');
  const { financeHandler } = await import('../../domains/reservation/event-handlers/finance.handler');
  const { housekeepingHandler } = await import('../../domains/operations/event-handlers/housekeeping.handler');

  eventBus.subscribe('reservation.created', calendarHandler.onReservationCreated);
  eventBus.subscribe('reservation.modified', calendarHandler.onReservationModified);
  eventBus.subscribe('reservation.cancelled', calendarHandler.onReservationCancelled);

  eventBus.subscribe('reservation.created', financeHandler.onReservationCreated);
  eventBus.subscribe('reservation.cancelled', financeHandler.onReservationCancelled);
  eventBus.subscribe('reservation.modified', financeHandler.onReservationModified);

  // Phase 4: Operations
  eventBus.subscribe('reservation.checked_in', housekeepingHandler.onCheckedIn);
  eventBus.subscribe('reservation.checked_out', housekeepingHandler.onCheckedOut);
  eventBus.subscribe('reservation.cancelled', housekeepingHandler.onCancelled);
  eventBus.subscribe('reservation.modified', housekeepingHandler.onModified);
}
