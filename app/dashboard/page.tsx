import Link from 'next/link';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { Plus } from 'lucide-react';

async function getProperties() {
  const db = createServiceRoleClient();
  const { data } = await db.from('properties').select('id, name, slug, address').order('name');
  return data ?? [];
}

export default async function AdminDashboardPage() {
  const properties = await getProperties();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {properties.length} {properties.length === 1 ? 'property' : 'properties'}
          </p>
        </div>
        <Link
          href="/properties"
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add Property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">No properties yet.</p>
          <Link
            href="/properties"
            className="mt-3 inline-block text-sm text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Create your first property →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}`}
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
