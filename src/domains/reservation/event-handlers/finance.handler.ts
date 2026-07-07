import type { DomainEvent } from '../../../infrastructure/events/event-bus';
import { createServiceRoleClientLoose } from '../../../infrastructure/supabase/server';
import type { Reservation } from '../types';

// Using createServiceRoleClientLoose (returns SupabaseClient without generic DB types)
// because migration 007 adds reservation_id + source columns that the hand-written
// types stub doesn't know about yet. Replaced once `supabase gen types` runs.

function toFirstOfMonth(dateStr: string): string {
  return dateStr.substring(0, 7) + '-01';
}

export const financeHandler = {
  onReservationCreated: async (event: DomainEvent): Promise<void> => {
    const reservation = event.payload['reservation'] as Reservation;
    const db = createServiceRoleClientLoose();

    const { error } = await db.from('property_finance_direct_bookings').insert({
      property_id: reservation.propertyId,
      period_month: toFirstOfMonth(reservation.checkIn),
      guest_name: reservation.guestName ?? null,
      amount: reservation.netPayout,
      guest_count: reservation.adults + reservation.children,
      guest_phone: reservation.guestPhone ?? null,
      check_in: reservation.checkIn,
      check_out: reservation.checkOut,
      nights: reservation.nights,
      notes: `Auto-generated from reservation ${reservation.id} (${reservation.channel})`,
      reservation_id: reservation.id,
      source: 'reservation_engine',
    });

    if (error) throw new Error(`finance.handler: failed to create revenue entry — ${error.message}`);
  },

  onReservationCancelled: async (event: DomainEvent): Promise<void> => {
    const reservation = event.payload['reservation'] as Reservation;
    const db = createServiceRoleClientLoose();

    const { error } = await db
      .from('property_finance_direct_bookings')
      .update({ amount: 0, notes: `Cancelled reservation ${reservation.id}` })
      .eq('reservation_id', reservation.id)
      .eq('source', 'reservation_engine');

    if (error) throw new Error(`finance.handler: failed to zero revenue entry — ${error.message}`);
  },

  onReservationModified: async (event: DomainEvent): Promise<void> => {
    const updated = event.payload['new'] as Reservation;
    const db = createServiceRoleClientLoose();

    const { error } = await db
      .from('property_finance_direct_bookings')
      .update({
        amount: updated.netPayout,
        check_in: updated.checkIn,
        check_out: updated.checkOut,
        nights: updated.nights,
        period_month: toFirstOfMonth(updated.checkIn),
        notes: `Auto-generated from reservation ${updated.id} (${updated.channel})`,
      })
      .eq('reservation_id', updated.id)
      .eq('source', 'reservation_engine');

    if (error) throw new Error(`finance.handler: failed to update revenue entry — ${error.message}`);
  },
};
