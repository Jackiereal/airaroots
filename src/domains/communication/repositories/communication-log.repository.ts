import type { SupabaseClient } from '@supabase/supabase-js';
import type { CommunicationLogEntry, CommunicationStatus } from '../types';

type LogRow = {
  id: string;
  organization_id: string;
  reservation_id: string;
  property_id: string | null;
  trigger: string;
  channel: string;
  recipient: string | null;
  rendered_body: string | null;
  status: CommunicationStatus;
  provider: string | null;
  error: string | null;
  created_at: string;
};

function toEntity(r: LogRow): CommunicationLogEntry {
  return {
    id: r.id,
    organizationId: r.organization_id,
    reservationId: r.reservation_id,
    propertyId: r.property_id,
    trigger: r.trigger,
    channel: r.channel,
    recipient: r.recipient,
    renderedBody: r.rendered_body,
    status: r.status,
    provider: r.provider,
    error: r.error,
    createdAt: r.created_at,
  };
}

export type InsertLogInput = {
  organizationId: string;
  reservationId: string;
  propertyId: string | null;
  trigger: string;
  channel: string;
  recipient: string | null;
  renderedBody: string | null;
  status: CommunicationStatus;
  provider: string | null;
  error?: string | null;
};

export class CommunicationLogRepository {
  constructor(private supabase: SupabaseClient) {}

  async existsFor(reservationId: string, trigger: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('communication_log')
      .select('id')
      .eq('reservation_id', reservationId)
      .eq('trigger', trigger)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`DB error: ${error.message}`);
    return !!data;
  }

  async insert(input: InsertLogInput): Promise<void> {
    const { error } = await this.supabase.from('communication_log').insert({
      organization_id: input.organizationId,
      reservation_id: input.reservationId,
      property_id: input.propertyId,
      trigger: input.trigger,
      channel: input.channel,
      recipient: input.recipient,
      rendered_body: input.renderedBody,
      status: input.status,
      provider: input.provider,
      error: input.error ?? null,
    });

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async findByReservation(reservationId: string): Promise<CommunicationLogEntry[]> {
    const { data, error } = await this.supabase
      .from('communication_log')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => toEntity(r as LogRow));
  }
}
