import { createServiceRoleClientLoose } from '../../../infrastructure/supabase/server';
import type {
  ChannelConnection,
  ChannelSyncLog,
  ChannelSyncStatus,
  CreateChannelConnectionInput,
  UpdateChannelConnectionInput,
} from '../types';
import type { ReservationChannel } from '../../reservation/types';

function toConnection(row: Record<string, unknown>): ChannelConnection {
  return {
    id: row['id'] as string,
    organizationId: row['organization_id'] as string,
    propertyId: row['property_id'] as string,
    channel: row['channel'] as ReservationChannel,
    icalUrl: (row['ical_url'] as string | null) ?? null,
    webhookSecret: (row['webhook_secret'] as string | null) ?? null,
    status: row['status'] as ChannelConnection['status'],
    lastSyncAt: (row['last_sync_at'] as string | null) ?? null,
    lastError: (row['last_error'] as string | null) ?? null,
    exportToken: row['export_token'] as string,
    createdBy: (row['created_by'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export const channelRepository = {
  async findActiveConnections(): Promise<ChannelConnection[]> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_connections')
      .select('*')
      .eq('status', 'active')
      .not('ical_url', 'is', null);
    if (error) throw new Error(`channelRepository.findActiveConnections: ${error.message}`);
    return (data ?? []).map(r => toConnection(r as Record<string, unknown>));
  },

  async findByOrganization(organizationId: string): Promise<ChannelConnection[]> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_connections')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`channelRepository.findByOrganization: ${error.message}`);
    return (data ?? []).map(r => toConnection(r as Record<string, unknown>));
  },

  async findByProperty(propertyId: string): Promise<ChannelConnection[]> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_connections')
      .select('*')
      .eq('property_id', propertyId)
      .order('channel');
    if (error) throw new Error(`channelRepository.findByProperty: ${error.message}`);
    return (data ?? []).map(r => toConnection(r as Record<string, unknown>));
  },

  async findById(id: string): Promise<ChannelConnection | null> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_connections')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`channelRepository.findById: ${error.message}`);
    if (!data) return null;
    return toConnection(data as Record<string, unknown>);
  },

  async findByExportToken(token: string): Promise<ChannelConnection | null> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_connections')
      .select('*')
      .eq('export_token', token)
      .maybeSingle();
    if (error) throw new Error(`channelRepository.findByExportToken: ${error.message}`);
    if (!data) return null;
    return toConnection(data as Record<string, unknown>);
  },

  async create(
    organizationId: string,
    input: CreateChannelConnectionInput,
    createdBy: string,
  ): Promise<ChannelConnection> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_connections')
      .insert({
        organization_id: organizationId,
        property_id: input.propertyId,
        channel: input.channel,
        ical_url: input.icalUrl ?? null,
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) throw new Error(`channelRepository.create: ${error.message}`);
    return toConnection(data as Record<string, unknown>);
  },

  async update(id: string, input: UpdateChannelConnectionInput): Promise<ChannelConnection> {
    const db = createServiceRoleClientLoose();
    const patch: Record<string, unknown> = {};
    if (input.icalUrl !== undefined) patch['ical_url'] = input.icalUrl;
    if (input.status !== undefined) patch['status'] = input.status;

    const { data, error } = await db
      .from('channel_connections')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`channelRepository.update: ${error.message}`);
    return toConnection(data as Record<string, unknown>);
  },

  async markSyncResult(
    id: string,
    status: 'active' | 'error',
    lastError: string | null,
  ): Promise<void> {
    const db = createServiceRoleClientLoose();
    const { error } = await db
      .from('channel_connections')
      .update({ status, last_error: lastError, last_sync_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`channelRepository.markSyncResult: ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    const db = createServiceRoleClientLoose();
    const { error } = await db.from('channel_connections').delete().eq('id', id);
    if (error) throw new Error(`channelRepository.delete: ${error.message}`);
  },

  // ── Sync Logs ──────────────────────────────────────────────

  async createSyncLog(params: {
    organizationId: string;
    connectionId: string;
    propertyId: string;
    channel: ReservationChannel;
    triggeredBy: 'cron' | 'manual' | 'webhook';
  }): Promise<string> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_sync_logs')
      .insert({
        organization_id: params.organizationId,
        connection_id: params.connectionId,
        property_id: params.propertyId,
        channel: params.channel,
        triggered_by: params.triggeredBy,
        status: 'running',
      })
      .select('id')
      .single();
    if (error) throw new Error(`channelRepository.createSyncLog: ${error.message}`);
    return (data as { id: string }).id;
  },

  async updateSyncLog(
    logId: string,
    update: {
      status: ChannelSyncStatus;
      reservationsFound?: number;
      reservationsCreated?: number;
      reservationsUpdated?: number;
      reservationsCancelled?: number;
      conflictsDetected?: number;
      errorMessage?: string;
      rawResponseSize?: number;
    },
  ): Promise<void> {
    const db = createServiceRoleClientLoose();
    const { error } = await db
      .from('channel_sync_logs')
      .update({
        status: update.status,
        reservations_found: update.reservationsFound ?? 0,
        reservations_created: update.reservationsCreated ?? 0,
        reservations_updated: update.reservationsUpdated ?? 0,
        reservations_cancelled: update.reservationsCancelled ?? 0,
        conflicts_detected: update.conflictsDetected ?? 0,
        error_message: update.errorMessage ?? null,
        raw_response_size: update.rawResponseSize ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', logId);
    if (error) throw new Error(`channelRepository.updateSyncLog: ${error.message}`);
  },

  async recentSyncLogs(connectionId: string, limit = 10): Promise<ChannelSyncLog[]> {
    const db = createServiceRoleClientLoose();
    const { data, error } = await db
      .from('channel_sync_logs')
      .select('*')
      .eq('connection_id', connectionId)
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`channelRepository.recentSyncLogs: ${error.message}`);
    return (data ?? []).map(r => {
      const row = r as Record<string, unknown>;
      return {
        id: row['id'] as string,
        organizationId: row['organization_id'] as string,
        connectionId: row['connection_id'] as string,
        propertyId: row['property_id'] as string,
        channel: row['channel'] as ReservationChannel,
        status: row['status'] as ChannelSyncStatus,
        triggeredBy: row['triggered_by'] as 'cron' | 'manual' | 'webhook',
        reservationsFound: (row['reservations_found'] as number) ?? 0,
        reservationsCreated: (row['reservations_created'] as number) ?? 0,
        reservationsUpdated: (row['reservations_updated'] as number) ?? 0,
        reservationsCancelled: (row['reservations_cancelled'] as number) ?? 0,
        conflictsDetected: (row['conflicts_detected'] as number) ?? 0,
        errorMessage: (row['error_message'] as string | null) ?? null,
        rawResponseSize: (row['raw_response_size'] as number | null) ?? null,
        startedAt: row['started_at'] as string,
        finishedAt: (row['finished_at'] as string | null) ?? null,
      } satisfies ChannelSyncLog;
    });
  },
};
