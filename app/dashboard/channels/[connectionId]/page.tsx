import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getUserProfile } from '@/lib/auth';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { channelConnectionService } from '@/src/domains/channel/services/channel-connection.service';
import { channelRepository } from '@/src/domains/channel/repositories/channel.repository';
import { ChannelStatusBadge } from '@/components/channel/ChannelStatusBadge';
import { CHANNEL_LABELS } from '@/src/domains/reservation/constants';
import type { ChannelSyncLog } from '@/src/domains/channel/types';

type Params = { params: Promise<{ connectionId: string }> };

const SYNC_STATUS_COLORS: Record<string, string> = {
  success: 'var(--color-green)',
  partial: 'var(--color-amber)',
  failed:  'var(--color-red)',
  running: 'var(--accent)',
  pending: 'var(--text-tertiary)',
};

export default async function ChannelLogsPage({ params }: Params) {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  const { error: authError, ctx } = await requireOrgAuth();
  if (authError) redirect('/auth/signin');
  const organizationId = ctx!.organizationId;

  const { connectionId } = await params;

  let connection;
  let logs: ChannelSyncLog[] = [];
  try {
    [connection, logs] = await Promise.all([
      channelRepository.findById(connectionId),
      channelConnectionService.getRecentLogs(connectionId, organizationId),
    ]);
  } catch {
    notFound();
  }

  if (!connection || connection.organizationId !== organizationId) notFound();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/dashboard/channels"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Channel Manager
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          {CHANNEL_LABELS[connection.channel] ?? connection.channel}
        </h1>
        <ChannelStatusBadge status={connection.status} />
      </div>

      {connection.icalUrl && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 mb-4">
          <p className="text-xs text-[var(--text-tertiary)] mb-1">iCal URL</p>
          <p className="text-sm font-mono text-[var(--text-secondary)] break-all">{connection.icalUrl}</p>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Recent Sync Logs
          </h2>
        </div>

        {logs.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-tertiary)]">No sync runs yet. Will sync automatically every 15 minutes.</p>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {logs.map(log => (
              <div key={log.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{
                        color: SYNC_STATUS_COLORS[log.status] ?? 'inherit',
                        background: `${SYNC_STATUS_COLORS[log.status] ?? 'var(--text-tertiary)'}20`,
                      }}
                    >
                      {log.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)] capitalize">
                      {log.triggeredBy}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {new Date(log.startedAt).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="mt-2 flex gap-4 text-xs text-[var(--text-secondary)]">
                  <span>Found: {log.reservationsFound}</span>
                  <span>Created: {log.reservationsCreated}</span>
                  <span>Updated: {log.reservationsUpdated}</span>
                  {log.reservationsCancelled > 0 && <span>Cancelled: {log.reservationsCancelled}</span>}
                  {log.conflictsDetected > 0 && (
                    <span style={{ color: 'var(--color-red)' }}>⚠ Conflicts: {log.conflictsDetected}</span>
                  )}
                </div>

                {log.errorMessage && (
                  <p className="mt-1 text-xs text-[var(--color-red)]">{log.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
