'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, User, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';

type UserProfile = { id: string; full_name: string | null; role: string; email?: string };
type Property = { id: string; name: string };
type AccessEntry = { property_id: string; user_id: string };

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [access, setAccess] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [grantPropertyId, setGrantPropertyId] = useState('');

  const load = async () => {
    const [uRes, pRes, aRes] = await Promise.all([
      fetch('/api/admin/users').then((r) => r.json()),
      fetch('/api/properties').then((r) => r.json()),
      fetch('/api/admin/property-access').then((r) => r.json()),
    ]);
    setUsers(uRes.users ?? []);
    setProperties(pRes.properties ?? []);
    setAccess(aRes.access ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    await load();
  };

  const handleGrant = async (userId: string) => {
    if (!grantPropertyId) return;
    await fetch('/api/admin/property-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, propertyId: grantPropertyId }),
    });
    setGrantPropertyId('');
    await load();
  };

  const handleRevoke = async (userId: string, propertyId: string) => {
    await fetch('/api/admin/property-access', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, propertyId }),
    });
    await load();
  };

  const userAccess = (userId: string) => access.filter((a) => a.user_id === userId);

  if (loading) return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading…</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold font-[family-name:var(--font-rajdhani)] text-[var(--text-primary)]">
        Users
      </h1>

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden">
        {users.map((u, i) => {
          const grants = userAccess(u.id);
          const isExpanded = selectedUser === u.id;
          return (
            <div key={u.id} className={i > 0 ? 'border-t border-[var(--border-color)]' : ''}>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
                onClick={() => setSelectedUser(isExpanded ? null : u.id)}
              >
                <div className="h-8 w-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
                  {u.role === 'admin' ? (
                    <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                  ) : (
                    <User className="h-4 w-4 text-[var(--text-secondary)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {u.full_name || u.email || u.id}
                  </p>
                  {u.email && u.full_name && (
                    <p className="text-xs text-[var(--text-secondary)] truncate">{u.email}</p>
                  )}
                </div>
                <select
                  value={u.role}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value="admin">Admin</option>
                  <option value="client">Client</option>
                </select>
                {u.role === 'client' && (
                  isExpanded
                    ? <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)] shrink-0" />
                )}
              </div>

              {isExpanded && u.role === 'client' && (
                <div className="border-t border-[var(--border-color)] bg-[var(--bg-elevated)]/50 px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                    Property Access
                  </p>
                  {grants.length === 0 ? (
                    <p className="text-xs text-[var(--text-tertiary)]">No properties assigned.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {grants.map((g) => {
                        const prop = properties.find((p) => p.id === g.property_id);
                        return (
                          <span
                            key={g.property_id}
                            className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
                          >
                            {prop?.name ?? g.property_id}
                            <button
                              type="button"
                              onClick={() => handleRevoke(u.id, g.property_id)}
                              className="text-[var(--text-tertiary)] hover:text-rose-400"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={grantPropertyId}
                      onChange={(e) => setGrantPropertyId(e.target.value)}
                      className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                    >
                      <option value="">— add property access —</option>
                      {properties
                        .filter((p) => !grants.find((g) => g.property_id === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleGrant(u.id)}
                      disabled={!grantPropertyId}
                      className="flex items-center gap-1 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" /> Grant
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
