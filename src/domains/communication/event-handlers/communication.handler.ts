import type { DomainEvent } from '../../../infrastructure/events/event-bus';
import { createServiceRoleClientLoose } from '../../../infrastructure/supabase/server';
import { CommunicationService } from '../services/communication.service';
import type { CommunicationTrigger } from '../types';
import type { Reservation } from '../../reservation/types';

// Dispatch a lifecycle message. CRITICAL: this must never throw — the event
// bus awaits Promise.all of all handlers, so a throw here would reject the
// reservation API request that published the event. Guest comms are
// non-critical and must not be able to break a booking / check-in / checkout.
async function run(trigger: CommunicationTrigger, event: DomainEvent): Promise<void> {
  try {
    const reservation = event.payload['reservation'] as Reservation | undefined;
    if (!reservation) return;

    const supabase = createServiceRoleClientLoose();
    const service = new CommunicationService(supabase);
    await service.dispatch(trigger, reservation);
  } catch (err) {
    console.error(`[communication.handler] ${trigger} failed:`, err);
  }
}

export const communicationHandler = {
  onBooking: (event: DomainEvent) => run('booking_confirmation', event),
  onCheckIn: (event: DomainEvent) => run('checkin_welcome', event),
  onCheckOut: (event: DomainEvent) => run('checkout_thankyou', event),
};
