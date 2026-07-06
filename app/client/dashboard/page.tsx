import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { createServiceRoleClientLoose } from '@/lib/supabase/server';
import { Building2 } from 'lucide-react';

async function getAssignedProperties(userId: string) {
  const { data } = await createServiceRoleClientLoose()
    .from('property_access')
    .select('property_id, properties(id, name, address)')
    .eq('user_id', userId);
  type PropRow = { id: string; name: string; address: string | null };
  type Row = { property_id: string; properties: PropRow[] };
  return ((data ?? []) as unknown as Row[]).flatMap((r) => r.properties ?? []);
}

export default async function ClientDashboardPage() {
  const user = await getUser();
  if (!user) return null;
  const properties = await getAssignedProperties(user.id);

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
          My Properties
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Properties shared with you
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-[var(--text-tertiary)]" />
          <p className="text-sm text-[var(--text-secondary)]">No properties have been shared with you yet.</p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">Contact your property manager to get access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/client/properties/${p.id}`}
              className="group rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg-elevated)]"
            >
              <h2 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                {p.name}
              </h2>
              {p.address && (
                <p className="mt-1 text-xs text-[var(--text-secondary)] truncate">{p.address}</p>
              )}
              <p className="mt-3 text-xs text-[var(--text-tertiary)]">View P&L →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
