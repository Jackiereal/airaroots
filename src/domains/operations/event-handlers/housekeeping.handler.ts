import type { DomainEvent } from '../../../infrastructure/events/event-bus';
import { createServiceRoleClientLoose } from '../../../infrastructure/supabase/server';
import { HousekeepingService } from '../services/housekeeping.service';
import type { Reservation } from '../../reservation/types';

// ─── checked_in → create housekeeping task scheduled for checkout date ────────
async function onCheckedIn(event: DomainEvent): Promise<void> {
  const reservation = event.payload['reservation'] as Reservation;

  const supabase = createServiceRoleClientLoose();
  const service = new HousekeepingService(supabase);

  // Check if a task already exists for this reservation (idempotency)
  const existing = await service['repo'].findTaskByReservation(reservation.id);
  if (existing) return;

  // Schedule for checkout date — 2pm default if no next checkin
  // Actual scheduled_time can be updated by manager when they know next checkin
  await service.createTask({
    organizationId: reservation.organizationId,
    propertyId: reservation.propertyId,
    reservationId: reservation.id,
    taskType: 'checkout_clean',
    scheduledDate: reservation.checkOut,
    scheduledTime: '14:00',
  });
}

// ─── checked_out → move task to in_progress (countdown starts) ───────────────
async function onCheckedOut(event: DomainEvent): Promise<void> {
  const reservation = event.payload['reservation'] as Reservation;

  const supabase = createServiceRoleClientLoose();
  const service = new HousekeepingService(supabase);

  const task = await service['repo'].findTaskByReservation(reservation.id);
  if (!task) return;

  // Only advance if still pending/assigned — don't override completed/cancelled
  if (task.status === 'pending' || task.status === 'assigned') {
    await service['repo'].updateTask(task.id, { status: 'in_progress' });
  }
}

// ─── cancelled → cancel pending housekeeping task ────────────────────────────
async function onCancelled(event: DomainEvent): Promise<void> {
  const reservation = event.payload['reservation'] as Reservation;

  const supabase = createServiceRoleClientLoose();
  const service = new HousekeepingService(supabase);

  await service.cancelTaskByReservation(reservation.id);
}

// ─── modified → reschedule task if checkout date changed ─────────────────────
async function onModified(event: DomainEvent): Promise<void> {
  const updated = event.payload['new'] as Reservation;
  const old = event.payload['old'] as Reservation;

  if (updated.checkOut === old.checkOut) return;

  const supabase = createServiceRoleClientLoose();
  const service = new HousekeepingService(supabase);

  await service.rescheduleTask(updated.id, updated.checkOut);
}

export const housekeepingHandler = {
  onCheckedIn,
  onCheckedOut,
  onCancelled,
  onModified,
};
