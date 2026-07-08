import type { SupabaseClient } from '@supabase/supabase-js';
import { ReservationRepository } from '../repositories/reservation.repository';
import { ConflictDetectionService } from './conflict-detection.service';
import { GuestService } from '../../guest/services/guest.service';
import { eventBus } from '../../../infrastructure/events/event-bus';
import { ConflictError, NotFoundError, InvalidStatusTransitionError } from '../../../shared/errors/domain-errors';
import { VALID_STATUS_TRANSITIONS } from '../constants';
import type {
  Reservation,
  ReservationEvent,
  ReservationStatus,
  CreateReservationInput,
  UpdateReservationInput,
} from '../types';

export class ReservationService {
  private repository: ReservationRepository;
  private conflictDetection: ConflictDetectionService;
  private guestService: GuestService;

  constructor(private supabase: SupabaseClient) {
    this.repository = new ReservationRepository(supabase);
    this.conflictDetection = new ConflictDetectionService(supabase);
    this.guestService = new GuestService(supabase);
  }

  async create(input: CreateReservationInput, actorId: string): Promise<Reservation> {
    // Idempotency: if same platform booking already exists, return it
    if (input.platformBookingId) {
      const existing = await this.repository.findByPlatformBookingId(
        input.organizationId,
        input.platformBookingId
      );
      if (existing) return existing;
    }

    // Conflict detection
    const conflictResult = await this.conflictDetection.check(
      input.propertyId,
      new Date(input.checkIn),
      new Date(input.checkOut)
    );

    if (conflictResult.hasConflict) {
      throw new ConflictError('Dates conflict with an existing reservation', conflictResult.conflicts);
    }

    const reservation = await this.repository.create({ ...input, createdBy: actorId });

    // Auto-link guest profile (best-effort, don't fail reservation creation)
    if (input.guestName || input.guestEmail || input.guestPhone) {
      try {
        const guest = await this.guestService.findOrCreate({
          organizationId: input.organizationId,
          fullName: input.guestName ?? 'Guest',
          email: input.guestEmail,
          phone: input.guestPhone,
        });
        await this.repository.setGuestId(reservation.id, guest.id);
        reservation.guestId = guest.id;
      } catch {
        // Non-fatal: guest linking failure doesn't block reservation
      }
    }

    await this.repository.appendEvent({
      reservationId: reservation.id,
      organizationId: reservation.organizationId,
      eventType: 'created',
      toStatus: 'confirmed',
      actorId,
    });

    await eventBus.publish({
      eventId: crypto.randomUUID(),
      eventType: 'reservation.created',
      aggregateId: reservation.id,
      aggregateType: 'reservation',
      organizationId: reservation.organizationId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { reservation: reservation as unknown as Record<string, unknown> },
    });

    return reservation;
  }

  async update(
    id: string,
    input: UpdateReservationInput,
    actorId: string
  ): Promise<Reservation> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Reservation', id);

    // If dates are changing, re-run conflict detection
    if (input.checkIn !== undefined || input.checkOut !== undefined) {
      const newCheckIn = input.checkIn ?? existing.checkIn;
      const newCheckOut = input.checkOut ?? existing.checkOut;

      const conflictResult = await this.conflictDetection.check(
        existing.propertyId,
        new Date(newCheckIn),
        new Date(newCheckOut),
        id
      );

      if (conflictResult.hasConflict) {
        throw new ConflictError('Updated dates conflict with an existing reservation', conflictResult.conflicts);
      }
    }

    const updated = await this.repository.update(id, input);

    await this.repository.appendEvent({
      reservationId: id,
      organizationId: existing.organizationId,
      eventType: 'modified',
      actorId,
      metadata: { changes: input as unknown as Record<string, unknown> },
    });

    await eventBus.publish({
      eventId: crypto.randomUUID(),
      eventType: 'reservation.modified',
      aggregateId: id,
      aggregateType: 'reservation',
      organizationId: existing.organizationId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: {
        old: existing as unknown as Record<string, unknown>,
        new: updated as unknown as Record<string, unknown>,
      },
    });

