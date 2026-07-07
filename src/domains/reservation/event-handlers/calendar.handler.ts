import type { DomainEvent } from '../../../infrastructure/events/event-bus';
import { createServiceRoleClientLoose } from '../../../infrastructure/supabase/server';
import type { Reservation } from '../types';

async function createBlock(reservation: Reservation): Promise<void> {
  const supabase = createServiceRoleClientLoose();
  const { error } = await supabase.from('calendar_blocks').insert({
    organization_id: reservation.organizationId,
    property_id: reservation.propertyId,
    reservation_id: reservation.id,
    start_date: reservation.checkIn,
    end_date: reservation.checkOut,
    block_type: 'reservation',
    is_public: true,
  });
  if (error) throw new Error(`calendar.handler: failed to create block — ${error.message}`);
}

async function updateBlock(reservationId: string, checkIn: string, checkOut: string): Promise<void> {
  const supabase = createServiceRoleClientLoose();
  const { error } = await supabase
    .from('calendar_blocks')
    .update({ start_date: checkIn, end_date: checkOut })
    .eq('reservation_id', reservationId);
  if (error) throw new Error(`calendar.handler: failed to update block — ${error.message}`);
}

async function deleteBlock(reservationId: string): Promise<void> {
  const supabase = createServiceRoleClientLoose();
  const { error } = await supabase
    .from('calendar_blocks')
    .delete()
    .eq('reservation_id', reservationId);
  if (error) throw new Error(`calendar.handler: failed to delete block — ${error.message}`);
}

export const calendarHandler = {
  onReservationCreated: async (event: DomainEvent): Promise<void> => {
    const reservation = event.payload['reservation'] as Reservation;
    await createBlock(reservation);
  },

  onReservationModified: async (event: DomainEvent): Promise<void> => {
    const updated = event.payload['new'] as Reservation;
    await updateBlock(updated.id, updated.checkIn, updated.checkOut);
  },

  onReservationCancelled: async (event: DomainEvent): Promise<void> => {
    const reservation = event.payload['reservation'] as Reservation;
    await deleteBlock(reservation.id);
  },
};
