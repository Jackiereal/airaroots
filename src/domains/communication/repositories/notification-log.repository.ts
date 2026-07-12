import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationLogEntry, DeliveryStatus } from '../types';

type LogRow = {
  id: string;
  organization_id: string;
  trigger: string;
  channel: string;
  recipient: string | null;
  rendered_body: string | null;
  provider_type: string | null;
  delivery_status: DeliveryStatus;
  link: string | null;
  error: string | null;
  context: Record<string, unknown>;
  attempts: number;
  created_at: string;
};

function toEntity(r: LogRow): NotificationLogEntry {
  return {
    id: r.id,
    organizationId: r.organization_id,
    trigger: r.trigger,
    channel: r.channel,
    recipient: r.recipient,
    renderedBody: r.rendered_body,
    providerType: r.provider_type,
    deliveryStatus: r.delivery_status,
    link: r.link,
    error: r.error,
    context: r.context ?? {},
    attempts: r.attempts,
    createdAt: r.created_at,
  };
}

export type InsertLogInput = {
  organizationId: string;
  trigger: string;
  channel: string;
  recipient: string | null;
  renderedBody: string | null;
  providerType: string | null;
  deliveryStatus: DeliveryStatus;
  link?: string | null;
  error?: string | null;
  context?: Record<string, unknown>;
};

export class NotificationLogRepository {
  constructor(private supabase: SupabaseClient) {}

  async insert(input: InsertLogInput): Promise<void> {
    const { error } = await this.supabase.from('notification_log').insert({
      organization_id: input.organizationId,
      trigger: input.trigger,
      channel: input.channel,
      recipient: input.recipient,
      rendered_body: input.renderedBody,
      provider_type: input.providerType,
      delivery_status: input.deliveryStatus,
      link: input.link ?? null,
      error: input.error ?? null,
      context: input.context ?? {},
    });

    if (error) throw new Error(`DB error: ${error.message}`);
  }

  async findByOrg(organizationId: string, limit = 100): Promise<NotificationLogEntry[]> {
    const { data, error } = await this.supabase
      .from('notification_log')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`DB error: ${error.message}`);
    return (data ?? []).map((r) => toEntity(r as LogRow));
  }
}