    return updated;
  }

  async cancel(id: string, reason: string, actorId: string): Promise<Reservation> {
    return this.transitionStatus(id, 'cancelled', actorId, reason);
  }

  async checkIn(id: string, actorId: string): Promise<Reservation> {
    return this.transitionStatus(id, 'checked_in', actorId);
  }

  async checkOut(id: string, actorId: string): Promise<Reservation> {
    return this.transitionStatus(id, 'checked_out', actorId);
  }

  async markNoShow(id: string, actorId: string): Promise<Reservation> {
    return this.transitionStatus(id, 'no_show', actorId);
  }

  async findById(id: string): Promise<Reservation | null> {
    return this.repository.findById(id);
  }

  async findByProperty(
    propertyId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<Reservation[]> {
    return this.repository.findByProperty(propertyId, opts);
  }

  async findByOrganization(
    orgId: string,
    opts?: { limit?: number; offset?: number; status?: ReservationStatus }
  ): Promise<Reservation[]> {
    return this.repository.findByOrganization(orgId, opts);
  }

  async findByDateRange(propertyId: string, from: Date, to: Date): Promise<Reservation[]> {
    return this.repository.findByDateRange(propertyId, from, to);
  }

  async findEvents(reservationId: string): Promise<ReservationEvent[]> {
    return this.repository.findEvents(reservationId);
  }

  async linkGuest(reservationId: string, orgId: string): Promise<string> {
    const reservation = await this.repository.findById(reservationId);
    if (!reservation) throw new NotFoundError('Reservation', reservationId);

    const guest = await this.guestService.findOrCreate({
      organizationId: orgId,
      fullName: reservation.guestName ?? 'Guest',
      email: reservation.guestEmail,
      phone: reservation.guestPhone,
    });

    await this.repository.setGuestId(reservationId, guest.id);
    return guest.id;
  }

  async findConflicting(reservationId: string): Promise<Reservation[]> {
    const reservation = await this.repository.findById(reservationId);
    if (!reservation) throw new NotFoundError('Reservation', reservationId);

    return this.repository.findConflicts(
      reservation.propertyId,
      new Date(reservation.checkIn),
      new Date(reservation.checkOut),
      reservationId
    );
  }

  async resolveConflict(
    id: string,
    action: 'cancel_this' | 'cancel_conflicting' | 'mark_resolved',
    actorId: string,
    conflictingId?: string
  ): Promise<Reservation> {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new NotFoundError('Reservation', id);

    if (reservation.status !== 'conflict') {
      throw new Error('Reservation is not in conflict status');
    }

    if (action === 'cancel_this') {
      return this.transitionStatus(id, 'cancelled', actorId, 'Conflict resolved: this reservation cancelled');
    }

    if (action === 'cancel_conflicting') {
      if (!conflictingId) throw new Error('conflictingId required for cancel_conflicting action');
      await this.cancel(conflictingId, 'Conflict resolved: cancelled in favour of another reservation', actorId);
      return this.transitionStatus(id, 'confirmed', actorId, 'Conflict resolved: conflicting reservation cancelled');
    }

    // mark_resolved — user handled it externally
    return this.transitionStatus(id, 'confirmed', actorId, 'Conflict resolved manually');
  }

  private async transitionStatus(
    id: string,
    toStatus: ReservationStatus,
    actorId: string,
    notes?: string
  ): Promise<Reservation> {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new NotFoundError('Reservation', id);

    const allowed = VALID_STATUS_TRANSITIONS[reservation.status];
    if (!allowed.includes(toStatus)) {
      throw new InvalidStatusTransitionError(reservation.status, toStatus);
    }

    const updated = await this.repository.updateStatus(id, toStatus);

    await this.repository.appendEvent({
      reservationId: id,
      organizationId: reservation.organizationId,
      eventType: 'status_changed',
      fromStatus: reservation.status,
      toStatus,
      actorId,
      notes,
    });

    const eventType = `reservation.${toStatus === 'checked_in' ? 'checked_in' : toStatus === 'checked_out' ? 'checked_out' : toStatus}`;

    await eventBus.publish({
      eventId: crypto.randomUUID(),
      eventType,
      aggregateId: id,
      aggregateType: 'reservation',
      organizationId: reservation.organizationId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: { reservation: updated as unknown as Record<string, unknown>, reason: notes },
    });

    return updated;
  }
}
