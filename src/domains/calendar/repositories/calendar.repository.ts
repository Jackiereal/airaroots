import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarBlock, SeasonalRate, CreateBlockInput, UpdateBlockInput, CreateSeasonalRateInput } from '../types';

type CalendarBlockRow = {
  id: string;
  organization_id: string;
  property_id: string;
  reservation_id: string | null;
  start_date: string;
  end_date: string;
  block_type: string;
  reason: string | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type SeasonalRateRow = {
  id: string;
  organization_id: string;
  property_id: string;
  name: string;
  start_date: string;
  end_date: string;
  nightly_rate: string;
  min_nights: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export class CalendarRepository {
  constructor(private supabase: SupabaseClient) {}

  /** Manual holds (owner_hold/maintenance/buffer/seasonal_close) overlapping [checkIn, checkOut).
   * Excludes block_type='reservation' rows — those mirror actual reservations,
   * already covered by ReservationRepository.findConflicts. */
  async findOverlappingHolds(propertyId: string, checkIn: Date, checkOut: Date): Promise<CalendarBlock[]> {
    const { data, error } = await this.supabase
      .from('calendar_blocks')
      .select('*')
      .eq('property_id', propertyId)
      .neq('block_type', 'reservation')
      .lt('start_date', checkOut.toISOString().split('T')[0])
      .gt('end_date', checkIn.toISOString().split('T')[0]);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toBlockEntity(r as CalendarBlockRow));
  }

  async findBlocksByProperty(propertyId: string, from: Date, to: Date): Promise<CalendarBlock[]> {
    const { data, error } = await this.supabase
      .from('calendar_blocks')
      .select('*')
      .eq('property_id', propertyId)
      .lte('start_date', to.toISOString().split('T')[0])
      .gte('end_date', from.toISOString().split('T')[0]);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toBlockEntity(r as CalendarBlockRow));
  }

  async findBlocksByOrganization(orgId: string, from: Date, to: Date): Promise<CalendarBlock[]> {
    const { data, error } = await this.supabase
      .from('calendar_blocks')
      .select('*')
      .eq('organization_id', orgId)
      .lte('start_date', to.toISOString().split('T')[0])
      .gte('end_date', from.toISOString().split('T')[0]);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toBlockEntity(r as CalendarBlockRow));
  }

  async findConflictingBlocks(
    propertyId: string,
    checkIn: Date,
    checkOut: Date
  ): Promise<CalendarBlock[]> {
    const { data, error } = await this.supabase
      .from('calendar_blocks')
      .select('*')
      .eq('property_id', propertyId)
      .lt('start_date', checkOut.toISOString().split('T')[0])
      .gt('end_date', checkIn.toISOString().split('T')[0]);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toBlockEntity(r as CalendarBlockRow));
  }

  async createBlock(input: CreateBlockInput, createdBy?: string): Promise<CalendarBlock> {
    const { data, error } = await this.supabase
      .from('calendar_blocks')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        reservation_id: input.reservationId ?? null,
        start_date: input.startDate,
        end_date: input.endDate,
        block_type: input.blockType,
        reason: input.reason ?? null,
        is_public: input.isPublic ?? true,
        created_by: createdBy ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toBlockEntity(data as CalendarBlockRow);
  }

  async updateBlock(id: string, input: UpdateBlockInput): Promise<CalendarBlock> {
    const updateData: Record<string, unknown> = {};
    if (input.startDate !== undefined) updateData['start_date'] = input.startDate;
    if (input.endDate !== undefined) updateData['end_date'] = input.endDate;
    if (input.reason !== undefined) updateData['reason'] = input.reason;
    if (input.isPublic !== undefined) updateData['is_public'] = input.isPublic;

    const { data, error } = await this.supabase
      .from('calendar_blocks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toBlockEntity(data as CalendarBlockRow);
  }

  async updateBlockByReservationId(
    reservationId: string,
    input: Pick<UpdateBlockInput, 'startDate' | 'endDate'>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('calendar_blocks')
      .update({ start_date: input.startDate, end_date: input.endDate })
      .eq('reservation_id', reservationId);

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async deleteBlock(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('calendar_blocks')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async deleteBlockByReservationId(reservationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('calendar_blocks')
      .delete()
      .eq('reservation_id', reservationId);

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  // Seasonal rates
  async findSeasonalRates(propertyId: string): Promise<SeasonalRate[]> {
    const { data, error } = await this.supabase
      .from('seasonal_rates')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('start_date', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => this.toSeasonalRateEntity(r as SeasonalRateRow));
  }

  async findActiveRateForDate(propertyId: string, date: Date): Promise<SeasonalRate | null> {
    const dateStr = date.toISOString().split('T')[0];
    const { data, error } = await this.supabase
      .from('seasonal_rates')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .lte('start_date', dateStr)
      .gte('end_date', dateStr)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!data) return null;
    return this.toSeasonalRateEntity(data as SeasonalRateRow);
  }

  async createSeasonalRate(input: CreateSeasonalRateInput): Promise<SeasonalRate> {
    const { data, error } = await this.supabase
      .from('seasonal_rates')
      .insert({
        organization_id: input.organizationId,
        property_id: input.propertyId,
        name: input.name,
        start_date: input.startDate,
        end_date: input.endDate,
        nightly_rate: input.nightlyRate,
        min_nights: input.minNights ?? 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(`DB error: ${error.message}`);
    return this.toSeasonalRateEntity(data as SeasonalRateRow);
  }

  private toBlockEntity(row: CalendarBlockRow): CalendarBlock {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      reservationId: row.reservation_id ?? undefined,
      startDate: row.start_date,
      endDate: row.end_date,
      blockType: row.block_type as CalendarBlock['blockType'],
      reason: row.reason ?? undefined,
      isPublic: row.is_public,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toSeasonalRateEntity(row: SeasonalRateRow): SeasonalRate {
    return {
      id: row.id,
      organizationId: row.organization_id,
      propertyId: row.property_id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      nightlyRate: Number(row.nightly_rate),
      minNights: row.min_nights,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
