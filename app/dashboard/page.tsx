import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { Plus, Building2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import GettingStartedChecklist from '@/components/dashboard/GettingStartedChecklist';
import { channelConnectionService } from '@/src/domains/channel/services/channel-connection.service';

async function getProperties(organizationId: string) {
  const db = createServiceRoleClientLoose();
  const { data } = await db
    .from('properties')
    .select('id, name, slug, address')
    .eq('organization_id', organizationId)
    .order('name');
  return data ?? [];
}

async function getOnboardingState(organizationId: string) {
  const db = createServiceRoleClient();
  const [connections, { count }] = await Promise.all([
    channelConnectionService.findByOrganization(organizationId),
    db
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
  ]);
  return {
    channelConnected: connections.length > 0,
    teamInvited: (count ?? 0) > 1,
  };
}

export default async function AdminDashboardPage() {
  const profile = await getUserProfile();
  if (!profile) redirect('/auth/signin');

  const organizationId = (profile as unknown as { organization_id?: string }).organization_id;
  if (!organizationId) redirect('/auth/signin');

  const properties = await getProperties(organizationId);

  // New user with no properties — send to onboarding
  if (properties.length === 0) redirect('/onboarding');

  const organizationId = (profile as unknown as { organization_id?: string }).organization_id;
  const onboardingState = organizationId ? await getOnboardingState(organizationId) : null;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {organizationId && onboardingState && (
        <GettingStartedChecklist
          organizationId={organizationId}
          channelConnected={onboardingState.channelConnected}
          teamInvited={onboardingState.teamInvited}
        />
      )}
      <PageHeader
        title="Dashboard"
        subtitle={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
        actions={
          <Link
            href="/properties"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Property
          </Link>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          message="No properties yet."
          action={
            <Link
              href="/properties"
              className="text-sm text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Create your first property →
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link key={p.id} href={`/properties/${p.id}`} className="group">
              <Card className="transition-colors group-hover:border-[var(--accent)]/50 group-hover:bg-[var(--bg-elevated)]">
                <h2 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  {p.name}
                </h2>
                {p.address && (
                  <p className="mt-1 text-xs text-[var(--text-secondary)] truncate">{p.address}</p>
                )}
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">View P&L →</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
