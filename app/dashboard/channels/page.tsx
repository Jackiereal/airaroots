import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserProfile } from '@/lib/auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { requireOrgAuth } from '@/src/shared/utils/route-auth';
import { channelConnectionService } from '@/src/domains/channel/services/channel-connection.service';
import { CHANNEL_LABELS } from '@/src/domains/reservation/constants';
import { ChannelStatusBadge } from '@/components/channel/ChannelStatusBadge';
import { ConnectChannelButton } from '@/components/channel/ConnectChannelButton';
import { ChannelConnectionActions } from '@/components/channel/ChannelConnectionActions';

async function getProperties(organizationId: string) {
  const db = createServiceRoleClientLoose();
  // For Phase 1 org bridge, properties aren't org-scoped in DB — use service role + created_by heuristic
  // TODO: add organization_id to properties in Phase 8
  const { data } = await db.from('properties').select('id, name, slug').order('name');
  return (data ?? []) as { id: string; name: string; slug: string }[];
}

export default async function ChannelsPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  const { error: authError, ctx } = await requireOrgAuth();
  if (authError) redirect('/auth/signin');
  const organizationId = ctx!.organizationId;

  const [properties, connections] = await Promise.all([
    getProperties(organizationId),
    channelConnectionService.findByOrganization(organizationId),
  ]);

  // Group connections by property
  const byProperty = new Map<string, typeof connections>();
  for (const conn of connections) {
    const arr = byProperty.get(conn.propertyId) ?? [];
    arr.push(conn);
    byProperty.set(conn.propertyId, arr);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
            Channel Manager
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Connect Airbnb and Booking.com to sync reservations automatically.
          </p>
        </div>
      </div>

      {properties.length === 0 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-[var(--text-secondary)]">No properties yet.</p>
          <Link href="/properties" className="text-[var(--accent)] text-sm mt-2 inline-block hover:underline">
            Add a property →
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {properties.map(property => {
          const propConnections = byProperty.get(property.id) ?? [];
          return (
            <div
              key={property.id}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[var(--text-primary)]">{property.name}</h2>
                <ConnectChannelButton propertyId={property.id} existingChannels={propConnections.map(c => c.channel)} />
              </div>

              {propConnections.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)]">No channels connected. Add Airbnb or Booking.com iCal URL to start syncing.</p>
              ) : (
                <div className="space-y-3">
                  {propConnections.map(conn => (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between gap-4 py-3 border-t border-[var(--border-subtle)] first:border-0 first:pt-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-[var(--text-primary)]">
                            {CHANNEL_LABELS[conn.channel] ?? conn.channel}
                          </span>
                          <ChannelStatusBadge status={conn.status} />
                        </div>
                        {conn.lastSyncAt && (
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                            Last sync: {new Date(conn.lastSyncAt).toLocaleString('en-IN')}
                          </p>
                        )}
                        {conn.lastError && (
                          <p className="text-xs text-[var(--color-red)] mt-0.5 truncate max-w-sm">
                            {conn.lastError}
                          </p>
                        )}
                        {conn.icalUrl && (
                          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 font-mono truncate max-w-sm">
                            {conn.icalUrl}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/dashboard/channels/${conn.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          Logs
                        </Link>
                        <ChannelConnectionActions
                          propertyId={conn.propertyId}
                          connectionId={conn.id}
                          status={conn.status}
                          icalUrl={conn.icalUrl}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* iCal export URL */}
              {propConnections.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">iCal export (subscribe in Google Calendar)</p>
                  <code className="text-xs bg-[var(--bg-elevated)] px-2 py-1 rounded text-[var(--text-secondary)] break-all">
                    {process.env.NEXT_PUBLIC_APP_URL}/api/ical/{propConnections[0]?.exportToken}
                  </code>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
