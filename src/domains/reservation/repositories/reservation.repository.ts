import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Reservation,
  ReservationStatus,
  ReservationEvent,
  CreateReservationInput,
  UpdateReservationInput,
} from '../types';

type ReservationRow = {
  id: string;
  organization_id: string;
  property_id: string;
  guest_id: string | null;
  channel: string;
  platform_booking_id: string | null;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  pets: number;
  status: string;
  nightly_rate: string;
  cleaning_fee: string;
  taxes: string;
  other_fees: string;
  gross_revenue: string;
  platform_commission: string;
  net_payout: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  notes: string | null;
  raw_payload: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type ReservationEventRow = {
  id: string;
  reservation_id: string;
  organization_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  actor_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

export class ReservationRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as ReservationRow);
  }

  async findByProperty(
    propertyId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<Reservation[]> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .order('check_in', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as ReservationRow));
  }

  async findByOrganization(
    organizationId: string,
    opts: { limit?: number; offset?: number; status?: ReservationStatus } = {}
  ): Promise<Reservation[]> {
    let query = this.supabase
      .from('reservations')
      .select('*')
      .eq('organization_id', organizationId)
      .is('deleted_at', null)
      .order('check_in', { ascending: false })
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);

    if (opts.status) {
      query = query.eq('status', opts.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as ReservationRow));
  }

  async findByDateRange(propertyId: string, from: Date, to: Date): Promise<Reservation[]> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('check_in', to.toISOString().split('T')[0])
      .gt('check_out', from.toISOString().split('T')[0]);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as ReservationRow));
  }

  async findConflicts(
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string
  ): Promise<Reservation[]> {
    let query = this.supabase
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .not('status', 'in', '("cancelled","no_show")')
      // Overlap: existing.check_in < new.check_out AND existing.check_out > new.check_in
      .lt('check_in', checkOut.toISOString().split('T')[0])
      .gt('check_out', checkIn.toISOString().split('T')[0]);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEntity(r as ReservationRow));
  }

  async findByPlatformBookingId(
    organizationId: string,
    platformBookingId: string
  ): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('platform_booking_id', platformBookingId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toEntity(data as ReservationRow);
  }

  async create(input: CreateReservationInput & { createdBy?: string }): Promise<Reservation> {
    const { data, error } = await this.supabase
      .from('reservations')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        guest_id: input.guestId ?? null,
        channel: input.channel,
        platform_booking_id: input.platformBookingId ?? null,
        check_in: input.checkIn,
        check_out: input.checkOut,
        adults: input.adults,
        children: input.children ?? 0,
        pets: input.pets ?? 0,
        status: 'confirmed',
        nightly_rate: input.nightlyRate,
        cleaning_fee: input.cleaningFee ?? 0,
        taxes: input.taxes ?? 0,
        other_fees: input.otherFees ?? 0,
        platform_commission: input.platformCommission ?? 0,
        guest_name: input.guestName ?? null,
        guest_email: input.guestEmail ?? null,
        guest_phone: input.guestPhone ?? null,
        notes: input.notes ?? null,
        raw_payload: input.rawPayload ?? null,
        created_by: input.createdBy ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as ReservationRow);
  }

  async update(id: string, input: UpdateReservationInput): Promise<Reservation> {
    const updateData: Record<string, unknown> = {};
    if (input.checkIn !== undefined) updateData['check_in'] = input.checkIn;
    if (input.checkOut !== undefined) updateData['check_out'] = input.checkOut;
    if (input.adults !== undefined) updateData['adults'] = input.adults;
    if (input.children !== undefined) updateData['children'] = input.children;
    if (input.pets !== undefined) updateData['pets'] = input.pets;
    if (input.nightlyRate !== undefined) updateData['nightly_rate'] = input.nightlyRate;
    if (input.cleaningFee !== undefined) updateData['cleaning_fee'] = input.cleaningFee;
    if (input.taxes !== undefined) updateData['taxes'] = input.taxes;
    if (input.otherFees !== undefined) updateData['other_fees'] = input.otherFees;
    if (input.platformCommission !== undefined) updateData['platform_commission'] = input.platformCommission;
    if (input.guestName !== undefined) updateData['guest_name'] = input.guestName;
    if (input.guestEmail !== undefined) updateData['guest_email'] = input.guestEmail;
    if (input.guestPhone !== undefined) updateData['guest_phone'] = input.guestPhone;
    if (input.notes !== undefined) updateData['notes'] = input.notes;

    const { data, error } = await this.supabase
      .from('reservations')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as ReservationRow);
  }

  async updateStatus(id: string, status: ReservationStatus): Promise<Reservation> {
    const updateData: Record<string, unknown> = { status };
    if (status === 'cancelled') {
      updateData['deleted_at'] = new Date().toISOString();
    }

    const { data, error } = await this.supabase
      .from('reservations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toEntity(data as ReservationRow);
  }

  async appendEvent(event: {
    reservationId: string;
    organizationId: string;
    eventType: string;
    fromStatus?: ReservationStatus;
    toStatus?: ReservationStatus;
    actorId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('reservation_events').insert({
      reservation_id: event.reservationId,
      organization_id: event.organizationId,
      event_type: event.eventType,
      from_status: event.fromStatus ?? null,
      to_status: event.toStatus ?? null,
      actor_id: event.actorId ?? null,
      notes: event.notes ?? null,
      metadata: event.metadata ?? null,
    });

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async findEvents(reservationId: string): Promise<ReservationEvent[]> {
    const { data, error } = await this.supabase
      .from('reservation_events')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('occurred_at', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toEventEntity(r as ReservationEventRow));
  }

  private toEntity(row: ReservationRow): Reservation {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      guestId: row.guest_id ?? undefined,
      channel: row.channel as Reservation['channel'],
      platformBookingId: row.platform_booking_id ?? undefined,
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      adults: row.adults,
      children: row.children,
      pets: row.pets,
      status: row.status as ReservationStatus,
      nightlyRate: Number(row.nightly_rate),
      cleaningFee: Number(row.cleaning_fee),
      taxes: Number(row.taxes),
      otherFees: Number(row.other_fees),
      grossRevenue: Number(row.gross_revenue),
      platformCommission: Number(row.platform_commission),
      netPayout: Number(row.net_payout),
      guestName: row.guest_name ?? undefined,
      guestEmail: row.guest_email ?? undefined,
      guestPhone: row.guest_phone ?? undefined,
      notes: row.notes ?? undefined,
      rawPayload: row.raw_payload ?? undefined,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at ?? undefined,
    };
  }

  private toEventEntity(row: ReservationEventRow): ReservationEvent {
    return {
      id: row.id,
      reservationId: row.reservation_id,
      organizationId: row.organization_id,
      eventType: row.event_type,
      fromStatus: (row.from_status as ReservationStatus) ?? undefined,
      toStatus: (row.to_status as ReservationStatus) ?? undefined,
      actorId: row.actor_id ?? undefined,
      notes: row.notes ?? undefined,
      metadata: row.metadata ?? undefined,
      occurredAt: row.occurred_at,
    };
  }
}
