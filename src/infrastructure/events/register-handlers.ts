import { eventBus } from './event-bus';

// Import handlers lazily to avoid circular deps at module init time.
// Call registerAllHandlers() once at app startup or in API route bootstrap.

export async function registerAllHandlers(): Promise<void> {
  const { calendarHandler } = await import('../../domains/reservation/event-handlers/calendar.handler');
  const { financeHandler } = await import('../../domains/reservation/event-handlers/finance.handler');
  const { housekeepingHandler } = await import('../../domains/operations/event-handlers/housekeeping.handler');
  const { RuleEngineService } = await import('../../domains/automation/services/rule-engine.service');
  const { createServiceRoleClientLoose } = await import('../supabase/server');

  // Create-side of reservation.created moved to the automation engine (rule
  // "Block calendar on reservation"). Stateful update/delete stays here.
  eventBus.subscribe('reservation.modified', calendarHandler.onReservationModified);
  eventBus.subscribe('reservation.cancelled', calendarHandler.onReservationCancelled);

  // Create-side of reservation.created moved to the automation engine (rule
  // "Record direct-booking revenue"). Stateful update/zero stays here.
  eventBus.subscribe('reservation.cancelled', financeHandler.onReservationCancelled);
  eventBus.subscribe('reservation.modified', financeHandler.onReservationModified);

  // Phase 4: Operations
  // Create-side of reservation.checked_in moved to the automation engine (rule
  // "Housekeeping cleanup on check-in"). Stateful transitions stay here.
  eventBus.subscribe('reservation.checked_out', housekeepingHandler.onCheckedOut);
  eventBus.subscribe('reservation.cancelled', housekeepingHandler.onCancelled);
  eventBus.subscribe('reservation.modified', housekeepingHandler.onModified);

  // ─── Automation engine (Phase A) ────────────────────────────────────────────
  // The engine runs ALONGSIDE the hardcoded handlers above. It's a no-op until a
  // manager activates a rule (default system rules are seeded INACTIVE). This is
  // the strangler cutover seam: activating a rule + removing the matching handler
  // subscription above moves that behavior onto the engine, one domain at a time.
  // handleEvent NEVER throws, so it can't reject the bus publish / API request.
  const runEngine = (event: import('./event-bus').DomainEvent) =>
    new RuleEngineService(createServiceRoleClientLoose()).handleEvent(event);
  eventBus.subscribe('reservation.created', runEngine);
  eventBus.subscribe('reservation.checked_in', runEngine);
}
